const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { answerGate } = require('../../tests/browser/helpers');

let application, page, profile;
async function launch(executablePath = process.env.LOOPFRONT_TEST_EXE) {
  application = await electron.launch({
    executablePath: executablePath || require('electron'),
    args: executablePath ? [] : [path.join(__dirname, '..')],
    env: { ...process.env, LOOPFRONT_USER_DATA_DIR: profile }
  });
  page = await application.firstWindow();
  await application.context().tracing.start({ screenshots: true, snapshots: true });
  await expect(page.locator('#playBtn')).toBeVisible();
  await application.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]; w.restore(); w.focus();
  });
}
test.beforeEach(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'loopfront-test-'));
  await launch();
});
test.afterEach(async () => {
  if (application) {
    if (test.info().status !== test.info().expectedStatus) {
      await page.screenshot({ path: test.info().outputPath('failure.png') }).catch(() => {});
      await application.context().tracing.stop({ path: test.info().outputPath('trace.zip') }).catch(() => {});
    }
    await application.close(); application = null;
  }
  await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
async function play() {
  await page.locator('#playBtn').click();
  if (await page.locator('#howScreen').isVisible()) await page.locator('#howOkBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
}

test('shared page, desktop metadata, parent gate and sandbox', async () => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page).toHaveURL('loopfront://game/index.html');
  const metadata = await page.evaluate(() => ({
    desktop: window.LoopfrontDesktop, node: typeof window.require,
    android: typeof window.LoopfrontApp, ipc: typeof window.LoopfrontDesktop.send
  }));
  expect(metadata.node).toBe('undefined');
  expect(metadata.android).toBe('undefined');
  expect(metadata.ipc).toBe('undefined');
  expect(metadata.desktop.version).toMatch(/^0\.1\./);
  const preferences = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(preferences.sandbox).toBe(true);
  expect(preferences.contextIsolation).toBe(true);
  expect(preferences.nodeIntegration).toBe(false);
  expect(preferences.webSecurity).toBe(true);
  if (process.env.LOOPFRONT_TEST_EXE) expect(preferences.devTools).toBe(false);
  await page.locator('#parentBtn').click();
  await answerGate(page);
  await expect(page.locator('#verLabel')).toHaveText('Windows preview v' + metadata.desktop.version);
  await expect(page.locator('#updateBtn')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('desktop-parent.png') });
  expect(errors).toEqual([]);
});

test('keyboard play, Escape, focus loss, minimization and fullscreen', async () => {
  await play();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('Escape');
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#pauseScreen')).toBeVisible();
  const before = await page.locator('#statTime').textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator('#statTime')).toHaveText(before);
  await page.locator('#resumeBtn').click();
  // A real second native window takes focus from the game.
  await application.evaluate(({ BrowserWindow }) => {
    globalThis.focusProbe = new BrowserWindow({ width: 200, height: 100, show: true });
    globalThis.focusProbe.focus();
  });
  await expect(page.locator('#pauseScreen')).toBeVisible();
  await application.evaluate(({ BrowserWindow }) => {
    globalThis.focusProbe.destroy(); BrowserWindow.getAllWindows()[0].focus();
  });
  await expect(page.locator('#pauseScreen')).toBeVisible();
  await page.locator('#resumeBtn').click();
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  await expect(page.locator('#pauseScreen')).toBeVisible();
  await application.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.restore(); w.focus(); });
  await expect(page.locator('#pauseScreen')).toBeVisible();
  await page.keyboard.press('F11');
  await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
  await page.keyboard.press('F11');
  await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false);
  await page.screenshot({ path: test.info().outputPath('desktop-paused.png') });
});

test('settings and progress survive restart and a different extraction directory', async () => {
  await page.locator('#nick').fill('Windows Buddy');
  await page.locator('#soundBtn').click();
  await play();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('loopfront.progress') || '{}').best || 0)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  const stored = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  await application.close(); application = null;
  let copy;
  try {
    if (process.env.LOOPFRONT_TEST_EXE) {
      copy = await fs.mkdtemp(path.join(os.tmpdir(), 'loopfront-new-version-'));
      await fs.cp(path.dirname(process.env.LOOPFRONT_TEST_EXE), copy, { recursive: true });
      await launch(path.join(copy, path.basename(process.env.LOOPFRONT_TEST_EXE)));
    } else await launch();
    await expect(page.locator('#nick')).toHaveValue('Windows Buddy');
    await expect(page.locator('#soundBtn')).toHaveClass(/muted/);
    const progress = await page.evaluate(() => localStorage.getItem('loopfront.progress'));
    expect(progress).toBe(stored['loopfront.progress']);
    expect(JSON.parse(progress).best).toBeGreaterThan(0);
    await application.close(); application = null;
  } finally { if (copy) await fs.rm(copy, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
});

test('external navigation, popups, network requests and unknown resources are blocked', async () => {
  expect(await page.evaluate(() => window.open('https://example.com'))).toBeNull();
  await page.evaluate(() => { location.href = 'https://example.com'; });
  await page.waitForTimeout(200);
  await expect(page).toHaveURL('loopfront://game/index.html');
  expect(application.windows()).toHaveLength(1);
  const blocked = await application.evaluate(async ({ session }) => {
    const results = [];
    for (const url of ['https://example.com', 'file:///etc/passwd', 'loopfront://game/other.html']) {
      try { const response = await session.defaultSession.fetch(url); results.push(!response.ok); }
      catch { results.push(true); }
    }
    return results;
  });
  expect(blocked).toEqual([true, true, true]);
});

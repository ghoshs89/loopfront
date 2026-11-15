const { test, expect } = require('@playwright/test');
const { seen, open } = require('./helpers');

async function startPauseResumeHome(page, press) {
  await press('#playBtn');
  await expect(page.locator('#hud')).toBeVisible();
  await press('#pauseBtn');
  await expect(page.locator('#pauseScreen')).toBeVisible();
  await press('#resumeBtn');
  await expect(page.locator('#pauseScreen')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  await press('#pauseBtn');
  await press('#quitBtn');
  await expect(page.locator('#startScreen')).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();
}

test('mouse: start, pause, resume, home', async ({ page }) => {
  await seen(page);
  await open(page);
  await startPauseResumeHome(page, (sel) => page.locator(sel).click());
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 800, height: 480 } });
  test('touch: start, pause, resume, home', async ({ page }) => {
    await seen(page);
    await open(page);
    await startPauseResumeHome(page, (sel) => page.locator(sel).tap());
  });
});

test('first-run tutorial by mouse leads into the first round', async ({ page }) => {
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#howScreen')).toBeVisible();
  await page.locator('#howOkBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
});

test('grown-ups gate: a wrong answer keeps settings closed, the right one opens them', async ({ page }) => {
  await seen(page);
  await open(page);
  await page.locator('#parentBtn').click();
  const q = (await page.locator('#gateQ').textContent()).match(/(\d+) x (\d+)/);
  const answer = Number(q[1]) * Number(q[2]);
  const type = async (n) => {
    for (const d of String(n)) await page.locator('#gateKey' + d).click();
    await page.locator('#gateOk').click();
  };
  await type(answer + 1);
  await expect(page.locator('#parentScreen')).toBeHidden();
  const q2 = (await page.locator('#gateQ').textContent()).match(/(\d+) x (\d+)/);
  await type(Number(q2[1]) * Number(q2[2]));
  await expect(page.locator('#parentScreen')).toBeVisible();
});

test('hearts: shown on Easy, hidden on Hard', async ({ page }) => {
  await seen(page);
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#heartsPanel')).toBeVisible();
});

test('hearts are hidden on Hard', async ({ page }) => {
  await seen(page, { hard: true });
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#heartsPanel')).toBeHidden();
});

test('joystick: choose it, drag, and the round keeps running without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await seen(page);
  await open(page);
  await page.locator('#steerStick').click();
  await expect(page.locator('#steerStick')).toHaveClass(/sel/);
  await expect(page.locator('#helpText')).toContainText('joystick');
  await page.locator('#playBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(650, 400, { steps: 6 });
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.locator('#hud')).toBeVisible();
  expect(errors).toEqual([]);
});

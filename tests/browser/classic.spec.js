const { test, expect } = require('@playwright/test');
const { seen, open } = require('./helpers');

test('Classic: choose it, read the rules once, play with arrow keys without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await seen(page);
  await open(page);
  await expect(page.locator('#modeIsland')).toHaveClass(/sel/);
  await page.locator('#modeClassic').click();
  await expect(page.locator('#modeClassic')).toHaveClass(/sel/);
  await expect(page.locator('#bestLabel')).toHaveText(/^Classic best:/);
  await page.locator('#playBtn').click();
  await expect(page.locator('#classicHowScreen')).toBeVisible();
  await page.locator('#classicOkBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#minimap')).toHaveClass(/square/);
  for (const k of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(400);
  }
  await expect(page.locator('#heartsPanel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Classic: a reload starts on Island again and skips the rules', async ({ page }) => {
  await seen(page);
  await open(page);
  await page.locator('#modeClassic').click();
  await page.locator('#playBtn').click();
  await page.locator('#classicOkBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.reload();
  await expect(page.locator('#modeIsland')).toHaveClass(/sel/);
  await page.locator('#modeClassic').click();
  await page.locator('#playBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#classicHowScreen')).toBeHidden();
});

test.describe('Classic on a phone', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 640 } });
  test('mode buttons fit and a swipe turns without errors', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await seen(page);
    await open(page);
    const m = await page.evaluate(() => {
      const r = document.querySelector('.moderow').getBoundingClientRect();
      return { x: r.x, w: r.width, vw: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x + m.w).toBeLessThanOrEqual(m.vw + 0.5);
    expect(m.overflow).toBe(false);
    await page.locator('#modeClassic').tap();
    await page.locator('#playBtn').tap();
    await page.locator('#classicOkBtn').tap();
    await expect(page.locator('#hud')).toBeVisible();
    await page.mouse.move(180, 400); await page.mouse.down(); await page.mouse.move(260, 400, { steps: 4 }); await page.mouse.up();
    await page.waitForTimeout(500);
    await testInfo.attach('classic-360x640', { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
});

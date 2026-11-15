const { test, expect } = require('@playwright/test');
const { seen, open } = require('./helpers');

test('ordinary play: no page errors, console errors or outside requests', async ({ page }) => {
  const errors = [];
  const outside = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://127.0.0.1:4173/') && !u.startsWith('data:') && !u.startsWith('blob:')) outside.push(u);
  });
  await seen(page);
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(300 + i * 40, 200 + (i % 4) * 90);
    await page.waitForTimeout(250);
  }
  await page.locator('#pauseBtn').click();
  await page.locator('#resumeBtn').click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
});

test('the page cannot reach the network even if asked to', async ({ page }) => {
  await seen(page);
  await open(page);
  const result = await page.evaluate(() => fetch('https://example.com/').then(() => 'reached', () => 'blocked'));
  expect(result).toBe('blocked');
});

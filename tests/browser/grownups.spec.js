const { test, expect } = require('@playwright/test');
const { seen, open, answerGate, seedLimit } = require('./helpers');

test('daily limit reached: Play shows the friendly done screen instead of starting', async ({ page }) => {
  await seedLimit(page, 2000);
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#doneScreen')).toBeVisible();
  await expect(page.locator('#doneScreen')).toContainText('All done for today');
  await expect(page.locator('#hud')).toBeHidden();
  await page.locator('#doneHomeBtn').click();
  await expect(page.locator('#doneScreen')).toBeHidden();
  await expect(page.locator('#startScreen')).toBeVisible();
});

test('daily limit reached: a grown-up can add 15 more minutes', async ({ page }) => {
  await seedLimit(page, 2000);
  await open(page);
  await page.locator('#playBtn').click();
  await page.locator('#doneMoreBtn').click();
  await expect(page.locator('#gateScreen')).toBeVisible();
  await answerGate(page);
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#doneScreen')).toBeHidden();
});

test('daily limit not reached: play starts normally', async ({ page }) => {
  await seedLimit(page, 100);
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#doneScreen')).toBeHidden();
});

for (const [w, h] of [[320, 568], [800, 480], [1280, 800]]) {
  test(`grown-ups card scrolls and stays reachable at ${w} x ${h}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: w, height: h });
    await seen(page);
    await open(page);
    await page.locator('#parentBtn').click();
    await answerGate(page);
    await expect(page.locator('#parentScreen')).toBeVisible();
    await expect(page.locator('#usageLine')).toHaveText(/^Today \d+ min · \d+ rounds? · best \d+\.\d\d%$/);
    const m = await page.evaluate(() => {
      const c = document.getElementById('parentCard');
      const r = c.getBoundingClientRect();
      return { height: r.height, vh: window.innerHeight, x: r.x, width: r.width, vw: document.documentElement.clientWidth, scrollable: c.scrollHeight > c.clientHeight };
    });
    expect(m.height).toBeLessThanOrEqual(m.vh * 0.9 + 1);
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width).toBeLessThanOrEqual(m.vw + 0.5);
    await testInfo.attach(`grownups-${w}x${h}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('#limit60').click();                       // reachable even when the card has to scroll
    await expect(page.locator('#limit60')).toHaveClass(/sel/);
    await page.locator('#parentCloseBtn').click();
    await expect(page.locator('#parentScreen')).toBeHidden();
  });
}

const { test, expect } = require('@playwright/test');
const { seen, open } = require('./helpers');

for (const [w, h] of [[360, 640], [1280, 800]]) {
  test(`challenges list fits, plays and returns at ${w} x ${h}`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await page.locator('#challengesBtn').click();
    await expect(page.locator('#challengeScreen')).toBeVisible();
    await expect(page.locator('#challengeList .chrow')).toHaveCount(3);
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      rows: [...document.querySelectorAll('#challengeList .chrow')].map((r) => { const b = r.getBoundingClientRect(); return { x: b.x, w: b.width }; }),
      vw: document.documentElement.clientWidth
    }));
    expect(m.overflow).toBe(false);
    for (const r of m.rows) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(m.vw + 0.5); }
    await testInfo.attach(`challenges-${w}x${h}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('#challengeList .chrow button').first().click();
    await expect(page.locator('#challengeScreen')).toBeHidden();
    await page.evaluate(() => window.onLoopfrontBack());
    await page.getByRole('button', { name: 'Play First Rectangle' }).click();
    await page.locator('#classicOkBtn').click();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#goalPill')).toHaveText('Goal: close one loop');
    await page.locator('#pauseBtn').click();
    await page.locator('#quitBtn').click();
    await expect(page.locator('#startScreen')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('locked buddies explain how to earn them', async ({ page }) => {
  await seen(page);
  await open(page);
  await expect(page.locator('#characters button')).toHaveCount(11);
  await page.locator('#characters button').nth(9).click();
  await expect(page.locator('#avatarMsg')).toHaveText('Unlock: Own 25% in Classic (best 0.00%)');
});

const { test, expect } = require('@playwright/test');
const { seen, open } = require('./helpers');

const KEYS = ['Enter', 'Space'];

for (const key of KEYS) {
  test.describe(`${key} on focused start-screen controls`, () => {
    const cases = [
      ['Sound', '#soundBtn', async (page) => expect(page.locator('#soundBtn')).toHaveClass(/muted/)],
      ['Help', '#howBtn', async (page) => expect(page.locator('#howScreen')).toBeVisible()],
      ['Stars', '#starsBtn', async (page) => expect(page.locator('#starsScreen')).toBeVisible()],
      ['random name', '#diceBtn', async (page) => expect(page.locator('#nick')).not.toHaveValue('')],
      ['character selector', '#characters button >> nth=3', async (page) => expect(page.locator('#characters button').nth(3)).toHaveClass(/sel/)],
      ['colour selector', '#swatches button >> nth=4', async (page) => expect(page.locator('#swatches button').nth(4)).toHaveClass(/sel/)],
      ['Grown-ups', '#parentBtn', async (page) => expect(page.locator('#gateScreen')).toBeVisible()]
    ];
    for (const [name, selector, effect] of cases) {
      test(`${name} does its own job and does not start a game`, async ({ page }) => {
        await seen(page);
        await open(page);
        await page.locator(selector).focus();
        await page.keyboard.press(key);
        await effect(page);
        await expect(page.locator('#hud')).toBeHidden();
      });
    }
  });
}

test('PLAY by keyboard opens the first-run tutorial exactly once', async ({ page }) => {
  await open(page);                                     // fresh storage: tutorial not seen yet
  await page.locator('#playBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#howScreen')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.locator('#howScreen')).toBeVisible();   // not closed again by a second activation
  await expect(page.locator('#hud')).toBeHidden();
  await page.locator('#howOkBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#howScreen')).toBeHidden();
});

for (const key of KEYS) {
  test(`PLAY by ${key} starts exactly one round once the tutorial is seen`, async ({ page }) => {
    await seen(page);
    await open(page);
    await page.locator('#playBtn').focus();
    await page.keyboard.press(key);
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#startScreen')).toBeHidden();
    await expect(page.locator('#howScreen')).toBeHidden();
  });
}

test('Enter in the name field starts a round', async ({ page }) => {
  await seen(page);
  await open(page);
  await page.locator('#nick').fill('Zed');
  await page.keyboard.press('Enter');
  await expect(page.locator('#hud')).toBeVisible();
});

test('Enter in the name field does nothing while another screen is open', async ({ page }) => {
  await seen(page);
  await open(page);
  await page.locator('#howBtn').click();
  await page.locator('#nick').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#howScreen')).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();
});

for (const key of KEYS) {
  test(`${key} with nothing focused starts a round`, async ({ page }) => {
    await seen(page);
    await open(page);
    await page.keyboard.press(key);
    await expect(page.locator('#hud')).toBeVisible();
  });
}

test('a held Enter key starts a single round without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seen(page);
  await open(page);
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(page.locator('#hud')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('results screen controls', () => {
  // hard rules: with no steering the player reaches the island edge and the round ends by itself
  for (const key of KEYS) {
    test(`${key} on Play again starts one new round`, async ({ page }) => {
      test.setTimeout(90000);
      await seen(page, { hard: true });
      await open(page);
      await page.locator('#playBtn').click();
      await expect(page.locator('#overScreen')).toBeVisible({ timeout: 45000 });
      await page.locator('#againBtn').focus();
      await page.keyboard.press(key);
      await expect(page.locator('#hud')).toBeVisible();
      await expect(page.locator('#overScreen')).toBeHidden();
    });
  }

  test('Enter on Home returns to the start screen', async ({ page }) => {
    test.setTimeout(90000);
    await seen(page, { hard: true });
    await open(page);
    await page.locator('#playBtn').click();
    await expect(page.locator('#overScreen')).toBeVisible({ timeout: 45000 });
    await page.locator('#menuBtn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#startScreen')).toBeVisible();
    await expect(page.locator('#hud')).toBeHidden();
  });
});

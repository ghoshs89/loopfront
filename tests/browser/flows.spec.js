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

const { overlap } = require('./helpers');

for (const [w, h] of [[320, 568], [360, 640], [800, 480], [1280, 800]]) {
  test(`shop: opens, shows a message when a hat is too dear, fits at ${w} x ${h}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: w, height: h });
    await seen(page);
    await open(page);
    await page.locator('#shopBtn').click();
    await expect(page.locator('#shopScreen')).toBeVisible();
    await expect(page.locator('#shopGrid .tile')).toHaveCount(7);
    await page.locator('#shopGrid .tile').nth(6).click();            // the crown: 200 coins, we have none
    await expect(page.locator('#shopMsg')).toContainText('Need 200 more');
    const m = await page.evaluate(() => ({
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      card: (() => { const r = document.querySelector('#shopScreen .card').getBoundingClientRect(); return { x: r.x, width: r.width }; })(),
      vw: document.documentElement.clientWidth
    }));
    expect(m.docOverflow).toBe(false);
    expect(m.card.x).toBeGreaterThanOrEqual(0);
    expect(m.card.x + m.card.width).toBeLessThanOrEqual(m.vw + 0.5);
    await page.locator('#shopTabTrails').click();
    await expect(page.locator('#shopGrid .tile')).toHaveCount(4);
    await page.locator('#shopTabIslands').click();
    await expect(page.locator('#shopGrid .tile')).toHaveCount(4);
    await testInfo.attach(`shop-${w}x${h}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.locator('#shopCloseBtn').click();
    await expect(page.locator('#shopScreen')).toBeHidden();
  });

  test(`start screen: the daily mission card is short, readable and inside the screen at ${w} x ${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seen(page);
    await open(page);
    const card = page.locator('#missionCard');
    await expect(card).toBeVisible();
    const text = (await page.locator('#missionText').textContent()) || '';
    expect(text.trim().split(/\s+/).length).toBeLessThanOrEqual(5);
    const m = await page.evaluate(() => {
      const r = document.getElementById('missionCard').getBoundingClientRect();
      const t = document.getElementById('missionText');
      return { x: r.x, width: r.width, vw: document.documentElement.clientWidth, clipped: t.scrollWidth > t.clientWidth + 1, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width).toBeLessThanOrEqual(m.vw + 0.5);
    expect(m.docOverflow).toBe(false);
    expect(m.clipped).toBe(false);
  });

  test(`start screen: corner labels and buttons do not overlap at ${w} x ${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seen(page);
    await open(page);
    const boxes = await page.evaluate(() => ['coinLabel', 'bestLabel', 'parentBtn'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { id, x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
  });
}

const { test, expect } = require('@playwright/test');
const { seen, open, overlap } = require('./helpers');

const SIZES = [
  [320, 568], [360, 640], [390, 844], [600, 800], [601, 800], [800, 480], [960, 600], [1280, 800]
];
const LONG = 'WWWWWWWWWWWWWW';       // 14 wide letters: the longest, widest name

for (const [w, h] of SIZES) {
  test(`HUD fits at ${w} x ${h}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: w, height: h });
    await seen(page);
    await open(page);
    await page.locator('#nick').fill(LONG);
    await page.locator('#playBtn').click();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#boardList li').first()).toBeVisible();

    // worst-case content: widest names and counters, measured in the same synchronous step
    const m = await page.evaluate(({ w }) => {
      const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => { el.textContent = text; });
      set('#boardList li .name', 'WWWWWWWWWWWWWW');
      set('#boardList li .pct', '100.00%');
      document.getElementById('statPct').textContent = '100.00%';
      document.getElementById('statKills').textContent = '99';
      document.getElementById('statTime').textContent = '99:59';
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const stats = [...document.querySelectorAll('#hudTop .stat')];
      return {
        vw: document.documentElement.clientWidth,
        pause: box(document.getElementById('pauseBtn')),
        stats: stats.map(box),
        statOverflow: stats.map((s) => [...s.querySelectorAll('.val, .lbl')].some((v) => v.scrollWidth > v.clientWidth + 1)),
        top: box(document.getElementById('hudTop')),
        hearts: (() => { const el = document.getElementById('heartsPanel'); return el.offsetParent ? box(el) : null; })(),
        board: box(document.getElementById('board')),
        boardOverflow: [...document.querySelectorAll('#boardList li')].some((li) => li.scrollWidth > li.clientWidth + 1 && getComputedStyle(li).overflow === 'visible'),
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    }, { w });

    expect(m.hearts).not.toBeNull();            // Easy is the default: hearts are shown
    const parts = [m.pause, ...m.stats, m.hearts];
    for (const p of parts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(m.vw + 0.5);
    }
    expect(m.statOverflow.some(Boolean)).toBe(false);
    expect(m.docOverflow).toBe(false);
    expect(m.board.x).toBeGreaterThanOrEqual(0);
    expect(m.board.x + m.board.width).toBeLessThanOrEqual(m.vw + 0.5);
    for (const p of parts) expect(overlap(p, m.board)).toBe(false);
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i], parts[j])).toBe(false);

    expect(m.hearts.y).toBeGreaterThanOrEqual(m.top.y + m.top.height);   // hearts sit under the counters
    if (w <= 600) {
      // narrow: leaderboard sits under the counters, right-aligned, 8 px gap
      expect(m.board.y).toBeGreaterThanOrEqual(m.top.y + m.top.height + 6);
      expect(Math.abs(m.vw - (m.board.x + m.board.width) - 8)).toBeLessThanOrEqual(2);
    } else {
      // wide: counters on the left, leaderboard on the right, side by side
      expect(m.board.x).toBeGreaterThanOrEqual(m.top.x + m.top.width);
    }
    expect(m.pause.width).toBeGreaterThanOrEqual(44);

    await testInfo.attach(`hud-${w}x${h}`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}

test('the HUD never swallows taps meant for the game', async ({ page }) => {
  await seen(page);
  await open(page);
  await page.locator('#playBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  const pe = await page.evaluate(() => ['hud', 'hudBar', 'hudTop', 'board'].map((id) => getComputedStyle(document.getElementById(id)).pointerEvents));
  expect(pe.slice(0, 3)).toEqual(['none', 'none', 'none']);
  const pause = await page.evaluate(() => getComputedStyle(document.getElementById('pauseBtn')).pointerEvents);
  expect(pause).toBe('auto');
});

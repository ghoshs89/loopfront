// Shared helpers for the browser tests.
const SEEN = JSON.stringify({ name: '', color: '#ef476f', character: 'cat', sound: true, seenHowTo: true });
const HARD = JSON.stringify({ difficulty: 'hard', breakMin: 0, saver: false });

// Start with the tutorial already seen (optionally on hard rules, where the island edge ends a round).
async function seen(page, opts) {
  const parent = opts && opts.hard ? HARD : null;
  await page.addInitScript(([s, p]) => {
    try {
      localStorage.setItem('loopfront.settings', s);
      if (p) localStorage.setItem('loopfront.parent', p);
    } catch (e) { /* ignore */ }
  }, [SEEN, parent]);
}

async function open(page) {
  await page.goto('/index.html');
  await page.locator('#playBtn').waitFor({ state: 'visible' });
}

function overlap(a, b) {
  return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
}

module.exports = { seen, open, overlap };

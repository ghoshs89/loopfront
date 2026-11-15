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

// Solve the grown-ups multiplication question on screen.
async function answerGate(page) {
  const q = (await page.locator('#gateQ').textContent()).match(/(\d+) x (\d+)/);
  const answer = Number(q[1]) * Number(q[2]);
  for (const d of String(answer)) await page.locator('#gateKey' + d).click();
  await page.locator('#gateOk').click();
}

// Start with a daily limit of 30 minutes and `sec` seconds already played today.
async function seedLimit(page, sec) {
  await page.addInitScript(([used]) => {
    try {
      const now = Date.now();
      const day = Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);
      localStorage.setItem('loopfront.settings', JSON.stringify({ name: '', color: '#ef476f', character: 'cat', sound: true, seenHowTo: true }));
      localStorage.setItem('loopfront.parent', JSON.stringify({ difficulty: 'easy', breakMin: 0, saver: false, dailyMin: 30 }));
      localStorage.setItem('loopfront.usage', JSON.stringify({ day, sec: used, extraSec: 0, rounds: 0, best: 0 }));
    } catch (e) { /* ignore */ }
  }, [sec]);
}

module.exports.answerGate = answerGate;
module.exports.seedLimit = seedLimit;

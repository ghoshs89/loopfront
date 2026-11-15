// Headless test harness for web/index.html.   Run:  node tests/harness.js web/index.html
// It evaluates the game's script against stub DOM / canvas objects and checks rules, UI flow,
// battery behaviour and the offline/safety properties. Exit code is non-zero on any failure.
const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

const file = process.argv[2] || path.join(__dirname, '..', 'web', 'index.html');
const html = fs.readFileSync(file, 'utf8');
let src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const tail = src.lastIndexOf('})();');
src = src.slice(0, tail) + `globalThis.__T = { entities, owner, counts, inArena, input, cam, N, CELL,
  CENTER, ARENA_R, SPEED, HOME_R, settings, parentCfg, progress, GOALS,
  get arenaCells(){return arenaCells}, get mode(){return mode}, get simTime(){return simTime},
  get player(){return player}, get paused(){return paused}, get diff(){return diff},
  get playedSec(){return playedSec}, set playedSec(v){playedSec=v},
  get newStars(){return newStars}, get roundLoops(){return roundLoops},
  capture, addTrailPoint, stampDisc, kill, startMatch, step, pctOf, breakTick,
  get pendingEnd(){return pendingEnd}, get bestPct(){return bestPct},
  get hearts(){return hearts}, set hearts(v){hearts=v},
  pickups, get nextPickupAt(){return nextPickupAt}, get zoomUntil(){return zoomUntil}, get bubbleUntil(){return bubbleUntil},
  get freezeUntil(){return freezeUntil}, get roundPower(){return roundPower},
  set roundLoops(v){roundLoops=v}, set roundPower(v){roundPower=v} };\n` + src.slice(tail);

// ---- elements that start hidden in the HTML ----
const seed = {};
for (const m of html.matchAll(/<[a-z0-9]+\s+id="([^"]+)"\s+class="([^"]*)"/g)) seed[m[1]] = m[2].split(/\s+/).filter(Boolean);

const listeners = {};
let renderCount = 0;
const ctxLog = { recording: false, dash: [], fills: new Set(), strokes: new Set() };   // what the game asked the canvas to draw
const ctx2d = new Proxy({}, {
  get(t, k) {
    if (k === 'setLineDash') return (a) => { if (ctxLog.recording) ctxLog.dash.push(JSON.stringify(a)); };
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    if (k === 'fillRect') return (x, y, w, h) => { if (x === 0 && y === 0 && w === 1280 && h === 800) renderCount++; };
    if (k === 'measureText') return () => ({ width: 10 });
    return k in t ? t[k] : () => {};
  },
  set(t, k, v) {
    if (ctxLog.recording) { if (k === 'fillStyle') ctxLog.fills.add(v); else if (k === 'strokeStyle') ctxLog.strokes.add(v); }
    t[k] = v; return true;
  }
});
function mkEl(id) {
  const cls = new Set(seed[id] || []);
  let text = '';
  const el = {
    id, style: {}, children: [], value: '', innerHTML: '',
    // like a real DOM node: assigning '' to textContent removes the children
    get textContent() { return text; },
    set textContent(v) { text = String(v); if (text === '') this.children.length = 0; }, className: '', width: 0, height: 0,
    disabled: false, dataset: {}, type: '',
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, on) => ((on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c))
    },
    appendChild(c) { this.children.push(c); return c; },
    remove() {}, blur() {}, focus() {}, setAttribute() {}, getContext() { return ctx2d; },
    addEventListener(type, fn) { (listeners[id + ':' + type] = listeners[id + ':' + type] || []).push(fn); }
  };
  return el;
}
const els = {};
let anon = 0, rafCb = null, fakeNow = 1000;
globalThis.document = {
  hidden: false,
  getElementById: id => els[id] || (els[id] = mkEl(id)),
  createElement: tag => mkEl('anon' + (anon++) + ':' + tag),
  addEventListener(type, fn) { (listeners['document:' + type] = listeners['document:' + type] || []).push(fn); }
};
globalThis.window = globalThis;
Object.assign(globalThis, {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1.5,
  addEventListener(type, fn) { (listeners['window:' + type] = listeners['window:' + type] || []).push(fn); },
  matchMedia: () => ({ matches: true }),
  requestAnimationFrame: cb => { rafCb = cb; return 1; },
  cancelAnimationFrame: () => { rafCb = null; }
});
Object.defineProperty(globalThis, 'performance', { value: { now: () => fakeNow }, configurable: true, writable: true });
Date.now = () => fakeNow;

function makeStorage(initial) {
  return {
    _d: Object.assign({}, initial), writes: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); this.writes[k] = (this.writes[k] || 0) + 1; },
    removeItem(k) { delete this._d[k]; }
  };
}
// kids' defaults for the core rule tests: hard rules, no break reminder, tutorial already seen
const DEFAULT_STORE = {
  'loopfront.settings': JSON.stringify({ name: '', color: '#ef476f', character: 'cat', sound: true, seenHowTo: true }),
  'loopfront.parent': JSON.stringify({ difficulty: 'hard', breakMin: 0, saver: false })
};

// Start a brand-new game instance (as if the page was reloaded) against the given stored data.
// opts.throwing: storage that throws on every access, like a blocked or full browser store.
let T;
function boot(store, opts) {
  for (const k of Object.keys(listeners)) delete listeners[k];
  for (const k of Object.keys(els)) delete els[k];
  rafCb = null; renderCount = 0; document.hidden = false;
  if (opts && opts.throwing) {
    globalThis.localStorage = {
      getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage full'); },
      removeItem() { throw new Error('storage blocked'); }
    };
  } else {
    globalThis.localStorage = makeStorage(store);
  }
  (0, eval)(src);
  T = globalThis.__T;
}
boot(DEFAULT_STORE);
const fire = (key, ev) => (listeners[key] || []).forEach(fn => fn(ev || {}));
const key = (type, k) => fire('window:' + type, { key: k, target: null, preventDefault() {} });
const click = id => fire(id + ':click');
function frames(n, ms) { for (let i = 0; i < n; i++) { fakeNow += ms || 1000 / 60; const cb = rafCb; if (cb) cb(fakeNow); } }
const poke = () => fire('window:pointermove', { clientX: 5, clientY: 5 });
const hasClass = (id, c) => els[id].classList.contains(c);

let failed = 0, total = 0;
function check(name, ok, extra) {
  total++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined && extra !== '' ? '  [' + extra + ']' : ''));
  if (!ok) failed++;
}

function invariants(label) {
  const real = new Int32Array(T.counts.length);
  for (let i = 0; i < T.owner.length; i++) {
    real[T.owner[i]]++;
    if (T.owner[i] && !T.inArena[i]) return check(label + ': owned cell outside arena', false);
  }
  let ok = true, detail = '';
  for (const e of T.entities) {
    if (real[e.id] !== T.counts[e.id]) { ok = false; detail += ` id${e.id} real=${real[e.id]} counts=${T.counts[e.id]}`; }
    if (!e.alive && real[e.id] !== 0) { ok = false; detail += ` dead id${e.id} still owns ${real[e.id]}`; }
    if (e.alive && (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.angle))) { ok = false; detail += ` NaN id${e.id}`; }
    if (e.alive && Math.hypot(e.x - T.CENTER, e.y - T.CENTER) > T.ARENA_R) { ok = false; detail += ` id${e.id} outside arena`; }
    if (e.alive && real[e.id] === 0) { ok = false; detail += ` alive id${e.id} owns nothing`; }
  }
  check(label + ': grid/count invariants', ok, detail);
}

const DIRKEYS = ['d', 's', 'a', 'w'];
function spinFrame(p) {
  const q = ((Math.round((p.angle + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
  DIRKEYS.forEach((k, i) => key(i === q ? 'keydown' : 'keyup', k));
}
function releaseAll() { DIRKEYS.forEach(k => key('keyup', k)); }

function soloStart() {
  click('againBtn');
  for (const e of T.entities) if (!e.isPlayer && e.alive) T.kill(e, null, 'wall');
  for (const e of T.entities) if (!e.isPlayer) e.respawnAt = 1e9;
  return T.player;
}
function readQuestion() {
  const m = els.gateQ.textContent.match(/(\d+) x (\d+)/);
  return m ? +m[1] * +m[2] : -1;
}
function typeAnswer(n) {
  click('gateClear');
  for (const d of String(n)) click('gateKey' + d);
  click('gateOk');
}
function openParentViaGate() {
  click('parentBtn');
  typeAnswer(readQuestion());
}
function placeOnTrail(bot, p, name) {
  // put a bot right on the player's trail so contact is certain on the next step
  const k = Math.max(0, p.tx.length - 25);
  bot.alive = true; bot.name = name; bot.kills = 0; bot.isPlayer = false;
  bot.bx0 = T.N; bot.by0 = T.N; bot.bx1 = -1; bot.by1 = -1;
  bot.x = bot.px = p.tx[k] + 3; bot.y = bot.py = p.ty[k];
  T.stampDisc(bot, bot.x + 400, bot.y, 30, false);
  bot.ai = { state: 'attack', plan: null, next: 1e9, homeSince: 0, bold: 1, caution: 0.7, aggr: 0, ax: 0, ay: 0 };
  bot.angle = bot.targetAngle = 0;
}

// =====================================================================
// 1. flood-fill unit tests
// =====================================================================
{
  T.startMatch(false);
  for (const e of T.entities) if (e.alive) T.kill(e, null, 'wall');
  const e = T.entities[3];
  e.alive = true; e.isPlayer = false; e.x = 1500; e.y = 1500; e.bx0 = T.N; e.by0 = T.N; e.bx1 = -1; e.by1 = -1;
  T.stampDisc(e, 1500, 1500, 58, false);
  const pts = [[1550, 1500], [1900, 1500], [1900, 1800], [1500, 1800], [1500, 1550]];
  let [lx, ly] = pts[0];
  T.addTrailPoint(e, lx, ly);
  for (let k = 1; k < pts.length; k++) {
    const [x, y] = pts[k]; const d = Math.hypot(x - lx, y - ly), n = Math.ceil(d / 6);
    for (let s = 1; s <= n; s++) T.addTrailPoint(e, lx + (x - lx) * s / n, ly + (y - ly) * s / n);
    lx = x; ly = y;
  }
  e.x = 1500; e.y = 1545;
  T.capture(e);
  const got = T.counts[e.id] * T.CELL * T.CELL;
  check('flood fill claims enclosed rectangle', got > 400 * 300 * 0.97 && got < 400 * 300 * 1.15 + 11000, `area=${got}`);
  check('trail cleared after capture', e.tx.length === 0);
  const foe = T.entities[4];
  foe.alive = true; foe.x = 1700; foe.y = 1650; foe.bx0 = T.N; foe.by0 = T.N; foe.bx1 = -1; foe.by1 = -1;
  T.stampDisc(foe, 1700, 1650, 40, false);
  const foeCells = T.counts[foe.id];
  for (let x = 1445; x >= 1380; x -= 6) T.addTrailPoint(e, x, 1500);
  for (let y = 1506; y <= 1560; y += 6) T.addTrailPoint(e, 1380, y);
  for (let x = 1386; x <= 1440; x += 6) T.addTrailPoint(e, x, 1560);
  e.x = 1460; e.y = 1545;
  const before = T.counts[e.id];
  T.capture(e);
  check('second loop adds area', T.counts[e.id] > before + 80, `+${T.counts[e.id] - before} cells`);
  check('interior enemy pocket untouched by unrelated capture', T.counts[foe.id] === foeCells, `${T.counts[foe.id]} vs ${foeCells}`);
  invariants('unit');
}

// =====================================================================
// 2. bots only (hard rules): they play behind the start screen
// =====================================================================
{
  T.startMatch(false);
  check('hard rules: 11 bots spawned behind the menu', T.entities.filter(e => e.alive).length === 11);
  let deaths = 0, maxPct = 0;
  let prev = T.entities.map(e => e.alive);
  const t0 = Date.now();
  const real0 = process.hrtime.bigint();
  for (let f = 0; f < 60 * 180; f++) {
    if (f % 600 === 0) poke();
    frames(1);
    T.entities.forEach((e, i) => { if (prev[i] && !e.alive) deaths++; prev[i] = e.alive; });
    if (f % 600 === 599) for (const e of T.entities) if (e.alive) maxPct = Math.max(maxPct, T.pctOf(e));
  }
  const ms = Number(process.hrtime.bigint() - real0) / 1e6;
  const grew = T.entities.filter(e => e.alive && T.counts[e.id] > 500).length;
  check('bots expand territory', grew >= 5, `${grew} bots above start size, top=${maxPct.toFixed(2)}%`);
  check('bot eliminations are bounded', deaths < 90, `${deaths} in 180 s`);
  check('some eliminations happen', deaths > 0);
  console.log(`     180 sim-seconds in ${ms.toFixed(0)} ms (${(ms / 10800).toFixed(3)} ms/frame incl. stub render)`);
  invariants('attract');
}

// =====================================================================
// 3. start screen -> play -> capture a loop
// =====================================================================
{
  els.nick.value = '  <b>Tester</b>  ';
  click('playBtn');
  const p = T.player;
  check('play starts a round', T.mode === 'playing' && p && p.alive && p.isPlayer, `name=${JSON.stringify(p && p.name)}`);
  check('typed name is plain text, trimmed', p.name === '<b>Tester</b>');
  check('start screen hidden, HUD shown', hasClass('startScreen', 'hidden') && !hasClass('hud', 'hidden'));
  const c0 = T.counts[p.id];
  let captured = false;
  for (let f = 0; f < 60 * 6 && p.alive; f++) { spinFrame(p); frames(1); if (T.counts[p.id] > c0 + 50) { captured = true; break; } }
  releaseAll();
  check('circling out and back captures territory', captured, `cells ${c0} -> ${T.counts[p.id]}, alive=${p.alive}`);
  check('loop counted for the round', T.roundLoops >= 1, `loops=${T.roundLoops}`);
  frames(30);
  check('leaderboard rows populated', els.boardList.children.length === 6 && els.boardList.children[0].children[1].textContent.length > 0);
  check('land % shown in HUD', /%$/.test(els.statPct.textContent), els.statPct.textContent);
  invariants('playing');
}

// =====================================================================
// 4. steering: every key and the pointer go toward their side of the screen
// =====================================================================
{
  const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
  const near = (a, b) => Math.abs(norm(a - b)) < 0.05;
  const cases = [['ArrowLeft', Math.PI, 'x', -1], ['ArrowRight', 0, 'x', 1], ['ArrowUp', -Math.PI / 2, 'y', -1], ['ArrowDown', Math.PI / 2, 'y', 1],
                 ['a', Math.PI, 'x', -1], ['d', 0, 'x', 1], ['w', -Math.PI / 2, 'y', -1], ['s', Math.PI / 2, 'y', 1]];
  let bad = 0;
  for (const start of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const [k, want, axis, sign] of cases) {
      const p = soloStart();
      p.x = p.px = T.CENTER; p.y = p.py = T.CENTER; p.angle = start;
      key('keydown', k); frames(70);
      const pos0 = p[axis]; frames(10); key('keyup', k);
      if (!(p.alive && near(p.angle, want) && Math.sign(p[axis] - pos0) === sign)) {
        bad++; check('key ' + k + ' from heading ' + start.toFixed(2), false, 'angle=' + p.angle.toFixed(2) + ' alive=' + p.alive);
      }
    }
  }
  check('all 8 keys steer toward their screen side from every heading', bad === 0);
  for (const [mx, my, axis, sign] of [[100, 400, 'x', -1], [1180, 400, 'x', 1], [640, 50, 'y', -1], [640, 750, 'y', 1]]) {
    const p = soloStart();
    p.x = p.px = T.CENTER; p.y = p.py = T.CENTER; p.angle = 1; T.cam.x = p.x; T.cam.y = p.y;
    fire('window:pointermove', { clientX: mx, clientY: my });
    frames(80); const pos0 = p[axis]; frames(10);
    check('pointer at (' + mx + ',' + my + ') steers ' + axis + (sign > 0 ? '+' : '-'), p.alive && Math.sign(p[axis] - pos0) === sign);
  }
}

// =====================================================================
// 5. endings on hard rules (bots removed so nothing interferes)
// =====================================================================
{
  let p = soloStart();
  let f = 0;
  for (; f < 60 * 20 && T.mode === 'playing'; f++) frames(1);
  check('wall ends the round on hard', T.mode === 'over' && !p.alive, `after ${(f / 60).toFixed(1)} s`);
  check('cause text: wall', els.ovCause.textContent === 'You bumped the edge of the island.', els.ovCause.textContent);
  check('result screen stats filled', /%$/.test(els.ovPct.textContent) && /^\d+:\d\d$/.test(els.ovTime.textContent) && els.ovKills.textContent === '0');
  check('territory removed on exit', T.counts[p.id] === 0);

  p = soloStart();
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  frames(60);
  for (f = 0; f < 60 * 4 && T.mode === 'playing'; f++) { spinFrame(p); frames(1); }
  releaseAll();
  check('own trail ends the round', T.mode === 'over' && els.ovCause.textContent === 'You ran over your own trail.', els.ovCause.textContent);

  p = soloStart();
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  frames(50);
  let bot = T.entities[5];
  placeOnTrail(bot, p, 'Cutter');
  for (f = 0; f < 30 && T.mode === 'playing'; f++) frames(1);
  check('enemy crossing the trail ends the round', T.mode === 'over' && els.ovCause.textContent === 'Cutter crossed your trail.', els.ovCause.textContent);
  check('tag credited to the other player', bot.kills === 1);

  p = soloStart();
  const b2 = T.entities[6];
  b2.alive = true; b2.name = 'Victim'; b2.kills = 0; b2.bx0 = T.N; b2.by0 = T.N; b2.bx1 = -1; b2.by1 = -1;
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  const fx = Math.cos(p.angle), fy = Math.sin(p.angle), sx = -fy, sy = fx;
  const cx = p.x + fx * 150, cy = p.y + fy * 150;
  T.stampDisc(b2, cx - sx * 400, cy - sy * 400, 30, false);
  for (let d = -200; d <= 100; d += 6) T.addTrailPoint(b2, cx + sx * d, cy + sy * d);
  b2.x = cx + sx * 104; b2.y = cy + sy * 104; b2.angle = b2.targetAngle = Math.atan2(sy, sx);
  b2.ai = { state: 'expand', plan: { dir: b2.angle, leg1: 5000, leg2: 10, sign: 1 }, next: 1e9, homeSince: 0, bold: 1, caution: 0, aggr: 0, ax: 0, ay: 0 };
  for (f = 0; f < 90 && b2.alive; f++) frames(1);
  check('touching a bot trail removes the bot', !b2.alive && p.alive && p.kills === 1, `bot alive=${b2.alive} kills=${p.kills}`);
  check('removed bot land cleared', T.counts[b2.id] === 0);
  frames(20);
  check('tag counter in HUD', els.statKills.textContent === '1', els.statKills.textContent);

  p = soloStart();
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  frames(40);
  const b3 = T.entities[7];
  b3.alive = true; b3.name = 'Rammer'; b3.kills = 0; b3.bx0 = T.N; b3.by0 = T.N; b3.bx1 = -1; b3.by1 = -1;
  const hx = Math.cos(p.angle), hy = Math.sin(p.angle);
  b3.x = p.x + hx * 200; b3.y = p.y + hy * 200;
  T.stampDisc(b3, b3.x + hx * 500 - hy * 300, b3.y + hy * 500 + hx * 300, 30, false);
  b3.angle = b3.targetAngle = p.angle + Math.PI;
  b3.ai = { state: 'attack', plan: null, next: 1e9, homeSince: 0, bold: 1, caution: 0, aggr: 0, ax: 0, ay: 0 };
  for (f = 0; f < 60 && T.mode === 'playing'; f++) frames(1);
  check('head-on outside land removes both', T.mode === 'over' && !b3.alive && els.ovCause.textContent === 'You bumped into Rammer.', `${els.ovCause.textContent} botAlive=${b3.alive}`);

  p = soloStart();
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  frames(40);
  const b4 = T.entities[8];
  b4.alive = true; b4.name = 'Homer'; b4.kills = 0; b4.bx0 = T.N; b4.by0 = T.N; b4.bx1 = -1; b4.by1 = -1;
  const gx = Math.cos(p.angle), gy = Math.sin(p.angle);
  b4.x = p.x + gx * 200; b4.y = p.y + gy * 200;
  T.stampDisc(b4, b4.x, b4.y, 120, false);
  b4.angle = b4.targetAngle = p.angle + Math.PI;
  b4.ai = { state: 'attack', plan: null, next: 1e9, homeSince: 0, bold: 1, caution: 0, aggr: 0, ax: 0, ay: 0 };
  for (f = 0; f < 60 && T.mode === 'playing'; f++) frames(1);
  check('head-on: the one on its own land stays', T.mode === 'over' && b4.alive && els.ovCause.textContent === 'You bumped into Homer.', `${els.ovCause.textContent} botAlive=${b4.alive}`);
  invariants('endings');
}

// =====================================================================
// 6. 30 fps device with hitches
// =====================================================================
{
  click('againBtn');
  for (let f = 0; f < 30 * 60; f++) { if (T.player.alive) spinFrame(T.player); frames(1, f % 97 === 0 ? 250 : 1000 / 30); }
  releaseAll();
  invariants('30 fps round');
}

// =====================================================================
// 7. kid mode: easy rules
// =====================================================================
{
  T.parentCfg.difficulty = 'easy';
  let p = soloStart();   // bots killed after start; restart to count them
  click('againBtn');
  const bots = T.entities.filter(e => e.alive && !e.isPlayer);
  check('easy: 6 friendly bots', bots.length === 6, String(bots.length));
  check('easy: no bot can chase', bots.every(b => b.ai.aggr === 0));
  check('easy: bots are slower than the player', bots.every(b => Math.abs(b.speed - T.SPEED * 0.8) < 1e-6) && T.player.speed === T.SPEED);
  let attacked = false;
  for (let f = 0; f < 60 * 120; f++) {
    if (f % 300 === 0) poke();
    frames(1);
    for (const b of T.entities) if (b.alive && !b.isPlayer && b.ai && b.ai.state === 'attack') attacked = true;
  }
  check('easy: no bot enters attack mode in 120 s', !attacked);
  invariants('easy bots');

  T.parentCfg.difficulty = 'normal';
  click('againBtn');
  check('normal: 8 bots', T.entities.filter(e => e.alive && !e.isPlayer).length === 8);

  T.parentCfg.difficulty = 'easy';
  p = soloStart();
  p.x = p.px = T.CENTER + T.ARENA_R - 90; p.y = p.py = T.CENTER; p.angle = 0;
  let minR = 1e9, maxR = 0;
  for (let f = 0; f < 60 * 4; f++) { frames(1); const r = Math.hypot(p.x - T.CENTER, p.y - T.CENTER); minR = Math.min(minR, r); maxR = Math.max(maxR, r); }
  check('easy: the island edge bounces instead of ending the round', T.mode === 'playing' && p.alive && maxR < T.ARENA_R, `maxR=${maxR.toFixed(0)} now=${Math.hypot(p.x - T.CENTER, p.y - T.CENTER).toFixed(0)}`);
  check('easy: bounce heads back inward', Math.hypot(p.x - T.CENTER, p.y - T.CENTER) < T.ARENA_R - 200);

  // start shield
  p = soloStart();
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  frames(60);
  placeOnTrail(T.entities[5], p, 'Early');
  frames(30);
  check('easy: shield keeps the player safe in the first seconds', T.mode === 'playing' && p.alive, `simTime=${T.simTime.toFixed(1)}`);
  p = soloStart();
  p.angle = Math.atan2(T.CENTER - p.y, T.CENTER - p.x);
  frames(60 * 6);
  placeOnTrail(T.entities[5], p, 'Late');
  frames(30);
  check('easy: after the shield an enemy crossing the trail costs a heart, not the round', T.mode === 'playing' && T.hearts === 2, `simTime=${T.simTime.toFixed(1)} hearts=${T.hearts}`);
  T.parentCfg.difficulty = 'hard';
}

// =====================================================================
// 8. wording and screens
// =====================================================================
{
  const lits = [...src.matchAll(/'([^'\\\n]*)'/g)].map(m => m[1]);
  const word = /\b(kill|kills|killed|killing|eliminat\w*)\b/i;      // whole words only: element ids like statKills are fine
  const bad = lits.filter(s => word.test(s));
  const body = html.replace(/<script>[\s\S]*?<\/script>/, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
  check('no violent wording in strings or page text', bad.length === 0 && !word.test(body), bad.join(' | '));
  check('title text is friendly', els.ovTitle.textContent === 'Oops!', els.ovTitle.textContent);
  check('HUD labels say Tags, not Kills', /Tags/.test(html) && !/>Kills</.test(html));
}

// =====================================================================
// 9. grown-ups gate and settings
// =====================================================================
{
  fire('menuBtn:click');
  click('parentBtn');
  check('grown-ups button opens the gate, not the settings', !hasClass('gateScreen', 'hidden') && hasClass('parentScreen', 'hidden'));
  typeAnswer(readQuestion() + 1);
  check('wrong answer does not open settings', hasClass('parentScreen', 'hidden') && !hasClass('gateScreen', 'hidden'));
  typeAnswer(readQuestion() + 1);
  typeAnswer(readQuestion() + 1);
  check('three wrong answers lock the keypad', els.gateKey1.disabled === true && els.gateOk.disabled === true);
  typeAnswer(readQuestion());
  check('locked keypad ignores even the right answer', hasClass('parentScreen', 'hidden'));
  fakeNow += 61000;
  typeAnswer(readQuestion());
  check('right answer after the lock opens settings', !hasClass('parentScreen', 'hidden') && hasClass('gateScreen', 'hidden'));

  click('diffEasy'); click('break15'); click('saverBtn');
  const saved = JSON.parse(localStorage._d['loopfront.parent']);
  check('settings change and persist', T.parentCfg.difficulty === 'easy' && T.parentCfg.breakMin === 15 && T.parentCfg.saver === true &&
        saved.difficulty === 'easy' && saved.breakMin === 15 && saved.saver === true, JSON.stringify(saved));
  click('diffHard'); click('break0'); click('saverBtn');
  check('settings can be changed back', T.parentCfg.difficulty === 'hard' && T.parentCfg.breakMin === 0 && T.parentCfg.saver === false);

  // update panel
  click('parentCloseBtn');
  delete globalThis.LoopfrontApp;
  openParentViaGate();
  check('no app bridge: update button hidden, shows web version', hasClass('updateBtn', 'hidden') && els.verLabel.textContent === 'Web version');
  click('parentCloseBtn');
  let checks = 0, downloads = 0, awake = [];
  globalThis.LoopfrontApp = { getVersion: () => 12, checkUpdate() { checks++; }, openDownload() { downloads++; }, setKeepAwake(on) { awake.push(on); } };
  openParentViaGate();
  check('app bridge: update button visible with version', !hasClass('updateBtn', 'hidden') && /v12/.test(els.verLabel.textContent), els.verLabel.textContent);
  click('updateBtn');
  check('update check asks the app and shows progress', checks === 1 && els.updateStatus.textContent === 'Checking...');
  globalThis.onLoopfrontUpdate({ status: 'ok', latest: 12, current: 12 });
  check('same version: up to date', /up to date \(v12\)/.test(els.updateStatus.textContent) && hasClass('updateGetBtn', 'hidden'), els.updateStatus.textContent);
  globalThis.onLoopfrontUpdate({ status: 'ok', latest: 14, current: 12 });
  check('newer version: offered', /14/.test(els.updateStatus.textContent) && !hasClass('updateGetBtn', 'hidden'), els.updateStatus.textContent);
  click('updateGetBtn');
  check('download button hands over to the app', downloads === 1);
  globalThis.onLoopfrontUpdate({ status: 'error' });
  check('offline: friendly message, no download button', /No internet/.test(els.updateStatus.textContent) && hasClass('updateGetBtn', 'hidden'), els.updateStatus.textContent);
  click('parentCloseBtn');

  // keep-awake only during a round
  click('againBtn');
  const onWhile = awake[awake.length - 1];
  T.kill(T.player, null, 'wall');
  check('screen kept awake during a round, released afterwards', onWhile === true && awake[awake.length - 1] === false, JSON.stringify(awake));
}

// =====================================================================
// 10. break reminder
// =====================================================================
{
  T.parentCfg.breakMin = 15;
  click('againBtn');                 // a round
  T.kill(T.player, null, 'wall');    // ends it -> 'over'
  T.playedSec = 901;
  click('againBtn');
  check('break reminder shown between rounds', !hasClass('breakScreen', 'hidden') && T.mode === 'over');
  check('"I\'m back" waits for the countdown', els.breakOkBtn.disabled === true);
  click('breakOkBtn');
  check('cannot skip the countdown by tapping', T.mode === 'over' && !hasClass('breakScreen', 'hidden'));
  fakeNow += 119000; T.breakTick();
  check('still waiting at 1 s to go', els.breakOkBtn.disabled === true, els.breakCount.textContent);
  fakeNow += 2000; T.breakTick();
  check('countdown finished: button enabled', els.breakOkBtn.disabled === false, els.breakCount.textContent);
  click('breakOkBtn');
  check('after the break a new round starts and timer resets', T.mode === 'playing' && hasClass('breakScreen', 'hidden') && T.playedSec < 1, `playedSec=${T.playedSec}`);

  T.kill(T.player, null, 'wall');
  T.playedSec = 901;
  click('againBtn');
  click('breakSkipBtn');
  check('grown-ups skip opens the gate', !hasClass('gateScreen', 'hidden'));
  typeAnswer(readQuestion());
  check('correct answer skips the break and starts a round', T.mode === 'playing' && hasClass('breakScreen', 'hidden'));

  T.parentCfg.breakMin = 0;
  T.kill(T.player, null, 'wall');
  T.playedSec = 99999;
  click('againBtn');
  check('break "Off" never interrupts', T.mode === 'playing' && hasClass('breakScreen', 'hidden'));

  // a round is never interrupted mid-play
  T.parentCfg.breakMin = 15;
  T.playedSec = 5000;
  for (const e of T.entities) if (!e.isPlayer && e.alive) T.kill(e, null, 'wall');   // keep the 2 s fully predictable
  T.player.x = T.player.px = T.CENTER; T.player.y = T.player.py = T.CENTER;
  frames(120);
  check('a round in progress is never interrupted', T.mode === 'playing' && hasClass('breakScreen', 'hidden'));
  T.parentCfg.breakMin = 0;
}

// =====================================================================
// 11. battery
// =====================================================================
{
  T.parentCfg.difficulty = 'easy';
  let p = soloStart();
  click('pauseBtn');
  check('pause shows the pause screen and stops the loop', T.paused && !hasClass('pauseScreen', 'hidden') && rafCb === null);
  const t0 = T.simTime; frames(60);
  check('simulation frozen while paused', T.simTime === t0);
  click('resumeBtn');
  check('resume restarts the loop', !T.paused && rafCb !== null);
  frames(30);
  check('simulation runs again after resume', T.simTime > t0 + 0.3);

  globalThis.onLoopfrontPause();
  check('app going to background pauses the round and stops the loop', T.paused && rafCb === null);
  globalThis.onLoopfrontResume();
  check('coming back leaves the round paused for the child to resume', T.paused && rafCb === null);
  click('resumeBtn');
  check('child taps Keep playing -> running', !T.paused && rafCb !== null);

  document.hidden = true; fire('document:visibilitychange');
  check('hidden page pauses the round and stops the loop', T.paused && rafCb === null);
  document.hidden = false; fire('document:visibilitychange');
  check('page visible again: still paused until resumed', T.paused && rafCb === null);
  click('resumeBtn');

  // idle menu freezes after 20 s and wakes on touch
  fire('menuBtn:click');
  check('menu animation runs at first', rafCb !== null && T.mode === 'menu');
  frames(60 * 25);
  check('menu stops animating after 20 s without input', rafCb === null);
  fire('window:pointerdown', { clientX: 10, clientY: 10 });
  check('a touch wakes it up again', rafCb !== null);

  // battery saver: same game speed, half the drawing
  click('againBtn');
  for (const e of T.entities) if (!e.isPlayer && e.alive) T.kill(e, null, 'wall');
  for (const e of T.entities) if (!e.isPlayer) e.respawnAt = 1e9;
  T.parentCfg.saver = false;
  frames(10);
  let s0 = T.simTime, r0 = renderCount;
  frames(120);
  const normalSim = T.simTime - s0, normalDraw = renderCount - r0;
  T.parentCfg.saver = true;
  frames(10);
  s0 = T.simTime; r0 = renderCount;
  frames(120);
  const saverSim = T.simTime - s0, saverDraw = renderCount - r0;
  check('battery saver keeps the same game speed', Math.abs(normalSim - saverSim) < 0.15 && Math.abs(saverSim - 2) < 0.2, `normal=${normalSim.toFixed(2)}s saver=${saverSim.toFixed(2)}s`);
  check('battery saver draws about half as many frames', saverDraw <= normalDraw * 0.6 && saverDraw >= normalDraw * 0.4, `normal=${normalDraw} saver=${saverDraw}`);
  T.parentCfg.saver = false;
  T.parentCfg.difficulty = 'hard';
}

// =====================================================================
// 12. back button, tutorial, stars, sound, names
// =====================================================================
{
  click('againBtn');
  check('back during a round pauses it', globalThis.onLoopfrontBack() === true && T.paused);
  check('back while paused is swallowed', globalThis.onLoopfrontBack() === true && T.paused);
  click('resumeBtn');
  fire('menuBtn:click');
  check('back on the plain start screen lets the app leave', globalThis.onLoopfrontBack() === false);
  click('howBtn');
  check('back closes the tutorial', globalThis.onLoopfrontBack() === true && hasClass('howScreen', 'hidden'));
  click('starsBtn');
  check('stars screen lists every goal', !hasClass('starsScreen', 'hidden') && els.starsGrid.children.length >= 8);
  check('back closes the stars screen', globalThis.onLoopfrontBack() === true && hasClass('starsScreen', 'hidden'));
  click('parentBtn');
  check('back closes the gate', globalThis.onLoopfrontBack() === true && hasClass('gateScreen', 'hidden'));
  openParentViaGate();
  check('back closes the grown-ups corner', globalThis.onLoopfrontBack() === true && hasClass('parentScreen', 'hidden'));

  // first-time tutorial
  T.settings.seenHowTo = false;
  click('playBtn');
  check('first play shows the tutorial before starting', !hasClass('howScreen', 'hidden') && T.mode === 'menu');
  click('howOkBtn');
  check('"Got it!" starts the round and remembers it', T.mode === 'playing' && T.settings.seenHowTo === true && JSON.parse(localStorage._d['loopfront.settings']).seenHowTo === true);

  // names
  fire('menuBtn:click');
  els.nick.value = '';
  click('diceBtn');
  check('dice button picks a fun name', els.nick.value.length > 0 && els.nick.value.length <= 14, els.nick.value);
  els.nick.value = '   ';
  click('playBtn');
  check('empty name gets a fun one', T.player.name.length > 0 && T.player.name !== 'You', T.player.name);

  // sound toggle persists
  const before = T.settings.sound;
  click('soundBtn');
  check('sound toggle persists', T.settings.sound === !before && JSON.parse(localStorage._d['loopfront.settings']).sound === !before);
  click('soundBtn');

  // stars
  T.progress.stars = {}; T.progress.best = 0;
  const p = soloStart();
  T.stampDisc(p, p.x, p.y, 420, false);          // roughly 8% of the island
  frames(3);
  const stored = JSON.parse(localStorage._d['loopfront.progress']);
  check('owning 2% and 5% earns those stars once', T.progress.stars.own2 === true && T.progress.stars.own5 === true && !T.progress.stars.own10 &&
        T.newStars.filter(g => g.id === 'own2').length === 1, Object.keys(T.progress.stars).join(','));
  check('stars persist', stored.stars && stored.stars.own2 === true);
  frames(30);
  check('a star is only awarded once', T.newStars.filter(g => g.id === 'own2').length === 1);
  T.kill(p, null, 'self');
  check('result screen announces new stars', /New star/.test(els.ovStars.textContent) && !hasClass('ovStars', 'hidden'), els.ovStars.textContent);
  check('best score saved and shown', T.progress.best > 5 && /Best: [5-9]/.test(els.bestLabel.textContent), els.bestLabel.textContent);
  click('parentBtn'); typeAnswer(readQuestion()); // may still be locked-free
  click('resetBtn');
  check('reset needs a second tap', Object.keys(T.progress.stars).length > 0);
  click('resetBtn');
  check('second tap clears stars and best', Object.keys(T.progress.stars).length === 0 && T.progress.best === 0);
  click('parentCloseBtn');
  invariants('stars');
}

// =====================================================================
// 14. WP0 regressions: records, simultaneous scoring, active time, keyboard, storage, lockout, notes
// =====================================================================
function freshGame(parent) {
  const store = Object.assign({}, DEFAULT_STORE);
  if (parent) store['loopfront.parent'] = JSON.stringify(Object.assign(JSON.parse(store['loopfront.parent']), parent));
  boot(store);
}
function openSpot() {
  for (let a = 0; a < 500; a++) {
    const ang = Math.random() * Math.PI * 2, r = 400 + Math.random() * 600;
    const x = T.CENTER + Math.cos(ang) * r, y = T.CENTER + Math.sin(ang) * r;
    if (T.owner[((y / T.CELL) | 0) * T.N + ((x / T.CELL) | 0)] === 0) return { x, y };
  }
  throw new Error('no free spot');
}
function placeBot(bot, name, x, y, angle) {
  bot.alive = true; bot.isPlayer = false; bot.name = name; bot.kills = 0; bot.respawnAt = 1e9;
  bot.tx.length = 0; bot.ty.length = 0; bot.tl.length = 0;      // a relocated pal must not hit its own old trail
  bot.bx0 = T.N; bot.by0 = T.N; bot.bx1 = -1; bot.by1 = -1;
  bot.x = bot.px = x; bot.y = bot.py = y; bot.angle = bot.targetAngle = angle;
  T.stampDisc(bot, T.CENTER + 30, T.CENTER + 30, 20, false);
  bot.ai = { state: 'expand', plan: { dir: angle, leg1: 9999, leg2: 1, sign: 1 }, next: 1e9, homeSince: 0, bold: 1, caution: 0, aggr: 0, ax: 0, ay: 0 };
}
// player and `extra + 1` pals meet head-on outside any land; the next step resolves them all at once
function headOn(extra) {
  const p = soloStart();
  const s = openSpot();
  p.x = p.px = s.x; p.y = p.py = s.y; p.angle = 0;
  const bots = [];
  for (let i = 0; i <= extra; i++) {
    const b = T.entities[5 + i];
    placeBot(b, 'Pal' + i, s.x + 5 + i, s.y, Math.PI);
    bots.push(b);
  }
  return { p, bots };
}
// the player sits on a huge patch of own land so it can fly around for a long time without dying
function bigLand() {
  const p = soloStart();
  T.stampDisc(p, T.CENTER, T.CENTER, 1400, false);
  p.x = p.px = T.CENTER; p.y = p.py = T.CENTER;
  return p;
}

// ---- A. records ----
{
  freshGame();
  let p = soloStart();
  T.stampDisc(p, p.x, p.y, 380, false);                       // roughly 6.5% of the island
  frames(3);
  const peak = T.pctOf(p);
  click('pauseBtn'); click('quitBtn');                         // Pause, then Home
  let stored = JSON.parse(localStorage._d['loopfront.progress']);
  check('record survives Pause then Home', stored.best >= peak - 0.01 && stored.best > 5, `best=${stored.best} peak=${peak.toFixed(2)}`);
  check('Home does not count the abandoned round as completed', stored.rounds === 0, `rounds=${stored.rounds}`);
  check('Home best-score label shows the saved record', /Best: [5-9]\./.test(els.bestLabel.textContent), els.bestLabel.textContent);
  boot(localStorage._d);
  check('record is still there after reloading the page', T.progress.best > 5 && /Best: [5-9]\./.test(els.bestLabel.textContent), els.bestLabel.textContent);

  // a lower score never overwrites it
  T.progress.best = 50;
  p = soloStart();
  T.stampDisc(p, p.x, p.y, 200, false);
  frames(3);
  T.kill(p, null, 'wall');
  check('a lower score cannot overwrite the record', T.progress.best === 50 && JSON.parse(localStorage._d['loopfront.progress']).best === 50);

  // ordinary frames do not write to storage
  freshGame();
  p = soloStart();
  frames(10);
  const w0 = localStorage.writes['loopfront.progress'] || 0;
  frames(300);
  check('ordinary frames never write progress to storage', (localStorage.writes['loopfront.progress'] || 0) === w0, `${w0} -> ${localStorage.writes['loopfront.progress']}`);

  // backgrounding keeps the record without ending the round
  freshGame();
  p = soloStart();
  T.stampDisc(p, p.x, p.y, 380, false);
  frames(3);
  globalThis.onLoopfrontPause();
  stored = JSON.parse(localStorage._d['loopfront.progress']);
  check('backgrounding preserves the record and the round', stored.best > 5 && T.mode === 'playing' && T.paused, `best=${stored.best}`);

  // reset stays effective: an old round cannot restore the record afterwards
  click('quitBtn');
  openParentViaGate();
  click('resetBtn'); click('resetBtn');
  click('parentCloseBtn');
  check('reset clears the record and stars', T.progress.best === 0 && JSON.parse(localStorage._d['loopfront.progress']).best === 0);
  click('playBtn');
  frames(60);
  stored = JSON.parse(localStorage._d['loopfront.progress']);
  check('a new round after reset does not bring the old record back', stored.best < 1, `best=${stored.best}`);
}

// ---- B. simultaneous collisions are scored together ----
{
  freshGame();
  let before = JSON.parse(localStorage._d['loopfront.progress'] || '{"rounds":0}').rounds || 0;
  let { p, bots } = headOn(0);
  T.step(1 / 60);
  check('mutual head-on ends the round with the right cause', T.mode === 'over' && els.ovCause.textContent === 'You bumped into Pal0.', els.ovCause.textContent);
  check('mutual head-on: the tag is counted on the results', els.ovKills.textContent === '1' && p.kills === 1 && !bots[0].alive, `ovKills=${els.ovKills.textContent}`);
  check('mutual head-on awards "Tag a pal"', T.progress.stars.tag1 === true && /Tag a pal/.test(els.ovStars.textContent), els.ovStars.textContent);
  check('the round is completed exactly once', T.progress.rounds === before + 1, `rounds=${T.progress.rounds}`);

  ({ p, bots } = headOn(0));
  p.kills = 2;
  T.progress.stars = {};
  T.step(1 / 60);
  check('starting with two tags, a simultaneous tag earns "Tag 3 pals"', T.progress.stars.tag3 === true && els.ovKills.textContent === '3' && /Tag 3 pals/.test(els.ovStars.textContent), els.ovStars.textContent);

  before = T.progress.rounds;
  ({ p, bots } = headOn(1));
  T.progress.stars = {};
  T.step(1 / 60);
  check('several pals at once: credits are not duplicated', p.kills === 2 && els.ovKills.textContent === '2' && !bots[0].alive && !bots[1].alive, `kills=${p.kills}`);
  check('several pals at once: only one result per round', T.progress.rounds === before + 1 && T.mode === 'over', `rounds=${T.progress.rounds}`);
  T.step(1 / 60); T.step(1 / 60);
  check('stepping on after the round does not finish it twice', T.progress.rounds === before + 1);
  check('no pending result is left over', T.pendingEnd === null);
}

// ---- other endings keep their cause, territory value and final achievements ----
{
  freshGame();
  let p = soloStart();
  T.stampDisc(p, p.x, p.y, 300, false);                       // ~3.7%: own2 but not own5
  frames(2);
  let pct = T.pctOf(p).toFixed(2);
  T.kill(p, null, 'wall');
  check('wall ending keeps its territory value and achievements', els.ovPct.textContent === pct + '%' && T.progress.stars.own2 === true && els.ovCause.textContent === 'You bumped the edge of the island.', els.ovPct.textContent + ' vs ' + pct);

  p = soloStart();
  T.stampDisc(p, p.x, p.y, 300, false);
  frames(2);
  const b = T.entities[5];
  placeBot(b, 'Bandit', 10, 10, 0);
  pct = T.pctOf(p).toFixed(2);
  T.kill(p, b, 'swallowed');
  check('swallowed ending names the other player and keeps the value', els.ovCause.textContent === 'Bandit took all your land.' && els.ovPct.textContent === pct + '%', els.ovCause.textContent);

  p = soloStart();
  T.stampDisc(p, T.CENTER, T.CENTER, 1500, false);            // the whole island
  frames(2);
  check('winning ends the round once with the champion text', T.mode === 'over' && els.ovTitle.textContent === 'ISLAND CHAMPION!' && els.ovCause.textContent === 'You own the whole island!' && parseFloat(els.ovPct.textContent) > 99.8, els.ovPct.textContent);
  check('a win earns every land star', T.progress.stars.own25 === true && T.progress.stars.own10 === true);
  const rounds = T.progress.rounds;
  frames(30);
  check('a won round is not finished again', T.progress.rounds === rounds);
}

// ---- C. break-reminder time is real active time ----
{
  const results = [];
  for (const ms of [1000 / 60, 100 / 3, 250]) {
    freshGame({ difficulty: 'easy', breakMin: 15 });
    bigLand();
    T.playedSec = 0;
    frames(Math.round(20000 / ms), ms);
    const still = T.mode === 'playing';
    click('pauseBtn');
    results.push({ ms, sec: T.playedSec, still });
    check(`20 s of play counts as 20 s with ${ms.toFixed(1)} ms frames`, still && Math.abs(T.playedSec - 20) < 0.5, `counted ${T.playedSec.toFixed(2)} s`);
  }

  freshGame({ difficulty: 'easy', breakMin: 15 });
  bigLand();
  T.playedSec = 0;
  frames(600);
  globalThis.onLoopfrontPause();
  const a = T.playedSec;
  globalThis.onLoopfrontPause();
  document.hidden = true; fire('document:visibilitychange');
  document.hidden = false; fire('document:visibilitychange');
  check('duplicate pause and background notices do not double-count', Math.abs(a - 10) < 0.3 && T.playedSec === a, `first=${a.toFixed(2)} after=${T.playedSec.toFixed(2)}`);
  fakeNow += 120000;
  globalThis.onLoopfrontResume();
  click('resumeBtn');
  frames(300);
  click('pauseBtn');
  check('time spent paused or in the background adds nothing', Math.abs(T.playedSec - 15) < 0.4, `total=${T.playedSec.toFixed(2)}`);

  freshGame({ difficulty: 'easy', breakMin: 15 });
  let p = bigLand();
  T.playedSec = 899;
  frames(180);
  click('pauseBtn');
  check('crossing the threshold does not interrupt the round', T.playedSec >= 900 && T.mode === 'playing' && hasClass('breakScreen', 'hidden'), `played=${T.playedSec.toFixed(1)}`);
  click('resumeBtn');
  T.hearts = 1;                                    // Easy has spare hearts; use the last one so the round ends
  T.kill(p, null, 'wall');
  const idleStart = T.playedSec;
  fakeNow += 30000;
  check('results time is not counted', T.playedSec === idleStart);
  click('againBtn');
  check('the break waits for the next round request', !hasClass('breakScreen', 'hidden') && T.mode === 'over');
}

// ---- D. keyboard activation of controls ----
{
  freshGame();
  const kd = (k, target, extra) => {
    const ev = Object.assign({ key: k, repeat: false, target, prevented: false, preventDefault() { this.prevented = true; } }, extra);
    fire('window:keydown', ev);
    return ev;
  };
  const button = { tagName: 'BUTTON', closest: () => ({}) };
  const body = { tagName: 'BODY', closest: () => null };
  let ev = kd('Enter', button);
  check('Enter on a focused button does not also start a game', T.mode === 'menu' && !ev.prevented);
  ev = kd(' ', button);
  check('Space on a focused button does not also start a game', T.mode === 'menu' && !ev.prevented);
  ev = kd('Enter', body, { repeat: true });
  check('a held key does not start a game', T.mode === 'menu');
  kd('ArrowLeft', button);
  check('arrow keys still steer from a focused button', T.input.left === true);
  fire('window:keyup', { key: 'ArrowLeft' });

  ev = kd('a', els.nick);
  check('typing in the name field never steers', ev.prevented === false);
  click('howBtn');
  kd('Enter', els.nick);
  check('Enter in the name field is ignored while another screen is open', T.mode === 'menu');
  click('howOkBtn');
  ev = kd('Enter', body);
  check('Enter from a non-interactive target starts one round', T.mode === 'playing' && ev.prevented === true);

  freshGame();
  kd('Enter', els.nick);
  check('Enter in the name field starts on the unobstructed start screen', T.mode === 'playing');

  // results screen: Enter from a non-interactive target plays again; from a button it does not
  freshGame();
  click('playBtn');
  T.kill(T.player, null, 'wall');
  els.overScreen.classList.remove('hidden');
  ev = kd('Enter', button);
  check('results screen: Enter on a focused button does not also start a round', T.mode === 'over' && !ev.prevented);
  ev = kd('Enter', body);
  check('results screen: Enter from a non-interactive target plays again', T.mode === 'playing' && ev.prevented === true);
}

// ---- storage failures are never fatal ----
{
  boot({}, { throwing: true });
  check('page starts even though storage throws', !!T && T.mode === 'menu');
  click('playBtn');
  check('first run still shows the tutorial', !hasClass('howScreen', 'hidden'));
  click('howOkBtn');
  check('a round starts with blocked storage', T.mode === 'playing');
  frames(120);
  T.stampDisc(T.player, T.player.x, T.player.y, 300, false);
  frames(3);
  T.hearts = 1;
  T.kill(T.player, null, 'wall');
  check('results render with blocked storage', T.mode === 'over' && els.ovTitle.textContent === 'Oops!' && /%$/.test(els.ovPct.textContent), els.ovPct.textContent);
  check('the in-memory record still updates', T.progress.best > 3, `best=${T.progress.best}`);
  click('menuBtn');
  openParentViaGate();
  click('resetBtn'); click('resetBtn');
  check('reset works without storage', T.progress.best === 0);
}

// ---- N. gate lockout survives a restart ----
{
  freshGame();
  click('parentBtn');
  for (let i = 0; i < 3; i++) typeAnswer(readQuestion() + 1);
  const saved = JSON.parse(localStorage._d['loopfront.parent']);
  check('lockout is saved', saved.lockUntil > fakeNow && saved.lockUntil <= fakeNow + 60000, `lockUntil-now=${saved.lockUntil - fakeNow}`);
  boot(localStorage._d);
  click('parentBtn');
  check('lockout survives restarting the app', els.gateKey1.disabled === true && els.gateOk.disabled === true);
  typeAnswer(readQuestion());
  check('locked after restart: the right answer is refused', hasClass('parentScreen', 'hidden'));
  fakeNow += 61000;
  boot(localStorage._d);
  click('parentBtn');
  check('lockout ends after a minute', els.gateKey1.disabled === false);

  const far = Object.assign({}, DEFAULT_STORE, { 'loopfront.parent': JSON.stringify({ difficulty: 'hard', breakMin: 0, saver: false, lockUntil: fakeNow + 600000 }) });
  boot(far);
  click('parentBtn');
  check('an absurdly distant lockout value is ignored', els.gateKey1.disabled === false);
}

// ---- M. update notes ----
{
  freshGame();
  globalThis.LoopfrontApp = { getVersion: () => 12, checkUpdate() {}, openDownload() {}, setKeepAwake() {} };
  openParentViaGate();
  click('updateBtn');
  globalThis.onLoopfrontUpdate({ status: 'ok', latest: 14, current: 12, notes: 'Fixes the record bug.' });
  check('what is new is shown with an available update', els.updateNotes.textContent === 'Fixes the record bug.', els.updateNotes.textContent);
  globalThis.onLoopfrontUpdate({ status: 'ok', latest: 14, current: 12, notes: 'x'.repeat(500) });
  check('notes are length-limited', els.updateNotes.textContent.length === 300);
  globalThis.onLoopfrontUpdate({ status: 'ok', latest: 12, current: 12, notes: 'old news' });
  check('no notes when already up to date', els.updateNotes.textContent === '');
  delete globalThis.LoopfrontApp;
}

// =====================================================================
// 15. WP1: hearts, careful pals, joystick
// =====================================================================
// ---- hearts ----
{
  freshGame({ difficulty: 'easy', breakMin: 0 });
  let p = soloStart();
  check('easy: three hearts, heart panel visible', T.hearts === 3 && !hasClass('heartsPanel', 'hidden'), `hearts=${T.hearts}`);
  frames(60 * 6);                                   // protection over, a trail behind the player
  const landBefore = T.counts[p.id];
  const bot = T.entities[5];
  placeOnTrail(bot, p, 'Cutter');
  frames(1);
  check('easy: a trail crossing costs one heart and the round goes on', T.mode === 'playing' && T.hearts === 2, `hearts=${T.hearts} mode=${T.mode}`);
  check('easy: the land is kept after losing a heart', T.counts[p.id] >= landBefore && T.counts[p.id] > 0, `${T.counts[p.id]} vs ${landBefore}`);
  check('easy: the player is back at the start with a clear trail', p.tx.length === 0 && Math.hypot(p.x - p.homeX, p.y - p.homeY) < 20, `dist=${Math.hypot(p.x - p.homeX, p.y - p.homeY).toFixed(1)}`);
  check('easy: a few safe seconds after a lost heart', p.shieldUntil > T.simTime + 2, `shield left=${(p.shieldUntil - T.simTime).toFixed(1)}`);
  check('easy: the other player still earns the tag', bot.kills === 1, `kills=${bot.kills}`);
  invariants('after a lost heart');

  frames(60 * 4);
  placeOnTrail(T.entities[5], p, 'Cutter2');
  frames(1);
  check('easy: the second mistake costs the second heart', T.mode === 'playing' && T.hearts === 1, `hearts=${T.hearts}`);
  frames(60 * 4);
  placeOnTrail(T.entities[5], p, 'Cutter3');
  frames(1);
  check('easy: the third mistake ends the round', T.mode === 'over', `mode=${T.mode} hearts=${T.hearts}`);

  p = soloStart();
  T.kill(p, T.entities[5], 'swallowed');
  check('losing all land always ends the round, hearts or not', T.mode === 'over');

  freshGame({ difficulty: 'normal', breakMin: 0 });
  p = soloStart();
  check('normal: two hearts', T.hearts === 2 && !hasClass('heartsPanel', 'hidden'));

  freshGame({ difficulty: 'hard', breakMin: 0 });
  p = soloStart();
  check('hard: a single life and no heart panel', T.hearts === 1 && hasClass('heartsPanel', 'hidden'));
  frames(60 * 2);
  T.kill(p, null, 'self');
  check('hard: the first mistake still ends the round', T.mode === 'over');
}

// ---- careful pals on easy ----
{
  const realRandom = Math.random;
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let hit = 0;
  const detail = [];
  for (let seed = 1; seed <= 10; seed++) {
    Math.random = mulberry32(seed * 7919);
    freshGame({ difficulty: 'easy', breakMin: 0 });
    click('againBtn');
    const p = T.player;
    // park the child outside own land with a long trail across the middle of the island
    const sx = T.CENTER - 150, sy = T.CENTER + (seed % 3) * 90 - 90;
    p.x = p.px = sx + 600; p.y = p.py = sy; p.speed = 0; p.shieldUntil = 0;
    for (let k = 0; k <= 100; k++) T.addTrailPoint(p, sx + k * 6, sy);
    for (let f = 0; f < 60 * 90 && T.mode === 'playing' && T.hearts === 3; f++) { if (f % 600 === 0) poke(); frames(1); }
    // only trail crossings count here: a pal closing a loop around the whole home patch is a different rule
    const lost = T.hearts < 3 || (T.mode !== 'playing' && !/took all your land/.test(els.ovCause.textContent));
    if (lost) hit++;
    detail.push(lost ? 'x' : '.');
  }
  Math.random = realRandom;
  check('easy: pals steer around the child\'s trail (at least 9 of 10 runs untouched)', hit <= 1, `runs touched: ${hit}/10 ${detail.join('')}`);
}

// ---- joystick ----
{
  freshGame({ difficulty: 'hard', breakMin: 0 });
  click('steerStick');
  check('joystick choice is shown and saved', hasClass('steerStick', 'sel') && !hasClass('steerFinger', 'sel') && JSON.parse(localStorage._d['loopfront.settings']).steer === 'stick');
  check('joystick help text', /joystick/i.test(els.helpText.textContent), els.helpText.textContent);
  const down = (x, y, target) => fire('window:pointerdown', { clientX: x, clientY: y, target: target || null });
  const move = (x, y) => fire('window:pointermove', { clientX: x, clientY: y });
  const up = () => fire('window:pointerup', {});
  let bad = 0;
  for (const [dx, dy, axis, sign, name] of [[90, 0, 'x', 1, 'right'], [-90, 0, 'x', -1, 'left'], [0, -90, 'y', -1, 'up'], [0, 90, 'y', 1, 'down']]) {
    const p = soloStart();
    p.x = p.px = T.CENTER; p.y = p.py = T.CENTER; p.angle = 2.2;
    down(400, 400); move(400 + dx, 400 + dy);
    frames(80);
    const pos0 = p[axis]; frames(10);
    const dragging = T.input.stickDown === true;
    up();
    const stopped = T.input.stickDown === false;
    const pos1 = p[axis]; frames(40);
    if (!(p.alive && Math.sign(pos0 - T.CENTER) === sign && Math.sign(p[axis] - pos1) === sign && dragging && stopped)) { bad++; check('stick drag ' + name, false, `axis=${axis} moved=${(pos0 - T.CENTER).toFixed(0)} keeps=${(p[axis] - pos1).toFixed(0)}`); }
  }
  check('dragging anywhere steers toward that side and the heading is kept after letting go', bad === 0);

  let p = soloStart();
  p.x = p.px = T.CENTER; p.y = p.py = T.CENTER; p.angle = 1;
  down(300, 300); move(305, 303);
  frames(30);
  check('a tiny wobble (under 14 px) does not steer', Math.abs(p.angle - 1) < 0.001, `angle=${p.angle.toFixed(3)}`);
  up();

  p = soloStart();
  p.x = p.px = T.CENTER; p.y = p.py = T.CENTER; p.angle = 1;
  down(300, 300, { closest: () => ({}) }); move(500, 300);
  check('taps on buttons do not start a joystick', T.input.stickDown === false);

  click('steerFinger');
  check('back to finger steering', hasClass('steerFinger', 'sel') && JSON.parse(localStorage._d['loopfront.settings']).steer === 'finger');
  p = soloStart();
  p.x = p.px = T.CENTER; p.y = p.py = T.CENTER; p.angle = 1; T.cam.x = p.x; T.cam.y = p.y;
  fire('window:pointermove', { clientX: 100, clientY: 400 });
  frames(80); const x0 = p.x; frames(10);
  check('finger mode still follows the pointer', p.alive && p.x < x0);

  boot(localStorage._d);
  check('joystick choice survives a restart', true && JSON.parse(localStorage._d['loopfront.settings']).steer === 'finger');
  boot(Object.assign({}, DEFAULT_STORE, { 'loopfront.settings': JSON.stringify({ name: '', color: '#ef476f', character: 'cat', sound: true, seenHowTo: true, steer: 'stick' }) }));
  check('a saved joystick choice is restored', T.settings.steer === 'stick' && hasClass('steerStick', 'sel'));
  boot(Object.assign({}, DEFAULT_STORE, { 'loopfront.settings': JSON.stringify({ steer: 'banana', seenHowTo: true }) }));
  check('an invalid saved steering value falls back to finger', T.settings.steer === 'finger');
}


// =====================================================================
// 16. WP2: power-ups
// =====================================================================
{
  const travel = (ent, n) => { const x0 = ent.x, y0 = ent.y; frames(n); return Math.hypot(ent.x - x0, ent.y - y0); };
  const giveTo = (p, type) => { T.pickups.length = 0; T.pickups.push({ x: p.x, y: p.y, type, born: T.simTime }); T.step(1 / 60); };

  // spawning: timing, cap, placement, lifetime (the player is parked so it cannot collect anything)
  freshGame({ difficulty: 'easy', breakMin: 0 });
  let p = bigLand();
  p.speed = 0;
  check('no power-ups at the start of a round', T.pickups.length === 0);
  let maxSeen = 0, firstAt = -1, outside = 0, tooOld = 0;
  const types = new Set();
  for (let f = 0; f < 60 * 200 && T.mode === 'playing'; f++) {
    if (f % 300 === 0) poke();
    frames(1);
    maxSeen = Math.max(maxSeen, T.pickups.length);
    if (firstAt < 0 && T.pickups.length > 0) firstAt = T.simTime;
    for (const pu of T.pickups) {
      types.add(pu.type);
      if (Math.hypot(pu.x - T.CENTER, pu.y - T.CENTER) > T.ARENA_R - 160 + 1) outside++;
      if (T.simTime - pu.born > 25.1) tooOld++;
    }
  }
  check('easy: the first power-up appears after 8 to 16 seconds', firstAt >= 8 && firstAt <= 16, `first at ${firstAt.toFixed(1)} s`);
  check('never more than three on the island, and several do appear', maxSeen <= 3 && maxSeen >= 2, `max=${maxSeen}`);
  check('power-ups always stay inside the island', outside === 0, `${outside} outside`);
  check('power-ups fade away after 25 seconds', tooOld === 0, `${tooOld} too old`);
  check('more than one kind of power-up appears', types.size >= 2, [...types].join(','));

  // effects
  freshGame({ difficulty: 'easy', breakMin: 0 });
  p = bigLand();
  p.angle = 0;
  p.x = p.px = T.CENTER - 300; p.y = p.py = T.CENTER;
  const base = travel(p, 60);
  p.x = p.px = T.CENTER - 300; p.y = p.py = T.CENTER; p.angle = 0;
  giveTo(p, 'zoom');
  check('collecting Zoom sets its timer, counts it and removes the pick-up', T.zoomUntil > T.simTime + 4.8 && T.zoomUntil <= T.simTime + 5.01 && T.roundPower === 1 && T.pickups.length === 0, `left=${(T.zoomUntil - T.simTime).toFixed(2)}`);
  p.x = p.px = T.CENTER - 300; p.y = p.py = T.CENTER; p.angle = 0;
  const fast = travel(p, 60);
  check('Zoom makes the player about 35% faster', fast / base > 1.3 && fast / base < 1.4, `ratio=${(fast / base).toFixed(2)}`);
  frames(60);
  check('the power-up pill shows Zoom', !hasClass('powerPill', 'hidden') && els.powerName.textContent === 'Zoom', els.powerName.textContent);
  frames(60 * 5);
  p.x = p.px = T.CENTER - 300; p.y = p.py = T.CENTER; p.angle = 0;
  const after = travel(p, 60);
  check('Zoom wears off', Math.abs(after / base - 1) < 0.05 && T.simTime > T.zoomUntil, `ratio=${(after / base).toFixed(2)}`);
  frames(30);
  check('the pill disappears when nothing is active', hasClass('powerPill', 'hidden'));

  giveTo(p, 'bubble');
  check('Bubble gives the start-of-round shield for 6 seconds', p.shieldUntil >= T.simTime + 5.9 && T.bubbleUntil >= T.simTime + 5.9, `shield left=${(p.shieldUntil - T.simTime).toFixed(2)}`);

  const s = { x: T.CENTER + 500, y: T.CENTER + 100 };   // inside the player's big patch of land; the pal just walks
  const pal = T.entities[5];
  placeBot(pal, 'Chilly', s.x, s.y, Math.atan2(T.CENTER - s.y, T.CENTER - s.x));
  const palBase = travel(pal, 60);
  placeBot(pal, 'Chilly', s.x, s.y, Math.atan2(T.CENTER - s.y, T.CENTER - s.x));
  giveTo(p, 'freeze');
  check('collecting Freeze sets its timer', T.freezeUntil > T.simTime + 4.8, `left=${(T.freezeUntil - T.simTime).toFixed(2)}`);
  const palSlow = travel(pal, 60);
  check('Freeze slows pals to under half speed', palSlow / palBase > 0.4 && palSlow / palBase < 0.5, `ratio=${(palSlow / palBase).toFixed(2)}`);
  frames(60 * 5);
  placeBot(pal, 'Chilly', s.x, s.y, Math.atan2(T.CENTER - s.y, T.CENTER - s.x));
  const palAfter = travel(pal, 60);
  check('Freeze wears off', Math.abs(palAfter / palBase - 1) < 0.05, `ratio=${(palAfter / palBase).toFixed(2)}`);

  // pals never collect
  placeBot(pal, 'Greedy', s.x, s.y, 0);
  T.pickups.length = 0;
  T.pickups.push({ x: pal.x, y: pal.y, type: 'zoom', born: T.simTime });
  frames(3);
  check('pals never collect power-ups', T.pickups.length === 1);
  T.pickups.length = 0;

  // star
  freshGame({ difficulty: 'easy', breakMin: 0 });
  p = bigLand();
  for (let i = 0; i < 5; i++) giveTo(p, 'zoom');
  frames(5);
  check('five power-ups in a round earn the star once', T.progress.stars.power5 === true && T.newStars.filter(g => g.id === 'power5').length === 1 && JSON.parse(localStorage._d['loopfront.progress']).stars.power5 === true);
  click('starsBtn');
  check('stars screen lists every goal including power-ups', els.starsGrid.children.length === T.GOALS.length && T.GOALS.some(g => g.id === 'power5'), `${els.starsGrid.children.length}/${T.GOALS.length}`);
  click('starsCloseBtn');

  // a new round starts clean; the menu never spawns any
  click('againBtn');
  check('a new round starts with no power-ups and no effects', T.pickups.length === 0 && T.zoomUntil === 0 && T.freezeUntil === 0 && T.roundPower === 0);
  fire('menuBtn:click');
  for (let f = 0; f < 60 * 40; f++) { if (f % 300 === 0) poke(); frames(1); }
  check('no power-ups appear behind the menu', T.pickups.length === 0 && T.mode === 'menu');
}


// =====================================================================
// 17. WP3: coins and the dress-up shop
// =====================================================================
{
  const tiles = () => els.shopGrid.children;
  const tapTile = (i) => fire(tiles()[i].id + ':click');
  const stateOf = (i) => tiles()[i].children[2].textContent;
  const storedProgress = () => JSON.parse(localStorage._d['loopfront.progress']);
  const storedSettings = () => JSON.parse(localStorage._d['loopfront.settings']);

  // ---- earning ----
  freshGame({ difficulty: 'hard', breakMin: 0 });
  let p = soloStart();
  T.kill(p, null, 'wall');
  check('a round with nothing done earns no coins and shows none', T.progress.coins === 0 && hasClass('ovCoins', 'hidden'));

  p = soloStart();
  T.stampDisc(p, p.x, p.y, 380, false);                         // about 6.5% of the island
  frames(3);
  T.roundLoops = 4; T.roundPower = 2; p.kills = 2;
  let before = T.progress.coins;
  T.kill(p, null, 'wall');
  const roundStars = T.newStars.filter(g => !g.life).length;
  const expected = Math.floor(T.bestPct * 4) + 2 * 5 + 4 + roundStars * 10 + 2;
  check('coins = land x4 + tags x5 + loops + stars x10 + power-ups', T.progress.coins - before === expected && expected > 30, `earned ${T.progress.coins - before}, formula ${expected}`);
  check('the result screen shows the coins earned', els.ovCoinsText.textContent === '+' + expected + ' coins' && !hasClass('ovCoins', 'hidden'), els.ovCoinsText.textContent);
  check('coins are saved', storedProgress().coins === T.progress.coins && storedProgress().coinsEarned === T.progress.coinsEarned);
  fire('menuBtn:click');
  check('the start screen shows the coin total', els.coinLabel.textContent === 'Coins: ' + T.progress.coins, els.coinLabel.textContent);

  // ---- shopping ----
  T.progress.coins = 0; T.progress.owned = {}; T.progress.bought = 0; T.progress.stars = {};
  click('shopBtn');
  check('the shop opens with seven hats', !hasClass('shopScreen', 'hidden') && tiles().length === 7 && els.shopCoins.textContent === '0', `${tiles().length} tiles`);
  check('free items are marked, others show a price', stateOf(0) === 'On' && stateOf(1) === '30' && stateOf(6) === '200', [stateOf(0), stateOf(1), stateOf(6)].join(','));
  tapTile(6);
  check('cannot buy without enough coins, and it says how many more', T.progress.coins === 0 && !T.progress.owned['hats:crown'] && T.settings.hat === 'none' && els.shopMsg.textContent === 'Need 200 more', els.shopMsg.textContent);

  T.progress.coins = 100;
  tapTile(1);
  check('buying deducts once, owns and wears the hat', T.progress.coins === 70 && T.progress.owned['hats:cap'] === true && T.settings.hat === 'cap' && T.progress.bought === 1, `coins=${T.progress.coins}`);
  check('buying is saved', storedProgress().coins === 70 && storedProgress().owned['hats:cap'] === true && storedSettings().hat === 'cap');
  check('the tile now says it is on', stateOf(1) === 'On' && stateOf(0) === 'Wear');
  check('buying a first item earns the "new look" star', T.progress.stars.dress1 === true && /Yours now! New star!/.test(els.shopMsg.textContent), els.shopMsg.textContent);
  tapTile(1);
  check('tapping the worn item again does nothing', T.progress.coins === 70);
  tapTile(2);
  check('a second hat costs its own price', T.progress.coins === 30 && T.settings.hat === 'bow', `coins=${T.progress.coins}`);
  tapTile(3);
  check('not enough for the party hat', T.progress.coins === 30 && els.shopMsg.textContent === 'Need 30 more' && T.settings.hat === 'bow', els.shopMsg.textContent);
  tapTile(0);
  check('the free "no hat" tile can always be worn', T.settings.hat === 'none' && T.progress.coins === 30);
  tapTile(1);
  check('owned items are worn again for free', T.settings.hat === 'cap' && T.progress.coins === 30);

  click('shopTabTrails');
  check('the trails tab lists four styles', tiles().length === 4);
  tapTile(2);
  check('rainbow needs 100 coins', T.settings.trail === 'plain' && els.shopMsg.textContent === 'Need 70 more', els.shopMsg.textContent);
  click('shopTabIslands');
  check('the islands tab lists four looks', tiles().length === 4);
  check('Back closes the shop', globalThis.onLoopfrontBack() === true && hasClass('shopScreen', 'hidden'));

  // ---- every item can be bought and drawn ----
  T.progress.coins = 5000;
  click('shopBtn');
  let drawn = 0;
  for (const tab of ['shopTabHats', 'shopTabTrails', 'shopTabIslands']) {
    click(tab);
    for (let i = 0; i < tiles().length; i++) { tapTile(i); frames(3); drawn++; }
  }
  check('all items can be bought and each look renders without errors', T.progress.owned['hats:crown'] && T.progress.owned['trails:sparkle'] && T.progress.owned['themes:space'] && T.settings.theme === 'space' && drawn === 15, `bought=${T.progress.bought} theme=${T.settings.theme}`);
  click('shopCloseBtn');
  // trail styles really change what is drawn (easy rules keep the round alive; the player starts outside its land)
  T.parentCfg.difficulty = 'easy';
  const palette = ['#ef476f', '#f77f00', '#06d6a0', '#118ab2', '#8338ec', '#ff70a6'];
  const trailRun = (style) => {
    T.settings.trail = style;
    const pl = soloStart();
    let spot;
    do { spot = openSpot(); } while (Math.hypot(spot.x - pl.homeX, spot.y - pl.homeY) < 300);
    pl.x = pl.px = spot.x; pl.y = pl.py = spot.y;
    pl.angle = Math.atan2(spot.y - pl.homeY, spot.x - pl.homeX);          // straight away from home: the trail only grows
    frames(120);                                                // a few hundred pixels of trail behind the player
    ctxLog.dash = []; ctxLog.fills.clear(); ctxLog.strokes.clear(); ctxLog.recording = true;
    frames(20);
    ctxLog.recording = false;
    return { trail: pl.tx.length, dash: ctxLog.dash.slice(), strokes: new Set(ctxLog.strokes), alive: T.mode === 'playing' };
  };
  let r = trailRun('dotted');
  check('the dotted trail is drawn with a dash pattern', r.trail > 20 && r.dash.includes('[2,16]'), `trail=${r.trail} dash=${r.dash.slice(0, 2)}`);
  r = trailRun('rainbow');
  check('the rainbow trail cycles through several colours', r.trail > 25 && palette.filter(c => r.strokes.has(c)).length >= 3, [...r.strokes].slice(0, 8).join(' '));
  r = trailRun('sparkle');
  check('the sparkle trail keeps the normal line and adds white sparkles', r.trail > 20 && r.dash.length === 0 && r.alive);
  r = trailRun('plain');
  check('the plain trail has no dashes or rainbow runs', r.dash.length === 0 && palette.filter(c => r.strokes.has(c)).length < 3);
  T.parentCfg.difficulty = 'hard';
  const floors = { snow: '#f4faff', candy: '#ffe3f1', space: '#2b2d5c', sand: '#ffefc2' };
  const seas = { snow: '#7fb7d9', candy: '#b388eb', space: '#14153a', sand: '#39b6e8' };
  for (const th of Object.keys(floors)) {
    T.settings.theme = th;
    ctxLog.fills.clear(); ctxLog.recording = true; frames(3); ctxLog.recording = false;
    check('the ' + th + ' island look is drawn with its own sea and floor colours', ctxLog.fills.has(floors[th]) && ctxLog.fills.has(seas[th]), [...ctxLog.fills].slice(0, 5).join(' '));
  }

  // ---- pals and hats ----
  freshGame({ difficulty: 'normal', breakMin: 0 });
  const seen = new Set();
  for (let i = 0; i < 12; i++) { click('againBtn'); for (const e of T.entities) if (e.alive && !e.isPlayer) seen.add(e.hat); }
  const valid = new Set(['none', 'cap', 'bow', 'party', 'flower', 'pirate', 'crown']);
  check('pals sometimes wear valid hats, the player wears their own', [...seen].every(h => valid.has(h)) && seen.size > 1 && T.player.hat === T.settings.hat, [...seen].join(','));

  // ---- tampered or stale saved data ----
  const withData = (settings, progress) => Object.assign({}, DEFAULT_STORE, {
    'loopfront.settings': JSON.stringify(Object.assign({ name: '', color: '#ef476f', character: 'cat', sound: true, seenHowTo: true }, settings)),
    'loopfront.progress': JSON.stringify(progress)
  });
  boot(withData({ hat: 'crown', trail: 'rainbow', theme: 'space' }, { coins: 5, owned: { 'hats:cap': true, 'hats:ghost': true, 'trails:nope': true, 'nonsense': true } }));
  check('worn items that are not owned fall back to the free ones', T.settings.hat === 'none' && T.settings.trail === 'plain' && T.settings.theme === 'sand', `${T.settings.hat}/${T.settings.trail}/${T.settings.theme}`);
  check('unknown owned items are dropped, valid ones kept', Object.keys(T.progress.owned).join() === 'hats:cap', Object.keys(T.progress.owned).join());
  boot(withData({ hat: 'cap', theme: 'banana' }, { coins: 0, owned: { 'hats:cap': true } }));
  check('an owned item stays worn after a restart; an invalid one is ignored', T.settings.hat === 'cap' && T.settings.theme === 'sand');
  boot(withData({}, { coins: -50, coinsEarned: 'lots', bought: NaN, best: 3 }));
  check('invalid coin numbers fall back to zero', T.progress.coins === 0 && T.progress.coinsEarned === 0 && T.progress.bought === 0 && T.progress.best === 3);
  boot(withData({}, { coins: 12.9 }));
  check('coins are whole numbers', T.progress.coins === 12);

  // ---- lifetime star and reset ----
  freshGame({ difficulty: 'hard', breakMin: 0 });
  T.progress.coinsEarned = 190;
  p = soloStart();
  T.stampDisc(p, p.x, p.y, 380, false);
  frames(3);
  T.kill(p, null, 'wall');
  check('earning 200 coins in total awards its star', T.progress.stars.coins200 === true && /Earn 200 coins/.test(els.ovStars.textContent), els.ovStars.textContent);
  T.progress.coins = 500; T.progress.owned['hats:crown'] = true; T.settings.hat = 'crown'; T.settings.theme = 'sand';
  fire('menuBtn:click');
  openParentViaGate();
  check('the reset button is labelled for all progress', els.resetBtn.textContent === 'Reset all progress', els.resetBtn.textContent);
  click('resetBtn'); click('resetBtn');
  check('reset clears coins, items, equips, stars and best', T.progress.coins === 0 && Object.keys(T.progress.owned).length === 0 && T.settings.hat === 'none' && T.settings.trail === 'plain' && T.progress.best === 0 && Object.keys(T.progress.stars).length === 0 && T.progress.coinsEarned === 0 && T.progress.bought === 0);
  check('reset is saved', storedProgress().coins === 0 && storedSettings().hat === 'none');
  click('parentCloseBtn');

  // ---- wording: never anything that sounds like real money ----
  const lits2 = [...src.matchAll(/'([^'\\\n]*)'/g)].map(m => m[1]);
  const body2 = html.replace(/<script>[\s\S]*?<\/script>/, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
  const money = /\$|\bpay\b|\bpaid\b|purchas|real money|credit card|subscri/i;
  check('no wording that suggests real money', !lits2.some(l => money.test(l)) && !money.test(body2), lits2.filter(l => money.test(l)).join(' | '));
  check('the shop screen exists and starts hidden', /<div id="shopScreen" class="overlay hidden">/.test(html));
}


// ---- J and E: static structure ----
check('page-level network block is present', /http-equiv="Content-Security-Policy"[^>]*connect-src 'none'/.test(html));
check('HUD bar wraps the counters and the leaderboard', /<div id="hudBar">[\s\S]*<div id="hudTop">[\s\S]*<div id="board"/.test(html));


// =====================================================================
// 13. offline and safety scan of the shipped page
// =====================================================================
{
  check('no web addresses anywhere', !/https?:\/\//i.test(html));
  const banned = ['fetch(', 'XMLHttpRequest', 'WebSocket', '<link ', '<script src', '@import', '<a href', 'sendBeacon', 'EventSource', 'importScripts', 'eval('];
  const hits = banned.filter(b => html.includes(b));
  check('no network, external-file or navigation features', hits.length === 0, hits.join(', '));
  check('no TODO / placeholder text', !/TODO|FIXME|XXX/.test(html));
  const tmp = path.join(os.tmpdir(), 'loopfront-extract-' + process.pid + '.js');
  fs.writeFileSync(tmp, html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  let syntax = true, msg = '';
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); } catch (err) { syntax = false; msg = String(err.stderr); }
  fs.unlinkSync(tmp);
  check('script passes node --check', syntax, msg);
  check('page size is small', html.length < 260000, `${html.length} bytes`);
}

console.log(failed ? `\n${failed} of ${total} CHECK(S) FAILED` : `\nALL ${total} CHECKS PASSED`);
process.exit(failed ? 1 : 0);

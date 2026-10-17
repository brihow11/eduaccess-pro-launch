// Photosensitivity check for Rampart: Space Edition. Samples the game canvas every frame on a 4x4 grid plus the whole
// frame, converts to relative luminance (sRGB -> linear, WCAG weights) and counts flash pairs: opposing changes of
// >= 0.10 where the darker side is below 0.80. FAILS if any cell or the full frame has more than 3 flashes in any
// 1-second window. Also runs a negative control (a forced full-screen strobe) that MUST be caught.
// Usage: node flash-check.js [baseUrl]    Written by: Howie
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const base = process.argv[2] || 'http://127.0.0.1:3601';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAMPLER = () => {
  window.__fl = { t: [], cells: [] };
  const c = document.getElementById('game'), o = document.createElement('canvas'); o.width = 64; o.height = 36; const x = o.getContext('2d', { willReadFrequently: true });
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = lin(i);
  function tick() { setTimeout(sample, 0); }
  function sample() {
    const now = performance.now();
    x.drawImage(c, 0, 0, 64, 36); const d = x.getImageData(0, 0, 64, 36).data, cells = new Float32Array(17);
    for (let py = 0; py < 36; py++) for (let px = 0; px < 64; px++) { const k = (py * 64 + px) * 4, L = 0.2126 * LUT[d[k]] + 0.7152 * LUT[d[k + 1]] + 0.0722 * LUT[d[k + 2]]; cells[((py / 9) | 0) * 4 + ((px / 16) | 0)] += L / 144; cells[16] += L / 2304; }
    window.__fl.t.push(now); window.__fl.cells.push(Array.from(cells)); if (window.__fl.t.length < 20000) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};
function analyze(fl) {
  let worst = 0, where = -1, at = 0;
  for (let ci = 0; ci < 17; ci++) {
    const tr = []; let lo = fl.cells[0][ci], hi = lo, dir = 0;
    for (let i = 1; i < fl.t.length; i++) {
      const L = fl.cells[i][ci];
      if (dir >= 0) { if (L > hi) hi = L; if (hi - L >= 0.1 && L < 0.8) { tr.push(fl.t[i]); dir = -1; lo = L; } }
      if (dir <= 0) { if (L < lo) lo = L; if (L - lo >= 0.1 && lo < 0.8) { tr.push(fl.t[i]); dir = 1; hi = L; } }
    }
    for (let a = 0, b = 0; b < tr.length; b++) { while (tr[b] - tr[a] > 1000) a++; const flashes = (b - a + 1) / 2; if (flashes > worst) { worst = flashes; where = ci; at = tr[b]; } }
  }
  return { frames: fl.t.length, fps: Math.round(fl.t.length / ((fl.t[fl.t.length - 1] - fl.t[0]) / 1000)), worstFlashesPerSecond: worst, cell: where, pass: worst <= 3 };
}
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = {};
  for (const vp of [[1280, 720], [844, 390]]) {
    const p = await (await b.newContext({ viewport: { width: vp[0], height: vp[1] } })).newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e));
    await p.goto(base + '/games/rampart-space/'); await sleep(1500);
    await p.evaluate(SAMPLER); await sleep(5000); // title screen
    // busy late-game battle at 2x: lots of turrets, explosions, strikes, dilation, leaks, boss and boss death
    await p.evaluate(() => { const T = RSTD, G = T.G; T.tips(false); T.start(12); G.banner = null; G.credits = 1e5; G.slots.forEach((s, i) => { T.build(i, T.ORDER[i % 6]); }); G.turrets.forEach((t, i) => { T.upgrade(i); T.upgrade(i); T.upgrade(i, i % 2); }); G.speed = 2; G.integ = 20; T.launch(); });
    for (let i = 0; i < 12; i++) { await sleep(2500); await p.evaluate(i => { const T = RSTD, G = T.G; G.integ = 20; G.ab.strike = 0; G.ab.dilate = 0; const f = G.foes[0]; if (f) T.strike(f.x, f.y); if (i % 4 === 1) T.dilate(); for (let k = 0; k < 10; k++) T.spawn(['swarmer', 'scout', 'frigate', 'cruiser', 'phantom', 'carrier', 'mender', 'gunship'][k % 8], k % 3); if (G.phase === 'build') T.launch(); if (i === 5) { const B = T.spawn('eclipse', 0); B.d = 600; } if (i === 7) { G.foes.filter(f => f.boss).forEach(f => { f.hp = 1; f.shield = 0; }); } }, i); }
    await sleep(3000);
    // level end + summary
    await p.evaluate(() => { const G = RSTD.G; G.foes = []; G.spawnQ = []; G.wave = G.nW; G.phase = 'wave'; });
    await sleep(2500);
    const fl = await p.evaluate(() => window.__fl);
    results[vp.join('x')] = Object.assign(analyze(fl), { errs });
  }
  // negative control: a forced full-screen strobe must be detected
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  await p.goto(base + '/games/rampart-space/'); await sleep(1200); await p.evaluate(SAMPLER);
  await p.evaluate(() => { const c = document.getElementById('game'), x = c.getContext('2d'); let n = 0; (function s() { if (++n % 10 < 5) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } if (n < 200) requestAnimationFrame(s); })(); });
  await sleep(3500); const ctl = analyze(await p.evaluate(() => window.__fl));
  results.negativeControl = { worstFlashesPerSecond: ctl.worstFlashesPerSecond, caught: !ctl.pass };
  console.log(JSON.stringify(results, null, 1));
  const ok = Object.keys(results).every(k => k === 'negativeControl' ? results[k].caught : results[k].pass && !results[k].errs.length);
  console.log(ok ? 'FLASH CHECK PASS' : 'FLASH CHECK FAIL'); await b.close(); process.exit(ok ? 0 : 1);
})();

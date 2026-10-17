// Phone landscape touch-target audit: every in-game hit region and toolbar button should be at least ~44 CSS px.
// Usage: node touch-targets.js [baseUrl]   Env VP=844x390   Written by: Howie
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const base = process.argv[2] || 'http://127.0.0.1:3601', [vw, vh] = (process.env.VP || '844x390').split('x').map(Number), MIN = 44;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/games/rampart-space/'); await p.waitForTimeout(1200);
  const dom = await p.evaluate(() => [...document.querySelectorAll('header.toolbar button, header.toolbar a, .scr button')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { id: (e.id || e.textContent.trim()).slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; }));
  const ui = await p.evaluate(async () => { const T = RSTD, G = T.G, out = {}; T.tips(false); T.start(6); G.banner = null; G.credits = 5000;
    const wait = () => new Promise(r => setTimeout(r, 120));
    await wait(); out.hud = G.ui.map(u => ({ id: u.id, w: Math.round(u.w), h: Math.round(u.h) }));
    G.sel = G.slots[3]; await wait(); out.ring = G.ui.filter(u => u.id.startsWith('b_')).map(u => ({ id: u.id, w: Math.round(u.w), h: Math.round(u.h) }));
    T.build(3, 'laser'); G.sel = G.slots[3]; await wait(); out.card = G.ui.filter(u => !['speed', 'strike', 'dilate', 'launch'].includes(u.id)).map(u => ({ id: u.id, w: Math.round(u.w), h: Math.round(u.h) }));
    const V = T.V; out.slotTap = Math.round(2 * Math.max(50, 26 / (V.s * V.q)) * V.s * V.q); out.cam = { s: +V.s.toFixed(3), q: V.q };
    return out; });
  const all = [...dom.map(d => ({ ...d, where: 'dom' })), ...ui.hud.map(d => ({ ...d, where: 'hud' })), ...ui.ring.map(d => ({ ...d, where: 'ring' })), ...ui.card.filter(d => d.id !== 'card').map(d => ({ ...d, where: 'card' })), { id: 'slot', w: ui.slotTap, h: ui.slotTap, where: 'world' }];
  const small = all.filter(d => Math.min(d.w, d.h) < MIN);
  console.log(JSON.stringify({ vp: vw + 'x' + vh, cam: ui.cam, targets: all.length, small, errs }, null, 1));
  console.log(small.length || errs.length ? 'TOUCH TARGETS FAIL' : 'TOUCH TARGETS PASS');
  await b.close(); process.exit(small.length || errs.length ? 1 : 0);
})();

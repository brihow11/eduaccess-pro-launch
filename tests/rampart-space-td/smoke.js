// Quick visual smoke test. Usage: node smoke.js [baseUrl]   Written by: Howie
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const base = process.argv[2] || 'http://127.0.0.1:3601';
const out = process.env.SHOTS || '/workspace/shots/space-td/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const vp = process.env.VP ? process.env.VP.split('x').map(Number) : [1600, 900];
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH, deviceScaleFactor: +(process.env.DPR || 1) });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const tag = process.env.TAG || 'smoke';
  await p.goto(base + '/games/rampart-space/'); await sleep(1500);
  await p.screenshot({ path: out + tag + '-title.png' });
  await p.evaluate(() => RSTD.start(+(new URLSearchParams(location.search).get('l') || 1)));
  const L = +(process.env.LVL || 1); await p.evaluate(l => RSTD.start(l), L); await sleep(500);
  await p.screenshot({ path: out + tag + '-tip.png' });
  await p.evaluate(() => { RSTD.tips(false); RSTD.closeTips(); });
  await p.evaluate(() => { const G = RSTD.G; G.credits = 5000; const ks = RSTD.ORDER; for (let i = 0; i < Math.min(G.slots.length, 10); i++) { RSTD.LEVELS; G.slots[i] && RSTD.build(i, ks[i % ks.length]); } G.turrets.forEach((t, i) => { if (i % 3 === 0) { RSTD.upgrade(i); RSTD.upgrade(i); RSTD.upgrade(i, i % 2); } }); RSTD.launch(); });
  await sleep(9000);
  await p.screenshot({ path: out + tag + '-play.png' });
  await p.evaluate(() => { const G = RSTD.G; G.sel = G.slots.find(s => !s.t) || null; });
  await sleep(300); await p.screenshot({ path: out + tag + '-buildring.png' });
  await p.evaluate(() => { const G = RSTD.G; G.sel = G.slots.find(s => s.t) || null; });
  await sleep(300); await p.screenshot({ path: out + tag + '-card.png' });
  console.log(JSON.stringify({ errs, slots: await p.evaluate(() => RSTD.G.slots.length), foes: await p.evaluate(() => RSTD.G.foes.length), lanes: await p.evaluate(() => RSTD.G.lanes.map(l => Math.round(l.len))) }));
  await b.close();
})();

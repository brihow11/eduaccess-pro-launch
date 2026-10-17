// Screenshot every sector layout (debug aid). Written by: Howie
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const base = process.argv[2] || 'http://127.0.0.1:3601', out = process.env.SHOTS || '/workspace/shots/space-td/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.stack));
  await p.goto(base + '/games/rampart-space/'); await sleep(800);
  const info = [];
  for (let l = 1; l <= 12; l++) {
    const t0 = Date.now(); await p.evaluate(l => { RSTD.tips(false); RSTD.start(l); RSTD.G.banner = null; }, l); const gen = Date.now() - t0; await sleep(250);
    await p.screenshot({ path: out + 'lanes-' + l + '.png' });
    info.push(await p.evaluate(g => ({ l: RSTD.G.lvl, slots: RSTD.G.slots.length, lanes: RSTD.G.lanes.map(x => Math.round(x.len)), gen: g }), gen));
  }
  console.log(JSON.stringify({ errs, info }));
  await b.close();
})();

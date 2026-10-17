// Big-monitor layout shots (2560x1440 and 3840x2160). Written by: Howie
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:3601', out = process.env.SHOTS || '/workspace/shots/space-td/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const errs = [];
  for (const [w, h] of [[2560, 1440], [3840, 2160]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p.on('pageerror', e => errs.push('' + e));
    await p.goto(base + '/games/rampart-space/'); await sleep(1500);
    await p.evaluate(() => { const T = RSTD, G = T.G; T.tips(false); T.start(8); G.banner = null; G.credits = 9000; G.slots.forEach((s, i) => { if (i < 12) T.build(i, T.ORDER[i % 6]); }); G.turrets.forEach((t, i) => { T.upgrade(i); T.upgrade(i); if (i % 2) T.upgrade(i, 0); }); G.wave = 4; T.launch(); });
    await sleep(9000); await p.evaluate(() => { const G = RSTD.G; G.sel = G.slots.find(s => s.t && s.t.tier === 4); });
    await sleep(400); await p.screenshot({ path: out + 'big-' + w + '.png' });
  }
  console.log(JSON.stringify({ errs })); await b.close();
})();

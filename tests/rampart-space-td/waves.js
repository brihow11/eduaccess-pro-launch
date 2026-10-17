const PW = '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await b.newPage();
  await p.goto('http://127.0.0.1:3601/games/rampart-space/'); await new Promise(r => setTimeout(r, 500));
  for (const l of (process.argv[2] || '4,6').split(',').map(Number)) console.log(l, await p.evaluate(l => RSTD.waves(l, RSTD.LEVELS[l - 1].lanes.length).map((w, i) => (i + 1) + ':' + w.map(g => g.n + g.k[0] + g.k[1] + '@' + g.lane).join(',')).join('  '), l));
  await b.close(); })();

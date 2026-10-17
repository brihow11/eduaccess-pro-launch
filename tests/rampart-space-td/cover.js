// Renders the menu poster cover from a staged in-game battle plus the logo. Written by: Howie
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:3601', out = process.argv[3] || '/workspace/shots/space-td/cover-raw.png';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await p.goto(base + '/games/rampart-space/'); await sleep(1200);
  await p.addStyleTag({ content: '[data-jsp-banner],.jsp-banner,header.toolbar,footer.bar{display:none!important}' });
  await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(300);
  await p.evaluate((SEC) => { const T = RSTD, G = T.G; T.tips(false); T.start(SEC); G.banner = null; G.noHud = true; G.credits = 1e5;
    G.slots.forEach((s, i) => { T.build(i, ['laser', 'rail', 'missile', 'pylon', 'laser', 'stasis', 'drone'][i % 7]); });
    G.turrets.forEach((t, i) => { T.upgrade(i); T.upgrade(i); T.upgrade(i, i % 2); }); G.wave = 6; T.launch(); }, +(process.env.SEC || 7));
  await sleep(1500);
  await p.evaluate(() => { const T = RSTD, G = T.G; for (let k = 0; k < 16; k++) { const ln = k % G.lanes.length; const f = T.spawn(['cruiser', 'frigate', 'scout', 'fighter', 'swarmer', 'carrier'][k % 6], ln); f.d = G.lanes[ln].len * (0.12 + 0.05 * k); } const d = T.spawn('dread', 0); d.d = G.lanes[0].len * 0.35; });
  await sleep(2500);
  await p.evaluate(() => { const G = RSTD.G; G.integ = 20; const f = G.foes.find(f => f.k === 'cruiser'); if (f) RSTD.strike(f.x, f.y); });
  await sleep(700);
  await p.evaluate(() => { // logo overlay (same type treatment as the title screen)
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 99, pointerEvents: 'none' }); document.body.appendChild(c);
    const x = c.getContext('2d'); const g0 = x.createLinearGradient(0, 0, 0, 1080); g0.addColorStop(0, 'rgba(2,4,12,0.72)'); g0.addColorStop(0.32, 'rgba(2,4,12,0)'); g0.addColorStop(0.78, 'rgba(2,4,12,0)'); g0.addColorStop(1, 'rgba(2,4,12,0.6)'); x.fillStyle = g0; x.fillRect(0, 0, 1920, 1080);
    const F = s => '900 ' + s + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.font = F(210);
    const g = x.createLinearGradient(0, 40, 0, 230); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#bcd2ee'); g.addColorStop(0.55, '#6c84a8'); g.addColorStop(1, '#dce8ff');
    x.shadowColor = 'rgba(90,170,255,0.55)'; x.shadowBlur = 40; x.fillStyle = g; x.fillText('RAMPART', 960, 225); x.shadowBlur = 0; x.strokeStyle = 'rgba(20,30,60,0.6)'; x.lineWidth = 2; x.strokeText('RAMPART', 960, 225);
    x.font = F(78); x.fillStyle = '#ffd36a'; x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 12; x.fillText('SPACE EDITION', 960, 310);
    x.font = '700 40px system-ui, sans-serif'; x.fillStyle = '#9fe6ff'; x.fillText('ORBITAL TOWER DEFENSE', 960, 1030);
  });
  await sleep(200); await p.screenshot({ path: out }); await b.close();
})();

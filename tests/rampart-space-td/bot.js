// Balance bot: plays sectors headless with a simple human-like strategy and reports results.
// Usage: node bot.js [baseUrl] [fromLevel] [toLevel]   Env SKILL=0..1 (lower = sloppier).  Written by: Howie
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const base = process.argv[2] || 'http://127.0.0.1:3601', from = +(process.argv[3] || 1), to = +(process.argv[4] || 12);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const [vw, vh] = (process.env.VP || '960x540').split('x').map(Number);
  const p = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.stack));
  await p.goto(base + '/games/rampart-space/'); await new Promise(r => setTimeout(r, 800));
  const res = [];
  for (let l = from; l <= to; l++) {
    const r = await p.evaluate(([l, skill]) => {
      const T = RSTD, G = T.G; T.tips(false); T.start(l); G.banner = null;
      const avail = T.ORDER.filter(k => T.TURRETS[k].unlock <= l);
      const plan = []; // build order mix
      const mix = l < 2 ? ['laser', 'missile', 'laser', 'missile'] : l < 3 ? ['laser', 'missile', 'rail', 'laser', 'missile', 'rail'] : l < 4 ? ['laser', 'missile', 'stasis', 'rail', 'laser', 'missile', 'rail'] : l < 6 ? ['laser', 'missile', 'pylon', 'rail', 'stasis', 'laser', 'missile', 'rail', 'pylon'] : ['laser', 'missile', 'rail', 'pylon', 'drone', 'stasis', 'laser', 'missile', 'rail', 'pylon', 'drone'];
      let bi = 0, t = 0, log = [], lowest = 20;
      const nextBuild = () => mix[bi % mix.length];
      function act() {
        // build/upgrade
        for (let guard = 0; guard < 6; guard++) {
          let free = G.slots.map((s, i) => [s, i]).filter(x => !x[0].t);
          if (G.L.boss && G.wave >= G.nW - 2) { const ln = G.lanes[0]; const dd = s => { let m = 1e9; for (let q = 0; q < ln.pts.length; q += 8) m = Math.min(m, (ln.pts[q] - s.x) ** 2 + (ln.pts[q + 1] - s.y) ** 2); return m; }; free.sort((x, y) => dd(x[0]) - dd(y[0])); }
          const k = nextBuild(), cost = T.TURRETS[k].cost;
          const ups = G.turrets.map((tt, i) => [tt, i]).filter(x => x[0].tier < 4).map(x => ({ i: x[1], c: T.upCost(x[0].k, x[0].tier), tier: x[0].tier })).sort((a, b) => a.tier - b.tier || a.c - b.c);
          const cap = Math.min(G.slots.length, Math.round((7 + l * 0.6) * (0.6 + 0.4 * skill)) + (G.L.boss && G.wave >= G.nW - 2 ? 4 : 0));
          const wantUp = ups.length && (free.length === 0 || G.turrets.length >= cap || (ups[0].tier === 1 && G.turrets.length >= 3 && G.turrets.length % 2 === 1 && skill > 0.5));
          if (wantUp && G.credits >= ups[0].c) { T.upgrade(ups[0].i, Math.random() < 0.5 ? 0 : 1); continue; }
          if (!wantUp && free.length && G.credits >= cost) { T.build(free[0][1], k); bi++; continue; }
          break;
        }
        // abilities
        if (G.ab.strike <= 0 && G.foes.length) { let best = null, bv = 0; G.foes.forEach(f => { if (f.d / f.lane.len < 0.45) return; let v = 0; G.foes.forEach(g => { if ((g.x - f.x) ** 2 + (g.y - f.y) ** 2 < 90 * 90) v += g.hp + g.shield; }); if (v > bv) { bv = v; best = f; } }); if (best && bv > 120 && Math.random() < skill) T.strike(best.x, best.y); }
        if (l >= 3 && G.ab.dilate <= 0 && G.foes.some(f => f.d / f.lane.len > 0.75) && Math.random() < skill) T.dilate();
        if (G.phase === 'build' && G.mode === 'play' && G.countdown < 12) T.launch();
      }
      while (G.mode === 'play' && t < 2400) { act(); T.step(0.5); t += 0.5; lowest = Math.min(lowest, G.integ); }
      return { l, mode: G.mode, integ: G.integ, wave: G.wave, nW: G.nW, score: G.score, turrets: G.turrets.map(x => x.k[0] + x.tier).join(' '), credits: Math.floor(G.credits), t, lk: G.stats.lk, boss: G.stats.bossLeft };
    }, [l, +(process.env.SKILL || 0.8)]);
    res.push(r); console.log(JSON.stringify(r));
  }
  console.log(JSON.stringify({ errs }));
  await b.close();
})();

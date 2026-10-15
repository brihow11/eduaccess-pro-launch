// Scripted check of late-game Rampart Space features. Usage: node features.js [baseUrl]
// Needs a static server at repo root (python3 -m http.server 3601) and Chrome.
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const base = process.argv[2] || 'http://127.0.0.1:3601';
const out = process.env.SHOTS || '/workspace/shots/rampart-space/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push('' + e));
  await p.goto(base + '/games/rampart-space/?debug=1'); await sleep(1500);
  const D = (fn, a) => p.evaluate(fn, a);
  const results = {};
  const closeCards = () => D(() => { document.querySelectorAll('.tut-next,.card-ok,[data-act=ok]').forEach(b => { if (b.offsetParent) b.click(); }); RSEGame.debug.G.card = null; });
  async function toBattle(n, turrets) {
    await D(n => RSEGame.debug.start(n), n); await sleep(300); await closeCards();
    for (let i = 0; i < 6; i++) {
      const m = await D(() => RSEGame.debug.G.mode);
      if (m === 'battle') break;
      if (m === 'arm') { await D(t => { const d = RSEGame.debug, G = d.G, k = G.cores[0]; d.seal(); let n = 0;
          for (let dc = -2; dc <= 3 && n < t.n; dc++) for (let dr = -2; dr <= 3 && n < t.n; dr++) { const c = d.cell(k.c + dc, k.r + dr); d.aim(c.x, c.y); if (t.well && n === 0 && G.placeKind !== 'well') d.sw(); if (!t.well && G.placeKind === 'well') d.sw(); const before = G.turrets.length; d.place(); if (G.turrets.length > before) n++; } }, turrets || { n: 3 }); }
      else if (m === 'repair') await D(() => RSEGame.debug.seal());
      await D(() => RSEGame.debug.skipPhase()); await sleep(400); await closeCards();
    }
    await D(() => { const G = RSEGame.debug.G; G.spawnQ = []; G.foes = []; G.eshots = []; G.timer = 60; });
  }
  const fireAt = async (x, y, n, ms) => { for (let i = 0; i < n; i++) { await D(a => { RSEGame.debug.aim(a[0], a[1]); RSEGame.debug.G.turrets.forEach(t => t.cd = 0); RSEGame.debug.fire(); }, [x, y]); await sleep(ms || 120); } };

  // 1. Moon crack (L10 mothership dropping below 55% hp)
  await toBattle(10);
  await D(() => { RSEGame.debug.spawn('mothership'); const B = RSEGame.debug.G.boss; B.x = 1290; B.hp = B.max * 0.5; });
  await sleep(2600);
  results.moon = await D(() => { const G = RSEGame.debug.G; return { cracked: G.moon.cracked, rocks: G.foes.filter(f => f.moonRock).length }; });
  await p.screenshot({ path: out + 'feat-moon-crack.png' });

  // 2. Derelict -> Ion Lance (L20)
  await toBattle(20);
  await D(() => { RSEGame.debug.spawn('derelict'); RSEGame.debug.G.derelict.x = 1110; });
  for (let i = 0; i < 40; i++) { const d = await D(() => { const d = RSEGame.debug.G.derelict; return d && [d.x, d.y]; }); if (!d) break; await fireAt(d[0], d[1], 1, 150); }
  await closeCards();
  results.ion = await D(() => { const G = RSEGame.debug.G; return { ion: G.ion, weapons: G.weapons.join(','), current: G.weapons[G.wi % G.weapons.length] }; });
  await D(() => { for (let i = 0; i < 4; i++) RSEGame.debug.spawn('fighter'); RSEGame.debug.G.foes.forEach((f, i) => { f.x = 1250; f.y = 560 + i * 50; }); });
  await fireAt(1250, 620, 3, 120); await p.screenshot({ path: out + 'feat-ion-lance.png' }); await fireAt(1250, 620, 3, 120);
  results.ion.beam = await D(() => RSEGame.debug.G.foes.filter(f => f.k === 'fighter' && !f.dead).length < 4);

  // 3. Escort betrayal (L22 round 2 escort turns at waveT>14)
  await toBattle(22);
  await D(() => { const G = RSEGame.debug.G; RSEGame.debug.spawn('escortStay'); G.waveT = 14.5; });
  await sleep(700); await closeCards();
  results.betray = await D(() => { const e = RSEGame.debug.G.escort; return { hostile: e && e.hostile, hp: e && e.hp }; });
  await p.screenshot({ path: out + 'feat-escort-betrayal.png' });
  for (let i = 0; i < 60 && await D(() => !!RSEGame.debug.G.escort); i++) { const e = await D(() => { const e = RSEGame.debug.G.escort; return e && [e.x, e.y]; }); if (!e) break; await fireAt(e[0], e[1], 1, 150); }
  results.betray.destroyed = await D(() => !RSEGame.debug.G.escort);

  // 4. Comet slingshot (L12)
  await toBattle(12);
  await D(() => { const G = RSEGame.debug.G; RSEGame.debug.spawn('comet'); const c = G.comets[0]; c.x = 1200; c.y = 450; c.vx = 0; c.vy = 0;
    RSEGame.debug.spawn('capital'); const f = G.foes[G.foes.length - 1]; f.x = 1450; f.y = 300; f.vx = 0; f.hp = f.max = 30; RSEGame.debug.aim(1200, 450); RSEGame.debug.press(); });
  const held = await D(() => RSEGame.debug.G.comets.some(c => c.held));
  await D(() => RSEGame.debug.aim(1150, 300)); await sleep(500);
  await p.screenshot({ path: out + 'feat-comet-grab.png' });
  await D(() => RSEGame.debug.press()); await sleep(900);
  results.comet = await D(h => { const G = RSEGame.debug.G, f = G.foes.find(f => f.k === 'capital'); return { grabbed: h, flung: !G.comets.some(c => c.held), capitalHp: f ? f.hp : 'destroyed' }; }, held);
  await p.screenshot({ path: out + 'feat-comet-fling.png' });

  // 5. Gravity well (L21)
  await toBattle(21, { n: 2, well: true });
  results.wells = { wellTurrets: await D(() => RSEGame.debug.G.turrets.filter(t => t.well).length) };
  await D(() => { const G = RSEGame.debug.G; for (let i = 0; i < 4; i++) RSEGame.debug.spawn('fighter'); G.foes.forEach((f, i) => { f.x = 1100 + (i % 2) * 120; f.y = 380 + (i >> 1) * 120; f.hp = f.max = 6; f.stun = 9; }); });
  const hp0 = await D(() => RSEGame.debug.G.foes.reduce((a, f) => a + f.hp, 0));
  await D(() => { const d = RSEGame.debug; d.aim(1160, 440); d.G.turrets.forEach(t => { if (!t.well) t.cd = 99; else t.cd = 0; }); d.fire(); });
  await sleep(2600); await p.screenshot({ path: out + 'feat-gravity-well.png' }); await sleep(1500);
  results.wells.spawned = true;
  results.wells.hpBefore = hp0; results.wells.hpAfter = await D(() => RSEGame.debug.G.foes.reduce((a, f) => a + f.hp, 0));

  const pass = { moon: results.moon.cracked > 0 && results.moon.rocks > 0, ion: results.ion.ion && results.ion.current === 'ion' && results.ion.beam,
    betray: results.betray.hostile && results.betray.destroyed, comet: results.comet.grabbed && results.comet.flung && results.comet.capitalHp !== 30,
    wells: results.wells.wellTurrets > 0 && results.wells.hpAfter < results.wells.hpBefore, noErrors: errs.length === 0 };
  console.log(JSON.stringify({ results, pass, errs }, null, 1));
  await b.close(); process.exit(Object.values(pass).every(Boolean) ? 0 : 1);
})();

// Real-input play-through (mouse on desktop, touch taps on phone landscape): title -> tips -> build -> launch ->
// upgrade -> pause -> mute -> win sector 1 -> Scout splash -> sector 2 -> game over -> initials -> high scores.
// Usage: node playthrough.js [baseUrl]   Env: VP=1600x900 TOUCH=1 DPR=2 TAG=desk   Written by: Howie
const PW = process.env.PLAYWRIGHT_CORE || '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core';
const { chromium } = require(PW);
const assert = require('assert');
const base = process.argv[2] || 'http://127.0.0.1:3601', out = process.env.SHOTS || '/workspace/shots/space-td/';
const vp = (process.env.VP || '1600x900').split('x').map(Number), touch = !!process.env.TOUCH, tag = process.env.TAG || (touch ? 'phone' : 'desk');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: touch, isMobile: touch, deviceScaleFactor: +(process.env.DPR || 1) });
  const p = await ctx.newPage(); const errs = [], steps = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.stack)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const ok = (name, cond) => { steps.push((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) console.log('FAIL ' + name); };
  const tap = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); await sleep(120); };
  const canvasBox = async () => p.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left, y: r.top }; });
  const tapUI = async id => { await closeTips(); const r = await p.evaluate(id => { const b = RSTD.G.ui.find(u => u.id === id); return b && { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }, id); if (!r) return false; const c = await canvasBox(); await tap(c.x + r.x, c.y + r.y); return true; };
  const tapWorld = async (wx, wy) => { await closeTips(); const s = await p.evaluate(([x, y]) => RSTD.toScreen(x, y), [wx, wy]); const c = await canvasBox(); await tap(c.x + s.x, c.y + s.y); };
  const closeTips = async (max = 8) => { await sleep(80); for (let i = 0; i < max; i++) { const bt = await p.$('#tut:not([hidden]) .tut-next'); if (!bt) break; await press(bt); await sleep(150); } };
  const G = (fn, a) => p.evaluate(fn, a);
  const press = async h => { const bb = await h.boundingBox(); await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };

  await p.goto(base + '/games/rampart-space/'); await sleep(1800);
  ok('banner present', await p.$('.jsp-banner, [data-jsp-banner] a, [data-jsp-banner] *') !== null);
  ok('main menu link', await p.$eval('#btn-menu', a => a.getAttribute('href')) === '/games/');
  await p.screenshot({ path: out + tag + '-1-title.png' });
  const start = await p.$('[data-a=start]'); ok('start button', !!start); await press(start); await sleep(800);
  ok('tip shown', await p.$('#tut:not([hidden])') !== null);
  await p.screenshot({ path: out + tag + '-2-tip.png' });
  await closeTips();
  ok('in play', await G(() => RSTD.G.mode === 'play' && RSTD.G.lvl === 1));
  // build a laser on the hinted slot via real taps
  const hs = await G(() => { const G = RSTD.G, s = G.slots[G.hint != null ? G.hint : 0]; return [s.x, s.y]; });
  await tapWorld(hs[0], hs[1]); await sleep(200);
  ok('build ring open', await G(() => !!(RSTD.G.sel && !RSTD.G.sel.t)));
  await p.screenshot({ path: out + tag + '-3-buildring.png' });
  await tapUI('b_laser'); if (touch) await tapUI('b_laser');
  ok('laser built', await G(() => RSTD.G.turrets.length === 1 && RSTD.G.turrets[0].k === 'laser'));
  await closeTips();
  // second + third turret
  for (const [i, k] of [[1, 'missile'], [2, 'laser']]) { const s = await G(i => { const S = RSTD.G.slots.filter(s => !s.t)[0]; return [S.x, S.y]; }, i); await tapWorld(s[0], s[1]); await sleep(150); await tapUI('b_' + k); if (touch) await tapUI('b_' + k); await closeTips(); }
  ok('three turrets', await G(() => RSTD.G.turrets.length) === 3);
  // launch via the HUD button
  await tapUI('launch'); await sleep(300); await closeTips();
  ok('wave 1 launched', await G(() => RSTD.G.wave === 1 && RSTD.G.phase === 'wave'));
  await G(() => RSTD.tips(false)); // tips were exercised above; keep the rest deterministic
  await tapUI('speed'); ok('2x speed', await G(() => RSTD.G.speed === 2));
  await sleep(6000); await closeTips();
  await p.screenshot({ path: out + tag + '-4-battle.png' });
  // orbital strike on the lead ship via taps
  const lead = await G(() => { const f = RSTD.G.foes[0]; return f && [f.x, f.y]; });
  if (lead) { await tapUI('strike'); await tapWorld(lead[0], lead[1]); ok('strike cast', await G(() => RSTD.G.ab.strike > 0) || (console.log(await G(() => [RSTD.G.armed, RSTD.tipOpen(), RSTD.G.ab.strike, RSTD.G.paused])), false)); }
  // pause via toolbar
  await press(await p.$('#btn-pause')); await sleep(300);
  ok('paused overlay', await G(() => RSTD.G.paused) && await p.$('.arcade-ov:not([hidden]) [data-main-menu]') !== null);
  await p.screenshot({ path: out + tag + '-5-paused.png' });
  const res = await p.$('.arcade-ov:not([hidden]) button.primary'); await press(res); await sleep(200);
  ok('resumed', await G(() => !RSTD.G.paused));
  // mute
  await press(await p.$('#btn-mute')); ok('muted', await p.$eval('#btn-mute', b => b.getAttribute('aria-pressed')) === 'true' && await G(() => localStorage.getItem('rstd.muted') === '1'));
  await press(await p.$('#btn-mute'));
  // wait for wave to clear, then open the turret card and upgrade with taps
  for (let i = 0; i < 40 && await G(() => RSTD.G.phase === 'wave'); i++) { await sleep(1000); await closeTips(); }
  ok('wave 1 cleared', await G(() => RSTD.G.phase === 'build' && RSTD.G.wave === 1 && RSTD.G.integ > 0));
  await closeTips();
  const t0 = await G(() => [RSTD.G.turrets[0].x, RSTD.G.turrets[0].y]);
  await tapWorld(t0[0], t0[1]); await sleep(200);
  await p.screenshot({ path: out + tag + '-6-card.png' });
  await G(() => { RSTD.G.credits += 200; });
  await tapUI('up'); ok('upgraded via card', await G(() => RSTD.G.turrets[0].tier === 2));
  // finish sector 1 quickly with the simulator (keeps the real loop state), then check the Scout splash
  await G(() => { const T = RSTD, G = T.G; T.tips(false); G.credits += 600; G.slots.forEach((s, i) => { if (!s.t && G.turrets.length < 8) T.build(i, i % 2 ? 'missile' : 'laser'); }); for (let k = 0; k < 4000 && G.mode === 'play'; k++) { if (G.phase === 'build') T.launch(); T.step(0.25); } });
  ok('sector 1 won', await G(() => RSTD.G.mode === 'won'));
  await sleep(600); await p.screenshot({ path: out + tag + '-7-won.png' });
  await sleep(2600);
  ok('scout splash after sector', await G(() => window.ScoutSplash.isOpen()));
  await p.screenshot({ path: out + tag + '-8-splash.png' });
  await p.keyboard.press('Enter'); await sleep(900);
  ok('sector 2 started, score kept', await G(() => RSTD.G.lvl === 2 && RSTD.G.mode === 'play' && RSTD.G.score > 0));
  await G(() => { RSTD.G.banner = null; }); await sleep(300);
  // game over -> splash -> initials -> high scores
  await G(() => { const T = RSTD, G = T.G; G.integ = 1; const f = T.spawn('scout', 0); f.d = f.lane.len - 1; T.step(0.2); });
  ok('sector lost', await G(() => RSTD.G.mode === 'lost'));
  await sleep(3000); ok('scout splash on game over', await G(() => window.ScoutSplash.isOpen()));
  await sleep(1200); await p.keyboard.press('Enter'); await sleep(600);
  const inp = await p.$('.ini input'); ok('initials prompt', !!inp);
  if (inp) { await inp.fill('BRI'); await p.keyboard.press('Enter'); await sleep(400); }
  ok('high score saved', await G(() => JSON.parse(localStorage.getItem('rstd.scores') || '[]').some(s => s.n === 'BRI')));
  await p.screenshot({ path: out + tag + '-9-scores.png' });
  const retry = await p.$('[data-a=retry]'); ok('retry button', !!retry);
  // sector select + how to play
  const tt = await p.$('[data-a=title]'); await press(tt); await sleep(400);
  const ss = await p.$('[data-a=sectors]'); await press(ss); await sleep(300);
  ok('sector 2 unlocked in select', await p.$('[data-a=lvl][data-n="2"]:not([disabled])') !== null && await p.$('[data-a=lvl][data-n="3"][disabled]') !== null);
  await p.screenshot({ path: out + tag + '-10-sectors.png' });
  console.log(steps.join('\n')); console.log(JSON.stringify({ errs }));
  const failed = steps.filter(s => s.startsWith('FAIL')).length + errs.length; console.log(failed ? 'PLAYTHROUGH FAIL' : 'PLAYTHROUGH PASS');
  await b.close(); process.exit(failed ? 1 : 0);
})();

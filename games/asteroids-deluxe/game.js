/* Asteroids Deluxe tribute: 12 sectors of glowing vector combat with shields, the wedge cluster and saucers.
   Original code, art, sound and music, built from scratch. Written by: Howie */
(function () {
  'use strict';
  var K = window.VKit, DEBUG = K.DEBUG, TAU = Math.PI * 2;
  var canvas = document.getElementById('game'), wrap = document.getElementById('wrap');
  var R = K.glow(canvas, { b1: 0.5, b2: 0.72, b3: 0.85 }), c = R.ctx;
  var fxOn = K.store.get('ad.fx', true), touchPref = K.store.get('ad.touch', 'auto');
  var hk = 1, W = 1280, H = 800, s = 1, ox = 0, oy = 0, dpr = 1, lw = 1.5, hudTop = 14, narrow = false, portrait = false, bgCanvas = null;

  /* ---------------- input ---------------- */
  var ACTIONS = [
    { id: 'left', label: 'Rotate left', keys: ['ArrowLeft', 'KeyA'] },
    { id: 'right', label: 'Rotate right', keys: ['ArrowRight', 'KeyD'] },
    { id: 'thrust', label: 'Thrust', keys: ['ArrowUp', 'KeyW'] },
    { id: 'shield', label: 'Shield', keys: ['ArrowDown', 'KeyS'] },
    { id: 'fire', label: 'Fire', keys: ['Space', 'KeyJ'] },
    { id: 'pause', label: 'Pause', keys: ['KeyP', 'Escape'] },
    { id: 'mute', label: 'Mute / unmute', keys: ['KeyM', null] },
    { id: 'start', label: 'Start / continue', keys: ['Enter', null] }
  ];
  var settingsEl = document.getElementById('settings');
  var I = K.input({
    actions: ACTIONS, storeKey: 'ad.keys',
    onKey: function (e) {
      A.unlock();
      if (!settingsEl.hidden) { if (e.code === 'Escape') closeSettings(); return false; }
    },
    pad: function (gp) {
      var ax = gp.axes || [], b = gp.buttons || [];
      function p(i) { return !!(b[i] && (b[i].pressed || b[i].value > 0.5)); }
      return { left: ax[0] < -0.45 || p(14), right: ax[0] > 0.45 || p(15), thrust: ax[1] < -0.6 || p(12) || p(7),
        shield: p(1) || p(13) || p(6) || ax[1] > 0.7, fire: p(0) || p(2), pause: p(9), start: p(9) || p(3) };
    }
  });

  /* ---------------- audio: effects ---------------- */
  var A = K.audio('ad.muted', 0.7);
  var thrustL = A.loop(function (ctx, L) {
    var src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340; f.Q.value = 1.2;
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 13; lg.gain.value = 90; lfo.connect(lg); lg.connect(f.frequency);
    var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 46; og.gain.value = 0.18;
    src.connect(f); o.connect(og); og.connect(f); f.connect(L.g); L.g.connect(A.out(0, 0.15));
    src.start(); lfo.start(); o.start();
  });
  var shieldL = A.loop(function (ctx, L) {
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 820; f.Q.value = 3;
    [110, 111.7, 220.4].forEach(function (fr) { var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); });
    var trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 0.35; trem.gain.value = 0.65;
    lfo.connect(lg); lg.connect(trem.gain); lfo.start(); f.connect(trem); trem.connect(L.g); L.g.connect(A.out(0, 0.4));
  });
  function siren(base, depth, rate) {
    return A.loop(function (ctx, L) {
      var o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'square'; o2.type = 'triangle'; o.frequency.value = base; o2.frequency.value = base * 1.5;
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rate; lg.gain.value = depth; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; var g2 = ctx.createGain(); g2.gain.value = 0.4;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(L.g); L.g.connect(A.out(0, 0.35)); o.start(); o2.start(); lfo.start();
    });
  }
  var sirenBig = siren(380, 90, 3.2), sirenSmall = siren(760, 160, 7.5);
  function panOf(x) { return K.clamp((x / W) * 2 - 1, -1, 1) * 0.7; }
  var Sfx = {
    fire: function (x) { var p = panOf(x); A.tone({ type: 'square', f: 1500, to: 260, dur: 0.12, gain: 0.07, lp: 3800, pan: p, send: 0.25 }); A.tone({ type: 'sine', f: 2600, to: 900, dur: 0.06, gain: 0.05, pan: p }); },
    ufoFire: function (x) { A.tone({ type: 'sawtooth', f: 980, to: 180, dur: 0.18, gain: 0.06, lp: 2400, pan: panOf(x) }); },
    boom: function (x, size) {
      var p = panOf(x), k = size / 3;
      A.noise({ f: 900 + 2600 * k, to: 50, dur: 0.35 + 0.7 * k, gain: 0.32 + 0.3 * k, pan: p, send: 0.5 });
      A.noise({ ftype: 'bandpass', f: 3200, to: 400, dur: 0.12 + 0.1 * k, gain: 0.12, q: 1.4, pan: p });
      A.tone({ type: 'sine', f: 120 - 40 * k, to: 28, dur: 0.3 + 0.5 * k, gain: 0.22 + 0.25 * k, pan: p, send: 0.2 });
    },
    death: function (x) {
      Sfx.boom(x, 3.4);
      A.tone({ type: 'sawtooth', f: 420, to: 40, dur: 1.4, gain: 0.12, lp: 1400, pan: panOf(x), send: 0.6 });
      A.noise({ f: 400, to: 40, dur: 2.2, gain: 0.25, delay: 0.15, send: 0.7 });
    },
    bounce: function (x) { A.tone({ type: 'triangle', f: 260, to: 780, dur: 0.14, gain: 0.12, pan: panOf(x), send: 0.5 }); },
    wedgeIn: function () { A.tone({ type: 'sawtooth', f: 64, to: 44, dur: 1.4, gain: 0.16, lp: 520, q: 6, send: 0.6 }); A.tone({ type: 'sawtooth', f: 65.4, to: 44.5, dur: 1.4, gain: 0.12, lp: 700, send: 0.6, delay: 0.05 }); },
    split: function (x) { A.tone({ type: 'square', f: 520, to: 1300, dur: 0.14, gain: 0.07, lp: 3000, pan: panOf(x) }); A.noise({ ftype: 'highpass', f: 3000, dur: 0.12, gain: 0.08, pan: panOf(x) }); },
    life: function () { [0, 4, 7, 12].forEach(function (n, i) { A.tone({ type: 'triangle', f: K.freq(76 + n), dur: 0.35, gain: 0.12, delay: i * 0.08, send: 0.6 }); }); },
    start: function () { A.noise({ f: 200, to: 4000, dur: 0.6, gain: 0.12, ftype: 'bandpass', q: 3, send: 0.6 }); A.tone({ type: 'sawtooth', f: 110, to: 440, dur: 0.6, gain: 0.08, lp: 2000, send: 0.6 }); },
    click: function () { A.tone({ type: 'sine', f: 900, dur: 0.05, gain: 0.05 }); }
  };

  /* ---------------- audio: soundtrack ---------------- */
  function rep(str, n) { var a = []; for (var i = 0; i < n; i++) a.push(str); return a.join(' '); }
  function hold(ch, n) { return ch + ' ' + rep('-', n - 1); }
  var SONGS = {
    title: { bpm: 96, len: 64, loop: true, tracks: [
      { inst: 'bass', vel: 0.8, p: 'a1 - . a1 . . a1 . a1 - . a2 . . a1 . f1 - . f1 . . f1 . f1 - . f2 . . f1 . g1 - . g1 . . g1 . g1 - . g2 . . g1 . e1 - . e1 . . e1 . e1 - . e2 . . g#1 .' },
      { inst: 'pad', vel: 0.8, p: hold('a3+c4+e4', 16) + ' ' + hold('f3+a3+c4', 16) + ' ' + hold('g3+b3+d4', 16) + ' ' + hold('e3+g#3+b3', 16) },
      { inst: 'pluck', vel: 0.5, p: 'a3 c4 e4 a4 e4 c4 a3 c4 e4 a4 b4 a4 e4 c4 b3 c4 f3 a3 c4 f4 c4 a3 f3 a3 c4 f4 g4 f4 c4 a3 g3 a3 g3 b3 d4 g4 d4 b3 g3 b3 d4 g4 a4 g4 d4 b3 a3 b3 e3 g#3 b3 e4 b3 g#3 e3 g#3 b3 e4 f4 e4 b3 g#3 e3 g#3' },
      { inst: 'lead', vel: 0.75, p: '. . . . . . . . e5 - - - d5 - c5 - c5 - - - - - - - a4 - - - c5 - f5 - d5 - - - - - - - b4 - - - g4 - b4 - e5 - - - - - - - - - - - g#4 - b4 -' },
      { inst: 'kick', vel: 0.8, p: 'c1 . . . . . . . c1 . c1 . . . . .' },
      { inst: 'snare', vel: 0.6, p: '. . . . c1 . . . . . . . c1 . . .' },
      { inst: 'hat', vel: 0.6, p: '. . c1 . . . c1 . . . c1 . . . c1 c1' }
    ] },
    // in-game: the two-note heartbeat (a nod to the cabinet) over a low drone; tempo rises as the field thins
    game: { bpm: 64, len: 64, loop: true, tracks: [
      { inst: 'thump', vel: 0.85, p: 'e1 . . . f1 . . .' },
      { inst: 'pad', vel: 0.45, p: hold('a2+e3', 32) + ' ' + hold('f2+c3', 32) },
      { inst: 'pluck', vel: 0.22, p: '. . . . . . . . . . . . . . e5 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . f5 . . . . . . . . . . . . . . . . .' }
    ] },
    clear: { bpm: 132, len: 16, loop: false, tracks: [
      { inst: 'bell', vel: 0.9, p: 'a4 c5 e5 a5 - - - - e5 - a5 - - - - -' },
      { inst: 'pad', vel: 0.7, p: hold('a3+c4+e4', 16) },
      { inst: 'kick', vel: 0.6, p: 'c1 . . . . . . . c1 . . . . . . .' }
    ] },
    victory: { bpm: 108, len: 48, loop: false, then: 'title', tracks: [
      { inst: 'bell', vel: 0.9, p: 'a4 c#5 e5 a5 - - - - e5 - a5 - c#6 - - - - - - - - - - - b5 - a5 - g#5 - e5 - a5 - - - - - - - - - - - - - - -' },
      { inst: 'lead', vel: 0.7, p: '. . . . . . . . . . . . . . . . a5 - - - g5 - - - f5 - - - g5 - - - a5 - - - - - - - - - - - - - - -' },
      { inst: 'pad', vel: 0.9, p: hold('a3+c#4+e4', 8) + ' ' + hold('f3+a3+c4', 4) + ' ' + hold('g3+b3+d4', 4) + ' ' + hold('f3+a3+c4', 8) + ' ' + hold('g3+b3+e4', 8) + ' ' + hold('a3+c#4+e4+a4', 16) },
      { inst: 'bass', vel: 0.8, p: 'a1 - - - - - - - f1 - - - g1 - - - f1 - - - - - - - g1 - - - e1 - - - a1 - - - - - - - - - - - - - - -' },
      { inst: 'kick', vel: 0.8, p: 'c1 . . . . . . . c1 . . . c1 . . . c1 . . . . . . . c1 . . . c1 . . . c1 . . . . . . . . . . . . . . .' },
      { inst: 'snare', vel: 0.5, p: '. . . . c1 . . . . . . . c1 . c1 c1 . . . . c1 . . . . . . . c1 c1 c1 c1 . . . . . . . . . . . . . . . .' }
    ] },
    over: { bpm: 72, len: 24, loop: false, tracks: [
      { inst: 'lead', vel: 0.7, p: 'e4 - d4 - c4 - - - b3 - - - a3 - - - - - - - - - - -' },
      { inst: 'pad', vel: 0.8, p: hold('a2+c3+e3', 8) + ' ' + hold('g#2+b2+e3', 8) + ' ' + hold('a2+c3+e3', 8) },
      { inst: 'bass', vel: 0.8, p: 'a1 - - - - - - - e1 - - - - - - - a0 - - - - - - -' }
    ] }
  };
  var Music = K.music(A, SONGS, { storeKey: 'ad.music', vol: 0.3 });
  A.onReady = function () { Music.resume(); };
  window.addEventListener('pointerdown', function () { A.unlock(); }, true);

  /* ---------------- levels ---------------- */
  var LEVELS = [
    { name: 'OUTER BELT', big: 4, spd: 0.9, stars: 0, ufo: 26, smallP: 0, acc: 0, fire: 1.6 },
    { name: 'DRIFT LINE', big: 5, spd: 1.0, stars: 1, starAt: 16, ufo: 22, smallP: 0.1, acc: 0.25, fire: 1.5 },
    { name: 'SHATTER ZONE', big: 3, med: 4, spd: 1.05, stars: 1, starAt: 12, ufo: 20, smallP: 0.2, acc: 0.3, fire: 1.4 },
    { name: 'DENSE FIELD', big: 7, spd: 1.05, stars: 1, starAt: 20, ufo: 20, smallP: 0.25, acc: 0.35, fire: 1.4 },
    { name: 'WEDGE PATROL', big: 4, spd: 1.1, stars: 2, starAt: 6, starGap: 14, ufo: 26, smallP: 0.25, acc: 0.4, fire: 1.4 },
    { name: 'SAUCER LANES', big: 5, spd: 1.1, stars: 1, starAt: 18, ufo: 9, smallP: 0.5, acc: 0.45, fire: 1.2 },
    { name: 'HAILSTORM', big: 2, med: 6, sml: 6, spd: 1.25, stars: 1, starAt: 14, ufo: 18, smallP: 0.4, acc: 0.5, fire: 1.2 },
    { name: 'CROSSFIRE', big: 6, spd: 1.2, stars: 2, starAt: 10, starGap: 16, ufo: 11, smallP: 0.6, acc: 0.55, fire: 1.1 },
    { name: 'IRON FIELD', big: 8, spd: 1.15, stars: 1, starAt: 22, ufo: 16, smallP: 0.5, acc: 0.6, fire: 1.1 },
    { name: 'HUNTER PACK', big: 5, spd: 1.25, stars: 3, starAt: 5, starGap: 10, ufo: 18, smallP: 0.55, acc: 0.65, fire: 1.1 },
    { name: 'DEAD RECKONING', big: 7, med: 3, spd: 1.3, stars: 2, starAt: 12, starGap: 14, ufo: 10, smallP: 0.7, acc: 0.7, fire: 1.0 },
    { name: 'THE CORE', big: 9, spd: 1.35, stars: 3, starAt: 8, starGap: 12, ufo: 9, smallP: 0.8, acc: 0.8, fire: 0.9 }
  ];
  var ROCK_R = { 3: 52, 2: 28, 1: 14 }, ROCK_PTS = { 3: 50, 2: 100, 1: 200 }, ROCK_MASS = { 3: 7, 2: 3, 1: 1 };

  /* ---------------- state ---------------- */
  var G = { state: 'title', level: 1, score: 0, lives: 3, nextLife: 10000, t: 0, paused: false, rocks: [], bullets: [], ebullets: [], foes: [], ufo: null, parts: [], pops: [],
    ship: null, msg: '', msg2: '', msgT: 0, shake: 0, respawnT: 0, stateT: 0, starsLeft: 0, starT: 0, ufoT: 0, mass0: 1, fireCd: 0, god: false, tip: '', tipT: 0,
    stats: { shots: 0, hits: 0, ufos: 0, wedges: 0 }, newHi: false };
  var hiScores = K.store.get('ad.hiscores', []);
  function best() { return hiScores.length ? hiScores[0].s : 0; }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function wrapPos(o) { if (o.x < 0) o.x += W; else if (o.x >= W) o.x -= W; if (o.y < 0) o.y += H; else if (o.y >= H) o.y -= H; }
  function dwrap(a, b, span) { var d = b - a; if (d > span / 2) d -= span; else if (d < -span / 2) d += span; return d; }
  function dist2(a, b) { var dx = dwrap(a.x, b.x, W), dy = dwrap(a.y, b.y, H); return dx * dx + dy * dy; }

  function makeShape(size) { // faceted, polyhedron-like rocks with an inner face and spokes (as on the Deluxe cabinet)
    var n = size === 3 ? 12 : size === 2 ? 10 : 8, outer = [], ridges = [];
    for (var i = 0; i < n; i++) { var a = (i / n) * TAU + rnd(-0.1, 0.1), r = rnd(0.78, 1.0); outer.push([Math.cos(a) * r, Math.sin(a) * r]); }
    var k = size === 1 ? 3 : size === 2 ? 4 : 5, off = rnd(0, n), ox0 = rnd(-0.14, 0.14), oy0 = rnd(-0.14, 0.14), inner = [];
    for (var j = 0; j < k; j++) {
      var v = outer[Math.floor(off + j * n / k) % n], f = rnd(0.34, 0.5), q = [v[0] * f + ox0, v[1] * f + oy0];
      inner.push(q); ridges.push([v, q]);
    }
    inner.push(inner[0]); ridges.push(inner);
    return { outer: outer, ridges: ridges };
  }
  function addRock(size, x, y, vx, vy) {
    var r = ROCK_R[size], L = LEVELS[G.level - 1] || LEVELS[0];
    if (vx == null) { var a = rnd(0, TAU), sp = (size === 3 ? rnd(34, 64) : size === 2 ? rnd(64, 104) : rnd(100, 150)) * (G.state === 'title' ? 0.7 : L.spd); vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; }
    G.rocks.push({ x: x, y: y, vx: vx, vy: vy, r: r, size: size, rot: rnd(0, TAU), vr: rnd(-0.9, 0.9) * (4 - size) * 0.5, shape: makeShape(size) });
  }
  function edgeSpawn() {
    for (var tries = 0; tries < 30; tries++) {
      var p = Math.random() < 0.5 ? { x: rnd(0, W), y: Math.random() < 0.5 ? rnd(0, H * 0.12) : rnd(H * 0.88, H) } : { x: Math.random() < 0.5 ? rnd(0, W * 0.12) : rnd(W * 0.88, W), y: rnd(0, H) };
      if (!G.ship || dist2(p, G.ship) > 260 * 260) return p;
    }
    return { x: 0, y: 0 };
  }
  function newShip() { return { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5, energy: Math.max(G.ship ? G.ship.energy : 1, 0.5), shieldOn: false, thrust: false, dead: false }; }

  function startGame() {
    G.score = 0; G.lives = 3; G.nextLife = 10000; G.stats = { shots: 0, hits: 0, ufos: 0, wedges: 0 }; G.newHi = false; G.ship = null;
    Sfx.start(); startLevel(1);
  }
  function startLevel(n) {
    G.level = n; var L = LEVELS[n - 1];
    G.state = 'play'; G.stateT = 0; G.rocks = []; G.bullets = []; G.ebullets = []; G.foes = []; G.ufo = null; G.pops = [];
    var keepE = G.ship ? Math.min(1, G.ship.energy + 0.3) : 1;
    G.ship = newShip(); G.ship.energy = n === 1 ? 1 : keepE; G.ship.inv = 2;
    for (var i = 0; i < L.big; i++) { var p = edgeSpawn(); addRock(3, p.x, p.y); }
    for (i = 0; i < (L.med || 0); i++) { p = edgeSpawn(); addRock(2, p.x, p.y); }
    for (i = 0; i < (L.sml || 0); i++) { p = edgeSpawn(); addRock(1, p.x, p.y); }
    G.mass0 = massLeft() || 1;
    G.starsLeft = L.stars; G.starT = L.starAt || 0; G.ufoT = L.ufo * rnd(0.6, 1.1);
    G.msg = 'SECTOR ' + n; G.msg2 = L.name; G.msgT = 2.6;
    if (n === 1 && !K.store.get('ad.tipSeen', false)) { G.tip = K.isTouch ? 'HOLD SHIELD TO BLOCK HITS - IT DRAINS' : 'DOWN ARROW RAISES THE SHIELD - IT DRAINS'; G.tipT = 7; K.store.set('ad.tipSeen', true); }
    I.clear(); Music.play('game', true);
  }
  function massLeft() { var m = 0; G.rocks.forEach(function (r) { m += ROCK_MASS[r.size]; }); return m; }

  function addScore(p, x, y) {
    if (G.state !== 'play' && G.state !== 'clear') return;
    G.score += p;
    if (G.score >= G.nextLife) { G.nextLife += 10000; if (G.lives < 9) { G.lives++; Sfx.life(); G.pops.push({ x: W / 2, y: H * 0.3, t: 1.6, txt: 'EXTRA SHIP', size: 22 }); } }
    if (x != null && p >= 200) G.pops.push({ x: x, y: y, t: 0.9, txt: String(p), size: 14 });
  }

  /* ---------------- particles ---------------- */
  function sparks(x, y, n, sp, col, life) {
    for (var i = 0; i < n && G.parts.length < 700; i++) { var a = rnd(0, TAU), v = rnd(0.2, 1) * sp; G.parts.push({ k: 's', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(0.5, 1) * (life || 0.8), m: life || 0.8, col: col }); }
  }
  function debris(x, y, n, len, sp, col) {
    for (var i = 0; i < n && G.parts.length < 700; i++) { var a = rnd(0, TAU), v = rnd(0.3, 1) * sp; G.parts.push({ k: 'g', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: rnd(0, TAU), va: rnd(-6, 6), len: rnd(0.5, 1) * len, t: rnd(0.7, 1.3), m: 1.3, col: col }); }
  }
  function ring(x, y, r1, col) { G.parts.push({ k: 'r', x: x, y: y, r: 4, vr: r1 * 2.2, t: 0.45, m: 0.45, col: col }); }

  /* ---------------- enemies: wedge cluster and saucers ---------------- */
  var HEX = 26, C60 = Math.cos(Math.PI / 3), S60 = Math.sin(Math.PI / 3);
  var PAIR_M = [HEX * 0.5 * C60, HEX * 0.5 * S60];
  var TRI_C = [(HEX + HEX * C60) / 3, (HEX * S60) / 3];
  function rot(p, a) { var ca = Math.cos(a), sa = Math.sin(a); return [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca]; }
  function spawnStar() {
    var p = edgeSpawn(), a = Math.atan2(H / 2 - p.y, W / 2 - p.x) + rnd(-0.6, 0.6), sp = 38 * LEVELS[G.level - 1].spd;
    G.foes.push({ k: 'star', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: 0.5, r: HEX });
    Sfx.wedgeIn();
  }
  function splitFoe(f) {
    var out = [];
    if (f.k === 'star') {
      for (var k = 0; k < 3; k++) {
        var ra = f.rot + k * TAU / 3, off = rot(PAIR_M, ra), dir = Math.atan2(off[1], off[0]);
        out.push({ k: 'pair', x: f.x + off[0], y: f.y + off[1], vx: f.vx + Math.cos(dir) * 120, vy: f.vy + Math.sin(dir) * 120, rot: ra, r: 16, wake: 0.5 });
      }
    } else if (f.k === 'pair') {
      for (var j = 0; j < 2; j++) {
        var ra2 = f.rot + j * Math.PI / 3, rel = rot([TRI_C[0], TRI_C[1]], j * Math.PI / 3);
        rel = rot([rel[0] - PAIR_M[0], rel[1] - PAIR_M[1]], f.rot); var d2 = Math.atan2(rel[1], rel[0]);
        out.push({ k: 'wedge', x: f.x + rel[0], y: f.y + rel[1], vx: f.vx + Math.cos(d2) * 140, vy: f.vy + Math.sin(d2) * 140, rot: ra2, r: 10, wake: 0.35 });
      }
    }
    return out;
  }
  function spawnUfo() {
    var L = LEVELS[G.level - 1], big = Math.random() >= L.smallP, fromLeft = Math.random() < 0.5, r = big ? 22 : 12;
    G.ufo = { x: fromLeft ? -r : W + r, y: rnd(H * 0.15, H * 0.85), vx: (fromLeft ? 1 : -1) * (big ? 105 : 150) * L.spd, vy: 0, big: big, r: r, fireT: rnd(0.6, 1.2), turnT: rnd(1, 2), blink: 0 };
  }
  function ufoShoot(u) {
    var L = LEVELS[G.level - 1], a;
    var sh = G.ship;
    if (!u.big && sh && !sh.dead) {
      var dx = dwrap(u.x, sh.x, W), dy = dwrap(u.y, sh.y, H), tt = Math.sqrt(dx * dx + dy * dy) / 340;
      dx += sh.vx * tt * L.acc; dy += sh.vy * tt * L.acc;
      a = Math.atan2(dy, dx) + rnd(-1, 1) * (1 - L.acc) * 0.6;
    } else if (sh && !sh.dead && Math.random() < L.acc * 0.4) {
      a = Math.atan2(dwrap(u.y, sh.y, H), dwrap(u.x, sh.x, W)) + rnd(-0.5, 0.5);
    } else a = rnd(0, TAU);
    G.ebullets.push({ x: u.x, y: u.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, t: 1.5 });
    Sfx.ufoFire(u.x);
  }

  /* ---------------- destruction ---------------- */
  function killRock(i, byPlayer) {
    var r = G.rocks[i]; G.rocks.splice(i, 1);
    if (byPlayer) { addScore(ROCK_PTS[r.size], r.x, r.y); G.stats.hits++; }
    sparks(r.x, r.y, 10 + r.size * 8, 90 + r.size * 40, 'rock', 0.9); debris(r.x, r.y, 2 + r.size * 2, r.r * 0.5, 70, 'rock');
    if (r.size === 3) { ring(r.x, r.y, r.r, 'rock'); G.shake = Math.max(G.shake, 5); }
    Sfx.boom(r.x, r.size);
    if (r.size > 1 && G.rocks.length < 44) {
      var L = LEVELS[G.level - 1] || LEVELS[0];
      for (var k = 0; k < 2; k++) { var a = rnd(0, TAU), sp = (r.size === 3 ? rnd(64, 110) : rnd(100, 160)) * L.spd; addRock(r.size - 1, r.x + Math.cos(a) * 6, r.y + Math.sin(a) * 6, r.vx * 0.45 + Math.cos(a) * sp, r.vy * 0.45 + Math.sin(a) * sp); }
    }
  }
  function killFoe(i, byPlayer) {
    var f = G.foes[i]; G.foes.splice(i, 1);
    var pts = f.k === 'star' ? 50 : f.k === 'pair' ? 100 : 200;
    if (byPlayer) { addScore(pts, f.x, f.y); G.stats.hits++; if (f.k === 'wedge') G.stats.wedges++; }
    sparks(f.x, f.y, 18, 160, 'wedge', 0.7);
    if (f.k === 'wedge') { debris(f.x, f.y, 4, 9, 120, 'wedge'); Sfx.boom(f.x, 1.3); }
    else { Array.prototype.push.apply(G.foes, splitFoe(f)); Sfx.split(f.x); }
  }
  function killUfo(byPlayer) {
    var u = G.ufo; G.ufo = null;
    if (byPlayer) { addScore(u.big ? 200 : 1000, u.x, u.y); G.stats.hits++; G.stats.ufos++; }
    sparks(u.x, u.y, 40, 220, 'ufo', 1); debris(u.x, u.y, 8, u.r * 0.7, 110, 'ufo'); ring(u.x, u.y, u.r * 2, 'ufo');
    G.shake = Math.max(G.shake, 6); Sfx.boom(u.x, 2.6);
  }
  function killShip() {
    var sh = G.ship; if (!sh || sh.dead || G.god) return;
    sh.dead = true; sh.shieldOn = false; G.respawnT = 2.4; G.lives--;
    var lines = shipLines(); // flying hull segments
    lines.forEach(function (l) {
      var p1 = rot(l[0], sh.a), p2 = rot(l[1], sh.a), mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, a = Math.atan2(my, mx) + rnd(-0.5, 0.5), v = rnd(30, 90);
      G.parts.push({ k: 'g', x: sh.x + mx, y: sh.y + my, vx: sh.vx * 0.3 + Math.cos(a) * v, vy: sh.vy * 0.3 + Math.sin(a) * v, a: Math.atan2(p2[1] - p1[1], p2[0] - p1[0]), va: rnd(-3, 3),
        len: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), t: 2.2, m: 2.2, col: 'ship' });
    });
    sparks(sh.x, sh.y, 60, 260, 'ship', 1.2); ring(sh.x, sh.y, 60, 'ship'); G.shake = 12;
    Sfx.death(sh.x); thrustL.set(0); shieldL.set(0);
    if (G.lives <= 0) { G.state = 'over'; G.stateT = 0; recordScore(); Music.play('over', true); }
  }
  function recordScore() {
    if (G.score <= 0) return;
    G.newHi = G.score > best();
    hiScores.push({ s: G.score, l: G.level, d: new Date().toISOString().slice(0, 10) });
    hiScores.sort(function (a, b) { return b.s - a.s; }); hiScores = hiScores.slice(0, 5); K.store.set('ad.hiscores', hiScores);
  }

  /* ---------------- update ---------------- */
  function fire() {
    var sh = G.ship; if (!sh || sh.dead || G.bullets.length >= 5) return;
    var nx = Math.cos(sh.a), ny = Math.sin(sh.a);
    G.bullets.push({ x: sh.x + nx * 17, y: sh.y + ny * 17, vx: sh.vx + nx * 640, vy: sh.vy + ny * 640, t: 0.85 });
    G.stats.shots++; Sfx.fire(sh.x);
  }
  function update(dt) {
    G.t += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.msgT > 0) G.msgT -= dt;
    if (G.tipT > 0) G.tipT -= dt;
    G.pops.forEach(function (p) { p.t -= dt; p.y -= dt * 20; }); G.pops = G.pops.filter(function (p) { return p.t > 0; });
    var playing = G.state === 'play' || G.state === 'clear' || G.state === 'over';
    var sh = G.ship;

    if (G.state === 'play' || G.state === 'clear') {
      if (sh && !sh.dead) {
        var turn = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
        sh.a += turn * 4.7 * dt;
        sh.thrust = I.isDown('thrust');
        if (sh.thrust) { sh.vx += Math.cos(sh.a) * 430 * dt; sh.vy += Math.sin(sh.a) * 430 * dt; if (Math.random() < 0.6) exhaust(sh); }
        var drag = Math.pow(0.55, dt); sh.vx *= drag; sh.vy *= drag;
        var sp = Math.hypot(sh.vx, sh.vy); if (sp > 520) { sh.vx *= 520 / sp; sh.vy *= 520 / sp; }
        sh.x += sh.vx * dt; sh.y += sh.vy * dt; wrapPos(sh);
        sh.shieldOn = I.isDown('shield') && sh.energy > 0.01;
        if (sh.shieldOn) sh.energy = Math.max(0, sh.energy - dt * 0.3);
        if (sh.inv > 0) sh.inv -= dt;
        G.fireCd -= dt;
        if (I.hit('fire') && G.fireCd <= 0) { fire(); G.fireCd = 0.09; }
        else if (I.isDown('fire') && G.fireCd <= 0) { fire(); G.fireCd = 0.22; }
        thrustL.set(sh.thrust ? 0.32 : 0); shieldL.set(sh.shieldOn ? 0.09 : 0);
      } else if (sh && sh.dead && G.lives > 0) {
        I.hit('fire');
        G.respawnT -= dt;
        if (G.respawnT <= 0) {
          var clear = true, c0 = { x: W / 2, y: H / 2 };
          G.rocks.concat(G.foes).forEach(function (o) { if (dist2(o, c0) < Math.pow(o.r + 110, 2)) clear = false; });
          if (G.ufo && dist2(G.ufo, c0) < 160 * 160) clear = false;
          if (clear || G.respawnT < -4) { G.ship = newShip(); G.ship.energy = Math.max(sh.energy, 0.5); }
        }
      }
    } else { thrustL.set(0); shieldL.set(0); }

    // spawning
    if (G.state === 'play') {
      var L = LEVELS[G.level - 1];
      G.stateT += dt;
      if (G.starsLeft > 0) {
        G.starT -= dt;
        if (G.starT <= 0 || (G.rocks.length === 0 && G.starT > 1)) { if (G.starT > 1) G.starT = 1; else { spawnStar(); G.starsLeft--; G.starT = L.starGap || 14; } }
      }
      if (!G.ufo && G.stateT > 4) { G.ufoT -= dt; if (G.ufoT <= 0) { spawnUfo(); G.ufoT = L.ufo * rnd(0.7, 1.2); } }
      if (G.rocks.length === 0 && G.foes.length === 0 && G.starsLeft === 0) {
        G.state = 'clear'; G.stateT = 0; G.ufo = null; sirenBig.set(0); sirenSmall.set(0);
        G.msg = 'SECTOR ' + G.level + ' CLEARED'; G.msg2 = 'ACCURACY ' + Math.round(100 * G.stats.hits / Math.max(1, G.stats.shots)) + '%'; G.msgT = 2.4;
        if (sh) sh.energy = Math.min(1, sh.energy + 0.25);
        Music.play('clear', true);
      }
      Music.setRate(1 + 1.9 * (1 - K.clamp(massLeft() / G.mass0, 0, 1)));
    } else if (G.state === 'clear') {
      G.stateT += dt;
      if (G.stateT > 2.4) {
        thrustL.set(0); shieldL.set(0);
        if (G.level >= LEVELS.length) { G.state = 'victory'; G.stateT = 0; recordScore(); Music.play('victory', true); I.clear(); }
        else showSplash(false);
      }
    } else if (G.state === 'over') {
      G.stateT += dt;
      if (G.stateT > 2.8) showSplash(true);
    } else if (G.state === 'victory') {
      G.stateT += dt;
      if (Math.random() < dt * 2.2) { var fx = rnd(W * 0.15, W * 0.85), fy = rnd(H * 0.15, H * 0.6), cols = ['ship', 'ufo', 'wedge', 'rock']; var col = cols[(Math.random() * 4) | 0]; sparks(fx, fy, 50, 240, col, 1.6); ring(fx, fy, 50, col); A.noise({ f: 2400, to: 200, dur: 0.6, gain: 0.08, pan: panOf(fx), send: 0.7 }); }
      if (G.stateT > 1.5 && (I.hit('start') || I.hit('fire'))) showSplash(true, true);
    } else if (G.state === 'title') {
      if (I.hit('start') || I.hit('fire')) { startGame(); }
      if (G.rocks.length < 6) { var q = edgeSpawn(); addRock(3 - (Math.random() * 2 | 0), q.x, q.y); }
    }

    // rocks
    G.rocks.forEach(function (r) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; wrapPos(r); });
    // wedges
    var target = sh && !sh.dead ? sh : null;
    G.foes.forEach(function (f) {
      if (f.k === 'star') { f.rot += f.vr * dt; }
      else {
        if (f.wake > 0) f.wake -= dt;
        var Lv = LEVELS[G.level - 1] || LEVELS[0], acc = f.k === 'pair' ? 170 : 270, max = (f.k === 'pair' ? 150 : 215) * Lv.spd;
        if (target && f.wake <= 0) { var dx = dwrap(f.x, target.x, W), dy = dwrap(f.y, target.y, H), d = Math.hypot(dx, dy) || 1; f.vx += dx / d * acc * dt; f.vy += dy / d * acc * dt; }
        else { f.vx *= Math.pow(0.7, dt); f.vy *= Math.pow(0.7, dt); }
        var v = Math.hypot(f.vx, f.vy); if (v > max) { f.vx *= max / v; f.vy *= max / v; }
        var want = Math.atan2(f.vy, f.vx), da = Math.atan2(Math.sin(want - f.rot), Math.cos(want - f.rot)); f.rot += da * Math.min(1, dt * 3);
      }
      f.x += f.vx * dt; f.y += f.vy * dt; wrapPos(f);
    });
    // saucer
    var u = G.ufo;
    if (u) {
      u.x += u.vx * dt; u.y += u.vy * dt; u.blink += dt;
      if (u.y < 0) u.y += H; else if (u.y >= H) u.y -= H;
      u.turnT -= dt; if (u.turnT <= 0) { u.vy = [-1, 0, 1][(Math.random() * 3) | 0] * 70; u.turnT = rnd(0.9, 2); }
      u.fireT -= dt; if (u.fireT <= 0 && G.state === 'play') { ufoShoot(u); u.fireT = LEVELS[G.level - 1].fire * rnd(0.7, 1.2) * (u.big ? 1.1 : 0.85); }
      if (u.x < -u.r - 2 || u.x > W + u.r + 2) G.ufo = null;
      (u.big ? sirenBig : sirenSmall).set(G.ufo ? 0.05 : 0); (u.big ? sirenSmall : sirenBig).set(0);
    } else { sirenBig.set(0); sirenSmall.set(0); }

    // bullets
    function moveB(b) { b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt; wrapPos(b); }
    G.bullets.forEach(moveB); G.ebullets.forEach(moveB);
    G.bullets = G.bullets.filter(function (b) { return b.t > 0; }); G.ebullets = G.ebullets.filter(function (b) { return b.t > 0; });

    // collisions: player bullets
    for (var bi = G.bullets.length - 1; bi >= 0; bi--) {
      var b = G.bullets[bi], hit = false;
      for (var ri = G.rocks.length - 1; ri >= 0; ri--) { var r = G.rocks[ri]; if (dist2(b, r) < r.r * r.r * 0.85) { killRock(ri, true); hit = true; break; } }
      if (!hit) for (var fi = G.foes.length - 1; fi >= 0; fi--) { var f = G.foes[fi]; if (dist2(b, f) < (f.r + 2) * (f.r + 2)) { killFoe(fi, true); hit = true; break; } }
      if (!hit && G.ufo && dist2(b, G.ufo) < Math.pow(G.ufo.r + 2, 2)) { killUfo(true); hit = true; }
      if (hit) G.bullets.splice(bi, 1);
    }
    // saucer bullets hit rocks too
    for (bi = G.ebullets.length - 1; bi >= 0; bi--) {
      b = G.ebullets[bi];
      for (ri = G.rocks.length - 1; ri >= 0; ri--) { r = G.rocks[ri]; if (dist2(b, r) < r.r * r.r * 0.85) { killRock(ri, false); G.ebullets.splice(bi, 1); break; } }
    }
    // saucer vs rocks
    if (G.ufo) for (ri = G.rocks.length - 1; ri >= 0; ri--) { r = G.rocks[ri]; if (dist2(G.ufo, r) < Math.pow(r.r * 0.9 + G.ufo.r, 2)) { killRock(ri, false); killUfo(false); break; } }

    // ship collisions
    sh = G.ship;
    if (sh && !sh.dead && (G.state === 'play' || G.state === 'clear')) {
      var shR = 13, shieldR = 26, safe = sh.inv > 0;
      G.rocks.forEach(function (r, i) {
        var rr = (sh.shieldOn ? shieldR : shR) + r.r * 0.88;
        if (dist2(sh, r) < rr * rr) {
          if (sh.shieldOn) bounce(sh, r, rr);
          else if (!safe) { killRock(i, true); killShip(); }
        }
      });
      if (!sh.dead) G.foes.forEach(function (f, i) {
        var rr = (sh.shieldOn ? shieldR : shR) + f.r;
        if (dist2(sh, f) < rr * rr) {
          if (sh.shieldOn) { bounce(sh, f, rr); if (f.k !== 'star') f.wake = 0.6; }
          else if (!safe && !sh.dead) { killFoe(i, true); killShip(); }
        }
      });
      if (!sh.dead && G.ufo && dist2(sh, G.ufo) < Math.pow((sh.shieldOn ? shieldR : shR) + G.ufo.r, 2)) {
        if (sh.shieldOn) bounce(sh, G.ufo, (shieldR + G.ufo.r));
        else if (!safe) { killUfo(true); killShip(); }
      }
      for (bi = G.ebullets.length - 1; bi >= 0 && !sh.dead; bi--) {
        b = G.ebullets[bi]; var br = sh.shieldOn ? shieldR : shR;
        if (dist2(b, sh) < br * br) { G.ebullets.splice(bi, 1); if (sh.shieldOn) { sparks(b.x, b.y, 8, 120, 'shield', 0.4); Sfx.bounce(b.x); } else if (!safe) killShip(); }
      }
    }

    // particles
    G.parts.forEach(function (p) {
      p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'g') { p.a += p.va * dt; p.vx *= Math.pow(0.6, dt); p.vy *= Math.pow(0.6, dt); }
      else if (p.k === 'r') p.r += p.vr * dt;
      else { p.vx *= Math.pow(0.35, dt); p.vy *= Math.pow(0.35, dt); }
    });
    G.parts = G.parts.filter(function (p) { return p.t > 0; });
    void playing;
  }
  function bounce(sh, o, rr) {
    var dx = dwrap(sh.x, o.x, W), dy = dwrap(sh.y, o.y, H), d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    var rel = (o.vx - sh.vx) * nx + (o.vy - sh.vy) * ny;
    if (rel < 0) { var j = -rel * 1.6; o.vx += nx * j * 0.75; o.vy += ny * j * 0.75; sh.vx -= nx * j * 0.25; sh.vy -= ny * j * 0.25; }
    o.x += nx * (rr - d + 1); o.y += ny * (rr - d + 1); wrapPos(o);
    sh.energy = Math.max(0, sh.energy - 0.04);
    sparks(sh.x + nx * 26, sh.y + ny * 26, 10, 140, 'shield', 0.45); Sfx.bounce(sh.x);
  }
  function exhaust(sh) {
    var a = sh.a + Math.PI + rnd(-0.25, 0.25), v = rnd(140, 260);
    G.parts.push({ k: 's', x: sh.x - Math.cos(sh.a) * 10, y: sh.y - Math.sin(sh.a) * 10, vx: sh.vx + Math.cos(a) * v, vy: sh.vy + Math.sin(a) * v, t: 0.3, m: 0.3, col: 'flame' });
  }

  /* ---------------- splash / flow ---------------- */
  function showSplash(lost, victory) {
    G.state = 'splash'; Music.stop(0.3); thrustL.set(0); shieldL.set(0); sirenBig.set(0); sirenSmall.set(0);
    var acc = Math.round(100 * G.stats.hits / Math.max(1, G.stats.shots));
    var title = victory ? 'ALL 12 SECTORS CLEARED' : lost ? 'GAME OVER' : 'SECTOR ' + G.level + ' CLEARED';
    var sub = 'Score ' + G.score.toLocaleString() + (lost && !victory ? ' \u2022 reached sector ' + G.level : ' \u2022 accuracy ' + acc + '%') + (G.newHi ? ' \u2022 new high score' : '');
    var done = function () {
      I.clear();
      if (lost || victory) toTitle(); else startLevel(G.level + 1);
    };
    if (window.ScoutSplash && ScoutSplash.show) {
      ScoutSplash.show({ kind: 'vector', campaign: 'asteroids-deluxe', tag: victory ? 'victory' : lost ? 'gameover' : 'wave' + G.level, title: title, sub: sub,
        accent: '#9fd0ff', glow: 'rgba(90,160,255,.3)', contLabel: victory || lost ? 'Title screen' : 'Next sector', onContinue: done });
    } else done();
  }
  function toTitle() {
    G.state = 'title'; G.rocks = []; G.foes = []; G.ufo = null; G.bullets = []; G.ebullets = []; G.ship = null; G.msgT = 0; G.pops = [];
    Music.play('title'); I.clear();
  }
  function setPaused(p) {
    if (G.state !== 'play' && G.state !== 'clear') p = false;
    G.paused = p; pauseBtn.innerHTML = p ? '&#9654; <span class="lbl">Resume</span>' : '&#10074;&#10074; <span class="lbl">Pause</span>';
    if (p) { thrustL.set(0); shieldL.set(0); sirenBig.set(0); sirenSmall.set(0); I.releaseTouch(); }
    Music.duck(p ? 0.3 : 1);
  }

  /* ---------------- rendering ---------------- */
  var COL = {
    rock: ['rgba(110,160,255,', '#dce9ff'], ship: ['rgba(90,170,255,', '#ffffff'], wedge: ['rgba(255,60,40,', '#ffc2b0'], ufo: ['rgba(40,230,170,', '#d4fff0'],
    shield: ['rgba(80,240,255,', '#c8fbff'], flame: ['rgba(255,130,40,', '#fff0c0'], text: ['rgba(100,160,255,', '#eaf2ff'], gold: ['rgba(255,190,60,', '#fff1c4'], dim: ['rgba(80,120,200,', '#9fb6e0']
  };
  function stroke(col, w, alpha) {
    var cc = COL[col], a = alpha == null ? 1 : alpha;
    if (fxOn) { c.globalAlpha = a * 0.5; c.lineWidth = lw * (w || 1) * 2.6; c.strokeStyle = cc[0] + '0.55)'; c.stroke(); }
    c.globalAlpha = a; c.lineWidth = lw * (w || 1); c.strokeStyle = cc[1]; c.stroke(); c.globalAlpha = 1;
  }
  function poly(pts, x, y, scale, a, close) {
    var ca = Math.cos(a), sa = Math.sin(a);
    for (var i = 0; i < pts.length; i++) { var px = pts[i][0] * scale, py = pts[i][1] * scale, X = x + px * ca - py * sa, Y = y + px * sa + py * ca; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }
    if (close) c.closePath();
  }
  function each(o, r, fn) { // draw at wrapped positions near edges
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
      var x = o.x + dx * W, y = o.y + dy * H;
      if (x + r < 0 || x - r > W || y + r < 0 || y - r > H) continue; fn(x, y);
    }
  }
  function shipLines() { return [[[18, 0], [-11, 10]], [[-11, 10], [-7, 6]], [[-7, 6], [-7, -6]], [[-7, -6], [-11, -10]], [[-11, -10], [18, 0]], [[7, 0], [-3, 3.6]], [[-3, -3.6], [7, 0]]]; }
  function drawShip(sh, x, y, scale, alpha) {
    scale = scale || 1;
    c.beginPath(); poly([[18, 0], [-11, 10], [-7, 6], [-7, -6], [-11, -10]], x, y, scale, sh.a, true); stroke('ship', 1.15, alpha);
    c.beginPath(); poly([[7, 0], [-3, 3.6], [-3, -3.6]], x, y, scale, sh.a, true); stroke('dim', 0.8, alpha);
    c.beginPath(); poly([[-9, 8], [-9, 5]], x, y, scale, sh.a); poly([[-9, -8], [-9, -5]], x, y, scale, sh.a); stroke('dim', 0.7, alpha);
    if (sh.thrust && !G.paused) { var L = rnd(10, 24); c.beginPath(); poly([[-8, 4.5], [-8 - L, 0], [-8, -4.5]], x, y, scale, sh.a); stroke('flame', 1.1, alpha); c.beginPath(); poly([[-8, 2], [-8 - L * 0.55, 0], [-8, -2]], x, y, scale, sh.a); stroke('gold', 0.8, alpha); }
  }
  function drawShield(sh, x, y) {
    var e = sh.energy, flick = e < 0.25 ? (Math.sin(G.t * 40) > 0 ? 1 : 0.4) : 1, R0 = 26;
    c.beginPath(); for (var i = 0; i <= 12; i++) { var a = i / 12 * TAU + G.t * 1.5, rr = R0 + Math.sin(G.t * 9 + i) * 1.2; if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    stroke('shield', 1.1, 0.85 * flick);
    c.beginPath(); for (i = 0; i < 6; i++) { var b = i / 6 * TAU - G.t * 2.2; c.moveTo(x + Math.cos(b) * (R0 - 5), y + Math.sin(b) * (R0 - 5)); c.arc(x, y, R0 - 5, b, b + 0.5); }
    stroke('shield', 0.7, 0.5 * flick);
  }
  function drawRock(r, x, y) {
    c.beginPath(); poly(r.shape.outer, x, y, r.r, r.rot, true); stroke('rock', r.size === 1 ? 1 : 1.15);
    c.beginPath(); r.shape.ridges.forEach(function (rg) { poly(rg, x, y, r.r, r.rot); }); stroke('rock', 0.65, 0.5);
  }
  var HEXV = []; for (var hv = 0; hv <= 6; hv++) HEXV.push([Math.cos(hv * Math.PI / 3) * HEX, Math.sin(hv * Math.PI / 3) * HEX]);
  function drawFoe(f, x, y) {
    var pulse = 0.75 + 0.25 * Math.sin(G.t * 7 + x * 0.01);
    if (f.k === 'star') {
      c.beginPath(); poly(HEXV, x, y, 1, f.rot, true); stroke('wedge', 1.2);
      c.beginPath(); for (var i = 0; i < 6; i++) { poly([[0, 0], HEXV[i]], x, y, 1, f.rot); } stroke('wedge', 0.8, 0.8);
      c.beginPath(); poly(HEXV, x, y, 0.42, -f.rot * 1.6, true); stroke('gold', 0.7, pulse);
    } else if (f.k === 'pair') {
      var P = [[0, 0], HEXV[0], HEXV[1], HEXV[2]].map(function (p) { return [p[0] - PAIR_M[0], p[1] - PAIR_M[1]]; });
      c.beginPath(); poly(P, x, y, 1, f.rot, true); stroke('wedge', 1.15);
      c.beginPath(); poly([P[0], P[2]], x, y, 1, f.rot); stroke('wedge', 0.8, 0.8);
      c.beginPath(); poly(P, x, y, 0.4, f.rot, true); stroke('gold', 0.6, pulse);
    } else {
      var T = [[0, 0], HEXV[0], HEXV[1]].map(function (p) { return [p[0] - TRI_C[0], p[1] - TRI_C[1]]; });
      c.beginPath(); poly(T, x, y, 1, f.rot, true); stroke('wedge', 1.15);
      c.beginPath(); poly(T, x, y, 0.4, f.rot, true); stroke('gold', 0.6, pulse);
    }
  }
  function drawUfo(u, x, y) {
    var k = u.r / 22;
    c.beginPath(); poly([[-22, 0], [-9, -7], [9, -7], [22, 0], [9, 7], [-9, 7]], x, y, k, 0, true); stroke('ufo', 1.15);
    c.beginPath(); poly([[-22, 0], [22, 0]], x, y, k, 0); poly([[-9, -7], [-5, -14], [5, -14], [9, -7]], x, y, k, 0); stroke('ufo', 0.9, 0.85);
    c.beginPath(); poly([[-14, 3.5], [14, 3.5]], x, y, k, 0); stroke('dim', 0.6, 0.5);
    for (var i = 0; i < 5; i++) { var on = ((u.blink * 6 | 0) % 5) === i; c.beginPath(); c.arc(x + (-12 + i * 6) * k, y + 3.5 * k, (on ? 1.6 : 0.9) * k, 0, TAU); c.fillStyle = on ? '#ffe9a0' : 'rgba(120,255,200,.5)'; c.fill(); }
  }
  function drawBullet(b, enemy) {
    var col = enemy ? COL.flame : COL.ship, tx = b.vx * 0.022, ty = b.vy * 0.022;
    c.beginPath(); c.moveTo(b.x - tx, b.y - ty); c.lineTo(b.x, b.y);
    c.lineWidth = lw * 2.4; c.strokeStyle = col[0] + '0.45)'; c.stroke();
    c.beginPath(); c.arc(b.x, b.y, lw * 1.3, 0, TAU); c.fillStyle = col[1]; c.fill();
  }
  function drawParts() {
    G.parts.forEach(function (p) {
      var a = Math.max(0, p.t / p.m), cc = COL[p.col] || COL.rock;
      if (p.k === 's') {
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        c.lineWidth = lw * 1.1; c.strokeStyle = a > 0.6 ? cc[1] : cc[0] + (a * 1.2).toFixed(3) + ')'; c.globalAlpha = Math.min(1, a * 1.4); c.stroke();
      } else if (p.k === 'g') {
        var dx = Math.cos(p.a) * p.len / 2, dy = Math.sin(p.a) * p.len / 2;
        c.beginPath(); c.moveTo(p.x - dx, p.y - dy); c.lineTo(p.x + dx, p.y + dy); stroke(p.col, 1, Math.min(1, a * 1.5));
      } else { c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); stroke(p.col, 0.8, a * 0.7); }
      c.globalAlpha = 1;
    });
  }
  function vtext(str, x, y, size, col, align, alpha, w) { c.beginPath(); K.textPath(c, str, x, y, size, align); stroke(col || 'text', w || (size > 30 ? 1.5 : 1), alpha); }
  function fitSize(str, size, maxW) { var w = K.textWidth(str, size); return w > maxW ? size * maxW / w : size; }

  function drawHud() {
    var sz = 22 * hk, y = hudTop, small = 11 * hk;
    vtext(String(G.score).padStart(2, '0'), 18, y, sz, 'text', 0);
    vtext('HI ' + Math.max(best(), G.score), W - 16, y + 4, small, 'dim', 1);
    vtext('SECTOR ' + G.level + '/12', W - 16, y + 4 + small * 1.9, small * 0.85, 'dim', 1, 0.8);
    for (var i = 0; i < Math.min(G.lives, 8); i++) drawShip({ a: -Math.PI / 2 }, 18 + 8 * hk + i * 18 * hk, y + sz + 16 * hk, 0.55 * hk, 0.9);
    var e = G.ship ? G.ship.energy : 1, gx = 18, gy = y + sz + 30 * hk, gw = 92 * hk, gh = 6 * hk;
    c.beginPath(); c.rect(gx, gy, gw, gh); stroke('dim', 0.7, 0.7);
    if (e > 0) { c.beginPath(); c.rect(gx + 2, gy + 2, Math.max(0.5, (gw - 4) * e), gh - 4); stroke(e < 0.25 ? 'wedge' : 'shield', 1, 0.95); }
    vtext('SHIELD', gx + gw + 6, gy - 0.5, 7 * hk, 'dim', 0, 0.8);
  }
  function drawCenter(lines, yBase) {
    lines.forEach(function (l, i) { var sz = fitSize(l[0], l[1], W * 0.9); vtext(l[0], W / 2, yBase + (l[3] || i * 40), sz, l[2] || 'text', 0.5, l[4]); });
  }
  function drawTitle() {
    var t1 = 'ASTEROIDS', t2 = 'DELUXE', sz = fitSize(t1, 74, W * 0.86);
    vtext(t1, W / 2, H * 0.17, sz, 'text', 0.5, 1, 1.9);
    vtext(t2, W / 2, H * 0.17 + sz * 1.4, sz * 0.62, 'rock', 0.5, 1, 1.6);
    var y = H * 0.17 + sz * 1.4 + sz * 0.62 + 26;
    vtext('ARCADE TRIBUTE  -  12 SECTORS', W / 2, y, fitSize('ARCADE TRIBUTE  -  12 SECTORS', 13, W * 0.9), 'dim', 0.5);
    var blink = (G.t % 1.2) < 0.8;
    var startTxt = K.isTouch ? 'TAP TO START' : 'PRESS SPACE OR ENTER TO START';
    if (blink) vtext(startTxt, W / 2, H * 0.5, fitSize(startTxt, 20, W * 0.9), 'gold', 0.5);
    // score table
    var ty = H * 0.58;
    vtext('HIGH SCORES', W / 2, ty, 14, 'text', 0.5);
    if (!hiScores.length) vtext('NO SCORES YET', W / 2, ty + 26, 11, 'dim', 0.5);
    hiScores.forEach(function (h, i) { var row = (i + 1) + '.  ' + String(h.s).padStart(7, ' ') + '   SECTOR ' + h.l; vtext(row, W / 2, ty + 26 + i * 20, 11, i ? 'dim' : 'text', 0.5); });
    // legend
    var ly = H * 0.86, lsz = narrow ? 9 : 10;
    var leg = K.isTouch ? 'ROTATE  THRUST  FIRE  SHIELD' : 'ARROWS ROTATE AND THRUST   SPACE FIRES   DOWN SHIELDS   P PAUSES   M MUTES';
    vtext(leg, W / 2, ly, fitSize(leg, lsz, W * 0.92), 'dim', 0.5, 0.85);
    var pts = 'ROCK 50-200   WEDGE 50-200   SAUCER 200 / 1000';
    vtext(pts, W / 2, ly + 22, fitSize(pts, lsz, W * 0.92), 'dim', 0.5, 0.6);
  }
  function render() {
    c.setTransform(1, 0, 0, 1, 0, 0);
    R.fade(fxOn ? 0.5 : 1);
    c.globalCompositeOperation = 'lighter';
    var sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
    c.setTransform(s, 0, 0, s, ox + sx * s, oy + sy * s);
    c.save(); c.beginPath(); c.rect(-2, -2, W + 4, H + 4); c.clip();
    G.rocks.forEach(function (r) { each(r, r.r + 4, function (x, y) { drawRock(r, x, y); }); });
    G.foes.forEach(function (f) { each(f, f.r + 4, function (x, y) { drawFoe(f, x, y); }); });
    if (G.ufo) { var u = G.ufo; each({ x: u.x, y: u.y }, u.r + 16, function (x, y) { if (Math.abs(x - u.x) < 1) drawUfo(u, x, y); }); }
    G.bullets.forEach(function (b) { drawBullet(b, false); }); G.ebullets.forEach(function (b) { drawBullet(b, true); });
    var sh = G.ship;
    if (G.state !== 'victory' && sh && !sh.dead && (sh.inv <= 0 || Math.sin(G.t * 26) > -0.3)) each(sh, 30, function (x, y) { drawShip(sh, x, y); if (sh.shieldOn) drawShield(sh, x, y); });
    drawParts();
    G.pops.forEach(function (p) { vtext(p.txt, p.x, p.y, p.size, 'gold', 0.5, Math.min(1, p.t * 2)); });
    c.restore();
    c.setTransform(s, 0, 0, s, ox, oy);
    if (G.state === 'title') drawTitle();
    else if (G.state !== 'splash') drawHud();
    if (G.msgT > 0 && (G.state === 'play' || G.state === 'clear')) { var al = Math.min(1, G.msgT * 1.5); drawCenter([[G.msg, 36, G.state === 'clear' ? 'gold' : 'text', 0, al], [G.msg2, 18, 'dim', 48, al]], H * 0.36); }
    if (G.tipT > 0 && G.state === 'play') vtext(G.tip, W / 2, H * 0.62, fitSize(G.tip, 13, W * 0.9), 'shield', 0.5, Math.min(1, G.tipT));
    if (G.state === 'play' && G.ship && G.ship.dead && G.lives > 0 && G.respawnT < 0) vtext('CLEARING SPAWN POINT', W / 2, H * 0.62, 12, 'dim', 0.5, 0.8);
    if (G.state === 'over') drawCenter([['GAME OVER', 46, 'wedge'], [G.newHi ? 'NEW HIGH SCORE' : 'SCORE ' + G.score, 18, G.newHi ? 'gold' : 'dim', 64]], H * 0.38);
    if (G.state === 'victory') {
      var acc = Math.round(100 * G.stats.hits / Math.max(1, G.stats.shots));
      drawCenter([['VICTORY', 60, 'gold'], ['ALL 12 SECTORS CLEARED', 20, 'text', 84], ['SCORE ' + G.score + '   ACCURACY ' + acc + '%', 14, 'dim', 124], ['SAUCERS ' + G.stats.ufos + '   WEDGES ' + G.stats.wedges, 14, 'dim', 152]], H * 0.26);
      if (G.stateT > 1.5 && (G.t % 1.2) < 0.8) { var vt = K.isTouch ? 'TAP TO CONTINUE' : 'PRESS ENTER TO CONTINUE'; vtext(vt, W / 2, H * 0.74, fitSize(vt, 16, W * 0.9), 'gold', 0.5); }
    }
    if (G.paused) {
      c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
      drawCenter([['PAUSED', 44, 'text'], [K.isTouch ? 'TAP RESUME TO PLAY' : 'PRESS P OR ESC TO RESUME', 14, 'dim', 62]], H * 0.4);
    }
    c.globalCompositeOperation = 'source-over';
    if (fxOn) R.present(function (v) { v.drawImage(bgCanvas, 0, 0); });
    else { var v = R.vis; v.globalCompositeOperation = 'source-over'; v.drawImage(bgCanvas, 0, 0); v.globalCompositeOperation = 'lighter'; v.drawImage(c.canvas, 0, 0); v.globalCompositeOperation = 'source-over'; }
  }
  function buildBg() {
    bgCanvas = document.createElement('canvas'); bgCanvas.width = R.w; bgCanvas.height = R.h;
    var b = bgCanvas.getContext('2d');
    b.fillStyle = '#000'; b.fillRect(0, 0, R.w, R.h);
    var g = b.createRadialGradient(R.w * 0.5, R.h * 0.45, 0, R.w * 0.5, R.h * 0.45, Math.max(R.w, R.h) * 0.75);
    g.addColorStop(0, '#050a18'); g.addColorStop(1, '#000'); b.fillStyle = g; b.fillRect(0, 0, R.w, R.h);
    [[0.22, 0.3, 'rgba(40,60,140,0.07)'], [0.78, 0.7, 'rgba(70,30,110,0.06)'], [0.6, 0.2, 'rgba(20,80,120,0.05)']].forEach(function (n) {
      var ng = b.createRadialGradient(R.w * n[0], R.h * n[1], 0, R.w * n[0], R.h * n[1], Math.max(R.w, R.h) * 0.35); ng.addColorStop(0, n[2]); ng.addColorStop(1, 'rgba(0,0,0,0)'); b.fillStyle = ng; b.fillRect(0, 0, R.w, R.h);
    });
    var n = Math.round(R.w * R.h / 5000);
    for (var i = 0; i < n; i++) { var r = Math.random(); b.fillStyle = r > 0.97 ? 'rgba(200,220,255,0.75)' : r > 0.8 ? 'rgba(150,180,240,0.4)' : 'rgba(120,140,200,0.22)'; var z = (r > 0.97 ? 1.6 : 1) * dpr * 0.7; b.fillRect(Math.random() * R.w, Math.random() * R.h, z, z); }
    // faint vignette and scanlines, like the glass of a vector monitor
    var vg = b.createRadialGradient(R.w / 2, R.h / 2, Math.min(R.w, R.h) * 0.4, R.w / 2, R.h / 2, Math.max(R.w, R.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    b.fillStyle = vg; b.fillRect(0, 0, R.w, R.h);
  }

  /* ---------------- layout ---------------- */
  var touchEl = document.getElementById('touch');
  function touchWanted() { return touchPref === 'on' || (touchPref === 'auto' && K.isTouch); }
  function resize() {
    var landscape = innerWidth > innerHeight;
    touchEl.hidden = !touchWanted(); touchEl.classList.toggle('landscape', landscape);
    document.body.classList.toggle('is-touch', touchWanted());
    var r = wrap.getBoundingClientRect(), cw = Math.max(200, r.width), ch = Math.max(160, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, fxOn ? 2 : 1.25);
    R.resize(Math.round(cw * dpr), Math.round(ch * dpr));
    var oldW = W, oldH = H;
    portrait = ch > cw; narrow = cw < 700;
    H = portrait ? K.clamp(ch * 1.02, 560, 700) : K.clamp(ch * 1.4, 520, 760); W = K.clamp(H * cw / ch, H * 0.5, H * 2.1);
    s = Math.min(R.w / W, R.h / H); ox = (R.w - W * s) / 2; oy = (R.h - H * s) / 2;
    lw = Math.max(1.1, 1.3 * dpr) / s;
    hk = K.clamp(0.9 / (s / dpr), 0.9, 1.7);
    hudTop = Math.max(14, (50 * dpr - oy) / s);
    if (oldW !== W || oldH !== H) [G.rocks, G.foes, G.bullets, G.ebullets].forEach(function (arr) { arr.forEach(function (o) { o.x = o.x * W / oldW; o.y = o.y * H / oldH; }); });
    if (G.ship) { G.ship.x *= W / oldW; G.ship.y *= H / oldH; }
    buildBg();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  window.addEventListener('jsp-banner-ready', resize);

  /* ---------------- UI wiring ---------------- */
  var pauseBtn = document.getElementById('btn-pause'), muteBtn = document.getElementById('btn-mute');
  function syncMute() {
    muteBtn.setAttribute('aria-pressed', A.muted ? 'true' : 'false');
    muteBtn.innerHTML = (A.muted ? '&#128263;' : '&#128266;') + ' <span class="lbl">' + (A.muted ? 'Sound off' : 'Sound on') + '</span>';
    muteBtn.setAttribute('aria-label', A.muted ? 'Unmute sound' : 'Mute sound');
    document.getElementById('opt-sound').checked = !A.muted;
  }
  A.listeners.push(syncMute);
  muteBtn.addEventListener('click', function () { A.toggle(); Music.resume(); canvas.focus(); });
  pauseBtn.addEventListener('click', function () { A.unlock(); setPaused(!G.paused); canvas.focus(); });
  document.getElementById('btn-full').addEventListener('click', function () {
    var d = document; if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { });
  });
  var settingsBody = document.getElementById('keys-body'), keysMsg = document.getElementById('keys-msg');
  var panel = K.settings({ input: I, body: settingsBody, actions: ACTIONS, msg: keysMsg });
  var wasPaused = false;
  function openSettings() { wasPaused = G.paused; setPaused(true); settingsEl.hidden = false; panel.render(); document.getElementById('settings-close').focus(); }
  function closeSettings() { settingsEl.hidden = true; if (!wasPaused) setPaused(false); canvas.focus(); }
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('keys-reset').addEventListener('click', function () { I.reset(); panel.render(); keysMsg.textContent = 'Defaults restored.'; });
  var optSound = document.getElementById('opt-sound'), optMusic = document.getElementById('opt-music'), optFx = document.getElementById('opt-fx'), optTouch = document.getElementById('opt-touch');
  optSound.addEventListener('change', function () { A.unlock(); A.setMuted(!optSound.checked); });
  optMusic.checked = Music.on; optMusic.addEventListener('change', function () { A.unlock(); Music.setOn(optMusic.checked); Music.resume(); });
  optFx.checked = fxOn; optFx.addEventListener('change', function () { fxOn = optFx.checked; K.store.set('ad.fx', fxOn); resize(); });
  optTouch.value = touchPref; optTouch.addEventListener('change', function () { touchPref = optTouch.value; K.store.set('ad.touch', touchPref); resize(); });
  K.bindTouch(touchEl, I, function () { A.unlock(); });
  canvas.addEventListener('pointerdown', function (e) {
    A.unlock(); canvas.focus();
    if (G.state === 'title') startGame();
    else if (G.state === 'victory' && G.stateT > 1.5) showSplash(true, true);
    else if (G.paused) setPaused(false);
    e.preventDefault();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && (G.state === 'play' || G.state === 'clear')) setPaused(true); });
  syncMute();

  /* ---------------- shared overlay: Resume / Play again + Main menu on pause, game over and victory ---------------- */
  var ov = window.ArcadeOverlay ? window.ArcadeOverlay.mount(wrap) : null;
  function syncOverlay(splash) {
    if (!ov) return;
    if (splash || !settingsEl.hidden) ov.hide();
    else if (G.paused) ov.show({ primary: { label: '\u25B6 Resume', onClick: function () { setPaused(false); canvas.focus(); } } });
    else if (G.state === 'over' && G.stateT > 0.8) ov.show({ primary: { label: '\u21BB Play again', onClick: function () { showSplash(true); } } });
    else if (G.state === 'victory' && G.stateT > 1.5) ov.show({ primary: { label: '\u21BB Play again', onClick: function () { showSplash(true, true); } } });
    else ov.hide();
  }

  /* ---------------- main loop ---------------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    I.pollPad();
    if (I.hit('mute')) { A.toggle(); Music.resume(); }
    if (I.hit('pause')) setPaused(!G.paused);
    var splash = window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen();
    if (!G.paused && !splash && settingsEl.hidden) { var n = dt > 0.02 ? 2 : 1; for (var i = 0; i < n; i++) update(dt / n); }
    else if (splash || !settingsEl.hidden) I.clear();
    syncOverlay(splash);
    render();
    requestAnimationFrame(frame);
  }
  resize(); toTitle();
  requestAnimationFrame(frame);

  window.ADGame = { version: 1, levels: LEVELS.length };
  if (DEBUG) {
    window.ADGame.debug = {
      G: G, sfx: Sfx, music: Music,
      start: function (n) { if (G.state === 'title') startGame(); if (n) startLevel(n); },
      clearSector: function () { G.rocks = []; G.foes = []; G.starsLeft = 0; G.ufo = null; },
      god: function (on) { G.god = on !== false; },
      kill: function (all) { G.god = false; if (all) G.lives = 1; if (G.ship) { G.ship.inv = 0; G.ship.dead = false; } killShip(); },
      star: function () { spawnStar(); }, ufo: function (small) { spawnUfo(); if (small != null) { G.ufo.big = !small; G.ufo.r = small ? 12 : 22; } },
      state: function () { return { state: G.state, level: G.level, score: G.score, lives: G.lives, rocks: G.rocks.length, foes: G.foes.length, ufo: !!G.ufo, paused: G.paused, music: Music.name, muted: A.muted, W: W, H: H }; }
    };
  }
})();

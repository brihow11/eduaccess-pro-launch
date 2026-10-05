/* Battlezone tribute: a real 3D wireframe tank battle seen through a periscope. Perspective-projected
   vector models, radar sweep, volcano-and-mountain horizon, 12 levels of tanks, supertanks, missiles
   and saucers. Original code, art, sound and music, built from scratch. Written by: Howie */
(function () {
  'use strict';
  var K = window.VKit, DEBUG = K.DEBUG, TAU = Math.PI * 2;
  var canvas = document.getElementById('game'), wrap = document.getElementById('wrap');
  var R = K.glow(canvas, { b1: 0.5, b2: 0.7, b3: 0.85 }), c = R.ctx;
  var fxOn = K.store.get('bz.fx', true), touchPref = K.store.get('bz.touch', 'auto');
  var hk = 1, W = 1280, H = 800, s = 1, ox = 0, oy = 0, dpr = 1, lw = 1.5, hudTop = 14, narrow = false, portrait = false, bgCanvas = null;
  var F = 600, HY = 460, CX = 640, FOV = 1.05;

  /* ---------------- input ---------------- */
  var ACTIONS = [
    { id: 'fwd', label: 'Drive forward', keys: ['ArrowUp', 'KeyW'] },
    { id: 'back', label: 'Reverse', keys: ['ArrowDown', 'KeyS'] },
    { id: 'left', label: 'Turn left', keys: ['ArrowLeft', 'KeyA'] },
    { id: 'right', label: 'Turn right', keys: ['ArrowRight', 'KeyD'] },
    { id: 'fire', label: 'Fire', keys: ['Space', 'KeyJ'] },
    { id: 'pause', label: 'Pause', keys: ['KeyP', 'Escape'] },
    { id: 'mute', label: 'Mute / unmute', keys: ['KeyM', null] },
    { id: 'start', label: 'Start / continue', keys: ['Enter', null] }
  ];
  var settingsEl = document.getElementById('settings');
  var I = K.input({
    actions: ACTIONS, storeKey: 'bz.keys',
    onKey: function (e) {
      A.unlock();
      if (!settingsEl.hidden) { if (e.code === 'Escape') closeSettings(); return false; }
    },
    pad: function (gp) {
      var ax = gp.axes || [], b = gp.buttons || [];
      function p(i) { return !!(b[i] && (b[i].pressed || b[i].value > 0.5)); }
      return { left: ax[0] < -0.45 || p(14), right: ax[0] > 0.45 || p(15), fwd: ax[1] < -0.45 || p(12), back: ax[1] > 0.45 || p(13),
        fire: p(0) || p(2) || p(7) || p(5), pause: p(9), start: p(9) || p(3) };
    }
  });

  /* ---------------- audio: effects ---------------- */
  var A = K.audio('bz.muted', 0.7);
  var engineL = A.loop(function (ctx, L) {
    var src = ctx.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 2;
    var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 34; og.gain.value = 0.35;
    var o2 = ctx.createOscillator(), og2 = ctx.createGain(); o2.type = 'square'; o2.frequency.value = 17.5; og2.gain.value = 0.2;
    var trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 11; lg.gain.value = 0.3; trem.gain.value = 0.7;
    lfo.connect(lg); lg.connect(trem.gain);
    src.connect(f); o.connect(og); og.connect(f); o2.connect(og2); og2.connect(f); f.connect(trem); trem.connect(L.g); L.g.connect(A.out(0, 0.1));
    src.start(); o.start(); o2.start(); lfo.start(); L.o = o; L.o2 = o2; L.f = f; L.lfo = lfo;
  });
  function engineRev(k) { if (engineL.o && A.ctx) { var t = A.ctx.currentTime; engineL.o.frequency.setTargetAtTime(34 + 26 * k, t, 0.15); engineL.o2.frequency.setTargetAtTime(17.5 + 13 * k, t, 0.15); engineL.f.frequency.setTargetAtTime(220 + 260 * k, t, 0.15); engineL.lfo.frequency.setTargetAtTime(11 + 10 * k, t, 0.2); } }
  var missileL = A.loop(function (ctx, L) {
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900;
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 240; lfo.connect(lg); lg.connect(o.frequency);
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
    o.connect(f); f.connect(L.g); L.g.connect(A.out(0, 0.35)); o.start(); lfo.start();
  });
  var saucerL = A.loop(function (ctx, L) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = 520; o2.frequency.value = 783;
    var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 3.3; lg.gain.value = 140; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    var g2 = ctx.createGain(); g2.gain.value = 0.5; o.connect(L.g); o2.connect(g2); g2.connect(L.g); L.g.connect(A.out(0, 0.6)); o.start(); o2.start(); lfo.start();
  });
  function panOfRel(x, z) { return K.clamp(Math.atan2(x, Math.max(1, z)) / 1.2, -1, 1) * 0.8; }
  var lastBlock = 0;
  var Sfx = {
    fire: function () {
      A.noise({ f: 2400, to: 90, dur: 0.55, gain: 0.34, send: 0.35 });
      A.tone({ type: 'square', f: 240, to: 48, dur: 0.32, gain: 0.14, lp: 1400, send: 0.3 });
      A.tone({ type: 'sine', f: 110, to: 32, dur: 0.4, gain: 0.3 });
    },
    enemyFire: function (pan, far) { var k = K.clamp(1 - far / 900, 0.25, 1); A.noise({ f: 1500, to: 120, dur: 0.45, gain: 0.22 * k, pan: pan, send: 0.6 }); A.tone({ type: 'square', f: 180, to: 60, dur: 0.25, gain: 0.08 * k, lp: 900, pan: pan, send: 0.5 }); },
    boom: function (pan, big) {
      var k = big ? 1.4 : 1;
      A.noise({ f: 3200, to: 50, dur: 0.9 * k, gain: 0.42, pan: pan, send: 0.7 });
      A.noise({ ftype: 'bandpass', f: 900, to: 120, dur: 1.4 * k, gain: 0.18, q: 0.8, pan: pan, send: 0.8, delay: 0.05 });
      A.tone({ type: 'sine', f: 90, to: 22, dur: 1.0 * k, gain: 0.4, pan: pan, send: 0.3 });
    },
    small: function (pan) { A.noise({ ftype: 'bandpass', f: 2600, to: 600, dur: 0.18, gain: 0.12, q: 1.2, pan: pan }); },
    crack: function () {
      A.noise({ ftype: 'highpass', f: 5200, to: 1600, dur: 0.9, gain: 0.32, send: 0.6 });
      for (var i = 0; i < 9; i++) A.tone({ type: 'sine', f: K.rand(2200, 6200), dur: K.rand(0.15, 0.5), gain: 0.05, delay: K.rand(0, 0.5), send: 0.8, pan: K.rand(-0.8, 0.8) });
      A.noise({ f: 900, to: 30, dur: 2.2, gain: 0.4, send: 0.8 });
      A.tone({ type: 'sawtooth', f: 160, to: 25, dur: 1.6, gain: 0.14, lp: 700, send: 0.6 });
    },
    ping: function (pan) { A.tone({ type: 'sine', f: 1320, to: 1250, dur: 0.12, gain: 0.035, pan: pan, send: 0.7 }); },
    alert: function () { A.tone({ type: 'square', f: 880, dur: 0.1, gain: 0.05, lp: 2400 }); A.tone({ type: 'square', f: 660, dur: 0.14, gain: 0.05, lp: 2400, delay: 0.13 }); },
    blocked: function () { if (G.t - lastBlock < 0.6) return; lastBlock = G.t; A.tone({ type: 'sawtooth', f: 70, dur: 0.18, gain: 0.12, lp: 300 }); A.noise({ f: 400, to: 80, dur: 0.15, gain: 0.12 }); },
    life: function () { [0, 5, 7, 12].forEach(function (n, i) { A.tone({ type: 'triangle', f: K.freq(69 + n), dur: 0.35, gain: 0.12, delay: i * 0.09, send: 0.6 }); }); },
    start: function () { A.noise({ f: 120, to: 2400, dur: 0.8, gain: 0.12, ftype: 'bandpass', q: 3, send: 0.6 }); A.tone({ type: 'sawtooth', f: 55, to: 220, dur: 0.8, gain: 0.1, lp: 1200, send: 0.6 }); }
  };

  /* ---------------- audio: soundtrack ---------------- */
  function rep(str, n) { var a = []; for (var i = 0; i < n; i++) a.push(str); return a.join(' '); }
  function hold(ch, n) { return ch + ' ' + rep('-', n - 1); }
  var SONGS = {
    // title: a grim, slow armored march in D minor
    title: { bpm: 88, len: 64, loop: true, tracks: [
      { inst: 'bass', vel: 0.85, p: 'd1 - . d1 d1 . . . d1 - . d1 c1 . . . a#0 - . a#0 a#0 . . . a#0 - . a#0 c1 . . . g0 - . g0 g0 . . . g0 - . g0 a0 . . . a0 - . a0 a0 . . . a0 - . c#1 e1 . . .' },
      { inst: 'pad', vel: 0.75, p: hold('d3+f3+a3', 16) + ' ' + hold('a#2+d3+f3', 16) + ' ' + hold('g2+a#2+d3', 16) + ' ' + hold('a2+c#3+e3', 16) },
      { inst: 'lead', vel: 0.7, p: 'd4 - - - - - a4 - - - g4 - f4 - e4 - f4 - - - - - - - d4 - - - - - - - g4 - - - a#4 - - - a4 - g4 - f4 - g4 - a4 - - - - - - - - - - - c#5 - e5 -' },
      { inst: 'kick', vel: 0.85, p: 'c1 . . . . . . . c1 . . c1 . . . .' },
      { inst: 'snare', vel: 0.45, p: '. . . . c1 . . . . . . . c1 . c1 .' },
      { inst: 'hat', vel: 0.4, p: 'c1 . c1 . c1 . c1 . c1 . c1 . c1 . c1 c1' }
    ] },
    // in-game: a low engine-room drone with a war-drum pulse; it speeds up as the quota nears
    game: { bpm: 76, len: 64, loop: true, tracks: [
      { inst: 'thump', vel: 0.8, p: 'd1 . . d1 . . . . d1 . . d1 . . c1 .' },
      { inst: 'pad', vel: 0.4, p: hold('d2+a2', 32) + ' ' + hold('a#1+f2', 16) + ' ' + hold('c2+g2', 16) },
      { inst: 'bass', vel: 0.35, p: 'd1 . . . . . . . . . . . . . . . d1 . . . . . . . . . . . c1 . . . a#0 . . . . . . . . . . . . . . . c1 . . . . . . . . . . . . . . .' },
      { inst: 'pluck', vel: 0.18, p: '. . . . . . . . . . . . a4 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . f4 . . . . . . . . . . . . . . . . . g4 . .' }
    ] },
    clear: { bpm: 120, len: 16, loop: false, tracks: [
      { inst: 'bell', vel: 0.9, p: 'd5 f5 a5 d6 - - - - a5 - d6 - - - - -' },
      { inst: 'pad', vel: 0.7, p: hold('d3+f3+a3', 16) },
      { inst: 'kick', vel: 0.6, p: 'c1 . . . . . . . c1 . . . . . . .' }
    ] },
    victory: { bpm: 104, len: 48, loop: false, then: 'title', tracks: [
      { inst: 'lead', vel: 0.8, p: 'd5 - - - a4 - d5 - f#5 - - - - - - - e5 - - - d5 - c5 - d5 - - - - - - - a5 - - - g5 - f#5 - e5 - - - d5 - - - - - - - - - - - - - - - - -' },
      { inst: 'bell', vel: 0.6, p: 'd5 . a5 . d6 . . . . . . . . . . .' },
      { inst: 'pad', vel: 0.9, p: hold('d3+f#3+a3', 16) + ' ' + hold('c3+e3+g3', 8) + ' ' + hold('a#2+d3+f3', 8) + ' ' + hold('d3+f#3+a3+d4', 16) },
      { inst: 'bass', vel: 0.8, p: 'd1 - - - - - - - d1 - - - a0 - - - c1 - - - - - - - a#0 - - - - - - - d1 - - - - - - - - - - - - - - -' },
      { inst: 'kick', vel: 0.8, p: 'c1 . . . c1 . . . c1 . . . c1 . c1 c1 c1 . . . c1 . . . c1 . . . c1 c1 c1 c1 c1 . . . . . . . . . . . . . . .' },
      { inst: 'snare', vel: 0.5, p: '. . . . c1 . . . . . . . c1 . . . . . . . c1 . . . . . . . c1 c1 c1 c1 . . . . . . . . . . . . . . . .' }
    ] },
    over: { bpm: 66, len: 24, loop: false, tracks: [
      { inst: 'lead', vel: 0.7, p: 'a4 - g4 - f4 - - - e4 - - - d4 - - - - - - - - - - -' },
      { inst: 'pad', vel: 0.8, p: hold('d3+f3+a3', 8) + ' ' + hold('a#2+d3+f3', 8) + ' ' + hold('a2+c#3+e3', 8) },
      { inst: 'bass', vel: 0.8, p: 'd1 - - - - - - - a#0 - - - - - - - a0 - - - - - - -' }
    ] }
  };
  var Music = K.music(A, SONGS, { storeKey: 'bz.music', vol: 0.3 });
  A.onReady = function () { Music.resume(); };
  window.addEventListener('pointerdown', function () { A.unlock(); }, true);

  /* ---------------- levels ---------------- */
  var LEVELS = [
    { name: 'FIRST CONTACT', quota: 3, tanks: 1, superP: 0, missile: 0, saucer: 0, fire: 3.4, aim: 0.3, spd: 0.8, obst: 26, layout: 'scatter' },
    { name: 'OPEN PLAIN', quota: 4, tanks: 1, superP: 0, missile: 0, saucer: 0.35, fire: 3.0, aim: 0.4, spd: 0.88, obst: 14, layout: 'sparse' },
    { name: 'BLOCK FIELD', quota: 4, tanks: 1, superP: 0.15, missile: 0, saucer: 0.3, fire: 2.8, aim: 0.45, spd: 0.92, obst: 44, layout: 'rows' },
    { name: 'MISSILE ALERT', quota: 5, tanks: 1, superP: 0.1, missile: 26, saucer: 0.25, fire: 2.7, aim: 0.5, spd: 0.95, obst: 30, layout: 'scatter' },
    { name: 'TWIN THREAT', quota: 6, tanks: 2, superP: 0.15, missile: 0, saucer: 0.3, fire: 2.6, aim: 0.5, spd: 1.0, obst: 34, layout: 'ring' },
    { name: 'SUPERTANK RIDGE', quota: 5, tanks: 1, superP: 0.65, missile: 30, saucer: 0.25, fire: 2.3, aim: 0.6, spd: 1.02, obst: 30, layout: 'pyramids' },
    { name: 'NIGHT CROSSING', quota: 6, tanks: 2, superP: 0.3, missile: 22, saucer: 0.4, fire: 2.2, aim: 0.6, spd: 1.06, obst: 22, layout: 'sparse' },
    { name: 'PYRAMID VALLEY', quota: 7, tanks: 2, superP: 0.35, missile: 20, saucer: 0.3, fire: 2.1, aim: 0.65, spd: 1.1, obst: 52, layout: 'pyramids' },
    { name: 'IRON TIDE', quota: 8, tanks: 2, superP: 0.45, missile: 18, saucer: 0.3, fire: 2.0, aim: 0.7, spd: 1.12, obst: 40, layout: 'maze' },
    { name: 'SAUCER SKIES', quota: 8, tanks: 3, superP: 0.4, missile: 16, saucer: 0.8, fire: 1.9, aim: 0.72, spd: 1.15, obst: 34, layout: 'ring' },
    { name: 'CRATER STORM', quota: 9, tanks: 3, superP: 0.5, missile: 14, saucer: 0.4, fire: 1.75, aim: 0.78, spd: 1.2, obst: 46, layout: 'rows' },
    { name: 'LAST STAND', quota: 10, tanks: 3, superP: 0.65, missile: 11, saucer: 0.5, fire: 1.6, aim: 0.85, spd: 1.26, obst: 44, layout: 'maze' }
  ];
  var PTS = { tank: 1000, super: 3000, missile: 2000, saucer: 5000 };
  var S = 2400, EYE = 2.5, NEAR = 0.7, RADAR_RANGE = 1100;

  /* ---------------- 3D models (local: x right, y up, z forward) ---------------- */
  function Model() { return { v: [], e: [] }; }
  function vtx(m, x, y, z) { m.v.push([x, y, z]); return m.v.length - 1; }
  function loop(m, pts, closed) { var idx = pts.map(function (p) { return vtx(m, p[0], p[1], p[2]); }); for (var i = 0; i < idx.length - 1; i++) m.e.push([idx[i], idx[i + 1]]); if (closed) m.e.push([idx[idx.length - 1], idx[0]]); return idx; }
  function ring(m, y, x0, x1, z0, z1) { return loop(m, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true); }
  function join(m, a, b) { for (var i = 0; i < a.length; i++) m.e.push([a[i], b[i]]); }
  function box(m, x0, x1, y0, y1, z0, z1) { join(m, ring(m, y0, x0, x1, z0, z1), ring(m, y1, x0, x1, z0, z1)); }
  function circle(m, cx, cy, cz, r, n, axis) {
    var pts = []; for (var i = 0; i < n; i++) { var a = i / n * TAU, u = Math.cos(a) * r, w = Math.sin(a) * r; pts.push(axis === 'z' ? [cx + u, cy + w, cz] : [cx + u, cy, cz + w]); }
    return loop(m, pts, true);
  }
  var MODELS = {};
  (function build() {
    var m = Model(); // battle tank: faceted hull, sloped turret, long gun (radar dish is added live)
    var a = ring(m, 0.15, -2.3, 2.3, -3.1, 3.2), b = ring(m, 0.95, -2.75, 2.75, -3.9, 4.7), cc = ring(m, 1.45, -2.25, 2.25, -3.3, 3.3);
    join(m, a, b); join(m, b, cc);
    var t0 = ring(m, 1.45, -1.55, 1.55, -2.4, 1.1), t1 = ring(m, 2.45, -1.05, 1.05, -1.9, 0.3); join(m, t0, t1);
    box(m, -0.2, 0.2, 1.75, 2.05, 0.7, 5.2); loop(m, [[-0.32, 1.65, 5.2], [0.32, 1.65, 5.2], [0.32, 2.15, 5.2], [-0.32, 2.15, 5.2]], true);
    loop(m, [[-2.75, 0.95, -1.3], [-2.3, 0.15, -1.3]]); loop(m, [[2.75, 0.95, -1.3], [2.3, 0.15, -1.3]]); loop(m, [[-2.75, 0.95, 1.6], [-2.3, 0.15, 1.6]]); loop(m, [[2.75, 0.95, 1.6], [2.3, 0.15, 1.6]]);
    loop(m, [[0, 2.45, -1.3], [0, 3.0, -1.3]]);
    MODELS.tank = m;
    m = Model(); // supertank: low, long, wedge nose, slit turret, heavier gun
    a = ring(m, 0.15, -2.2, 2.2, -3.6, 3.0); b = loop(m, [[-2.6, 0.85, -4.2], [2.6, 0.85, -4.2], [2.6, 0.85, 3.6], [0, 0.85, 6.0], [-2.6, 0.85, 3.6]], true);
    cc = loop(m, [[-2.0, 1.3, -3.6], [2.0, 1.3, -3.6], [2.0, 1.3, 2.8], [0, 1.3, 4.0], [-2.0, 1.3, 2.8]], true);
    m.e.push([a[0], b[0]], [a[1], b[1]], [a[2], b[2]], [a[3], b[4]], [a[2], b[3]], [a[3], b[3]]); join(m, b, cc);
    t0 = ring(m, 1.3, -1.45, 1.45, -2.8, 0.9); t1 = ring(m, 2.05, -0.9, 0.9, -2.3, -0.3); join(m, t0, t1);
    box(m, -0.26, 0.26, 1.5, 1.85, 0.5, 6.4); loop(m, [[-1.45, 1.3, -2.8], [-2.0, 1.3, -3.6]]); loop(m, [[-0.9, 1.7, -2.3], [0.9, 1.7, -2.3]]);
    MODELS.super = m;
    m = Model(); // cruise missile
    var r0 = circle(m, 0, 0, 1.6, 0.65, 8, 'z'), r1 = circle(m, 0, 0, -3.2, 0.65, 8, 'z'); join(m, r0, r1);
    var nose = vtx(m, 0, 0, 4.4); r0.forEach(function (i) { m.e.push([i, nose]); });
    loop(m, [[0, 0.65, -1.6], [0, 1.9, -3.4], [0, 0.65, -3.2]]); loop(m, [[0, -0.65, -1.6], [0, -1.9, -3.4], [0, -0.65, -3.2]]);
    loop(m, [[0.65, 0, -1.6], [1.9, 0, -3.4], [0.65, 0, -3.2]]); loop(m, [[-0.65, 0, -1.6], [-1.9, 0, -3.4], [-0.65, 0, -3.2]]);
    MODELS.missile = m;
    m = Model(); // saucer
    var rim = circle(m, 0, 0, 0, 3.4, 12), top = circle(m, 0, 1.0, 0, 1.4, 12), bot = circle(m, 0, -0.7, 0, 1.6, 12);
    for (var i = 0; i < 12; i += 2) { m.e.push([rim[i], top[i]], [rim[i], bot[i]]); }
    var ap = vtx(m, 0, 1.6, 0); for (i = 0; i < 12; i += 3) m.e.push([top[i], ap]);
    MODELS.saucer = m;
    m = Model(); box(m, -4, 4, 0, 7.5, -4, 4); MODELS.cube = m;
    m = Model(); box(m, -5.5, 5.5, 0, 4.5, -5.5, 5.5); loop(m, [[-5.5, 4.5, -5.5], [5.5, 4.5, 5.5]]); MODELS.slab = m;
    m = Model(); var base = ring(m, 0, -4.5, 4.5, -4.5, 4.5), apx = vtx(m, 0, 9, 0); base.forEach(function (i) { m.e.push([i, apx]); }); MODELS.pyramid = m;
    m = Model(); base = ring(m, 0, -3, 3, -3, 3); apx = vtx(m, 0, 14, 0); base.forEach(function (i) { m.e.push([i, apx]); }); MODELS.spire = m;
    m = Model(); loop(m, [[0, 0.5, 0], [0.5, 0, 0], [0, -0.5, 0], [-0.5, 0, 0]], true);
    var tip = vtx(m, 0, 0, 1.3), tail = vtx(m, 0, 0, -0.9); [0, 1, 2, 3].forEach(function (i) { m.e.push([i, tip], [i, tail]); }); MODELS.shell = m;
  })();
  var OBST_R = { cube: 5.4, slab: 7.2, pyramid: 5.6, spire: 4 };

  /* ---------------- state ---------------- */
  var G = { state: 'title', level: 1, score: 0, lives: 3, nextLife: 25000, t: 0, paused: false, foes: [], shells: [], obst: [], debris: [], sparks: [], specks: [], lava: [],
    P: { x: 0, z: 0, a: 0, v: 0 }, kills: 0, spawnT: 0, missileT: 0, saucerT: 0, msg: '', msg2: '', msgT: 0, shake: 0, recoil: 0, stateT: 0, dead: false, deadT: 0, cracks: [], crackAt: [0, 0],
    blockedT: 0, sweep: 0, god: false, tip: '', tipT: 0, stats: { shots: 0, hits: 0, tanks: 0, supers: 0, missiles: 0, saucers: 0 }, newHi: false, fireCd: 0, pop: null };
  var hiScores = K.store.get('bz.hiscores', []);
  function best() { return hiScores.length ? hiScores[0].s : 0; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function wrapd(d) { return d - S * Math.round(d / S); }
  function wrapA(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function rel(o) { return { x: wrapd(o.x - G.P.x), z: wrapd(o.z - G.P.z) }; }
  function dist(a, b) { return Math.hypot(wrapd(a.x - b.x), wrapd(a.z - b.z)); }
  function bearing(from, to) { return Math.atan2(wrapd(to.x - from.x), wrapd(to.z - from.z)); }
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function buildField(L, n) {
    var r = seeded(n * 7919 + 13), out = [], kinds = L.layout === 'pyramids' ? ['pyramid', 'pyramid', 'spire', 'cube'] : ['cube', 'pyramid', 'slab', 'cube', 'pyramid', 'spire'];
    function add(x, z, k) {
      if (Math.hypot(wrapd(x), wrapd(z)) < 45) return;
      k = k || kinds[(r() * kinds.length) | 0];
      for (var i = 0; i < out.length; i++) if (dist(out[i], { x: x, z: z }) < OBST_R[out[i].k] + OBST_R[k] + 14) return;
      out.push({ x: x, z: z, k: k, a: r() * TAU, r: OBST_R[k] });
    }
    var N = L.obst, i, j;
    if (L.layout === 'rows') { for (i = 0; i < N; i++) { var row = (i % 6) - 2.5, col = Math.floor(i / 6); add(row * 140 + r() * 30, (col - N / 12) * 150 + r() * 40, i % 3 ? 'cube' : 'slab'); } for (i = 0; i < N / 3; i++) add(r() * S, r() * S); }
    else if (L.layout === 'ring') { for (i = 0; i < N; i++) { var a = i / N * TAU, rr = (i % 2 ? 220 : 420) + r() * 60; add(Math.sin(a) * rr, Math.cos(a) * rr); } for (i = 0; i < N / 2; i++) add(r() * S, r() * S); }
    else if (L.layout === 'maze') { for (i = 0; i < 8; i++) for (j = 0; j < 8; j++) if (r() < N / 90) add((i - 3.5) * 110 + r() * 20, (j - 3.5) * 110 + r() * 20, r() < 0.6 ? 'cube' : 'slab'); for (i = 0; i < N / 2; i++) add(r() * S, r() * S); }
    else { var near = L.layout === 'sparse' ? 0.4 : 0.7; for (i = 0; i < N; i++) { if (r() < near) add(r() * 1100 - 550, r() * 1100 - 550); else add(r() * S, r() * S); } }
    return out;
  }
  function buildSpecks(n) { var r = seeded(n * 31 + 5), out = []; for (var i = 0; i < 260; i++) out.push({ x: r() * S, z: r() * S }); return out; }

  // horizon panorama: jagged far mountains plus the volcano, as elevation (radians) by azimuth
  var VOLC = { az: 0.55 };
  var MOUNT = (function () {
    var r = seeded(42), pts = [], n = 180;
    for (var i = 0; i <= n; i++) {
      var az = i / n * TAU, e = 0.012 + 0.018 * Math.abs(Math.sin(az * 3 + 1)) + 0.03 * Math.pow(Math.abs(Math.sin(az * 1.5 + 0.4)), 3) + r() * 0.006;
      if (i % 9 === 4) e += 0.028 * r();
      var dv = wrapA(az - VOLC.az); if (Math.abs(dv) < 0.2) e = Math.max(e, 0.13 - Math.abs(dv) * 0.55);
      if (Math.abs(dv) < 0.035) e = 0.11 + Math.abs(dv) * 0.3;
      pts.push([az, e]);
    }
    return pts;
  })();

  function isBlocked(x, z, r, self) {
    for (var i = 0; i < G.obst.length; i++) { var o = G.obst[i]; if (Math.hypot(wrapd(o.x - x), wrapd(o.z - z)) < o.r + r) return o; }
    for (i = 0; i < G.foes.length; i++) { var f = G.foes[i]; if (f === self || f.k === 'saucer' || f.k === 'missile') continue; if (Math.hypot(wrapd(f.x - x), wrapd(f.z - z)) < 4.6 + r) return f; }
    return null;
  }

  function startGame() {
    G.score = 0; G.lives = 3; G.nextLife = 25000; G.stats = { shots: 0, hits: 0, tanks: 0, supers: 0, missiles: 0, saucers: 0 }; G.newHi = false;
    Sfx.start(); startLevel(1);
  }
  function startLevel(n) {
    G.level = n; var L = LEVELS[n - 1];
    G.state = 'play'; G.stateT = 0; G.foes = []; G.shells = []; G.debris = []; G.sparks = []; G.kills = 0; G.dead = false; G.cracks = [];
    G.P = { x: 0, z: 0, a: 0, v: 0 }; G.obst = buildField(L, n); G.specks = buildSpecks(n);
    G.spawnT = 2.5; G.missileT = L.missile ? L.missile * 0.6 : 0; G.saucerT = rnd(14, 26);
    G.msg = 'LEVEL ' + n; G.msg2 = L.name; G.msgT = 2.8;
    if (n === 1 && !K.store.get('bz.tipSeen', false)) { G.tip = K.isTouch ? 'WATCH THE RADAR - TURN TO FACE THE RED BLIP' : 'WATCH THE RADAR - TURN UNTIL THE ENEMY IS IN YOUR SIGHTS'; G.tipT = 7; K.store.set('bz.tipSeen', true); }
    I.clear(); Music.play('game', true);
  }
  function addScore(p) {
    if (G.state !== 'play' && G.state !== 'clear') return;
    G.score += p;
    if (G.score >= G.nextLife) { G.nextLife += 25000; if (G.lives < 6) { G.lives++; Sfx.life(); G.msg = 'BONUS TANK'; G.msg2 = ''; G.msgT = 1.8; } }
  }

  /* ---------------- enemies ---------------- */
  function spawnPoint(minD, maxD) {
    for (var t = 0; t < 40; t++) { var a = rnd(0, TAU), d = rnd(minD, maxD), x = G.P.x + Math.sin(a) * d, z = G.P.z + Math.cos(a) * d; if (!isBlocked(x, z, 8)) return { x: x, z: z }; }
    return { x: G.P.x + minD, z: G.P.z };
  }
  function spawnTank() {
    var L = LEVELS[G.level - 1], sup = Math.random() < L.superP, p = spawnPoint(420, 820);
    G.foes.push({ k: sup ? 'super' : 'tank', x: p.x, z: p.z, a: bearing(p, G.P) + rnd(-1.2, 1.2), cd: rnd(3, 5), mode: 'approach', modeT: rnd(2, 4), off: rnd(-0.5, 0.5), radar: 0, ping: 0, r: 4.6, dir: 1 });
    Sfx.alert();
  }
  function spawnMissile() { var p = spawnPoint(650, 800); G.foes.push({ k: 'missile', x: p.x, z: p.z, a: bearing(p, G.P), y: 1.2, vy: 0, ph: rnd(0, TAU), ping: 0, r: 3.6 }); Sfx.alert(); }
  function spawnSaucer() { var p = spawnPoint(180, 420); G.foes.push({ k: 'saucer', x: p.x, z: p.z, y: 5.5, a: 0, vx: rnd(-14, 14), vz: rnd(-14, 14), life: 18, ping: 0, r: 4.2, turnT: 2 }); }
  function enemyCount() { var n = 0; G.foes.forEach(function (f) { if (f.k === 'tank' || f.k === 'super') n++; }); return n; }

  function fireShell(from, a, enemy) {
    var sp = enemy ? 150 : 270, nx = Math.sin(a), nz = Math.cos(a), off = enemy ? 6 : 3;
    G.shells.push({ x: from.x + nx * off, z: from.z + nz * off, y: 1.9, vx: nx * sp, vz: nz * sp, a: a, t: enemy ? 4.2 : 2.3, enemy: enemy });
  }
  function playerFire() {
    if (G.dead || G.fireCd > 0) return;
    for (var i = 0; i < G.shells.length; i++) if (!G.shells[i].enemy) return; // one shell in flight, as on the cabinet
    fireShell(G.P, G.P.a, false); G.fireCd = 0.25; G.recoil = 1; G.stats.shots++; Sfx.fire();
  }

  function burst(x, y, z, n, sp, col) { for (var i = 0; i < n && G.sparks.length < 600; i++) { var a = rnd(0, TAU), e = rnd(-0.3, 1.2), v = rnd(0.3, 1) * sp; G.sparks.push({ x: x, y: y, z: z, vx: Math.cos(a) * Math.cos(e) * v, vy: Math.sin(e) * v, vz: Math.sin(a) * Math.cos(e) * v, t: rnd(0.4, 1.1), m: 1.1, col: col }); } }
  function shatter(f) {
    var m = MODELS[f.k], ca = Math.cos(f.a), sa = Math.sin(f.a), y0 = f.y || 0;
    var step = Math.max(1, Math.floor(m.e.length / 22));
    for (var i = 0; i < m.e.length; i += step) {
      var p = m.v[m.e[i][0]], q = m.v[m.e[i][1]], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, mz = (p[2] + q[2]) / 2;
      var wx = mx * ca + mz * sa, wz = -mx * sa + mz * ca, hx = (q[0] - p[0]) / 2, hy = (q[1] - p[1]) / 2, hz = (q[2] - p[2]) / 2;
      var out = Math.hypot(wx, wz) || 1;
      G.debris.push({ x: f.x + wx, y: y0 + my, z: f.z + wz, hx: hx * ca + hz * sa, hy: hy, hz: -hx * sa + hz * ca, vx: wx / out * rnd(6, 22), vy: rnd(10, 26), vz: wz / out * rnd(6, 22), spin: rnd(-6, 6), t: rnd(1.8, 2.8) });
    }
    burst(f.x, y0 + 1.5, f.z, 60, 30, 'lava'); burst(f.x, y0 + 1.5, f.z, 30, 18, 'green');
  }
  function camOf(o) { var r = rel(o), ca = Math.cos(G.P.a), sa = Math.sin(G.P.a); return [r.x * ca - r.z * sa, r.x * sa + r.z * ca]; }
  function killFoe(i, byPlayer) {
    var f = G.foes[i], q = camOf(f);
    G.foes.splice(i, 1); shatter(f); Sfx.boom(panOfRel(q[0], q[1]), f.k === 'super');
    if (byPlayer) {
      addScore(PTS[f.k]); G.stats.hits++;
      if (f.k === 'tank' || f.k === 'super') { G.kills++; G.spawnT = rnd(2, 3.5); if (f.k === 'tank') G.stats.tanks++; else G.stats.supers++; }
      if (f.k === 'missile') G.stats.missiles++;
      if (f.k === 'saucer') G.stats.saucers++;
      G.pop = { txt: String(PTS[f.k]), t: 1.2 };
    }
  }
  function killPlayer(cause) {
    if (G.dead || G.god) return;
    G.dead = true; G.deadT = 0; G.lives--; G.shake = 16;
    var dx = 0; if (cause) { var q = camOf(cause); dx = K.clamp(Math.atan2(q[0], Math.max(1, q[1])) / 1.2, -0.7, 0.7); }
    makeCracks(W / 2 + dx * W * 0.4 + rnd(-40, 40), HY + rnd(-60, 20));
    Sfx.crack(); engineL.set(0); missileL.set(0); saucerL.set(0);
  }
  function makeCracks(x0, y0) {
    var rays = [], n = 15, cr = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + rnd(-0.18, 0.18), pts = [[x0, y0]], x = x0, y = y0, len = 0, maxL = Math.hypot(W, H);
      while (len < maxL && x > -50 && x < W + 50 && y > -50 && y < H + 50) { var stp = rnd(30, 90); a += rnd(-0.25, 0.25); x += Math.cos(a) * stp; y += Math.sin(a) * stp; len += stp; pts.push([x, y]); }
      rays.push(pts); cr.push({ pts: pts });
      if (Math.random() < 0.6 && pts.length > 2) { var k = 1 + (Math.random() * (pts.length - 2) | 0), b = pts[k], ba = a + rnd(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1), bp = [b]; for (var j = 0; j < 3; j++) bp.push([bp[j][0] + Math.cos(ba) * rnd(25, 60), bp[j][1] + Math.sin(ba) * rnd(25, 60)]); cr.push({ pts: bp }); }
    }
    [0.08, 0.18, 0.33, 0.55].forEach(function (f) { // concentric fractures between neighbouring rays
      for (var i = 0; i < n; i++) {
        var A0 = rays[i], B0 = rays[(i + 1) % n], ia = Math.min(A0.length - 1, Math.round(A0.length * f) + 1), ib = Math.min(B0.length - 1, Math.round(B0.length * f) + 1);
        if (Math.random() < 0.8) cr.push({ pts: [A0[ia], [(A0[ia][0] + B0[ib][0]) / 2 + rnd(-8, 8), (A0[ia][1] + B0[ib][1]) / 2 + rnd(-8, 8)], B0[ib]] });
      }
    });
    G.cracks = cr; G.crackAt = [x0, y0];
  }
  function recordScore() {
    if (G.score <= 0) return;
    G.newHi = G.score > best();
    hiScores.push({ s: G.score, l: G.level, d: new Date().toISOString().slice(0, 10) });
    hiScores.sort(function (a, b) { return b.s - a.s; }); hiScores = hiScores.slice(0, 5); K.store.set('bz.hiscores', hiScores);
  }

  /* ---------------- update ---------------- */
  function updateFoe(f, dt, L) {
    var P = G.P, d = dist(f, P), want = bearing(f, P);
    if (f.k === 'tank' || f.k === 'super') {
      var sup = f.k === 'super', spd = (sup ? 30 : 15) * L.spd, turn = (sup ? 1.35 : 0.75) * L.spd;
      f.radar += dt * 3; f.modeT -= dt; f.cd -= dt;
      var aimErr = wrapA(want - f.a), facing = Math.abs(wrapA(bearing(P, f) - P.a));
      if (f.mode !== 'evade' && facing < 0.06 && d < 600 && Math.random() < dt * (0.4 + L.aim * 0.8)) { f.mode = 'evade'; f.modeT = rnd(1, 2); f.dir = Math.random() < 0.5 ? -1 : 1; }
      var tgtA = f.a, move = 0;
      if (f.mode === 'approach') { tgtA = want + f.off * K.clamp(d / 500, 0, 1); move = d > (sup ? 140 : 220) ? 1 : 0; if (move === 0 || f.modeT <= 0) { f.mode = 'aim'; f.modeT = rnd(2.5, 4.5); } }
      else if (f.mode === 'aim') { tgtA = want; move = d > 520 ? 0.6 : 0; if (f.modeT <= 0) { f.mode = 'approach'; f.modeT = rnd(2, 4); f.off = rnd(-0.6, 0.6); } }
      else { tgtA = want + f.dir * 1.4; move = 1; if (f.modeT <= 0) { f.mode = 'aim'; f.modeT = rnd(1.5, 3); } }
      var da = wrapA(tgtA - f.a); f.a += K.clamp(da, -turn * dt, turn * dt);
      if (move) {
        var nx = f.x + Math.sin(f.a) * spd * move * dt, nz = f.z + Math.cos(f.a) * spd * move * dt;
        if (!isBlocked(nx, nz, 4.2, f) && Math.hypot(wrapd(nx - P.x), wrapd(nz - P.z)) > 14) { f.x = nx; f.z = nz; }
        else { f.a += turn * dt * 2 * f.dir; if (f.mode !== 'evade') { f.mode = 'evade'; f.modeT = rnd(0.8, 1.5); f.dir = Math.random() < 0.5 ? -1 : 1; } }
      }
      if (G.state === 'play' && !G.dead && f.cd <= 0 && Math.abs(aimErr) < 0.07 && d < 640) {
        fireShell(f, f.a + (1 - L.aim) * rnd(-0.05, 0.05), true);
        f.cd = L.fire * rnd(0.9, 1.4) * (sup ? 0.7 : 1);
        var q = camOf(f); Sfx.enemyFire(panOfRel(q[0], q[1]), d);
      }
    } else if (f.k === 'missile') {
      var ms = 82 * L.spd; f.ph += dt * 2.6;
      var zig = d > 160 ? Math.sin(f.ph) * 0.6 : 0;
      f.a += K.clamp(wrapA(want + zig - f.a), -2.6 * dt, 2.6 * dt);
      var ahead = isBlocked(f.x + Math.sin(f.a) * 14, f.z + Math.cos(f.a) * 14, 3, f);
      if (ahead && f.y < 2) f.vy = 22; // hop over obstacles
      f.vy -= 30 * dt; f.y += f.vy * dt; if (f.y < 1.2) { f.y = 1.2; f.vy = 0; }
      f.x += Math.sin(f.a) * ms * dt; f.z += Math.cos(f.a) * ms * dt;
      if (d < 5.5 && f.y < 6 && G.state === 'play' && !G.dead) { var idx = G.foes.indexOf(f); if (idx >= 0) G.foes.splice(idx, 1); shatter(f); killPlayer(f); }
    } else if (f.k === 'saucer') {
      f.life -= dt; f.turnT -= dt; f.a += dt * 1.6;
      if (f.turnT <= 0) { f.vx = rnd(-18, 18); f.vz = rnd(-18, 18); f.turnT = rnd(1.5, 3); }
      f.x += f.vx * dt; f.z += f.vz * dt; f.y = 5.5 + Math.sin(G.t * 1.7) * 1.2;
    }
  }
  function update(dt) {
    G.t += dt; G.sweep = (G.sweep + dt * 2.4) % TAU;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.recoil > 0) G.recoil = Math.max(0, G.recoil - dt * 4);
    if (G.msgT > 0) G.msgT -= dt;
    if (G.tipT > 0) G.tipT -= dt;
    if (G.blockedT > 0) G.blockedT -= dt;
    if (G.fireCd > 0) G.fireCd -= dt;
    if (G.pop) { G.pop.t -= dt; if (G.pop.t <= 0) G.pop = null; }
    var P = G.P, L = LEVELS[G.level - 1] || LEVELS[0];

    if ((G.state === 'play' || G.state === 'clear') && !G.dead) {
      var tv = (I.isDown('fwd') ? 30 : 0) - (I.isDown('back') ? 20 : 0);
      P.v += K.clamp(tv - P.v, -70 * dt, 70 * dt);
      var turn = (I.isDown('right') ? 1 : 0) - (I.isDown('left') ? 1 : 0);
      P.a = wrapA(P.a + turn * 1.15 * dt);
      if (Math.abs(P.v) > 0.1) {
        var nx = P.x + Math.sin(P.a) * P.v * dt, nz = P.z + Math.cos(P.a) * P.v * dt;
        if (isBlocked(nx, nz, 3.4)) { P.v = 0; G.blockedT = 1.4; Sfx.blocked(); } else { P.x = (nx + S) % S; P.z = (nz + S) % S; }
      }
      if (I.hit('fire') || I.isDown('fire')) playerFire();
      var k = Math.min(1, (Math.abs(P.v) + Math.abs(turn) * 10) / 30);
      engineL.set(0.07 + 0.08 * k); engineRev(k);
    } else engineL.set(0);

    if (G.state === 'play') {
      G.stateT += dt;
      if (G.dead) {
        G.deadT += dt;
        if (G.deadT > 3.2) {
          if (G.lives <= 0) { G.state = 'over'; G.stateT = 0; recordScore(); Music.play('over', true); }
          else { // respawn: push the enemy back to the horizon
            G.dead = false; G.cracks = []; G.shells = [];
            G.foes = G.foes.filter(function (f) { return f.k === 'tank' || f.k === 'super'; });
            G.foes.forEach(function (f) { var p = spawnPoint(480, 800); f.x = p.x; f.z = p.z; f.cd = rnd(3, 5); f.mode = 'approach'; });
            G.missileT = Math.max(G.missileT, 10); G.msg = 'READY'; G.msg2 = G.lives + (G.lives === 1 ? ' TANK LEFT' : ' TANKS LEFT'); G.msgT = 2;
          }
        }
      } else {
        var active = enemyCount();
        if (active < L.tanks && G.kills + active < L.quota) { G.spawnT -= dt; if (G.spawnT <= 0) { spawnTank(); G.spawnT = rnd(3, 6); } }
        if (L.missile) { G.missileT -= dt; if (G.missileT <= 0 && !G.foes.some(function (f) { return f.k === 'missile'; })) { spawnMissile(); G.missileT = L.missile * rnd(0.8, 1.2); } }
        if (L.saucer) { G.saucerT -= dt; if (G.saucerT <= 0) { if (Math.random() < L.saucer && !G.foes.some(function (f) { return f.k === 'saucer'; })) spawnSaucer(); G.saucerT = rnd(16, 28); } }
        if (G.kills >= L.quota) {
          G.state = 'clear'; G.stateT = 0; G.shells = G.shells.filter(function (sh) { return !sh.enemy; });
          G.foes = G.foes.filter(function (f) { return f.k === 'saucer'; });
          G.msg = 'LEVEL ' + G.level + ' CLEARED'; G.msg2 = 'ACCURACY ' + Math.round(100 * G.stats.hits / Math.max(1, G.stats.shots)) + '%'; G.msgT = 2.6;
          Music.play('clear', true);
        }
      }
      Music.setRate(1 + 0.6 * K.clamp(G.kills / L.quota, 0, 1));
    } else if (G.state === 'clear') {
      G.stateT += dt;
      if (G.stateT > 2.6) {
        engineL.set(0);
        if (G.level >= LEVELS.length) { G.state = 'victory'; G.stateT = 0; recordScore(); Music.play('victory', true); I.clear(); }
        else showSplash(false);
      }
    } else if (G.state === 'over') {
      G.stateT += dt; if (G.stateT > 3) showSplash(true);
    } else if (G.state === 'victory') {
      G.stateT += dt; P.a += dt * 0.15;
      if (Math.random() < dt * 1.6) { var a = P.a + rnd(-0.5, 0.5), dd = rnd(80, 200); burst(P.x + Math.sin(a) * dd, rnd(25, 45), P.z + Math.cos(a) * dd, 70, 22, Math.random() < 0.5 ? 'lava' : 'green'); A.noise({ f: 2400, to: 200, dur: 0.7, gain: 0.08, send: 0.8 }); }
      if (G.stateT > 1.5 && (I.hit('start') || I.hit('fire'))) showSplash(true, true);
    } else if (G.state === 'title') {
      P.a += dt * 0.12;
      if (I.hit('start') || I.hit('fire')) startGame();
    }

    if (G.state !== 'title' && G.state !== 'splash') G.foes.slice().forEach(function (f) { updateFoe(f, dt, L); });
    G.foes = G.foes.filter(function (f) { return f.k !== 'saucer' || f.life > 0; });

    // shells
    for (var i = G.shells.length - 1; i >= 0; i--) {
      var sh = G.shells[i]; sh.x += sh.vx * dt; sh.z += sh.vz * dt; sh.t -= dt;
      var gone = sh.t <= 0;
      for (var j = 0; j < G.obst.length && !gone; j++) { var ob = G.obst[j]; if (Math.hypot(wrapd(ob.x - sh.x), wrapd(ob.z - sh.z)) < ob.r) { gone = true; burst(sh.x, sh.y, sh.z, 12, 14, 'green'); var q0 = camOf(sh); Sfx.small(panOfRel(q0[0], q0[1])); } }
      if (!gone && !sh.enemy) for (j = G.foes.length - 1; j >= 0; j--) { var f = G.foes[j], fy = f.k === 'saucer' ? f.y - 3 : f.k === 'missile' ? f.y : (f.y || 0) + 1.5; if (Math.hypot(wrapd(f.x - sh.x), wrapd(f.z - sh.z)) < f.r + 0.8 && Math.abs(fy - sh.y) < 4.5) { killFoe(j, true); gone = true; break; } }
      if (!gone && sh.enemy && G.state === 'play' && !G.dead && Math.hypot(wrapd(P.x - sh.x), wrapd(P.z - sh.z)) < 4.2) { gone = true; killPlayer(sh); }
      if (gone) G.shells.splice(i, 1);
    }
    // debris and sparks
    G.debris.forEach(function (d) {
      d.t -= dt; d.vy -= 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y < 0.2) { d.y = 0.2; d.vy *= -0.35; d.vx *= 0.6; d.vz *= 0.6; d.spin *= 0.6; }
      var ca = Math.cos(d.spin * dt), sa = Math.sin(d.spin * dt), hx = d.hx, hy = d.hy; d.hx = hx * ca + d.hz * sa; d.hz = -hx * sa + d.hz * ca; d.hy = hy * ca + hx * sa * 0.4;
    });
    G.debris = G.debris.filter(function (d) { return d.t > 0; });
    G.sparks.forEach(function (p) { p.t -= dt; p.vy -= 16 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.3; } });
    G.sparks = G.sparks.filter(function (p) { return p.t > 0; });
    // volcano lava (in horizon angle space)
    if (Math.random() < dt * 9) G.lava.push({ da: rnd(-0.012, 0.012), e: 0.115, va: rnd(-0.02, 0.02), ve: rnd(0.05, 0.12), t: rnd(1.2, 2.2) });
    G.lava.forEach(function (p) { p.t -= dt; p.da += p.va * dt; p.e += p.ve * dt; p.ve -= 0.09 * dt; });
    G.lava = G.lava.filter(function (p) { return p.t > 0 && p.e > 0.02; });

    // radar pings and loops
    var anyMissile = false, saucerNear = 0;
    G.foes.forEach(function (f) {
      var q = camOf(f), ang = Math.atan2(q[0], q[1]);
      if (f.k !== 'saucer' && Math.hypot(q[0], q[1]) < RADAR_RANGE) { var ds = wrapA(G.sweep - ((ang + TAU) % TAU)); if (ds > 0 && ds < dt * 2.4 + 0.001) { f.ping = 1; if (G.state === 'play' && !G.dead) Sfx.ping(panOfRel(q[0], q[1])); } }
      f.ping = Math.max(0, f.ping - dt * 0.55);
      if (f.k === 'missile') anyMissile = true;
      if (f.k === 'saucer') saucerNear = Math.max(saucerNear, K.clamp(1 - Math.hypot(q[0], q[1]) / 500, 0, 1));
    });
    var live = (G.state === 'play' || G.state === 'clear') && !G.dead;
    missileL.set(live && anyMissile ? 0.035 : 0); saucerL.set(live ? saucerNear * 0.05 : 0);
  }

  /* ---------------- splash / flow ---------------- */
  function silence() { engineL.set(0); missileL.set(0); saucerL.set(0); }
  function showSplash(lost, victory) {
    G.state = 'splash'; Music.stop(0.3); silence();
    var acc = Math.round(100 * G.stats.hits / Math.max(1, G.stats.shots));
    var title = victory ? 'ALL 12 LEVELS CLEARED' : lost ? 'GAME OVER' : 'LEVEL ' + G.level + ' CLEARED';
    var sub = 'Score ' + G.score.toLocaleString() + (lost && !victory ? ' \u2022 reached level ' + G.level : ' \u2022 accuracy ' + acc + '%') + (G.newHi ? ' \u2022 new high score' : '');
    var done = function () { I.clear(); if (lost || victory) toTitle(); else startLevel(G.level + 1); };
    if (window.ScoutSplash && ScoutSplash.show) {
      ScoutSplash.show({ kind: 'vector', campaign: 'battlezone', tag: victory ? 'victory' : lost ? 'gameover' : 'wave' + G.level, title: title, sub: sub,
        accent: '#7dff9a', glow: 'rgba(60,255,120,.28)', contLabel: victory || lost ? 'Title screen' : 'Next level', onContinue: done });
    } else done();
  }
  function toTitle() {
    G.state = 'title'; G.foes = []; G.shells = []; G.debris = []; G.sparks = []; G.dead = false; G.cracks = []; G.msgT = 0;
    G.P = { x: 0, z: 0, a: 0, v: 0 }; G.obst = buildField(LEVELS[0], 99); G.specks = buildSpecks(99); G.level = 1;
    Music.play('title'); I.clear();
  }
  function setPaused(p) {
    if (G.state !== 'play' && G.state !== 'clear') p = false;
    G.paused = p; pauseBtn.innerHTML = p ? '&#9654; <span class="lbl">Resume</span>' : '&#10074;&#10074; <span class="lbl">Pause</span>';
    if (p) { silence(); I.releaseTouch(); }
    Music.duck(p ? 0.3 : 1);
  }

  /* ---------------- rendering ---------------- */
  var COL = {
    green: ['rgba(40,255,90,', '#c4ffcf'], dim: ['rgba(30,200,70,', '#6fdc86'], faint: ['rgba(20,150,50,', '#3f9a52'], red: ['rgba(255,50,40,', '#ffb4a8'],
    lava: ['rgba(255,110,30,', '#ffd9a0'], moon: ['rgba(150,255,170,', '#eaffea'], glass: ['rgba(170,255,190,', '#ffffff'], gold: ['rgba(255,200,60,', '#fff1c4']
  };
  function stroke(col, w, alpha) {
    var cc = COL[col], a = alpha == null ? 1 : alpha;
    if (fxOn) { c.globalAlpha = a * 0.5; c.lineWidth = lw * (w || 1) * 2.6; c.strokeStyle = cc[0] + '0.55)'; c.stroke(); }
    c.globalAlpha = a; c.lineWidth = lw * (w || 1); c.strokeStyle = cc[1]; c.stroke(); c.globalAlpha = 1;
  }
  var camCa = 1, camSa = 0, camY = EYE;
  function cam(wx, wy, wz) { var dx = wrapd(wx - G.P.x), dz = wrapd(wz - G.P.z); return [dx * camCa - dz * camSa, wy - camY, dx * camSa + dz * camCa]; }
  function seg(p, q) { // near-plane clip + perspective projection into the current path
    if (p[2] < NEAR && q[2] < NEAR) return false;
    if (p[2] < NEAR) { var t = (NEAR - p[2]) / (q[2] - p[2]); p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR]; }
    else if (q[2] < NEAR) { var u = (NEAR - q[2]) / (p[2] - q[2]); q = [q[0] + (p[0] - q[0]) * u, q[1] + (p[1] - q[1]) * u, NEAR]; }
    c.moveTo(CX + p[0] / p[2] * F, HY - p[1] / p[2] * F); c.lineTo(CX + q[0] / q[2] * F, HY - q[1] / q[2] * F);
    return true;
  }
  function inView(x, z, r) { var p = cam(x, 0, z); return p[2] > -r && Math.abs(p[0]) < p[2] * (W / 2 / F) + r * 1.5 && p[2] < 1300; }
  function drawModel(m, x, y, z, a, col, w, alpha, extra) {
    if (!inView(x, z, 16)) return;
    var ca = Math.cos(a), sa = Math.sin(a), pts = m.v.map(function (v) { return cam(x + v[0] * ca + v[2] * sa, y + v[1], z - v[0] * sa + v[2] * ca); });
    var d = Math.hypot(wrapd(x - G.P.x), wrapd(z - G.P.z)), fade = K.clamp(1.25 - d / 1100, 0.3, 1);
    c.beginPath(); m.e.forEach(function (e) { seg(pts[e[0]], pts[e[1]]); });
    if (extra) extra(function (lx, ly, lz) { return cam(x + lx * ca + lz * sa, y + ly, z - lx * sa + lz * ca); });
    stroke(col, w || 1, (alpha == null ? 1 : alpha) * fade);
  }
  function radarDish(f) { return function (T) { var ra = f.radar, ux = Math.cos(ra) * 0.9, uz = Math.sin(ra) * 0.9; var a = T(-ux, 3.0, -1.3 - uz), b = T(ux, 3.0, -1.3 + uz), a2 = T(-ux, 3.6, -1.3 - uz), b2 = T(ux, 3.6, -1.3 + uz); seg(a, b); seg(b, b2); seg(b2, a2); seg(a2, a); }; }
  function skyX(az) { var r = wrapA(az - G.P.a); if (Math.abs(r) > 1.25) return null; return CX + Math.tan(r) * F; }
  function drawSky() {
    var hy = HY;
    // moon: a crescent hung over the far range
    var mx = skyX(4.1), mr = 0.04 * F, my = hy - Math.tan(0.24) * F;
    if (mx != null) {
      c.beginPath(); c.arc(mx, my, mr, -Math.PI * 0.5, Math.PI * 0.5, false); c.arc(mx + mr * 0.42, my, mr * 0.9, Math.PI * 0.56, -Math.PI * 0.56, true); stroke('moon', 1, 0.9);
      c.beginPath(); c.moveTo(mx + mr * 0.62, my + mr * 0.3); c.arc(mx + mr * 0.5, my + mr * 0.3, mr * 0.12, 0, TAU); c.moveTo(mx + mr * 0.78, my - mr * 0.4); c.arc(mx + mr * 0.7, my - mr * 0.4, mr * 0.08, 0, TAU); stroke('moon', 0.6, 0.4);
    }
    // mountains
    c.beginPath(); var prev = null;
    MOUNT.forEach(function (p) { var x = skyX(p[0]), y = hy - Math.tan(p[1]) * F; if (x != null && prev) { c.moveTo(prev[0], prev[1]); c.lineTo(x, y); } prev = x != null ? [x, y] : null; });
    stroke('green', 1, 0.95);
    c.beginPath(); // ridge detail strokes inside the range
    for (var i = 2; i < MOUNT.length - 2; i += 3) { var p = MOUNT[i], q = MOUNT[i + 1]; if (p[1] > 0.04) { var x1 = skyX(p[0]), x2 = skyX(q[0] + 0.02); if (x1 != null && x2 != null) { c.moveTo(x1, hy - Math.tan(p[1]) * F); c.lineTo(x2, hy - Math.tan(p[1] * 0.45) * F); } } }
    stroke('dim', 0.6, 0.5);
    // volcano crater, smoke and lava
    var vx = skyX(VOLC.az);
    if (vx != null) {
      var ty = hy - Math.tan(0.115) * F, cw = Math.tan(0.03) * F;
      c.beginPath(); c.ellipse(vx, ty, cw, cw * 0.18, 0, 0, TAU); stroke('green', 0.8, 0.8);
      c.beginPath(); for (var k = 0; k < 4; k++) { var sr = cw * (0.2 + k * 0.09), sx = vx + Math.sin(G.t * 0.4 + k) * cw * 0.6, sy = ty - (k + 1) * cw * 0.7 - (G.t * 8 % (cw * 0.7)); c.moveTo(sx + sr, sy); c.arc(sx, sy, sr, 0, TAU); } stroke('faint', 0.5, 0.25);
      c.beginPath(); G.lava.forEach(function (l) { var lx = skyX(VOLC.az + l.da), ly = hy - Math.tan(l.e) * F; if (lx != null) { c.moveTo(lx, ly); c.lineTo(lx - l.va * F * 0.05, ly + l.ve * F * 0.05); } }); stroke('lava', 1.2, 0.95);
    }
    c.beginPath(); c.moveTo(0, hy); c.lineTo(W, hy); stroke('green', 0.9, 0.85);
  }
  function drawGround() {
    c.beginPath();
    G.specks.forEach(function (p) { var q = cam(p.x, 0, p.z); if (q[2] > 2 && q[2] < 420) { var X = CX + q[0] / q[2] * F, Y = HY - q[1] / q[2] * F, z = Math.max(0.6, 5 / Math.sqrt(q[2])); c.moveTo(X - z, Y); c.lineTo(X + z, Y); } });
    stroke('faint', 0.9, 0.7);
  }
  function drawWorld() {
    G.obst.forEach(function (o) { drawModel(MODELS[o.k], o.x, 0, o.z, o.a, 'green', 1); });
    G.foes.forEach(function (f) {
      if (f.k === 'tank') drawModel(MODELS.tank, f.x, 0, f.z, f.a, 'green', 1.15, 1, radarDish(f));
      else if (f.k === 'super') drawModel(MODELS.super, f.x, 0, f.z, f.a, 'green', 1.2);
      else if (f.k === 'missile') drawModel(MODELS.missile, f.x, f.y, f.z, f.a, 'red', 1.15);
      else drawModel(MODELS.saucer, f.x, f.y, f.z, f.a, 'green', 1.1, 0.6 + 0.4 * Math.abs(Math.sin(G.t * 4)));
    });
    G.shells.forEach(function (sh) { drawModel(MODELS.shell, sh.x, sh.y, sh.z, sh.a, sh.enemy ? 'red' : 'green', 1.3); });
    c.beginPath(); G.debris.forEach(function (d) { seg(cam(d.x - d.hx, d.y - d.hy, d.z - d.hz), cam(d.x + d.hx, d.y + d.hy, d.z + d.hz)); }); stroke('green', 1.1, 0.95);
    ['lava', 'green'].forEach(function (col) {
      c.beginPath(); G.sparks.forEach(function (p) { if (p.col === col) seg(cam(p.x, p.y, p.z), cam(p.x - p.vx * 0.04, p.y - p.vy * 0.04, p.z - p.vz * 0.04)); }); stroke(col, 1, 0.9);
    });
  }
  function drawReticle() {
    var ry = HY - (EYE - 1.9) / 60 * F, gap = 14, len = 26, lock = false;
    G.foes.forEach(function (f) { if (f.k === 'saucer') return; var q = cam(f.x, 1.5, f.z); if (q[2] > 0 && q[2] < 700 && Math.abs(q[0] / q[2]) < 5 / Math.max(q[2], 30) + 0.012) lock = true; });
    var g = lock ? gap * 0.55 : gap, col = lock ? 'red' : 'green';
    c.beginPath();
    c.moveTo(CX - g - len, ry); c.lineTo(CX - g, ry); c.moveTo(CX + g, ry); c.lineTo(CX + g + len, ry);
    c.moveTo(CX, ry - g - len * 0.9); c.lineTo(CX, ry - g); c.moveTo(CX, ry + g); c.lineTo(CX, ry + g + len * 0.6);
    c.moveTo(CX - g - len, ry - 6); c.lineTo(CX - g - len, ry + 6); c.moveTo(CX + g + len, ry - 6); c.lineTo(CX + g + len, ry + 6);
    stroke(col, 1, 0.9);
  }
  function vtext(str, x, y, size, col, align, alpha, w) { c.beginPath(); K.textPath(c, str, x, y, size, align); stroke(col || 'green', w || (size > 30 ? 1.5 : 1), alpha); }
  function fitSize(str, size, maxW) { var w = K.textWidth(str, size); return w > maxW ? size * maxW / w : size; }
  function windowPath(x0, y0, x1, y1, ch) { c.moveTo(x0 + ch, y0); c.lineTo(x0, y0 + ch); c.lineTo(x0, y1 - ch); c.lineTo(x0 + ch, y1); c.lineTo(x1 - ch, y1); c.lineTo(x1, y1 - ch); c.lineTo(x1, y0 + ch); c.lineTo(x1 - ch, y0); c.closePath(); }
  function drawFrame() {
    // periscope glass: black mask with a chamfered window, bezel and a scrolling heading tape
    var m = Math.min(W, H) * 0.018, ch = Math.min(W, H) * 0.07, x0 = m, y0 = m, x1 = W - m, y1 = H - m;
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000';
    c.beginPath(); c.rect(-10, -10, W + 20, H + 20); windowPath(x0, y0, x1, y1, ch); c.fill('evenodd');
    c.globalCompositeOperation = 'lighter';
    c.beginPath(); windowPath(x0, y0, x1, y1, ch); stroke('dim', 1, 0.6);
    c.beginPath(); windowPath(x0 + 5, y0 + 5, x1 - 5, y1 - 5, ch - 2); stroke('faint', 0.6, 0.35);
    var tapeY = y1 - 16 * hk;
    c.beginPath();
    var base = Math.round(G.P.a * 36 / Math.PI);
    for (var d = -40; d <= 40; d++) { var az = base + d, rr = az * Math.PI / 36 - G.P.a; if (Math.abs(rr) > 1.2) continue; var x = CX + rr * F * 0.55; if (x < x0 + ch || x > x1 - ch) continue; var big = ((az % 9) + 9) % 9 === 0; c.moveTo(x, tapeY); c.lineTo(x, tapeY - (big ? 10 : 5) * hk); }
    c.moveTo(CX - 6 * hk, tapeY + 8 * hk); c.lineTo(CX, tapeY + 2 * hk); c.lineTo(CX + 6 * hk, tapeY + 8 * hk);
    stroke('dim', 0.8, 0.7);
    ['N', 'E', 'S', 'W'].forEach(function (n, i) { var rr = wrapA(i * Math.PI / 2 - G.P.a), x = CX + rr * F * 0.55; if (Math.abs(rr) < 1.2 && x > x0 + ch && x < x1 - ch) vtext(n, x, tapeY - 24 * hk, 9 * hk, 'dim', 0.5, 0.8); });
  }
  function drawRadar() {
    var rr = (narrow ? 42 : 52) * hk, cx = W / 2, cy = hudTop + rr + 2;
    c.beginPath(); c.arc(cx, cy, rr, 0, TAU); stroke('red', 1, 0.9);
    c.beginPath(); c.moveTo(cx + rr * 0.5, cy); c.arc(cx, cy, rr * 0.5, 0, TAU); c.moveTo(cx - rr, cy); c.lineTo(cx + rr, cy); c.moveTo(cx, cy - rr); c.lineTo(cx, cy + rr); stroke('red', 0.5, 0.35);
    var fa = FOV / 2; c.beginPath(); c.moveTo(cx + Math.sin(-fa) * rr, cy - Math.cos(fa) * rr); c.lineTo(cx, cy); c.lineTo(cx + Math.sin(fa) * rr, cy - Math.cos(fa) * rr); stroke('red', 0.6, 0.5);
    for (var k = 0; k < 6; k++) { var a = G.sweep - k * 0.06; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr); stroke('red', 1, 0.8 - k * 0.13); }
    G.foes.forEach(function (f) {
      if (f.k === 'saucer') return;
      var q = cam(f.x, 0, f.z); if (Math.hypot(q[0], q[2]) > RADAR_RANGE) return;
      var bx = cx + q[0] / RADAR_RANGE * rr, by = cy - q[2] / RADAR_RANGE * rr, al = 0.25 + 0.75 * f.ping;
      c.beginPath(); c.arc(bx, by, (f.k === 'missile' ? 1.6 : 2.4) * hk, 0, TAU); c.fillStyle = 'rgba(255,130,110,' + al + ')'; c.fill();
      if (fxOn) { c.beginPath(); c.arc(bx, by, 5 * hk, 0, TAU); c.fillStyle = 'rgba(255,40,30,' + al * 0.3 + ')'; c.fill(); }
    });
    return { cx: cx, cy: cy, rr: rr };
  }
  function tankIcon(tx, ty) { var u = hk; c.moveTo(tx, ty + 8 * u); c.lineTo(tx + 20 * u, ty + 8 * u); c.lineTo(tx + 17 * u, ty + 4 * u); c.lineTo(tx + 3 * u, ty + 4 * u); c.closePath(); c.moveTo(tx + 6 * u, ty + 4 * u); c.lineTo(tx + 8 * u, ty); c.lineTo(tx + 13 * u, ty); c.lineTo(tx + 14 * u, ty + 4 * u); c.moveTo(tx + 12 * u, ty + 1.5 * u); c.lineTo(tx + 21 * u, ty + 1.5 * u); }
  function drawHud() {
    var rd = drawRadar(), sz = 13 * hk, lx = Math.max(W * 0.04, 24), y = hudTop + 4, L = LEVELS[G.level - 1];
    vtext('SCORE ' + G.score, lx, y, sz, 'green', 0);
    vtext('HIGH ' + Math.max(best(), G.score), lx, y + sz * 1.7, sz * 0.75, 'dim', 0);
    var split = !narrow, rx = split ? W - lx : lx, ra = split ? 1 : 0, ry = split ? y : y + sz * 3.3;
    vtext('LEVEL ' + G.level + '/12', rx, ry, sz * 0.8, 'green', ra);
    vtext('KILLS ' + Math.min(G.kills, L.quota) + '/' + L.quota, rx, ry + sz * 1.5, sz * 0.75, 'dim', ra);
    c.beginPath(); for (var i = 0; i < Math.min(G.lives, 6); i++) tankIcon(split ? W - lx - (i + 1) * 26 * hk : lx + i * 26 * hk, ry + sz * 3); stroke('green', 0.8, 0.9);
    // warnings under the radar
    var my = rd.cy + rd.rr + 10 * hk, ms = 11 * hk, nearest = null, nd = 1e9, inRange = false;
    G.foes.forEach(function (f) { if (f.k === 'saucer') return; var d = dist(f, G.P); if (d < nd) { nd = d; nearest = f; } if (d < 650) inRange = true; });
    if (G.state === 'play' && !G.dead) {
      if (inRange && (G.t % 0.8) < 0.55) vtext('ENEMY IN RANGE', W / 2, my, fitSize('ENEMY IN RANGE', ms, W * 0.6), 'red', 0.5);
      if (nearest) { var ra2 = wrapA(bearing(G.P, nearest) - G.P.a), lab = Math.abs(ra2) < FOV / 2 ? '' : Math.abs(ra2) > 2.2 ? 'ENEMY TO REAR' : ra2 < 0 ? 'ENEMY TO LEFT' : 'ENEMY TO RIGHT'; if (lab) vtext(lab, W / 2, my + ms * 1.8, fitSize(lab, ms, W * 0.6), 'red', 0.5, 0.9); }
      if (G.blockedT > 0) vtext('MOTION BLOCKED BY OBJECT', W / 2, my + ms * 3.6, fitSize('MOTION BLOCKED BY OBJECT', ms, W * 0.8), 'red', 0.5, Math.min(1, G.blockedT * 2));
    }
    if (G.pop) vtext(G.pop.txt, W / 2, HY - 90, 16, 'gold', 0.5, Math.min(1, G.pop.t * 2));
  }
  function drawCenter(lines, yBase) { lines.forEach(function (l, i) { var sz = fitSize(l[0], l[1], W * 0.86); vtext(l[0], W / 2, yBase + (l[3] != null ? l[3] : i * 40), sz, l[2] || 'green', 0.5, l[4]); }); }
  function drawCracks() {
    var k = K.clamp(G.deadT / 0.25, 0, 1);
    if (G.deadT < 0.2) { c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - G.deadT / 0.2)) + ')'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter'; }
    c.beginPath();
    G.cracks.forEach(function (cr) { var n = Math.max(2, Math.ceil(cr.pts.length * k)); c.moveTo(cr.pts[0][0], cr.pts[0][1]); for (var i = 1; i < Math.min(n, cr.pts.length); i++) c.lineTo(cr.pts[i][0], cr.pts[i][1]); });
    stroke('glass', 0.85, 0.85);
    c.beginPath(); c.moveTo(G.crackAt[0] + 10, G.crackAt[1]); c.arc(G.crackAt[0], G.crackAt[1], 10, 0, TAU); c.moveTo(G.crackAt[0] + 22, G.crackAt[1]); c.arc(G.crackAt[0], G.crackAt[1], 22, 0, TAU); stroke('glass', 0.8, 0.7);
  }
  function drawTitle() {
    var t1 = 'BATTLEZONE', sz = fitSize(t1, 78, W * 0.86), ty = H * 0.26;
    vtext(t1, W / 2, ty, sz, 'green', 0.5, 1, 2);
    vtext('ARCADE TRIBUTE  -  12 LEVELS', W / 2, ty + sz * 1.45, fitSize('ARCADE TRIBUTE  -  12 LEVELS', 13, W * 0.9), 'dim', 0.5);
    var startTxt = K.isTouch ? 'TAP TO START' : 'PRESS SPACE OR ENTER TO START';
    if ((G.t % 1.2) < 0.8) vtext(startTxt, W / 2, H * 0.76, fitSize(startTxt, 18, W * 0.9), 'red', 0.5);
    var hy = H * 0.82;
    if (hiScores.length) hiScores.slice(0, 3).forEach(function (h, i) { vtext((i + 1) + '.  ' + h.s + '   LEVEL ' + h.l, W / 2, hy + i * 16, 9, i ? 'dim' : 'green', 0.5, 0.9); });
    else vtext('NO SCORES YET', W / 2, hy, 10, 'dim', 0.5);
    var leg = K.isTouch ? 'PAD DRIVES AND TURNS   FIRE SHOOTS' : 'UP/DOWN DRIVE   LEFT/RIGHT TURN   SPACE FIRES   P PAUSE   M MUTE';
    vtext(leg, W / 2, H * 0.91, fitSize(leg, narrow ? 9 : 10, W * 0.86), 'dim', 0.5, 0.8);
  }
  function render() {
    c.setTransform(1, 0, 0, 1, 0, 0);
    R.fade(fxOn ? 0.8 : 1);
    c.globalCompositeOperation = 'lighter';
    var sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake - G.recoil * 6;
    c.setTransform(s, 0, 0, s, ox + sx * s, oy + sy * s);
    camCa = Math.cos(G.P.a); camSa = Math.sin(G.P.a); camY = EYE + G.recoil * 0.15;
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    drawSky(); drawGround();
    if (G.state === 'title') { // a tank on patrol in front of the camera, a supertank behind it
      var a = G.P.a, tk = { x: G.P.x + Math.sin(a) * 30, z: G.P.z + Math.cos(a) * 30, a: a + G.t * 0.5, radar: G.t * 3 };
      drawModel(MODELS.tank, tk.x, 0, tk.z, tk.a, 'green', 1.2, 1, radarDish(tk));
      var b = a + 0.3, st = { x: G.P.x + Math.sin(b) * 90, z: G.P.z + Math.cos(b) * 90 }; drawModel(MODELS.super, st.x, 0, st.z, -G.t * 0.3, 'green', 1, 0.8);
    }
    drawWorld();
    if (G.state !== 'title' && G.state !== 'splash' && !G.dead) drawReticle();
    c.restore();
    drawFrame();
    if (G.state === 'title') drawTitle();
    else if (G.state !== 'splash') drawHud();
    if (G.msgT > 0 && (G.state === 'play' || G.state === 'clear')) { var al = Math.min(1, G.msgT * 1.5); drawCenter([[G.msg, 34, G.state === 'clear' ? 'gold' : 'green', 0, al], [G.msg2, 16, 'dim', 46, al]], H * 0.66); }
    if (G.tipT > 0 && G.state === 'play') vtext(G.tip, W / 2, H * 0.86, fitSize(G.tip, 12, W * 0.86), 'green', 0.5, Math.min(1, G.tipT));
    if (G.dead && G.cracks.length) drawCracks();
    if (G.state === 'over') { c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter'; drawCenter([['GAME OVER', 46, 'red'], [G.newHi ? 'NEW HIGH SCORE' : 'SCORE ' + G.score, 18, G.newHi ? 'gold' : 'dim', 64]], H * 0.42); }
    if (G.state === 'victory') {
      var acc = Math.round(100 * G.stats.hits / Math.max(1, G.stats.shots));
      drawCenter([['VICTORY', 60, 'gold'], ['ALL 12 LEVELS CLEARED', 20, 'green', 84], ['SCORE ' + G.score + '   ACCURACY ' + acc + '%', 14, 'dim', 124], ['TANKS ' + G.stats.tanks + '  SUPERTANKS ' + G.stats.supers + '  MISSILES ' + G.stats.missiles + '  SAUCERS ' + G.stats.saucers, 13, 'dim', 152]], H * 0.34);
    }
    if (G.paused) {
      c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter';
      drawCenter([['PAUSED', 44, 'green'], [K.isTouch ? 'TAP RESUME TO PLAY' : 'PRESS P OR ESC TO RESUME', 14, 'dim', 62]], H * 0.4);
    }
    c.globalCompositeOperation = 'source-over';
    if (fxOn) R.present(function (v) { v.drawImage(bgCanvas, 0, 0); });
    else { var v = R.vis; v.globalCompositeOperation = 'source-over'; v.drawImage(bgCanvas, 0, 0); v.globalCompositeOperation = 'lighter'; v.drawImage(c.canvas, 0, 0); v.globalCompositeOperation = 'source-over'; }
  }
  function buildBg() {
    bgCanvas = document.createElement('canvas'); bgCanvas.width = R.w; bgCanvas.height = R.h;
    var b = bgCanvas.getContext('2d'), hy = oy + HY * s, f = K.clamp(hy / R.h, 0.05, 0.95);
    b.fillStyle = '#000'; b.fillRect(0, 0, R.w, R.h);
    var g = b.createLinearGradient(0, 0, 0, R.h); g.addColorStop(0, '#000'); g.addColorStop(f - 0.02, '#031408'); g.addColorStop(f, '#010802'); g.addColorStop(1, '#000');
    b.fillStyle = g; b.fillRect(0, 0, R.w, R.h);
    var n = Math.round(R.w * hy / 9000); for (var i = 0; i < n; i++) { var r = Math.random(); b.fillStyle = r > 0.95 ? 'rgba(200,255,210,0.6)' : 'rgba(120,200,140,0.25)'; var z = dpr * 0.8; b.fillRect(Math.random() * R.w, Math.random() * hy * 0.85, z, z); }
    var vg = b.createRadialGradient(R.w / 2, R.h / 2, Math.min(R.w, R.h) * 0.35, R.w / 2, R.h / 2, Math.max(R.w, R.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
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
    portrait = ch > cw; narrow = cw < 700;
    H = portrait ? K.clamp(ch * 1.02, 560, 760) : K.clamp(ch * 1.3, 520, 760); W = K.clamp(H * cw / ch, H * 0.45, H * 2.2);
    s = Math.min(R.w / W, R.h / H); ox = (R.w - W * s) / 2; oy = (R.h - H * s) / 2;
    lw = Math.max(1.1, 1.3 * dpr) / s;
    hk = K.clamp(0.9 / (s / dpr), 0.9, 1.7);
    hudTop = Math.max(14, (50 * dpr - oy) / s);
    FOV = portrait ? 1.0 : W / H > 1.9 ? 1.2 : 1.05; F = (W / 2) / Math.tan(FOV / 2); CX = W / 2; HY = H * (portrait ? 0.5 : 0.6);
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
  optFx.checked = fxOn; optFx.addEventListener('change', function () { fxOn = optFx.checked; K.store.set('bz.fx', fxOn); resize(); });
  optTouch.value = touchPref; optTouch.addEventListener('change', function () { touchPref = optTouch.value; K.store.set('bz.touch', touchPref); resize(); });
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

  window.BZGame = { version: 1, levels: LEVELS.length };
  if (DEBUG) {
    window.BZGame.debug = {
      G: G, sfx: Sfx, music: Music,
      start: function (n) { if (G.state === 'title') startGame(); if (n) startLevel(n); },
      clearLevel: function () { G.kills = LEVELS[G.level - 1].quota; },
      god: function (on) { G.god = on !== false; },
      kill: function (all) { G.god = false; if (all) G.lives = 1; G.dead = false; killPlayer(null); },
      tank: function (sup) { spawnTank(); var f = G.foes[G.foes.length - 1], a = G.P.a + 0.12; if (sup != null) f.k = sup ? 'super' : 'tank'; f.x = G.P.x + Math.sin(a) * 60; f.z = G.P.z + Math.cos(a) * 60; f.a = a + Math.PI + 0.7; f.cd = 99; return f.k; },
      missile: function () { spawnMissile(); var f = G.foes[G.foes.length - 1], a = G.P.a - 0.25; f.x = G.P.x + Math.sin(a) * 120; f.z = G.P.z + Math.cos(a) * 120; },
      saucer: function () { spawnSaucer(); var f = G.foes[G.foes.length - 1], a = G.P.a + 0.3; f.x = G.P.x + Math.sin(a) * 50; f.z = G.P.z + Math.cos(a) * 50; },
      state: function () { return { state: G.state, level: G.level, score: G.score, lives: G.lives, kills: G.kills, foes: G.foes.length, obst: G.obst.length, dead: G.dead, paused: G.paused, music: Music.name, muted: A.muted, W: W, H: H }; }
    };
  }
})();

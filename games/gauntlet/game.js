/* Gauntlet tribute: top-down dungeon crawl for one hero. Four heroes, 12 floors, generators that keep
   spawning ghosts, grunts, demons, lobbers and sorcerers, Death, keys and doors, food, potions and
   a narrator who warns you when your life force runs low. Original code, art and sound.
   Written by: Howie */
(function () {
  'use strict';
  var K = window.VKit, GA = window.GArt, LV = window.GauntletLevels, Songs = window.GauntletSongs;
  var Mus = window.ArcadeMusic || { play: function () {}, sting: function () {}, stop: function () {}, setMuted: function () {}, setEnabled: function () {}, duck: function () {}, enabled: true };
  var LEVELS = LV.LEVELS, DEBUG = K.DEBUG, TS = 32, TAU = Math.PI * 2;
  var canvas = document.getElementById('game'), ctx = canvas.getContext('2d'), wrap = document.getElementById('wrap');
  var settingsEl = document.getElementById('settings');

  /* ---------------- heroes ---------------- */
  var HEROES = [
    { id: 'warrior', name: 'Warrior', full: 'Thor the Warrior', spd: 118, armor: 0.3, shot: 3, shotSpd: 330, rate: 0.36, magic: 0.7, melee: 3,
      bars: [2, 3, 5, 2, 5], blurb: 'Huge axe, heavy hits. Slow on his feet.' },
    { id: 'valkyrie', name: 'Valkyrie', full: 'Thyra the Valkyrie', spd: 130, armor: 0.48, shot: 2, shotSpd: 360, rate: 0.31, magic: 0.85, melee: 2,
      bars: [3, 5, 3, 3, 4], blurb: 'Shield and sword. The best armor.' },
    { id: 'wizard', name: 'Wizard', full: 'Merlin the Wizard', spd: 126, armor: 0.08, shot: 2, shotSpd: 380, rate: 0.3, magic: 1.7, melee: 1,
      bars: [3, 1, 3, 5, 1], blurb: 'Weak armor, mighty magic potions.' },
    { id: 'elf', name: 'Elf', full: 'Questor the Elf', spd: 158, armor: 0.16, shot: 1.5, shotSpd: 450, rate: 0.21, magic: 1.1, melee: 1,
      bars: [5, 2, 2, 3, 1], blurb: 'Fastest hero, rapid arrows.' }
  ];
  var BAR_NAMES = ['Speed', 'Armor', 'Shot power', 'Magic', 'Fighting'];
  var MON = {
    ghost: { spd: 72, hp: 1, r: 10, pts: 10, touch: 10 },
    grunt: { spd: 60, hp: 1, r: 11, pts: 20, hit: 9 },
    demon: { spd: 64, hp: 1, r: 11, pts: 30, hit: 8 },
    lobber: { spd: 58, hp: 1, r: 9, pts: 30, hit: 4 },
    sorcerer: { spd: 70, hp: 1, r: 10, pts: 30, hit: 8 },
    death: { spd: 84, hp: 999, r: 11, pts: 0 }
  };
  var GEN_CH = { G: 'ghost', R: 'grunt', M: 'demon', L: 'lobber', O: 'sorcerer' };
  var MON_CH = { g: 'ghost', r: 'grunt', m: 'demon', l: 'lobber', o: 'sorcerer', x: 'death' };
  var ITEM_CH = { F: 'food', J: 'jug', X: 'poison', P: 'potion', K: 'key', T: 'treasure' };

  /* ---------------- input ---------------- */
  var ACTIONS = [
    { id: 'up', label: 'Move up', keys: ['ArrowUp', 'KeyW'] }, { id: 'down', label: 'Move down', keys: ['ArrowDown', 'KeyS'] },
    { id: 'left', label: 'Move left', keys: ['ArrowLeft', 'KeyA'] }, { id: 'right', label: 'Move right', keys: ['ArrowRight', 'KeyD'] },
    { id: 'fire', label: 'Fire (hold to stand and aim)', keys: ['Space', 'KeyJ'] }, { id: 'magic', label: 'Use magic potion', keys: ['KeyX', 'ShiftLeft'] },
    { id: 'pause', label: 'Pause', keys: ['KeyP', 'Escape'] }, { id: 'mute', label: 'Mute', keys: ['KeyM', null] }
  ];
  var I = K.input({ actions: ACTIONS, storeKey: 'gauntlet.keys', pad: function (gp) {
    var b = function (i) { return !!(gp.buttons[i] && gp.buttons[i].pressed); }, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    var m = Math.hypot(ax, ay); I.axis = m > 0.3 ? { x: ax / Math.max(1, m), y: ay / Math.max(1, m) } : null;
    return { up: b(12), down: b(13), left: b(14), right: b(15), fire: b(0) || b(7), magic: b(1) || b(2) || b(3), pause: b(9) };
  }, onKey: function (e) { A.unlock(); if (G.state === 'title') return titleKey(e); } });
  var joy = null; // on-screen stick {x,y}

  /* ---------------- audio: effects through VKit, music through the shared ArcadeMusic ---------------- */
  var A = K.audio('gauntlet.muted', 0.62);
  Mus.setMuted(A.muted);
  A.listeners.push(function (m) { Mus.setMuted(m); if (m) Voice.cancel(); });
  var Sfx = {
    shoot: function (id) {
      if (id === 'warrior') { A.noise({ f: 900, to: 300, dur: 0.18, gain: 0.22, ftype: 'bandpass', q: 1.5 }); A.tone({ f: 160, to: 90, dur: 0.12, type: 'triangle', gain: 0.1 }); }
      else if (id === 'valkyrie') { A.tone({ f: 1800, to: 900, dur: 0.12, type: 'sawtooth', gain: 0.06, lp: 4000 }); A.noise({ f: 5000, to: 2000, dur: 0.1, gain: 0.08, ftype: 'highpass' }); }
      else if (id === 'wizard') { A.noise({ f: 1400, to: 400, dur: 0.25, gain: 0.2, q: 2 }); A.tone({ f: 420, to: 140, dur: 0.2, type: 'sawtooth', gain: 0.06, lp: 1600 }); }
      else { A.tone({ f: 620, to: 300, dur: 0.12, type: 'triangle', gain: 0.16 }); A.noise({ f: 3200, to: 1200, dur: 0.06, gain: 0.08, ftype: 'bandpass' }); }
    },
    hit: function () { A.noise({ f: 1200, to: 200, dur: 0.12, gain: 0.25 }); A.tone({ f: 140, to: 60, dur: 0.1, type: 'square', gain: 0.07, lp: 600 }); },
    kill: function (t) {
      if (t === 'ghost') { A.tone({ f: 700, to: 120, dur: 0.35, type: 'sine', gain: 0.12, send: 0.7 }); A.noise({ f: 2000, to: 300, dur: 0.3, gain: 0.12, ftype: 'bandpass' }); }
      else { A.noise({ f: 700, to: 90, dur: 0.28, gain: 0.3 }); A.tone({ f: 110, to: 45, dur: 0.25, type: 'square', gain: 0.1, lp: 500 }); }
    },
    stone: function () { A.noise({ f: 2600, to: 600, dur: 0.12, gain: 0.25, ftype: 'bandpass', q: 3 }); A.tone({ f: 300, to: 200, dur: 0.08, type: 'square', gain: 0.05, lp: 1200 }); },
    genDie: function () { A.noise({ f: 500, to: 50, dur: 0.9, gain: 0.5 }); A.tone({ f: 80, to: 30, dur: 0.8, type: 'sine', gain: 0.35 }); },
    food: function () { for (var i = 0; i < 3; i++) A.noise({ f: 900, to: 300, dur: 0.07, gain: 0.25, delay: i * 0.11 }); A.tone({ f: 330, to: 520, dur: 0.3, type: 'triangle', gain: 0.1, delay: 0.3 }); },
    treasure: function () { [1319, 1568, 1976, 2637].forEach(function (f, i) { A.tone({ f: f, dur: 0.25, type: 'triangle', gain: 0.09, delay: i * 0.05, send: 0.5 }); }); },
    key: function () { [880, 1320, 1760].forEach(function (f, i) { A.tone({ f: f, dur: 0.35, type: 'sine', gain: 0.12, delay: i * 0.07, send: 0.6 }); }); },
    potion: function () { A.tone({ f: 300, to: 1200, dur: 0.4, type: 'sine', gain: 0.14, send: 0.6 }); A.tone({ f: 450, to: 1800, dur: 0.4, type: 'sine', gain: 0.07, delay: 0.06 }); },
    poison: function () { A.tone({ f: 220, to: 70, dur: 0.6, type: 'sawtooth', gain: 0.12, lp: 900 }); A.tone({ f: 233, to: 74, dur: 0.6, type: 'sawtooth', gain: 0.1, lp: 900 }); },
    door: function () { A.tone({ f: 90, to: 60, dur: 0.6, type: 'sawtooth', gain: 0.16, lp: 500 }); A.noise({ f: 400, to: 120, dur: 0.5, gain: 0.25 }); A.tone({ f: 600, to: 300, dur: 0.45, type: 'square', gain: 0.03, lp: 1800, delay: 0.05 }); },
    hurt: function () { A.tone({ f: 180, to: 110, dur: 0.14, type: 'square', gain: 0.1, lp: 900 }); },
    magic: function () { A.noise({ f: 3000, to: 60, dur: 1.4, gain: 0.55 }); A.tone({ f: 60, to: 25, dur: 1.2, type: 'sine', gain: 0.45 }); [523, 659, 784, 1046].forEach(function (f, i) { A.tone({ f: f, dur: 0.9, type: 'triangle', gain: 0.06, delay: 0.05 * i, send: 0.9 }); }); },
    exit: function () { [784, 659, 523, 392, 330, 262].forEach(function (f, i) { A.tone({ f: f, dur: 0.22, type: 'triangle', gain: 0.12, delay: i * 0.07, send: 0.6 }); }); },
    fire: function () { A.noise({ f: 1600, to: 500, dur: 0.3, gain: 0.14, ftype: 'bandpass' }); },
    rock: function () { A.noise({ f: 500, to: 120, dur: 0.18, gain: 0.3 }); },
    drain: function () { A.tone({ f: 70, to: 55, dur: 0.18, type: 'sawtooth', gain: 0.1, lp: 300 }); },
    gong: function () { A.tone({ f: 98, dur: 2.2, type: 'sine', gain: 0.3, send: 0.9 }); A.tone({ f: 196.5, dur: 1.6, type: 'triangle', gain: 0.08, send: 0.9 }); A.noise({ f: 900, to: 200, dur: 0.4, gain: 0.1 }); },
    tick: function () { A.tone({ f: 660, dur: 0.06, type: 'square', gain: 0.05, lp: 2000 }); },
    death: function () { A.tone({ f: 330, to: 55, dur: 1.4, type: 'sawtooth', gain: 0.14, lp: 1200 }); A.noise({ f: 800, to: 80, dur: 1.2, gain: 0.25 }); }
  };

  /* ---------------- voice callouts (Web Speech API; silent while muted) ---------------- */
  var Voice = (function () {
    var S = window.speechSynthesis, voice = null, last = {};
    function pick() {
      if (!S) return;
      var vs = S.getVoices() || [], en = vs.filter(function (v) { return /^en/i.test(v.lang); });
      var pref = ['Daniel', 'Google UK English Male', 'Male', 'Fred', 'Alex', 'Arthur', 'David', 'George', 'Rishi'];
      for (var p = 0; p < pref.length && !voice; p++) for (var i = 0; i < en.length; i++) if (en[i].name.indexOf(pref[p]) >= 0) { voice = en[i]; break; }
      if (!voice) voice = en[0] || vs[0] || null;
    }
    if (S) { pick(); if (S.addEventListener) S.addEventListener('voiceschanged', pick); }
    return {
      say: function (text, key, gap) {
        if (!S || A.muted || !window.SpeechSynthesisUtterance) return;
        var now = performance.now(), k = key || text;
        if (last[k] && now - last[k] < (gap || 6000)) return;
        last[k] = now;
        try {
          var u = new SpeechSynthesisUtterance(text);
          if (voice) u.voice = voice;
          u.rate = 0.92; u.pitch = 0.62; u.volume = 0.95;
          S.speak(u);
        } catch (e) { /* speech unavailable */ }
        G.lastSpeech = text;
      },
      cancel: function () { if (S) try { S.cancel(); } catch (e) { } }
    };
  })();

  /* ---------------- state ---------------- */
  var G = { state: 'title', sel: K.store.get('gauntlet.hero', 0) | 0, level: 0, score: 0, health: 800, keys: 0, potions: 0, t: 0, stateT: 0, paused: false,
    monsters: [], gens: [], items: [], shots: [], eshots: [], fx: [], floats: [], torches: [], flash: 0, shake: 0, warn: {}, lastSpeech: '' };
  var view = { w: 800, h: 600, dpr: 1, s: 2, camX: 0, camY: 0, portrait: false, hudBottom: false };
  var staticCv = document.createElement('canvas'), TPX = 48, lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
  var dist = null, distT = 0, heroTile = -1;

  function heroDef() { return HEROES[G.sel]; }
  function theme() { return GA.THEMES[LEVELS[G.level].theme]; }
  function tileAt(tx, ty) { return tx < 0 || ty < 0 || tx >= G.W || ty >= G.H ? '#' : G.map[ty][tx]; }
  function solidTile(tx, ty) { var c = tileAt(tx, ty); return c === '#' || c === 'w' || c === 'D' || !!G.genAt[ty * G.W + tx]; }

  function loadLevel(n) {
    G.level = n; var L = LEVELS[n];
    G.map = L.rows.map(function (r) { return r.split(''); }); G.H = G.map.length; G.W = G.map[0].length;
    G.monsters = []; G.gens = []; G.items = []; G.shots = []; G.eshots = []; G.fx = []; G.floats = []; G.genAt = {}; G.whp = {};
    G.levelScore = G.score; G.levelT = 0; G.exits = null;
    var rk = L.rank;
    for (var y = 0; y < G.H; y++) for (var x = 0; x < G.W; x++) {
      var ch = G.map[y][x], cx = x * TS + TS / 2, cy = y * TS + TS / 2;
      if (ch === 'S') { G.hero = { x: cx, y: cy, dir: 2, anim: 0, cd: 0, mcd: 0, hurt: 0, moving: false, atk: 0 }; G.map[y][x] = '.'; }
      else if (GEN_CH[ch]) { var r = rk[0] + Math.floor(K.rand(0, rk[1] - rk[0] + 0.999)); var gen = { type: GEN_CH[ch], rank: r, hp: r * 2.5, x: cx, y: cy, tx: x, ty: y, cd: K.rand(1, 4), hitT: 0 }; G.gens.push(gen); G.genAt[y * G.W + x] = gen; G.map[y][x] = '.'; }
      else if (MON_CH[ch]) { spawnMonster(MON_CH[ch], cx, cy, MON_CH[ch] === 'death' ? 1 : rk[1]); G.map[y][x] = '.'; }
      else if (ITEM_CH[ch]) { G.items.push({ kind: ITEM_CH[ch], x: cx, y: cy, t: Math.random() * 10 }); G.map[y][x] = '.'; }
      else if (ch === 'w') G.whp[y * G.W + x] = 3;
    }
    G.rows = G.map.map(function (r) { return r.join(''); });
    // torches on wall faces, spaced out
    G.torches = [];
    for (y = 1; y < G.H - 1; y++) for (x = 1; x < G.W - 1; x++) {
      if (G.map[y][x] !== '#' || GA.isWall(G.map[y + 1][x])) continue;
      if (GA.util.hash(x, y, n + 5) > 0.2) continue;
      var near = G.torches.some(function (t) { return Math.abs(t.tx - x) + Math.abs(t.ty - y) < 5; });
      if (!near) G.torches.push({ tx: x, ty: y, x: x * TS + TS / 2, y: y * TS + TS * 0.66, ph: Math.random() * 10 });
    }
    paintStatic();
    dist = null; heroTile = -1;
    centerCamera(true);
  }
  function paintStatic() {
    if (!G.map) return;
    var want = K.clamp(Math.round(TS * view.s * view.dpr / 8) * 8, 32, 72);
    while (want > 32 && G.W * G.H * want * want > 14e6) want -= 8;
    TPX = want;
    GA.paintLevel(staticCv, G.rows, theme(), TPX);
    var g = staticCv.getContext('2d'), k = TPX / TS;
    G.torches.forEach(function (t) { g.save(); g.scale(k, k); GA.sconce(g, t.x, t.y, TS); g.restore(); });
  }
  function setTile(tx, ty, ch) {
    G.map[ty][tx] = ch; G.rows[ty] = G.map[ty].join('');
    GA.repaint(staticCv, G.rows, theme(), TPX, tx, ty);
    var g = staticCv.getContext('2d'), k = TPX / TS;
    G.torches.forEach(function (t) { if (Math.abs(t.tx - tx) <= 1 && Math.abs(t.ty - ty) <= 1) { g.save(); g.scale(k, k); GA.sconce(g, t.x, t.y, TS); g.restore(); } });
    dist = null;
  }

  function spawnMonster(type, x, y, rank) {
    var d = MON[type];
    var m = { type: type, rank: rank, x: x, y: y, r: d.r, hp: type === 'death' ? 999 : d.hp * rank, cd: K.rand(0.5, 2), anim: Math.random() * 4, face: 1, hitT: 0, vis: 1, visT: K.rand(1, 3), drained: 0, wake: 0 };
    G.monsters.push(m); return m;
  }

  /* ---------------- flow field toward the hero ---------------- */
  function buildDist() {
    var W = G.W, H = G.H, n = W * H;
    if (!dist || dist.length !== n) dist = new Int16Array(n);
    dist.fill(-1);
    var hx = Math.floor(G.hero.x / TS), hy = Math.floor(G.hero.y / TS), q = new Int32Array(n), qh = 0, qt = 0;
    var s0 = hy * W + hx; dist[s0] = 0; q[qt++] = s0;
    while (qh < qt) {
      var i = q[qh++], x = i % W, y = (i / W) | 0, dv = dist[i] + 1;
      if (dv > 60) continue;
      if (x > 0 && dist[i - 1] < 0 && !solidTile(x - 1, y)) { dist[i - 1] = dv; q[qt++] = i - 1; }
      if (x < W - 1 && dist[i + 1] < 0 && !solidTile(x + 1, y)) { dist[i + 1] = dv; q[qt++] = i + 1; }
      if (y > 0 && dist[i - W] < 0 && !solidTile(x, y - 1)) { dist[i - W] = dv; q[qt++] = i - W; }
      if (y < H - 1 && dist[i + W] < 0 && !solidTile(x, y + 1)) { dist[i + W] = dv; q[qt++] = i + W; }
    }
  }
  function flowDir(m, away) {
    if (!dist) buildDist();
    var W = G.W, tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS), here = dist[ty * W + tx];
    var best = null, bv = away ? -1 : (here < 0 ? 9999 : here);
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var nx = tx + dx, ny = ty + dy;
      if (solidTile(nx, ny)) continue;
      if (dx && dy && (solidTile(tx + dx, ty) || solidTile(tx, ty + dy))) continue;
      var v = dist[ny * W + nx]; if (v < 0) continue;
      if (away ? v > bv : v < bv) { bv = v; best = [nx * TS + TS / 2 - m.x, ny * TS + TS / 2 - m.y]; }
    }
    if (!best) return null;
    var l = Math.hypot(best[0], best[1]) || 1; return [best[0] / l, best[1] / l];
  }

  /* ---------------- movement and collision ---------------- */
  function blockedBox(x, y, r) {
    var x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r - 0.01) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r - 0.01) / TS);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (solidTile(tx, ty)) return { tx: tx, ty: ty };
    return null;
  }
  function overlapsMonster(e, x, y) {
    for (var i = 0; i < G.monsters.length; i++) { var m = G.monsters[i]; if (m === e || m.type === 'death' && e === G.hero) continue; var rr = m.r + ((e && e.r) || 11) - 3; if (Math.abs(m.x - x) < rr && Math.abs(m.y - y) < rr && (m.x - x) * (m.x - x) + (m.y - y) * (m.y - y) < rr * rr) return m; }
    return null;
  }
  function moveEnt(e, dx, dy, r, isHero) {
    var hitWall = null, b;
    if (dx) { b = blockedBox(e.x + dx, e.y, r); if (!b && (!isHero || !overlapsMonster(e, e.x + dx, e.y))) e.x += dx; else hitWall = hitWall || b; }
    if (dy) { b = blockedBox(e.x, e.y + dy, r); if (!b && (!isHero || !overlapsMonster(e, e.x, e.y + dy))) e.y += dy; else hitWall = hitWall || b; }
    return hitWall;
  }
  function los(x0, y0, x1, y1) {
    var d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 10);
    for (var i = 1; i < n; i++) { var t = i / n; if (solidTile(Math.floor((x0 + (x1 - x0) * t) / TS), Math.floor((y0 + (y1 - y0) * t) / TS))) return false; }
    return true;
  }

  /* ---------------- flow of play ---------------- */
  function toTitle() { G.state = 'title'; G.stateT = 0; G.paused = false; Mus.duck(false); Mus.play(Songs.title); I.clear(); }
  function newGame() {
    K.store.set('gauntlet.hero', G.sel);
    G.score = 0; G.health = 800; G.keys = 0; G.potions = 0; G.warn = {};
    startLevel(DEBUG && G.debugStart ? G.debugStart : 0);
    if (G.level === 0) setTimeout(function () { Voice.say('Welcome, ' + heroDef().name, 'welcome', 1000); }, 400);
  }
  function startLevel(n) {
    loadLevel(n); G.state = 'intro'; G.stateT = 0; G.paused = false; I.clear();
    Sfx.gong();
    Mus.play(Songs.game[Math.min(2, Math.floor(n / 4))]);
  }
  function levelDone() {
    G.state = 'exiting'; G.stateT = 0; Sfx.exit();
    var bonus = 250 * (G.level + 1); G.score += bonus; G.lastBonus = bonus;
    Mus.sting(Songs.clear);
  }
  function showSplash(kind) {
    G.state = 'splash'; Voice.cancel();
    var last = G.level >= LEVELS.length - 1, won = kind === 'clear';
    var title = won ? (last ? 'THE DUNGEON IS CONQUERED' : 'LEVEL ' + (G.level + 1) + ' CLEARED') : 'GAME OVER';
    var sub = won ? LEVELS[G.level].name + ' \u2022 Score ' + G.score + ' \u2022 Bonus ' + G.lastBonus : heroDef().name + ' fell on level ' + (G.level + 1) + ' \u2022 Score ' + G.score;
    var after = function () {
      canvas.focus();
      if (!won) { G.state = 'over'; G.stateT = 0; Mus.play(Songs.over); }
      else if (last) { G.state = 'victory'; G.stateT = 0; Mus.sting(Songs.victory, Songs.title); Voice.say(heroDef().name + ', you have conquered the dungeon!', 'victory', 1000); saveBest(); }
      else startLevel(G.level + 1);
    };
    if (window.ScoutSplash && ScoutSplash.show) {
      ScoutSplash.show({ kind: 'joust', campaign: 'gauntlet', tag: won ? (last ? 'victory' : 'wave' + (G.level + 1)) : 'gameover', title: title, sub: sub,
        contLabel: won ? (last ? 'See your victory' : 'Enter level ' + (G.level + 2)) : 'Continue', accent: '#ffb35a', glow: 'rgba(255,140,40,.3)', onContinue: after });
    } else after();
  }
  function saveBest() { var b = K.store.get('gauntlet.best', 0); if (G.score > b) K.store.set('gauntlet.best', G.score); }
  function retryLevel() { G.score = G.levelScore; G.health = 800; G.keys = 0; G.potions = Math.max(G.potions, 1); G.warn = {}; startLevel(G.level); }
  function setPaused(p) {
    if (G.state !== 'play' && G.state !== 'intro') p = false;
    G.paused = p; Mus.duck(p); if (p) Voice.cancel();
  }

  /* ---------------- update ---------------- */
  function hurt(dmg, src) {
    if (G.god) return;
    var d = dmg * (1 - heroDef().armor);
    G.health -= d; G.hero.hurt = 0.25; G.shake = Math.max(G.shake, Math.min(6, d * 0.4));
    if (src !== 'drain') Sfx.hurt();
  }
  function addScore(n, x, y, label) { G.score += n; if (x != null) float(x, y, label || ('+' + n), '#ffe08a'); }
  function float(x, y, text, col) { G.floats.push({ x: x, y: y, text: text, col: col || '#fff', t: 0 }); }
  function burst(x, y, col, n, spd, life, size) {
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = K.rand(0.3, 1) * (spd || 80); G.fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: K.rand(0.6, 1) * (life || 0.5), max: life || 0.5, col: col, size: size || 2.2 }); }
  }
  function killMonster(m, magic) {
    m.dead = true;
    if (m.type === 'death') addScore(1000, m.x, m.y - 10, '+1000');
    else addScore(MON[m.type].pts * m.rank, m.x, m.y - 10);
    if (m.type === 'ghost') burst(m.x, m.y, 'rgba(190,200,255,1)', 10, 60, 0.6, 2.6);
    else burst(m.x, m.y, m.type === 'demon' ? 'rgba(255,90,40,1)' : 'rgba(60,40,30,1)', 12, 90, 0.5, 2.6);
    if (!magic) Sfx.kill(m.type);
  }
  function damageGen(gen, d) {
    gen.hp -= d; gen.hitT = 0.15; Sfx.stone();
    burst(gen.x, gen.y, 'rgba(200,190,170,1)', 5, 70, 0.4, 2);
    if (gen.hp <= 0) {
      delete G.genAt[gen.ty * G.W + gen.tx]; gen.dead = true; dist = null;
      addScore(100 * gen.rank, gen.x, gen.y - 12);
      burst(gen.x, gen.y, 'rgba(255,170,80,1)', 26, 140, 0.8, 3); G.shake = 5; Sfx.genDie();
    } else gen.rank = Math.max(1, Math.ceil(gen.hp / 2.5));
  }
  function useMagic() {
    if (G.potions <= 0) { float(G.hero.x, G.hero.y - 20, 'NO POTIONS', '#9fc8ff'); return; }
    G.potions--; G.flash = 1; G.shake = 8; Sfx.magic();
    var hd = heroDef(), vx0 = view.camX, vy0 = view.camY, vx1 = vx0 + view.w / view.s, vy1 = vy0 + view.h / view.s;
    var inView = function (o) { return o.x > vx0 - 16 && o.x < vx1 + 16 && o.y > vy0 - 16 && o.y < vy1 + 16; };
    G.monsters.forEach(function (m) { if (!m.dead && inView(m)) killMonster(m, true); });
    G.gens.forEach(function (gn) { if (!gn.dead && inView(gn)) damageGen(gn, 2.6 * hd.magic); });
  }
  function openDoor(tx, ty) {
    var st = [[tx, ty]];
    while (st.length) {
      var p = st.pop(); if (tileAt(p[0], p[1]) !== 'D') continue;
      G.map[p[1]][p[0]] = '.';
      burst(p[0] * TS + 16, p[1] * TS + 16, 'rgba(160,110,60,1)', 4, 60, 0.5, 2.4);
      st.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]);
    }
    G.rows = G.map.map(function (r) { return r.join(''); });
    paintStatic(); dist = null;
    Sfx.door(); float(tx * TS + 16, ty * TS, 'DOOR OPENED', '#ffd27a');
  }
  function pickup(it) {
    var hd = heroDef(), h = G.hero;
    it.dead = true;
    if (it.kind === 'food' || it.kind === 'jug') { G.health += 100; Sfx.food(); float(h.x, h.y - 22, '+100 HEALTH', '#9cff9c'); burst(it.x, it.y, 'rgba(255,220,150,1)', 6, 40, 0.5, 2); }
    else if (it.kind === 'poison') { G.health -= 100; Sfx.poison(); float(h.x, h.y - 22, 'POISON -100', '#b6ff5a'); burst(it.x, it.y, 'rgba(120,255,60,1)', 10, 50, 0.7, 2.4); Voice.say(hd.name + ' has been poisoned!', 'poison', 8000); }
    else if (it.kind === 'potion') { G.potions++; Sfx.potion(); float(h.x, h.y - 22, 'POTION', '#8fd0ff'); addScore(50); }
    else if (it.kind === 'key') { G.keys++; Sfx.key(); float(h.x, h.y - 22, 'KEY', '#ffe08a'); addScore(100); }
    else if (it.kind === 'treasure') { addScore(100, h.x, h.y - 22); Sfx.treasure(); burst(it.x, it.y, 'rgba(255,220,90,1)', 10, 70, 0.6, 2); }
  }
  function moveInput() {
    var x = 0, y = 0;
    if (I.isDown('left')) x -= 1; if (I.isDown('right')) x += 1; if (I.isDown('up')) y -= 1; if (I.isDown('down')) y += 1;
    if (!x && !y && joy) { x = joy.x; y = joy.y; }
    if (!x && !y && I.axis) { x = I.axis.x; y = I.axis.y; }
    var m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return { x: x, y: y, m: Math.min(1, m) };
  }

  function update(dt) {
    G.t += dt; G.stateT += dt;
    G.flash = Math.max(0, G.flash - dt * 1.6); G.shake = Math.max(0, G.shake - dt * 20);
    G.items.forEach(function (it) { it.t += dt; });
    if (G.state === 'title') { if (I.hit('fire')) newGame(); return; }
    if (G.state === 'intro') { if (G.stateT > 2.6 || (G.stateT > 0.5 && (I.hit('fire') || I.hit('magic')))) { G.state = 'play'; G.stateT = 0; I.clear(); } updateFx(dt); centerCamera(); return; }
    if (G.state === 'exiting') { updateFx(dt); if (G.stateT > 1.5) showSplash('clear'); return; }
    if (G.state === 'dying') { updateFx(dt); if (G.stateT > 2.2) { Mus.play(Songs.over); showSplash('over'); } return; }
    if (G.state === 'over' || G.state === 'victory') { updateFx(dt); if (G.state === 'victory' && G.stateT > 2 && I.hit('fire')) toTitle(); if (G.state === 'over' && G.stateT > 1 && I.hit('fire')) retryLevel(); return; }
    if (G.state !== 'play') return;
    var hd = heroDef(), h = G.hero;
    G.levelT += dt;
    // life force drains slowly
    G.drainAcc = (G.drainAcc || 0) + dt;
    while (G.drainAcc > 0.6) { G.drainAcc -= 0.6; if (!G.god) G.health -= 1; }
    // hero
    var mv = moveInput(), firing = I.isDown('fire') || I.hit('fire');
    h.cd -= dt; h.mcd -= dt; h.hurt = Math.max(0, h.hurt - dt); h.atk = Math.max(0, h.atk - dt);
    if (mv.m > 0.2) h.dir = ((Math.round(Math.atan2(mv.y, mv.x) / (Math.PI / 4)) % 8) + 8) % 8;
    h.moving = false;
    if (!firing && mv.m > 0.2) {
      var sp = hd.spd * dt * mv.m, hw = moveEnt(h, mv.x * sp, mv.y * sp, 11, true);
      h.moving = true; h.anim += dt * hd.spd / 26;
      // keys open whole doors on touch
      if (hw && tileAt(hw.tx, hw.ty) === 'D') { if (G.keys > 0) { G.keys--; openDoor(hw.tx, hw.ty); } else if (!G.doorHintT || G.t - G.doorHintT > 3) { G.doorHintT = G.t; float(h.x, h.y - 24, 'NEED A KEY', '#ffd27a'); } }
    }
    if (firing && h.cd <= 0 && G.shots.length < 4) {
      h.cd = hd.rate; h.atk = 0.14;
      var a = h.dir * Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a);
      G.shots.push({ x: h.x + cs * 10, y: h.y + sn * 10, vx: cs * hd.shotSpd, vy: sn * hd.shotSpd, life: 1.3, dir: h.dir, spin: 0 });
      Sfx.shoot(hd.id);
    }
    if (I.hit('magic')) useMagic();
    // items
    for (var i = 0; i < G.items.length; i++) { var it = G.items[i]; if (!it.dead && Math.abs(it.x - h.x) < 18 && Math.abs(it.y - h.y) < 18) pickup(it); }
    // exit
    var etx = Math.floor(h.x / TS), ety = Math.floor(h.y / TS);
    if (tileAt(etx, ety) === 'E' && Math.abs(h.x - (etx * TS + 16)) < 12 && Math.abs(h.y - (ety * TS + 16)) < 12) { h.exitX = etx * TS + 16; h.exitY = ety * TS + 16; levelDone(); return; }
    // flow field
    distT -= dt; var ht = ety * G.W + etx;
    if (!dist || distT <= 0 || ht !== heroTile) { buildDist(); distT = 0.3; heroTile = ht; }
    updateShots(dt, hd); updateMonsters(dt, hd); updateGens(dt); updateEShots(dt); updateFx(dt);
    G.items = G.items.filter(function (o) { return !o.dead; });
    G.monsters = G.monsters.filter(function (o) { return !o.dead; });
    G.gens = G.gens.filter(function (o) { return !o.dead; });
    // health warnings in the narrator's voice
    var nm = hd.name, hp = G.health;
    [[300, nm + ', your life force is running out.', 'w300'], [200, nm + ' needs food, badly!', 'w200'], [100, nm + ' is about to die!', 'w100']].forEach(function (w) {
      if (hp < w[0] && !G.warn[w[2]]) { G.warn[w[2]] = true; Voice.say(w[1], w[2], 1000); float(h.x, h.y - 30, w[0] === 200 ? 'NEEDS FOOD, BADLY!' : w[0] === 100 ? 'ABOUT TO DIE!' : 'LIFE FORCE LOW', '#ff7a6a'); }
      else if (hp > w[0] + 80) G.warn[w[2]] = false;
    });
    if (G.health <= 0) { G.health = 0; G.state = 'dying'; G.stateT = 0; Sfx.death(); Mus.stop(); burst(h.x, h.y, 'rgba(255,80,60,1)', 30, 90, 1, 3); }
    centerCamera();
  }
  function updateShots(dt, hd) {
    G.shots.forEach(function (s) {
      s.spin += dt; s.life -= dt;
      var steps = 3;
      for (var k = 0; k < steps && s.life > 0; k++) {
        s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
        var tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS), c = tileAt(tx, ty);
        var gen = G.genAt[ty * G.W + tx];
        if (gen) { damageGen(gen, hd.shot); s.life = 0; break; }
        if (c === 'w') { var key = ty * G.W + tx; G.whp[key] = (G.whp[key] || 3) - 1; Sfx.stone(); burst(s.x, s.y, 'rgba(190,170,140,1)', 6, 80, 0.5, 2.4); if (G.whp[key] <= 0) { setTile(tx, ty, '.'); burst(tx * TS + 16, ty * TS + 16, 'rgba(160,140,120,1)', 18, 110, 0.7, 3); addScore(10); } s.life = 0; break; }
        if (c === '#' || c === 'D') { burst(s.x - s.vx * 0.01, s.y - s.vy * 0.01, 'rgba(255,220,160,1)', 4, 60, 0.25, 1.6); s.life = 0; break; }
        for (var i = 0; i < G.monsters.length; i++) {
          var m = G.monsters[i];
          if (m.dead || m.type === 'death' || (m.type === 'sorcerer' && m.vis < 0.5)) continue;
          if (Math.abs(m.x - s.x) < m.r + 4 && Math.abs(m.y - s.y) < m.r + 4) {
            m.hp -= hd.shot; m.hitT = 0.12;
            if (m.hp <= 0) killMonster(m); else Sfx.hit();
            if (!(hd.id === 'warrior' && m.dead)) s.life = 0; // the axe cleaves through what it kills
            if (s.life <= 0) break;
          }
        }
        if (s.life <= 0) break;
        for (var j = 0; j < G.items.length; j++) {
          var it = G.items[j];
          if (!it.dead && (it.kind === 'food' || it.kind === 'jug' || it.kind === 'poison') && Math.abs(it.x - s.x) < 11 && Math.abs(it.y - s.y) < 11) {
            it.dead = true; s.life = 0; burst(it.x, it.y, 'rgba(230,160,90,1)', 12, 80, 0.6, 2.4); Sfx.hit();
            if (it.kind !== 'poison') { float(it.x, it.y - 12, 'SHOT THE FOOD!', '#ff9a6a'); Voice.say(hd.name + ' shot the food!', 'shotfood', 4000); }
            break;
          }
        }
      }
    });
    G.shots = G.shots.filter(function (s) { return s.life > 0; });
  }
  function updateMonsters(dt, hd) {
    var h = G.hero, lvlK = 1 + G.level * 0.025, ms = G.monsters;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i]; if (m.dead) continue;
      var dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1;
      m.anim += dt * 5; m.hitT = Math.max(0, m.hitT - dt); m.cd -= dt;
      if (d > TS * 17) continue; // asleep far away
      var spd = MON[m.type].spd * lvlK * dt, dirv = null;
      if (m.type === 'sorcerer') { m.visT -= dt; if (m.visT <= 0) { m.visT = K.rand(0.8, 2); m.inv = !m.inv; } m.vis += ((m.inv ? 0.08 : 1) - m.vis) * Math.min(1, dt * 8); }
      if (m.type === 'lobber') {
        if (d < TS * 3) dirv = flowDir(m, true); else if (d > TS * 6) dirv = flowDir(m, false);
        if (m.cd <= 0 && d < TS * 9) { m.cd = K.rand(2.8, 4.0) / lvlK; m.throwT = 0.4; lob(m); }
        m.throwT = Math.max(0, (m.throwT || 0) - dt);
      } else if (m.type === 'death' || d < TS * 2.5) {
        dirv = d < TS * 2.5 && los(m.x, m.y, h.x, h.y) ? [dx / d, dy / d] : flowDir(m, false);
      } else dirv = flowDir(m, false);
      if (m.type === 'demon' && m.cd <= 0 && d < TS * 8 && d > TS * 1.5 && los(m.x, m.y, h.x, h.y)) {
        m.cd = K.rand(1.8, 3) / lvlK; Sfx.fire();
        G.eshots.push({ kind: 'fireball', x: m.x, y: m.y, vx: dx / d * 170, vy: dy / d * 170, life: 2.5 });
      }
      var touching = d < m.r + 11 + 2;
      if (dirv && !touching) {
        // separation from neighbours so crowds spread through corridors
        var sx = 0, sy = 0;
        for (var j = 0; j < ms.length; j++) { var o = ms[j]; if (o === m || o.dead) continue; var ox = m.x - o.x, oy = m.y - o.y; if (Math.abs(ox) < 20 && Math.abs(oy) < 20) { var od = Math.hypot(ox, oy) || 0.1; if (od < 20) { sx += ox / od * (20 - od) / 20; sy += oy / od * (20 - od) / 20; } } }
        var vx = dirv[0] + sx * 0.8, vy = dirv[1] + sy * 0.8, vl = Math.hypot(vx, vy) || 1;
        moveEnt(m, vx / vl * spd, vy / vl * spd, m.r - 1);
        if (Math.abs(vx) > 0.2) m.face = vx > 0 ? 1 : -1;
      }
      if (touching) {
        if (Math.abs(dx) > 2) m.face = dx > 0 ? 1 : -1;
        if (m.type === 'ghost') { hurt(MON.ghost.touch * m.rank); m.dead = true; burst(m.x, m.y, 'rgba(190,200,255,1)', 12, 60, 0.6, 2.6); A.tone({ f: 500, to: 90, dur: 0.3, type: 'sine', gain: 0.12 }); continue; }
        if (m.type === 'death') {
          var dr = 45 * dt; hurt(dr / (1 - hd.armor), 'drain'); m.drained += dr; if (Math.floor(G.t * 6) !== Math.floor((G.t - dt) * 6)) Sfx.drain();
          if (m.drained >= 200) { m.dead = true; burst(m.x, m.y, 'rgba(160,80,220,1)', 20, 70, 0.9, 3); float(m.x, m.y - 20, 'DEATH DEPARTS', '#d0a0ff'); }
          continue;
        }
        if (m.cd <= 0) { m.cd = 0.9; hurt(MON[m.type].hit * m.rank); m.lunge = 0.15; }
        // the hero fights back hand to hand
        if (h.mcd <= 0) { h.mcd = 0.42; m.hp -= hd.melee; m.hitT = 0.12; h.atk = 0.14; if (m.hp <= 0) killMonster(m); else Sfx.hit(); }
      }
      m.lunge = Math.max(0, (m.lunge || 0) - dt);
    }
  }
  function lob(m) {
    var h = G.hero, tx = h.x + K.rand(-10, 10), ty = h.y + K.rand(-10, 10), d = Math.hypot(tx - m.x, ty - m.y);
    G.eshots.push({ kind: 'rock', sx: m.x, sy: m.y, ex: tx, ey: ty, t: 0, T: K.clamp(d / 160, 0.6, 1.4), x: m.x, y: m.y, z: 0, life: 1 });
  }
  function updateEShots(dt) {
    var h = G.hero;
    G.eshots.forEach(function (s) {
      if (s.kind === 'fireball') {
        s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (solidTile(Math.floor(s.x / TS), Math.floor(s.y / TS))) { s.life = 0; burst(s.x, s.y, 'rgba(255,140,40,1)', 6, 60, 0.3, 2); }
        else if (Math.abs(s.x - h.x) < 12 && Math.abs(s.y - h.y) < 12) { s.life = 0; hurt(12); burst(s.x, s.y, 'rgba(255,140,40,1)', 10, 80, 0.4, 2.4); }
      } else {
        s.t += dt; var k = Math.min(1, s.t / s.T);
        s.x = s.sx + (s.ex - s.sx) * k; s.y = s.sy + (s.ey - s.sy) * k; s.z = Math.sin(k * Math.PI) * 46;
        if (k >= 1) { s.life = 0; Sfx.rock(); burst(s.x, s.y, 'rgba(170,160,150,1)', 8, 70, 0.4, 2.2); if (Math.hypot(s.x - h.x, s.y - h.y) < 20) hurt(8); }
      }
    });
    G.eshots = G.eshots.filter(function (s) { return s.life > 0; });
  }
  function updateGens(dt) {
    var h = G.hero, cap = 26 + G.level * 4;
    G.gens.forEach(function (gn) {
      gn.hitT = Math.max(0, gn.hitT - dt);
      if (Math.abs(gn.x - h.x) > TS * 11 || Math.abs(gn.y - h.y) > TS * 9) return;
      gn.cd -= dt; if (gn.cd > 0 || G.monsters.length >= cap) return;
      gn.cd = K.rand(2.2, 4.2) * (1 - G.level * 0.03);
      var opts = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && !solidTile(gn.tx + dx, gn.ty + dy)) opts.push([gn.tx + dx, gn.ty + dy]);
      if (!opts.length) return;
      var p = opts[Math.floor(Math.random() * opts.length)], x = p[0] * TS + 16, y = p[1] * TS + 16;
      if (overlapsMonster(null, x, y) || Math.hypot(x - h.x, y - h.y) < 24) return;
      var m = spawnMonster(gn.type, x, y, gn.rank); m.spawnT = 0.35;
    });
  }
  function updateFx(dt) {
    G.fx.forEach(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; });
    G.fx = G.fx.filter(function (p) { return p.life > 0; });
    G.floats.forEach(function (f) { f.t += dt; f.y -= dt * 22; });
    G.floats = G.floats.filter(function (f) { return f.t < 1.3; });
    G.monsters.forEach(function (m) { if (m.spawnT) m.spawnT = Math.max(0, m.spawnT - dt); });
  }
  function centerCamera(snap) {
    if (!G.hero || !G.map) return;
    var vw = view.w / view.s, vh = view.h / view.s, ww = G.W * TS, wh = G.H * TS;
    var hudPad = view.hudBottom ? 38 / view.s : 0;
    var tx = ww <= vw ? (ww - vw) / 2 : K.clamp(G.hero.x - vw / 2, 0, ww - vw);
    var ty = wh + hudPad <= vh ? (wh - vh) / 2 + hudPad / 2 : K.clamp(G.hero.y - vh / 2 + hudPad / 2, 0, wh - vh + hudPad);
    if (snap) { view.camX = tx; view.camY = ty; }
    else { view.camX += (tx - view.camX) * 0.18; view.camY += (ty - view.camY) * 0.18; }
  }

  /* ---------------- render ---------------- */
  function spr(name, dir, frame, rank, x, y, size, alpha, flip) {
    var c = GA.sprite(name, dir, frame, rank), s = size || 40;
    if (alpha != null && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(c, -s / 2, -s / 2, s, s); ctx.restore(); }
    else ctx.drawImage(c, x - s / 2, y - s / 2, s, s);
    ctx.globalAlpha = 1;
  }
  function render() {
    var c = ctx, W = canvas.width, H = canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#050304'; c.fillRect(0, 0, W, H);
    if (G.state === 'title') { renderTitle(); return; }
    if (!G.map) return;
    var s = view.s * view.dpr, sh = G.shake ? (Math.random() - 0.5) * G.shake : 0, sh2 = G.shake ? (Math.random() - 0.5) * G.shake : 0;
    var cx = view.camX + sh / view.s, cy = view.camY + sh2 / view.s;
    c.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    var k = TPX / TS, vx0 = Math.max(0, cx), vy0 = Math.max(0, cy), vw = Math.min(G.W * TS - vx0, view.w / view.s + 2), vh = Math.min(G.H * TS - vy0, view.h / view.s + 2);
    if (vw > 0 && vh > 0) c.drawImage(staticCv, vx0 * k, vy0 * k, vw * k, vh * k, vx0, vy0, vw, vh);
    var inV = function (x, y, m) { return x > cx - m && x < cx + view.w / view.s + m && y > cy - m && y < cy + view.h / view.s + m; };
    G.items.forEach(function (it) { if (!inV(it.x, it.y, 30)) return; var bob = it.kind === 'potion' || it.kind === 'key' ? Math.sin(it.t * 3) * 1.2 : 0; spr(it.kind, 0, Math.floor(it.t * 3) % 2, 0, it.x, it.y - 4 + bob, 34); });
    G.gens.forEach(function (gn) { if (!inV(gn.x, gn.y, 30)) return; spr('gen_' + gn.type, 0, Math.floor(G.t * 2.5) % 2, gn.rank, gn.x, gn.y - 3, 40); if (gn.hitT) { c.globalCompositeOperation = 'lighter'; spr('gen_' + gn.type, 0, 0, gn.rank, gn.x, gn.y - 3, 40, 0.5); c.globalCompositeOperation = 'source-over'; } });
    var acts = [];
    G.monsters.forEach(function (m) { if (inV(m.x, m.y, 30)) acts.push(m); });
    if (G.hero && G.state !== 'dying' && G.state !== 'over' && G.state !== 'victory') acts.push(G.hero);
    acts.sort(function (a, b) { return a.y - b.y; });
    var h = G.hero, hd = heroDef();
    acts.forEach(function (a) {
      if (a === h) {
        var fr = h.atk > 0 ? 4 : h.moving ? Math.floor(h.anim) % 4 : 0, size = 42;
        if (G.state === 'exiting' || G.state === 'splash') { var ex = Math.max(0.02, 1 - G.stateT / 1.2); if (G.state === 'splash') ex = 0.02; c.save(); c.translate(h.exitX, h.exitY); c.rotate(G.stateT * 8); c.scale(ex, ex); spr(hd.id, h.dir, 0, 0, 0, -4, size); c.restore(); return; }
        spr(hd.id, h.dir, fr, 0, h.x, h.y - 6, size, h.hurt > 0 && Math.floor(h.hurt * 30) % 2 ? 0.55 : 1);
        return;
      }
      var m = a, f = Math.floor(m.anim) % 2, sz = m.type === 'grunt' ? 40 : m.type === 'death' ? 44 : 38, al = m.type === 'sorcerer' ? m.vis : m.type === 'ghost' ? 0.92 : 1;
      if (m.spawnT) { al *= 1 - m.spawnT / 0.35; sz *= 1 - m.spawnT; }
      if (m.type === 'lobber' && m.throwT > 0) f = 1;
      var yy = m.y - 6 + (m.lunge ? -2 : 0) + (m.type === 'ghost' || m.type === 'death' ? Math.sin(m.anim * 0.8) * 1.5 : 0);
      spr(m.type, 0, f, m.rank, m.x, yy, sz, al, m.face < 0);
      if (m.hitT) { c.globalCompositeOperation = 'lighter'; spr(m.type, 0, f, m.rank, m.x, yy, sz, 0.6, m.face < 0); c.globalCompositeOperation = 'source-over'; }
    });
    G.shots.forEach(function (sh) {
      var fr = hd.id === 'warrior' ? Math.floor(sh.spin * 16) % 4 : Math.floor(sh.spin * 12) % 2;
      spr('shot_' + hd.id, hd.id === 'warrior' ? 0 : sh.dir, fr, 1, sh.x, sh.y, hd.id === 'wizard' ? 34 : 46);
    });
    G.eshots.forEach(function (sh) {
      if (sh.kind === 'fireball') spr('fireball', 0, Math.floor(G.t * 12) % 2, 3, sh.x, sh.y, 30);
      else { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(sh.x, sh.y + 4, 5, 2.4, 0, 0, TAU); c.fill(); spr('rock', 0, 0, 0, sh.x, sh.y - sh.z, 26); }
    });
    G.fx.forEach(function (p) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); });
    c.globalAlpha = 1;
    renderLight(cx, cy);
    c.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    c.globalCompositeOperation = 'lighter';
    var tc = theme().torch;
    G.torches.forEach(function (t) {
      if (!inV(t.x, t.y, 40)) return;
      var fl = 0.85 + Math.sin(G.t * 11 + t.ph) * 0.08 + Math.sin(G.t * 23 + t.ph * 2) * 0.06;
      var gr = c.createRadialGradient(t.x, t.y - 6, 0, t.x, t.y - 6, 26 * fl); gr.addColorStop(0, GA.util.rgba(tc, 0.45)); gr.addColorStop(1, GA.util.rgba(tc, 0)); c.fillStyle = gr; c.fillRect(t.x - 30, t.y - 36, 60, 60);
      c.fillStyle = GA.util.rgba(tc, 0.9); c.beginPath(); c.moveTo(t.x - 3.2, t.y - 3); c.quadraticCurveTo(t.x - 3 + Math.sin(G.t * 9 + t.ph), t.y - 10 * fl, t.x + Math.sin(G.t * 7 + t.ph) * 1.5, t.y - 14 * fl); c.quadraticCurveTo(t.x + 3, t.y - 8, t.x + 3.2, t.y - 3); c.fill();
      c.fillStyle = 'rgba(255,250,210,.95)'; c.beginPath(); c.ellipse(t.x, t.y - 5, 1.5, 3 * fl, 0, 0, TAU); c.fill();
    });
    if (hd.id === 'wizard') G.shots.forEach(function (sh) { var g2 = c.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 18); g2.addColorStop(0, 'rgba(120,180,255,.5)'); g2.addColorStop(1, 'rgba(60,120,255,0)'); c.fillStyle = g2; c.fillRect(sh.x - 18, sh.y - 18, 36, 36); });
    G.eshots.forEach(function (sh) { if (sh.kind === 'fireball') { var g3 = c.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 20); g3.addColorStop(0, 'rgba(255,120,40,.55)'); g3.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g3; c.fillRect(sh.x - 20, sh.y - 20, 40, 40); } });
    c.globalCompositeOperation = 'source-over';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    G.floats.forEach(function (f) { c.globalAlpha = Math.max(0, 1 - f.t / 1.3); c.font = '800 9px system-ui, sans-serif'; c.lineWidth = 2.4; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(f.text, f.x, f.y); c.fillStyle = f.col; c.fillText(f.text, f.x, f.y); });
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (G.flash > 0) { c.fillStyle = 'rgba(200,230,255,' + (G.flash * 0.7) + ')'; c.fillRect(0, 0, W, H); }
    var vmax = Math.max(W, H), vmin = Math.min(W, H);
    if (h && h.hurt > 0) { var vg = c.createRadialGradient(W / 2, H / 2, vmin * 0.3, W / 2, H / 2, vmax * 0.7); vg.addColorStop(0, 'rgba(160,0,0,0)'); vg.addColorStop(1, 'rgba(160,0,0,' + Math.min(0.5, h.hurt * 1.2) + ')'); c.fillStyle = vg; c.fillRect(0, 0, W, H); }
    if (G.health < 200 && G.state === 'play') { var pu = 0.18 + 0.12 * Math.sin(G.t * 6); var vg2 = c.createRadialGradient(W / 2, H / 2, vmin * 0.35, W / 2, H / 2, vmax * 0.75); vg2.addColorStop(0, 'rgba(120,0,0,0)'); vg2.addColorStop(1, 'rgba(120,0,0,' + pu + ')'); c.fillStyle = vg2; c.fillRect(0, 0, W, H); }
    renderHud();
    renderOverlayText();
  }
  function renderLight(cx, cy) {
    var c = ctx, th = theme(), ls = 0.5, lw = Math.ceil(canvas.width * ls), lh = Math.ceil(canvas.height * ls);
    if (lightCv.width !== lw || lightCv.height !== lh) { lightCv.width = lw; lightCv.height = lh; }
    var L = lctx, s = view.s * view.dpr * ls;
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = 'rgba(4,2,8,' + Math.min(0.8, th.dark + 0.14) + ')'; L.fillRect(0, 0, lw, lh);
    L.setTransform(s, 0, 0, s, -cx * s, -cy * s);
    L.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, a) { var g = L.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + a * 0.6 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.fillRect(x - r, y - r, r * 2, r * 2); }
    if (G.hero) hole(G.hero.x, G.hero.y, TS * 5.5, 1);
    G.torches.forEach(function (t) { var fl = 1 + Math.sin(G.t * 9 + t.ph) * 0.05; hole(t.x, t.y + 10, TS * 3.4 * fl, 0.9); });
    G.shots.forEach(function (sh) { hole(sh.x, sh.y, TS * 1.4, 0.6); });
    G.eshots.forEach(function (sh) { if (sh.kind === 'fireball') hole(sh.x, sh.y, TS * 1.6, 0.8); });
    G.gens.forEach(function (gn) { if (gn.type !== 'ghost') hole(gn.x, gn.y + 8, TS * 1.3, 0.5); });
    if (!G.exits) { G.exits = []; for (var y = 0; y < G.H; y++) for (var x = 0; x < G.W; x++) if (G.map[y][x] === 'E') G.exits.push([x * TS + 16, y * TS + 16]); }
    G.exits.forEach(function (e) { hole(e[0], e[1], TS * 2, 0.7); });
    L.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(lightCv, 0, 0, canvas.width, canvas.height);
  }
  function panel(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(36,24,16,.88)'); g.addColorStop(1, 'rgba(14,9,6,.9)'); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(200,150,80,.55)'; c.lineWidth = 1.2; c.stroke();
  }
  function renderHud() {
    var c = ctx, d = view.dpr, hd = heroDef();
    c.setTransform(d, 0, 0, d, 0, 0);
    var hpCol = G.health < 200 ? (Math.floor(G.t * 4) % 2 ? '#ff5a4a' : '#ffb0a0') : G.health < 400 ? '#ffd27a' : '#e8ffe0';
    if (view.hudBottom) {
      var y = view.h - 36, w = view.w;
      panel(c, 4, y, w - 8, 32, 8);
      c.drawImage(GA.sprite(hd.id, 2, 0, 0), 4, y - 8, 42, 42);
      c.textBaseline = 'middle'; c.textAlign = 'left';
      c.font = '700 9.5px system-ui, sans-serif'; c.fillStyle = '#c8a878'; c.fillText('HEALTH', 46, y + 10); c.fillText('SCORE', 104, y + 10);
      c.font = '900 16px system-ui, sans-serif'; c.fillStyle = hpCol; c.fillText(String(Math.ceil(G.health)), 46, y + 23);
      c.font = '800 14px system-ui, sans-serif'; c.fillStyle = '#ffe08a'; c.fillText(String(G.score), 104, y + 23);
      c.textAlign = 'right'; c.font = '700 9.5px system-ui, sans-serif'; c.fillStyle = '#d8c4a0'; c.fillText('LEVEL ' + (G.level + 1), w - 12, y + 10);
      invIcons(c, w - 10, y + 23, true);
    } else {
      var px = 10, py = 10;
      panel(c, px, py, 240, 76, 10);
      c.drawImage(GA.sprite(hd.id, 2, 0, 0), px, py + 4, 64, 64);
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.font = '800 12px system-ui, sans-serif'; c.fillStyle = '#f0d8a8'; c.fillText(hd.full.toUpperCase(), px + 64, py + 18);
      c.font = '700 10px system-ui, sans-serif'; c.fillStyle = '#c8a878'; c.fillText('HEALTH', px + 64, py + 34); c.fillText('SCORE', px + 140, py + 34);
      c.font = '900 20px system-ui, sans-serif'; c.fillStyle = hpCol; c.fillText(String(Math.ceil(G.health)), px + 64, py + 54);
      c.font = '800 17px system-ui, sans-serif'; c.fillStyle = '#ffe08a'; c.fillText(String(G.score), px + 140, py + 54);
      invIcons(c, px + 64, py + 67, false);
      c.textAlign = 'left'; c.font = '700 11px system-ui, sans-serif'; c.fillStyle = 'rgba(232,212,176,.9)'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3;
      var lt = 'LEVEL ' + (G.level + 1) + ' \u2022 ' + LEVELS[G.level].name.toUpperCase(); c.strokeText(lt, px + 4, py + 98); c.fillText(lt, px + 4, py + 98);
    }
  }
  function invIcons(c, x, y, rightAlign) {
    var items = [], i;
    for (i = 0; i < Math.min(6, G.keys); i++) items.push('key');
    for (i = 0; i < Math.min(6, G.potions); i++) items.push('potion');
    var step = 13, x0 = rightAlign ? x - items.length * step - 4 : x;
    items.forEach(function (n, j) { c.drawImage(GA.sprite(n, 0, 0, 0), x0 + j * step - 4, y - 10, 20, 20); });
    if (!items.length) { c.font = '600 9px system-ui, sans-serif'; c.fillStyle = 'rgba(200,170,120,.6)'; c.textAlign = rightAlign ? 'right' : 'left'; c.textBaseline = 'middle'; c.fillText('no keys \u2022 no potions', x, y); }
  }
  function bigText(c, text, x, y, size, col, glow) {
    c.font = '900 ' + size + 'px Georgia, "Times New Roman", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = Math.max(3, size * 0.12); c.strokeStyle = 'rgba(20,6,2,.95)'; c.strokeText(text, x, y);
    var g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, '#fff0c8'); g.addColorStop(0.5, col || '#e8a040'); g.addColorStop(1, '#8a3a10');
    if (glow) { c.shadowColor = glow; c.shadowBlur = size * 0.5; }
    c.fillStyle = g; c.fillText(text, x, y); c.shadowBlur = 0;
  }
  function fitFont(c, text, size, maxW) { c.font = '900 ' + size + 'px Georgia, serif'; var w = c.measureText(text).width; return w > maxW ? size * maxW / w : size; }
  function fitSmall(c, text, size, maxW, weight) { var f = size; c.font = weight + ' ' + f + 'px system-ui, sans-serif'; while (f > 8 && c.measureText(text).width > maxW) { f -= 0.5; c.font = weight + ' ' + f + 'px system-ui, sans-serif'; } }
  function renderOverlayText() {
    var c = ctx, d = view.dpr, W = view.w, H = view.h;
    c.setTransform(d, 0, 0, d, 0, 0); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (G.state === 'intro') {
      var a = Math.min(1, G.stateT * 3, (2.6 - G.stateT) * 3);
      c.globalAlpha = Math.max(0, a);
      var bh = 120, by = H * 0.42 - bh / 2;
      var g = c.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, 'rgba(10,4,2,.82)'); g.addColorStop(0.8, 'rgba(10,4,2,.82)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, by, W, bh);
      c.font = '700 13px system-ui, sans-serif'; c.fillStyle = '#c8a070'; c.fillText('LEVEL ' + (G.level + 1) + ' OF ' + LEVELS.length, W / 2, by + 24);
      var nm = LEVELS[G.level].name.toUpperCase(); bigText(c, nm, W / 2, by + 56, fitFont(c, nm, 34, W - 30), '#e8a040', 'rgba(255,120,30,.6)');
      var tip = LEVELS[G.level].tip; fitSmall(c, tip, 13, W - 24, '600'); c.fillStyle = '#e8dcc8'; c.fillText(tip, W / 2, by + 90);
      c.globalAlpha = 1;
    } else if (G.paused) {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H);
      bigText(c, 'PAUSED', W / 2, H * 0.36, 44, '#e8a040');
      c.font = '600 13px system-ui, sans-serif'; c.fillStyle = '#e8dcc8'; c.fillText('Press P, Esc or Start to resume', W / 2, H * 0.36 + 40);
    } else if (G.state === 'over') {
      c.fillStyle = 'rgba(0,0,0,.62)'; c.fillRect(0, 0, W, H);
      bigText(c, 'GAME OVER', W / 2, H * 0.3, fitFont(c, 'GAME OVER', 52, W - 30), '#d84030', 'rgba(255,40,20,.5)');
      var l1 = heroDef().full + ' fell on level ' + (G.level + 1) + ': ' + LEVELS[G.level].name; fitSmall(c, l1, 14, W - 24, '600'); c.fillStyle = '#e8dcc8'; c.fillText(l1, W / 2, H * 0.3 + 44);
      c.font = '800 16px system-ui, sans-serif'; c.fillStyle = '#ffe08a'; c.fillText('Score ' + G.score + '   \u2022   Best ' + Math.max(G.score, K.store.get('gauntlet.best', 0)), W / 2, H * 0.3 + 70);
    } else if (G.state === 'victory') {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(0, 0, W, H);
      var t = G.stateT;
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 50; i++) { var ang = i / 50 * TAU + t * 0.2, rr = 40 + ((t * 70 + i * 37) % (Math.max(W, H) * 0.6)); c.fillStyle = 'rgba(255,' + (150 + (i * 13) % 100) + ',60,' + Math.max(0, 0.6 - rr / Math.max(W, H)) + ')'; c.fillRect(W / 2 + Math.cos(ang) * rr, H * 0.34 + Math.sin(ang) * rr * 0.6, 3, 3); }
      c.globalCompositeOperation = 'source-over';
      bigText(c, 'VICTORY', W / 2, H * 0.17, fitFont(c, 'VICTORY', 60, W - 30), '#f0c040', 'rgba(255,200,60,.7)');
      var vs = Math.min(140, H * 0.28); c.drawImage(GA.sprite(heroDef().id, 2, Math.floor(t * 2) % 2 ? 4 : 0, 0), W / 2 - vs / 2, H * 0.24, vs, vs);
      var l2 = heroDef().full + ' conquered all ' + LEVELS.length + ' levels of the dungeon.'; fitSmall(c, l2, 15, W - 24, '700'); c.fillStyle = '#f0e0c0'; c.fillText(l2, W / 2, H * 0.24 + vs + 14);
      c.font = '800 18px system-ui, sans-serif'; c.fillStyle = '#ffe08a'; c.fillText('Final score ' + G.score, W / 2, H * 0.24 + vs + 40);
    } else if (G.state === 'dying') {
      c.fillStyle = 'rgba(60,0,0,' + Math.min(0.55, G.stateT * 0.4) + ')'; c.fillRect(0, 0, W, H);
      var dt2 = heroDef().name.toUpperCase() + ' HAS FALLEN'; bigText(c, dt2, W / 2, H * 0.4, fitFont(c, dt2, 40, W - 30), '#d84030');
    }
  }

  /* ---------------- title / hero select ---------------- */
  var cards = [];
  function titleKey(e) {
    var c = e.code;
    if (I.listening || !settingsEl.hidden) return;
    if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) newGame(); return false; }
    if (/^Digit[1-4]$/.test(c)) { G.sel = +c.slice(5) - 1; Sfx.tick(); return false; }
  }
  function renderTitle() {
    var c = ctx, d = view.dpr, W = view.w, H = view.h, t = G.t;
    c.setTransform(d, 0, 0, d, 0, 0);
    if (!G.titleBg || G.titleBg.w !== W || G.titleBg.h !== H) {
      var rows = [], tw = Math.ceil(W / 48) + 2, th = Math.ceil(H / 48) + 2;
      for (var y = 0; y < th; y++) { var r = ''; for (var x = 0; x < tw; x++) r += (y < 2 || x === 0 || x === tw - 1 || ((x % 7 === 3) && y % 5 !== 2)) ? '#' : '.'; rows.push(r); }
      var bc = document.createElement('canvas'), bk = Math.min(2, d); GA.paintLevel(bc, rows, GA.THEMES[0], Math.round(48 * bk));
      G.titleBg = { w: W, h: H, cv: bc, k: bk };
    }
    c.drawImage(G.titleBg.cv, 0, 0, G.titleBg.cv.width / G.titleBg.k, G.titleBg.cv.height / G.titleBg.k);
    var vg = c.createRadialGradient(W / 2, H * 0.35, 30, W / 2, H * 0.4, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(30,10,0,.3)'); vg.addColorStop(1, 'rgba(0,0,0,.9)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
    var fl = 0.8 + Math.sin(t * 7) * 0.05 + Math.sin(t * 17) * 0.04;
    c.globalCompositeOperation = 'lighter';
    var tg = c.createRadialGradient(W / 2, 70, 0, W / 2, 70, 260 * fl); tg.addColorStop(0, 'rgba(255,120,30,.35)'); tg.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = tg; c.fillRect(0, 0, W, 360);
    c.globalCompositeOperation = 'source-over';
    var portrait = view.portrait, top = view.w < 640 ? 52 : 22;
    var ts = Math.min(portrait ? 54 : 82, W / 6.2, H / 9);
    bigText(c, 'GAUNTLET', W / 2, top + ts * 0.6, ts, '#e07a28', 'rgba(255,100,20,.55)');
    c.font = '600 ' + (portrait ? 12 : 14) + 'px system-ui, sans-serif'; c.fillStyle = '#e8d2a8'; c.textAlign = 'center';
    c.fillText('Choose your hero', W / 2, top + ts * 1.35);
    cards = [];
    var cols = portrait ? 2 : 4, gap = portrait ? 10 : 16, avail = W - 24, cw = Math.min(portrait ? 190 : 230, (avail - gap * (cols - 1)) / cols);
    var footer = portrait ? 44 : 64, ytop = top + ts * 1.35 + 14, availH = H - ytop - footer;
    var ch = Math.min(portrait ? 300 : 360, (availH - (portrait ? gap : 0)) / (portrait ? 2 : 1));
    var x0 = (W - (cw * cols + gap * (cols - 1))) / 2;
    HEROES.forEach(function (hd, i) {
      var cx = x0 + (i % cols) * (cw + gap), cy = ytop + Math.floor(i / cols) * (ch + gap), sel = i === G.sel;
      cards.push({ x: cx, y: cy, w: cw, h: ch, i: i });
      c.save();
      c.beginPath(); c.moveTo(cx + 12, cy); c.arcTo(cx + cw, cy, cx + cw, cy + ch, 12); c.arcTo(cx + cw, cy + ch, cx, cy + ch, 12); c.arcTo(cx, cy + ch, cx, cy, 12); c.arcTo(cx, cy, cx + cw, cy, 12); c.closePath();
      var g = c.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, sel ? 'rgba(70,36,14,.92)' : 'rgba(30,20,14,.85)'); g.addColorStop(1, sel ? 'rgba(26,12,4,.95)' : 'rgba(12,8,6,.9)');
      c.fillStyle = g; c.fill(); c.lineWidth = sel ? 2.5 : 1.2; c.strokeStyle = sel ? '#ffc060' : 'rgba(200,150,90,.4)'; if (sel) { c.shadowColor = 'rgba(255,150,40,.7)'; c.shadowBlur = 18; } c.stroke(); c.shadowBlur = 0;
      c.clip();
      var spH = Math.min(cw * 0.95, ch * (portrait ? 0.52 : 0.52)), fr = sel ? Math.floor(t * 6) % 4 : 0;
      var lg = c.createRadialGradient(cx + cw / 2, cy + spH * 0.6, 0, cx + cw / 2, cy + spH * 0.6, spH * 0.7); lg.addColorStop(0, sel ? 'rgba(255,160,60,.35)' : 'rgba(255,160,60,.12)'); lg.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = lg; c.fillRect(cx, cy, cw, spH * 1.3);
      var dir = sel ? [2, 1, 0, 1, 2, 3, 4, 3][Math.floor(t * 0.8) % 8] : 2;
      c.drawImage(GA.sprite(hd.id, dir, fr, 0), cx + cw / 2 - spH / 2, cy + 2, spH, spH);
      var ty = cy + spH + 6;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + (portrait ? 16 : 19) + 'px Georgia, serif'; c.fillStyle = sel ? '#ffe2a8' : '#e0c8a0'; c.fillText(hd.name.toUpperCase(), cx + cw / 2, ty + 4);
      var showBlurb = !portrait || ch > 270;
      if (showBlurb) { c.font = '500 ' + (portrait ? 10 : 11.5) + 'px system-ui, sans-serif'; c.fillStyle = '#c8b090'; wrapText(c, hd.blurb, cx + cw / 2, ty + 22, cw - 16, portrait ? 12 : 14); }
      var rowH = portrait ? 12 : 16, by = ty + (showBlurb ? (portrait ? 46 : 54) : 20), bw = cw - 20;
      BAR_NAMES.forEach(function (bn, k) {
        if (by + k * rowH + 4 > cy + ch - 2) return;
        c.textAlign = 'left'; c.font = '600 ' + (portrait ? 9 : 10.5) + 'px system-ui, sans-serif'; c.fillStyle = '#b89c78'; c.fillText(bn, cx + 10, by + k * rowH);
        var bx = cx + 10 + bw * 0.44, bl = bw * 0.56;
        for (var p = 0; p < 5; p++) { c.fillStyle = p < hd.bars[k] ? (sel ? '#ff9a3a' : '#c8823a') : 'rgba(255,255,255,.1)'; c.fillRect(bx + p * bl / 5, by + k * rowH - 3, bl / 5 - 2, portrait ? 6 : 7); }
      });
      c.restore();
    });
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f0dcb8';
    var hint = K.isTouch ? 'Tap a hero to choose, tap again to enter the dungeon' : '\u2190 \u2192 choose your hero  \u2022  Space or Enter to begin  \u2022  X uses a potion';
    fitSmall(c, hint, portrait ? 11.5 : 13, W - 16, '600'); c.fillText(hint, W / 2, H - footer + (portrait ? 16 : 24));
    var best = K.store.get('gauntlet.best', 0), l2 = '12 levels \u2022 find keys, eat food, smash the generators' + (best ? ' \u2022 Best ' + best : '');
    fitSmall(c, l2, portrait ? 10 : 11.5, W - 16, '500'); c.fillStyle = 'rgba(220,190,150,.75)'; c.fillText(l2, W / 2, H - footer + (portrait ? 32 : 44));
  }
  function wrapText(c, text, x, y, maxW, lh) {
    var words = text.split(' '), line = '', n = 0;
    for (var i = 0; i < words.length; i++) { var tst = line ? line + ' ' + words[i] : words[i]; if (c.measureText(tst).width > maxW && line) { c.fillText(line, x, y + n * lh); n++; line = words[i]; } else line = tst; }
    if (line) c.fillText(line, x, y + n * lh);
  }

  /* ---------------- layout ---------------- */
  var touchEl = document.getElementById('touch'), touchPref = K.store.get('gauntlet.touch', 'auto');
  function touchWanted() { return touchPref === 'on' || (touchPref === 'auto' && K.isTouch); }
  function resize() {
    var landscape = innerWidth > innerHeight;
    touchEl.hidden = !touchWanted(); touchEl.classList.toggle('landscape', landscape);
    document.body.classList.toggle('is-touch', touchWanted());
    var r = wrap.getBoundingClientRect(), cw = Math.max(200, r.width), ch = Math.max(160, r.height);
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * view.dpr); canvas.height = Math.round(ch * view.dpr);
    view.w = cw; view.h = ch; view.portrait = ch > cw * 1.05; view.hudBottom = cw < 600;
    var oldS = view.s;
    view.s = Math.max(Math.min(cw, ch) / ((view.portrait ? 10 : 11) * TS), Math.max(cw, ch) / (20 * TS));
    GA.setScale(view.s * view.dpr * 1.05);
    if (G.map && Math.abs(oldS - view.s) > 0.01) paintStatic();
    G.titleBg = null;
    centerCamera(true);
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
  muteBtn.addEventListener('click', function () { A.toggle(); canvas.focus(); });
  pauseBtn.addEventListener('click', function () { A.unlock(); setPaused(!G.paused); canvas.focus(); });
  document.getElementById('btn-full').addEventListener('click', function () {
    var dd = document; if (dd.fullscreenElement) dd.exitFullscreen(); else if (dd.documentElement.requestFullscreen) dd.documentElement.requestFullscreen().catch(function () { });
  });
  var panelUI = K.settings({ input: I, body: document.getElementById('keys-body'), actions: ACTIONS, msg: document.getElementById('keys-msg') });
  var wasPaused = false;
  function openSettings() { wasPaused = G.paused; setPaused(true); settingsEl.hidden = false; panelUI.render(); document.getElementById('settings-close').focus(); }
  function closeSettings() { settingsEl.hidden = true; if (!wasPaused) setPaused(false); canvas.focus(); }
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('keys-reset').addEventListener('click', function () { I.reset(); panelUI.render(); document.getElementById('keys-msg').textContent = 'Defaults restored.'; });
  var optSound = document.getElementById('opt-sound'), optMusic = document.getElementById('opt-music'), optVoice = document.getElementById('opt-voice'), optTouch = document.getElementById('opt-touch');
  optSound.addEventListener('change', function () { A.unlock(); A.setMuted(!optSound.checked); });
  optMusic.checked = Mus.enabled; optMusic.addEventListener('change', function () { A.unlock(); Mus.setEnabled(optMusic.checked); });
  var voiceOn = K.store.get('gauntlet.voice', true); optVoice.checked = voiceOn;
  optVoice.addEventListener('change', function () { voiceOn = optVoice.checked; K.store.set('gauntlet.voice', voiceOn); if (!voiceOn) Voice.cancel(); });
  var rawSay = Voice.say; Voice.say = function (a, b, cc) { if (voiceOn) rawSay(a, b, cc); };
  optTouch.value = touchPref; optTouch.addEventListener('change', function () { touchPref = optTouch.value; K.store.set('gauntlet.touch', touchPref); resize(); });
  K.bindTouch(touchEl, I, function () { A.unlock(); });
  // virtual stick
  var stick = document.getElementById('stick'), knob = document.getElementById('knob'), stickId = null;
  function stickMove(e) {
    var r = stick.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2), m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; m = 1; }
    knob.style.transform = 'translate(' + (x * r.width * 0.3) + 'px,' + (y * r.height * 0.3) + 'px)';
    joy = m > 0.22 ? { x: x, y: y } : null;
    if (G.state === 'title' && joy && Math.abs(x) > 0.6 && !stick.dirLatch) { stick.dirLatch = true; G.sel = (G.sel + (x > 0 ? 1 : 3)) % 4; Sfx.tick(); }
    if (Math.abs(x) < 0.3) stick.dirLatch = false;
  }
  stick.addEventListener('pointerdown', function (e) { e.preventDefault(); A.unlock(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (x) { } stickMove(e); });
  stick.addEventListener('pointermove', function (e) { if (e.pointerId === stickId) stickMove(e); });
  function stickUp(e) { if (e.pointerId !== stickId) return; stickId = null; joy = null; knob.style.transform = ''; stick.dirLatch = false; }
  stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp); stick.addEventListener('lostpointercapture', stickUp);
  canvas.addEventListener('pointerdown', function (e) {
    A.unlock(); canvas.focus();
    if (G.state === 'title') {
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (var i = 0; i < cards.length; i++) { var cd = cards[i]; if (x >= cd.x && x <= cd.x + cd.w && y >= cd.y && y <= cd.y + cd.h) { if (G.sel === cd.i || e.pointerType === 'mouse') { G.sel = cd.i; newGame(); } else { G.sel = cd.i; Sfx.tick(); } break; } }
    } else if (G.state === 'intro' && G.stateT > 0.4) { G.state = 'play'; G.stateT = 0; }
    else if (G.paused) setPaused(false);
    e.preventDefault();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && (G.state === 'play' || G.state === 'intro')) setPaused(true); });
  syncMute();

  /* ---------------- shared overlay: Resume / Retry / Play again + Main menu ---------------- */
  var ov = window.ArcadeOverlay ? window.ArcadeOverlay.mount(wrap) : null;
  function syncOverlay(splash) {
    if (!ov) return;
    if (splash || !settingsEl.hidden) ov.hide();
    else if (G.paused) ov.show({ primary: { label: '\u25B6 Resume', onClick: function () { setPaused(false); canvas.focus(); } }, secondary: { label: 'Change hero', onClick: function () { toTitle(); } } });
    else if (G.state === 'over' && G.stateT > 0.6) ov.show({ primary: { label: '\u21BB Retry level ' + (G.level + 1), onClick: function () { retryLevel(); canvas.focus(); } }, secondary: { label: 'New game', onClick: function () { toTitle(); } } });
    else if (G.state === 'victory' && G.stateT > 1.5) ov.show({ primary: { label: '\u21BB Play again', onClick: function () { toTitle(); } } });
    else ov.hide();
  }

  /* ---------------- main loop ---------------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    I.pollPad();
    if (I.hit('mute')) A.toggle();
    if (I.hit('pause')) setPaused(!G.paused);
    var splash = window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen();
    if (G.state === 'title' && settingsEl.hidden) {
      if (I.hit('left')) { G.sel = (G.sel + 3) % 4; Sfx.tick(); }
      if (I.hit('right')) { G.sel = (G.sel + 1) % 4; Sfx.tick(); }
      if (I.hit('up') || I.hit('down')) { if (view.portrait) { G.sel = (G.sel + 2) % 4; Sfx.tick(); } }
    }
    if (!G.paused && !splash && settingsEl.hidden) { var n = dt > 0.025 ? 2 : 1; for (var i = 0; i < n; i++) update(dt / n); }
    else { if (splash || !settingsEl.hidden) I.clear(); G.t += dt; }
    syncOverlay(splash);
    try { render(); } catch (err) { if (DEBUG) throw err; }
    requestAnimationFrame(frame);
  }
  resize(); toTitle();
  requestAnimationFrame(frame);

  window.GauntletGame = { version: 1, levels: LEVELS.length, heroes: HEROES.map(function (h) { return h.id; }),
    state: function () { return { state: G.state, level: G.level, hero: heroDef().id, score: G.score, health: Math.ceil(G.health), keys: G.keys, potions: G.potions, monsters: G.monsters.length, generators: G.gens.length, paused: G.paused, muted: A.muted, music: Mus.current, lastSpeech: G.lastSpeech }; } };
  if (DEBUG) {
    window.GauntletGame.debug = {
      G: G, sfx: Sfx, voice: Voice,
      start: function (hero, level) { if (hero != null) G.sel = hero; G.debugStart = level || 0; newGame(); G.state = 'play'; },
      exit: function () { if (G.state === 'play') levelDone(); },
      god: function (on) { G.god = on !== false; },
      give: function (keys, potions) { G.keys += keys || 0; G.potions += potions || 0; },
      hurt: function (n) { G.health -= n; },
      tele: function (tx, ty) { G.hero.x = tx * TS + 16; G.hero.y = ty * TS + 16; centerCamera(true); }
    };
  }
})();

/* Rampart Space Edition: fortify an orbital station, arm it, hold the line, rebuild. 24 levels plus a
   secret one, each bringing one new weapon, threat, character or surprise. Painted space (planets with
   atmospheres, nebulae, parallax stars), synthesized sound and music. Photosensitivity-safe: no large
   or full-screen bright flashes, nothing flashes faster than 3 times a second; explosions stay local.
   Original code, art and sound, built from scratch. Written by: Howie */
(function () {
  'use strict';
  var TAU = Math.PI * 2, DEBUG = /(?:^|[?&])debug=1(?:&|$)/.test(location.search);
  var canvas = document.getElementById('game'), wrap = document.getElementById('wrap'), ctx = canvas.getContext('2d');
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('rse.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('rse.' + k, JSON.stringify(v)); } catch (e) { } }
  };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function hyp(x, y) { return Math.sqrt(x * x + y * y); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------------- world + station grid ---------------- */
  var WW = 1600, WH = 900, CELL = 36, COLS = 18, ROWS = 20, GX = 40, GY = 90, GR = GX + COLS * CELL; // grid spans x 40..688, y 90..810
  var EMPTY = 0, HULL = 1, CORE = 2, TUR = 3, ROCK = 4, WELL = 5;
  function idx(c, r) { return r * COLS + c; }
  function inG(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
  function cellX(c) { return GX + c * CELL + CELL / 2; }
  function cellY(r) { return GY + r * CELL + CELL / 2; }

  /* ---------------- levels: one new thing per level ---------------- */
  var NEW = {
    1: ['fighter', 'Fighters and lasers', 'Red Hegemony fighters strafe your hull. Your turrets fire <b>laser beams</b> wherever you aim.'],
    2: ['torpedo', 'Photon torpedoes', 'New weapon! Press <b>Switch</b> (E) for <b>photon torpedoes</b>: slow, glowing, they <b>home in</b> on the ship nearest your aim and hit hard.'],
    3: ['bomber', 'Bombers', 'Heavy <b>bombers</b> fly close and drop bombs that blast a 3x3 hole. You can shoot the falling bombs.'],
    4: ['emp', 'EMP special', 'Your <b>Special</b> button (Q) is live. Kills and salvage charge it. When full, an <b>EMP wave</b> stuns every ship and wipes enemy shots.'],
    5: ['asteroid', 'Asteroid storm', 'Rocks drift through the battle. They smash any hull they touch. Break big ones before they reach you.'],
    6: ['rail', 'Railgun', 'New weapon: the <b>railgun</b>. Slow to reload, but the slug punches through <b>every</b> ship in a line.'],
    7: ['rammer', 'Desperate rammers', 'Badly damaged ships now <b>glow red</b> for a moment, then dive at your hull to ram it. Finish them while they glow!'],
    8: ['shield', 'Deflector shields', 'Your station has a <b>shield</b> (blue bar). It soaks enemy shots and slowly recharges.'],
    9: ['pirate', 'Space pirates', 'Purple <b>pirates</b> raid both sides. They shoot the Hegemony and you, and they <b>steal salvage</b> crates before they drift home to you.'],
    10: ['boss1', 'Boss: the Mothership', 'A <b>Hegemony mothership</b> comes in the second battle. It launches fighters and fires heavy beams. Something big may happen to that moon...'],
    11: ['missile', 'Missiles', 'New weapon: <b>missiles</b> fly to your aim point and burst, hitting everything nearby. Great against swarms.'],
    12: ['comet', 'Comet slingshot', 'A <b>comet</b> streaks past. Tap or click it to <b>grab</b> it, move your aim, then fire to <b>fling</b> it into the enemy.'],
    13: ['carrier', 'Carriers and capital ships', '<b>Carriers</b> launch fighters until destroyed. <b>Capital ships</b> fire heavy shells that blow 2x2 holes. Focus fire on them.'],
    14: ['plasma', 'Plasma cannon', 'New weapon: <b>plasma</b>. A big slow bolt that melts heavy ships and splashes nearby ones.'],
    15: ['pods', 'Boarding pods', 'Small <b>boarding pods</b> latch onto your hull and cut through after a few seconds. Shoot them off fast.'],
    16: ['blackhole', 'Black hole', 'A <b>black hole</b> sits in the battlefield. It <b>bends your shots</b> and pulls ships in. Aim around it, or let it eat them.'],
    17: ['wormhole', 'Wormhole ambush', 'Watch the top and bottom edges: <b>wormholes</b> open behind your lines and drop enemies in at close range.'],
    18: ['flare', 'Solar flare', 'The local star flares. When the warning shows, a warm glow builds and your <b>shields go offline</b> for a few seconds.'],
    19: ['scout', 'Scout joins the fight', '<b>Scout</b> is your wingman drone, with two helper drones. They follow your aim and shoot on their own.'],
    20: ['derelict', 'Derelict alien station', 'An ancient station drifts by. Shoot it apart to <b>salvage a secret weapon</b>.'],
    21: ['gwell', 'Gravity-well turrets', 'In the turret step, press <b>Switch</b> to place a <b>gravity well</b>. It fires a singularity that pulls ships together and smashes them into each other.'],
    22: ['escort', 'Escort frigate', 'A friendly <b>escort frigate</b> fights beside you this level. Good to have friends... right?'],
    23: ['overdrive', 'Overdrive', 'Your Special now also triggers <b>overdrive</b>: enemy ships and shots slow to a crawl for 5 seconds.'],
    24: ['supernova', 'Supernova finale', 'The star is going <b>supernova</b>. Hold out until the countdown ends, then your station jumps to safety. Everything is coming for you.'],
    25: ['nebula', "Secret level: Scout's Nebula", "You found it! Scout's favorite nebula. Gentle space jellies, salvage everywhere, big points. Have fun."]
  };
  var NAMES = ['First Watch', 'Torpedo Run', 'Bomb Alley', 'Static Storm', 'Rock Rain', 'Rail Line', 'Last Resort', 'Blue Wall', 'Black Flags', 'Moonbreaker',
    'Missile Command', 'Ice Comet', 'Heavy Metal', 'Plasma Dawn', 'Boarders', 'Event Horizon', 'Backdoor', 'Hot Sky', 'Good Boy', 'Ghost Station',
    'Gravity Games', 'Trust Issues', 'Slow Motion', 'Supernova', "Scout's Nebula"];
  var LAST = 24, SECRET = 25;
  var FEAT = { torpedo: 2, bomber: 3, emp: 4, asteroid: 5, rail: 6, rammer: 7, shield: 8, pirate: 9, missile: 11, comet: 12, carrier: 13, plasma: 14, pods: 15, blackhole: 16, wormhole: 17, flare: 18, scout: 19, gwell: 21, overdrive: 23 };
  function has(k) { return G.level !== SECRET ? G.level >= FEAT[k] : (k === 'torpedo' || k === 'rail' || k === 'missile' || k === 'plasma' || k === 'emp' || k === 'shield' || k === 'scout' || k === 'comet'); }
  // planets and palettes rotate through the campaign
  var WORLDS = [
    { planet: 'earth', pc: ['#2a6bd8', '#1b8a4a', '#d8c79a'], atm: '120,190,255', moon: true, neb: ['40,70,160', '120,40,140'], sun: [1450, 120] },
    { planet: 'gas', pc: ['#d9a066', '#a0623a', '#f1d7aa'], atm: '255,200,140', moon: true, ring: true, neb: ['150,60,40', '60,40,120'], sun: [1500, 760] },
    { planet: 'ice', pc: ['#9fd8ff', '#e8f6ff', '#5aa0d0'], atm: '170,230,255', moon: true, neb: ['30,90,140', '30,40,90'], sun: [1400, 90] },
    { planet: 'lava', pc: ['#3a1a14', '#ff6a2a', '#6a2a1a'], atm: '255,120,60', moon: true, neb: ['150,30,30', '80,20,60'], sun: [1480, 140] },
    { planet: 'desert', pc: ['#c97a4a', '#e8b07a', '#8a4a2a'], atm: '255,190,150', moon: true, neb: ['120,60,30', '40,60,120'], sun: [1500, 820] },
    { planet: 'violet', pc: ['#6a4ad8', '#3a2a8a', '#b090ff'], atm: '200,160,255', moon: true, ring: true, neb: ['90,30,150', '30,90,150'], sun: [1420, 110] }
  ];
  function worldFor(n) { if (n === SECRET) return { planet: 'gas', pc: ['#ff9fd6', '#9fd8ff', '#fff0a0'], atm: '255,190,240', moon: false, ring: true, neb: ['200,80,170', '80,170,220'], sun: [1450, 120], pastel: true }; if (n === 10) return WORLDS[0]; if (n === LAST) return { planet: 'lava', pc: ['#2a1410', '#ff7a3a', '#5a2414'], atm: '255,150,80', moon: false, neb: ['170,60,30', '90,30,60'], sun: [1380, 160], nova: true }; return WORLDS[Math.floor((n - 1) / 4) % WORLDS.length]; }

  /* ---------------- audio: tiny synth + music ---------------- */
  var AC = null, master = null, musicBus = null, sfxBus = null, muted = store.get('muted', false);
  function unlockAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    AC = new C(); master = AC.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(AC.destination);
    sfxBus = AC.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master); musicBus = AC.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  }
  function setMuted(m) { muted = m; store.set('muted', m); if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, AC.currentTime, 0.05); syncMute(); }
  function tone(o) {
    if (!AC || muted) return; var t = AC.currentTime + (o.delay || 0), os = AC.createOscillator(), g = AC.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t); if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.att || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    var n = os; if (o.lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); n = f; }
    n.connect(g); g.connect(o.bus || sfxBus); os.start(t); os.stop(t + o.dur + 0.05);
  }
  var noiseBuf = null;
  function noise(o) {
    if (!AC || muted) return; if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = AC.currentTime + (o.delay || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f || 1200, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    g.gain.setValueAtTime(o.gain || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + o.dur + 0.05);
  }
  var lastSfx = {};
  function rate(k, ms) { var n = performance.now(); if (lastSfx[k] && n - lastSfx[k] < ms) return false; lastSfx[k] = n; return true; }
  var Sfx = {
    laser: function () { if (rate('laser', 60)) tone({ type: 'sawtooth', f: 1400, to: 380, dur: 0.14, gain: 0.05, lp: 3000 }); },
    torpedo: function () { if (rate('torp', 80)) { tone({ type: 'sine', f: 220, to: 660, dur: 0.35, gain: 0.08 }); noise({ f: 800, to: 2400, dur: 0.3, gain: 0.05, ft: 'bandpass' }); } },
    rail: function () { if (rate('rail', 90)) { tone({ type: 'square', f: 90, to: 40, dur: 0.25, gain: 0.08, lp: 900 }); noise({ f: 6000, to: 800, dur: 0.18, gain: 0.12, ft: 'highpass' }); } },
    missile: function () { if (rate('mis', 80)) noise({ f: 400, to: 2000, dur: 0.4, gain: 0.08, ft: 'bandpass' }); },
    plasma: function () { if (rate('pla', 90)) tone({ type: 'triangle', f: 120, to: 520, dur: 0.4, gain: 0.12 }); },
    ion: function () { if (rate('ion', 120)) tone({ type: 'sawtooth', f: 2200, to: 1800, dur: 0.12, gain: 0.03, lp: 4000 }); },
    boom: function (big) { if (!rate('boom' + (big ? 1 : 0), 50)) return; noise({ f: big ? 1600 : 2600, to: 60, dur: big ? 1.2 : 0.55, gain: big ? 0.3 : 0.18 }); tone({ type: 'sine', f: big ? 80 : 120, to: 30, dur: big ? 1 : 0.4, gain: big ? 0.3 : 0.15 }); },
    hit: function () { if (rate('hit', 50)) noise({ f: 3000, to: 900, dur: 0.12, gain: 0.08, ft: 'bandpass' }); },
    hullHit: function () { if (rate('hull', 70)) { noise({ f: 900, to: 120, dur: 0.35, gain: 0.16 }); tone({ type: 'square', f: 70, to: 40, dur: 0.2, gain: 0.06, lp: 400 }); } },
    place: function () { tone({ type: 'square', f: 220, to: 160, dur: 0.08, gain: 0.07, lp: 1200 }); noise({ f: 1200, to: 300, dur: 0.1, gain: 0.06 }); },
    bad: function () { if (rate('bad', 150)) tone({ type: 'square', f: 110, dur: 0.12, gain: 0.05, lp: 600 }); },
    rotate: function () { tone({ type: 'triangle', f: 660, to: 880, dur: 0.06, gain: 0.05 }); },
    alarm: function () { [0, 0.22].forEach(function (d) { tone({ type: 'square', f: 740, dur: 0.12, gain: 0.04, lp: 2000, delay: d }); tone({ type: 'square', f: 554, dur: 0.12, gain: 0.04, lp: 2000, delay: d + 0.11 }); }); },
    emp: function () { tone({ type: 'sine', f: 60, to: 900, dur: 0.9, gain: 0.18 }); noise({ f: 300, to: 4000, dur: 0.9, gain: 0.1, ft: 'bandpass' }); },
    salvage: function () { [0, 4, 7].forEach(function (n, i) { tone({ type: 'triangle', f: 660 * Math.pow(2, n / 12), dur: 0.12, gain: 0.05, delay: i * 0.05 }); }); },
    shield: function () { if (rate('sh', 80)) tone({ type: 'sine', f: 900, to: 500, dur: 0.18, gain: 0.05 }); },
    phase: function () { [0, 7, 12].forEach(function (n, i) { tone({ type: 'triangle', f: 330 * Math.pow(2, n / 12), dur: 0.22, gain: 0.07, delay: i * 0.09 }); }); },
    lose: function () { [12, 7, 3, 0].forEach(function (n, i) { tone({ type: 'triangle', f: 220 * Math.pow(2, n / 12), dur: 0.3, gain: 0.08, delay: i * 0.16 }); }); },
    win: function () { [0, 4, 7, 12, 16].forEach(function (n, i) { tone({ type: 'triangle', f: 392 * Math.pow(2, n / 12), dur: 0.3, gain: 0.07, delay: i * 0.1 }); }); },
    life: function () { [0, 5, 7, 12].forEach(function (n, i) { tone({ type: 'triangle', f: 440 * Math.pow(2, n / 12), dur: 0.3, gain: 0.08, delay: i * 0.08 }); }); }
  };
  // music: a slow pad + arpeggio, calmer while building, driving in battle
  var Music = { on: store.get('music', true), timer: null, step: 0, mode: '', root: 45 };
  var SCALES = { calm: [0, 3, 7, 10, 12, 15, 19, 17], battle: [0, 7, 12, 3, 10, 7, 15, 12], boss: [0, 1, 7, 6, 12, 13, 7, 6], title: [0, 7, 3, 10, 12, 7, 15, 19] };
  Music.play = function (m) {
    if (Music.mode === m) return; Music.mode = m; Music.step = 0; if (Music.timer) clearInterval(Music.timer); Music.timer = null; if (!m) return;
    var bpm = m === 'battle' ? 132 : m === 'boss' ? 140 : 96, iv = 60000 / bpm / 2;
    Music.timer = setInterval(function () {
      if (!AC || muted || !Music.on || G.paused) return;
      var sc = SCALES[m] || SCALES.calm, st = Music.step++, n = Music.root + sc[st % 8] + (st % 16 >= 8 && m !== 'calm' ? 5 : 0);
      tone({ type: m === 'calm' || m === 'title' ? 'triangle' : 'sawtooth', f: 440 * Math.pow(2, (n + 12 - 69) / 12), dur: 0.2, gain: 0.05, lp: m === 'calm' ? 1400 : 2400, bus: musicBus });
      if (st % 8 === 0) tone({ type: 'sine', f: 440 * Math.pow(2, (Music.root - 12 + (st % 32 >= 16 ? 5 : 0) - 69) / 12), dur: iv * 7.5 / 1000, gain: 0.12, att: 0.3, bus: musicBus });
      if ((m === 'battle' || m === 'boss') && st % 2 === 0) noise({ f: st % 4 === 0 ? 180 : 5000, to: st % 4 === 0 ? 60 : 3000, dur: st % 4 === 0 ? 0.18 : 0.05, gain: st % 4 === 0 ? 0.12 : 0.025, ft: st % 4 === 0 ? 'lowpass' : 'highpass' });
    }, iv);
  };

  /* ---------------- state ---------------- */
  var G = { mode: 'title', level: 1, round: 1, rounds: 2, timer: 0, tmax: 1, lives: 3, score: 0, paused: false, t: 0, slow: 1,
    grid: new Uint8Array(COLS * ROWS), hp: new Uint8Array(COLS * ROWS), sec: new Uint8Array(COLS * ROWS), cores: [], turrets: [],
    foes: [], shots: [], eshots: [], beams: [], parts: [], rings: [], salvage: [], comets: [], wells: [], drones: [], portals: [],
    weapons: ['laser'], wi: 0, placeKind: 'tur', special: 0, emp: 0, over: 0, shield: 0, shieldMax: 0, shieldOff: 0, flare: null,
    spawnQ: [], spawnT: 0, toPlace: 0, piece: null, nextPiece: null, aim: { x: 1100, y: 450 }, fireHeld: false, msg: '', msg2: '', msgT: 0,
    bh: null, moon: { cracked: 0 }, nova: 0, boss: null, escort: null, derelict: null, ion: false, kills: 0, lostLife: false, banner: null, secretTaps: 0, stats: { kills: 0, salvage: 0, stolen: 0 } };
  var hiScores = store.get('hiscores', []);
  function best() { return hiScores.length ? hiScores[0].s : 0; }
  var WEAP = {
    laser: { name: 'LASER', cd: 0.45, col: '#7fe8ff' }, torpedo: { name: 'PHOTON TORPEDO', cd: 1.3, col: '#ffd36a' }, rail: { name: 'RAILGUN', cd: 1.8, col: '#d0e4ff' },
    missile: { name: 'MISSILES', cd: 1.1, col: '#ffb070' }, plasma: { name: 'PLASMA', cd: 1.6, col: '#b47bff' }, ion: { name: 'ION LANCE', cd: 0.14, col: '#7dffb0' }
  };
  function weapon() { return G.weapons[G.wi % G.weapons.length]; }
  function unlockWeapons() {
    var w = ['laser']; ['torpedo', 'rail', 'missile', 'plasma'].forEach(function (k) { if (has(k)) w.push(k); }); if (G.ion) w.push('ion');
    var cur = weapon(); G.weapons = w; G.wi = Math.max(0, w.indexOf(cur));
  }

  /* ---------------- station layout ---------------- */
  function newStation() {
    G.grid.fill(0); G.hp.fill(0); G.sec.fill(0); G.turrets = []; G.cores = [];
    var r = seeded(G.level * 977 + 3), spots = G.level >= 6 ? [[4, 9], [11, 3], [11, 15]] : [[5, 9], [12, 5], [12, 14]], n = G.level === 1 ? 2 : 3;
    for (var i = 0; i < n; i++) { var s = spots[i], c = s[0], rr = s[1]; G.cores.push({ c: c, r: rr }); [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (d) { G.grid[idx(c + d[0], rr + d[1])] = CORE; }); }
    // starting hull ring around the home core (a 2-cell gap inside)
    var h = G.cores[0], x0 = h.c - 3, y0 = h.r - 3, x1 = h.c + 4, y1 = h.r + 4;
    for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) if ((x === x0 || x === x1 || y === y0 || y === y1) && inG(x, y)) setHull(x, y);
    // drifting rock debris to build around
    for (i = 0; i < 6 + (G.level % 4); i++) { var rc = Math.floor(r() * COLS), ry = Math.floor(r() * ROWS); if (G.grid[idx(rc, ry)] === EMPTY && Math.abs(rc - h.c) > 4 && Math.abs(ry - h.r) > 4) G.grid[idx(rc, ry)] = ROCK; }
    computeSecured();
  }
  function setHull(c, r) { G.grid[idx(c, r)] = HULL; G.hp[idx(c, r)] = 1; }
  function computeSecured() { // flood from the edges; any cell not reached is inside the hull
    var seen = new Uint8Array(COLS * ROWS), q = [];
    for (var c = 0; c < COLS; c++) { q.push([c, 0], [c, ROWS - 1]); } for (var r = 0; r < ROWS; r++) { q.push([0, r], [COLS - 1, r]); }
    while (q.length) { var p = q.pop(), i = idx(p[0], p[1]); if (seen[i] || G.grid[i] === HULL) continue; seen[i] = 1; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nc = p[0] + d[0], nr = p[1] + d[1]; if (inG(nc, nr) && !seen[idx(nc, nr)]) q.push([nc, nr]); }); }
    for (i = 0; i < COLS * ROWS; i++) G.sec[i] = !seen[i] && G.grid[i] !== HULL ? 1 : 0;
    G.cores.forEach(function (k) { k.safe = !!G.sec[idx(k.c, k.r)]; });
  }
  function securedCount() { var n = 0; for (var i = 0; i < G.sec.length; i++) n += G.sec[i]; return n; }
  function safeCores() { return G.cores.filter(function (k) { return k.safe; }).length; }
  function destroyCell(c, r, power) {
    if (!inG(c, r)) return; var i = idx(c, r), g = G.grid[i];
    if (g === HULL) { G.grid[i] = EMPTY; burst(cellX(c), cellY(r), 10, 120, '#9fb8d8', 0.6); debris(cellX(c), cellY(r), 4); }
    else if (g === TUR || g === WELL) { G.hp[i] = Math.max(0, G.hp[i] - (power || 1)); if (G.hp[i] <= 0) { G.grid[i] = EMPTY; G.turrets = G.turrets.filter(function (t) { return !(t.c === c && t.r === r); }); explode(cellX(c), cellY(r), 26, false); } }
  }
  function blast(c, r, rad) { for (var dc = -rad; dc <= rad; dc++) for (var dr = -rad; dr <= rad; dr++) destroyCell(c + dc, r + dr, 2); Sfx.hullHit(); computeSecured(); }
  function cellAt(x, y) { var c = Math.floor((x - GX) / CELL), r = Math.floor((y - GY) / CELL); return inG(c, r) ? [c, r] : null; }
  function randomTargetCell(preferCore) {
    var list = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var g = G.grid[idx(c, r)]; if (g === HULL || g === TUR || g === WELL) list.push([c, r, g]); }
    if (preferCore) { var k = pick(G.cores); return [k.c, k.r]; }
    if (!list.length) return [rint(0, COLS - 1), rint(0, ROWS - 1)];
    // shots favour the right side of the station (closest to the enemy)
    list.sort(function (a, b) { return b[0] - a[0]; }); return list[Math.floor(Math.pow(Math.random(), 1.7) * list.length)];
  }

  /* ---------------- wall pieces ---------------- */
  var SHAPES = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]]];
  function newPiece() { var s = SHAPES[G.level <= 2 ? rint(0, 4) : rint(0, SHAPES.length - 1)]; var p = s.map(function (q) { return [q[0], q[1]]; }); var k = rint(0, 3); for (var i = 0; i < k; i++) p = rot(p); return p; }
  function rot(p) { var o = p.map(function (q) { return [-q[1], q[0]]; }), mx = Math.min.apply(null, o.map(function (q) { return q[0]; })), my = Math.min.apply(null, o.map(function (q) { return q[1]; })); return o.map(function (q) { return [q[0] - mx, q[1] - my]; }); }
  function pieceCells() { var a = cellAt(G.aim.x, G.aim.y + (G.touchDrag ? -CELL * 1.6 : 0)); if (!a || !G.piece) return null; var w = Math.max.apply(null, G.piece.map(function (q) { return q[0]; })), h = Math.max.apply(null, G.piece.map(function (q) { return q[1]; })); var oc = a[0] - Math.floor(w / 2), orr = a[1] - Math.floor(h / 2); return G.piece.map(function (q) { return [oc + q[0], orr + q[1]]; }); }
  function pieceFits(cells) { return cells && cells.every(function (q) { return inG(q[0], q[1]) && G.grid[idx(q[0], q[1])] === EMPTY && !podAt(q[0], q[1]); }); }
  function podAt(c, r) { return G.foes.some(function (f) { return f.k === 'pod' && f.att && f.tc === c && f.tr === r; }); }
  function placePiece() {
    var cells = pieceCells(); if (!pieceFits(cells)) { Sfx.bad(); return false; }
    cells.forEach(function (q) { setHull(q[0], q[1]); }); Sfx.place(); computeSecured(); TU.placed++;
    G.piece = G.nextPiece; G.nextPiece = newPiece(); return true;
  }
  function placeTurret() {
    var a = cellAt(G.aim.x, G.aim.y); if (!a || G.toPlace <= 0) { Sfx.bad(); return false; }
    var c = a[0], r = a[1], i = idx(c, r), well = G.placeKind === 'well';
    if (G.grid[i] !== EMPTY || !G.sec[i]) { Sfx.bad(); hint(G.sec[i] ? 'That spot is taken.' : 'Turrets only work inside your sealed hull.'); return false; }
    if (well && G.turrets.filter(function (t) { return t.well; }).length >= 2) { hint('Two gravity wells is the limit.'); Sfx.bad(); return false; }
    G.grid[i] = well ? WELL : TUR; G.hp[i] = 2; G.turrets.push({ c: c, r: r, cd: rnd(0, 0.3), ang: 0, well: well }); G.toPlace--; Sfx.place();
    if (well) G.placeKind = 'tur';
    return true;
  }
  function hint(s) { G.hintTxt = s; G.hintT = 2.2; }

  /* ---------------- flow ---------------- */
  function startGame(n) {
    unlockAudio(); G.vSplash = 0; G.goSplash = 0; G.score = 0; G.lives = 3; G.stats = { kills: 0, salvage: 0, stolen: 0 }; G.ion = false; G.lostLife = false; G.nextLife = 30000;
    startLevel(n || 1);
  }
  function startLevel(n) {
    G.level = n; G.round = 1; G.rounds = n === SECRET ? 1 : 2; G.foes = []; G.shots = []; G.eshots = []; G.beams = []; G.parts = []; G.rings = []; G.salvage = []; G.comets = []; G.wells = []; G.portals = [];
    G.boss = null; G.escort = null; G.derelict = null; G.bh = null; G.nova = 0; G.moon = { cracked: 0 }; G.flare = null; G.special = has('emp') ? 0.35 : 0; G.emp = 0; G.over = 0; G.slow = 1;
    G.world = worldFor(n); buildBg(); newStation(); unlockWeapons(); G.wi = Math.min(G.wi, G.weapons.length - 1);
    G.drones = has('scout') ? [{ k: 'scout', x: 600, y: 450, cd: 0 }, { k: 'drone', x: 600, y: 420, cd: 0.3 }, { k: 'drone', x: 600, y: 480, cd: 0.6 }] : [];
    if (has('blackhole') && n !== SECRET && (n === 16 || (n % 2 === 0 && n !== 20) || n === LAST)) G.bh = { x: 1080, y: n % 3 ? 300 : 600, m: 1 };
    G.piece = newPiece(); G.nextPiece = newPiece();
    beginPhase('arm', true);
    if (NEW[n] && n !== 22) newThingCard(n);
  }
  function beginPhase(m, first) {
    G.mode = m; G.inputLock = performance.now() + 200;
    if (m === 'arm') {
      G.toPlace = clamp(2 + safeCores() + Math.floor(G.level / 6) + (first ? 1 : 0), 2, 8);
      if (G.turrets.length + G.toPlace > 14) G.toPlace = Math.max(1, 14 - G.turrets.length);
      setTimer(G.level === 1 && G.round === 1 ? 25 : 14); G.placeKind = 'tur';
      say('ROUND ' + G.round + ': ARM', 'Place ' + G.toPlace + ' turrets inside your hull'); Music.play('calm'); Sfx.phase();
    } else if (m === 'battle') {
      G.shieldMax = has('shield') ? 6 + Math.floor(G.level / 5) : 0; G.shield = G.shieldMax; G.shieldOff = 0;
      buildWave(); setTimer(waveTime()); say('ROUND ' + G.round + ': BATTLE', G.level === LAST && G.round === 2 ? 'SURVIVE UNTIL THE SUPERNOVA' : 'Aim and fire'); Sfx.alarm();
      Music.play(G.boss || (G.level === 10 && G.round === 2) || (G.level === LAST && G.round === 2) ? 'boss' : 'battle');
    } else if (m === 'repair') {
      G.shots = []; G.eshots = []; G.comets.forEach(function (c) { c.held = false; });
      G.foes = G.foes.filter(function (f) { return f.k === 'pod' && f.att; }); // latched pods stay and keep cutting
      setTimer(G.level === 1 && G.round === 1 ? 30 : 17 + Math.min(4, G.level / 6)); say('REPAIR', 'Seal at least one core inside the hull'); Music.play('calm'); Sfx.phase();
    }
  }
  function waveTime() { if (G.level === LAST && G.round === 2) return 80; if (G.level === SECRET) return 55; return Math.min(46, 30 + G.level * 0.6 + (G.round - 1) * 3); }
  function setTimer(s) { G.timer = s; G.tmax = s; }
  function say(a, b, t) { G.msg = a; G.msg2 = b || ''; G.msgT = t || 2.6; }
  function endBattle() {
    // ships that survive the battle pull back; salvage still drifting is collected
    G.salvage.forEach(function (s) { collectSalvage(s, true); }); G.salvage = [];
    G.foes.forEach(function (f) { if (f.k !== 'pod') { f.retreat = true; } });
    if (G.level === LAST && G.round === 2) { G.mode = 'nova'; G.novaT = 0; G.foes = []; G.eshots = []; Sfx.win(); return; }
    beginPhase('repair');
  }
  function resolveRound() {
    computeSecured(); var safe = safeCores();
    G.foes = G.foes.filter(function (f) { return !(f.k === 'pod'); }); // pods still latched burn up when the round closes
    if (!safe) {
      G.lives--; G.lostLife = true; Sfx.lose();
      if (G.lives <= 0) { gameOver(); return; }
      G.mode = 'lifelost'; G.modeT = 0; say('NO CORE SEALED', G.lives + (G.lives === 1 ? ' life left - level restarts' : ' lives left - level restarts'), 3); return;
    }
    var land = securedCount(), pts = land * 5 + safe * 250; addScore(pts);
    say('ROUND ' + G.round + ' SECURED', '+' + pts + '  (' + safe + ' core' + (safe > 1 ? 's' : '') + ' sealed, ' + land + ' cells)', 2.4);
    if (G.round < G.rounds) { G.round++; G.mode = 'between'; G.modeT = 0; }
    else { G.mode = 'levelclear'; G.modeT = 0; Sfx.win(); }
  }
  function addScore(p) { G.score += p; if (G.score >= G.nextLife) { G.nextLife += 30000; if (G.lives < 6) { G.lives++; Sfx.life(); say('BONUS LIFE', ''); } } }
  function levelDone() {
    if (G.level === LAST || G.level === SECRET) { victory(); return; }
    showSplash(false);
  }
  function victory() { G.mode = 'victory'; G.modeT = 0; recordScore(); if (G.level === LAST) store.set('beat', true); Music.play('title'); }
  function gameOver() { G.mode = 'gameover'; G.modeT = 0; recordScore(); Music.play(''); }
  function recordScore() {
    if (G.score <= 0) return; G.newHi = G.score > best();
    hiScores.push({ s: G.score, l: G.level, d: new Date().toISOString().slice(0, 10) }); hiScores.sort(function (a, b) { return b.s - a.s; }); hiScores = hiScores.slice(0, 5); store.set('hiscores', hiScores);
  }
  function showSplash(lost, won) {
    G.mode = 'splash'; Music.play('');
    var title = won ? (G.level === SECRET ? 'SECRET LEVEL CLEARED' : 'THE STATION ESCAPED THE SUPERNOVA') : lost ? 'GAME OVER' : 'LEVEL ' + G.level + ' CLEARED';
    var sub = 'Score ' + G.score.toLocaleString() + (lost ? ' \u2022 reached level ' + G.level : ' \u2022 ' + (G.level < LAST ? 'next: ' + NAMES[G.level] : ''));
    var lv = G.level, done = function () { if (G.mode !== 'splash' || G.level !== lv) return; if (lost || won) toTitle(); else startLevel(G.level + 1); };
    if (window.ScoutSplash && ScoutSplash.show) ScoutSplash.show({ kind: 'defender', campaign: 'rampart-space', tag: won ? 'victory' : lost ? 'gameover' : 'wave' + G.level, title: title, sub: sub, accent: '#9fe6ff', glow: 'rgba(90,170,255,.28)', contLabel: lost || won ? 'Title screen' : 'Next level', onContinue: done });
    else done();
  }
  function toTitle() { G.mode = 'title'; G.level = 1; G.world = worldFor(1); G.foes = []; G.shots = []; G.eshots = []; G.parts = []; G.drones = []; G.bh = null; buildBg(); newStation(); Music.play('title'); }

  /* ---------------- waves ---------------- */
  function buildWave() {
    var L = G.level, R = G.round, q = [], T = waveTime() - 6, budget = Math.round(6 + L * 1.5 + R * 2);
    function add(k, t, o) { q.push(Object.assign({ k: k, t: t }, o || {})); }
    var mix = [['fighter', 1]];
    if (has('bomber')) mix.push(['bomber', 0.35]); if (has('pirate')) mix.push(['pirate', 0.25]); if (has('pods')) mix.push(['pod', 0.4]);
    if (has('carrier') && L !== SECRET) mix.push(['capital', 0.08], ['carrier', 0.06]);
    var tot = mix.reduce(function (s, m) { return s + m[1]; }, 0);
    if (L === SECRET) { for (var i = 0; i < 26; i++) add('jelly', i * 1.9); add('comet', 8); add('comet', 30); }
    else {
      for (i = 0; i < budget; i++) { var x = Math.random() * tot, k = 'fighter'; for (var j = 0; j < mix.length; j++) { x -= mix[j][1]; if (x <= 0) { k = mix[j][0]; break; } } add(k, 1 + (i / budget) * T + rnd(-0.6, 0.6)); }
      // the new thing of this level gets its own entrance
      var NEWK = { 3: 'bomber', 9: 'pirate', 13: 'carrier', 15: 'pod' }; if (NEWK[L]) { add(NEWK[L], 3); add(NEWK[L], T * 0.5); }
      if (L === 13) add('capital', 6);
      if (has('asteroid')) { var na = L === 5 ? 14 : 3 + (L % 3); for (i = 0; i < na; i++) add('rock', rnd(1, T)); }
      if (has('comet')) add('comet', L === 12 ? 4 : rnd(6, T * 0.7));
      if (has('wormhole') && (L === 17 || Math.random() < 0.5)) { add('portal', L === 17 ? 5 : rnd(6, T * 0.6)); if (L === 17) add('portal', T * 0.6); }
      if (has('flare') && (L === 18 || Math.random() < 0.35)) add('flare', L === 18 ? 8 : rnd(8, T * 0.7));
      if (L === 10 && R === 2) { add('mothership', 2); }
      if (L === 20 && R === 1) add('derelict', 1);
      if (L === 22) add(R === 1 ? 'escort' : 'escortStay', 0.5);
      if (L === LAST && R === 2) { for (i = 0; i < 18; i++) add(pick(['fighter', 'fighter', 'bomber', 'pirate', 'pod']), 4 + i * 3.6); add('dread', 20); add('carrier', 40); add('capital', 55); }
      if (L >= 14 && L !== LAST && R === 2) add(pick(['capital', 'carrier']), T * 0.4);
    }
    q.sort(function (a, b) { return a.t - b.t; }); G.spawnQ = q; G.waveT = 0;
  }
  function spawn(s) {
    var k = s.k, y = rnd(110, 790);
    if (k === 'rock') { var r = rnd(14, 34); G.foes.push({ k: 'rock', x: WW + 60, y: rnd(60, 840), vx: -rnd(45, 90) * (G.level === 5 ? 1.2 : 1), vy: rnd(-12, 12), r: r, hp: Math.ceil(r / 9), max: Math.ceil(r / 9), rot: rnd(0, TAU), vr: rnd(-1, 1), seed: rint(1, 9999) }); return; }
    if (k === 'comet') { G.comets.push({ x: WW + 80, y: rnd(150, 750), vx: -rnd(150, 200), vy: rnd(-25, 25), r: 16, held: false, flung: false }); if (G.level === 12 && !G.cometTip) { G.cometTip = 1; } return; }
    if (k === 'portal') { var top = Math.random() < 0.5; G.portals.push({ x: rnd(260, 620), y: top ? 40 : 860, t: 0, n: 3 + Math.floor(G.level / 8), cd: 1.4 }); hint('WORMHOLE OPENING BEHIND YOUR LINES!'); Sfx.alarm(); return; }
    if (k === 'flare') { G.flare = { t: 0, warn: 3 }; say('SOLAR FLARE WARNING', 'Shields will drop'); Sfx.alarm(); return; }
    if (k === 'derelict') { G.derelict = { x: WW + 120, y: G.bh ? (G.bh.y < 450 ? 660 : 240) : 450, vx: -28, hp: 10, max: 10, rot: 0 }; G.derelict.vx = -70; return; }
    if (k === 'escort' || k === 'escortStay') { G.escort = { k: 'escort', x: 760, y: 220, hp: 22, max: 22, r: 26, cd: 1, hostile: false, turnAt: k === 'escortStay' ? 14 : 999, a: 0 }; return; }
    if (k === 'mothership') { var b = { k: 'mother', x: WW + 260, y: 450, tx: 1290, hp: 90, max: 90, r: 120, cd: 3, lcd: 4, beamT: 0, phase: 1 }; G.boss = b; G.foes.push(b); say('MOTHERSHIP INBOUND', 'Hit its glowing core'); Sfx.alarm(); return; }
    var f = { k: k, x: WW + 40, y: y, vx: 0, vy: 0, cd: rnd(1.5, 3), t: 0, a: Math.PI, ph: rnd(0, TAU) };
    var spec = { fighter: [1, 13, 1], bomber: [3, 20, 1], pirate: [3, 15, 1], pod: [1, 9, 0], capital: [22, 46, 3], carrier: [16, 50, 3], dread: [40, 64, 4], jelly: [2, 16, 0] }[k];
    f.hp = f.max = spec[0] + (k === 'fighter' && G.level >= 7 ? 1 : 0); f.r = spec[1]; f.big = spec[2];
    f.tx = k === 'fighter' ? rnd(880, 1280) : k === 'bomber' ? rnd(760, 840) : k === 'capital' ? rnd(1120, 1220) : k === 'carrier' ? rnd(1330, 1420) : k === 'dread' ? 1200 : k === 'jelly' ? rnd(820, 1300) : rnd(900, 1300);
    if (k === 'pirate') { f.x = rnd(820, 1350); f.y = Math.random() < 0.5 ? -30 : WH + 30; f.tx = f.x; }
    if (s.x != null) { f.x = s.x; f.y = s.y; }
    G.foes.push(f);
  }

  /* ---------------- effects ---------------- */
  function burst(x, y, n, sp, col, life) { for (var i = 0; i < n && G.parts.length < 900; i++) { var a = rnd(0, TAU), v = rnd(0.2, 1) * sp; G.parts.push({ k: 's', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(0.3, 1) * (life || 0.8), m: life || 0.8, col: col }); } }
  function debris(x, y, n) { for (var i = 0; i < n; i++) { var a = rnd(0, TAU), v = rnd(20, 90); G.parts.push({ k: 'd', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rnd(1, 2), m: 2, rot: rnd(0, TAU), vr: rnd(-6, 6), sz: rnd(3, 7) }); } }
  function explode(x, y, r, big) { // local fireball: capped radius, soft falloff, never full screen
    r = Math.min(r, big ? 190 : 110);
    G.rings.push({ x: x, y: y, r: r, t: 0, m: big ? 1.1 : 0.6 });
    burst(x, y, big ? 70 : 24, r * 3, '#ffb060', big ? 1.2 : 0.7); burst(x, y, big ? 30 : 10, r * 2, '#ffe0a0', 0.5); debris(x, y, big ? 14 : 4);
    for (var i = 0; i < (big ? 8 : 3); i++) G.parts.push({ k: 'smoke', x: x + rnd(-r, r) * 0.4, y: y + rnd(-r, r) * 0.4, vx: rnd(-15, 15), vy: rnd(-15, 15), t: rnd(1, 2), m: 2, sz: r * rnd(0.4, 0.8) });
    Sfx.boom(big);
  }

  /* ---------------- player weapons ---------------- */
  function turretPos(t) { return { x: cellX(t.c), y: cellY(t.r) }; }
  function nearestFoe(x, y, maxD, filter) { var b = null, bd = maxD || 1e9; G.foes.forEach(function (f) { if (f.dead || f.k === 'rock' && filter === 'ships') return; var d = hyp(f.x - x, f.y - y); if (d < bd) { bd = d; b = f; } }); return b; }
  function fireAll() {
    if (G.mode !== 'battle') return;
    var w = weapon(), fired = false, flareK = G.flare && G.flare.t > 0 ? 1.5 : 1;
    if (G.comets.some(function (c) { return c.held; })) { flingComet(); return; }
    G.turrets.forEach(function (t, i) {
      if (t.cd > 0) return; var p = turretPos(t);
      if (t.well) { G.wells.push({ x: p.x, y: p.y, tx: G.aim.x, ty: G.aim.y, t: 0, live: 0 }); t.cd = 7; return; }
      t.cd = WEAP[w].cd * flareK * rnd(0.95, 1.1); fired = true; t.ang = Math.atan2(G.aim.y - p.y, G.aim.x - p.x);
      var ax = G.aim.x + rnd(-8, 8), ay = G.aim.y + rnd(-8, 8);
      if (w === 'laser' || w === 'rail' || w === 'ion') beam(p.x, p.y, ax, ay, w);
      else {
        var a = Math.atan2(ay - p.y, ax - p.x), sp = w === 'torpedo' ? 330 : w === 'missile' ? 460 : 280;
        G.shots.push({ k: w, x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tx: ax, ty: ay, t: 0, life: w === 'torpedo' ? 5 : 4, trail: [], tgt: w === 'torpedo' ? nearestFoe(ax, ay, 320) : null });
      }
    });
    if (fired) Sfx[w === 'laser' ? 'laser' : w]();
  }
  function beam(x0, y0, x1, y1, w) { // marched ray so the black hole can bend it
    var a = Math.atan2(y1 - y0, x1 - x0), vx = Math.cos(a), vy = Math.sin(a), x = x0, y = y0, pts = [[x, y]], hit = {}, dmg = w === 'rail' ? 4 : w === 'ion' ? 0.5 : 1, pierce = w !== 'laser', stop = false;
    for (var s = 0; s < 260 && !stop; s++) {
      if (G.bh) { var dx = G.bh.x - x, dy = G.bh.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2); if (d < 30) break; var k = 900 / Math.max(d2, 400); vx += dx / d * k; vy += dy / d * k; var vl = hyp(vx, vy); vx /= vl; vy /= vl; }
      x += vx * 8; y += vy * 8; if (s % 3 === 0) pts.push([x, y]);
      if (x < -20 || x > WW + 20 || y < -20 || y > WH + 20) break;
      for (var i = 0; i < G.foes.length; i++) { var f = G.foes[i]; if (f.dead || hit[i]) continue; if (hyp(f.x - x, f.y - y) < f.r * (f.k === 'mother' ? 0.55 : 1)) { hit[i] = 1; damage(f, dmg, x, y); if (!pierce) { stop = true; break; } } }
      if (!stop) stop = hitExtras(x, y, dmg, !pierce);
      if (!pierce && hyp(x - x1, y - y1) < 8 && w === 'laser') { /* laser keeps going past aim, like a real beam */ }
    }
    pts.push([x, y]); G.beams.push({ pts: pts, w: w, t: 0, m: w === 'rail' ? 0.35 : w === 'ion' ? 0.08 : 0.16 });
  }
  function hitExtras(x, y, dmg, stopOnHit) { // derelict station, betraying escort, enemy bombs
    var hit = false;
    if (G.derelict && hyp(G.derelict.x - x, G.derelict.y - y) < 60) { G.derelict.hp -= dmg; G.derelict.hitT = 0.2; burst(x, y, 6, 120, '#9dffcf', 0.5); if (G.derelict.hp <= 0) salvageDerelict(); hit = true; }
    if (G.escort && G.escort.hostile && hyp(G.escort.x - x, G.escort.y - y) < G.escort.r) { G.escort.hp -= dmg; burst(x, y, 6, 120, '#ffb070', 0.5); if (G.escort.hp <= 0) { explode(G.escort.x, G.escort.y, 90, true); addScore(8000); say('TRAITOR DESTROYED', '+8000'); G.escort = null; } hit = true; }
    for (var i = G.eshots.length - 1; i >= 0; i--) { var e = G.eshots[i]; if (e.shootable && hyp(e.x - x, e.y - y) < 14) { G.eshots.splice(i, 1); burst(x, y, 8, 100, '#ffd0a0', 0.4); addScore(50); hit = true; } }
    return hit && stopOnHit;
  }
  function damage(f, d, x, y) {
    if (f.dead) return;
    if (f.k === 'mother') { f.hp -= d; f.hitT = 0.15; burst(x, y, 6, 140, '#ffb060', 0.5); Sfx.hit(); if (f.hp <= 0) killFoe(f, true); return; }
    f.hp -= d; f.hitT = 0.12; burst(x, y, 4, 90, '#ffd0a0', 0.4); Sfx.hit();
    if (f.hp <= 0) { killFoe(f, true); return; }
    // desperate ships: glow, then ram
    if (has('rammer') && !f.ram && f.k !== 'rock' && f.k !== 'pod' && f.k !== 'jelly' && f.hp <= f.max * 0.5 && f.max >= 2 && Math.random() < 0.7) { f.ram = 'glow'; f.ramT = 1.6; var tc = randomTargetCell(); f.tc = tc[0]; f.tr = tc[1]; }
  }
  var PTS = { fighter: 100, bomber: 300, pirate: 400, pod: 150, capital: 2500, carrier: 2000, dread: 6000, rock: 50, jelly: 250, mother: 25000 };
  function killFoe(f, byPlayer) {
    if (f.dead) return; f.dead = true;
    explode(f.x, f.y, f.k === 'mother' ? 190 : f.r * (f.big ? 2.2 : 1.6), f.big >= 3 || f.k === 'mother');
    if (f.k === 'rock' && f.r > 22) for (var i = 0; i < 2; i++) G.foes.push({ k: 'rock', x: f.x, y: f.y, vx: f.vx * 1.2 + rnd(-30, 30), vy: rnd(-40, 40), r: f.r * 0.5, hp: 1, max: 1, rot: 0, vr: rnd(-2, 2), seed: rint(1, 999) });
    if (byPlayer) {
      var p = (PTS[f.k] || 100) * (f.ram === 'glow' ? 2 : 1); addScore(p); G.kills++; G.stats.kills++; TU.sunk++;
      if (f.ram === 'glow') pop(f.x, f.y, 'RAM STOPPED x2'); else pop(f.x, f.y, String(p));
      if (has('emp')) G.special = Math.min(1, G.special + (f.big ? 0.15 : 0.05));
      if (f.k !== 'rock' && f.k !== 'pod' && (Math.random() < (f.big ? 1 : 0.3) || f.k === 'jelly')) G.salvage.push({ x: f.x, y: f.y, vx: -rnd(30, 50), vy: rnd(-10, 10), v: f.big ? 3 : 1, rot: 0 });
    }
    if (f.k === 'mother') { G.boss = null; say('MOTHERSHIP DESTROYED', '+25000'); for (i = 0; i < 4; i++) setTimeout(function () { explode(f.x + rnd(-140, 140), f.y + rnd(-70, 70), 80, false); }, 200 + i * 250); }
  }
  function pop(x, y, txt) { G.parts.push({ k: 'txt', x: x, y: y, vx: 0, vy: -30, t: 1.1, m: 1.1, txt: txt }); }
  function collectSalvage(s, quiet) { addScore(250 * s.v); G.stats.salvage++; if (has('emp')) G.special = Math.min(1, G.special + 0.12 * s.v); if (!quiet) { pop(s.x, s.y, '+' + 250 * s.v + ' SALVAGE'); Sfx.salvage(); } }
  function salvageDerelict() {
    var d = G.derelict; explode(d.x, d.y, 100, true); G.derelict = null; G.ion = true; unlockWeapons(); G.wi = G.weapons.indexOf('ion'); addScore(5000);
    say('ALIEN TECH SALVAGED', 'ION LANCE unlocked - press Switch'); card('ion', 'Secret weapon: Ion Lance', 'You pulled an <b>Ion Lance</b> out of the wreck. It is a near-constant beam that cuts through every ship it touches. It is now in your Switch list for the rest of this run.');
  }
  function useSpecial() {
    if (!has('emp') || G.mode !== 'battle' || G.special < 1) { if (has('emp') && G.mode === 'battle') hint('Special is still charging'); return; }
    G.special = 0; G.emp = 1; Sfx.emp(); G.rings.push({ x: GR, y: 450, r: 1100, t: 0, m: 1.2, emp: true });
    G.eshots = []; G.foes.forEach(function (f) { if (f.k === 'pod' && f.att) { killFoe(f, true); return; } f.stun = 3; });
    if (has('overdrive')) { G.over = 5; say('OVERDRIVE', 'Time slowed'); } else say('EMP', 'Enemy ships stunned');
    TU.special = 1;
  }
  function grabComet() {
    if (G.comets.some(function (c) { return c.held; })) return false;
    for (var i = 0; i < G.comets.length; i++) { var c = G.comets[i]; if (!c.flung && hyp(c.x - G.aim.x, c.y - G.aim.y) < 60) { c.held = true; Sfx.rotate(); hint('Comet grabbed! Aim, then fire to fling it.'); return true; } }
    return false;
  }
  function flingComet() {
    G.comets.forEach(function (c) { if (!c.held) return; c.held = false; c.flung = true; var tgt = nearestFoe(G.aim.x + 300, G.aim.y, 900, 'ships'), a = tgt ? Math.atan2(tgt.y - c.y, tgt.x - c.x) : 0; c.vx = Math.cos(a) * 700; c.vy = Math.sin(a) * 700; Sfx.torpedo(); });
  }

  /* ---------------- update ---------------- */
  function foeTargetXY(f) { var c = randomTargetCell(f.k === 'bomber'); return { c: c[0], r: c[1], x: cellX(c[0]) + rnd(-6, 6), y: cellY(c[1]) + rnd(-6, 6) }; }
  function enemyShot(x, y, tgt, o) {
    o = o || {}; var a = Math.atan2(tgt.y - y, tgt.x - x), sp = o.sp || 240;
    G.eshots.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tx: tgt.x, ty: tgt.y, c: tgt.c, r: tgt.r, rad: o.rad || 0, col: o.col || '#ff6a50', sz: o.sz || 3, shootable: !!o.shootable, pirate: !!o.pirate, t: 0 });
  }
  function updateFoe(f, dt) {
    var edt = dt * G.slow; f.t += edt; if (f.hitT > 0) f.hitT -= dt;
    if (f.stun > 0) { f.stun -= dt; edt *= 0.1; }
    if (G.bh && f.k !== 'mother') { var dx = G.bh.x - f.x, dy = G.bh.y - f.y, d = hyp(dx, dy); if (d < 40) { killFoe(f, true); pop(f.x, f.y, 'EATEN'); return; } var pull = 5200000 / Math.max(d * d, 3000) * edt / (f.big ? 3 : 1); f.x += dx / d * pull * 0.02; f.y += dy / d * pull * 0.02; }
    if (f.retreat) { f.x += 260 * dt; if (f.x > WW + 120) f.gone = true; return; }
    if (f.k === 'rock') { f.x += f.vx * edt; f.y += f.vy * edt; f.rot += f.vr * edt; if (f.x < GR + f.r) rockHit(f); if (f.x < -80) f.gone = true; return; }
    if (f.ram === 'glow') { f.ramT -= dt; f.x += Math.sin(f.t * 30) * 0.6; if (f.ramT <= 0) { f.ram = 'dive'; Sfx.alarm(); } return; }
    if (f.ram === 'dive') { var tx = cellX(f.tc), ty = cellY(f.tr), a = Math.atan2(ty - f.y, tx - f.x); f.x += Math.cos(a) * 520 * edt; f.y += Math.sin(a) * 520 * edt; f.a = a; if (hyp(tx - f.x, ty - f.y) < 16) { f.dead = true; explode(f.x, f.y, 60, false); blast(f.tc, f.tr, 1); pop(f.x, f.y, 'RAMMED!'); } return; }
    if (f.k === 'pod') {
      if (!f.att) { if (f.tc == null) { var t = foeTargetXY(f); f.tc = t.c; f.tr = t.r; } var px = cellX(f.tc), py = cellY(f.tr), a2 = Math.atan2(py - f.y, px - f.x); f.a = a2; f.x += Math.cos(a2) * 170 * edt; f.y += Math.sin(a2) * 170 * edt; if (hyp(px - f.x, py - f.y) < 8) { f.att = true; f.cutT = 3.2; } }
      else { f.cutT -= edt; if (f.cutT <= 0) { f.dead = true; burst(f.x, f.y, 14, 120, '#ff9050', 0.6); destroyCell(f.tc, f.tr, 2); destroyCell(f.tc + 1, f.tr, 2); computeSecured(); Sfx.hullHit(); } }
      return;
    }
    if (f.k === 'mother') { updateMother(f, edt, dt); return; }
    // approach, then hold a station and fire
    var sp = f.k === 'fighter' ? 210 : f.k === 'pirate' ? 190 : f.k === 'jelly' ? 40 : f.big ? 60 : 110;
    if (f.k === 'pirate') { pirateAI(f, edt); return; }
    var hx = f.tx, hy = f.k === 'fighter' ? f.y + Math.sin(f.t * 1.4 + f.ph) * 40 * edt : f.y;
    if (f.k === 'jelly') { hy = f.y + Math.sin(f.t * 0.8 + f.ph) * 30 * edt; f.x += (hx - f.x) * 0.3 * edt; f.y = clamp(hy, 60, 840); return; }
    if (Math.abs(hx - f.x) > 4) f.x += clamp(hx - f.x, -sp * edt, sp * edt); f.y = clamp(hy, 60, 840);
    if (f.x > WW - 20) return;
    f.cd -= edt;
    if (f.cd <= 0) {
      var tg = foeTargetXY(f);
      if (f.k === 'fighter') { enemyShot(f.x - 10, f.y, tg); f.cd = rnd(2.2, 3.6) - Math.min(1, G.level * 0.03); }
      else if (f.k === 'bomber') { enemyShot(f.x - 10, f.y + 6, tg, { sp: 140, rad: 1, col: '#ffb040', sz: 6, shootable: true }); f.cd = rnd(4, 5.5); }
      else if (f.k === 'capital' || f.k === 'dread') { enemyShot(f.x - 30, f.y, tg, { sp: 170, rad: f.k === 'dread' ? 1 : 0.5, col: '#ff8040', sz: 7, shootable: true }); for (var i = 0; i < (f.k === 'dread' ? 4 : 2); i++) enemyShot(f.x - 20, f.y + rnd(-20, 20), foeTargetXY(f)); f.cd = f.k === 'dread' ? 2.6 : 3.6; }
      else if (f.k === 'carrier') { for (i = 0; i < 2; i++) spawn({ k: 'fighter', x: f.x - 30, y: f.y + (i ? 20 : -20) }); f.cd = 6; }
    }
  }
  function pirateAI(f, edt) {
    var tgt = null, bd = 700;
    G.salvage.forEach(function (s) { var d = hyp(s.x - f.x, s.y - f.y); if (d < bd) { bd = d; tgt = s; } });
    if (f.loot) { f.y += (f.y < 450 ? -1 : 1) * 200 * edt; f.x += 60 * edt; if (f.y < -40 || f.y > WH + 40) f.gone = true; return; }
    if (tgt) { var a = Math.atan2(tgt.y - f.y, tgt.x - f.x); f.a = a; f.x += Math.cos(a) * 200 * edt; f.y += Math.sin(a) * 200 * edt; if (bd < 16) { G.salvage.splice(G.salvage.indexOf(tgt), 1); f.loot = true; G.stats.stolen++; pop(f.x, f.y, 'STOLEN!'); } }
    else { var hy = f.tx2 == null ? (f.tx2 = rnd(160, 740)) : f.tx2; f.y += clamp(hy - f.y, -150 * edt, 150 * edt); f.x += clamp(f.tx - f.x, -100 * edt, 100 * edt); }
    f.cd -= edt;
    if (f.cd <= 0) {
      f.cd = rnd(1.4, 2.4); var enemies = G.foes.filter(function (o) { return o !== f && !o.dead && o.k !== 'pirate' && o.k !== 'rock' && o.k !== 'pod'; });
      if (enemies.length && Math.random() < 0.6) { var e = pick(enemies); enemyShot(f.x, f.y, { x: e.x, y: e.y }, { col: '#e070ff', pirate: true, sp: 300 }); }
      else enemyShot(f.x, f.y, foeTargetXY(f), { col: '#e070ff', pirate: true });
    }
  }
  function updateMother(f, edt, dt) {
    if (f.x > f.tx) f.x -= 70 * edt; f.y = 450 + Math.sin(G.t * 0.3) * 60;
    f.cd -= edt; f.lcd -= edt;
    if (f.cd <= 0) { for (var i = 0; i < 2; i++) spawn({ k: 'fighter', x: f.x - 80, y: f.y + (i ? 70 : -70) }); f.cd = 5.5; }
    if (f.lcd <= 0) { var tg = foeTargetXY(f); f.beam = { x: tg.x, y: tg.y, c: tg.c, r: tg.r, t: 0 }; f.lcd = f.phase === 2 ? 3.2 : 4.5; }
    if (f.beam) { f.beam.t += edt; if (f.beam.t > 1.2 && !f.beam.done) { f.beam.done = true; blast(f.beam.c, f.beam.r, 1); explode(f.beam.x, f.beam.y, 50, false); } if (f.beam.t > 1.6) f.beam = null; }
    if (f.phase === 1 && f.hp < f.max * 0.55) { f.phase = 2; f.crack = { t: 0 }; say('IT FIRED AT THE MOON!', 'Moon debris incoming'); Sfx.alarm(); }
    if (f.crack) { f.crack.t += dt; if (f.crack.t > 1.5 && !G.moon.cracked) { G.moon.cracked = 0.01; for (var j = 0; j < 9; j++) G.foes.push({ k: 'rock', x: G.moonPos.x + rnd(-30, 30), y: G.moonPos.y + rnd(-30, 30), vx: -rnd(70, 120), vy: rnd(-20, 50), r: rnd(12, 26), hp: 2, max: 2, rot: 0, vr: rnd(-1, 1), seed: rint(1, 999), moonRock: true }); } if (f.crack.t > 3) f.crack = null; }
  }
  function rockHit(f) {
    var c = cellAt(f.x - f.r * 0.6, f.y); if (!c) { if (f.x < GX) f.gone = true; return; }
    var hitAny = false; for (var dc = -1; dc <= 1; dc++) for (var dr = -1; dr <= 1; dr++) { var cc = c[0] + dc, rr = c[1] + dr; if (inG(cc, rr) && hyp(dc, dr) * CELL < f.r + 10) { var g = G.grid[idx(cc, rr)]; if (g === HULL || g === TUR || g === WELL || g === CORE) hitAny = true; } }
    if (hitAny) { f.dead = true; explode(f.x, f.y, f.r * 1.5, false); blast(c[0], c[1], f.r > 22 ? 1 : 0); }
  }
  function update(dt) {
    G.t += dt; if (G.msgT > 0) G.msgT -= dt; if (G.hintT > 0) G.hintT -= dt;
    G.slow = G.over > 0 ? 0.3 : 1; if (G.over > 0) G.over -= dt; if (G.emp > 0) G.emp -= dt;
    // keyboard aim
    var kx = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0), ky = (I.down.down ? 1 : 0) - (I.down.up ? 1 : 0);
    if (kx || ky) { G.aim.x = clamp(G.aim.x + kx * 720 * dt, 0, WW); G.aim.y = clamp(G.aim.y + ky * 720 * dt, 0, WH); G.kbAim = true; }
    var m = G.mode;
    if (m === 'arm' || m === 'battle' || m === 'repair') {
      if (!(TU.on && TU.freeze)) G.timer -= dt;
      if (m === 'battle') { G.waveT += dt * G.slow; while (G.spawnQ.length && G.spawnQ[0].t <= G.waveT) spawn(G.spawnQ.shift()); if (I.down.fire || G.fireHeld) fireAll(); }
      if (G.timer <= 0) {
        if (m === 'arm') beginPhase('battle');
        else if (m === 'battle') { if (G.boss && !G.boss.dead) { G.timer = 0; } else endBattle(); }
        else resolveRound();
      }
      if (m === 'arm' && G.toPlace <= 0 && G.timer > 1.2 && !(TU.on)) G.timer = Math.min(G.timer, 1.2);
    } else if (m === 'between' || m === 'lifelost' || m === 'levelclear') {
      G.modeT += dt;
      if (G.modeT > 2.6) { if (m === 'between') beginPhase('arm'); else if (m === 'lifelost') { var lv = G.lives; startLevel(G.level); G.lives = lv; } else levelDone(); }
    } else if (m === 'nova') { G.novaT += dt; G.nova = clamp(G.novaT / 5, 0, 1); if (G.novaT > 7 && !G.vSplash) { addScore(20000); victory(); } }
    else if (m === 'victory' || m === 'gameover') { G.modeT += dt; if (G.modeT > 2.5 && m === 'gameover' && !G.goSplash) { G.goSplash = 1; showSplash(true); } }
    if (m === 'victory' && G.modeT > 0.1 && !G.vSplash) { G.vSplash = 1; showSplash(false, true); }
    if (m === 'title') { G.aim.x = 1100 + Math.sin(G.t * 0.5) * 200; G.aim.y = 450 + Math.cos(G.t * 0.7) * 150; }

    // turrets cool down and track aim
    G.turrets.forEach(function (t) { if (t.cd > 0) t.cd -= dt; var p = turretPos(t), ta = Math.atan2(G.aim.y - p.y, G.aim.x - p.x); t.ang += clamp(Math.atan2(Math.sin(ta - t.ang), Math.cos(ta - t.ang)), -6 * dt, 6 * dt); });
    // foes
    if (m === 'battle' || m === 'repair' || m === 'between') G.foes.forEach(function (f) { if (!f.dead) updateFoe(f, dt); });
    G.foes = G.foes.filter(function (f) { return !f.dead && !f.gone; });
    if (G.boss && G.boss.dead) G.boss = null;
    // player projectiles
    for (var i = G.shots.length - 1; i >= 0; i--) {
      var s = G.shots[i]; s.t += dt; s.trail.push([s.x, s.y]); if (s.trail.length > (s.k === 'torpedo' ? 16 : 8)) s.trail.shift();
      if (s.k === 'torpedo') { if (!s.tgt || s.tgt.dead) s.tgt = nearestFoe(s.x, s.y, 500); if (s.tgt) { var ta = Math.atan2(s.tgt.y - s.y, s.tgt.x - s.x), ca = Math.atan2(s.vy, s.vx), na = ca + clamp(Math.atan2(Math.sin(ta - ca), Math.cos(ta - ca)), -3.2 * dt, 3.2 * dt); s.vx = Math.cos(na) * 330; s.vy = Math.sin(na) * 330; } }
      if (G.bh) { var bx = G.bh.x - s.x, by = G.bh.y - s.y, bd = hyp(bx, by); if (bd < 30) { G.shots.splice(i, 1); continue; } var k = 4.2e6 / Math.max(bd * bd, 900) * dt; s.vx += bx / bd * k; s.vy += by / bd * k; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      var done = s.t > s.life || s.x > WW + 40 || s.x < -40 || s.y < -40 || s.y > WH + 40, hitF = null;
      if (s.k === 'missile' && hyp(s.tx - s.x, s.ty - s.y) < 14 && !G.bh) done = 'boom';
      for (var j = 0; j < G.foes.length && !done; j++) { var f = G.foes[j]; if (!f.dead && hyp(f.x - s.x, f.y - s.y) < f.r * (f.k === 'mother' ? 0.55 : 1) + 4) { hitF = f; done = 'hit'; } }
      if (!done && hitExtras(s.x, s.y, s.k === 'plasma' ? 6 : 3, true)) done = 'x';
      if (done) {
        if (s.k === 'missile' && done !== true) { splash(s.x, s.y, 85, 3); }
        else if (s.k === 'plasma' && done !== true) { if (hitF) damage(hitF, 7, s.x, s.y); splash(s.x, s.y, 45, 2, hitF); }
        else if (hitF) damage(hitF, s.k === 'torpedo' ? 3 : 2, s.x, s.y);
        G.shots.splice(i, 1);
      }
    }
    // enemy shots
    for (i = G.eshots.length - 1; i >= 0; i--) {
      var e = G.eshots[i], edt = dt * G.slow; e.t += edt; e.x += e.vx * edt; e.y += e.vy * edt;
      if (e.pirate) { var hitP = null; G.foes.forEach(function (o) { if (!hitP && !o.dead && o.k !== 'pirate' && o.k !== 'rock' && hyp(o.x - e.x, o.y - e.y) < o.r) hitP = o; }); if (hitP) { G.eshots.splice(i, 1); damage(hitP, 1, e.x, e.y); if (hitP.dead) addScore(0); continue; } }
      if (G.escort && !G.escort.hostile && hyp(G.escort.x - e.x, G.escort.y - e.y) < G.escort.r && !e.fromEscort) { G.eshots.splice(i, 1); G.escort.hp = Math.max(4, G.escort.hp - 0.5); burst(e.x, e.y, 5, 80, '#9fe6ff', 0.4); continue; }
      var shieldOn = G.shieldMax && G.shield >= 1 && G.shieldOff <= 0 && !(G.flare && G.flare.t > 0);
      if (shieldOn && e.x < GR + 46 && e.vx < 0 && !e.fromEscort) { G.shield -= e.rad ? 2 : 1; G.eshots.splice(i, 1); burst(e.x, e.y, 8, 120, '#8fd0ff', 0.5); Sfx.shield(); G.shieldHitT = 0.4; continue; }
      if (e.x < -30 || e.x > WW + 30 || e.y < -30 || e.y > WH + 30) { G.eshots.splice(i, 1); continue; }
      if ((e.c != null && hyp(e.tx - e.x, e.ty - e.y) < 10) || (e.c == null && e.t > 6)) {
        G.eshots.splice(i, 1);
        if (e.c != null) { if (e.rad) { blast(e.c, e.r, Math.round(e.rad)); explode(e.x, e.y, 40 * e.rad + 20, false); } else { var g = G.grid[idx(e.c, e.r)]; if (g === HULL || g === TUR || g === WELL) { destroyCell(e.c, e.r); computeSecured(); Sfx.hullHit(); } burst(e.x, e.y, 8, 90, '#ffb080', 0.5); } }
      }
    }
    if (G.shieldMax && G.mode === 'battle' && G.shield < G.shieldMax) G.shield = Math.min(G.shieldMax, G.shield + dt / 6);
    if (G.shieldHitT > 0) G.shieldHitT -= dt;
    // salvage drifts home
    G.salvage.forEach(function (sv) { sv.x += sv.vx * dt; sv.y += sv.vy * dt; sv.rot += dt; if (sv.x < GR) { sv.got = true; collectSalvage(sv); } });
    G.salvage = G.salvage.filter(function (sv) { return !sv.got; });
    // comets
    G.comets.forEach(function (c) {
      if (c.held) { c.x += (G.aim.x - c.x) * Math.min(1, dt * 8); c.y += (G.aim.y - c.y) * Math.min(1, dt * 8); return; }
      c.x += c.vx * dt; c.y += c.vy * dt; if (c.x < GR + 10 && !c.flung) { c.gone = true; explode(c.x, c.y, 40, false); var cc = cellAt(c.x - 10, c.y); if (cc) blast(cc[0], cc[1], 1); }
      if (c.flung) G.foes.forEach(function (f) { if (!f.dead && hyp(f.x - c.x, f.y - c.y) < f.r + c.r) { damage(f, f.k === 'mother' ? 6 : 12, c.x, c.y); if (f.k !== 'mother') pop(f.x, f.y - 20, 'COMET!'); } });
      if (c.x < -100 || c.x > WW + 120 || c.y < -100 || c.y > WH + 100) c.gone = true;
    });
    G.comets = G.comets.filter(function (c) { return !c.gone; });
    // gravity wells: a singularity that pulls ships together; ships that collide get smashed
    G.wells.forEach(function (w) {
      w.t += dt; if (!w.live) { var a = Math.atan2(w.ty - w.y, w.tx - w.x); w.x += Math.cos(a) * 380 * dt; w.y += Math.sin(a) * 380 * dt; if (hyp(w.tx - w.x, w.ty - w.y) < 12 || w.t > 3) { w.live = 0.01; w.lt = 0; } return; }
      w.lt += dt; var near = G.foes.filter(function (f) { return !f.dead && f.k !== 'mother' && hyp(f.x - w.x, f.y - w.y) < 230; });
      near.forEach(function (f) { var d = Math.max(10, hyp(w.x - f.x, w.y - f.y)); f.x += (w.x - f.x) / d * 150 * dt; f.y += (w.y - f.y) / d * 150 * dt; f.smashCd = (f.smashCd || 0) - dt; });
      for (var a1 = 0; a1 < near.length; a1++) for (var b1 = a1 + 1; b1 < near.length; b1++) { var A = near[a1], B = near[b1]; if (hyp(A.x - B.x, A.y - B.y) < A.r + B.r && (A.smashCd || 0) <= 0) { A.smashCd = B.smashCd = 0.45; damage(A, 2, (A.x + B.x) / 2, (A.y + B.y) / 2); damage(B, 2, (A.x + B.x) / 2, (A.y + B.y) / 2); pop((A.x + B.x) / 2, (A.y + B.y) / 2, 'SMASH!'); } }
      if (w.lt > 4) w.gone = true;
    });
    G.wells = G.wells.filter(function (w) { return !w.gone; });
    // wormhole portals
    G.portals.forEach(function (p) { p.t += dt; p.cd -= dt; if (p.t > 1 && p.cd <= 0 && p.n > 0 && G.mode === 'battle') { p.n--; p.cd = 1.1; var f = { k: 'fighter', x: p.x, y: p.y, cd: 1.2, t: 0, a: 0, ph: rnd(0, TAU), hp: 2, max: 2, r: 13, big: 1, tx: p.x + rnd(80, 200) }; G.foes.push(f); } if (p.n <= 0 && p.cd < -1.5) p.gone = true; });
    G.portals = G.portals.filter(function (p) { return !p.gone; });
    // solar flare: soft warm glow ramp, shields offline
    if (G.flare) { var fl = G.flare; if (fl.warn > 0) fl.warn -= dt; else { fl.t += dt; if (fl.t > 9) G.flare = null; } }
    // derelict + escort
    if (G.derelict) { var dr = G.derelict; if (dr.x > 1100) dr.x += dr.vx * dt; dr.rot += dt * 0.1; if (dr.hitT > 0) dr.hitT -= dt; }
    if (G.escort && G.mode === 'battle') updateEscort(G.escort, dt);
    // Scout + drones
    G.drones.forEach(function (d, k) {
      var ox = k === 0 ? -60 : -30, oy = k === 0 ? -50 : k === 1 ? 40 : -110, tx = clamp(G.aim.x + ox, GR + 30, WW - 40), ty = clamp(G.aim.y + oy, 40, WH - 40);
      d.x += (tx - d.x) * Math.min(1, dt * 2.5); d.y += (ty - d.y) * Math.min(1, dt * 2.5); d.cd -= dt;
      if (G.mode === 'battle' && d.cd <= 0) { var f = nearestFoe(d.x, d.y, 420); if (f) { d.cd = k === 0 ? 0.55 : 0.9; G.beams.push({ pts: [[d.x, d.y], [f.x, f.y]], w: 'drone', t: 0, m: 0.12 }); damage(f, k === 0 ? 1 : 0.5, f.x, f.y); } }
    });
    // effects
    G.beams.forEach(function (b) { b.t += dt; }); G.beams = G.beams.filter(function (b) { return b.t < b.m; });
    G.rings.forEach(function (r) { r.t += dt; }); G.rings = G.rings.filter(function (r) { return r.t < r.m; });
    G.parts.forEach(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 's' || p.k === 'd') { p.vx *= 0.97; p.vy *= 0.97; } if (p.rot != null) p.rot += p.vr * dt; });
    G.parts = G.parts.filter(function (p) { return p.t > 0; });
    if (G.moon.cracked && G.moon.cracked < 1) G.moon.cracked = Math.min(1, G.moon.cracked + dt * 0.08);
    tutTick();
  }
  function splash(x, y, r, d, skip) { G.foes.forEach(function (f) { if (f !== skip && !f.dead && hyp(f.x - x, f.y - y) < r + f.r) damage(f, d, f.x, f.y); }); explode(x, y, r * 0.6, false); }
  function updateEscort(e, dt) {
    e.a += dt; e.y = 220 + Math.sin(e.a * 0.5) * 120; e.cd -= dt;
    if (!e.hostile && G.waveT > e.turnAt) { e.hostile = true; e.hp = Math.max(e.hp, 18); Sfx.alarm(); say('BETRAYAL!', 'The escort turned its guns on you'); card('escort2', 'Betrayal!', 'The escort frigate was a <b>Hegemony spy</b>. It is now red and firing at your hull. Shoot it down (worth 8000).'); }
    if (e.cd <= 0) {
      if (e.hostile) { enemyShot(e.x - 20, e.y, foeTargetXY(e), { sp: 220, rad: 0.5, col: '#ff7040', sz: 6, shootable: true }); e.cd = 2.2; }
      else { var f = nearestFoe(e.x, e.y, 700); if (f) { G.beams.push({ pts: [[e.x + 20, e.y], [f.x, f.y]], w: 'escort', t: 0, m: 0.15 }); damage(f, 1, f.x, f.y); } e.cd = 0.9; }
    }
  }

  /* ---------------- rendering ---------------- */
  var dpr = 1, S = 1, OX = 0, OY = 0, CW = 1, CH = 1, bg = null, SPR = {}, starsN = [], starsF = [];
  function mk(w, h, fn) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); fn(c.getContext('2d'), c.width, c.height); return c; }
  (function () { var r = seeded(7); for (var i = 0; i < 160; i++) starsN.push([r() * WW, r() * WH, r() * 1.4 + 0.6, r()]); for (i = 0; i < 260; i++) starsF.push([r() * WW, r() * WH, r() * 0.9 + 0.3, r()]); })();
  function resize() {
    var r = wrap.getBoundingClientRect(), cw = Math.max(200, r.width), ch = Math.max(150, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 3); if (cw * ch * dpr * dpr > 9.5e6) dpr = Math.max(1, Math.sqrt(9.5e6 / (cw * ch))); // crisp up to 4K
    CW = canvas.width = Math.round(cw * dpr); CH = canvas.height = Math.round(ch * dpr);
    S = Math.min(CW / WW, CH / WH); OX = (CW - WW * S) / 2; OY = (CH - WH * S) / 2;
    buildBg(); buildSprites(); placeTouch(); if (TU.on || TU.quick) tutPlace();
  }
  // 3D value noise sampled on the sphere surface, so continents and clouds wrap naturally
  function noise3(seed) {
    var P = new Uint8Array(512), r = seeded(seed); for (var i = 0; i < 256; i++) P[i] = i; for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = P[i]; P[i] = P[j]; P[j] = t; } for (i = 0; i < 256; i++) P[i + 256] = P[i];
    function h(x, y, z) { return P[P[P[x & 255] + (y & 255)] + (z & 255)] / 255; }
    function f(t) { return t * t * (3 - 2 * t); }
    function n(x, y, z) { var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = f(x - X), v = f(y - Y), w = f(z - Z);
      var a = lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v), b = lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v); return lerp(a, b, w); }
    return function (x, y, z, oct) { var s = 0, amp = 0.5, fr = 1, norm = 0; for (var o = 0; o < (oct || 5); o++) { s += n(x * fr, y * fr, z * fr) * amp; norm += amp; amp *= 0.5; fr *= 2.03; } return s / norm; };
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { t = clamp(t, 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function planetSprite(W0, R) { // per-pixel lit planet: fBm terrain or bands, clouds, Lambert light, ocean glint, night lights, atmosphere rim
    var type = W0.planet, pc = W0.pc.map(hex), N = Math.min(720, Math.ceil(R * 2)), seed = type.length * 131 + (G.level || 1) * 7;
    var tex = mk(N, N, function (c, w, h) {
      var img = c.createImageData(w, h), d = img.data, nz = noise3(seed), cl = noise3(seed + 99), L = [0.62, -0.52, 0.58], ll = hyp(hyp(L[0], L[1]), L[2]);
      L = [L[0] / ll, L[1] / ll, L[2] / ll];
      var deep = [8, 30, 70], shallow = [30, 95, 165], sand = [200, 185, 140], grass = [52, 105, 48], dry = [120, 118, 70], rock = [128, 116, 100], snow = [240, 244, 250];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 2 - 1, rr = u * u + v * v, o = (y * w + x) * 4; if (rr > 1) { d[o + 3] = 0; continue; }
        var z = Math.sqrt(1 - rr), sx = u * 2.2, sy = v * 2.2, sz = z * 2.2, e = nz(sx + 3, sy + 3, sz + 3, 6), col, emis = null, spec = 0, lat = Math.abs(v);
        if (type === 'earth') { if (e < 0.5) { col = mix(deep, shallow, (e - 0.3) / 0.2); spec = 1; } else if (e < 0.515) col = sand; else if (e < 0.6) col = mix(grass, dry, (e - 0.515) / 0.085); else col = mix(rock, snow, (e - 0.6) / 0.12); if (lat > 0.82 + (e - 0.5) * 0.4) col = snow; }
        else if (type === 'gas' || type === 'violet') { var band = Math.sin(v * 9 + e * 5.5 + Math.sin(v * 3) * 1.4) * 0.5 + 0.5; col = mix(pc[1], pc[2], band); col = mix(col, pc[0], Math.max(0, nz(sx * 2, sy * 6, sz * 2, 3) - 0.5) * 1.6); var sp = hyp((u - 0.32) * 1.4, (v - 0.28) * 2.6); if (sp < 0.12) col = mix(col, [200, 110, 80], 1 - sp / 0.12); }
        else if (type === 'ice') { col = mix(pc[2], pc[1], e * 1.3 - 0.2); if (Math.abs(nz(sx * 3, sy * 3, sz * 3, 4) - 0.5) < 0.012) col = mix(col, [60, 120, 170], 0.7); }
        else if (type === 'lava') { col = mix([30, 16, 12], [80, 40, 30], e); var cr = Math.abs(nz(sx * 2.5 + 9, sy * 2.5, sz * 2.5, 5) - 0.5); if (cr < 0.025) emis = mix([255, 210, 90], [255, 70, 20], cr / 0.025); }
        else if (type === 'desert') { col = mix(pc[2], pc[1], e * 1.6 - 0.3); col = mix(col, pc[0], Math.sin(e * 40) * 0.15 + 0.15); }
        else { col = mix([70, 68, 64], [200, 196, 188], e * 1.5 - 0.25); var cra = nz(sx * 4 + 5, sy * 4, sz * 4, 2); if (cra > 0.62) col = mix(col, [60, 58, 54], (cra - 0.62) * 4); }
        // clouds (not on lava/moon)
        var cA = 0; if (type === 'earth' || type === 'ice' || type === 'gas' || type === 'violet' || type === 'desert') { var cv = cl(sx * 1.6, sy * 1.6, sz * 1.6, 5); cA = clamp((cv - (type === 'earth' ? 0.52 : 0.6)) * 3.2, 0, type === 'desert' ? 0.4 : 0.85); }
        var nl = u * L[0] + v * L[1] + z * L[2], lit = clamp(nl * 1.05 + 0.04, 0, 1), amb = 0.035;
        var rC = lerp(col[0], 255, cA), gC = lerp(col[1], 255, cA), bC = lerp(col[2], 255, cA);
        var sh = amb + lit * (1 - amb); rC *= sh; gC *= sh; bC *= sh;
        if (spec && cA < 0.3) { var hz = nl > 0 ? Math.pow(Math.max(0, 2 * nl * z - L[2]), 28) : 0; rC += 200 * hz; gC += 200 * hz; bC += 180 * hz; }
        if (type === 'earth' && nl < -0.08 && e > 0.52 && e < 0.62 && cA < 0.3 && nz(sx * 12, sy * 12, sz * 12, 2) > 0.62) { var k = clamp(-nl * 3, 0, 1) * 0.9; rC += 255 * k; gC += 190 * k; bC += 100 * k; }
        if (emis) { var ek = 0.6 + 0.4 * (1 - lit); rC += emis[0] * ek; gC += emis[1] * ek; bC += emis[2] * ek; }
        var limb = Math.pow(z, 0.25); d[o] = Math.min(255, rC * limb); d[o + 1] = Math.min(255, gC * limb); d[o + 2] = Math.min(255, bC * limb); d[o + 3] = rr > 0.995 ? 255 * (1 - rr) / 0.005 : 255;
      }
      c.putImageData(img, 0, 0);
    });
    return mk(R * 2.6, R * 2.6, function (c, w, h) {
      var cx = w / 2, cy = h / 2; c.imageSmoothingQuality = 'high'; c.drawImage(tex, cx - R, cy - R, R * 2, R * 2);
      if (W0.atm === '0,0,0') return;
      // atmosphere: soft scattering rim, brighter toward the light, fading into the night side
      c.globalCompositeOperation = 'lighter';
      var at = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.16); at.addColorStop(0, 'rgba(' + W0.atm + ',0)'); at.addColorStop(0.42, 'rgba(' + W0.atm + ',0.5)'); at.addColorStop(1, 'rgba(' + W0.atm + ',0)');
      c.fillStyle = at; c.beginPath(); c.arc(cx, cy, R * 1.16, 0, TAU); c.fill();
      c.globalCompositeOperation = 'destination-out';
      var lg = c.createLinearGradient(cx - R * 0.9, cy + R * 0.8, cx + R * 0.6, cy - R * 0.55); lg.addColorStop(0, 'rgba(0,0,0,0.92)'); lg.addColorStop(0.55, 'rgba(0,0,0,0.25)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg; c.beginPath(); c.arc(cx, cy, R * 1.17, 0, TAU); c.arc(cx, cy, R * 0.995, 0, TAU, true); c.fill('evenodd');
      c.globalCompositeOperation = 'source-over';
      var inner = c.createRadialGradient(cx, cy, R * 0.75, cx, cy, R); inner.addColorStop(0, 'rgba(' + W0.atm + ',0)'); inner.addColorStop(1, 'rgba(' + W0.atm + ',0.22)'); c.globalCompositeOperation = 'lighter'; c.fillStyle = inner; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
    });
  }
  function buildBg() {
    if (!CW) return; var W0 = G.world || WORLDS[0];
    bg = mk(CW, CH, function (c, w, h) {
      var g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, W0.pastel ? '#140a26' : '#02030a'); g.addColorStop(1, W0.pastel ? '#0a1430' : '#05040f'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      var r = seeded(G.level * 41 + 5);
      // nebula: many soft overlapping clouds in two colours
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 46; i++) { var col = W0.neb[i % 2], x = (0.35 + r() * 0.75) * w, y = r() * h, rr = (0.08 + r() * 0.25) * Math.max(w, h), ng = c.createRadialGradient(x, y, 0, x, y, rr); ng.addColorStop(0, 'rgba(' + col + ',' + (0.05 + r() * 0.06) + ')'); ng.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = ng; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      // dust lanes
      c.globalCompositeOperation = 'source-over';
      for (i = 0; i < 14; i++) { var dx = (0.4 + r() * 0.6) * w, dy = r() * h, dr = (0.05 + r() * 0.1) * w, dg = c.createRadialGradient(dx, dy, 0, dx, dy, dr); dg.addColorStop(0, 'rgba(0,0,0,0.35)'); dg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = dg; c.fillRect(dx - dr, dy - dr, dr * 2, dr * 2); }
      // distant stars (tiny, many)
      for (i = 0; i < w * h / 2600; i++) { var b = r(); c.fillStyle = 'rgba(' + (b > 0.8 ? '255,230,200' : b > 0.6 ? '190,210,255' : '230,235,255') + ',' + (0.25 + r() * 0.55) + ')'; var z = (0.4 + r() * 0.9) * Math.max(1, dpr * 0.7); c.fillRect(r() * w, r() * h, z, z); }
      // the star (sun)
      var sx = OX + W0.sun[0] * S, sy = OY + W0.sun[1] * S, sr = 36 * S;
      var sg = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 7); sg.addColorStop(0, 'rgba(255,240,210,0.9)'); sg.addColorStop(0.08, 'rgba(255,210,150,0.5)'); sg.addColorStop(0.3, 'rgba(255,170,90,0.08)'); sg.addColorStop(1, 'rgba(255,150,80,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = sg; c.fillRect(sx - sr * 7, sy - sr * 7, sr * 14, sr * 14); c.globalCompositeOperation = 'source-over';
      // planet below the station, with optional rings
      var R = 560 * S, px = OX + 260 * S, py = OY + 1180 * S;
      if (W0.ring) { c.save(); c.translate(px, py); c.rotate(-0.18); c.scale(1, 0.18); for (var k = 0; k < 7; k++) { c.strokeStyle = 'rgba(' + W0.atm + ',' + (0.08 + 0.05 * (k % 3)) + ')'; c.lineWidth = R * 0.035; c.beginPath(); c.arc(0, 0, R * (1.35 + k * 0.06), Math.PI * 1.02, Math.PI * 1.98); c.stroke(); } c.restore(); }
      var ps = planetSprite(W0, R); c.drawImage(ps, px - ps.width / 2, py - ps.height / 2);
      var vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
    });
    G.moonPos = { x: 1250, y: 190 }; G.moonSpr = null;
    if (W0.moon) G.moonSpr = planetSprite({ planet: 'moon', pc: ['#c9c4bc', '#8a857c', '#5e5a54'], atm: '0,0,0' }, 46 * S);
  }
  function buildSprites() {
    SPR.titleSt = null; SPR.logo = null;
    var c = CELL * S;
    SPR.hull = mk(c, c, function (x, w, h) { var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c8d3e2'); g.addColorStop(0.5, '#7f8da3'); g.addColorStop(1, '#4a5466'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = Math.max(1, w * 0.05); x.beginPath(); x.moveTo(1, h - 1); x.lineTo(1, 1); x.lineTo(w - 1, 1); x.stroke(); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.moveTo(w - 1, 1); x.lineTo(w - 1, h - 1); x.lineTo(1, h - 1); x.stroke(); x.fillStyle = 'rgba(30,40,60,0.6)'; x.fillRect(w * 0.18, h * 0.42, w * 0.64, h * 0.16); x.fillStyle = 'rgba(120,200,255,0.75)'; x.fillRect(w * 0.22, h * 0.46, w * 0.12, h * 0.08); [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].forEach(function (p) { x.fillStyle = 'rgba(30,30,40,0.7)'; x.beginPath(); x.arc(w * p[0], h * p[1], w * 0.04, 0, TAU); x.fill(); }); });
    SPR.rock = mk(c, c, function (x, w, h) { var g = x.createRadialGradient(w * 0.35, h * 0.35, 0, w / 2, h / 2, w * 0.55); g.addColorStop(0, '#8a7f72'); g.addColorStop(1, '#2e2924'); x.fillStyle = g; x.beginPath(); for (var i = 0; i < 9; i++) { var a = i / 9 * TAU, r = w * (0.36 + (i * 37 % 10) / 70); if (i) x.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); else x.moveTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(w * 0.6, h * 0.55, w * 0.08, 0, TAU); x.fill(); });
    SPR.core = mk(c * 2, c * 2, function (x, w, h) { var g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#5a6680'); g.addColorStop(1, '#232a3a'); x.fillStyle = g; x.fillRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92); x.strokeStyle = '#9fb6d8'; x.lineWidth = Math.max(1, w * 0.02); x.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88); var r = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.36); r.addColorStop(0, '#fff6d0'); r.addColorStop(0.3, '#ffd36a'); r.addColorStop(0.7, 'rgba(255,140,40,0.6)'); r.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = r; x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,220,140,0.7)'; x.beginPath(); x.arc(w / 2, h / 2, w * 0.27, 0, TAU); x.stroke(); });
    SPR.turret = mk(c, c, function (x, w, h) { var g = x.createRadialGradient(w * 0.4, h * 0.4, 0, w / 2, h / 2, w * 0.5); g.addColorStop(0, '#dfe8f5'); g.addColorStop(1, '#46526a'); x.fillStyle = '#1a2133'; x.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84); x.fillStyle = g; x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, TAU); x.fill(); x.strokeStyle = 'rgba(120,200,255,0.8)'; x.lineWidth = Math.max(1, w * 0.04); x.beginPath(); x.arc(w / 2, h / 2, w * 0.36, 0, TAU); x.stroke(); });
    SPR.well = mk(c, c, function (x, w, h) { x.fillStyle = '#140d26'; x.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84); var g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.42); g.addColorStop(0, '#000'); g.addColorStop(0.5, '#3a1f7a'); g.addColorStop(1, 'rgba(160,110,255,0.7)'); x.fillStyle = g; x.beginPath(); x.arc(w / 2, h / 2, w * 0.4, 0, TAU); x.fill(); });
    ['fighter', 'bomber', 'pirate', 'pod', 'capital', 'carrier', 'dread', 'jelly', 'escort', 'escortBad', 'mother', 'scout', 'drone', 'derelict'].forEach(function (k) { SPR[k] = shipSprite(k); });
  }
  function shipSprite(k) {
    var R = { fighter: 16, bomber: 24, pirate: 18, pod: 10, capital: 56, carrier: 60, dread: 78, jelly: 18, escort: 34, escortBad: 34, mother: 170, scout: 14, drone: 9, derelict: 70 }[k] * S, sz = R * 2.4;
    return mk(sz, sz, function (c, w, h) {
      c.translate(w / 2, h / 2); var r = R;
      function hullG(a, b) { var g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a); return g; }
      function glow(x, y, rr, col) { var g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill(); }
      if (k === 'fighter') { glow(r * 0.9, 0, r * 0.6, 'rgba(255,120,60,0.8)'); c.fillStyle = hullG('#5a1414', '#d84a3a'); c.beginPath(); c.moveTo(-r, 0); c.lineTo(r * 0.7, -r * 0.75); c.lineTo(r * 0.4, 0); c.lineTo(r * 0.7, r * 0.75); c.closePath(); c.fill(); c.fillStyle = '#ffd0a0'; c.beginPath(); c.ellipse(-r * 0.2, 0, r * 0.28, r * 0.12, 0, 0, TAU); c.fill(); }
      else if (k === 'bomber') { glow(r * 0.9, -r * 0.3, r * 0.5, 'rgba(255,140,60,0.7)'); glow(r * 0.9, r * 0.3, r * 0.5, 'rgba(255,140,60,0.7)'); c.fillStyle = hullG('#4a2010', '#b85a2a'); c.beginPath(); c.moveTo(-r, -r * 0.2); c.lineTo(-r * 0.4, -r * 0.6); c.lineTo(r * 0.9, -r * 0.6); c.lineTo(r * 0.9, r * 0.6); c.lineTo(-r * 0.4, r * 0.6); c.lineTo(-r, r * 0.2); c.closePath(); c.fill(); c.fillStyle = '#2a1008'; c.fillRect(-r * 0.2, -r * 0.2, r * 0.6, r * 0.4); c.fillStyle = '#ffcf80'; c.fillRect(-r * 0.75, -r * 0.08, r * 0.2, r * 0.16); }
      else if (k === 'pirate') { glow(r * 0.8, 0, r * 0.6, 'rgba(220,90,255,0.8)'); c.fillStyle = hullG('#3a0f4a', '#b04ad8'); c.beginPath(); c.moveTo(-r, 0); c.lineTo(-r * 0.2, -r * 0.4); c.lineTo(r * 0.2, -r); c.lineTo(r * 0.3, -r * 0.3); c.lineTo(r * 0.8, -r * 0.2); c.lineTo(r * 0.8, r * 0.2); c.lineTo(r * 0.3, r * 0.3); c.lineTo(r * 0.2, r); c.lineTo(-r * 0.2, r * 0.4); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r * 0.16, 0, TAU); c.fill(); c.fillStyle = '#3a0f4a'; c.fillRect(-r * 0.08, -r * 0.05, r * 0.06, r * 0.06); c.fillRect(r * 0.03, -r * 0.05, r * 0.06, r * 0.06); }
      else if (k === 'pod') { c.fillStyle = hullG('#3a3a40', '#a0a0b0'); c.beginPath(); c.moveTo(-r, 0); c.lineTo(0, -r * 0.6); c.lineTo(r, -r * 0.4); c.lineTo(r, r * 0.4); c.lineTo(0, r * 0.6); c.closePath(); c.fill(); c.fillStyle = '#ff5040'; c.beginPath(); c.arc(-r * 0.2, 0, r * 0.2, 0, TAU); c.fill(); }
      else if (k === 'capital' || k === 'dread') { for (var e = -1; e <= 1; e++) glow(r * 0.95, e * r * 0.25, r * 0.25, 'rgba(255,130,60,0.7)'); c.fillStyle = hullG('#2a2e38', '#7a8294'); c.beginPath(); c.moveTo(-r, 0); c.lineTo(-r * 0.6, -r * 0.3); c.lineTo(r * 0.9, -r * 0.36); c.lineTo(r * 0.9, r * 0.36); c.lineTo(-r * 0.6, r * 0.3); c.closePath(); c.fill(); c.fillStyle = '#c04030'; c.fillRect(-r * 0.3, -r * 0.42, r * 0.5, r * 0.1); c.fillStyle = '#596173'; for (var t = 0; t < 4; t++) c.fillRect(-r * 0.4 + t * r * 0.3, -r * 0.2, r * 0.16, r * 0.4); c.fillStyle = 'rgba(255,220,160,0.8)'; for (t = 0; t < 10; t++) c.fillRect(-r * 0.5 + t * r * 0.12, r * 0.12, r * 0.03, r * 0.03); if (k === 'dread') { c.fillStyle = '#ff6040'; c.beginPath(); c.arc(-r * 0.1, 0, r * 0.1, 0, TAU); c.fill(); } }
      else if (k === 'carrier') { glow(r * 0.95, 0, r * 0.35, 'rgba(255,140,60,0.7)'); c.fillStyle = hullG('#30343e', '#868ea0'); c.beginPath(); c.moveTo(-r, -r * 0.2); c.lineTo(-r * 0.8, -r * 0.45); c.lineTo(r * 0.9, -r * 0.45); c.lineTo(r * 0.9, r * 0.45); c.lineTo(-r * 0.8, r * 0.45); c.lineTo(-r, r * 0.2); c.closePath(); c.fill(); c.fillStyle = '#10141c'; c.fillRect(-r * 0.95, -r * 0.12, r * 1.3, r * 0.24); c.fillStyle = 'rgba(255,200,120,0.85)'; for (var t2 = 0; t2 < 7; t2++) c.fillRect(-r * 0.9 + t2 * r * 0.18, -r * 0.02, r * 0.06, r * 0.04); }
      else if (k === 'jelly') { var jg = c.createRadialGradient(0, -r * 0.2, 0, 0, 0, r); jg.addColorStop(0, 'rgba(255,220,250,0.95)'); jg.addColorStop(1, 'rgba(200,120,255,0.25)'); c.fillStyle = jg; c.beginPath(); c.arc(0, 0, r * 0.8, Math.PI, 0); c.quadraticCurveTo(r * 0.6, r * 0.3, 0, r * 0.2); c.quadraticCurveTo(-r * 0.6, r * 0.3, -r * 0.8, 0); c.fill(); c.strokeStyle = 'rgba(255,200,255,0.6)'; c.lineWidth = r * 0.06; for (var q = -2; q <= 2; q++) { c.beginPath(); c.moveTo(q * r * 0.25, r * 0.2); c.quadraticCurveTo(q * r * 0.3 + r * 0.1, r * 0.6, q * r * 0.2, r); c.stroke(); } }
      else if (k === 'escort' || k === 'escortBad') { var bad = k === 'escortBad'; glow(-r * 0.95, 0, r * 0.4, bad ? 'rgba(255,90,60,0.8)' : 'rgba(90,180,255,0.8)'); c.fillStyle = hullG(bad ? '#4a1410' : '#1a2e4a', bad ? '#d8503a' : '#8fc0ff'); c.beginPath(); c.moveTo(r, 0); c.lineTo(r * 0.3, -r * 0.35); c.lineTo(-r * 0.9, -r * 0.4); c.lineTo(-r * 0.9, r * 0.4); c.lineTo(r * 0.3, r * 0.35); c.closePath(); c.fill(); c.fillStyle = bad ? '#ffd0a0' : '#e0f4ff'; c.beginPath(); c.ellipse(r * 0.35, 0, r * 0.2, r * 0.09, 0, 0, TAU); c.fill(); }
      else if (k === 'mother') { for (var m = -2; m <= 2; m++) glow(r * 0.92, m * r * 0.18, r * 0.16, 'rgba(255,120,60,0.6)'); c.fillStyle = hullG('#1e2028', '#6a6f80'); c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(-r * 0.6, -r * 0.6, r * 0.2, -r * 0.55); c.lineTo(r * 0.9, -r * 0.3); c.lineTo(r * 0.9, r * 0.3); c.lineTo(r * 0.2, r * 0.55); c.quadraticCurveTo(-r * 0.6, r * 0.6, -r, 0); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = r * 0.01; for (var p = 0; p < 12; p++) { c.beginPath(); c.moveTo(-r * 0.8 + p * r * 0.14, -r * 0.45); c.lineTo(-r * 0.8 + p * r * 0.14, r * 0.45); c.stroke(); } c.fillStyle = 'rgba(255,200,140,0.7)'; for (p = 0; p < 60; p++) c.fillRect(-r * 0.7 + (p % 20) * r * 0.07, (p < 20 ? -0.3 : p < 40 ? 0.05 : 0.3) * r, r * 0.015, r * 0.015); var cg = c.createRadialGradient(-r * 0.35, 0, 0, -r * 0.35, 0, r * 0.18); cg.addColorStop(0, '#fff0c0'); cg.addColorStop(0.4, '#ff9040'); cg.addColorStop(1, 'rgba(255,60,20,0)'); c.fillStyle = cg; c.beginPath(); c.arc(-r * 0.35, 0, r * 0.18, 0, TAU); c.fill(); }
      else if (k === 'scout' || k === 'drone') { glow(-r * 0.8, 0, r * 0.6, 'rgba(120,220,255,0.8)'); c.fillStyle = k === 'scout' ? '#ffd36a' : '#9fe6ff'; c.beginPath(); c.ellipse(0, 0, r, r * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = '#0a1430'; c.beginPath(); c.arc(r * 0.3, -r * 0.05, r * 0.28, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.38, -r * 0.12, r * 0.09, 0, TAU); c.fill(); if (k === 'scout') { c.strokeStyle = '#ffd36a'; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(-r * 0.2, -r * 0.5); c.lineTo(-r * 0.4, -r * 1.0); c.stroke(); c.fillStyle = '#ff6a50'; c.beginPath(); c.arc(-r * 0.4, -r * 1.0, r * 0.15, 0, TAU); c.fill(); c.fillStyle = '#0a1430'; c.font = 'bold ' + (r * 0.55) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('S', -r * 0.35, r * 0.05); } }
      else if (k === 'derelict') { c.fillStyle = hullG('#1c3a30', '#5fa08a'); c.beginPath(); for (var d = 0; d < 6; d++) { var a = d / 6 * TAU; c.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); } c.closePath(); c.fill(); c.strokeStyle = '#3a6a5a'; c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.95, 0.3, 2.2); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.95, 3.4, 5.6); c.stroke(); glow(0, 0, r * 0.35, 'rgba(140,255,200,0.6)'); c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(r * 0.25, r * 0.2, r * 0.12, 0, TAU); c.fill(); }
    });
  }
  function spr(img, x, y, rot, alpha) { var w = img.width / S, h = img.height / S; ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha != null) ctx.globalAlpha = alpha; ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore(); }
  function softGlow(x, y, r, col, a) { var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  function text(t, x, y, size, col, align, weight, alpha) { ctx.font = (weight || 700) + ' ' + size + 'px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(t, x + size * 0.06, y + size * 0.08); ctx.fillStyle = col || '#e6f0ff'; ctx.fillText(t, x, y); ctx.globalAlpha = 1; }
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, CW, CH); }
    ctx.setTransform(S, 0, 0, S, OX, OY);
    var W0 = G.world || WORLDS[0];
    // parallax stars drifting past (both layers extend beyond the world box on wide screens)
    var ext = OX / S + 10;
    [[starsF, 4, 0.55], [starsN, 11, 0.9]].forEach(function (L) { ctx.fillStyle = '#e8f0ff'; L[0].forEach(function (s) { var x = ((s[0] - G.t * L[1] * s[2]) % (WW + ext * 2) + WW + ext * 2) % (WW + ext * 2) - ext, tw = 0.6 + 0.4 * Math.sin(G.t * (0.6 + s[3]) + s[3] * 9); ctx.globalAlpha = L[2] * tw; ctx.fillRect(x, s[1], s[2], s[2]); }); }); ctx.globalAlpha = 1;
    // nova: the star swells and a slow, soft warm ring expands (no whiteout)
    if (W0.nova) { var nk = G.level === LAST && G.round === 2 && G.mode === 'battle' ? 1 - G.timer / G.tmax : G.mode === 'nova' ? 1 : 0; var sx = W0.sun[0], sy = W0.sun[1]; ctx.globalCompositeOperation = 'lighter'; softGlow(sx, sy, 90 + nk * 160, '255,170,90', 0.18 + nk * 0.12); if (G.mode === 'nova') { var rr = 100 + G.nova * 1500; ctx.strokeStyle = 'rgba(255,190,120,' + 0.25 * (1 - G.nova * 0.7) + ')'; ctx.lineWidth = 40; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; }
    // moon (the mothership can crack it in two)
    if (G.moonSpr) { var mp = G.moonPos, k = G.moon.cracked; if (!k) spr(G.moonSpr, mp.x, mp.y); else { var off = k * 40; ctx.save(); ctx.beginPath(); ctx.rect(mp.x - 120, mp.y - 120, 120, 240); ctx.clip(); spr(G.moonSpr, mp.x - off, mp.y - off * 0.3, -k * 0.3); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(mp.x, mp.y - 120, 120, 240); ctx.clip(); spr(G.moonSpr, mp.x + off, mp.y + off * 0.4, k * 0.25); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; softGlow(mp.x, mp.y, 40 + 30 * k, '255,140,60', 0.25 * (1 - k * 0.5)); ctx.globalCompositeOperation = 'source-over'; } }
    if (G.bh) drawBlackHole(G.bh);
    G.portals.forEach(drawPortal);
    if (G.mode !== 'title') drawStation();
    // salvage crates
    G.salvage.forEach(function (s) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = '#c9a24a'; ctx.fillRect(-7, -7, 14, 14); ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = 1.5; ctx.strokeRect(-7, -7, 14, 14); ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke(); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; softGlow(s.x, s.y, 18, '255,210,110', 0.25); ctx.globalCompositeOperation = 'source-over'; });
    if (G.derelict) { var d = G.derelict; spr(SPR.derelict, d.x, d.y, d.rot, d.hitT > 0 ? 0.8 : 1); bar(d.x - 50, d.y - 82, 100, d.hp / d.max, '#7dffb0'); }
    if (G.escort) { var e = G.escort; spr(e.hostile ? SPR.escortBad : SPR.escort, e.x, e.y); if (e.hostile) bar(e.x - 40, e.y - 42, 80, e.hp / 22, '#ff7050'); }
    G.foes.forEach(drawFoe);
    G.comets.forEach(drawComet);
    G.wells.forEach(function (w) { var a = w.live ? clamp(1 - Math.max(0, w.lt - 3.5) * 2, 0, 1) : 1, rr = w.live ? 30 + 8 * Math.sin(w.lt * 4) : 10; ctx.globalCompositeOperation = 'lighter'; softGlow(w.x, w.y, rr * 3, '150,100,255', 0.35 * a); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.beginPath(); ctx.arc(w.x, w.y, rr * 0.45, 0, TAU); ctx.fill(); if (w.live) { ctx.strokeStyle = 'rgba(190,160,255,' + 0.4 * a + ')'; ctx.lineWidth = 2; for (var q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(w.x, w.y, 230 * ((w.lt * 0.6 + q / 3) % 1), 0, TAU); ctx.stroke(); } } });
    // projectiles
    ctx.globalCompositeOperation = 'lighter';
    G.shots.forEach(function (s) {
      var col = s.k === 'torpedo' ? '255,210,110' : s.k === 'missile' ? '255,170,110' : '180,120,255';
      ctx.strokeStyle = 'rgba(' + col + ',0.45)'; ctx.lineWidth = s.k === 'torpedo' ? 5 : 3; ctx.lineCap = 'round'; ctx.beginPath(); s.trail.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.lineTo(s.x, s.y); ctx.stroke();
      softGlow(s.x, s.y, s.k === 'plasma' ? 22 : s.k === 'torpedo' ? 16 : 8, col, 0.9);
      ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(s.x, s.y, s.k === 'plasma' ? 6 : s.k === 'torpedo' ? 4 : 2.5, 0, TAU); ctx.fill();
    });
    G.beams.forEach(function (b) {
      var a = 1 - b.t / b.m, col = b.w === 'rail' ? '210,230,255' : b.w === 'ion' ? '125,255,176' : b.w === 'escort' ? '120,200,255' : b.w === 'drone' ? '255,220,120' : '127,232,255';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [[b.w === 'rail' ? 9 : 7, 0.22], [2.4, 0.95]].forEach(function (L) { ctx.strokeStyle = 'rgba(' + col + ',' + L[1] * a + ')'; ctx.lineWidth = L[0] * (b.w === 'drone' ? 0.6 : 1); ctx.beginPath(); b.pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); });
    });
    G.eshots.forEach(function (e) { var col = e.pirate ? '224,112,255' : e.sz > 4 ? '255,150,70' : '255,90,70'; softGlow(e.x, e.y, e.sz * 3, col, 0.7); ctx.fillStyle = '#ffe8d8'; ctx.beginPath(); ctx.arc(e.x, e.y, e.sz * 0.6, 0, TAU); ctx.fill(); });
    // explosions: local fireballs and EMP rings
    G.rings.forEach(function (r) { var k = r.t / r.m; if (r.emp) { ctx.strokeStyle = 'rgba(140,220,255,' + 0.45 * (1 - k) + ')'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(r.x, r.y, 40 + r.r * k, 0, TAU); ctx.stroke(); return; } var R = r.r * (0.35 + 0.65 * Math.sqrt(k)), g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, R); g.addColorStop(0, 'rgba(255,220,150,' + 0.55 * (1 - k) + ')'); g.addColorStop(0.4, 'rgba(255,130,50,' + 0.4 * (1 - k) + ')'); g.addColorStop(1, 'rgba(120,40,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, R, 0, TAU); ctx.fill(); });
    G.parts.forEach(function (p) {
      var a = clamp(p.t / p.m, 0, 1);
      if (p.k === 's') { ctx.strokeStyle = p.col; ctx.globalAlpha = a; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); ctx.globalAlpha = 1; }
    });
    ctx.globalCompositeOperation = 'source-over';
    G.parts.forEach(function (p) {
      var a = clamp(p.t / p.m, 0, 1);
      if (p.k === 'smoke') { var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.sz * (1.6 - a * 0.6)); g.addColorStop(0, 'rgba(70,64,72,' + 0.35 * a + ')'); g.addColorStop(1, 'rgba(40,40,50,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (1.6 - a * 0.6), 0, TAU); ctx.fill(); }
      else if (p.k === 'd') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a; ctx.fillStyle = '#8a94a8'; ctx.fillRect(-p.sz / 2, -p.sz / 4, p.sz, p.sz / 2); ctx.restore(); ctx.globalAlpha = 1; }
      else if (p.k === 'txt') text(p.txt, p.x, p.y, 16, '#ffe2a0', 'center', 800, a);
    });
    G.drones.forEach(function (d, i) { if (G.mode !== 'title') spr(i === 0 ? SPR.scout : SPR.drone, d.x, d.y, 0); });
    // soft overlays: solar flare warm glow, overdrive tint (low alpha, slow ramps; never a whiteout)
    if (G.flare && G.flare.warn <= 0) { var ft = G.flare.t, fa = ft < 2 ? ft / 2 : ft > 7 ? Math.max(0, (9 - ft) / 2) : 1; var fg = ctx.createRadialGradient(W0.sun[0], W0.sun[1], 0, W0.sun[0], W0.sun[1], 1500); fg.addColorStop(0, 'rgba(255,180,90,' + 0.22 * fa + ')'); fg.addColorStop(0.6, 'rgba(255,150,70,' + 0.1 * fa + ')'); fg.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = fg; ctx.fillRect(-ext, 0, WW + ext * 2, WH); }
    if (G.over > 0) { var oa = Math.min(1, G.over, (5 - G.over) * 2) * 0.12; ctx.fillStyle = 'rgba(90,150,255,' + oa + ')'; ctx.fillRect(-ext, 0, WW + ext * 2, WH); }
    drawCursor();
    drawHud();
  }
  function bar(x, y, w, k, col) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, 6); ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, (w - 2) * clamp(k, 0, 1), 4); }
  function drawBlackHole(b) {
    var t = G.t; ctx.save(); ctx.translate(b.x, b.y);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) { ctx.save(); ctx.rotate(t * (0.2 + i * 0.07) + i); ctx.scale(1, 0.32); var g = ctx.createRadialGradient(0, 0, 30, 0, 0, 120 - i * 18); g.addColorStop(0, 'rgba(255,200,130,0.0)'); g.addColorStop(0.35, 'rgba(255,170,90,' + (0.35 - i * 0.08) + ')'); g.addColorStop(1, 'rgba(160,60,30,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 120 - i * 18, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = 'rgba(255,220,170,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 34); hg.addColorStop(0, '#000'); hg.addColorStop(0.85, '#000'); hg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawPortal(p) { var a = clamp(p.t, 0, 1) * (p.n <= 0 ? clamp(1 + p.cd / 1.5, 0, 1) : 1); ctx.save(); ctx.translate(p.x, p.y); ctx.globalCompositeOperation = 'lighter'; for (var i = 0; i < 4; i++) { ctx.save(); ctx.rotate(G.t * (1 + i * 0.4) * (i % 2 ? -1 : 1)); ctx.strokeStyle = 'rgba(' + (i % 2 ? '160,110,255' : '110,220,255') + ',' + 0.5 * a + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 46 - i * 8, 18 - i * 3, 0, 0, TAU * 0.8); ctx.stroke(); ctx.restore(); } softGlow(0, 0, 50, '140,120,255', 0.3 * a); ctx.restore(); }
  function drawComet(c) { var a = Math.atan2(c.vy, c.vx); ctx.save(); ctx.globalCompositeOperation = 'lighter'; var tl = c.held ? 40 : 160, g = ctx.createLinearGradient(c.x, c.y, c.x - Math.cos(a) * tl, c.y - Math.sin(a) * tl); g.addColorStop(0, 'rgba(180,230,255,0.6)'); g.addColorStop(1, 'rgba(120,180,255,0)'); ctx.strokeStyle = g; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - Math.cos(a) * tl, c.y - Math.sin(a) * tl); ctx.stroke(); softGlow(c.x, c.y, 34, '200,240,255', 0.6); ctx.restore(); ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, TAU); ctx.fill(); if (c.held) { ctx.strokeStyle = 'rgba(255,220,120,0.7)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, 26, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } }
  function drawFoe(f) {
    if (f.k === 'rock') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); var r = f.r, rs = seeded(f.seed), g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.1); g.addColorStop(0, f.moonRock ? '#d8d2c8' : '#9a8e80'); g.addColorStop(1, f.moonRock ? '#5a564f' : '#2e2924'); ctx.fillStyle = g; ctx.beginPath(); for (var i = 0; i < 11; i++) { var a = i / 11 * TAU, q = r * (0.75 + rs() * 0.35); if (i) ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q); else ctx.moveTo(Math.cos(a) * q, Math.sin(a) * q); } ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc((rs() - 0.5) * r, (rs() - 0.5) * r, r * 0.15, 0, TAU); ctx.fill(); } ctx.restore(); return; }
    var img = SPR[f.k] || SPR.fighter, rot = f.ram === 'dive' || (f.k === 'pod' && !f.att) || f.k === 'pirate' ? (f.a || Math.PI) - Math.PI : 0;
    if (f.ram === 'glow') { var pa = 0.35 + 0.25 * Math.sin(f.ramT * TAU * 1.2); ctx.globalCompositeOperation = 'lighter'; softGlow(f.x, f.y, f.r * 2.6, '255,60,40', pa); ctx.globalCompositeOperation = 'source-over'; }
    if (f.stun > 0) { ctx.strokeStyle = 'rgba(140,220,255,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.3, G.t * 3, G.t * 3 + 4); ctx.stroke(); }
    spr(img, f.x, f.y, rot, f.hitT > 0 ? 0.75 : 1);
    if (f.k === 'pod' && f.att) { ctx.strokeStyle = 'rgba(255,120,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - f.cutT / 3.2)); ctx.stroke(); }
    if (f.k === 'mother') { bar(f.x - 150, f.y - 120, 300, f.hp / f.max, '#ff7050'); if (f.beam) { var bk = f.beam.t, cx0 = f.x - 140, cy0 = f.y; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = bk < 1.2 ? 'rgba(255,90,60,' + 0.25 * bk + ')' : 'rgba(255,170,100,' + 0.7 * (1.6 - bk) / 0.4 + ')'; ctx.lineWidth = bk < 1.2 ? 2 : 10; ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(f.beam.x, f.beam.y); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
      if (f.crack) { var ck = clamp(f.crack.t / 1.5, 0, 1), mp = G.moonPos; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,140,90,' + (0.15 + 0.5 * ck) + ')'; ctx.lineWidth = 3 + ck * 8; ctx.beginPath(); ctx.moveTo(f.x - 60, f.y - 60); ctx.lineTo(mp.x, mp.y); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; } }
    else if (f.max > 2 && f.hp < f.max) bar(f.x - f.r, f.y - f.r - 9, f.r * 2, f.hp / f.max, f.k === 'pirate' ? '#e070ff' : '#ff7050');
  }
  function drawStation() {
    // sealed area: soft blue deck plating; shield arc on the outer side
    ctx.fillStyle = 'rgba(70,140,255,0.10)';
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G.sec[idx(c, r)]) ctx.fillRect(GX + c * CELL, GY + r * CELL, CELL, CELL);
    ctx.strokeStyle = 'rgba(120,170,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); for (c = 0; c <= COLS; c++) { ctx.moveTo(GX + c * CELL, GY); ctx.lineTo(GX + c * CELL, GY + ROWS * CELL); } for (r = 0; r <= ROWS; r++) { ctx.moveTo(GX, GY + r * CELL); ctx.lineTo(GX + COLS * CELL, GY + r * CELL); } ctx.stroke();
    ctx.strokeStyle = 'rgba(140,190,255,0.25)'; ctx.setLineDash([4, 6]); ctx.strokeRect(GX, GY, COLS * CELL, ROWS * CELL); ctx.setLineDash([]);
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) { var g = G.grid[idx(c, r)], x = GX + c * CELL, y = GY + r * CELL; if (g === HULL) ctx.drawImage(SPR.hull, x, y, CELL, CELL); else if (g === ROCK) ctx.drawImage(SPR.rock, x, y, CELL, CELL); }
    G.cores.forEach(function (k) { var x = GX + k.c * CELL, y = GY + k.r * CELL; ctx.drawImage(SPR.core, x, y, CELL * 2, CELL * 2); ctx.globalCompositeOperation = 'lighter'; softGlow(x + CELL, y + CELL, CELL * 1.6, k.safe ? '255,200,110' : '255,90,60', 0.25 + 0.08 * Math.sin(G.t * 2)); ctx.globalCompositeOperation = 'source-over'; if (!k.safe && (G.mode === 'repair' || G.mode === 'arm')) { ctx.strokeStyle = 'rgba(255,110,80,' + (0.45 + 0.25 * Math.sin(G.t * 4)) + ')'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, CELL * 2 + 6, CELL * 2 + 6); } });
    G.turrets.forEach(function (t) { var p = turretPos(t); ctx.drawImage(t.well ? SPR.well : SPR.turret, p.x - CELL / 2, p.y - CELL / 2, CELL, CELL); if (t.well) { ctx.strokeStyle = 'rgba(190,160,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 9, G.t * 2, G.t * 2 + 4.5); ctx.stroke(); return; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t.ang); var bg2 = ctx.createLinearGradient(0, -4, 0, 4); bg2.addColorStop(0, '#e8f0ff'); bg2.addColorStop(1, '#5a6680'); ctx.fillStyle = bg2; ctx.fillRect(2, -3.5, 19, 7); ctx.fillStyle = WEAP[weapon()].col; ctx.fillRect(18, -2.5, 4, 5); ctx.restore(); if (t.cd > 0 && G.mode === 'battle') { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(p.x - 12, p.y + 12, 24, 3); ctx.fillStyle = '#7fe8ff'; ctx.fillRect(p.x - 12, p.y + 12, 24 * (1 - clamp(t.cd / WEAP[weapon()].cd, 0, 1)), 3); } });
    var shOn = G.shieldMax && G.shield >= 1 && G.shieldOff <= 0 && !(G.flare && G.flare.t > 0) && G.mode === 'battle';
    if (shOn) { var a = (0.12 + 0.18 * G.shield / G.shieldMax) + (G.shieldHitT > 0 ? 0.12 : 0); var sg = ctx.createLinearGradient(GR, 0, GR + 50, 0); sg.addColorStop(0, 'rgba(110,190,255,0)'); sg.addColorStop(0.7, 'rgba(110,190,255,' + a + ')'); sg.addColorStop(1, 'rgba(110,190,255,0)'); ctx.fillStyle = sg; ctx.fillRect(GR, GY - 20, 50, ROWS * CELL + 40); }
  }
  function drawCursor() {
    var m = G.mode, ax = G.aim.x, ay = G.aim.y;
    if (m === 'repair' && G.piece) { var cells = pieceCells(), ok = pieceFits(cells); if (cells) cells.forEach(function (q) { var x = GX + q[0] * CELL, y = GY + q[1] * CELL; if (!inG(q[0], q[1])) return; ctx.globalAlpha = 0.6; ctx.drawImage(SPR.hull, x, y, CELL, CELL); ctx.globalAlpha = 1; ctx.strokeStyle = ok ? '#7dffb0' : '#ff6a50'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2); if (!ok && G.grid[idx(q[0], q[1])] !== EMPTY) { ctx.fillStyle = 'rgba(255,90,70,0.35)'; ctx.fillRect(x, y, CELL, CELL); } }); return; }
    if (m === 'arm') { var a = cellAt(ax, ay); if (a) { var i = idx(a[0], a[1]), ok2 = G.grid[i] === EMPTY && G.sec[i]; ctx.globalAlpha = 0.65; ctx.drawImage(G.placeKind === 'well' ? SPR.well : SPR.turret, GX + a[0] * CELL, GY + a[1] * CELL, CELL, CELL); ctx.globalAlpha = 1; ctx.strokeStyle = ok2 ? '#7dffb0' : '#ff6a50'; ctx.lineWidth = 2; ctx.strokeRect(GX + a[0] * CELL + 1, GY + a[1] * CELL + 1, CELL - 2, CELL - 2); } return; }
    if (m === 'battle') { var col = WEAP[weapon()].col; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 14, 0, TAU); ctx.moveTo(ax - 24, ay); ctx.lineTo(ax - 8, ay); ctx.moveTo(ax + 8, ay); ctx.lineTo(ax + 24, ay); ctx.moveTo(ax, ay - 24); ctx.lineTo(ax, ay - 8); ctx.moveTo(ax, ay + 8); ctx.lineTo(ax, ay + 24); ctx.stroke(); }
  }
  function drawHud() {
    var m = G.mode, ext = OX / S;
    if (m === 'title') { drawTitle(); return; }
    if (m === 'splash') return;
    var L = -Math.min(ext, 0) + 14, top = 26, sz = 17;
    // phase + timer bar
    var phase = { arm: 'ARM', battle: 'BATTLE', repair: 'REPAIR', between: 'ROUND DONE', lifelost: 'LIFE LOST', levelclear: 'LEVEL CLEAR', nova: 'SUPERNOVA', victory: 'VICTORY', gameover: 'GAME OVER' }[m] || '';
    text('LEVEL ' + (G.level === SECRET ? '???' : G.level + '/' + LAST) + '  ' + NAMES[G.level - 1].toUpperCase(), GX, top - 8, sz * 0.85, '#9fe6ff');
    text(phase + (G.rounds > 1 && (m === 'arm' || m === 'battle' || m === 'repair') ? '  ROUND ' + G.round + '/' + G.rounds : ''), GX, top + 14, sz, '#ffe2a0', 'left', 800);
    if (m === 'arm' || m === 'battle' || m === 'repair') { var bx = GX + 300, bw = 280; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, top + 6, bw, 12); var k = clamp(G.timer / G.tmax, 0, 1); ctx.fillStyle = k < 0.25 ? '#ff7a5a' : '#7fe8ff'; ctx.fillRect(bx + 2, top + 8, (bw - 4) * k, 8); var tl = G.boss && m === 'battle' && G.timer <= 0 ? 'DESTROY THE MOTHERSHIP' : (TU.on && TU.freeze ? 'WAITING FOR YOU' : Math.ceil(G.timer) + 's'); text(tl, bx + bw + 10, top + 12, 14, '#cfe0ff'); G.hudTimer = [bx, top + 4, bw, 16]; }
    if (m === 'arm') text('TURRETS TO PLACE: ' + G.toPlace + (has('gwell') ? '   (SWITCH: ' + (G.placeKind === 'well' ? 'GRAVITY WELL' : 'TURRET') + ')' : ''), GX, top + 40, 14, '#7dffb0');
    if (m === 'repair') { text('NEXT', GX + 300, top + 40, 12, '#9fb6e6'); if (G.nextPiece) G.nextPiece.forEach(function (q) { ctx.drawImage(SPR.hull, GX + 345 + q[0] * 13, top + 32 + q[1] * 13, 12, 12); }); text('SEALED CORES: ' + safeCores() + '/' + G.cores.length, GX, top + 40, 14, safeCores() ? '#7dffb0' : '#ff8a6a'); }
    // right side: score, lives, weapon, special, shield
    var R = WW + Math.max(ext, 0) - 14 - (ext > 0 ? 0 : 0), rx = Math.min(R, WW - 14);
    text('SCORE ' + G.score.toLocaleString(), rx, top - 8, sz, '#e6f0ff', 'right', 800);
    text('HIGH ' + Math.max(best(), G.score).toLocaleString(), rx, top + 14, 12, '#9fb6e6', 'right');
    for (var i = 0; i < Math.min(G.lives, 6); i++) { var lx = rx - 10 - i * 22, ly = top + 34; ctx.drawImage(SPR.core, lx - 8, ly - 8, 16, 16); }
    G.hudLives = [rx - 140, top + 24, 140, 22];
    var by = WH - 40;
    if (m === 'battle' || m === 'arm') {
      var w = weapon(); text('WEAPON: ' + WEAP[w].name + (G.weapons.length > 1 ? '  [E / SWITCH]' : ''), GR + 30, by, 14, WEAP[w].col);
      if (has('emp')) { var sx2 = GR + 30, sw = 220; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx2, by + 14, sw, 10); ctx.fillStyle = G.special >= 1 ? '#ffd36a' : '#a08040'; ctx.fillRect(sx2 + 2, by + 16, (sw - 4) * G.special, 6); text(G.special >= 1 ? (has('overdrive') ? 'SPECIAL READY: EMP + OVERDRIVE [Q]' : 'SPECIAL READY: EMP [Q]') : 'SPECIAL CHARGING', sx2 + sw + 10, by + 19, 12, G.special >= 1 ? '#ffd36a' : '#9fb6e6'); G.hudSpecial = [sx2, by + 10, sw, 18]; }
      if (G.shieldMax) { var shx = GR + 560, shw = 160; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(shx, by + 14, shw, 10); var off = G.flare && G.flare.t > 0; ctx.fillStyle = off ? '#555' : '#6fc0ff'; ctx.fillRect(shx + 2, by + 16, (shw - 4) * G.shield / G.shieldMax, 6); text(off ? 'SHIELDS OFFLINE' : 'SHIELD', shx + shw + 10, by + 19, 12, off ? '#ffb080' : '#9fd0ff'); }
    }
    if (G.flare && G.flare.warn > 0) text('SOLAR FLARE IN ' + Math.ceil(G.flare.warn), WW / 2 + 200, 70, 22, '#ffb070', 'center', 800);
    if (G.msgT > 0) { var al = Math.min(1, G.msgT * 1.5); text(G.msg, WW / 2 + 160, WH * 0.42, 40, '#ffe2a0', 'center', 800, al); if (G.msg2) text(G.msg2, WW / 2 + 160, WH * 0.42 + 40, 18, '#cfe0ff', 'center', 600, al); }
    if (G.hintT > 0) text(G.hintTxt, WW / 2 + 160, WH - 90, 16, '#ffd0a0', 'center', 700, Math.min(1, G.hintT * 2));
    if (m === 'gameover') { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-ext, 0, WW + ext * 2, WH); text('GAME OVER', WW / 2, WH * 0.4, 64, '#ff8a6a', 'center', 800); text(G.newHi ? 'NEW HIGH SCORE ' + G.score.toLocaleString() : 'SCORE ' + G.score.toLocaleString(), WW / 2, WH * 0.4 + 60, 22, '#ffe2a0', 'center'); }
    if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-ext, 0, WW + ext * 2, WH); text('PAUSED', WW / 2, WH * 0.32, 56, '#9fe6ff', 'center', 800); }
  }
  /* ---------------- title art: a fortified orbital rampart over the planet ---------------- */
  function titleStationSprite() {
    var R = 230, pad = 1.75, sz = R * 2 * pad * S;
    return mk(sz * 1.25, sz, function (c, w, h) {
      var k = S, cx = w / 2, cy = h / 2; c.translate(cx, cy); c.scale(k, k);
      function metal(x0, y0, x1, y1, lo, hi) { var g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, hi); g.addColorStop(0.45, lo); g.addColorStop(1, '#141a26'); return g; }
      var rnd2 = seeded(77);
      // solar wings
      [-1, 1].forEach(function (sd) {
        c.fillStyle = metal(0, -8, 0, 8, '#58657a', '#c9d4e4'); c.fillRect(sd > 0 ? R * 0.95 : -R * 1.95, -7, R, 14);
        for (var p = 0; p < 4; p++) { var px = sd > 0 ? R * 1.18 + p * 64 : -R * 1.18 - p * 64 - 56, py = -64;
          var g = c.createLinearGradient(px, py, px + 56, py + 128); g.addColorStop(0, '#2b4f9a'); g.addColorStop(0.5, '#0f2350'); g.addColorStop(1, '#091633'); c.fillStyle = g; c.fillRect(px, py, 56, 128);
          c.strokeStyle = 'rgba(150,190,255,0.35)'; c.lineWidth = 0.8; for (var gx = 1; gx < 4; gx++) { c.beginPath(); c.moveTo(px + gx * 14, py); c.lineTo(px + gx * 14, py + 128); c.stroke(); } for (var gy = 1; gy < 8; gy++) { c.beginPath(); c.moveTo(px, py + gy * 16); c.lineTo(px + 56, py + gy * 16); c.stroke(); }
          var sh = c.createLinearGradient(px, py, px + 56, py + 40); sh.addColorStop(0, 'rgba(255,240,220,0.28)'); sh.addColorStop(1, 'rgba(255,240,220,0)'); c.fillStyle = sh; c.fillRect(px, py, 56, 128);
          c.strokeStyle = '#8b97ab'; c.lineWidth = 2; c.strokeRect(px, py, 56, 128); }
      });
      // spokes
      for (var i = 0; i < 6; i++) { c.save(); c.rotate(i / 6 * TAU + 0.26); c.fillStyle = metal(0, -9, 0, 9, '#4c586c', '#b8c4d6'); c.fillRect(40, -9, R - 70, 18); c.fillStyle = 'rgba(255,200,120,0.85)'; for (var q = 0; q < 5; q++) c.fillRect(56 + q * 26, -2, 6, 4); c.restore(); }
      // outer rampart ring (torus) with sun-lit top-right and planet-lit underside
      var rg = c.createRadialGradient(0, 0, R - 46, 0, 0, R + 4); rg.addColorStop(0, '#2a3242'); rg.addColorStop(0.35, '#9aa7bb'); rg.addColorStop(0.6, '#d9e2ee'); rg.addColorStop(0.85, '#6c788c'); rg.addColorStop(1, '#232a38');
      c.fillStyle = rg; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.arc(0, 0, R - 46, 0, TAU, true); c.fill();
      // panel seams + window lights on the ring
      c.strokeStyle = 'rgba(20,26,38,0.6)'; c.lineWidth = 1.4;
      for (i = 0; i < 48; i++) { var a = i / 48 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * (R - 46), Math.sin(a) * (R - 46)); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.stroke(); }
      c.beginPath(); c.arc(0, 0, R - 23, 0, TAU); c.stroke();
      for (i = 0; i < 140; i++) { var a2 = rnd2() * TAU, rr = R - 34 + rnd2() * 22; if (rnd2() < 0.55) { c.fillStyle = rnd2() < 0.7 ? 'rgba(255,214,150,0.95)' : 'rgba(150,220,255,0.95)'; c.fillRect(Math.cos(a2) * rr - 1.5, Math.sin(a2) * rr - 1, 3, 2); } }
      // battlements (the rampart): merlons on the outer rim
      for (i = 0; i < 36; i++) { c.save(); c.rotate(i / 36 * TAU); var mg = c.createLinearGradient(R - 2, 0, R + 18, 0); mg.addColorStop(0, '#8693a8'); mg.addColorStop(1, '#3a4456'); c.fillStyle = mg; c.fillRect(R - 2, -8, 18, 16); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(R + 14, -8, 2, 16); c.restore(); }
      // turret towers with barrels
      for (i = 0; i < 6; i++) { c.save(); c.rotate(i / 6 * TAU + 0.78); c.translate(R + 6, 0);
        var tg = c.createRadialGradient(-6, -6, 2, 0, 0, 24); tg.addColorStop(0, '#eef4fc'); tg.addColorStop(0.6, '#7d8aa0'); tg.addColorStop(1, '#2a3242'); c.fillStyle = tg; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
        c.fillStyle = '#3a4456'; c.fillRect(8, -9, 34, 6); c.fillRect(8, 3, 34, 6); c.fillStyle = '#c9d4e4'; c.fillRect(8, -9, 34, 2); c.fillRect(8, 3, 34, 2);
        c.fillStyle = 'rgba(125,255,176,0.9)'; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill(); c.restore(); }
      // inner hub with reactor core
      var hg = c.createRadialGradient(-20, -20, 6, 0, 0, 64); hg.addColorStop(0, '#e6edf7'); hg.addColorStop(0.5, '#7b879b'); hg.addColorStop(1, '#1e2532'); c.fillStyle = hg; c.beginPath(); c.arc(0, 0, 62, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(20,26,38,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 44, 0, TAU); c.stroke();
      var cg = c.createRadialGradient(0, 0, 0, 0, 0, 34); cg.addColorStop(0, 'rgba(230,255,255,1)'); cg.addColorStop(0.35, 'rgba(110,220,255,0.95)'); cg.addColorStop(1, 'rgba(40,90,200,0)'); c.fillStyle = cg; c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.fill();
      // global lighting: sun from top-right, planet bounce from below, shadow lower-left
      c.globalCompositeOperation = 'source-atop';
      var L = c.createLinearGradient(R, -R, -R, R); L.addColorStop(0, 'rgba(255,236,210,0.28)'); L.addColorStop(0.5, 'rgba(0,0,0,0)'); L.addColorStop(1, 'rgba(0,8,24,0.55)'); c.fillStyle = L; c.fillRect(-w, -h, w * 2, h * 2);
      var B = c.createLinearGradient(0, R * 0.4, 0, R * 1.3); B.addColorStop(0, 'rgba(90,170,255,0)'); B.addColorStop(1, 'rgba(90,170,255,0.3)'); c.fillStyle = B; c.fillRect(-w, -h, w * 2, h * 2);
      c.globalCompositeOperation = 'source-over';
    });
  }
  function titleLogo() {
    var w = 820 * S, h = 230 * S;
    return mk(w, h, function (c) {
      c.scale(S, S); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.font = '900 132px "Arial Black", Impact, system-ui, sans-serif';
      var g = c.createLinearGradient(0, 22, 0, 150); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#cfdcef'); g.addColorStop(0.52, '#6f819c'); g.addColorStop(0.8, '#b9c8de'); g.addColorStop(1, '#e8f0fb');
      c.shadowColor = 'rgba(80,170,255,0.55)'; c.shadowBlur = 26; c.fillStyle = '#0b1424'; c.fillText('RAMPART', 410, 146); c.shadowBlur = 0;
      c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = '#0a1220'; c.strokeText('RAMPART', 410, 140);
      c.fillStyle = g; c.fillText('RAMPART', 410, 140);
      c.lineWidth = 2; c.strokeStyle = 'rgba(160,215,255,0.9)'; c.strokeText('RAMPART', 410, 140);
      // gold plaque
      var px = 190, py = 166, pw = 440, ph = 46, pg = c.createLinearGradient(0, py, 0, py + ph); pg.addColorStop(0, '#ffe7a0'); pg.addColorStop(0.5, '#d29a2e'); pg.addColorStop(1, '#7a5212');
      c.beginPath(); c.moveTo(px + 18, py); c.lineTo(px + pw - 18, py); c.lineTo(px + pw, py + ph / 2); c.lineTo(px + pw - 18, py + ph); c.lineTo(px + 18, py + ph); c.lineTo(px, py + ph / 2); c.closePath(); c.fillStyle = pg; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff1c2'; c.stroke();
      c.font = '800 26px system-ui, sans-serif'; c.fillStyle = '#2a1a04'; c.fillText('S P A C E   E D I T I O N', 410, py + 33);
    });
  }
  function drawTitle() {
    var t = G.t, cx = WW / 2 + 140;
    if (!SPR.titleSt) SPR.titleSt = titleStationSprite(); if (!SPR.logo) SPR.logo = titleLogo();
    // comet streaking across the top (slow, soft)
    var ck = (t * 0.045) % 1, ccx = 1700 - ck * 2000, ccy = 70 + ck * 260; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var tg = ctx.createLinearGradient(ccx, ccy, ccx + 300, ccy - 39); tg.addColorStop(0, 'rgba(200,235,255,0.55)'); tg.addColorStop(1, 'rgba(120,180,255,0)'); ctx.strokeStyle = tg; ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx + 300, ccy - 39); ctx.stroke(); ctx.lineWidth = 3; ctx.stroke();
    softGlow(ccx, ccy, 26, '210,240,255', 0.6); ctx.restore(); ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.arc(ccx, ccy, 4, 0, TAU); ctx.fill();
    // the station: soft shield bubble, then the fortress itself
    var stx = 255, sty = 405, ssc = 0.64; ctx.save(); ctx.globalCompositeOperation = 'lighter'; softGlow(stx, sty, 330 * ssc, '90,170,255', 0.10); ctx.restore();
    ctx.strokeStyle = 'rgba(140,200,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(stx, sty, 300 * ssc, 0, TAU); ctx.stroke();
    ctx.save(); ctx.translate(stx, sty); ctx.rotate(Math.sin(t * 0.15) * 0.04); var sw2 = SPR.titleSt.width / S * ssc, sh3 = SPR.titleSt.height / S * ssc; ctx.drawImage(SPR.titleSt, -sw2 / 2, -sh3 / 2, sw2, sh3); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; softGlow(stx, sty, 46, '110,220,255', 0.35 + 0.05 * Math.sin(t * 1.2)); ctx.restore();
    // a skirmish: ships to the right, steady thin lasers + torpedo trails (no flashes)
    var ships = [[1250, 620, 0.9], [1380, 700, 0.75], [1180, 740, 0.8], [1460, 560, 0.7]];
    ships.forEach(function (sh, i) { var bx = sh[0] + Math.sin(t * 0.5 + i) * 30, by = sh[1] + Math.cos(t * 0.4 + i * 2) * 22; sh.x = bx; sh.y = by; spr(i === 3 ? SPR.bomber : SPR.fighter, bx, by, 0, sh[2]); });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (var li = 0; li < 3; li++) { var ph = (t * 0.6 + li * 0.33) % 1, sh2 = ships[li], tw = 0.35 * Math.sin(ph * Math.PI), sa = li * 2.1 + 0.4, ox = stx + Math.cos(sa) * 250, oy = sty + Math.sin(sa) * 250;
      ox = stx + 165 * Math.cos(0.2 + li * 0.35); oy = sty + 165 * Math.sin(0.2 + li * 0.35); ctx.strokeStyle = 'rgba(125,232,255,' + (0.25 + tw).toFixed(3) + ')'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(lerp(ox, sh2.x, 0.15 + ph * 0.85), lerp(oy, sh2.y, 0.15 + ph * 0.85)); ctx.stroke(); }
    for (var ti = 0; ti < 2; ti++) { var tp = (t * 0.25 + ti * 0.5) % 1, ax = stx + 150, ay = sty + 60 + ti * 50, tx2 = ships[3 - ti * 2].x, ty2 = ships[3 - ti * 2].y, hx = lerp(ax, tx2, tp), hy2 = lerp(ay, ty2, tp) - Math.sin(tp * Math.PI) * 60;
      for (var q = 0; q < 14; q++) { var tq = Math.max(0, tp - q * 0.012), qx = lerp(ax, tx2, tq), qy = lerp(ay, ty2, tq) - Math.sin(tq * Math.PI) * 60; ctx.fillStyle = 'rgba(255,170,90,' + (0.3 * (1 - q / 14)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(qx, qy, 4 - q * 0.2, 0, TAU); ctx.fill(); }
      softGlow(hx, hy2, 16, '255,200,120', 0.7); }
    ctx.restore();
    // logo
    var lw = SPR.logo.width / S, lh = SPR.logo.height / S; ctx.drawImage(SPR.logo, cx - lw / 2, 150, lw, lh);
    text('Fortify the station. Arm the turrets. Hold the line.', cx, 400, 18, '#cfe0ff', 'center', 600);
    text('24 levels  \u2022  lasers, torpedoes, railguns, plasma  \u2022  pirates, wormholes, a black hole and a supernova', cx, 428, 14, '#9fb6e6', 'center', 600);
    // start prompt is the HTML .start-btn (steady, flash-safe)
    var hy = 540; text('HIGH SCORES', cx, hy, 14, '#ffe2a0', 'center', 800);
    if (hiScores.length) hiScores.slice(0, 5).forEach(function (h, i) { text((i + 1) + '.  ' + h.s.toLocaleString() + '   LEVEL ' + (h.l === SECRET ? '???' : h.l), cx, hy + 24 + i * 20, 13, i ? '#9fb6e6' : '#e6f0ff', 'center'); });
    else text('No scores yet', cx, hy + 24, 13, '#9fb6e6', 'center');
    text(isTouch ? 'Tap to aim and fire  \u2022  drag to place  \u2022  SWITCH and SPECIAL buttons' : 'Mouse or arrows/WASD aim  \u2022  click or Space fire/place  \u2022  E switch/rotate  \u2022  Q special  \u2022  P pause  \u2022  M mute', cx, WH - 40, 13, '#9fb6e6', 'center');
    // Scout wanders the title screen (tap him three times...)
    var sx = 1150 + Math.sin(t * 0.7) * 260, sy = 640 + Math.sin(t * 1.3) * 60; G.titleScout = { x: sx, y: sy }; spr(SPR.scout, sx, sy, Math.sin(t * 2) * 0.1);
    if (G.secretTaps > 0) text(G.secretTaps < 3 ? 'woof? (' + G.secretTaps + '/3)' : 'SECRET UNLOCKED', sx, sy - 34, 13, '#ffd36a', 'center');
    // a demo fleet drifting past
  }

  /* ---------------- input: mouse, touch, keyboard, gamepad-free simple controls ---------------- */
  var I = { down: {} }, KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'fire' };
  function cardOpen() { return tutEl && !tutEl.hidden && (TU.card || TU.quick || (TU.on && TU.hold)); }
  function act(press) { // the one main action: start, place or fire
    if (performance.now() < (G.inputLock || 0)) return;
    var m = G.mode;
    if (m === 'title') { if (press) startGame(G.secretTaps >= 3 ? SECRET : 1); return; }
    if (G.paused || cardOpen()) return;
    if (m === 'arm' && press) placeTurret();
    else if (m === 'repair' && press) placePiece();
    else if (m === 'battle' && press) { if (!grabComet()) fireAll(); }
  }
  function doSwitch() {
    unlockAudio(); if (G.paused || cardOpen()) return;
    if (G.mode === 'repair' && G.piece) { G.piece = rot(G.piece); Sfx.rotate(); TU.rot++; }
    else if (G.mode === 'arm' && has('gwell')) { G.placeKind = G.placeKind === 'well' ? 'tur' : 'well'; Sfx.rotate(); }
    else if (G.mode === 'battle' || G.mode === 'arm') { if (G.weapons.length > 1) { G.wi = (G.wi + 1) % G.weapons.length; Sfx.rotate(); hint(WEAP[weapon()].name); TU.sw = 1; } else hint('More weapons unlock in later levels'); }
    syncButtons();
  }
  window.addEventListener('keydown', function (e) {
    unlockAudio(); var k = KEYS[e.code];
    if (tutEl && !tutEl.hidden && (e.code === 'Enter' || (e.code === 'Space' && (TU.card || TU.quick || (TU.on && TU.hold))))) { var nb = tutEl.querySelector('.tut-next'); if (nb && !nb.hidden) { e.preventDefault(); nb.click(); return; } }
    if (k) { e.preventDefault(); if (!I.down[k] && k === 'fire') act(true); I.down[k] = true; return; }
    if (e.code === 'Enter') { e.preventDefault(); act(true); }
    else if (e.code === 'KeyE' || e.code === 'KeyR' || e.code === 'KeyZ') doSwitch();
    else if (e.code === 'KeyQ' || e.code === 'KeyX') useSpecial();
    else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    else if (e.code === 'KeyM') setMuted(!muted);
    if (G.mode === 'title') { G.typed = ((G.typed || '') + (e.key || '')).slice(-5).toUpperCase(); if (G.typed === 'SCOUT') { G.secretTaps = 3; Sfx.life(); } }
  });
  window.addEventListener('keyup', function (e) { var k = KEYS[e.code]; if (k) I.down[k] = false; });
  window.addEventListener('blur', function () { I.down = {}; G.fireHeld = false; });
  function toWorld(e) { var r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) * dpr - OX) / S, y: ((e.clientY - r.top) * dpr - OY) / S }; }
  var activePtr = null;
  canvas.addEventListener('pointerdown', function (e) {
    unlockAudio(); canvas.focus(); e.preventDefault();
    if (e.button === 2) { doSwitch(); return; }
    var p = toWorld(e); G.aim.x = p.x; G.aim.y = p.y; G.kbAim = false; activePtr = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (x) { }
    if (G.mode === 'title') { var ts = G.titleScout; if (ts && hyp(p.x - ts.x, p.y - ts.y) < 40) { G.secretTaps = Math.min(3, G.secretTaps + 1); Sfx.rotate(); if (G.secretTaps === 3) Sfx.life(); return; } act(true); return; }
    if (G.paused) { togglePause(false); return; }
    G.touchDrag = e.pointerType === 'touch' && G.mode === 'repair';
    if (G.mode === 'battle') { G.fireHeld = true; act(true); }
    else if (e.pointerType !== 'touch') act(true);
  });
  canvas.addEventListener('pointermove', function (e) { var p = toWorld(e); if (e.pointerType !== 'touch' || activePtr === e.pointerId) { G.aim.x = p.x; G.aim.y = p.y; G.kbAim = false; } });
  function ptrUp(e) {
    if (activePtr !== e.pointerId) return; activePtr = null; G.fireHeld = false;
    if (e.pointerType === 'touch' && (G.mode === 'arm' || G.mode === 'repair')) act(true); // tap or drag-and-lift places
    G.touchDrag = false;
  }
  canvas.addEventListener('pointerup', ptrUp); canvas.addEventListener('pointercancel', function (e) { activePtr = null; G.fireHeld = false; G.touchDrag = false; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var touchEl = document.getElementById('touch'), tSwitch = document.getElementById('t-switch'), tSpecial = document.getElementById('t-special');
  [[tSwitch, doSwitch], [tSpecial, useSpecial]].forEach(function (b) { b[0].addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); unlockAudio(); b[0].classList.add('active'); b[1](); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b[0].addEventListener(ev, function () { b[0].classList.remove('active'); }); }); });
  function placeTouch() { touchEl.hidden = !isTouch; document.body.classList.toggle('is-touch', isTouch); }
  function syncButtons() {
    var sw = G.mode === 'repair' ? 'ROTATE' : G.mode === 'arm' && has('gwell') ? (G.placeKind === 'well' ? 'WELL' : 'TURRET') : 'WEAPON';
    tSwitch.querySelector('small').textContent = sw; tSpecial.hidden = !has('emp') || G.mode === 'title'; tSpecial.classList.toggle('ready', G.special >= 1);
  }

  /* ---------------- tutorial (guided first level) + "new thing" cards: same system as Rampart ---------------- */
  var TU = { on: false, i: 0, hold: false, freeze: false, sunk: 0, rot: 0, placed: 0, card: null, quick: false, qi: 0 };
  var tutState = store.get('tutorial', null);
  function T(a, b) { return isTouch ? a : b; }
  var TSTEPS = [
    { mode: 'arm', info: true, hl: null, title: 'Welcome, Commander!', text: function () { return 'You run orbital station <b>Aegis</b>. Every round has three steps: <b>arm</b> your turrets, <b>battle</b> the fleet, then <b>repair</b> the hull. The clock waits for you during this guide.'; } },
    { mode: 'arm', info: true, hl: 'cores', title: 'Your goal', text: function () { return 'The glowing squares are <b>station cores</b>. Keep at least one core <b>fully sealed</b> inside hull plates. A core with a gap in its hull does not count.'; } },
    { mode: 'arm', hl: 'home', title: 'Step 1: Place turrets', wait: function () { return G.toPlace <= 0; }, text: function () { return 'Turrets only work inside your sealed hull (the blue deck). Green outline = good spot.'; }, todo: function () { return T('Tap inside the hull to drop each turret (' + G.toPlace + ' left).', 'Click inside the hull, or move with arrows/WASD and press Space (' + G.toPlace + ' left).'); } },
    { mode: 'battle', info: true, hl: null, title: 'Battle!', text: function () { return 'Hegemony fighters fly in from the right and shoot your hull. <b>All your turrets fire at the spot you aim at.</b>'; } },
    { mode: 'battle', hl: null, title: 'Step 2: Aim and fire', wait: function () { return TU.sunk > 0 || G.mode !== 'battle'; }, text: function () { return 'Laser beams hit instantly. Turrets need a moment to recharge between shots.'; }, todo: function () { return T('Tap a ship to fire. Keep your finger down to keep firing.', 'Point at a ship and click, or hold Space.'); } },
    { mode: 'battle', hl: null, small: true, live: true, title: 'Nice shot!', wait: function () { return G.mode !== 'battle'; }, text: function () { return 'The clock runs now. Keep shooting until the battle ends.'; }, todo: function () { return T('Keep tapping ships.', 'Keep aiming and firing.'); } },
    { mode: 'repair', info: true, hl: 'home', title: 'Repair time', text: function () { return 'Enemy fire blew holes in your hull. You get hull pieces one at a time to patch the gaps.'; } },
    { mode: 'repair', hl: 'switch', title: 'Step 3: Turn a piece', wait: function () { return TU.rot > 0; }, text: function () { return 'Turn pieces to fit the gaps. The next piece shows at the top.'; }, todo: function () { return T('Tap the round SWITCH button (bottom right).', 'Press E (or right-click) to turn the piece.'); } },
    { mode: 'repair', hl: 'home', title: 'Step 4: Place a piece', wait: function () { return TU.placed > 0; }, text: function () { return 'Green = it fits. Red = something is in the way.'; }, todo: function () { return T('Drag the piece with your finger (it floats just above it) and lift to drop it.', 'Move with the mouse or arrows, then click or press Space.'); } },
    { mode: 'repair', hl: 'home', title: 'Step 5: Seal a core', wait: function () { return G.cores[0] && G.cores[0].safe; }, text: function () { return 'Close every gap so the core is surrounded. The deck inside turns blue when it is sealed.'; }, todo: function () { return 'Keep placing pieces until the red box around the core goes away.'; } },
    { mode: ['repair', 'between', 'arm'], info: true, hl: 'timer', title: 'Sealed!', text: function () { return 'From now on the timer really counts. If it hits zero and <b>no core is sealed</b>, you lose a life. Sealing more cores gives more turrets and points.'; } },
    { mode: ['repair', 'between', 'arm'], info: true, hl: 'lives', title: 'Lives and levels', text: function () { return 'These cores are your lives. Lose all 3 and the game is over. Each level has 2 rounds. <b>Every new level brings one new weapon, threat or surprise</b>, and a card like this explains it.'; } },
    { mode: ['repair', 'between', 'arm', 'battle'], info: true, hl: null, last: true, title: "You're ready!", text: function () { return 'Arm, battle, repair. Replay this guide any time from <b>How to Play</b> on the title screen or the pause menu.'; } }
  ];
  var tutEl = document.createElement('div'); tutEl.id = 'tut'; tutEl.hidden = true;
  tutEl.innerHTML = '<div class="tut-spot" hidden></div><div class="tut-card" role="dialog" aria-live="polite" aria-labelledby="tut-title"><div class="tut-step"></div><h3 id="tut-title"></h3><p class="tut-text"></p><p class="tut-do"></p><div class="tut-btns"><button type="button" class="tut-skip">Skip tutorial</button><span class="tut-sp"></span><button type="button" class="tut-back">&#9664; Back</button><button type="button" class="tut-next">Next &#9654;</button></div></div>';
  wrap.appendChild(tutEl);
  var tutSpot = tutEl.querySelector('.tut-spot'), tutCard = tutEl.querySelector('.tut-card');
  ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { tutCard.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
  tutEl.querySelector('.tut-next').addEventListener('click', function (e) { e.preventDefault(); tutNext(); });
  tutEl.querySelector('.tut-back').addEventListener('click', function (e) { e.preventDefault(); tutBack(); });
  tutEl.querySelector('.tut-skip').addEventListener('click', function (e) { e.preventDefault(); if (TU.card) closeCard(); else tutEnd(TU.quick ? null : 'skipped'); });
  var startBtn = document.createElement('button'); startBtn.type = 'button'; startBtn.className = 'start-btn'; wrap.appendChild(startBtn);
  ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { startBtn.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
  startBtn.addEventListener('click', function (e) { e.preventDefault(); unlockAudio(); startBtn.blur(); if (G.mode === 'title') act(true); });
  var howBtn = document.createElement('button'); howBtn.type = 'button'; howBtn.className = 'how-btn'; wrap.appendChild(howBtn);
  ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { howBtn.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
  howBtn.addEventListener('click', function (e) { e.preventDefault(); unlockAudio(); howBtn.blur(); startTutorial(); });
  function modesOf(s) { return Array.isArray(s.mode) ? s.mode : [s.mode]; }
  function startTutorial() { if (ov) ov.hide(); G.paused = false; TU.quick = false; TU.card = null; TU.on = true; TU.i = 0; TU.sunk = TU.rot = TU.placed = 0; startGame(1); tutShow(); }
  function tutEnd(state) { if (state) { tutState = state; store.set('tutorial', state); } TU.on = false; TU.quick = false; TU.hold = TU.freeze = false; tutEl.hidden = true; I.down = {}; G.inputLock = performance.now() + 250; if (G.paused && ov) ov.show(pauseMenu()); if (G.pendingCard) { var c = G.pendingCard; G.pendingCard = null; card(c[0], c[1], c[2]); } }
  function tutStep() { return TU.quick ? TSTEPS[TU.qi] : TSTEPS[TU.i]; }
  function tutNext() {
    if (TU.card) { closeCard(); return; }
    if (TU.quick) { if (TU.qi >= TSTEPS.length - 1) { tutEnd(null); return; } TU.qi++; tutShow(); return; }
    var s = tutStep(); if (!s) return; if (s.last) { tutEnd('done'); return; } if (!s.info) return; TU.i++; tutShow();
  }
  function canBack() { if (TU.card) return false; if (TU.quick) return TU.qi > 0; var p = TSTEPS[TU.i - 1]; return !!(p && p.info && modesOf(p).indexOf(G.mode) >= 0); }
  function tutBack() { if (TU.quick) { if (TU.qi > 0) { TU.qi--; tutShow(); } return; } if (canBack()) { TU.i--; tutShow(); } }
  function tutShow() {
    var s = tutStep(); if (!s) return; var n = TU.quick ? TU.qi : TU.i;
    tutEl.querySelector('.tut-step').textContent = (TU.quick ? 'How to Play: ' : 'Tutorial: ') + 'card ' + (n + 1) + ' of ' + TSTEPS.length;
    tutEl.querySelector('#tut-title').textContent = s.title; tutEl.querySelector('.tut-text').innerHTML = s.text();
    var todo = tutEl.querySelector('.tut-do'); if (!TU.quick && s.todo) { todo.hidden = false; todo.innerHTML = '<span>Your turn:</span> ' + s.todo(); } else todo.hidden = true;
    var next = tutEl.querySelector('.tut-next'); next.hidden = !(TU.quick || s.info); next.innerHTML = (TU.quick ? TU.qi >= TSTEPS.length - 1 : s.last) ? (TU.quick ? 'Close' : "Let's play!") : 'Next &#9654;';
    tutEl.querySelector('.tut-back').hidden = !canBack(); var sk = tutEl.querySelector('.tut-skip'); sk.hidden = false; sk.textContent = TU.quick ? 'Close' : 'Skip tutorial';
    tutCard.classList.toggle('small', !!s.small && !TU.quick); tutCard.classList.toggle('act', !TU.quick && !s.info);
    TU.key = (TU.quick ? 'q' : 't') + n + '|' + (s.todo ? s.todo() : ''); tutPlace(s.hl);
  }
  function hlRect(h) { // world rect for a highlight target
    if (h === 'cores') { var xs = G.cores.map(function (k) { return GX + k.c * CELL; }), ys = G.cores.map(function (k) { return GY + k.r * CELL; }); return [Math.min.apply(null, xs) - 8, Math.min.apply(null, ys) - 8, Math.max.apply(null, xs) - Math.min.apply(null, xs) + CELL * 2 + 16, Math.max.apply(null, ys) - Math.min.apply(null, ys) + CELL * 2 + 16]; }
    if (h === 'home') { var k = G.cores[0]; return [GX + (k.c - 3) * CELL - 4, GY + (k.r - 3) * CELL - 4, CELL * 8 + 8, CELL * 8 + 8]; }
    if (h === 'timer') return G.hudTimer; if (h === 'lives') return G.hudLives; if (h === 'special') return G.hudSpecial; if (h === 'weapon') return [GR + 24, WH - 54, 520, 26];
    return null;
  }
  function tutPlace(h) {
    if (h === undefined) { var s = TU.card ? null : tutStep(); h = TU.card ? TU.card.hl : s && s.hl; }
    var r = h ? hlRect(h) : null, wr = wrap.getBoundingClientRect();
    if (h === 'switch' && isTouch) { var b = tSwitch.getBoundingClientRect(); tutSpot.hidden = false; tutSpot.style.left = (b.left - wr.left - 6) + 'px'; tutSpot.style.top = (b.top - wr.top - 6) + 'px'; tutSpot.style.width = (b.width + 12) + 'px'; tutSpot.style.height = (b.height + 12) + 'px'; tutCard.classList.add('at-top'); return; }
    if (!r) { tutSpot.hidden = true; tutCard.classList.remove('at-top'); return; }
    var x = (OX + r[0] * S) / dpr, y = (OY + r[1] * S) / dpr, w = r[2] * S / dpr, hh = r[3] * S / dpr;
    tutSpot.hidden = false; tutSpot.style.left = x + 'px'; tutSpot.style.top = y + 'px'; tutSpot.style.width = w + 'px'; tutSpot.style.height = hh + 'px';
    tutCard.classList.toggle('at-top', y + hh / 2 > wr.height * 0.5);
  }
  function tutTick() {
    if (TU.card) return;
    if (TU.quick) { TU.hold = TU.freeze = false; tutEl.hidden = !G.paused; if (!G.paused) TU.quick = false; return; }
    if (!TU.on) { TU.hold = TU.freeze = false; return; }
    if (G.mode === 'title' || G.mode === 'gameover' || G.mode === 'lifelost' || G.mode === 'levelclear') { tutEnd(G.mode === 'title' ? null : 'done'); return; }
    var s = tutStep(); while (s && !s.info && s.wait && s.wait()) { TU.i++; s = tutStep(); if (s) tutShow(); }
    if (!s) { tutEnd('done'); return; }
    var here = modesOf(s).indexOf(G.mode) >= 0, vis = here && !G.paused;
    tutEl.hidden = !vis; TU.hold = vis && s.info; TU.freeze = here && !s.live;
    if (vis) { var key = 't' + TU.i + '|' + (s.todo ? s.todo() : ''); if (key !== TU.key) tutShow(); else tutPlace(s.hl); }
  }
  function card(key, title, html, hl) { // one-time "new thing" pop-up; pauses play until dismissed
    if (store.get('seen.' + key, false) && !DEBUG_CARDS) return;
    if (TU.on) { G.pendingCard = [key, title, html]; return; }
    store.set('seen.' + key, true); TU.card = { key: key, hl: hl };
    tutEl.querySelector('.tut-step').innerHTML = '<span class="tut-new">NEW</span>Level ' + (G.level === SECRET ? 'secret' : G.level);
    tutEl.querySelector('#tut-title').textContent = title; tutEl.querySelector('.tut-text').innerHTML = html; tutEl.querySelector('.tut-do').hidden = true;
    var nx = tutEl.querySelector('.tut-next'); nx.hidden = false; nx.textContent = 'Got it'; tutEl.querySelector('.tut-back').hidden = true; tutEl.querySelector('.tut-skip').hidden = true;
    tutCard.classList.remove('small', 'act'); tutEl.hidden = false; tutPlace(hl || null); setTimeout(function () { nx.focus(); }, 30);
  }
  var DEBUG_CARDS = false;
  function closeCard() { TU.card = null; tutEl.hidden = true; G.inputLock = performance.now() + 200; canvas.focus(); }
  function newThingCard(n) {
    var c = NEW[n]; if (!c) return; if (n === 1) { if (!tutState && !TU.on) { TU.on = true; TU.i = 0; TU.sunk = TU.rot = TU.placed = 0; tutShow(); } return; }
    var hl = { torpedo: 'weapon', rail: 'weapon', missile: 'weapon', plasma: 'weapon', emp: 'special', overdrive: 'special', shield: 'weapon', gwell: 'home' }[c[0]];
    card('lvl' + n, c[1], c[2], hl);
  }
  function quickGuide() { TU.quick = true; TU.qi = 0; if (ov) ov.hide(); tutShow(); tutEl.hidden = false; }

  /* ---------------- pause, mute, overlay ---------------- */
  var ov = window.ArcadeOverlay ? ArcadeOverlay.mount(wrap) : null, pauseBtn = document.getElementById('btn-pause'), muteBtn = document.getElementById('btn-mute');
  function pauseMenu() { return { primary: { label: '\u25B6 Resume', onClick: function () { togglePause(false); } }, secondary: { label: 'How to Play', onClick: quickGuide } }; }
  function togglePause(p) {
    if (p == null) p = !G.paused; if (!(G.mode === 'arm' || G.mode === 'battle' || G.mode === 'repair' || G.mode === 'between')) p = false;
    G.paused = p; pauseBtn.innerHTML = p ? '&#9654; <span class="lbl">Resume</span>' : '&#10074;&#10074; <span class="lbl">Pause</span>'; I.down = {}; G.fireHeld = false;
    if (ov) { if (p) ov.show(pauseMenu()); else ov.hide(); } if (!p && TU.quick) { TU.quick = false; tutEl.hidden = true; }
  }
  function syncMute() { muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false'); muteBtn.innerHTML = (muted ? '&#128263;' : '&#128266;') + ' <span class="lbl">' + (muted ? 'Sound off' : 'Sound on') + '</span>'; }
  muteBtn.addEventListener('click', function () { unlockAudio(); setMuted(!muted); canvas.focus(); });
  pauseBtn.addEventListener('click', function () { unlockAudio(); togglePause(); canvas.focus(); });
  document.getElementById('btn-full').addEventListener('click', function () { var d = document; if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) togglePause(true); });
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 250); }); window.addEventListener('jsp-banner-ready', resize);
  syncMute();

  /* ---------------- main loop ---------------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var splash = window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen();
    var hold = G.paused || splash || TU.card || (TU.on && TU.hold) || TU.quick;
    if (!hold) { var n = dt > 0.025 ? 2 : 1; for (var i = 0; i < n; i++) update(dt / n); } else if (TU.on) tutTick();
    howBtn.hidden = !(G.mode === 'title' && !splash); startBtn.hidden = howBtn.hidden || (tutState === 'active'); if (!startBtn.hidden) { var st = isTouch ? '&#9654; TAP TO START' : '&#9654; START <small>Space / Enter</small>'; if (startBtn.dataset.t !== st) { startBtn.dataset.t = st; startBtn.innerHTML = st; } } if (!howBtn.hidden) howBtn.innerHTML = tutState === 'done' ? '&#10003; Replay How to Play' : '&#10067; How to Play';
    syncButtons(); render();
    requestAnimationFrame(frame);
  }
  G.world = worldFor(1); resize(); toTitle(); requestAnimationFrame(frame);

  window.RSEGame = { version: 1, levels: LAST, secret: SECRET, names: NAMES };
  if (DEBUG) window.RSEGame.debug = {
    G: G, start: function (n) { tutState = 'skipped'; startGame(n || 1); }, cards: function (on) { DEBUG_CARDS = !!on; },
    skipPhase: function () { G.timer = 0.01; }, clearRound: function () { G.spawnQ = []; G.foes.forEach(function (f) { if (f.k !== 'pod') f.dead = true; }); if (G.boss) { G.boss.hp = 0; killFoe(G.boss, true); } G.timer = 0.01; },
    seal: function () { var k = G.cores[0]; for (var x = k.c - 3; x <= k.c + 4; x++) for (var y = k.r - 3; y <= k.r + 4; y++) if ((x === k.c - 3 || x === k.c + 4 || y === k.r - 3 || y === k.r + 4) && inG(x, y) && G.grid[idx(x, y)] !== CORE) { G.grid[idx(x, y)] = HULL; G.hp[idx(x, y)] = 1; } computeSecured(); },
    special: function () { G.special = 1; }, spawn: function (k, x, y) { spawn({ k: k, x: x, y: y }); },
    aim: function (x, y) { G.aim.x = x; G.aim.y = y; }, place: function () { return G.mode === 'arm' ? placeTurret() : placePiece(); }, fire: function () { fireAll(); }, press: function () { if (!grabComet()) fireAll(); }, cell: function (c, r) { return { x: cellX(c), y: cellY(r) }; }, useSpecial: useSpecial, sw: doSwitch,
    state: function () { return { mode: G.mode, level: G.level, round: G.round, timer: Math.round(G.timer * 10) / 10, score: G.score, lives: G.lives, foes: G.foes.length, kinds: G.foes.map(function (f) { return f.k; }).join(','), turrets: G.turrets.length, safe: safeCores(), weapons: G.weapons.join(','), weapon: weapon(), special: G.special, shield: G.shield, bh: !!G.bh, card: TU.card && TU.card.key, tut: TU.on ? TU.i : null, muted: muted, moon: G.moon.cracked, escort: G.escort && (G.escort.hostile ? 'hostile' : 'friendly'), ion: G.ion, paused: G.paused, dpr: dpr, CW: CW, CH: CH }; }
  };
})();

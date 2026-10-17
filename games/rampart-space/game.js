/* Rampart: Space Edition - orbital tower defense. Built from scratch 10/2026.
   Defend your world: build and upgrade turrets on orbit platforms while enemy fleets spiral in along orbital lanes.
   12 sectors, bosses on 4, 8 and 12. Photosensitivity-safe: no full-screen or large bright flashes, no hit-blink;
   explosions stay small and local and fade over at least 0.35 s (checked by tests/rampart-space-td/flash-check.js).
   Written by: Howie */
(function () {
  'use strict';
  var W = 1600, H = 900, TAU = Math.PI * 2, ART = window.RSArt, SND = window.RSAudio;
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('rstd.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('rstd.' + k, JSON.stringify(v)); } catch (e) { } }
  };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function rng(seed) { var s = seed >>> 0 || 7; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  function play(n) { if (SND) SND.play(n); }

  // ---------------- turrets ----------------
  var ORDER = ['laser', 'missile', 'rail', 'stasis', 'pylon', 'drone'];
  var TURRETS = {
    laser: { name: 'Pulse Laser', cost: 70, unlock: 1, type: 'energy', blurb: 'Steady beam that ramps up on one target. Strips shields fast; armor blunts it.',
      tiers: [{ dps: 20, range: 150, ramp: 2 }, { dps: 31, range: 160, ramp: 2 }, { dps: 46, range: 172, ramp: 2 }],
      branches: [{ id: 'prism', name: 'Prism', blurb: 'Beam chains to 2 more ships.', dps: 60, range: 180, ramp: 2, chain: 2 },
                 { id: 'lance', name: 'Lance', blurb: 'Ramps to 4x and reaches much farther.', dps: 58, range: 230, ramp: 4 }] },
    missile: { name: 'Missile Pod', cost: 100, unlock: 1, type: 'explosive', blurb: 'Homing missiles that splash. Great on swarms.',
      tiers: [{ dmg: 24, n: 2, rate: 1.7, splash: 56, range: 220 }, { dmg: 34, n: 2, rate: 1.55, splash: 60, range: 232 }, { dmg: 40, n: 3, rate: 1.5, splash: 64, range: 245 }],
      branches: [{ id: 'swarm', name: 'Swarm', blurb: 'Six micro missiles per volley.', dmg: 32, n: 6, rate: 1.45, splash: 50, range: 260 },
                 { id: 'nova', name: 'Nova', blurb: 'One huge warhead that leaves ships burning.', dmg: 170, n: 1, rate: 2.1, splash: 118, burn: 22, range: 260 }] },
    rail: { name: 'Railgun', cost: 120, unlock: 2, type: 'kinetic', blurb: 'Long range. The slug pierces every ship in a line and ignores armor.',
      tiers: [{ dmg: 90, rate: 2.2, range: 290 }, { dmg: 140, rate: 2.0, range: 305 }, { dmg: 205, rate: 1.85, range: 320 }],
      branches: [{ id: 'gauss', name: 'Gauss', blurb: 'Double damage, longest range.', dmg: 470, rate: 2.3, range: 370 },
                 { id: 'accel', name: 'Accelerator', blurb: 'Fires twice as fast and shreds armor.', dmg: 190, rate: 0.95, range: 320, shred: 2 }] },
    stasis: { name: 'Stasis Field', cost: 90, unlock: 3, type: 'none', blurb: 'Slows every ship in its field. Lasers love slow targets.',
      tiers: [{ slow: 0.35, range: 120 }, { slow: 0.45, range: 132 }, { slow: 0.55, range: 145 }],
      branches: [{ id: 'entropy', name: 'Entropy', blurb: 'Ships in the field take 25% more damage.', slow: 0.55, range: 155, amp: 0.25 },
                 { id: 'chrono', name: 'Chrono Snare', blurb: 'Every 6 seconds, holds ships still for a moment.', slow: 0.5, range: 155, freeze: 1.3, every: 6 }] },
    pylon: { name: 'Aegis Pylon', cost: 110, unlock: 4, type: 'none', blurb: 'Reveals stealth ships, boosts nearby turrets, shields them from disruption.',
      tiers: [{ buff: 0.15, range: 175 }, { buff: 0.2, range: 195 }, { buff: 0.25, range: 215 }],
      branches: [{ id: 'overclock', name: 'Overclock', blurb: 'Nearby turrets also fire 30% faster.', buff: 0.25, range: 220, haste: 0.3 },
                 { id: 'watch', name: 'Watchtower', blurb: 'Huge reveal radius; marked ships take 15% more damage.', buff: 0.25, range: 330, mark: 0.15 }] },
    drone: { name: 'Drone Bay', cost: 140, unlock: 6, type: 'energy', blurb: 'Launches drones that hunt anything inside the leash, fighters included.',
      tiers: [{ n: 2, dmg: 9, rate: 0.45, range: 240 }, { n: 2, dmg: 14, rate: 0.42, range: 255 }, { n: 3, dmg: 17, rate: 0.4, range: 270 }],
      branches: [{ id: 'hunter', name: 'Hunter', blurb: 'Four fast drones.', n: 4, dmg: 21, rate: 0.32, range: 290, fast: 1.5 },
                 { id: 'flak', name: 'Flak', blurb: 'Drone shots burst and splash. Shreds swarms.', n: 3, dmg: 24, rate: 0.42, range: 280, splash: 46 }] }
  };
  function upCost(k, tier) { var b = TURRETS[k].cost; return Math.round(b * (tier === 1 ? 0.75 : tier === 2 ? 1.1 : 1.7)); }
  function stats(t) { var D = TURRETS[t.k]; return t.tier < 4 ? D.tiers[t.tier - 1] : D.branches[t.br]; }

  // ---------------- enemies ----------------
  var FOES = {
    scout: { name: 'Scout', hp: 34, spd: 78, armor: 0, bounty: 4, dmg: 1, r: 12, cost: 1 },
    swarmer: { name: 'Swarmer', hp: 13, spd: 96, armor: 0, bounty: 1, dmg: 1, r: 8, cost: 0.5, tip: 'Swarmers come in packs. Missile Pods and splash damage clear them.' },
    fighter: { name: 'Fighter', hp: 20, spd: 110, armor: 0, bounty: 1, dmg: 1, r: 8, cost: 0.5 },
    frigate: { name: 'Armored Frigate', hp: 120, spd: 46, armor: 5, bounty: 9, dmg: 2, r: 20, cost: 3, tip: 'Thick armor blunts every hit. Lasers struggle; missiles and Railguns punch through.' },
    cruiser: { name: 'Shielded Cruiser', hp: 150, shield: 130, spd: 40, armor: 2, bounty: 15, dmg: 3, r: 25, cost: 4.5, tip: 'A blue shield soaks damage and recharges if left alone. Energy weapons (lasers) strip shields fastest.' },
    gunship: { name: 'Gunship', hp: 130, spd: 42, armor: 3, bounty: 14, dmg: 2, r: 20, cost: 4, gun: { range: 175, every: 5, dur: 3 }, tip: 'Gunships fire disruptor bolts that knock turrets offline for a few seconds. Kill them early.' },
    phantom: { name: 'Phantom', hp: 70, spd: 64, armor: 0, bounty: 12, dmg: 2, r: 16, cost: 3, stealth: true, tip: 'Phantoms are cloaked. Turrets cannot target them unless an Aegis Pylon reveals them. Splash and strikes still hurt them, a hit shows them briefly, and their cloak drops for a moment every few seconds.' },
    carrier: { name: 'Carrier', hp: 560, spd: 27, armor: 4, bounty: 34, dmg: 5, r: 44, cost: 10, spawn: { kind: 'fighter', n: 3, every: 5.5 }, tip: 'Carriers launch fighter squadrons as they fly. Drone Bays and missiles handle the fighters.' },
    mender: { name: 'Mender', hp: 100, spd: 50, armor: 1, bounty: 13, dmg: 1, r: 16, cost: 3.5, heal: { r: 120, hps: 16 }, tip: 'Menders repair hulls and recharge shields around them. Target them first.' },
    dread: { name: 'Dreadnought', hp: 2000, shield: 700, spd: 13, armor: 6, bounty: 300, dmg: 20, r: 70, boss: 1, cost: 0, gun: { range: 240, every: 4, dur: 3.5 }, tip: 'BOSS: the Dreadnought. Heavy shield, heavy armor, and its guns disable turrets. Lasers for the shield, then Railguns.' },
    hive: { name: 'Hive Mother', hp: 5800, spd: 16, armor: 5, bounty: 400, dmg: 20, r: 62, boss: 1, cost: 0, spawn: { kind: 'swarmer', n: 6, every: 4 }, enrage: true, tip: 'BOSS: the Hive Mother births swarms the whole way in and speeds up when hurt. Splash keeps the swarms off you.' },
    eclipse: { name: 'The Eclipse', hp: 10500, shield: 3600, spd: 13, armor: 8, bounty: 600, dmg: 20, r: 85, boss: 1, cost: 0, spawn: { kind: 'fighter', n: 4, every: 5 }, gun: { range: 260, every: 3.4, dur: 4 }, cloak: { every: 15, dur: 4 }, tip: 'FINAL BOSS: The Eclipse. It cloaks, launches fighters and disrupts turrets. Pylons keep it in sight.' }
  };

  // ---------------- sectors ----------------
  var THEMES = [{ a: [40, 60, 150], b: [120, 50, 160], c: [80, 90, 200], tilt: 0.25, gx: 0.8, gy: 0.2 },
                { a: [150, 60, 30], b: [180, 120, 50], c: [120, 40, 30], tilt: -0.3, gx: 0.15, gy: 0.75 },
                { a: [20, 110, 110], b: [120, 40, 110], c: [40, 140, 120], tilt: 0.35, gx: 0.7, gy: 0.8 },
                { a: [60, 40, 120], b: [30, 110, 150], c: [140, 80, 170], tilt: -0.2, gx: 0.3, gy: 0.15 }];
  var P = Math.PI;
  var LEVELS = [
    { name: 'Terra Nova', planet: 'terran', atm: [110, 170, 255], theme: 0, x: 820, y: 470, r: 92, lanes: [[P * 1.02, 5.3]], cr: 260 },
    { name: 'Kepler Dunes', planet: 'desert', atm: [255, 190, 130], theme: 1, x: 800, y: 470, r: 87, lanes: [[P * 0.97, 3.9], [-0.15, 3.9]], cr: 300 },
    { name: 'Boreas', planet: 'ice', atm: [180, 220, 255], theme: 2, x: 800, y: 460, r: 90, lanes: [[P * 1.25, -3.6], [0.25, -4.0]], cr: 330 },
    { name: 'Vulcan Gate', planet: 'lava', atm: [255, 120, 70], theme: 1, x: 800, y: 470, r: 94, lanes: [[P, 3.4], [0, 3.4]], cr: 420, boss: 'dread' },
    { name: 'Thalassa', planet: 'ocean', atm: [100, 180, 255], theme: 0, x: 780, y: 460, r: 94, lanes: [[3.9, 4.2], [-0.65, -4.2]], cr: 470 },
    { name: 'Jove Station', planet: 'gas', atm: [255, 220, 170], theme: 3, x: 800, y: 470, r: 109, lanes: [[P * 0.92, 4.0], [-0.1, -4.0]], cr: 580 },
    { name: 'Miasma', planet: 'toxic', atm: [210, 230, 120], theme: 2, x: 820, y: 460, r: 92, lanes: [[2.6, -4.3], [-0.4, 4.5]], cr: 600 },
    { name: 'Hive Reach', planet: 'violet', atm: [200, 140, 255], theme: 3, x: 800, y: 470, r: 97, lanes: [[P * 1.1, 4.0], [0.1, -4.0]], cr: 660, boss: 'hive' },
    { name: 'Cryon Rings', planet: 'teal', atm: [140, 240, 230], theme: 2, x: 800, y: 460, r: 104, lanes: [[3.3, 4.0], [-1.0, -3.8], [1.15, 4.0]], cr: 700, rings: true },
    { name: 'Ember Prime', planet: 'red', atm: [255, 150, 110], theme: 1, x: 800, y: 470, r: 94, lanes: [[2.9, 5.2], [-0.25, 5.2]], cr: 760 },
    { name: 'Aurora', planet: 'terran', atm: [120, 255, 200], theme: 0, x: 790, y: 460, r: 94, lanes: [[3.6, -4.0], [0.3, -4.0], [-1.57, 4.0]], cr: 820, seed: 99 },
    { name: 'Eclipse Point', planet: 'dark', atm: [255, 170, 110], theme: 3, x: 800, y: 470, r: 99, lanes: [[P, 3.9], [-0.9, 3.9], [1.0, -4.1]], cr: 900, boss: 'eclipse' }
  ];
  var NWAVES = [6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12];
  // HUD-reserved world zones (no platforms there)
  var RESERVED = [[0, 0, 360, 128], [0, 770, 300, 900], [1250, 780, 1600, 900], [1380, 0, 1600, 90]];

  function buildLane(L, a0, sw) {
    var pts = [], R0 = 1050, Rp = L.r + 18, ry = 0.56, n = 900, started = false;
    for (var i = 0; i <= n; i++) {
      var t = i / n, r = lerp(R0, Rp, Math.pow(t, 0.8)), th = a0 + sw * t, x = L.x + Math.cos(th) * r, y = L.y + Math.sin(th) * r * ry;
      var inside = x > -40 && x < W + 40 && y > -40 && y < H + 40;
      if (!started) { if (inside) started = true; else continue; }
      pts.push(x, y);
    }
    var cum = [0], len = 0;
    for (var j = 2; j < pts.length; j += 2) { len += Math.hypot(pts[j] - pts[j - 2], pts[j + 1] - pts[j - 1]); cum.push(len); }
    return { pts: pts, cum: cum, len: len };
  }
  function lanePos(ln, d, out) {
    var c = ln.cum, lo = 0, hi = c.length - 1; d = clamp(d, 0, ln.len);
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
    var f = (d - c[lo]) / Math.max(1e-6, c[hi] - c[lo]), x0 = ln.pts[lo * 2], y0 = ln.pts[lo * 2 + 1], x1 = ln.pts[hi * 2], y1 = ln.pts[hi * 2 + 1];
    out.x = lerp(x0, x1, f); out.y = lerp(y0, y1, f); out.a = Math.atan2(y1 - y0, x1 - x0); return out;
  }
  function buildSlots(L, lanes, lvl) {
    var samples = [];
    lanes.forEach(function (ln) { for (var d = 0; d < ln.len; d += 12) { var p = lanePos(ln, d, {}); samples.push(p.x, p.y); } });
    var cands = [];
    for (var y = 95; y <= 845; y += 22) for (var x = 70; x <= 1530; x += 22) {
      var bad = false; RESERVED.forEach(function (z) { if (x > z[0] - 20 && x < z[2] + 20 && y > z[1] - 20 && y < z[3] + 20) bad = true; }); if (bad) continue;
      if (dist2(x, y, L.x, L.y) < Math.pow(L.r + 70, 2)) continue;
      var md = 1e9, cov = 0;
      for (var i = 0; i < samples.length; i += 2) { var dd = dist2(x, y, samples[i], samples[i + 1]); if (dd < md) md = dd; if (dd < 175 * 175) cov++; }
      md = Math.sqrt(md); if (md < 50 || md > 92) continue;
      cands.push({ x: x, y: y, cov: cov });
    }
    var want = Math.min(18, 13 + Math.floor(lvl / 2)), out = [];
    while (out.length < want && cands.length) {
      var best = -1, bs = -1;
      for (var c = 0; c < cands.length; c++) { var k = cands[c]; if (k.cov > bs) { bs = k.cov; best = c; } }
      var pick = cands[best]; out.push({ x: pick.x, y: pick.y, t: null });
      cands = cands.filter(function (k) { return dist2(k.x, k.y, pick.x, pick.y) > 100 * 100; });
      cands.forEach(function (k) { var dd = Math.sqrt(dist2(k.x, k.y, pick.x, pick.y)); if (dd < 260) k.cov *= 0.55 + 0.45 * (dd - 100) / 160; });
    }
    return out;
  }

  // ---------------- waves ----------------
  function poolFor(L) {
    var p = [['scout', 3], ['swarmer', L >= 1 ? 2 : 0], ['frigate', L >= 2 ? 2 : 0.8]];
    if (L >= 3) p.push(['cruiser', 2]); if (L >= 4) p.push(['gunship', 1.6]); if (L >= 5) p.push(['phantom', 2.2]);
    if (L >= 6) p.push(['carrier', 1.1]); if (L >= 7) p.push(['mender', 1.4]);
    return p;
  }
  var NEWEST = { 1: 'scout', 2: 'frigate', 3: 'cruiser', 4: 'gunship', 5: 'phantom', 6: 'carrier', 7: 'mender' };
  var INTERVAL = { scout: 1.0, swarmer: 0.28, frigate: 1.6, cruiser: 2.0, gunship: 2.0, phantom: 1.4, carrier: 6, mender: 2.4 };
  function buildWaves(lvl, nLanes) {
    var R = rng(lvl * 7919 + 13), nW = NWAVES[lvl - 1], waves = [], pool = poolFor(lvl), L = LEVELS[lvl - 1];
    for (var w = 1; w <= nW; w++) {
      var budget = (8 + 4.6 * w) * (1 + 0.09 * (lvl - 1)), groups = [], nG = 1 + (w > 2 ? 1 : 0) + (w > 6 ? 1 : 0);
      if (L.boss && w === nW) { groups.push({ k: L.boss, n: 1, iv: 1, lane: 0, at: 6 }); budget *= 0.6; }
      if (w === 1) {
        groups.push({ k: 'scout', n: Math.round(4 + lvl * 0.8), iv: 1.0, lane: 0, at: 0 });
        if (nLanes > 1) groups.push({ k: 'scout', n: Math.round(3 + lvl * 0.6), iv: 1.0, lane: 1, at: 3 });
        if (lvl >= 3) groups.push({ k: 'swarmer', n: 8 + lvl, iv: 0.28, lane: nLanes - 1, at: 6 });
        waves.push(groups); continue;
      }
      for (var g = 0; g < nG; g++) {
        var k;
        if (lvl === 1) k = w < 3 ? 'scout' : (g === 1 ? 'swarmer' : (w >= 5 && g === 0 ? 'frigate' : 'scout'));
        else if (g === 0 && w % 2 === 0 && NEWEST[lvl]) k = NEWEST[lvl];
        else { var tot = 0; pool.forEach(function (q) { tot += q[1]; }); var r = R() * tot; for (var q = 0; q < pool.length; q++) { r -= pool[q][1]; if (r <= 0) { k = pool[q][0]; break; } } k = k || 'scout'; }
        if (k === 'carrier' && w < 3) k = 'frigate';
        var gb = budget / nG, n = Math.max(1, Math.round(gb / FOES[k].cost));
        if (k === 'swarmer') n = clamp(n, 6, 40); if (k === 'carrier') n = Math.min(n, 1 + Math.floor(w / 4));
        if (k === NEWEST[lvl] && k !== 'scout') n = Math.min(n, 1 + Math.ceil(w / 2));
        groups.push({ k: k, n: n, iv: INTERVAL[k], lane: (g + w) % nLanes, at: g * 5 });
      }
      waves.push(groups);
    }
    return waves;
  }
  function hpMul(lvl, w) { return (1 + 0.12 * (lvl - 1)) * (1 + 0.04 * (w - 1)); }
  function bountyMul(lvl) { return 1 + 0.08 * (lvl - 1); }

  // ---------------- state ----------------
  var G = { mode: 'title', lvl: 1, L: null, lanes: [], slots: [], turrets: [], foes: [], shots: [], eshots: [], parts: [], strikes: [], beams: [], spawnQ: [],
    credits: 0, integ: 20, score: 0, wave: 0, nW: 0, waves: [], phase: 'build', countdown: -1, speed: 1, time: 0, rt: 0, sel: null, armed: null,
    ab: { strike: 0, dilate: 0 }, dil: 0, paused: false, banner: null, endT: 0, planet: null, stats: { kills: 0, leaks: 0 }, leakFx: [], runStart: 1, seenFoes: {} };
  var planets = {}, backdrops = {};
  var tipsOn = store.get('tipsOn', true), seenTips = store.get('tips', {});
  var tipQ = [], tipOpen = null;

  function startLevel(lvl, keepScore) {
    var L = LEVELS[lvl - 1];
    G.lvl = lvl; G.L = L; G.mode = 'play'; G.paused = false;
    G.lanes = L.lanes.map(function (q) { return buildLane(L, q[0], q[1]); });
    G.slots = buildSlots(L, G.lanes, lvl);
    G.turrets = []; G.foes = []; G.shots = []; G.eshots = []; G.parts = []; G.strikes = []; G.spawnQ = []; G.leakFx = [];
    G.waves = buildWaves(lvl, G.lanes.length); G.nW = G.waves.length; G.wave = 0; G.phase = 'build'; G.countdown = -1;
    G.credits = L.cr; G.integ = 20; G.time = 0; G.sel = null; G.armed = null; G.ab = { strike: 0, dilate: 0 }; G.dil = 0; G.endT = 0;
    G.stats = { kills: 0, leaks: 0 }; G.levelScore0 = keepScore ? G.score : 0; if (!keepScore) { G.score = 0; G.runStart = lvl; }
    var pk = L.planet + (L.seed || lvl);
    if (!planets[pk]) planets[pk] = ART.Planet(L.planet, 1000 + lvl * 31 + (L.seed || 0), { atm: L.atm, spin: L.planet === 'gas' || L.planet === 'teal' ? 0.05 : 0.03 });
    G.planet = planets[pk];
    G.moon = planets['moon' + (lvl % 3)] || (planets['moon' + (lvl % 3)] = ART.Planet(['ice', 'red', 'desert'][lvl % 3], 500 + lvl % 3, { atm: [200, 200, 220], spin: 0.02, tilt: 0.1 }));
    G.banner = { t: 0, title: 'SECTOR ' + lvl + ' \u00b7 ' + L.name.toUpperCase(), sub: L.boss ? 'Boss sector: ' + FOES[L.boss].name : NWAVES[lvl - 1] + ' waves' };
    if (SND) SND.setMood('calm');
    hideScreens();
    queueTip('welcome'); queueTip('build');
    ORDER.forEach(function (k) { if (TURRETS[k].unlock === lvl && lvl > 1) queueTip('t_' + k); });
    if (lvl === 3) queueTip('dilate');
    syncHud();
  }
  function unlocked(k) { return TURRETS[k].unlock <= G.lvl; }
  function launchWave() {
    if (G.mode !== 'play' || G.phase !== 'build' || G.wave >= G.nW) return;
    if (G.countdown > 0) { var bonus = Math.ceil(G.countdown) * 2; G.credits += bonus; G.score += bonus * 10; floatText(W - 200, H - 150, '+' + bonus + ' early', '255,220,120'); }
    G.wave++; G.phase = 'wave'; G.countdown = -1;
    var gs = G.waves[G.wave - 1], hm = hpMul(G.lvl, G.wave);
    gs.forEach(function (g) { for (var i = 0; i < g.n; i++) G.spawnQ.push({ k: g.k, at: G.time + 1 + g.at + i * g.iv, lane: g.lane, hm: hm }); });
    G.spawnQ.sort(function (a, b) { return a.at - b.at; });
    var boss = gs.some(function (g) { return FOES[g.k].boss; });
    if (SND) SND.setMood(boss ? 'boss' : 'battle', Math.min(1, 0.5 + G.wave / G.nW * 0.5));
    play('wave'); if (G.wave === 1) queueTip('strike');
    if (boss) play('alarm');
  }
  function spawnFoe(k, laneI, d, hm, from) {
    var D = FOES[k], ln = G.lanes[laneI % G.lanes.length]; if (D.boss) hm = hpMul(G.lvl, 1);
    var f = { k: k, D: D, lane: ln, laneI: laneI, d: d || 0, x: 0, y: 0, a: 0, r: D.r,
      hp: D.hp * hm, max: D.hp * hm, shield: (D.shield || 0) * hm, smax: (D.shield || 0) * hm, armor: D.armor, spd: D.spd * (0.95 + Math.random() * 0.1),
      slow: 0, frozen: 0, amp: 0, mark: 0, revealed: false, shT: 0, ripple: 0, spT: D.spawn ? D.spawn.every * 0.6 : 0, gunT: D.gun ? D.gun.every * 0.5 : 0,
      burn: 0, burnT: 0, dead: false, boss: !!D.boss, cloaked: false, wob: Math.random() * TAU, off: (Math.random() - 0.5) * (D.r > 30 ? 6 : 22) };
    lanePos(ln, f.d, f); G.foes.push(f);
    if (!G.seenFoes[k]) { G.seenFoes[k] = 1; if (D.tip) queueTip('f_' + k); }
    return f;
  }
  function stealthNow(f) { return (f.D.stealth && !f.flick) || f.cloaked; }
  function targetable(f) { return !f.dead && (!stealthNow(f) || f.revealed || f.litT > 0); }
  function hurt(f, dmg, type, frac) {
    if (f.dead) return;
    if (type !== 'burn') f.litT = 1.5;
    dmg *= 1 + f.amp + f.mark;
    if (f.shield > 0 && type !== 'burn') {
      var m = type === 'energy' ? 1.6 : type === 'kinetic' ? 0.45 : 1, sd = dmg * m; f.shT = 3; f.ripple = Math.min(1, f.ripple + 0.25);
      if (sd <= f.shield) { f.shield -= sd; return; }
      dmg = (sd - f.shield) / m; f.shield = 0;
    }
    if (type !== 'kinetic') dmg = Math.max(dmg * 0.25, dmg - f.armor * (frac == null ? 1 : frac));
    f.hp -= dmg;
    if (f.hp <= 0) kill(f);
  }
  function kill(f) {
    var bty = Math.round(f.D.bounty * bountyMul(G.lvl) * 10) / 10; f.dead = true; G.credits += bty; G.score += Math.round(bty * 10); G.stats.kills++;
    boom(f.x, f.y, f.r, f.boss);
    if (f.boss) { G.bossDeath = { x: f.x, y: f.y, t: 0, r: f.r }; play('bigboom'); } else play(f.r > 20 ? 'boom' : 'pop');
    if (f.D.bounty >= 9) floatText(f.x, f.y - f.r, '+' + f.D.bounty, '255,214,110');
  }
  function splash(x, y, R, dmg, type, burn) {
    var R2 = R * R;
    for (var i = 0; i < G.foes.length; i++) { var f = G.foes[i]; if (f.dead) continue; var d2 = dist2(x, y, f.x, f.y), rr = R + f.r * 0.6; if (d2 < rr * rr) { hurt(f, dmg * (1 - 0.4 * Math.sqrt(d2) / rr), type); if (burn) { f.burn = burn; f.burnT = 3; } } }
  }
  function leak(f) {
    f.dead = true; G.integ = Math.max(0, G.integ - f.D.dmg); G.stats.leaks++; G.stats.lk = G.stats.lk || {}; G.stats.lk[f.k] = (G.stats.lk[f.k] || 0) + f.D.dmg; if (f.boss) G.stats.bossLeft = Math.round(f.hp / f.max * 100) + '%';
    G.leakFx.push({ a: Math.atan2(f.y - G.L.y, f.x - G.L.x), t: 0 }); play('leak');
    if (G.integ <= 0) lose();
  }
  function fields() {
    var fs = G.foes, ts = G.turrets, i, j;
    for (i = 0; i < fs.length; i++) { var f = fs[i]; f.slow = 0; f.amp = 0; f.mark = 0; f.revealed = false; }
    for (j = 0; j < ts.length; j++) { ts[j].buff = 0; ts[j].haste = 0; ts[j].prot = false; }
    for (j = 0; j < ts.length; j++) {
      var t = ts[j]; if (t.off > 0) continue; var s = stats(t), R2 = s.range * s.range;
      if (t.k === 'stasis') for (i = 0; i < fs.length; i++) { f = fs[i]; if (dist2(t.x, t.y, f.x, f.y) < R2) { f.slow = Math.max(f.slow, s.slow * (f.boss ? 0.5 : 1)); if (s.amp) f.amp = Math.max(f.amp, s.amp); } }
      if (t.k === 'pylon') {
        for (i = 0; i < fs.length; i++) { f = fs[i]; if (dist2(t.x, t.y, f.x, f.y) < R2) { f.revealed = true; if (s.mark) f.mark = Math.max(f.mark, s.mark); } }
        for (i = 0; i < ts.length; i++) { var u = ts[i]; if (u !== t && dist2(t.x, t.y, u.x, u.y) < R2) { u.buff = Math.max(u.buff, s.buff); u.prot = true; if (s.haste) u.haste = Math.max(u.haste, s.haste); } }
        t.prot = true;
      }
    }
  }
  function findTarget(t, R, mode, exclude) {
    var best = null, bv = -1e9, R2 = R * R;
    for (var i = 0; i < G.foes.length; i++) {
      var f = G.foes[i]; if (!targetable(f) || f === exclude) continue; var d2 = dist2(t.x, t.y, f.x, f.y); if (d2 > R2) continue;
      var v = mode === 'strong' ? f.hp + f.shield : mode === 'close' ? -d2 : f.d / f.lane.len * 1000 + (f.boss ? 0.1 : 0);
      if (v > bv) { bv = v; best = f; }
    }
    return best;
  }
  function updTurret(t, dt) {
    t.kick = Math.max(0, t.kick - dt * 4);
    if (t.off > 0) { t.off -= dt; if (Math.random() < dt * 6) G.parts.push({ x: t.x + (Math.random() - 0.5) * 30, y: t.y + (Math.random() - 0.5) * 30, vx: 0, vy: -20, life: 0.6, max: 0.6, s: 3, c: '140,200,255', k: 'spark' }); return; }
    var s = stats(t), bm = 1 + t.buff, rate = 1 / (1 + t.haste);
    if (t.k === 'laser') {
      var f = t.tgt && targetable(t.tgt) && dist2(t.x, t.y, t.tgt.x, t.tgt.y) < s.range * s.range ? t.tgt : findTarget(t, s.range, t.mode);
      if (f !== t.tgt) { t.tgt = f; t.ramp = 1; }
      if (!f) return;
      t.ramp = Math.min(s.ramp, t.ramp + dt * (s.ramp - 1) / 2.2); t.ang = Math.atan2(f.y - t.y, f.x - t.x);
      var dmg = s.dps * t.ramp * bm * dt; hurt(f, dmg, 'energy', dt * 4);
      var beam = { x: t.x + Math.cos(t.ang) * 22, y: t.y + Math.sin(t.ang) * 22, tx: f.x, ty: f.y, w: t.ramp / s.ramp, chain: [] };
      if (s.chain) { var prev = f, hit = [f]; for (var c = 0; c < s.chain; c++) { var nx = null, nd = 140 * 140; for (var i = 0; i < G.foes.length; i++) { var g = G.foes[i]; if (!targetable(g) || hit.indexOf(g) >= 0) continue; var d2 = dist2(prev.x, prev.y, g.x, g.y); if (d2 < nd) { nd = d2; nx = g; } } if (!nx) break; hurt(nx, dmg * 0.6, 'energy', dt * 4); beam.chain.push([prev.x, prev.y, nx.x, nx.y]); hit.push(nx); prev = nx; } }
      G.beams.push(beam); return;
    }
    if (t.k === 'stasis') { if (s.freeze) { t.cd -= dt; if (t.cd <= 0) { t.cd = s.every; var any = false; G.foes.forEach(function (f) { if (dist2(t.x, t.y, f.x, f.y) < s.range * s.range) { f.frozen = f.boss ? 0.4 : s.freeze; any = true; } }); if (any) G.parts.push({ x: t.x, y: t.y, life: 0.9, max: 0.9, s: s.range, c: '150,200,255', k: 'ring' }); } } return; }
    if (t.k === 'pylon') return;
    if (t.k === 'drone') { updDrones(t, s, dt, bm); return; }
    t.cd -= dt;
    var tg = findTarget(t, s.range, t.mode);
    if (tg) { var want = Math.atan2(tg.y - t.y, tg.x - t.x), da = ((want - t.ang + Math.PI * 3) % TAU) - Math.PI; t.ang += clamp(da, -dt * 6, dt * 6); }
    if (t.cd > 0 || !tg) return;
    t.cd = s.rate * rate; t.kick = 1;
    if (t.k === 'rail') {
      var ax = Math.cos(t.ang = Math.atan2(tg.y - t.y, tg.x - t.x)), ay = Math.sin(t.ang), Lr = s.range * 1.2, x0 = t.x + ax * 26, y0 = t.y + ay * 26;
      for (var k = 0; k < G.foes.length; k++) { var e = G.foes[k]; if (e.dead) continue; var px = e.x - x0, py = e.y - y0, along = px * ax + py * ay; if (along < 0 || along > Lr) continue; var perp = Math.abs(px * ay - py * ax); if (perp < e.r + 6) { hurt(e, s.dmg * bm, 'kinetic'); if (s.shred) e.armor = Math.max(0, e.armor - s.shred); } }
      G.shots.push({ k: 'trail', x: x0, y: y0, x2: x0 + ax * Lr, y2: y0 + ay * Lr, life: 0.45, max: 0.45 }); play('rail');
    } else if (t.k === 'missile') {
      for (var m = 0; m < s.n; m++) { var sa = t.ang + (m - (s.n - 1) / 2) * 0.35; G.shots.push({ k: 'missile', x: t.x, y: t.y, vx: Math.cos(sa) * 160, vy: Math.sin(sa) * 160, tgt: tg, dmg: s.dmg * bm, sp: s.splash, burn: s.burn || 0, life: 3.2, delay: m * 0.06, big: s.n === 1 }); }
      play('missile');
    }
  }
  function updDrones(t, s, dt, bm) {
    while (t.drones.length < s.n) t.drones.push({ x: t.x, y: t.y, a: Math.random() * TAU, cd: Math.random() * s.rate, ph: Math.random() * TAU, tgt: null });
    t.drones.length = s.n;
    var spd = 230 * (s.fast || 1);
    t.drones.forEach(function (d, i) {
      if (!d.tgt || !targetable(d.tgt) || dist2(t.x, t.y, d.tgt.x, d.tgt.y) > s.range * s.range) d.tgt = findTarget(t, s.range, i % 2 ? 'close' : t.mode);
      d.ph += dt * 2.4; var gx, gy;
      if (d.tgt) { gx = d.tgt.x + Math.cos(d.ph + i * 2) * (d.tgt.r + 34); gy = d.tgt.y + Math.sin(d.ph + i * 2) * (d.tgt.r + 34); }
      else { gx = t.x + Math.cos(d.ph + i * TAU / s.n) * 46; gy = t.y + Math.sin(d.ph + i * TAU / s.n) * 46; }
      var dx = gx - d.x, dy = gy - d.y, dd = Math.hypot(dx, dy) || 1, mv = Math.min(dd, spd * dt); d.x += dx / dd * mv; d.y += dy / dd * mv;
      d.a = d.tgt ? Math.atan2(d.tgt.y - d.y, d.tgt.x - d.x) : Math.atan2(dy, dx);
      d.cd -= dt * (1 + t.haste);
      if (d.tgt && d.cd <= 0 && dist2(d.x, d.y, d.tgt.x, d.tgt.y) < 120 * 120) {
        d.cd = s.rate; if (s.splash) splash(d.tgt.x, d.tgt.y, s.splash, s.dmg * bm, 'energy'); else hurt(d.tgt, s.dmg * bm, 'energy');
        G.shots.push({ k: 'bolt', x: d.x, y: d.y, x2: d.tgt.x, y2: d.tgt.y, life: 0.16, max: 0.16, c: s.splash ? '255,200,140' : '220,170,255' }); play('zap');
        if (s.splash) G.parts.push({ x: d.tgt.x, y: d.tgt.y, life: 0.4, max: 0.4, s: s.splash * 0.6, c: '255,190,120', k: 'glow' });
      }
    });
  }
  function updFoe(f, dt) {
    var D = f.D, sp = f.spd * (1 - f.slow);
    if (G.dil > 0) sp *= f.boss ? 0.7 : 0.45;
    if (D.enrage && f.hp < f.max * 0.5) sp *= 1.5;
    if (f.frozen > 0) { f.frozen -= dt; sp = 0; }
    f.d += sp * dt; lanePos(f.lane, f.d, f);
    var nx = -Math.sin(f.a), ny = Math.cos(f.a); f.x += nx * f.off; f.y += ny * f.off;
    if (f.d >= f.lane.len) { leak(f); return; }
    f.ripple = Math.max(0, f.ripple - dt * 1.6); if (f.litT > 0) f.litT -= dt;
    if (f.smax > 0) { f.shT -= dt; if (f.shT <= 0 && f.shield < f.smax) f.shield = Math.min(f.smax, f.shield + f.smax * (f.boss ? 0.025 : 0.07) * dt); }
    if (f.burnT > 0) { f.burnT -= dt; hurt(f, f.burn * dt, 'burn', dt * 10); if (f.dead) return; }
    if (D.spawn) { f.spT -= dt; if (f.spT <= 0) { f.spT = D.spawn.every; var hm = f.max / D.hp * 0.8; for (var i = 0; i < D.spawn.n; i++) { var c = spawnFoe(D.spawn.kind, f.laneI, Math.max(0, f.d - 10 - i * 14), hm); c.off = (i - (D.spawn.n - 1) / 2) * 12; } } }
    if (D.gun) { f.gunT -= dt; if (f.gunT <= 0) { var tg = null, bd = D.gun.range * D.gun.range; G.turrets.forEach(function (t) { var d2 = dist2(t.x, t.y, f.x, f.y); if (t.off <= 0 && d2 < bd) { bd = d2; tg = t; } }); if (tg) { f.gunT = D.gun.every; G.eshots.push({ x: f.x, y: f.y, t: tg, dur: D.gun.dur }); } else f.gunT = 0.5; } }
    if (D.stealth) f.flick = (G.time + f.wob * 2) % 5 > 4;
    if (D.cloak) { var cyc = (G.time + f.wob * 3) % D.cloak.every; f.cloaked = cyc > D.cloak.every - D.cloak.dur; }
    if (D.heal) { var R2 = D.heal.r * D.heal.r; for (var j = 0; j < G.foes.length; j++) { var o = G.foes[j]; if (o === f || o.dead || dist2(o.x, o.y, f.x, f.y) > R2) continue; o.hp = Math.min(o.max, o.hp + D.heal.hps * dt * (o.max / 100 > 3 ? 3 : 1)); if (o.smax) o.shield = Math.min(o.smax, o.shield + D.heal.hps * dt); } }
  }
  function updShots(dt) {
    var keep = [];
    for (var i = 0; i < G.shots.length; i++) {
      var s = G.shots[i];
      if (s.k === 'missile') {
        if (s.delay > 0) { s.delay -= dt; keep.push(s); continue; }
        if (!s.tgt || s.tgt.dead) s.tgt = findTarget(s, 260, 'close');
        var sp = Math.hypot(s.vx, s.vy), want = s.tgt ? Math.atan2(s.tgt.y - s.y, s.tgt.x - s.x) : Math.atan2(s.vy, s.vx), cur = Math.atan2(s.vy, s.vx), da = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
        cur += clamp(da, -dt * 6, dt * 6); sp = Math.min(520, sp + dt * 600); s.vx = Math.cos(cur) * sp; s.vy = Math.sin(cur) * sp; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        if (Math.random() < 0.7) G.parts.push({ x: s.x, y: s.y, vx: -s.vx * 0.05, vy: -s.vy * 0.05, life: 0.5, max: 0.5, s: s.big ? 6 : 3.5, c: '200,200,210', k: 'smoke' });
        var hitR = s.tgt ? s.tgt.r * 0.8 + 6 : 0;
        if ((s.tgt && dist2(s.x, s.y, s.tgt.x, s.tgt.y) < hitR * hitR) || s.life <= 0 || s.x < -60 || s.x > W + 60 || s.y < -60 || s.y > H + 60) {
          splash(s.x, s.y, s.sp, s.dmg, 'explosive', s.burn); boom(s.x, s.y, s.big ? 26 : 10, false); play('boom'); continue;
        }
        keep.push(s);
      } else { s.life -= dt; if (s.life > 0) keep.push(s); }
    }
    G.shots = keep;
    var ek = [];
    G.eshots.forEach(function (e) {
      if (!e.t || G.turrets.indexOf(e.t) < 0) return;
      var dx = e.t.x - e.x, dy = e.t.y - e.y, d = Math.hypot(dx, dy), mv = 300 * dt;
      if (d <= mv + 20) {
        if (e.t.prot) { e.t.shieldFx = 1; play('shield'); } else { e.t.off = e.dur; e.t.tgt = null; play('disrupt'); queueTip('disrupt'); }
        return;
      }
      e.x += dx / d * mv; e.y += dy / d * mv; ek.push(e);
    });
    G.eshots = ek;
  }
  function boom(x, y, r, big) {
    var n = big ? 60 : Math.min(26, 6 + r);
    G.parts.push({ x: x, y: y, life: big ? 1.6 : 0.55, max: big ? 1.6 : 0.55, s: r * (big ? 2.4 : 2.1), c: '255,170,90', k: 'glow', a: big ? 0.45 : 0.75 });
    G.parts.push({ x: x, y: y, life: big ? 2.2 : 0.9, max: big ? 2.2 : 0.9, s: r * 1.4, c: '120,110,110', k: 'smokeball' });
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = (big ? 160 : 70) * (0.3 + Math.random()); G.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.6, max: 1.1, s: 1.5 + Math.random() * 2, c: Math.random() < 0.5 ? '255,200,120' : '255,140,70', k: 'spark' }); }
    if (r >= 18) for (var j = 0; j < 6; j++) { var b = Math.random() * TAU, w = 40 + Math.random() * 60; G.parts.push({ x: x, y: y, vx: Math.cos(b) * w, vy: Math.sin(b) * w, life: 1.4, max: 1.4, s: 2 + Math.random() * 3, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8, c: '90,96,104', k: 'debris' }); }
  }
  function floatText(x, y, txt, col) { G.parts.push({ x: x, y: y, vx: 0, vy: -26, life: 1.3, max: 1.3, txt: txt, c: col, k: 'text' }); }
  function updParts(dt) {
    var keep = [];
    for (var i = 0; i < G.parts.length; i++) { var p = G.parts[i]; p.life -= dt; if (p.life <= 0) continue; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.4; p.vy *= 1 - dt * 1.4; } if (p.vr) p.rot += p.vr * dt; keep.push(p); }
    if (keep.length > 900) keep = keep.slice(keep.length - 900);
    G.parts = keep;
  }
  function castStrike(x, y) {
    if (G.ab.strike > 0) return false;
    G.ab.strike = 32; G.strikes.push({ x: x, y: y, t: 0.9 }); play('strike'); return true;
  }
  function castDilate() { if (G.ab.dilate > 0 || G.lvl < 3) return false; G.ab.dilate = 48; G.dil = 6; play('dilate'); return true; }
  function step(dt) {
    if (G.mode !== 'play') { if (G.mode === 'won' || G.mode === 'lost') { G.endT += dt; updParts(dt); } return; }
    G.time += dt;
    while (G.spawnQ.length && G.spawnQ[0].at <= G.time) { var q = G.spawnQ.shift(); spawnFoe(q.k, q.lane, 0, q.hm); }
    fields();
    G.beams = [];
    for (var i = 0; i < G.foes.length; i++) if (!G.foes[i].dead) updFoe(G.foes[i], dt);
    if (G.mode !== 'play') return;
    for (var j = 0; j < G.turrets.length; j++) updTurret(G.turrets[j], dt);
    updShots(dt); updParts(dt);
    G.strikes = G.strikes.filter(function (s) { s.t -= dt; if (s.t <= 0) { splash(s.x, s.y, 95, 260 * (1 + 0.12 * (G.lvl - 1)), 'explosive'); boom(s.x, s.y, 34, false); play('boom'); return false; } return true; });
    G.ab.strike = Math.max(0, G.ab.strike - dt); G.ab.dilate = Math.max(0, G.ab.dilate - dt); G.dil = Math.max(0, G.dil - dt);
    G.turrets.forEach(function (t) { t.shieldFx = Math.max(0, (t.shieldFx || 0) - dt * 1.5); });
    G.leakFx = G.leakFx.filter(function (l) { l.t += dt; return l.t < 1.6; });
    if (G.bossDeath) { G.bossDeath.t += dt; if (G.bossDeath.t > 2.5) G.bossDeath = null; }
    G.foes = G.foes.filter(function (f) { return !f.dead; });
    if (G.phase === 'wave' && !G.spawnQ.length && !G.foes.length && G.mode === 'play') waveCleared();
    if (G.phase === 'build' && G.countdown > 0) { G.countdown -= dt; if (G.countdown <= 0) { G.countdown = 0.0001; launchWave(); } }
  }
  function waveCleared() {
    var bonus = 18 + 4 * G.wave; G.credits += bonus; G.score += 50 * G.wave;
    if (G.wave >= G.nW) { levelWon(); return; }
    G.phase = 'build'; G.countdown = 15; floatText(W / 2, H * 0.22, 'WAVE ' + G.wave + ' CLEARED  +' + bonus, '170,230,255');
    if (SND) SND.setMood('calm'); if (G.wave === 1) queueTip('upgrade'); if (G.wave === 2) queueTip('early');
    if (G.L.boss && G.wave === G.nW - 1) { G.banner = { t: 0, title: 'BOSS WAVE NEXT', sub: FOES[G.L.boss].name + ' comes in on the red lane' }; play('alarm'); }
  }
  function starsFor(integ) { return integ >= 18 ? 3 : integ >= 10 ? 2 : 1; }
  function levelWon() {
    G.mode = 'won'; G.endT = 0; G.sel = null; G.armed = null; var st = starsFor(G.integ), bonus = G.integ * 40 + st * 500; G.score += bonus;
    G.result = { stars: st, bonus: bonus, levelScore: G.score - G.levelScore0 };
    var best = store.get('best', {}), b = best[G.lvl] || { stars: 0, score: 0 }; best[G.lvl] = { stars: Math.max(b.stars, st), score: Math.max(b.score, G.result.levelScore) }; store.set('best', best);
    store.set('unlocked', Math.max(store.get('unlocked', 1), Math.min(12, G.lvl + 1)));
    if (SND) { SND.setMood('calm'); play('win'); }
    setTimeout(function () { if (G.mode === 'won') endSplash(G.lvl >= 12 ? 'victory' : 'win'); }, 2600);
  }
  function lose() {
    if (G.mode !== 'play') return; G.mode = 'lost'; G.endT = 0; G.sel = null; G.armed = null; if (SND) { SND.setMood('calm'); play('lose'); }
    setTimeout(function () { if (G.mode === 'lost') endSplash('gameover'); }, 2600);
  }
  function endSplash(kind) {
    var done = function () {
      if (kind === 'win') startLevel(G.lvl + 1, true);
      else askInitials(kind);
    };
    var title = kind === 'win' ? 'SECTOR ' + G.lvl + ' SECURED' : kind === 'victory' ? 'THE ECLIPSE IS DOWN' : 'SECTOR ' + G.lvl + ' HAS FALLEN';
    var sub = (kind === 'win' ? '\u2605'.repeat(G.result.stars) + '\u2606'.repeat(3 - G.result.stars) + '  ' : '') + 'Score ' + G.score.toLocaleString();
    if (window.ScoutSplash && ScoutSplash.show) ScoutSplash.show({ kind: 'defender', campaign: 'rampart-space', tag: kind === 'win' ? 'sector' + G.lvl : kind, title: title, sub: sub, accent: '#9fe6ff', glow: 'rgba(90,170,255,.28)', contLabel: kind === 'win' ? 'Next sector' : 'Continue', onContinue: done });
    else done();
  }

  // ---------------- view ----------------
  var cv = document.getElementById('game'), ctx = cv.getContext('2d'), wrap = document.getElementById('wrap');
  var V = { cw: 800, ch: 450, dpr: 1, s: 0.5, ox: 0, oy: 0, px: 1, u: 1, B: 48 };
  function resize() {
    var r = wrap.getBoundingClientRect(); V.cw = Math.max(200, r.width); V.ch = Math.max(150, r.height); V.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(V.cw * V.dpr); cv.height = Math.round(V.ch * V.dpr);
    V.s = Math.min(V.cw / W, V.ch / H); V.ox = (V.cw - W * V.s) / 2; V.oy = (V.ch - H * V.s) / 2;
    V.px = clamp(Math.round(V.dpr * V.s * 4) / 4, 0.5, 3); V.u = clamp(Math.min(V.cw / 1280, V.ch / 720), 0.5, 1.8); V.B = Math.max(44, Math.round(60 * V.u));
    V.touch = document.body.classList.contains('is-touch');
    // phone landscape: the shared arcade CSS turns the toolbar into an overlay in the top-right corner of the game
    V.tbB = 0; var tb = document.querySelector('header.toolbar');
    if (tb) { var tr = tb.getBoundingClientRect(); if (tr.bottom > r.top + 2 && tr.left > r.left + r.width * 0.3) V.tbB = tr.bottom - r.top; }
  }
  function toWorld(x, y) { return { x: (x - V.ox) / V.s, y: (y - V.oy) / V.s }; }
  function toScreen(x, y) { return { x: V.ox + x * V.s, y: V.oy + y * V.s }; }
  function worldT() { ctx.setTransform(V.dpr * V.s, 0, 0, V.dpr * V.s, V.dpr * V.ox, V.dpr * V.oy); }
  function screenT() { ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function font(px, w) { return (w || 700) + ' ' + Math.round(px) + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; }
  function sprite(sp, x, y, a, scale, alpha) {
    ctx.save(); ctx.translate(x, y); if (a) ctx.rotate(a); if (alpha != null) ctx.globalAlpha = alpha; var sz = sp.size * (scale || 1); ctx.drawImage(sp.c, -sz / 2, -sz / 2, sz, sz); ctx.restore();
  }
  var twinkle = (function () { var R = rng(4242), a = []; for (var i = 0; i < 150; i++) a.push({ x: R(), y: R(), s: 0.6 + R() * 1.4, f: 0.25 + R() * 0.5, p: R() * TAU }); return a; })();
  var comet = null, cometT = 6;
  function backdrop(theme) { if (!backdrops[theme]) backdrops[theme] = ART.Backdrop(77 + theme * 101, THEMES[theme], 1920, 1080); return backdrops[theme]; }
  function drawBack(theme, dt) {
    screenT(); var bd = backdrop(theme), sc = Math.max(V.cw / 1920, V.ch / 1080) * 1.04, bw = 1920 * sc, bh = 1080 * sc, drift = Math.sin(G.rt * 0.02) * 8;
    ctx.fillStyle = '#020309'; ctx.fillRect(0, 0, V.cw, V.ch);
    ctx.drawImage(bd, (V.cw - bw) / 2 + drift, (V.ch - bh) / 2, bw, bh);
    for (var i = 0; i < twinkle.length; i++) { var t = twinkle[i], al = 0.35 + 0.3 * Math.sin(G.rt * t.f * TAU * 0.25 + t.p); ctx.fillStyle = 'rgba(235,242,255,' + al.toFixed(3) + ')'; ctx.fillRect(t.x * V.cw, t.y * V.ch, t.s, t.s); }
    cometT -= dt; if (!comet && cometT <= 0) { var fromL = Math.random() < 0.5; comet = { x: fromL ? -0.1 : 1.1, y: 0.05 + Math.random() * 0.35, vx: (fromL ? 1 : -1) * (0.035 + Math.random() * 0.02), vy: 0.012 + Math.random() * 0.01, life: 40 }; }
    if (comet) {
      comet.x += comet.vx * dt; comet.y += comet.vy * dt; comet.life -= dt;
      var cx = comet.x * V.cw, cy = comet.y * V.ch, ang = Math.atan2(comet.vy * V.ch, comet.vx * V.cw), tl = 160 * V.u;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      var g = ctx.createLinearGradient(-tl, 0, 0, 0); g.addColorStop(0, 'rgba(160,210,255,0)'); g.addColorStop(1, 'rgba(200,230,255,0.45)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -2.5 * V.u); ctx.lineTo(-tl, -10 * V.u); ctx.lineTo(-tl, 10 * V.u); ctx.lineTo(0, 2.5 * V.u); ctx.fill();
      ctx.drawImage(ART.glow('220,240,255'), -8 * V.u, -8 * V.u, 16 * V.u, 16 * V.u); ctx.restore();
      if (comet.x < -0.2 || comet.x > 1.2 || comet.life <= 0) { comet = null; cometT = 18 + Math.random() * 14; }
    }
  }
  function laneCol() { var a = G.L.atm; return a[0] + ',' + a[1] + ',' + a[2]; }
  function drawLanes() {
    var col = laneCol();
    G.lanes.forEach(function (ln, li) {
      var p = ln.pts; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(' + col + ',0.07)'; ctx.lineWidth = 34; ctx.stroke();
      ctx.strokeStyle = 'rgba(' + col + ',0.10)'; ctx.lineWidth = 14; ctx.stroke();
      ctx.strokeStyle = 'rgba(' + col + ',0.38)'; ctx.lineWidth = 1.6; ctx.setLineDash([10, 14]); ctx.lineDashOffset = -G.rt * 30; ctx.stroke(); ctx.setLineDash([]);
      var o = {}; for (var d = (G.rt * 24) % 90; d < ln.len - 30; d += 90) { lanePos(ln, d, o); ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); ctx.strokeStyle = 'rgba(' + col + ',0.32)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(2, 0); ctx.lineTo(-5, 6); ctx.stroke(); ctx.restore(); }
      if (G.L.boss && li === 0 && G.wave >= G.nW - 1 && G.wave < G.nW + 1 && G.mode === 'play') { var bw = 0.35 + 0.25 * Math.sin(G.rt * 2.2); ctx.strokeStyle = 'rgba(255,120,90,' + bw.toFixed(3) + ')'; ctx.lineWidth = 6; ctx.stroke(); lanePos(ln, 60, o); ctx.font = font(18, 800); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,170,140,0.95)'; ctx.fillText(G.wave === G.nW - 1 ? 'BOSS LANE' : '', clamp(o.x, 80, W - 80), clamp(o.y - 26, 30, H - 30)); }
      lanePos(ln, 8, o); var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 46); g.addColorStop(0, 'rgba(' + col + ',0.35)'); g.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, 46, 0, TAU); ctx.fill();
    });
  }
  function drawPlanet() {
    var L = G.L, r = L.r;
    // decorative orbit rings on the tilted plane
    ctx.strokeStyle = 'rgba(' + laneCol() + ',0.07)'; ctx.lineWidth = 1;
    [1.8, 2.7, 3.9, 5.4].forEach(function (k) { ctx.beginPath(); ctx.ellipse(L.x, L.y, r * k, r * k * 0.56, 0, 0, TAU); ctx.stroke(); });
    if (L.rings) ringHalf(L, true);
    G.planet.draw(ctx, L.x, L.y, r, G.rt, V.dpr * V.s);
    if (L.rings) ringHalf(L, false);
    // planetary shield: strength follows integrity; leaks show as slow red ripples
    var k = G.integ / 20, sr = r * 1.42;
    ctx.strokeStyle = 'rgba(140,210,255,' + (0.08 + 0.22 * k).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(L.x, L.y, sr, 0, TAU); ctx.stroke();
    var g = ctx.createRadialGradient(L.x, L.y, sr * 0.8, L.x, L.y, sr); g.addColorStop(0, 'rgba(120,190,255,0)'); g.addColorStop(1, 'rgba(120,190,255,' + (0.03 + 0.07 * k).toFixed(3) + ')'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.x, L.y, sr, 0, TAU); ctx.fill();
    G.leakFx.forEach(function (l) { var a = Math.sin(Math.min(1, l.t / 0.4) * Math.PI / 2) * (1 - l.t / 1.6) * 0.55; ctx.strokeStyle = 'rgba(255,110,90,' + a.toFixed(3) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(L.x, L.y, sr + l.t * 10, l.a - 0.5, l.a + 0.5); ctx.stroke(); });
  }
  function ringHalf(L, back) {
    ctx.save(); ctx.beginPath(); if (back) ctx.rect(L.x - 400, L.y - 300, 800, 300); else ctx.rect(L.x - 400, L.y, 800, 300); ctx.clip();
    for (var i = 0; i < 6; i++) { ctx.strokeStyle = 'rgba(' + [200, 230, 225] + ',' + (0.12 + (i % 2) * 0.1) + ')'; ctx.lineWidth = 6 - i * 0.6; ctx.beginPath(); ctx.ellipse(L.x, L.y, L.r * (1.55 + i * 0.12), L.r * (1.55 + i * 0.12) * 0.32, -0.12, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawSlots() {
    var plat = ART.platform(V.px);
    G.slots.forEach(function (s, i) {
      if (s.t) return;
      sprite(plat, s.x, s.y, 0, 0.82, 0.92);
      var pulse = 0.35 + 0.25 * Math.sin(G.rt * 2 + i);
      ctx.strokeStyle = 'rgba(' + laneCol() + ',' + pulse.toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x, s.y, 13, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(' + laneCol() + ',0.6)'; ctx.font = font(14, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', s.x, s.y + 0.5);
      if (G.hint === i) { ctx.strokeStyle = 'rgba(255,216,106,' + (0.5 + 0.3 * Math.sin(G.rt * 3)).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, TAU); ctx.stroke(); }
    });
  }
  function drawFields() {
    G.turrets.forEach(function (t) {
      var s = stats(t);
      if (t.k === 'stasis') { var g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, s.range); g.addColorStop(0, 'rgba(120,160,255,0.03)'); g.addColorStop(0.85, 'rgba(120,160,255,' + (s.amp ? 0.12 : 0.09) + ')'); g.addColorStop(1, 'rgba(120,160,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x, t.y, s.range, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(150,190,255,0.16)'; ctx.lineWidth = 1; for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(t.x, t.y, s.range * (0.4 + k * 0.22), G.rt * 0.4 + k * 2, G.rt * 0.4 + k * 2 + 1.6); ctx.stroke(); } }
      if (t.k === 'pylon') { ctx.strokeStyle = 'rgba(120,255,200,0.12)'; ctx.setLineDash([4, 8]); ctx.lineDashOffset = G.rt * 8; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(t.x, t.y, s.range, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    });
  }
  function drawTurrets() {
    var plat = ART.platform(V.px);
    G.turrets.forEach(function (t) {
      sprite(plat, t.x, t.y, 0, 0.9);
      var h = ART.head(t.k, Math.min(3, t.tier), V.px), kx = -Math.cos(t.ang) * t.kick * 4, ky = -Math.sin(t.ang) * t.kick * 4;
      sprite(h, t.x + kx, t.y + ky, t.k === 'pylon' || t.k === 'stasis' ? G.rt * 0.5 : t.ang, 1, t.off > 0 ? 0.45 : 1);
      // tier pips
      for (var i = 0; i < t.tier; i++) { ctx.fillStyle = i === 3 ? 'rgba(255,214,110,0.95)' : 'rgba(' + ART.TCOL[t.k] + ',0.9)'; ctx.beginPath(); ctx.arc(t.x - 12 + i * 8, t.y + 24, i === 3 ? 3.2 : 2.4, 0, TAU); ctx.fill(); }
      if (t.off > 0) { ctx.strokeStyle = 'rgba(140,200,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * (t.off / 5)); ctx.stroke(); }
      if (t.shieldFx > 0) { ctx.strokeStyle = 'rgba(120,255,200,' + (t.shieldFx * 0.6).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, 30, 0, TAU); ctx.stroke(); }
      if (t.k === 'drone') { var dsp = ART.drone(V.px); t.drones.forEach(function (d) { ctx.drawImage(ART.glow('210,150,255'), d.x - 8, d.y - 8, 16, 16); sprite(dsp, d.x, d.y, d.a, 1); }); }
    });
  }
  function drawFoes() {
    for (var i = 0; i < G.foes.length; i++) {
      var f = G.foes[i], art = f.k === 'dread' || f.k === 'hive' || f.k === 'eclipse' ? f.k : f.k, sp = ART.ship(art, V.px), hidden = stealthNow(f) && !f.revealed && !(f.litT > 0);
      var al = hidden ? 0.16 + 0.06 * Math.sin(G.rt * 1.5 + f.wob) : 1, rot = f.k === 'eclipse' ? G.rt * 0.15 : f.a;
      if (f.frozen > 0) { ctx.fillStyle = 'rgba(160,210,255,0.18)'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.2, 0, TAU); ctx.fill(); }
      sprite(sp, f.x, f.y, rot, 1.22, al);
      if (stealthNow(f) && !hidden) { ctx.strokeStyle = 'rgba(190,120,255,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
      if (f.smax > 0 && f.shield > 0) { var k = f.shield / f.smax; ctx.strokeStyle = 'rgba(110,190,255,' + (0.18 + 0.25 * k + f.ripple * 0.3).toFixed(3) + ')'; ctx.lineWidth = 1.5 + f.ripple * 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.05 + 4, 0, TAU); ctx.stroke();
        var g = ctx.createRadialGradient(f.x, f.y, f.r * 0.6, f.x, f.y, f.r * 1.05 + 4); g.addColorStop(0, 'rgba(110,190,255,0)'); g.addColorStop(1, 'rgba(110,190,255,' + (0.06 + f.ripple * 0.12).toFixed(3) + ')'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.05 + 4, 0, TAU); ctx.fill(); }
      if (f.slow > 0.05) { ctx.strokeStyle = 'rgba(150,190,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 2, G.rt * 2, G.rt * 2 + 2); ctx.stroke(); }
      if (f.burnT > 0) ctx.drawImage(ART.glow('255,130,60'), f.x - f.r * 0.6, f.y - f.r * 0.6, f.r * 1.2, f.r * 1.2);
      if (f.k === 'mender') { ctx.strokeStyle = 'rgba(90,255,170,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.D.heal.r, 0, TAU); ctx.stroke(); }
      if (!f.boss && !hidden && (f.hp < f.max || f.shield < f.smax)) { var bw = Math.max(18, f.r * 1.4), bx = f.x - bw / 2, by = f.y - f.r - 9; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5); ctx.fillStyle = f.hp / f.max > 0.5 ? '#6dff9a' : f.hp / f.max > 0.25 ? '#ffd36a' : '#ff6a5a'; ctx.fillRect(bx, by, bw * Math.max(0, f.hp / f.max), 3); if (f.smax) { ctx.fillStyle = '#7cc8ff'; ctx.fillRect(bx, by - 3, bw * f.shield / f.smax, 2); } }
    }
  }
  function drawShots() {
    ctx.lineCap = 'round';
    G.beams.forEach(function (b) {
      ctx.strokeStyle = 'rgba(255,80,80,' + (0.18 + 0.12 * b.w).toFixed(3) + ')'; ctx.lineWidth = 5 + b.w * 6; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.tx, b.ty); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,225,215,0.85)'; ctx.lineWidth = 1.4 + b.w; ctx.stroke();
      b.chain.forEach(function (c) { ctx.strokeStyle = 'rgba(255,120,160,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,220,230,0.7)'; ctx.lineWidth = 1; ctx.stroke(); });
      ctx.drawImage(ART.glow('255,120,100'), b.tx - 9, b.ty - 9, 18, 18);
    });
    G.shots.forEach(function (s) {
      if (s.k === 'trail') { var k = s.life / s.max; ctx.strokeStyle = 'rgba(120,210,255,' + (0.5 * k).toFixed(3) + ')'; ctx.lineWidth = 6 * k + 1; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x2, s.y2); ctx.stroke(); ctx.strokeStyle = 'rgba(230,248,255,' + (0.8 * k).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.stroke(); }
      else if (s.k === 'bolt') { var k2 = s.life / s.max; ctx.strokeStyle = 'rgba(' + s.c + ',' + (0.9 * k2).toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
      else if (s.k === 'missile' && s.delay <= 0) { var a = Math.atan2(s.vy, s.vx), z = s.big ? 1.8 : 1; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a); ctx.fillStyle = '#e6e2d8'; ctx.fillRect(-5 * z, -1.4 * z, 9 * z, 2.8 * z); ctx.fillStyle = '#c03a2a'; ctx.fillRect(3 * z, -1.4 * z, 2 * z, 2.8 * z); ctx.restore(); ctx.drawImage(ART.glow('255,190,110'), s.x - Math.cos(a) * 6 - 6 * z, s.y - Math.sin(a) * 6 - 6 * z, 12 * z, 12 * z); }
    });
    G.eshots.forEach(function (e) { ctx.drawImage(ART.glow('255,110,70'), e.x - 10, e.y - 10, 20, 20); ctx.fillStyle = '#ffd0b0'; ctx.beginPath(); ctx.arc(e.x, e.y, 2.5, 0, TAU); ctx.fill(); });
    G.strikes.forEach(function (s) {
      var k = 1 - s.t / 0.9; ctx.strokeStyle = 'rgba(255,200,120,' + (0.3 + 0.4 * k).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 95 * (1 - k * 0.6), 0, TAU); ctx.stroke();
      var g = ctx.createLinearGradient(s.x, s.y - 900, s.x, s.y); g.addColorStop(0, 'rgba(255,220,160,0)'); g.addColorStop(1, 'rgba(255,230,190,' + (0.6 * k).toFixed(3) + ')'); ctx.strokeStyle = g; ctx.lineWidth = 3 + 5 * k; ctx.beginPath(); ctx.moveTo(s.x, s.y - 900 * (1 - k * 0.2)); ctx.lineTo(s.x, s.y); ctx.stroke();
    });
  }
  function drawParts() {
    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i], k = p.life / p.max;
      if (p.k === 'glow') { var rise = Math.min(1, (1 - k) / 0.18), a = (p.a || 0.75) * rise * k; ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; var sz = p.s * (1.2 - 0.4 * k); ctx.drawImage(ART.glow(p.c), p.x - sz, p.y - sz, sz * 2, sz * 2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      else if (p.k === 'smokeball' || p.k === 'smoke') { var s2 = p.k === 'smoke' ? p.s * (1.6 - k) : p.s * (1.6 - 0.6 * k); ctx.globalAlpha = (p.k === 'smoke' ? 0.25 : 0.22) * k; ctx.drawImage(ART.glow(p.c), p.x - s2, p.y - s2, s2 * 2, s2 * 2); ctx.globalAlpha = 1; }
      else if (p.k === 'spark') { ctx.fillStyle = 'rgba(' + p.c + ',' + k.toFixed(3) + ')'; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      else if (p.k === 'debris') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = 'rgba(' + p.c + ',' + k.toFixed(3) + ')'; ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore(); }
      else if (p.k === 'ring') { ctx.strokeStyle = 'rgba(' + p.c + ',' + (0.35 * k).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - k * 0.7), 0, TAU); ctx.stroke(); }
      else if (p.k === 'text') { ctx.fillStyle = 'rgba(' + p.c + ',' + Math.min(1, k * 2).toFixed(3) + ')'; ctx.font = font(18, 800); ctx.textAlign = 'center'; ctx.fillText(p.txt, p.x, p.y); }
    }
    if (G.bossDeath) { var b = G.bossDeath, t = b.t / 2.5, a2 = Math.sin(Math.min(1, t * 2.2) * Math.PI / 2) * (1 - t) * 0.35, R = b.r * 4; var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R); g.addColorStop(0, 'rgba(255,210,150,' + a2.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,160,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, TAU); ctx.fill();
      if (Math.random() < 0.25 && b.t < 1.8) boom(b.x + (Math.random() - 0.5) * b.r * 2, b.y + (Math.random() - 0.5) * b.r, 14, false); }
  }
  function drawRange(x, y, R, col) { ctx.fillStyle = 'rgba(' + col + ',0.06)'; ctx.strokeStyle = 'rgba(' + col + ',0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
  function drawWorld(dt) {
    worldT();
    drawLanes(); drawPlanet(); drawFields(); drawSlots();
    if (G.sel) { var s = G.sel; if (s.t) drawRange(s.t.x, s.t.y, stats(s.t).range, ART.TCOL[s.t.k]); else if (G.preview) drawRange(s.x, s.y, TURRETS[G.preview].tiers[0].range, ART.TCOL[G.preview]); ctx.strokeStyle = 'rgba(255,216,106,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, TAU); ctx.stroke(); }
    drawTurrets(); drawFoes(); drawShots(); drawParts();
    if (G.armed === 'strike' && G.mouse) { var m = toWorld(G.mouse.x, G.mouse.y); ctx.strokeStyle = 'rgba(255,200,120,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(m.x, m.y, 95, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  }
  // ---------------- HUD + UI hit regions ----------------
  function btn(id, x, y, w, h, fn, circle) { G.ui.push({ id: id, x: x, y: y, w: w, h: h, fn: fn, c: circle }); }
  function panelBg(x, y, w, h, r, edge) { rr(x, y, w, h, r); ctx.fillStyle = 'rgba(6,10,24,0.82)'; ctx.fill(); ctx.strokeStyle = edge || 'rgba(130,190,255,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
  function txt(s, x, y, px, col, align, w) { ctx.font = font(px, w); ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
  function hudFont(n) { return Math.max(11, n * Math.max(0.62, V.u)); }
  function confirmOr(id, ptype, fn) { if (ptype === 'mouse' || G.confirm === id) { G.confirm = null; fn(); } else { G.confirm = id; play('click'); } }
  function drawHud() {
    screenT(); G.ui = [];
    var u = Math.max(0.62, V.u), m = Math.round(6 + 6 * u), B = V.B, f1 = hudFont(13), f2 = hudFont(20);
    // stats
    var pw = Math.round(Math.max(150, 232 * u)), ph = Math.round(f1 * 1.5 + f2 * 1.3 + f1 * 3.2 + 14);
    panelBg(m, m, pw, ph, 10);
    var y = m + 6 + f1 * 0.75; txt('SECTOR ' + G.lvl + ' \u00b7 ' + G.L.name.toUpperCase(), m + 10, y, f1, '#9fe6ff', 'left', 800);
    y += f1 * 0.75 + f2 * 0.7; txt('\u2B21 ' + Math.floor(G.credits), m + 10, y, f2, '#ffd36a', 'left', 800);
    txt('WAVE ' + Math.min(G.wave, G.nW) + '/' + G.nW, m + pw - 10, y, f1, '#e6f0ff', 'right', 700);
    y += f2 * 0.7 + f1 * 0.9; var bw = pw - 20 - f1 * 2.4, seg = bw / 20;
    for (var i = 0; i < 20; i++) { ctx.fillStyle = i < G.integ ? (G.integ > 10 ? '#6fd8ff' : G.integ > 5 ? '#ffd36a' : '#ff7a6a') : 'rgba(255,255,255,0.1)'; ctx.fillRect(m + 10 + i * seg, y - f1 * 0.32, seg - 1.5, f1 * 0.64); }
    txt(G.integ + '', m + pw - 10, y, f1, '#e6f0ff', 'right', 800);
    y += f1 * 1.3; txt('SCORE ' + G.score.toLocaleString(), m + 10, y, f1, '#c9d6f2', 'left', 600);
    // speed (top right)
    var sx = V.cw - m - B, sy = V.tbB ? V.tbB + 6 : m; panelBg(sx, sy, B, B * 0.8, 10, G.speed > 1 ? 'rgba(255,214,110,0.8)' : null); txt(G.speed + 'x', sx + B / 2, sy + B * 0.4, hudFont(16), G.speed > 1 ? '#ffd36a' : '#e6f0ff', 'center', 800);
    btn('speed', sx, sy, B, B * 0.8, function () { G.speed = G.speed === 1 ? 2 : 1; play('click'); });
    // abilities (bottom left)
    abil('strike', m, V.ch - m - B, B, 'ORBITAL', 'STRIKE', G.ab.strike, 32, true, function () { if (G.ab.strike > 0) { play('deny'); return; } G.armed = G.armed === 'strike' ? null : 'strike'; G.sel = null; play('click'); });
    abil('dilate', m + B + m, V.ch - m - B, B, 'TIME', 'DILATION', G.ab.dilate, 48, G.lvl >= 3, function () { if (!castDilate()) play('deny'); });
    // launch (bottom right)
    var lw = Math.round(Math.max(150, B * 3.3)), lh = Math.round(B * 0.9), lx = V.cw - m - lw, ly = V.ch - m - lh;
    if (G.mode === 'play' && G.phase === 'build' && G.wave < G.nW) {
      var cd = G.countdown > 0 ? Math.ceil(G.countdown) : 0;
      rr(lx, ly, lw, lh, 12); var g = ctx.createLinearGradient(0, ly, 0, ly + lh); g.addColorStop(0, '#2a8a5a'); g.addColorStop(1, '#0f4a30'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.stroke();
      txt('LAUNCH WAVE ' + (G.wave + 1), lx + lw / 2, ly + lh * (cd ? 0.38 : 0.5), hudFont(16), '#eafff2', 'center', 800);
      if (cd) { txt('auto in ' + cd + 's \u00b7 early +' + cd * 2, lx + lw / 2, ly + lh * 0.74, hudFont(11), '#bff5d4', 'center', 600); ctx.fillStyle = 'rgba(125,255,176,0.5)'; ctx.fillRect(lx + 8, ly + lh - 5, (lw - 16) * (G.countdown / 15), 2.5); }
      btn('launch', lx, ly, lw, lh, function () { launchWave(); });
    } else if (G.mode === 'play') {
      panelBg(lx, ly, lw, lh, 12); var left = G.spawnQ.length + G.foes.length;
      txt('WAVE ' + G.wave + ' \u00b7 ' + left + ' contacts', lx + lw / 2, ly + lh / 2, hudFont(13), '#c9d6f2', 'center', 700);
    }
    // boss bar
    var boss = null; G.foes.forEach(function (f) { if (f.boss) boss = f; });
    if (boss) { var bw2 = Math.min(520, V.cw * 0.42), bx = (V.cw - bw2) / 2, by = m + 4; panelBg(bx - 8, by - 4, bw2 + 16, f1 * 2.6, 8, 'rgba(255,140,110,0.6)'); txt(boss.D.name.toUpperCase(), V.cw / 2, by + f1 * 0.55, f1, '#ffcfb8', 'center', 800);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(bx, by + f1 * 1.25, bw2, f1 * 0.7); ctx.fillStyle = '#ff7a5a'; ctx.fillRect(bx, by + f1 * 1.25, bw2 * boss.hp / boss.max, f1 * 0.7); if (boss.smax) { ctx.fillStyle = '#7cc8ff'; ctx.fillRect(bx, by + f1 * 1.25, bw2 * boss.shield / boss.smax, f1 * 0.3); } }
    if (G.dil > 0) { var va = Math.min(1, G.dil * 2, (6 - G.dil) * 2) * 0.12, vg = ctx.createRadialGradient(V.cw / 2, V.ch / 2, Math.min(V.cw, V.ch) * 0.3, V.cw / 2, V.ch / 2, Math.max(V.cw, V.ch) * 0.7); vg.addColorStop(0, 'rgba(90,140,255,0)'); vg.addColorStop(1, 'rgba(90,140,255,' + va.toFixed(3) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, V.cw, V.ch); }
    if (G.armed === 'strike') { var tw = Math.min(V.cw - 20, 420 * u); panelBg((V.cw - tw) / 2, V.ch * 0.14, tw, f1 * 2.4, 10, 'rgba(255,200,120,0.7)'); txt((V.touch ? 'Tap' : 'Click') + ' a spot on the lanes to fire the Orbital Strike', V.cw / 2, V.ch * 0.14 + f1 * 1.2, f1, '#ffe2a0', 'center', 700); }
    if (G.sel && G.mode === 'play') { if (G.sel.t) turretCard(G.sel.t, u); else buildRing(G.sel, u); }
    if (G.banner) { G.banner.t += 1 / 60; var bt = G.banner.t, ba = Math.min(1, bt / 0.6, Math.max(0, (4 - bt) / 0.8)); if (bt > 4) G.banner = null; else { ctx.globalAlpha = ba; txt(G.banner.title, V.cw / 2, V.ch * 0.3, hudFont(30), '#eaf4ff', 'center', 800); txt(G.banner.sub, V.cw / 2, V.ch * 0.3 + hudFont(30), hudFont(16), '#9fe6ff', 'center', 600); ctx.globalAlpha = 1; } }
    if (G.mode === 'won' || G.mode === 'lost') endCard(u);
  }
  function abil(id, x, y, B, l1, l2, cd, max, avail, fn) {
    var cx = x + B / 2, cy = y + B / 2, r = B / 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = 'rgba(6,10,24,0.85)'; ctx.fill(); ctx.strokeStyle = !avail ? 'rgba(255,255,255,0.15)' : cd > 0 ? 'rgba(130,160,200,0.4)' : G.armed === id ? '#ffd36a' : 'rgba(255,214,110,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    if (cd > 0) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (cd / max)); ctx.closePath(); ctx.fillStyle = 'rgba(80,100,140,0.35)'; ctx.fill(); }
    ctx.globalAlpha = avail ? 1 : 0.35;
    if (id === 'strike') { ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.26, 0, TAU); ctx.moveTo(cx - r * 0.42, cy - r * 0.18); ctx.lineTo(cx + r * 0.42, cy - r * 0.18); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy + r * 0.24); ctx.stroke(); }
    else { ctx.strokeStyle = '#9fc8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - r * 0.25, cy - r * 0.52); ctx.lineTo(cx + r * 0.25, cy - r * 0.52); ctx.lineTo(cx - r * 0.25, cy + r * 0.12); ctx.lineTo(cx + r * 0.25, cy + r * 0.12); ctx.closePath(); ctx.stroke(); }
    txt(cd > 0 ? Math.ceil(cd) + 's' : l2, cx, cy + r * 0.52, Math.max(9, B * 0.17), '#e6f0ff', 'center', 800); ctx.globalAlpha = 1;
    if (avail) btn(id, x, y, B, B, fn, true);
  }
  function buildRing(slot, u) {
    var p = toScreen(slot.x, slot.y), B = V.B, R = Math.max(B * 1.12, 74 * u), pad = B / 2 + 4;
    var cx = clamp(p.x, R + pad, V.cw - R - pad), cy = clamp(p.y, R + pad, V.ch - R - pad);
    ctx.strokeStyle = 'rgba(255,216,106,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ORDER.forEach(function (k, i) {
      var a = -Math.PI / 2 + i * TAU / ORDER.length, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, D = TURRETS[k], ok = unlocked(k), afford = G.credits >= D.cost, hot = G.preview === k;
      ctx.beginPath(); ctx.arc(x, y, B / 2, 0, TAU); ctx.fillStyle = hot ? 'rgba(30,44,80,0.95)' : 'rgba(8,12,28,0.92)'; ctx.fill(); ctx.strokeStyle = !ok ? 'rgba(255,255,255,0.15)' : afford ? 'rgba(' + ART.TCOL[k] + ',' + (hot ? 1 : 0.75) + ')' : 'rgba(255,120,110,0.45)'; ctx.lineWidth = hot ? 3 : 2; ctx.stroke();
      if (ok) { ctx.globalAlpha = afford ? 1 : 0.45; var h = ART.head(k, 1, V.dpr); var sz = B * 0.62; ctx.drawImage(h.c, x - sz / 2, y - sz / 2 - B * 0.08, sz, sz); ctx.globalAlpha = 1; txt('' + D.cost, x, y + B * 0.3, Math.max(10, B * 0.2), afford ? '#ffd36a' : '#ff8a7a', 'center', 800); }
      else { txt('\uD83D\uDD12', x, y - B * 0.06, B * 0.3, '#8090a8', 'center'); txt('S' + D.unlock, x, y + B * 0.3, Math.max(9, B * 0.18), '#8090a8', 'center', 700); }
      if (ok) btn('b_' + k, x - B / 2, y - B / 2, B, B, function (pt) {
        if (!afford) { play('deny'); G.preview = k; return; }
        if (pt === 'mouse' || G.preview === k) build(slot, k); else { G.preview = k; play('click'); }
      }, true);
    });
    var k2 = G.preview || G.hoverK;
    if (k2) { var D2 = TURRETS[k2], tw = Math.min(V.cw - 16, 380 * u), f = hudFont(13), th = f * 4.6, tx = (V.cw - tw) / 2, ty = cy > V.ch / 2 ? 8 : V.ch - th - 8;
      if (V.cw > 1000) { tx = cx < V.cw / 2 ? Math.min(V.cw - tw - 8, cx + R + B) : Math.max(8, cx - R - B - tw); ty = clamp(cy - th / 2, 8, V.ch - th - 8); }
      panelBg(tx, ty, tw, th, 10, 'rgba(' + ART.TCOL[k2] + ',0.7)'); txt(D2.name + '  \u2B21' + D2.cost, tx + 12, ty + f * 1.0, f * 1.15, '#ffffff', 'left', 800);
      wrapText(D2.blurb, tx + 12, ty + f * 2.3, tw - 24, f, '#c9d6f2'); if (V.touch && G.preview === k2) txt('Tap again to build', tx + tw - 12, ty + f * 1.0, f * 0.9, '#ffd36a', 'right', 700); }
  }
  function wrapText(s, x, y, w, px, col) { ctx.font = font(px, 500); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; var words = s.split(' '), line = '', ly = y; words.forEach(function (wd) { var t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w && line) { ctx.fillText(line, x, ly); line = wd; ly += px * 1.25; } else line = t; }); if (line) ctx.fillText(line, x, ly); }
  var MODES = ['first', 'strong', 'close'], MODEL = { first: 'First', strong: 'Strongest', close: 'Closest' };
  function turretCard(t, u) {
    var D = TURRETS[t.k], s = stats(t), p = toScreen(t.x, t.y), f = hudFont(13), rh = Math.max(40, Math.round(V.B * 0.78)), cw = Math.round(Math.min(V.cw * 0.48, Math.max(210, 250 * u)));
    var rows = []; var name = t.tier === 4 ? D.name + ' \u00b7 ' + D.branches[t.br].name : D.name + ' \u00b7 Tier ' + ['I', 'II', 'III'][t.tier - 1];
    if (t.tier < 3) { var c = upCost(t.k, t.tier); rows.push({ id: 'up', label: 'Upgrade to Tier ' + ['II', 'III'][t.tier - 1], cost: c, fn: function () { upgrade(t); } }); }
    else if (t.tier === 3) D.branches.forEach(function (b, i) { rows.push({ id: 'br' + i, label: b.name + ': ' + b.blurb, cost: upCost(t.k, 3), fn: function () { upgrade(t, i); }, two: true }); });
    if (t.k !== 'stasis' && t.k !== 'pylon') rows.push({ id: 'mode', label: 'Target: ' + MODEL[t.mode], fn: function () { t.mode = MODES[(MODES.indexOf(t.mode) + 1) % 3]; play('click'); } });
    rows.push({ id: 'sell', label: G.confirm === 'sell' ? 'Tap again to sell' : 'Sell', cost: -Math.floor(t.spent * 0.7), fn: null });
    var hh = f * 3.2 + rows.length * (rh + 6) + 6, onRight = p.x + 40 + cw < V.cw - 8 || p.x < V.cw / 2;
    var x = onRight ? Math.min(V.cw - cw - 8, p.x + 40 * Math.max(V.s, 0.5) + 10) : Math.max(8, p.x - 40 * Math.max(V.s, 0.5) - 10 - cw), y = clamp(p.y - hh / 2, 8, V.ch - hh - 8);
    panelBg(x, y, cw, hh, 12, 'rgba(' + ART.TCOL[t.k] + ',0.7)');
    btn('card', x, y, cw, hh, function () { });
    txt(name, x + 12, y + f * 1.0, f * 1.08, '#ffffff', 'left', 800);
    txt(statLine(t, s), x + 12, y + f * 2.3, f * 0.9, '#9fb6e6', 'left', 600);
    var ry = y + f * 3.2;
    rows.forEach(function (r) {
      var afford = !r.cost || r.cost < 0 || G.credits >= r.cost;
      rr(x + 8, ry, cw - 16, rh, 9); ctx.fillStyle = r.id === 'sell' ? 'rgba(80,20,20,0.6)' : afford ? 'rgba(30,60,120,0.55)' : 'rgba(40,40,50,0.5)'; ctx.fill(); ctx.strokeStyle = r.id === 'sell' ? 'rgba(255,130,110,0.5)' : afford ? 'rgba(140,200,255,0.55)' : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      var fs = r.two ? f * 0.86 : f; ctx.save(); rr(x + 8, ry, cw - 16, rh, 9); ctx.clip();
      if (r.two) { var parts = r.label.split(': '); txt(parts[0], x + 18, ry + rh * 0.32, fs * 1.05, '#ffffff', 'left', 800); txt(parts[1], x + 18, ry + rh * 0.7, fs * 0.82, '#c9d6f2', 'left', 500); }
      else txt(r.label, x + 18, ry + rh / 2, fs, '#eaf4ff', 'left', 700);
      if (r.cost) txt((r.cost < 0 ? '+' : '') + '\u2B21' + Math.abs(r.cost), x + cw - 18, ry + (r.two ? rh * 0.32 : rh / 2), fs, r.cost < 0 ? '#9fffc0' : afford ? '#ffd36a' : '#ff8a7a', 'right', 800);
      ctx.restore();
      btn(r.id, x + 8, ry, cw - 16, rh, r.id === 'sell' ? function (pt) { confirmOr('sell', pt === 'mouse' ? 'touch' : pt, function () { sell(t); }); } : function () { if (!afford) { play('deny'); return; } r.fn(); });
      ry += rh + 6;
    });
  }
  function statLine(t, s) {
    var b = t.buff ? ' (+' + Math.round(t.buff * 100) + '%)' : '';
    if (t.k === 'laser') return Math.round(s.dps) + ' dps, ramps to ' + s.ramp + 'x \u00b7 range ' + s.range + b;
    if (t.k === 'rail') return Math.round(s.dmg) + ' dmg / ' + s.rate + 's, pierces \u00b7 range ' + s.range + b;
    if (t.k === 'missile') return s.n + ' \u00d7 ' + s.dmg + ' splash / ' + s.rate + 's \u00b7 range ' + s.range + b;
    if (t.k === 'stasis') return 'Slows ' + Math.round(s.slow * 100) + '% \u00b7 range ' + s.range;
    if (t.k === 'pylon') return 'Reveal + ' + Math.round(s.buff * 100) + '% damage \u00b7 range ' + s.range;
    return s.n + ' drones \u00d7 ' + s.dmg + ' \u00b7 leash ' + s.range + b;
  }
  function endCard(u) {
    var won = G.mode === 'won', a = Math.min(1, G.endT / 0.8), w = Math.min(V.cw - 20, 460 * u), f = hudFont(15), h = f * 7, x = (V.cw - w) / 2, y = (V.ch - h) / 2;
    ctx.globalAlpha = a; panelBg(x, y, w, h, 14, won ? 'rgba(125,255,176,0.7)' : 'rgba(255,130,110,0.7)');
    txt(won ? (G.lvl >= 12 ? 'THE ECLIPSE IS DOWN' : 'SECTOR SECURED') : 'SECTOR LOST', V.cw / 2, y + f * 1.6, f * 1.7, won ? '#bfffd8' : '#ffc0b0', 'center', 800);
    if (won) { txt('\u2605'.repeat(G.result.stars) + '\u2606'.repeat(3 - G.result.stars), V.cw / 2, y + f * 3.4, f * 1.8, '#ffd36a', 'center', 800); txt('Integrity ' + G.integ + '/20 \u00b7 bonus +' + G.result.bonus, V.cw / 2, y + f * 5, f, '#c9d6f2', 'center', 600); }
    else txt('Wave ' + G.wave + ' of ' + G.nW + ' \u00b7 ' + G.stats.kills + ' ships destroyed', V.cw / 2, y + f * 3.6, f, '#c9d6f2', 'center', 600);
    txt('Score ' + G.score.toLocaleString(), V.cw / 2, y + f * 6.1, f * 1.1, '#ffffff', 'center', 800); ctx.globalAlpha = 1;
  }

  // ---------------- actions ----------------
  function build(slot, k) {
    var D = TURRETS[k]; if (slot.t || !unlocked(k) || G.credits < D.cost) { play('deny'); return false; }
    G.credits -= D.cost; var t = { k: k, x: slot.x, y: slot.y, tier: 1, br: -1, ang: -Math.PI / 2, cd: 0.3, kick: 0, off: 0, mode: 'first', spent: D.cost, drones: [], ramp: 1, tgt: null, buff: 0, haste: 0, slot: slot };
    slot.t = t; G.turrets.push(t); G.sel = null; G.preview = null; play('build'); G.hint = null;
    G.parts.push({ x: slot.x, y: slot.y, life: 0.8, max: 0.8, s: 40, c: ART.TCOL[k], k: 'ring' });
    queueTip('launch'); return true;
  }
  function upgrade(t, br) {
    if (t.tier >= 4) return false; var c = upCost(t.k, t.tier); if (G.credits < c) { play('deny'); return false; }
    if (t.tier === 3 && (br == null || br < 0)) return false;
    G.credits -= c; t.spent += c; if (t.tier === 3) t.br = br; t.tier++; play('upgrade');
    G.parts.push({ x: t.x, y: t.y, life: 0.8, max: 0.8, s: 46, c: '255,214,110', k: 'ring' });
    if (t.tier === 3) queueTip('branch'); return true;
  }
  function sell(t) { var i = G.turrets.indexOf(t); if (i < 0) return; G.turrets.splice(i, 1); t.slot.t = null; G.credits += Math.floor(t.spent * 0.7); G.sel = null; play('sell'); }

  // ---------------- tips ----------------
  var TIPS = {
    welcome: ['Defend your world', 'Enemy ships fly the glowing <b>orbital lanes</b> toward the planet. Every ship that gets through costs <b>integrity</b>. Lose all 20 and the sector falls.'],
    build: ['Build turrets', 'Tap a <b>ring platform</b> beside a lane, then pick a turret. <b>Pulse Lasers</b> are cheap and steady. <b>Missile Pods</b> splash groups. The yellow ring marks a good first spot.'],
    launch: ['Launch the wave', 'Press <b>LAUNCH WAVE</b> when you are ready (Space on a keyboard). Between waves a countdown runs, and launching early pays bonus credits.'],
    strike: ['Orbital Strike and speed', 'Tap <b>ORBITAL STRIKE</b> (bottom left), then tap the lane to hit everything in a wide circle. It recharges in 32 s. The <b>1x/2x</b> button (top right) speeds the game up.'],
    upgrade: ['Upgrade', 'Tap a turret to <b>upgrade</b> it, change its <b>targeting</b> (First, Strongest, Closest) or <b>sell</b> it for 70% back. Upgrading is usually better value than building more.'],
    early: ['Damage types matter', '<b>Energy</b> (lasers, drones) strips shields but armor blunts it. <b>Kinetic</b> (railgun) ignores armor. <b>Explosive</b> (missiles) splashes. Mix them.'],
    branch: ['Tier IV: pick a specialization', 'A Tier III turret can become one of two <b>specializations</b>. Each pushes it in a different direction, so pick the one your defense needs.'],
    disrupt: ['Turret disrupted', 'Enemy fire knocked a turret offline for a few seconds. Kill gunships quickly, and later an <b>Aegis Pylon</b> shields the turrets near it.'],
    dilate: ['New power: Time Dilation', '<b>TIME DILATION</b> slows every enemy to a crawl for 6 seconds. It is perfect for a crowded lane or a boss push. It recharges in 48 s.'],
    t_rail: ['New turret: Railgun', 'Long range. Each slug <b>pierces every ship in a line</b> and ignores armor. Place it where a lane runs straight toward it.'],
    t_stasis: ['New turret: Stasis Field', 'Slows every ship inside its field. Pair it with lasers, which ramp up the longer they hold one target.'],
    t_pylon: ['New turret: Aegis Pylon', 'Shields nearby turrets from <b>gunship disruptor fire</b>, adds damage to them, and <b>reveals cloaked ships</b> (they arrive next sector).'],
    t_drone: ['New turret: Drone Bay', 'Its drones hunt anything inside the leash, including fast fighters launched by carriers.']
  };
  Object.keys(FOES).forEach(function (k) { if (FOES[k].tip) TIPS['f_' + k] = [(FOES[k].boss ? '' : 'New contact: ') + FOES[k].name, FOES[k].tip]; });
  function queueTip(id) { if (!tipsOn || seenTips[id] || tipQ.indexOf(id) >= 0 || (tipOpen && tipOpen.id === id)) return; tipQ.push(id); }
  var tutEl = document.createElement('div'); tutEl.id = 'tut'; tutEl.hidden = true; tutEl.setAttribute('role', 'dialog'); tutEl.setAttribute('aria-live', 'polite'); wrap.appendChild(tutEl);
  function openTip(id, pages, pi) {
    var T = pages ? pages[pi] : TIPS[id]; tipOpen = { id: id, pages: pages, pi: pi || 0 };
    var isNew = /^(t_|f_|dilate)/.test(id) || (pages && pi > 0 && false);
    tutEl.innerHTML = '<div class="tut-card"><div class="tut-step">' + (pages ? 'How to play \u00b7 ' + (pi + 1) + ' of ' + pages.length : (isNew ? '<span class="tut-new">NEW</span>' : 'Tip')) + '</div><h3>' + T[0] + '</h3><p>' + T[1] + '</p>' +
      '<div class="tut-btns">' + (pages ? '' : '<button type="button" class="tut-skip">Skip all tips</button>') + '<span class="tut-sp"></span><button type="button" class="tut-next">' + (pages && pi < pages.length - 1 ? 'Next' : 'Got it') + '</button></div></div>';
    tutEl.hidden = false;
    var nx = tutEl.querySelector('.tut-next'), sk = tutEl.querySelector('.tut-skip');
    nx.onclick = function (e) { e.stopPropagation(); closeTip(); }; if (sk) sk.onclick = function (e) { e.stopPropagation(); tipsOn = false; store.set('tipsOn', false); tipQ = []; closeTip(); };
    setTimeout(function () { try { nx.focus({ preventScroll: true }); } catch (e) { } }, 30);
  }
  function closeTip() {
    if (!tipOpen) return; var o = tipOpen; tipOpen = null; tutEl.hidden = true; play('click');
    if (o.pages) { if (o.pi < o.pages.length - 1) openTip(o.id, o.pages, o.pi + 1); return; }
    seenTips[o.id] = 1; store.set('tips', seenTips);
    if (o.id === 'build' && G.mode === 'play' && !G.turrets.length) G.hint = bestSlot();
  }
  function bestSlot() { return G.slots.length ? 0 : null; }
  var HOWTO = [TIPS.welcome, TIPS.build, TIPS.launch, TIPS.strike, TIPS.upgrade, TIPS.early, ['Stealth, disruption and bosses', 'Phantoms are cloaked until an <b>Aegis Pylon</b> reveals them. Gunships knock turrets offline. Bosses arrive on sectors 4, 8 and 12. Earn up to three stars per sector by keeping integrity high.'],
    ['Controls', 'Mouse or touch: tap a platform to build or a turret to manage. Keys: <b>Space</b> launch, <b>1-6</b> build, <b>U</b> upgrade, <b>T</b> targeting, <b>S</b> sell, <b>Q</b> strike, <b>W</b> dilation, <b>X</b> speed, <b>P</b> pause, <b>M</b> mute, <b>F</b> fullscreen.']];

  // ---------------- HTML screens ----------------
  var scr = document.createElement('div'); scr.className = 'scr'; wrap.appendChild(scr);
  function hideScreens() { scr.hidden = true; scr.innerHTML = ''; }
  function showTitle() {
    G.mode = 'title'; G.paused = false; if (ov) ov.hide(); if (SND) SND.setMood('calm');
    var un = store.get('unlocked', 1);
    scr.innerHTML = '<div class="menu"><button type="button" class="start-btn" data-a="start">' + (un > 1 ? 'NEW CAMPAIGN' : 'START') + '<small>' + (V.touch ? 'Tap' : 'Click or press Enter') + ' to defend Terra Nova</small></button>' +
      (un > 1 ? '<button type="button" class="mbtn hi" data-a="cont">Continue \u00b7 Sector ' + un + '</button>' : '') +
      '<button type="button" class="mbtn" data-a="sectors">Sector select</button><button type="button" class="mbtn" data-a="scores">High scores</button><button type="button" class="mbtn" data-a="how">How to play</button></div>';
    scr.hidden = false; bindScr();
  }
  function showSectors() {
    var un = store.get('unlocked', 1), best = store.get('best', {}), h = '<div class="panel"><h2>Sector select</h2><div class="grid">';
    LEVELS.forEach(function (L, i) { var n = i + 1, b = best[n], lock = n > un; h += '<button type="button" class="sec' + (L.boss ? ' boss' : '') + '" data-a="lvl" data-n="' + n + '"' + (lock ? ' disabled' : '') + '><b>' + n + '</b><span>' + L.name + '</span><i>' + (lock ? '\uD83D\uDD12' : b ? '\u2605'.repeat(b.stars) + '\u2606'.repeat(3 - b.stars) : (L.boss ? 'BOSS' : '\u2606\u2606\u2606')) + '</i></button>'; });
    scr.innerHTML = h + '</div><div class="row"><button type="button" class="mbtn" data-a="back">Back</button></div></div>'; scr.hidden = false; bindScr();
  }
  function scoresHtml() { var hs = store.get('scores', []), h = '<table><tr><th>#</th><th>Name</th><th>Score</th><th>Sector</th></tr>'; for (var i = 0; i < 10; i++) { var s = hs[i]; h += '<tr' + (s && s.me ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td>' + (s ? esc(s.n) : '---') + '</td><td>' + (s ? s.s.toLocaleString() : '') + '</td><td>' + (s ? s.l : '') + '</td></tr>'; } return h + '</table>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function showScores(after) {
    G.mode = after ? 'scores' : 'title';
    scr.innerHTML = '<div class="panel"><h2>High scores</h2>' + scoresHtml() + '<div class="row">' + (after ? '<button type="button" class="mbtn hi" data-a="retry">Retry sector ' + G.lvl + '</button>' : '') + '<button type="button" class="mbtn" data-a="' + (after ? 'title' : 'back') + '">' + (after ? 'Title screen' : 'Back') + '</button></div></div>';
    scr.hidden = false; bindScr(); var hs = store.get('scores', []); hs.forEach(function (s) { delete s.me; }); store.set('scores', hs);
  }
  function askInitials(kind) {
    var hs = store.get('scores', []), q = G.score > 0 && (hs.length < 10 || G.score > hs[hs.length - 1].s);
    G.mode = 'scores';
    if (!q) { showScores(true); return; }
    scr.innerHTML = '<div class="panel"><h2>' + (kind === 'victory' ? 'Campaign complete!' : 'New high score') + '</h2><p class="big">' + G.score.toLocaleString() + '</p><form class="ini"><label>Your initials <input maxlength="3" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(store.get('ini', 'ACE')) + '"></label><button type="submit" class="mbtn hi">Save</button></form></div>';
    scr.hidden = false; var inp = scr.querySelector('input'), fm = scr.querySelector('form'); setTimeout(function () { inp.focus(); inp.select(); }, 50);
    fm.onsubmit = function (e) { e.preventDefault(); var n = (inp.value || 'ACE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'ACE'; store.set('ini', n); hs.push({ n: n, s: G.score, l: G.lvl, d: Date.now(), me: 1 }); hs.sort(function (a, b) { return b.s - a.s; }); store.set('scores', hs.slice(0, 10)); showScores(true); };
  }
  function bindScr() {
    scr.querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); if (SND) SND.unlock(); play('click'); var a = b.getAttribute('data-a');
        if (a === 'start') startLevel(1); else if (a === 'cont') startLevel(store.get('unlocked', 1)); else if (a === 'sectors') showSectors(); else if (a === 'scores') showScores(false);
        else if (a === 'how') openTip('howto', HOWTO, 0); else if (a === 'back' || a === 'title') showTitle(); else if (a === 'lvl') startLevel(+b.getAttribute('data-n')); else if (a === 'retry') startLevel(G.lvl);
      };
    });
    var f = scr.querySelector('button'); if (f && !V.touch) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { } }, 30);
  }
  ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { scr.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); tutEl.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });

  // ---------------- pause ----------------
  var ov = window.ArcadeOverlay ? ArcadeOverlay.mount(wrap) : null;
  function setPause(p) {
    if (G.mode !== 'play') return; G.paused = p; if (SND) SND.suspend(p);
    if (p && ov) ov.show({ primary: { label: 'Resume', onClick: function () { setPause(false); } }, secondary: { label: 'Restart sector', onClick: function () { setPause(false); startLevel(G.lvl, G.lvl > G.runStart); } } });
    else if (ov) ov.hide();
  }
  function drawPaused() { screenT(); ctx.fillStyle = 'rgba(2,4,12,0.55)'; ctx.fillRect(0, 0, V.cw, V.ch); txt('PAUSED', V.cw / 2, V.ch * 0.36, hudFont(40), '#eaf4ff', 'center', 800); txt('Sector ' + G.lvl + ' \u00b7 wave ' + G.wave + '/' + G.nW + ' \u00b7 score ' + G.score.toLocaleString(), V.cw / 2, V.ch * 0.36 + hudFont(36), hudFont(15), '#9fe6ff', 'center', 600); }

  // ---------------- input ----------------
  function hitUI(x, y) { for (var i = G.ui.length - 1; i >= 0; i--) { var b = G.ui[i]; if (b.c) { var r = b.w / 2; if (dist2(x, y, b.x + r, b.y + r) <= r * r * 1.1) return b; } else if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; } return null; }
  function nearestSlot(wx, wy) { var R = Math.max(50, 26 / V.s), best = null, bd = R * R; G.slots.forEach(function (s) { var d = dist2(s.x, s.y, wx, wy); if (d < bd) { bd = d; best = s; } }); return best; }
  function blocked() { return !!tipOpen || (window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen()); }
  cv.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') { if (!V.touch) { document.body.classList.add('is-touch'); V.touch = true; setTimeout(resize, 50); } }
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; G.mouse = { x: x, y: y };
    if (blocked() || G.paused || G.mode !== 'play') return;
    e.preventDefault(); try { cv.focus({ preventScroll: true }); } catch (er) { }
    var b = hitUI(x, y); if (b) { if (b.id !== 'sell' && G.confirm === 'sell') G.confirm = null; b.fn(e.pointerType); return; }
    G.confirm = null;
    var w = toWorld(x, y);
    if (G.armed === 'strike') { if (castStrike(w.x, w.y)) G.armed = null; return; }
    var s = nearestSlot(w.x, w.y);
    if (s && s !== G.sel) { G.sel = s; G.preview = null; play('click'); } else { G.sel = null; G.preview = null; }
  });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect(); G.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.pointerType === 'mouse') { var b = hitUI(G.mouse.x, G.mouse.y); G.hoverK = b && b.id.indexOf('b_') === 0 ? b.id.slice(2) : null; if (G.sel && !G.sel.t) G.preview = G.hoverK; cv.style.cursor = b ? 'pointer' : 'crosshair'; }
  });
  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter'))) return;
    if (tipOpen) { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); closeTip(); } return; }
    if (window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen()) return;
    var k = e.code;
    if (k === 'KeyM') { toggleMute(); return; }
    if (G.mode === 'title' && (k === 'Enter' || k === 'Space') && scr.querySelector('[data-a=start]')) { e.preventDefault(); startLevel(1); return; }
    if (G.mode !== 'play') return;
    if (k === 'KeyP' || (k === 'Escape' && !G.sel && !G.armed)) { e.preventDefault(); setPause(!G.paused); return; }
    if (G.paused) return;
    if (k === 'Escape') { G.sel = null; G.armed = null; return; }
    if (k === 'Space' || k === 'Enter') { e.preventDefault(); launchWave(); return; }
    if (k === 'KeyX') { G.speed = G.speed === 1 ? 2 : 1; return; }
    if (k === 'KeyQ') { if (G.ab.strike <= 0) { G.armed = 'strike'; G.sel = null; } return; }
    if (k === 'KeyW') { castDilate(); return; }
    var t = G.sel && G.sel.t, n = /^Digit([1-6])$/.exec(k);
    if (n && G.sel && !t) { build(G.sel, ORDER[+n[1] - 1]); return; }
    if (n && t && t.tier === 3 && +n[1] <= 2) { upgrade(t, +n[1] - 1); return; }
    if (t && k === 'KeyU') { upgrade(t); return; }
    if (t && k === 'KeyT') { t.mode = MODES[(MODES.indexOf(t.mode) + 1) % 3]; return; }
    if (t && (k === 'KeyS' || k === 'Delete' || k === 'Backspace')) { confirmOr('sell', 'touch', function () { sell(t); }); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && G.mode === 'play' && !G.paused) setPause(true); });

  // ---------------- toolbar ----------------
  var bMute = document.getElementById('btn-mute'), bPause = document.getElementById('btn-pause'), bFull = document.getElementById('btn-full');
  function syncHud() { if (bMute && SND) { var m = SND.isMuted(); bMute.setAttribute('aria-pressed', m ? 'true' : 'false'); bMute.innerHTML = (m ? '&#128263;' : '&#128266;') + ' <span class="lbl">' + (m ? 'Muted' : 'Sound on') + '</span>'; } }
  function toggleMute() { if (SND) { SND.setMuted(!SND.isMuted()); syncHud(); } }
  if (bMute) bMute.addEventListener('click', function (e) { e.preventDefault(); toggleMute(); bMute.blur(); });
  if (bPause) bPause.addEventListener('click', function (e) { e.preventDefault(); if (G.mode === 'play') setPause(!G.paused); bPause.blur(); });
  if (bFull) bFull.addEventListener('click', function (e) { e.preventDefault(); var d = document; if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { }); bFull.blur(); });
  document.addEventListener('fullscreenchange', function () { setTimeout(resize, 60); });
  syncHud();

  // ---------------- title scene ----------------
  var titlePlanet = null, titleShips = [];
  function drawTitle(dt) {
    drawBack(0, dt); worldT();
    if (!titlePlanet) { titlePlanet = ART.Planet('terran', 1031, { atm: [110, 170, 255], spin: 0.03 }); for (var i = 0; i < 9; i++) titleShips.push({ k: ['scout', 'frigate', 'cruiser', 'swarmer', 'scout', 'gunship', 'swarmer', 'phantom', 'carrier'][i], a: i * 0.7, r: 330 + i * 34, sp: 0.12 - i * 0.006 }); }
    var px = 1150, py = 500, pr = 230;
    ctx.strokeStyle = 'rgba(110,170,255,0.08)'; ctx.lineWidth = 1; [1.5, 2.1, 2.8].forEach(function (k) { ctx.beginPath(); ctx.ellipse(px, py, pr * k, pr * k * 0.5, -0.1, 0, TAU); ctx.stroke(); });
    titleShips.forEach(function (s) { s.a += s.sp * dt; var x = px + Math.cos(s.a) * s.r, y = py + Math.sin(s.a) * s.r * 0.5; if (Math.sin(s.a) < 0 && Math.abs(x - px) < pr) return; var ang = Math.atan2(Math.cos(s.a) * s.r * 0.5, -Math.sin(s.a) * s.r); sprite(ART.ship(s.k, V.px), x, y, ang, 1.2, s.k === 'phantom' ? 0.35 : 1); s.x = x; s.y = y; });
    titlePlanet.draw(ctx, px, py, pr, G.rt, V.dpr * V.s);
    titleShips.forEach(function (s) { if (Math.sin(s.a) >= 0 || Math.abs(s.x - px) >= pr) return; });
    var plat = ART.platform(V.px), turrets = [[860, 690, 'laser', 0], [1460, 260, 'missile', 1], [990, 250, 'rail', 2]];
    turrets.forEach(function (t, i) { var tg = titleShips[(i * 3 + Math.floor(G.rt / 4)) % titleShips.length]; var ang = tg.x != null ? Math.atan2(tg.y - t[1], tg.x - t[0]) : 0; sprite(plat, t[0], t[1], 0, 1.1); sprite(ART.head(t[2], 3, V.px), t[0], t[1], ang, 1.2);
      if (i === 0 && tg.x != null && Math.hypot(tg.x - t[0], tg.y - t[1]) < 420) { ctx.strokeStyle = 'rgba(255,80,80,0.28)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(tg.x, tg.y); ctx.stroke(); ctx.strokeStyle = 'rgba(255,225,215,0.85)'; ctx.lineWidth = 1.6; ctx.stroke(); } });
    screenT(); var u = Math.max(0.55, V.u), lx = Math.max(16, V.cw * 0.06), ly = V.ch * 0.2;
    ctx.save(); ctx.font = font(Math.min(V.cw * 0.085, 96 * u * 1.3), 900); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var tsz = Math.min(V.cw * 0.085, 96 * u * 1.3), g = ctx.createLinearGradient(0, ly - tsz, 0, ly); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#bcd2ee'); g.addColorStop(0.55, '#6c84a8'); g.addColorStop(1, '#dce8ff');
    ctx.shadowColor = 'rgba(90,170,255,0.45)'; ctx.shadowBlur = 24 * u; ctx.fillStyle = g; ctx.fillText('RAMPART', lx, ly + tsz * 0.35); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(20,30,60,0.6)'; ctx.lineWidth = 1.2; ctx.strokeText('RAMPART', lx, ly + tsz * 0.35);
    ctx.font = font(tsz * 0.34, 800); ctx.fillStyle = '#ffd36a'; ctx.fillText('SPACE EDITION', lx + tsz * 0.06, ly + tsz * 0.8);
    ctx.font = font(Math.max(11, tsz * 0.17), 600); ctx.fillStyle = '#9fe6ff'; ctx.fillText('ORBITAL TOWER DEFENSE \u00b7 12 SECTORS \u00b7 3 BOSSES', lx + tsz * 0.06, ly + tsz * 1.06); ctx.restore();
    scr.style.setProperty('--menu-top', Math.round(ly + tsz * 1.3) + 'px'); scr.style.setProperty('--menu-left', Math.round(lx) + 'px');
  }

  // ---------------- loop ----------------
  var lastT = performance.now(), frames = 0;
  function frame(now) {
    var dt = clamp((now - lastT) / 1000, 0, 0.05); lastT = now; frames++;
    var running = G.mode !== 'title' && G.mode !== 'scores' && !G.paused && !blocked();
    if (running || G.mode === 'title') G.rt += dt;
    if (G.mode === 'title' || (G.mode === 'scores')) { drawTitle(dt); }
    else {
      if (running) { for (var i = 0; i < G.speed; i++) step(dt); if (G.mode === 'play' && !tipOpen && tipQ.length) openTip(tipQ.shift()); }
      if (SND) SND.beams(G.beams.length && running ? G.beams.length : 0);
      drawBack(G.L.theme, running ? dt : 0); drawWorld(dt); if (!G.noHud) drawHud(); else G.ui = []; if (G.paused) drawPaused();
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 250); }); window.addEventListener("jsp-banner-ready", resize); setTimeout(resize, 400); setTimeout(resize, 1500);
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('is-touch');
  resize(); showTitle(); requestAnimationFrame(frame);

  // ---------------- test / debug hooks ----------------
  window.RSTD = {
    G: G, TURRETS: TURRETS, FOES: FOES, LEVELS: LEVELS, ORDER: ORDER, V: V,
    start: function (n) { startLevel(n || 1); }, launch: launchWave, build: function (i, k) { return build(G.slots[i], k); }, upgrade: function (i, br) { return upgrade(G.turrets[i], br); },
    sell: function (i) { sell(G.turrets[i]); }, strike: castStrike, dilate: castDilate, closeTips: function () { while (tipOpen) closeTip(); tipQ = []; }, tips: function (on) { tipsOn = on; if (!on) { tipQ = []; if (tipOpen) closeTip(); } },
    step: function (sec, sp) { var n = Math.round(sec * 60); for (var i = 0; i < n && G.mode === 'play'; i++) step(1 / 60); }, spawn: function (k, lane) { return spawnFoe(k, lane || 0, 0, hpMul(G.lvl, Math.max(1, G.wave))); },
    waves: buildWaves, upCost: upCost, stats: stats, hitUI: hitUI, toScreen: toScreen, title: showTitle, pause: setPause, tipOpen: function () { return tipOpen && tipOpen.id; }
  };
})();

/*
 * Joust tribute for eduaccess.pro/games. Original code, art and sound, drawn
 * and synthesized at runtime. Not affiliated with the original arcade makers.
 * Written by: Howie
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- constants
  var W = 960, H = 720;
  var LAVA_Y = 666, FLOOR_Y = 606;
  var DT = 1 / 120;
  var GRAV = 540, FLAP = 205, MAXUP = -330, TERM = 410;
  var RH = 50, RHW = 16;            // rider height and half width (feet anchored)
  var TIE = 7;                      // lance heights within this are a clash
  var EXTRA_LIFE = 20000;
  var FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';
  var MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';
  var TAU = Math.PI * 2;

  var params = new URLSearchParams(location.search);
  var Audio = window.JoustAudio || { play: function () {}, unlock: function () {}, isMuted: function () { return true; }, setMuted: function () {}, state: function () { return "none"; } };

  // ---------------------------------------------------------------- helpers
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
  function wrapDx(dx) { if (dx > W / 2) return dx - W; if (dx < -W / 2) return dx + W; return dx; }
  function wrapX(x) { x %= W; return x < 0 ? x + W : x; }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pad6(n) { var s = String(Math.floor(n)); while (s.length < 6) s = "0" + s; return s; }

  // ---------------------------------------------------------------- level
  var BASE = { x: 190, y: FLOOR_Y, w: 580, h: H - FLOOR_Y, pad: true, base: true };
  var BRIDGE_L = { x: 0, y: FLOOR_Y, w: 190, h: 18, bridge: true };
  var BRIDGE_R = { x: 770, y: FLOOR_Y, w: 190, h: 18, bridge: true };
  var LEDGES_FIXED = [
    { x: 0, y: 176, w: 150, h: 20 },
    { x: 810, y: 176, w: 150, h: 20 },
    { x: 352, y: 150, w: 256, h: 22, pad: true },
    { x: 0, y: 372, w: 196, h: 22 },
    { x: 668, y: 336, w: 232, h: 22, pad: true },
    { x: 300, y: 452, w: 214, h: 22, pad: true },
    { x: 846, y: 480, w: 114, h: 20 }
  ];
  function ledges() {
    var l = LEDGES_FIXED.concat([BASE]);
    if (G.bridges) l.push(BRIDGE_L, BRIDGE_R);
    return l;
  }
  function pads() {
    var out = [];
    LEDGES_FIXED.concat([BASE]).forEach(function (L) { if (L.pad) out.push({ x: L.x + L.w / 2, y: L.y, L: L }); });
    return out;
  }
  function overLava(x) {
    if (G.bridges) return false;
    x = wrapX(x);
    return x < BASE.x + 4 || x > BASE.x + BASE.w - 4;
  }

  // ---------------------------------------------------------------- settings
  var ACTIONS = [
    { id: "p1Left", label: "Run / steer left", def: "ArrowLeft" },
    { id: "p1Right", label: "Run / steer right", def: "ArrowRight" },
    { id: "p1Flap", label: "Flap (fly up)", def: "Space" },
    { id: "pause", label: "Pause", def: "KeyP" },
    { id: "mute", label: "Mute sound", def: "KeyM" },
    { id: "p2Left", label: "Player 2 left", def: "KeyA" },
    { id: "p2Right", label: "Player 2 right", def: "KeyD" },
    { id: "p2Flap", label: "Player 2 flap", def: "KeyW" }
  ];
  var bindings = {};
  function loadBindings() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("joust.bindings") || "{}") || {}; } catch (e) { saved = {}; }
    ACTIONS.forEach(function (a) { bindings[a.id] = typeof saved[a.id] === "string" ? saved[a.id] : a.def; });
  }
  function saveBindings() { try { localStorage.setItem("joust.bindings", JSON.stringify(bindings)); } catch (e) {} }
  function resetBindings() { ACTIONS.forEach(function (a) { bindings[a.id] = a.def; }); saveBindings(); }
  function keyName(code) {
    if (!code) return "(none)";
    var map = { Space: "Space", ArrowLeft: "\u2190 Left", ArrowRight: "\u2192 Right", ArrowUp: "\u2191 Up", ArrowDown: "\u2193 Down",
      ShiftLeft: "Left Shift", ShiftRight: "Right Shift", ControlLeft: "Left Ctrl", ControlRight: "Right Ctrl",
      AltLeft: "Left Alt", AltRight: "Right Alt", Enter: "Enter", Tab: "Tab", Backspace: "Backspace", Slash: "/", Period: ".", Comma: "," };
    if (map[code]) return map[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return "Num " + code.slice(6);
    return code;
  }
  loadBindings();

  var highScore = 0;
  try { highScore = parseInt(localStorage.getItem("joust.highscore") || "0", 10) || 0; } catch (e) {}

  // ---------------------------------------------------------------- input
  var keys = {};
  var pressed = {};        // action -> queued press count
  var touch = { left: false, right: false, flapQ: 0, active: false, flapHeld: false, holdT: 0 };
  var HOLD_FLAP_INT = 0.2;          // seconds between automatic flaps while FLAP is held (touch)
  var holdFlap = true;
  try { var hf = localStorage.getItem("joust.holdFlap"); if (hf !== null) holdFlap = hf === "1"; } catch (e) {}
  var RSCALE = 1;                   // riders are drawn ~15% bigger on phones
  var rebinding = null;

  function actionDown(id) { var c = bindings[id]; return !!(c && keys[c]); }
  function consume(id) { var n = pressed[id] || 0; pressed[id] = 0; return n > 0; }
  function anyStartKey(code) { return code === "Enter" || code === "Space" || code === bindings.p1Flap || code === "Digit1"; }
  function isTypingTarget(t) { return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"); }

  window.addEventListener("keydown", function (e) {
    Audio.unlock();
    if (rebinding) { e.preventDefault(); finishRebind(e.code); return; }
    var code = e.code;
    var bound = false;
    for (var id in bindings) if (bindings[id] === code) { bound = true; if (!e.repeat) pressed[id] = (pressed[id] || 0) + 1; }
    if ((bound || code === "Escape" || code === "Space" || /^Arrow/.test(code)) && !isTypingTarget(e.target)) {
      if (!(settingsOpen() && (code === "Space" || code === "Enter" || code === "Tab"))) e.preventDefault();
    }
    keys[code] = true;
    if (e.repeat) return;
    onKeyCommand(code);
  }, { passive: false });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { keys = {}; touch.left = touch.right = false; });

  function onKeyCommand(code) {
    if (settingsOpen()) { if (code === "Escape") closeSettings(); return; }
    if (code === bindings.mute) { toggleMute(); return; }
    if (G.mode === "attract") {
      if (code === "Digit2" || code === "Numpad2") { startGame(2); return; }
      if (anyStartKey(code)) { startGame(1); }
      return;
    }
    if (G.mode === "splash") return;
    if (G.mode === "gameover") { if (G.overT <= 0 && (anyStartKey(code) || code === "Escape")) overContinue(); return; }
    if (code === bindings.pause || code === "Escape") { togglePause(); return; }
    if (G.mode === "paused" && anyStartKey(code)) { togglePause(); }
  }

  // ---------------------------------------------------------------- game state
  var G = {
    mode: "attract", demo: true, time: 0, wave: 0, waveKind: "joust", phase: "intro", phaseT: 0,
    players: [], enemies: [], eggs: [], hatchlings: [], pickups: [], pteros: [], loose: [],
    particles: [], popups: [], spawnQ: [], hand: null, bridges: true, burnT: 0,
    eggCombo: 0, numPlayers: 1, overT: 0, overDelay: null, pteroT: 60, message: null, newHigh: false,
    timeScale: parseFloat(params.get("speed") || "1") || 1, autopilot: params.get("autopilot") === "1",
    shake: 0, flash: 0, gladiatorDone: false
  };

  var TIERS = {
    bounder: { name: "Bounder", pts: 500, seek: 0.35, aim: 8, think: 0.36, flapInt: 0.33, maxAir: 128, maxRun: 105, armor: "#e2463c", armorHi: "#ff8a7a", plume: "#ff5b4a" },
    hunter: { name: "Hunter", pts: 750, seek: 0.78, aim: 26, think: 0.22, flapInt: 0.25, maxAir: 172, maxRun: 140, armor: "#c9d2db", armorHi: "#ffffff", plume: "#e8eef5" },
    shadow: { name: "Shadow Lord", pts: 1500, seek: 0.92, aim: 44, think: 0.13, flapInt: 0.18, maxAir: 212, maxRun: 170, armor: "#3a74ff", armorHi: "#9fc1ff", plume: "#6fa0ff" }
  };
  var NEXT_TIER = { bounder: "hunter", hunter: "shadow", shadow: "shadow" };
  var PLAYER_STYLE = [
    { armor: "#ffd23f", armorHi: "#fff4b8", plume: "#ffef7a", mount: "ostrich" },
    { armor: "#4fb3ff", armorHi: "#d6f0ff", plume: "#9be0ff", mount: "stork" }
  ];

  function newRider(kind, type, x, y) {
    return {
      kind: kind, type: type, x: x, y: y, vx: 0, vy: 0, face: x < W / 2 ? 1 : -1,
      onGround: false, ledge: null, state: "spawn", spawnT: 1.0, inv: 0, wingT: 0, legPhase: 0,
      skid: false, grab: null, clashT: 0, flapCD: 0,
      ai: { think: 0, dir: Math.random() < 0.5 ? -1 : 1, targetY: 300, groundT: 0.5, cruiseT: 0 }
    };
  }

  function sfx(name, arg) { if (!G.demo) Audio.play(name, arg); }

  // ---------------------------------------------------------------- waves
  function waveKindFor(n) {
    if (n % 5 === 0) return "egg";
    if (n >= 8 && n % 5 === 3) return "ptero";
    if (n % 5 === 2) return "survival";
    if (n % 5 === 4 && G.numPlayers === 2) return "gladiator";
    return "joust";
  }
  var WAVE_TEXT = {
    joust: "PREPARE TO JOUST",
    survival: "SURVIVAL WAVE \u2022 3000 BONUS FOR NOT DYING",
    egg: "EGG WAVE \u2022 GRAB THEM BEFORE THEY HATCH",
    ptero: "PTERODACTYL WAVE",
    gladiator: "GLADIATOR WAVE \u2022 3000 FOR UNSEATING YOUR RIVAL"
  };

  function enemyMix(n) {
    var count = Math.min(3 + Math.floor((n - 1) * 0.75), 9);
    var pH = clamp((n - 2) * 0.14, 0, 0.6);
    var pS = clamp((n - 5) * 0.09, 0, 0.5);
    var out = [];
    for (var i = 0; i < count; i++) {
      var r = Math.random();
      out.push(r < pS ? "shadow" : r < pS + pH ? "hunter" : "bounder");
    }
    return out;
  }

  function startWave(n) {
    G.wave = n;
    G.waveKind = waveKindFor(n);
    G.phase = "intro"; G.phaseT = 2.6;
    G.eggCombo = 0; G.gladiatorDone = false;
    G.players.forEach(function (p) { p.diedThisWave = false; });
    G.pteroT = G.waveKind === "ptero" ? 5 : Math.max(32, 62 - n * 2);
    var sub = WAVE_TEXT[G.waveKind];
    if (n >= 3 && G.bridges) { G.burnT = 1.6; sub = "THE BRIDGE IS BURNING!"; sfx("burn"); }
    var firstTip = false;
    if (n === 1 && !G.demo) { try { firstTip = localStorage.getItem("joust.tipSeen") !== "1"; localStorage.setItem("joust.tipSeen", "1"); } catch (e) {} }
    if (firstTip) sub = "HIGHER LANCE WINS \u2022 " + (touch.active ? "HOLD FLAP TO CLIMB" : "TAP " + keyName(bindings.p1Flap).toUpperCase() + " TO FLAP");
    G.message = { title: "WAVE " + n, sub: sub, t: firstTip ? 3.8 : 2.6 };
    sfx("wave");
    if (!G.demo) music("play");
    G.spawnQ = [];
    if (G.waveKind === "egg") {
      var spots = LEDGES_FIXED.concat([BASE]);
      var count = Math.min(6 + Math.floor(n / 5) * 2, 12);
      for (var i = 0; i < count; i++) {
        var L = spots[i % spots.length];
        var ex = L.x + 20 + ((i * 53) % Math.max(20, L.w - 40));
        var egg = newEgg(ex, L.y - 9, 0, 0, "bounder");
        egg.ground = true; egg.ledge = L; egg.restT = -1.5 - i * 0.6;
        G.eggs.push(egg);
      }
    } else {
      var mix = enemyMix(n);
      mix.forEach(function (t, i) { G.spawnQ.push({ type: t, at: 0.5 + i * 0.7 }); });
    }
  }

  // ---------------------------------------------------------------- spawning
  function choosePad(forPlayer) {
    var ps = pads();
    var best = ps[0], bestScore = -1e9;
    ps.forEach(function (p) {
      var d = 1e9;
      G.enemies.forEach(function (e) { d = Math.min(d, Math.hypot(wrapDx(e.x - p.x), e.y - p.y)); });
      G.players.forEach(function (q) { if (q.state !== "dead" && q.state !== "out") d = Math.min(d, Math.hypot(wrapDx(q.x - p.x), q.y - p.y) * (forPlayer ? 0.6 : 1)); });
      var score = Math.min(d, 2000) + Math.random() * (forPlayer ? 40 : 260) + (forPlayer && p.L.base ? 120 : 0);
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return best;
  }

  function spawnEnemy(type) {
    var p = choosePad(false);
    var e = newRider("enemy", type, p.x + rand(-14, 14), p.y);
    e.onGround = true; e.ledge = p.L; e.state = "spawn"; e.spawnT = 1.0;
    e.ai.groundT = rand(0.1, 0.8);
    G.enemies.push(e);
    sfx("spawn");
  }

  function spawnPlayer(p) {
    var pad = choosePad(true);
    p.x = pad.x + (p.idx ? 18 : -18); p.y = pad.y; p.vx = 0; p.vy = 0;
    p.onGround = true; p.ledge = pad.L; p.state = "spawn"; p.spawnT = 1.0; p.inv = 3.0; p.grab = null; p.skid = false;
    p.face = p.x < W / 2 ? 1 : -1;
    sfx("spawn");
  }

  function newEgg(x, y, vx, vy, tier) {
    return { x: x, y: y, vx: vx, vy: vy, tier: tier, ground: false, ledge: null, restT: 0, t: 0 };
  }

  // ---------------------------------------------------------------- game flow
  function resetWorld() {
    G.enemies = []; G.eggs = []; G.hatchlings = []; G.pickups = []; G.pteros = []; G.loose = [];
    G.particles = []; G.popups = []; G.spawnQ = []; G.hand = null; G.bridges = true; G.burnT = 0;
    G.message = null; G.overDelay = null; rebuildLedgeLayer();
  }

  function makePlayer(i) {
    var p = newRider("player", "p" + (i + 1), 0, 0);
    p.idx = i; p.score = 0; p.lives = 5; p.nextLife = EXTRA_LIFE; p.diedThisWave = false;
    p.style = PLAYER_STYLE[i];
    return p;
  }

  function startGame(np) {
    Audio.unlock();
    G.demo = false; G.mode = "playing"; G.numPlayers = np; G.newHigh = false;
    resetWorld();
    G.players = [];
    for (var i = 0; i < np; i++) { var p = makePlayer(i); G.players.push(p); spawnPlayer(p); }
    startWave(1);
    pressed = {}; touch.flapQ = 0;
    updateButtons();
  }

  function startDemo() {
    G.demo = true; G.mode = "attract"; G.numPlayers = 1;
    resetWorld();
    G.players = [makePlayer(0)];
    G.players[0].demo = true;
    spawnPlayer(G.players[0]);
    startWave(1);
    G.message = null;
    music("title");
    updateButtons();
  }

  function toAttract() { startDemo(); }

  // Job Seeker Pro Scout AI splash after every cleared wave and on game over
  var Splash = window.ScoutSplash || null;
  // Soundtrack (games/shared/arcade-music.js + joust/music.js). Follows the mute button.
  var Mus = window.ArcadeMusic || null, Songs = window.JoustSongs || null;
  function music(kind) {
    if (!Mus || !Songs) return;
    if (kind === "title") Mus.play(Songs.title);
    else if (kind === "play") Mus.play(Songs.play[Math.min(Songs.play.length - 1, Math.floor((G.wave - 1) / 4))]);
    else if (kind === "victory") Mus.sting(Songs.victory, Songs.title);
    else if (kind === "over") Mus.sting(Songs.over, Songs.title);
  }
  function waveSplash() {
    if (!Splash || G.demo) { startWave(G.wave + 1); return; }
    G.mode = "splash"; touch.flapHeld = false; updateButtons();
    var p = G.players[0];
    Splash.show({
      kind: "joust", campaign: "joust", tag: "wave" + G.wave, accent: "#ffcc33", glow: "rgba(255,110,20,.32)",
      title: "WAVE " + G.wave + " CLEARED", sub: G.players.map(function (q, i) { return (G.players.length > 1 ? "P" + (i + 1) + " " : "Score ") + q.score; }).join(" \u2022 ") + " \u2022 Lives " + (p ? p.lives : 0),
      contLabel: "Next wave",
      onContinue: function () { G.mode = "playing"; pressed = {}; touch.flapQ = 0; startWave(G.wave + 1); updateButtons(); }
    });
  }
  function overContinue() {
    if (G.mode === "splash") return;
    if (G.overSplash || !Splash) { toAttract(); return; }
    G.overSplash = true; G.mode = "splash"; updateButtons();
    var best = 0; G.players.forEach(function (q) { best = Math.max(best, q.score); });
    Splash.show({
      kind: "joust", campaign: "joust", tag: "gameover", accent: "#ff7a3d", glow: "rgba(255,80,20,.32)",
      title: "GAME OVER", sub: "Score " + best + " \u2022 High " + highScore + " \u2022 Wave " + G.wave,
      contLabel: "Play again",
      onContinue: function () { toAttract(); pressed = {}; touch.flapQ = 0; }
    });
  }

  function gameOver() {
    G.mode = "gameover"; G.overT = 1.2; G.overSplash = false;
    var best = 0;
    G.players.forEach(function (p) { best = Math.max(best, p.score); });
    if (best > highScore) { highScore = best; G.newHigh = true; try { localStorage.setItem("joust.highscore", String(highScore)); } catch (e) {} }
    sfx("gameOver");
    music("over");
    updateButtons();
  }

  function togglePause() {
    if (G.mode === "playing") { G.mode = "paused"; }
    else if (G.mode === "paused") { G.mode = "playing"; pressed = {}; touch.flapQ = 0; }
    updateButtons();
  }

  function addScore(p, pts, x, y, color) {
    if (!p || p.kind !== "player") return;
    p.score += pts;
    while (p.score >= p.nextLife) { p.nextLife += EXTRA_LIFE; p.lives++; sfx("life"); popup(p.x, p.y - 70, "EXTRA LIFE!", "#7dff8a"); }
    if (x !== undefined) popup(x, y, String(pts), color || "#ffe680");
  }
  function popup(x, y, text, color) { G.popups.push({ x: x, y: y, text: text, color: color || "#fff", t: 1.3 }); }

  // ---------------------------------------------------------------- particles
  function burst(x, y, n, opts) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), s = rand(opts.smin || 40, opts.smax || 220);
      var life = rand(opts.lmin || 0.3, opts.lmax || 0.8);
      G.particles.push({
        x: x, y: y, vx: Math.cos(a) * s + (opts.vx || 0), vy: Math.sin(a) * s + (opts.vy || 0),
        life: life, max: life, color: opts.colors[i % opts.colors.length],
        size: rand(opts.szmin || 1.5, opts.szmax || 3.5), type: opts.type || "spark", grav: opts.grav === undefined ? 300 : opts.grav,
        rot: rand(0, TAU), vr: rand(-8, 8)
      });
    }
  }

  // ---------------------------------------------------------------- controls
  function playerControls(p) {
    if (G.autopilot || p.demo) return autopilot(p);
    var pre = p.idx === 0 ? "p1" : "p2";
    var c = {
      left: actionDown(pre + "Left") || (p.idx === 0 && touch.left),
      right: actionDown(pre + "Right") || (p.idx === 0 && touch.right),
      flap: consume(pre + "Flap")
    };
    if (p.idx === 0 && touch.flapQ > 0) { touch.flapQ = 0; c.flap = true; }
    if (p.idx === 0 && holdFlap && touch.flapHeld) {
      touch.holdT += DT;
      if (touch.holdT >= HOLD_FLAP_INT) { touch.holdT = 0; c.flap = true; }
    }
    return c;
  }

  function nearest(list, p, filter) {
    var best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var o = list[i]; if (filter && !filter(o)) continue;
      var d = Math.hypot(wrapDx(o.x - p.x), (o.y - p.y) * 1.3);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // Simple AI pilot: drives the attract-mode demo and automated tests.
  function autopilot(p) {
    var c = { left: false, right: false, flap: false };
    p.apCD = (p.apCD || 0) - DT;
    var targetY = 300, dir = 0;
    var e = nearest(G.enemies, p, function (o) { return o.state === "fly"; });
    var egg = nearest(G.eggs.concat(G.hatchlings), p);
    var pt = nearest(G.pteros, p, function (o) { return o.state === "fly"; });
    if (pt && Math.abs(wrapDx(pt.x - p.x)) < 220) {
      targetY = pt.y > 260 ? 110 : 420; dir = -sign(wrapDx(pt.x - p.x)) || 1;
    } else if (e && (!egg || Math.hypot(wrapDx(e.x - p.x), e.y - p.y) < Math.hypot(wrapDx(egg.x - p.x), egg.y - p.y) * 1.6)) {
      var dx = wrapDx(e.x - p.x);
      targetY = e.y - 26;
      if (p.y > e.y - 12 && Math.abs(dx) < 90) { dir = -sign(dx) || 1; targetY = e.y - 60; }
      else dir = sign(dx);
    } else if (egg) {
      dir = Math.abs(wrapDx(egg.x - p.x)) > 6 ? sign(wrapDx(egg.x - p.x)) : 0;
      targetY = egg.y + 4;
    } else {
      targetY = 280; dir = p.ai.dir;
      if (Math.random() < 0.004) p.ai.dir *= -1;
    }
    if (overLava(p.x) && targetY > LAVA_Y - 110) targetY = LAVA_Y - 110;
    c.left = dir < 0; c.right = dir > 0;
    var low = p.y > targetY + 4;
    var danger = p.y > LAVA_Y - 80 && overLava(p.x);
    if (p.grab) { if (p.apCD <= 0) { c.flap = true; p.apCD = 0.07; } return c; }
    if (((low && p.vy > -110) || danger) && p.apCD <= 0) { c.flap = true; p.apCD = danger ? 0.06 : 0.11; }
    return c;
  }

  function enemyControls(e) {
    var T = TIERS[e.type], ai = e.ai;
    var c = { left: false, right: false, flap: false };
    e.flapCD -= DT;
    ai.think -= DT;
    ai.cruiseT -= DT;
    if (ai.think <= 0) {
      ai.think = T.think * rand(0.7, 1.4);
      var target = null;
      if (Math.random() < T.seek) target = nearest(G.players, e, function (p) { return p.state === "fly"; });
      if (target) {
        ai.dir = sign(wrapDx(target.x - e.x)) || ai.dir;
        ai.targetY = target.y - T.aim + rand(-20, 20);
      } else {
        if (ai.cruiseT <= 0) { ai.cruiseT = rand(2, 4.5); ai.targetY = [110, 140, 250, 320, 430, 540][Math.floor(Math.random() * 6)]; }
        if (Math.random() < 0.08) ai.dir *= -1;
      }
      ai.targetY = clamp(ai.targetY, 70, LAVA_Y - 90);
    }
    c.left = ai.dir < 0; c.right = ai.dir > 0;
    var danger = (e.y > LAVA_Y - 70 && overLava(e.x)) || e.grab;
    if (e.onGround) {
      ai.groundT -= DT;
      if (ai.groundT <= 0 || e.y > ai.targetY + 60) { c.flap = true; e.flapCD = T.flapInt; ai.groundT = rand(0.3, 1.6); }
    } else if (danger && e.flapCD <= 0) {
      c.flap = true; e.flapCD = e.grab ? rand(0.12, 0.3) : 0.1;
    } else if (e.y > ai.targetY && e.vy > -140 && e.flapCD <= 0) {
      c.flap = true; e.flapCD = T.flapInt * rand(0.8, 1.35);
    }
    return c;
  }

  // ---------------------------------------------------------------- physics
  function speedMul() { return 1 + Math.min(G.wave, 25) * 0.012; }

  function stepRider(r, c, dt) {
    var isP = r.kind === "player";
    var maxRun = isP ? 178 : TIERS[r.type].maxRun * speedMul();
    var maxAir = isP ? 215 : TIERS[r.type].maxAir * speedMul();
    var dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    r.wingT = Math.max(0, r.wingT - dt);
    r.clashT = Math.max(0, r.clashT - dt);

    if (r.grab) {
      if (c.flap) {
        r.grab.escape++; r.y -= 5; r.wingT = 0.22;
        sfx(isP ? "flap" : "eflap");
        burst(r.x, r.y, 4, { colors: ["#ffb347", "#ff6a00"], smin: 30, smax: 90, lmin: 0.2, lmax: 0.5, grav: -60 });
      }
      return;
    }
    if (isP && (dir || c.flap) && r.inv > 0.25) r.inv = 0.25;

    if (c.flap) {
      r.vy = Math.max(r.vy - FLAP, MAXUP);
      if (r.onGround) r.vy = Math.min(r.vy, -150);
      r.wingT = 0.22; r.onGround = false; r.ledge = null; r.skid = false;
      if (dir) { r.vx += dir * 48; r.face = dir; }
      if (isP) sfx("flap"); else if (Math.random() < 0.35) sfx("eflap");
    }

    if (r.onGround) {
      if (dir) {
        if (r.vx * dir < -30) {
          if (!r.skid && Math.abs(r.vx) > 60 && isP) sfx("skid");
          r.skid = true;
          r.vx += dir * 600 * dt;
          if (Math.random() < 0.6) G.particles.push({ x: r.x - r.face * 6, y: r.y - 1, vx: -r.vx * 0.2 + rand(-20, 20), vy: rand(-60, -20), life: 0.35, max: 0.35, color: "#c9a27a", size: rand(1.5, 3), type: "dust", grav: 120, rot: 0, vr: 0 });
        } else {
          r.skid = false; r.face = dir;
          r.vx += dir * 430 * dt;
        }
      } else {
        r.skid = false;
        var f = 110 * dt;
        r.vx = Math.abs(r.vx) <= f ? 0 : r.vx - sign(r.vx) * f;
      }
      r.vx = clamp(r.vx, -maxRun, maxRun);
      var prevPhase = r.legPhase;
      r.legPhase += Math.abs(r.vx) * dt * 0.085;
      if (isP && Math.floor(prevPhase / Math.PI) !== Math.floor(r.legPhase / Math.PI) && Math.abs(r.vx) > 20) sfx("step", Math.floor(r.legPhase / Math.PI) % 2);
    } else {
      if (dir) { r.vx += dir * 80 * dt; r.face = dir; }
      r.vx = clamp(r.vx, -maxAir, maxAir);
      r.vy = Math.min(r.vy + GRAV * dt, TERM);
      r.legPhase += dt * 6;
    }
    moveRider(r, dt);
  }

  function supported(x0, L, m) {
    for (var o = -1; o <= 1; o++) {
      var x = x0 + o * W;
      if (x >= L.x - m && x <= L.x + L.w + m) return true;
    }
    return false;
  }

  function moveRider(r, dt) {
    var py = r.y;
    r.x = wrapX(r.x + r.vx * dt);
    var Ls = ledges();
    if (r.onGround) {
      if (!r.ledge || Ls.indexOf(r.ledge) < 0 || !supported(r.x, r.ledge, 6)) { r.onGround = false; r.ledge = null; }
      else { r.y = r.ledge.y; r.vy = 0; }
    } else {
      r.y += r.vy * dt;
    }
    if (r.y - RH < 0) { r.y = RH; if (r.vy < 0) r.vy = Math.abs(r.vy) * 0.35; }
    for (var i = 0; i < Ls.length; i++) {
      var L = Ls[i];
      for (var o = -1; o <= 1; o++) {
        var x = r.x + o * W;
        if (x + RHW <= L.x || x - RHW >= L.x + L.w) continue;
        if (!r.onGround && r.vy >= 0 && py <= L.y + 0.5 && r.y >= L.y && x >= L.x - 6 && x <= L.x + L.w + 6) {
          r.y = L.y; r.vy = 0; r.onGround = true; r.ledge = L;
          if (r.kind === "player" && Math.abs(r.vx) > 5) sfx("step", 1);
          continue;
        }
        if (r.y <= L.y + 0.01 || r.y - RH >= L.y + L.h) continue;
        if (r.onGround && r.ledge === L) continue;
        if (r.vy < 0 && py - RH >= L.y + L.h - 1) {
          r.y = L.y + L.h + RH; r.vy = Math.abs(r.vy) * 0.35;
          continue;
        }
        // side hit: push out and rebound
        var leftSide = x < L.x + L.w / 2;
        r.x = wrapX((leftSide ? L.x - RHW - 0.5 : L.x + L.w + RHW + 0.5) - o * W);
        r.vx = -r.vx * 0.55;
        if (Math.abs(r.vx) < 25) r.vx = leftSide ? -25 : 25;
      }
    }
  }

  // ---------------------------------------------------------------- combat
  function killRider(r, killer, how) {
    if (r.state === "dead" || r.state === "out") return;
    var isP = r.kind === "player";
    r.state = "dead"; r.grab = null;
    var cols = isP ? ["#ffd23f", "#fff4b8", "#ffffff", "#ff9f1c"] : [TIERS[r.type].armor, TIERS[r.type].armorHi, "#6b8f5e", "#ffffff"];
    if (how !== "lava") {
      burst(r.x, r.y - 30, 26, { colors: cols, smin: 60, smax: 260, lmin: 0.3, lmax: 0.9 });
      burst(r.x, r.y - 30, 10, { colors: isP ? ["#f3e2a8", "#e8b230"] : ["#3d5f3a", "#6b8f5e"], type: "feather", smin: 30, smax: 120, lmin: 0.8, lmax: 1.6, grav: 60, szmin: 3, szmax: 6 });
      G.loose.push({ x: r.x, y: r.y, vx: (r.face || 1) * (isP ? 230 : 210), vy: -60, face: r.face || 1, mount: isP ? r.style.mount : "buzzard", t: 0, wing: 0 });
    } else {
      burst(r.x, LAVA_Y, 30, { colors: ["#ffe066", "#ff9f1c", "#ff4d00", "#fff"], smin: 60, smax: 240, vy: -120, lmin: 0.4, lmax: 1 });
      sfx("sizzle");
    }
    G.shake = Math.max(G.shake, isP ? 0.35 : 0.18);
    if (isP) {
      sfx("die");
      r.lives--; r.diedThisWave = true;
      r.respawnT = 2.2;
      if (r.lives <= 0) r.state = "out";
      if (killer && killer.kind === "player" && killer !== r) {
        addScore(killer, 2000, r.x, r.y - 40, "#9be0ff");
        if (G.waveKind === "gladiator" && !G.gladiatorDone) { G.gladiatorDone = true; addScore(killer, 3000); popup(viewCX(), 260, "GLADIATOR BONUS 3000", "#ffe066"); sfx("bonus"); }
      }
    } else {
      var idx = G.enemies.indexOf(r);
      if (idx >= 0) G.enemies.splice(idx, 1);
      sfx("defeat");
      if (how !== "lava") {
        G.eggs.push(newEgg(r.x, r.y - 14, r.vx * 0.8, Math.min(r.vy, 0) - 80, r.type));
        if (killer) addScore(killer, TIERS[r.type].pts, r.x, r.y - 50);
      }
    }
  }

  function collideRiders() {
    var all = G.players.filter(function (p) { return p.state === "fly"; }).concat(G.enemies.filter(function (e) { return e.state === "fly"; }));
    for (var i = 0; i < all.length; i++) {
      for (var j = i + 1; j < all.length; j++) {
        var a = all[i], b = all[j];
        if (a.state !== "fly" || b.state !== "fly") continue;
        var dx = wrapDx(b.x - a.x), dy = b.y - a.y;
        if (Math.abs(dx) >= 30 || Math.abs(dy) >= 42) continue;
        var aP = a.kind === "player", bP = b.kind === "player";
        if (!aP && !bP) {
          if (a.clashT <= 0) { var s = sign(dx) || 1; a.vx = -s * 90; b.vx = s * 90; a.clashT = b.clashT = 0.3; }
          continue;
        }
        if ((aP && a.inv > 0) || (bP && b.inv > 0)) continue;
        if (Math.abs(dy) <= TIE) {
          if (a.clashT > 0 || b.clashT > 0) continue;
          var s2 = sign(dx) || 1;
          a.vx = -s2 * 150; b.vx = s2 * 150;
          a.vy = Math.min(a.vy, 0) - 40; b.vy = Math.min(b.vy, 0) - 40;
          a.onGround = b.onGround = false; a.ledge = b.ledge = null;
          a.clashT = b.clashT = 0.25;
          var mx = a.x + dx / 2, my = (a.y + b.y) / 2 - 32;
          burst(mx, my, 16, { colors: ["#ffffff", "#fff4b8", "#9fd8ff"], smin: 80, smax: 300, lmin: 0.15, lmax: 0.4, grav: 200, szmin: 1, szmax: 2.5 });
          G.flash = 0.12;
          sfx("clash");
        } else {
          var winner = a.y < b.y ? a : b, loser = winner === a ? b : a;
          killRider(loser, winner, "joust");
          winner.vy = Math.min(winner.vy, -60);
        }
      }
    }
  }

  // ---------------------------------------------------------------- eggs
  function hatchTime() { return Math.max(3.5, 8.5 - G.wave * 0.25); }

  function stepEggs(dt) {
    var Ls = ledges();
    for (var i = G.eggs.length - 1; i >= 0; i--) {
      var g = G.eggs[i];
      g.t += dt;
      var py = g.y;
      if (!g.ground) {
        g.vy = Math.min(g.vy + GRAV * dt, TERM);
        g.x = wrapX(g.x + g.vx * dt); g.y += g.vy * dt;
        for (var k = 0; k < Ls.length && !g.ground; k++) {
          var L = Ls[k];
          for (var o = -1; o <= 1; o++) {
            var x = g.x + o * W;
            if (x < L.x - 2 || x > L.x + L.w + 2) continue;
            if (g.vy >= 0 && py + 9 <= L.y + 1 && g.y + 9 >= L.y) {
              g.y = L.y - 9;
              if (g.vy > 90) { g.vy = -g.vy * 0.38; g.vx *= 0.7; sfx("bounce"); }
              else { g.vy = 0; g.ground = true; g.ledge = L; }
              break;
            } else if (g.y + 9 > L.y && g.y - 9 < L.y + L.h) {
              if (g.vy < 0 && py - 9 >= L.y + L.h - 1) { g.y = L.y + L.h + 9; g.vy = Math.abs(g.vy) * 0.3; }
              else { var left = x < L.x + L.w / 2; g.x = wrapX((left ? L.x - 4 : L.x + L.w + 4) - o * W); g.vx = (left ? -1 : 1) * Math.max(20, Math.abs(g.vx) * 0.5); }
              break;
            }
          }
        }
        if (g.y - 9 < 0) { g.y = 9; g.vy = Math.abs(g.vy) * 0.3; }
      } else {
        g.x = wrapX(g.x + g.vx * dt);
        g.vx *= Math.max(0, 1 - 3.2 * dt);
        if (Math.abs(g.vx) < 4) g.vx = 0;
        if (!g.ledge || Ls.indexOf(g.ledge) < 0 || !supported(g.x, g.ledge, 2)) {
          g.ground = false; g.ledge = null;
        } else if (g.vx === 0) {
          g.restT += dt;
          if (g.restT >= hatchTime()) { hatch(g); G.eggs.splice(i, 1); continue; }
        }
      }
      if (g.y > LAVA_Y + 4) {
        G.eggs.splice(i, 1);
        burst(g.x, LAVA_Y, 10, { colors: ["#ffe066", "#ff7a00"], smin: 30, smax: 140, vy: -80, lmin: 0.3, lmax: 0.7 });
        sfx("sizzle");
        continue;
      }
      for (var pi = 0; pi < G.players.length; pi++) {
        var p = G.players[pi];
        if (p.state !== "fly") continue;
        if (Math.abs(wrapDx(g.x - p.x)) < 24 && g.y > p.y - RH - 6 && g.y < p.y + 10) {
          collectEgg(g, p);
          G.eggs.splice(i, 1);
          break;
        }
      }
    }
  }

  function eggPoints() { var v = [250, 500, 750, 1000][Math.min(G.eggCombo, 3)]; G.eggCombo++; return v; }

  function collectEgg(g, p) {
    var pts = eggPoints();
    var air = !g.ground && !p.onGround;
    addScore(p, pts, g.x, g.y - 20, "#fff2b0");
    if (air) { addScore(p, 500); popup(g.x, g.y - 44, "MID-AIR CATCH +500", "#9be0ff"); }
    burst(g.x, g.y, 12, { colors: ["#fffbe6", "#ffe680", "#ffffff"], smin: 40, smax: 160, lmin: 0.2, lmax: 0.5, grav: 80 });
    sfx("egg", G.eggCombo - 1);
  }

  function hatch(g) {
    sfx("hatch");
    burst(g.x, g.y, 10, { colors: ["#fffbe6", "#f1e4c3"], type: "shell", smin: 40, smax: 130, lmin: 0.5, lmax: 0.9, szmin: 2, szmax: 4 });
    G.hatchlings.push({ x: g.x, y: g.ledge ? g.ledge.y : g.y + 9, ledge: g.ledge, tier: NEXT_TIER[g.tier], t: 0, face: Math.random() < 0.5 ? -1 : 1, called: false });
  }

  function stepHatchlings(dt) {
    var Ls = ledges();
    for (var i = G.hatchlings.length - 1; i >= 0; i--) {
      var h = G.hatchlings[i];
      h.t += dt;
      if (h.ledge && Ls.indexOf(h.ledge) < 0) { G.hatchlings.splice(i, 1); sfx("sizzle"); continue; }
      if (h.t > 0.6 && h.ledge) {
        h.x = wrapX(h.x + h.face * 22 * dt);
        if (!h.ledge.bridge && (h.x < h.ledge.x + 6 || h.x > h.ledge.x + h.ledge.w - 6)) { h.face *= -1; h.x = clamp(h.x, h.ledge.x + 6, h.ledge.x + h.ledge.w - 6); }
      }
      if (!h.called && h.t > 2.2) {
        h.called = true;
        var fromLeft = h.x > W / 2;
        G.pickups.push({ x: fromLeft ? -40 : W + 40, y: rand(80, 300), target: h, face: fromLeft ? 1 : -1, wing: 0 });
      }
      for (var pi = 0; pi < G.players.length; pi++) {
        var p = G.players[pi];
        if (p.state !== "fly") continue;
        if (Math.abs(wrapDx(h.x - p.x)) < 22 && Math.abs(h.y - p.y) < 30) {
          addScore(p, eggPoints(), h.x, h.y - 30, "#fff2b0");
          burst(h.x, h.y - 8, 14, { colors: ["#ffffff", "#ffe680"], smin: 40, smax: 160, lmin: 0.2, lmax: 0.5 });
          sfx("egg", G.eggCombo - 1);
          G.hatchlings.splice(i, 1);
          break;
        }
      }
    }
    for (var j = G.pickups.length - 1; j >= 0; j--) {
      var b = G.pickups[j];
      b.wing += dt * 9;
      if (G.hatchlings.indexOf(b.target) < 0) {
        b.x += b.face * 240 * dt; b.y -= 40 * dt;
        if (b.x < -60 || b.x > W + 60) G.pickups.splice(j, 1);
        continue;
      }
      var tx = b.target.x, ty = b.target.y - 6;
      var dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
      var sp = 230 * speedMul();
      if (d < 10) {
        var e = newRider("enemy", b.target.tier, tx, b.target.y - 1);
        e.state = "fly"; e.vy = -120; e.face = b.face; e.onGround = false;
        G.enemies.push(e);
        G.hatchlings.splice(G.hatchlings.indexOf(b.target), 1);
        G.pickups.splice(j, 1);
        sfx("eflap");
        continue;
      }
      b.x += dx / d * sp * dt; b.y += dy / d * sp * dt; b.face = dx < 0 ? -1 : 1;
    }
  }

  // ---------------------------------------------------------------- pterodactyl
  function spawnPtero() {
    var fromLeft = Math.random() < 0.5;
    G.pteros.push({ x: fromLeft ? -50 : W + 50, y: rand(120, 420), vx: (fromLeft ? 1 : -1) * 250 * speedMul(), vy: 0, face: fromLeft ? 1 : -1, t: 0, state: "fly", entered: false });
    sfx("screech");
    popup(viewCX(), 110, "PTERODACTYL!", "#ff8a7a");
  }

  function stepPteros(dt) {
    for (var i = G.pteros.length - 1; i >= 0; i--) {
      var pt = G.pteros[i];
      pt.t += dt;
      if (pt.state === "dead") {
        pt.vy += GRAV * dt; pt.y += pt.vy * dt; pt.x += pt.vx * 0.3 * dt;
        if (pt.y > H + 40) G.pteros.splice(i, 1);
        continue;
      }
      var target = nearest(G.players, pt, function (p) { return p.state === "fly"; });
      var ty = target ? target.y - 30 : 300;
      ty += Math.sin(pt.t * 2.2) * 50;
      ty = clamp(ty, 70, LAVA_Y - 70);
      pt.vy += clamp(ty - pt.y, -1, 1) * 520 * dt;
      pt.vy *= Math.max(0, 1 - 1.6 * dt);
      pt.vy = clamp(pt.vy, -230, 230);
      if (target && pt.entered && Math.random() < 0.004) { pt.face = sign(wrapDx(target.x - pt.x)) || pt.face; pt.vx = pt.face * Math.abs(pt.vx); }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      var leaving = G.phase === "clear" || G.mode === "gameover";
      if (!pt.entered && pt.x > 0 && pt.x < W && !leaving) pt.entered = true;
      if (leaving) pt.entered = false;
      if (pt.entered) pt.x = wrapX(pt.x);
      else if (pt.x < -90 || pt.x > W + 90) { G.pteros.splice(i, 1); continue; }
      if (Math.random() < 0.006) sfx("screech");
      for (var pi = 0; pi < G.players.length; pi++) {
        var p = G.players[pi];
        if (p.state !== "fly" || p.inv > 0) continue;
        var dx = wrapDx(p.x - pt.x);
        var lanceY = p.y - 33;
        if (Math.abs(dx) < 46 && lanceY > pt.y - 28 && p.y - RH < pt.y + 22) {
          var mouthOpen = Math.sin(pt.t * 7) > -0.2;
          var inFront = sign(dx) === pt.face;
          if (inFront && p.face === -pt.face && Math.abs(lanceY - (pt.y - 2)) < 13 && mouthOpen) {
            pt.state = "dead"; pt.vy = -120;
            burst(pt.x, pt.y, 40, { colors: ["#ffffff", "#ffe066", "#ff8a3d", "#b18cff"], smin: 80, smax: 320, lmin: 0.4, lmax: 1.1 });
            addScore(p, 1000, pt.x, pt.y - 30, "#ffb3ff");
            sfx("pteroDie"); G.shake = 0.4; G.flash = 0.2;
          } else {
            killRider(p, null, "ptero");
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- lava troll
  function stepHand(dt) {
    var h = G.hand;
    if (!h) {
      if (G.bridges) return;
      var riders = G.players.concat(G.enemies);
      for (var i = 0; i < riders.length; i++) {
        var r = riders[i];
        if (r.state !== "fly" || r.inv > 0) continue;
        if (r.y > LAVA_Y - 46 && overLava(r.x) && Math.random() < 3.0 * dt) {
          G.hand = { x: r.x, y: LAVA_Y + 40, state: "rise", target: r, t: 0, escape: 0, need: Math.min(5 + Math.floor(G.wave / 3), 11) };
          sfx("troll");
          burst(r.x, LAVA_Y, 14, { colors: ["#ffe066", "#ff7a00", "#ff3d00"], smin: 30, smax: 150, vy: -100, lmin: 0.3, lmax: 0.8 });
          return;
        }
      }
      return;
    }
    h.t += dt;
    var r2 = h.target;
    if (h.state === "rise") {
      h.x = wrapX(h.x + clamp(wrapDx(r2.x - h.x), -260 * dt, 260 * dt));
      h.y -= 380 * dt;
      if (h.y <= r2.y + 6) {
        if (r2.state === "fly" && Math.abs(wrapDx(r2.x - h.x)) < 26 && r2.y > LAVA_Y - 80) {
          h.state = "hold"; r2.grab = h; r2.vx = 0; r2.vy = 0; r2.onGround = false; h.y = r2.y;
        } else { h.state = "sink"; }
      }
      if (h.y < LAVA_Y - 90) h.state = "sink";
    } else if (h.state === "hold") {
      if (r2.state !== "fly" || r2.grab !== h) { h.state = "sink"; r2.grab = null; return; }
      h.y += 34 * dt;
      r2.y = clamp(r2.y, h.y - 4, h.y); r2.x = h.x;
      if (h.escape >= h.need) {
        h.state = "sink"; r2.grab = null; r2.vy = -170; r2.y -= 6;
        if (r2.kind === "player") popup(r2.x, r2.y - 70, "ESCAPED!", "#7dff8a");
      } else if (r2.y > LAVA_Y + 12) {
        h.state = "sink"; r2.grab = null; killRider(r2, null, "lava");
      }
      h.y = Math.max(h.y, r2.y);
    } else {
      h.y += 200 * dt;
      if (h.y > LAVA_Y + 60) G.hand = null;
    }
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    if (G.mode === "paused" || G.mode === "splash") return;
    G.time += dt;
    updateCamera(dt);
    G.shake = Math.max(0, G.shake - dt);
    G.flash = Math.max(0, G.flash - dt);
    if (G.message) { G.message.t -= dt; if (G.message.t <= 0) G.message = null; }
    if (G.mode === "gameover") { G.overT -= dt; if (G.overT <= -1.6 && !G.overSplash) overContinue(); }

    if (G.burnT > 0) {
      G.burnT -= dt;
      [BRIDGE_L, BRIDGE_R].forEach(function (B) {
        for (var k = 0; k < 3; k++) G.particles.push({ x: rand(B.x, B.x + B.w), y: B.y + rand(0, B.h), vx: rand(-20, 20), vy: rand(-140, -40), life: 0.8, max: 0.8, color: ["#ffe066", "#ff9f1c", "#ff4d00"][k], size: rand(2, 4), type: "ember", grav: -40, rot: 0, vr: 0 });
      });
      if (G.burnT <= 0) {
        [BRIDGE_L, BRIDGE_R].forEach(function (B) {
          for (var k = 0; k < 24; k++) G.particles.push({ x: rand(B.x, B.x + B.w), y: B.y + rand(0, B.h), vx: rand(-40, 40), vy: rand(-80, 20), life: 1.4, max: 1.4, color: ["#7a4a2a", "#a0643a", "#ff7a00"][k % 3], size: rand(3, 6), type: "shell", grav: 500, rot: rand(0, TAU), vr: rand(-6, 6) });
        });
        G.bridges = false; rebuildLedgeLayer(); G.shake = 0.3;
      }
    }

    for (var q = G.spawnQ.length - 1; q >= 0; q--) {
      G.spawnQ[q].at -= dt;
      if (G.spawnQ[q].at <= 0) { spawnEnemy(G.spawnQ[q].type); G.spawnQ.splice(q, 1); }
    }

    G.players.forEach(function (p) {
      if (p.state === "out") return;
      if (p.state === "dead") { p.respawnT -= dt; if (p.respawnT <= 0) spawnPlayer(p); return; }
      if (p.state === "spawn") { p.spawnT -= dt; if (p.spawnT <= 0) p.state = "fly"; return; }
      p.inv = Math.max(0, p.inv - dt);
      stepRider(p, playerControls(p), dt);
      if (p.y > LAVA_Y + 8 && !p.grab) killRider(p, null, "lava");
    });
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (e.state === "spawn") { e.spawnT -= dt; if (e.spawnT <= 0) e.state = "fly"; continue; }
      stepRider(e, enemyControls(e), dt);
      if (e.y > LAVA_Y + 8 && !e.grab && e.state === "fly") killRider(e, null, "lava");
    }
    collideRiders();
    stepEggs(dt);
    stepHatchlings(dt);
    stepPteros(dt);
    stepHand(dt);

    for (var l = G.loose.length - 1; l >= 0; l--) {
      var m = G.loose[l];
      m.t += dt; m.wing += dt * 10;
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vy += (m.y > 200 ? -260 : 120) * dt;
      if (m.x < -80 || m.x > W + 80 || m.t > 6) G.loose.splice(l, 1);
    }

    for (var k = G.particles.length - 1; k >= 0; k--) {
      var pa = G.particles[k];
      pa.life -= dt;
      if (pa.life <= 0) { G.particles.splice(k, 1); continue; }
      pa.vy += pa.grav * dt;
      if (pa.type === "feather") { pa.vx *= 1 - 1.5 * dt; pa.vy = Math.min(pa.vy, 50); pa.x += Math.sin(pa.life * 6) * 20 * dt; }
      pa.x += pa.vx * dt; pa.y += pa.vy * dt; pa.rot += pa.vr * dt;
    }
    if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
    if (Math.random() < 14 * dt) {
      var ex = rand(0, W);
      if (ex < BASE.x || ex > BASE.x + BASE.w) G.particles.push({ x: ex, y: LAVA_Y + rand(0, 8), vx: rand(-15, 15), vy: rand(-90, -30), life: 1.2, max: 1.2, color: Math.random() < 0.5 ? "#ffb347" : "#ff6a00", size: rand(1, 2.4), type: "ember", grav: -10, rot: 0, vr: 0 });
    }
    for (var u = G.popups.length - 1; u >= 0; u--) { G.popups[u].t -= dt; G.popups[u].y -= 30 * dt; if (G.popups[u].t <= 0) G.popups.splice(u, 1); }

    if (G.mode !== "gameover" && G.phase !== "clear" && G.wave >= 2) {
      G.pteroT -= dt;
      if (G.pteroT <= 0) {
        var maxPt = G.waveKind === "ptero" && G.wave >= 15 ? 2 : 1;
        if (G.pteros.filter(function (p) { return p.state === "fly"; }).length < maxPt) spawnPtero();
        G.pteroT = G.waveKind === "ptero" ? 14 : 34;
      }
    }

    if (G.phase === "intro") { G.phaseT -= dt; if (G.phaseT <= 0) G.phase = "play"; }
    if (G.phase === "play" && G.spawnQ.length === 0 && G.enemies.length === 0 && G.eggs.length === 0 && G.hatchlings.length === 0 && G.pickups.length === 0) {
      G.phase = "clear"; G.phaseT = 2.2;
      if (G.waveKind === "survival") {
        G.players.forEach(function (p) { if (!p.diedThisWave && p.state !== "out") { addScore(p, 3000); popup(viewCX(), 300 + p.idx * 40, (G.numPlayers > 1 ? "P" + (p.idx + 1) + " " : "") + "SURVIVAL BONUS 3000", "#7dff8a"); sfx("bonus"); } });
      }
      G.message = { title: "WAVE " + G.wave + " CLEARED", sub: "", t: 2.0 };
    }
    if (G.phase === "clear" && G.mode !== "gameover") { G.phaseT -= dt; if (G.phaseT <= 0) { if (G.demo) startWave(G.wave + 1); else waveSplash(); return; } }

    if (G.mode === "playing" && G.players.length && G.players.every(function (p) { return p.state === "out"; })) {
      if (G.overDelay === null) G.overDelay = 1.8;
      G.overDelay -= dt;
      if (G.overDelay <= 0) { G.overDelay = null; gameOver(); }
    }
    if (G.mode === "attract" && G.players[0] && G.players[0].state === "out") startDemo();
  }

  // ---------------------------------------------------------------- render setup
  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var K = 1;                   // device pixels per logical unit
  // Phone portrait: a following camera shows a VW-wide slice of the arena so riders are drawn bigger.
  var VW = W, CAM = false, VW_MIN = 520;
  function viewCX() { return CAM ? wrapX(G.camX + VW / 2) : W / 2; }
  function updateCamera(dt) {
    if (!CAM) { G.camX = 0; return; }
    var p = G.players[0], tx;
    if (p && (p.state === "fly" || p.state === "spawn")) tx = p.x + clamp(p.vx * 0.35, -90, 90) - VW / 2;
    else tx = G.camX === undefined ? (W - VW) / 2 : G.camX;
    if (G.camX === undefined || G.camSnap) { G.camX = wrapX(tx); G.camSnap = false; return; }
    var d = wrapDx(wrapX(tx) - G.camX);
    G.camX = wrapX(G.camX + d * Math.min(1, dt * 4.5));
  }
  var bgLayer = document.createElement("canvas");
  var ledgeLayer = document.createElement("canvas");
  var glowCache = {};

  function glowSprite(color) {
    if (glowCache[color]) return glowCache[color];
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.35, color.replace(/,\s*[\d.]+\)$/, ",0.3)")); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache[color] = c; return c;
  }
  function glowAt(g, x, y, r, color) { g.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2); }
  function glow(x, y, r, color) { glowAt(ctx, x, y, r, color); }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  function rebuildBg() {
    bgLayer.width = Math.round(W * K); bgLayer.height = canvas.height;
    var g = bgLayer.getContext("2d");
    g.setTransform(K, 0, 0, K, 0, 0);
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#07040f"); gr.addColorStop(0.55, "#120a1f"); gr.addColorStop(0.85, "#2a0d10"); gr.addColorStop(1, "#3d0f08");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var rnd = mulberry(7);
    for (var i = 0; i < 140; i++) {
      var x = rnd() * W, y = rnd() * 520, s = rnd() * 1.3 + 0.3;
      g.fillStyle = "rgba(255,255,255," + (0.15 + rnd() * 0.5).toFixed(2) + ")";
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    g.fillStyle = "#170b17";
    g.beginPath(); g.moveTo(0, H);
    // frequencies are whole multiples of the arena width so the skyline tiles across the wrap seam
    var j0 = rnd() * 10;
    for (var x2 = 0; x2 <= W; x2 += 24) g.lineTo(x2, 560 + Math.sin(x2 * 2 * TAU / W) * 30 + Math.sin(x2 * 6 * TAU / W) * 14 + (x2 === 0 || x2 === W ? j0 : rnd() * 10));
    g.lineTo(W, H); g.closePath(); g.fill();
    var vg = g.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H * 0.45, 720);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
    if (!CAM) { g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  }

  function ledgePath(g, L, rnd) {
    var x = L.x, y = L.y, w = L.w, h = L.h;
    g.beginPath();
    g.moveTo(x, y + 3);
    g.quadraticCurveTo(x, y, x + 3, y);
    g.lineTo(x + w - 3, y); g.quadraticCurveTo(x + w, y, x + w, y + 3);
    if (L.base) { g.lineTo(x + w, H); g.lineTo(x, H); }
    else {
      g.lineTo(x + w, y + h);
      var n = Math.max(3, Math.floor(w / 16));
      for (var i = n - 1; i >= 1; i--) {
        var px = x + (w * i) / n;
        var drop = rnd() * (L.bridge ? 4 : 16) * (i % 2 ? 1 : 0.35);
        g.lineTo(px, y + h + drop);
      }
      g.lineTo(x, y + h);
    }
    g.closePath();
  }

  function rebuildLedgeLayer() {
    ledgeLayer.width = Math.round(W * K); ledgeLayer.height = canvas.height;
    var g = ledgeLayer.getContext("2d");
    g.setTransform(K, 0, 0, K, 0, 0);
    ledges().forEach(function (L, idx) {
      var rnd = mulberry(31 + idx * 17 + (L.bridge ? 900 : 0));
      g.save();
      ledgePath(g, L, rnd);
      var gr = g.createLinearGradient(0, L.y, 0, L.base ? H : L.y + L.h + 16);
      if (L.bridge) { gr.addColorStop(0, "#c98a4b"); gr.addColorStop(1, "#5a3218"); }
      else { gr.addColorStop(0, "#b87745"); gr.addColorStop(0.25, "#8a5230"); gr.addColorStop(1, "#3a1d10"); }
      g.fillStyle = gr; g.fill();
      g.clip();
      for (var i = 0; i < L.w * (L.base ? 1.6 : 0.5); i++) {
        var tx = L.x + rnd() * L.w, ty = L.y + 4 + rnd() * (L.base ? 110 : L.h + 14);
        g.fillStyle = rnd() < 0.5 ? "rgba(255,210,160,0.10)" : "rgba(30,10,0,0.25)";
        g.beginPath(); g.ellipse(tx, ty, 1 + rnd() * 4, 0.8 + rnd() * 2, rnd() * 3, 0, TAU); g.fill();
      }
      if (L.bridge) {
        g.strokeStyle = "rgba(60,30,10,0.6)"; g.lineWidth = 1.2;
        for (var bx = L.x + 12; bx < L.x + L.w; bx += 18) { g.beginPath(); g.moveTo(bx, L.y + 2); g.lineTo(bx, L.y + L.h); g.stroke(); }
      }
      g.restore();
      g.fillStyle = L.bridge ? "#f0c08a" : "#f2b277";
      g.fillRect(L.x + 2, L.y, L.w - 4, 2.2);
      g.fillStyle = "rgba(255,240,210,0.55)";
      g.fillRect(L.x + 4, L.y, L.w - 8, 0.9);
      if (L.base && !CAM) {
        var py = L.y + 22;
        g.fillStyle = "rgba(10,4,2,0.55)";
        roundRect(g, L.x + 22, py, L.w - 44, 44, 8); g.fill();
        g.strokeStyle = "rgba(255,190,120,0.35)"; g.lineWidth = 1.5;
        roundRect(g, L.x + 22, py, L.w - 44, 44, 8); g.stroke();
      }
      if (L.pad) {
        var cx = L.x + L.w / 2;
        var pg = g.createLinearGradient(0, L.y - 1, 0, L.y + 6);
        pg.addColorStop(0, "#f4f7ff"); pg.addColorStop(0.5, "#8d9ab8"); pg.addColorStop(1, "#3b4258");
        g.fillStyle = pg;
        roundRect(g, cx - 34, L.y - 1, 68, 7, 2); g.fill();
        g.fillStyle = "rgba(20,30,60,0.6)";
        for (var s = -28; s <= 26; s += 8) g.fillRect(cx + s, L.y + 1.5, 4, 3);
      }
    });
  }

  // ---------------------------------------------------------------- sprites
  var MOUNTS = {
    ostrich: { body: "#f2c230", bodyLo: "#a8740f", wing: "#d9a21c", wingLo: "#8f5f0a", leg: "#ff9a2e", neck: "#f7d35a", head: "#f7d35a", beak: "#ff8c1a", long: true },
    stork: { body: "#eef3fb", bodyLo: "#97a6bd", wing: "#cfdcef", wingLo: "#6f819e", leg: "#ff6f5e", neck: "#f5f8fd", head: "#f5f8fd", beak: "#ff7a3d", long: true },
    buzzard: { body: "#4b7a52", bodyLo: "#1f3a24", wing: "#355c3b", wingLo: "#13261a", leg: "#d8c25a", neck: "#c98b7a", head: "#d19a88", beak: "#f0d27a", long: false }
  };

  // Draw a mount (and optional rider) facing right with the origin at its feet.
  function drawMount(g, mk, opts) {
    var M = MOUNTS[mk];
    var flying = opts.flying, wingUp = opts.wing || 0;
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = M.leg; g.lineWidth = 2.6;
    var hipX = -2, hipY = -21;
    for (var leg = 0; leg < 2; leg++) {
      var fx, fy, kx, ky;
      if (flying) { fx = -12 - leg * 3; fy = -12 + leg * 2; kx = -4 - leg * 2; ky = -10; }
      else if (opts.skid) { fx = 10 + leg * 4; fy = 0; kx = 5 + leg * 2; ky = -9; }
      else {
        var ph = (opts.leg || 0) + leg * Math.PI;
        var a = Math.sin(ph);
        var lift = Math.max(0, Math.cos(ph)) * (opts.moving ? 5 : 0);
        fx = hipX + a * (opts.moving ? 12 : 2) + (leg ? 2 : -1); fy = -lift; kx = hipX + a * 6 - 4; ky = -10 - lift * 0.4;
      }
      g.globalAlpha = leg ? 1 : 0.75;
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.beginPath(); g.moveTo(fx - 2, fy); g.lineTo(fx + 5, fy); g.moveTo(fx, fy); g.lineTo(fx + 3, fy - 2.5); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = M.wingLo;
    g.beginPath();
    if (mk === "buzzard") { g.moveTo(-12, -31); g.lineTo(-27, -27); g.lineTo(-25, -23); g.lineTo(-28, -20); g.lineTo(-12, -22); }
    else { g.moveTo(-13, -32); g.quadraticCurveTo(-28, -42, -27, -30); g.quadraticCurveTo(-30, -24, -14, -23); }
    g.closePath(); g.fill();
    var bg = g.createLinearGradient(0, -38, 0, -16);
    bg.addColorStop(0, M.body); bg.addColorStop(1, M.bodyLo);
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(-1, -27, 15, 9.5, -0.08, 0, TAU); g.fill();
    if (M.long) {
      g.strokeStyle = M.neck; g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(10, -30); g.quadraticCurveTo(17, -36, 15, -47); g.stroke();
      g.fillStyle = M.head; g.beginPath(); g.ellipse(17, -49, 5, 4, 0.2, 0, TAU); g.fill();
      g.fillStyle = M.beak; g.beginPath(); g.moveTo(20, -51); g.lineTo(29, -48.5); g.lineTo(20.5, -46.5); g.closePath(); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(17.6, -50, 1.6, 0, TAU); g.fill();
      g.fillStyle = "#111"; g.beginPath(); g.arc(18, -50, 0.8, 0, TAU); g.fill();
    } else {
      g.strokeStyle = M.neck; g.lineWidth = 4;
      g.beginPath(); g.moveTo(10, -31); g.quadraticCurveTo(17, -33, 20, -37); g.stroke();
      g.fillStyle = M.head; g.beginPath(); g.ellipse(21, -39, 5, 4.2, 0.1, 0, TAU); g.fill();
      g.fillStyle = M.beak; g.beginPath(); g.moveTo(24, -41.5); g.quadraticCurveTo(31, -41, 30, -36); g.lineTo(27, -38); g.lineTo(24.5, -37.5); g.closePath(); g.fill();
      g.fillStyle = "#ff3030"; g.beginPath(); g.arc(21.8, -40, 1.4, 0, TAU); g.fill();
      glowAt(g, 21.8, -40, 4, "rgba(255,40,40,0.8)");
    }
    if (opts.rider) drawKnight(g, opts.rider, opts);
    var ang = flying ? (-1.15 + (1 - wingUp) * 1.75) : 0.12;
    g.save();
    g.translate(1, -31);
    g.rotate(ang);
    var wg = g.createLinearGradient(-20, 0, 6, 0);
    wg.addColorStop(0, M.wingLo); wg.addColorStop(1, M.wing);
    g.fillStyle = wg;
    g.beginPath();
    if (flying) { g.moveTo(5, -2); g.quadraticCurveTo(-6, -8, -24, -5); g.lineTo(-20, -1); g.lineTo(-26, 1); g.lineTo(-19, 3.5); g.lineTo(-23, 6); g.quadraticCurveTo(-8, 7, 5, 3); }
    else { g.moveTo(6, -1); g.quadraticCurveTo(-4, -5, -18, 1); g.lineTo(-14, 3); g.lineTo(-19, 5); g.quadraticCurveTo(-6, 8, 6, 3); }
    g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(-18, 1); g.stroke();
    g.restore();
  }

  function drawKnight(g, st, opts) {
    var bob = opts.flying ? 0 : Math.sin((opts.leg || 0) * 2) * (opts.moving ? 0.8 : 0);
    g.save();
    g.translate(0, bob);
    g.strokeStyle = st.armor; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(-3, -36); g.lineTo(2, -30); g.lineTo(1, -25); g.stroke();
    g.strokeStyle = "#e9e3d2"; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(-13, -42.5); g.lineTo(31, -44); g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(31, -46); g.lineTo(37, -44.2); g.lineTo(31, -42.2); g.closePath(); g.fill();
    glowAt(g, 36, -44, 6, "rgba(255,255,230,0.75)");
    var tg = g.createLinearGradient(-9, 0, 4, 0);
    tg.addColorStop(0, st.armor); tg.addColorStop(0.6, st.armorHi); tg.addColorStop(1, st.armor);
    g.fillStyle = tg;
    roundRect(g, -8.5, -52, 10, 17, 3); g.fill();
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(-8.5, -40, 10, 2);
    g.strokeStyle = st.armor; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-2, -48); g.lineTo(3, -44); g.stroke();
    var hg = g.createRadialGradient(-4, -59, 1, -3, -57, 7);
    hg.addColorStop(0, st.armorHi); hg.addColorStop(1, st.armor);
    g.fillStyle = hg;
    g.beginPath(); g.arc(-3, -57, 6, 0, TAU); g.fill();
    g.fillStyle = "#14101a"; g.fillRect(-1, -58.5, 5.5, 2);
    g.strokeStyle = st.plume; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-4, -63); g.quadraticCurveTo(-11, -68, -15, -60); g.stroke();
    g.fillStyle = st.armor;
    g.beginPath(); g.moveTo(-12, -49); g.lineTo(-5, -49); g.lineTo(-5, -42); g.quadraticCurveTo(-8.5, -37, -12, -42); g.closePath(); g.fill();
    g.strokeStyle = st.armorHi; g.lineWidth = 0.9; g.stroke();
    g.restore();
  }

  function drawWrapped(x, fn) {
    fn(x);
    if (x < 60) fn(x + W);
    if (x > W - 60) fn(x - W);
  }

  function drawRider(r) {
    var st = r.kind === "player" ? r.style : TIERS[r.type];
    var mk = r.kind === "player" ? st.mount : "buzzard";
    var flying = !r.onGround || !!r.grab;
    var wing = r.wingT > 0 ? Math.sin((r.wingT / 0.22) * Math.PI) : (flying ? 0.35 + Math.sin(G.time * 3 + r.x) * 0.05 : 0);
    drawWrapped(r.x, function (x) {
      ctx.save();
      ctx.translate(x, r.y);
      if (r.state === "spawn") {
        var k = 1 - r.spawnT;
        ctx.globalCompositeOperation = "lighter";
        var col = r.kind === "player" ? "rgba(255,240,150,0.9)" : "rgba(160,220,255,0.9)";
        glow(0, -30, 46, col);
        ctx.fillStyle = col.replace("0.9", "0.22");
        ctx.fillRect(-18, -80 + k * 30, 36, 80 - k * 30);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = clamp(k * 1.4, 0.15, 1);
      }
      if (r.kind === "player" && r.inv > 0 && r.state === "fly") ctx.globalAlpha = 0.55 + Math.sin(G.time * 30) * 0.35;
      if (r.kind === "enemy" && r.type === "shadow") { ctx.globalCompositeOperation = "lighter"; glow(0, -36, 34, "rgba(60,120,255,0.55)"); ctx.globalCompositeOperation = "source-over"; }
      if (RSCALE !== 1) ctx.scale(RSCALE, RSCALE);
      ctx.scale(r.face, 1);
      drawMount(ctx, mk, { flying: flying, wing: wing, leg: r.legPhase, moving: Math.abs(r.vx) > 8, skid: r.skid, rider: st });
      ctx.restore();
    });
  }

  function drawEgg(g) {
    var wob = 0;
    if (g.ground && g.restT > hatchTime() - 1.6) wob = Math.sin(G.time * 28) * 0.25;
    drawWrapped(g.x, function (x) {
      ctx.save();
      ctx.translate(x, g.y);
      ctx.rotate(wob + (g.ground ? 0 : g.t * 6));
      var eg = ctx.createRadialGradient(-3, -4, 1, 0, 0, 11);
      eg.addColorStop(0, "#ffffff"); eg.addColorStop(0.6, "#f3ead2"); eg.addColorStop(1, "#b9a77d");
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.ellipse(0, 0, 7.2, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(120,90,50,0.45)";
      ctx.beginPath(); ctx.arc(2, -2, 1.1, 0, TAU); ctx.arc(-2.5, 3, 0.9, 0, TAU); ctx.arc(3, 4, 0.8, 0, TAU); ctx.fill();
      if (wob) { ctx.strokeStyle = "rgba(60,40,20,0.7)"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-6, -1); ctx.lineTo(-2, 1); ctx.lineTo(1, -2); ctx.lineTo(5, 0); ctx.stroke(); }
      ctx.restore();
    });
  }

  function drawHatchling(h) {
    var st = TIERS[h.tier];
    drawWrapped(h.x, function (x) {
      ctx.save();
      ctx.translate(x, h.y);
      ctx.scale(h.face * 0.85 * RSCALE, 0.85 * RSCALE);
      var step = Math.sin(G.time * 12) * 3;
      ctx.strokeStyle = st.armor; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-1, -12); ctx.lineTo(-3 + step, 0); ctx.moveTo(1, -12); ctx.lineTo(3 - step, 0); ctx.stroke();
      ctx.fillStyle = st.armor; roundRect(ctx, -5, -26, 10, 15, 3); ctx.fill();
      ctx.fillStyle = st.armorHi; ctx.beginPath(); ctx.arc(0, -31, 5.5, 0, TAU); ctx.fill();
      ctx.fillStyle = "#14101a"; ctx.fillRect(1, -32.5, 4.5, 2);
      ctx.strokeStyle = st.plume; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1, -36); ctx.quadraticCurveTo(-7, -41, -10, -34); ctx.stroke();
      ctx.strokeStyle = st.armor; ctx.lineWidth = 2.4;
      var wave = Math.sin(G.time * 10) * 4;
      ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(6, -32 + wave); ctx.stroke();
      ctx.restore();
    });
  }

  function drawFreeBuzzard(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.face * RSCALE, RSCALE);
    drawMount(ctx, b.mount || "buzzard", { flying: true, wing: (Math.sin(b.wing) + 1) / 2, leg: 0, moving: false });
    ctx.restore();
  }

  function drawPtero(pt) {
    drawWrapped(pt.x, function (x) {
      ctx.save();
      ctx.translate(x, pt.y);
      if (pt.state === "dead") ctx.rotate(pt.t * 4);
      ctx.scale(pt.face, 1);
      var flap = Math.sin(pt.t * 9);
      var mouth = pt.state === "dead" ? 0 : clamp((Math.sin(pt.t * 7) + 0.2) * 0.8, 0, 1);
      ctx.globalCompositeOperation = "lighter";
      glow(10, 0, 70, "rgba(170,90,255,0.35)");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#3b2a5c";
      ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-30, -26 - flap * 20); ctx.lineTo(-52, -10 - flap * 26); ctx.lineTo(-20, 4); ctx.closePath(); ctx.fill();
      var bg = ctx.createLinearGradient(0, -12, 0, 12);
      bg.addColorStop(0, "#8f6fd6"); bg.addColorStop(1, "#3a2468");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#6c52b0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-36, 4, -46, -2); ctx.stroke();
      ctx.fillStyle = "#6c52b0"; ctx.beginPath(); ctx.moveTo(-46, -2); ctx.lineTo(-54, -7); ctx.lineTo(-52, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#9b7ee6";
      ctx.beginPath(); ctx.moveTo(16, -6); ctx.lineTo(28, -10); ctx.lineTo(22, -18); ctx.lineTo(34, -9); ctx.lineTo(56, -6 - mouth * 4); ctx.lineTo(30, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#8466cc";
      ctx.beginPath(); ctx.moveTo(18, 2); ctx.lineTo(30, 1); ctx.lineTo(54, 3 + mouth * 10); ctx.lineTo(28, 6); ctx.closePath(); ctx.fill();
      if (mouth > 0.2) {
        ctx.fillStyle = "#ff3d6e";
        ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(54, -5 - mouth * 3); ctx.lineTo(52, 2 + mouth * 8); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#ffef5a"; ctx.beginPath(); ctx.arc(28, -6, 2, 0, TAU); ctx.fill();
      glow(28, -6, 6, "rgba(255,240,90,0.9)");
      var wg = ctx.createLinearGradient(0, -40, 0, 10);
      wg.addColorStop(0, "#b49af0"); wg.addColorStop(1, "#4a3380");
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(-16, -34 - flap * 26); ctx.lineTo(-44, -18 - flap * 30); ctx.lineTo(-30, -8 - flap * 10); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(-16, -34 - flap * 26); ctx.stroke();
      ctx.restore();
    });
  }

  // Lava troll hand: big, muscular, segmented fingers with claws, magma veins and drips.
  function drawFinger(g, len, w, ang, curl, t) {
    g.save(); g.rotate(ang);
    var segs = [len * 0.42, len * 0.33, len * 0.25];
    for (var s = 0; s < 3; s++) {
      var L = segs[s], ww = w * (1 - s * 0.16);
      var fg = g.createLinearGradient(-ww / 2, 0, ww / 2, 0);
      fg.addColorStop(0, "#3a0a02"); fg.addColorStop(0.45, s === 2 ? "#e2581c" : "#c2410c"); fg.addColorStop(1, "#3a0a02");
      g.fillStyle = fg;
      roundRect(g, -ww / 2, -L - 1, ww, L + 2, ww * 0.45); g.fill();
      g.fillStyle = "rgba(255,196,110,0.5)";
      g.beginPath(); g.ellipse(0, -1, ww * 0.3, ww * 0.18, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(40,6,0,0.55)"; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(-ww * 0.35, -L * 0.5); g.lineTo(ww * 0.35, -L * 0.5); g.stroke();
      g.translate(0, -L); g.rotate(curl + Math.sin(t * 7 + s + ang * 5) * 0.04);
    }
    g.fillStyle = "#170703";
    g.beginPath(); g.moveTo(-w * 0.32, 1); g.quadraticCurveTo(-w * 0.1, -7, w * 0.15, -9); g.quadraticCurveTo(w * 0.1, -3, w * 0.32, 1); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,230,180,0.6)"; g.fillRect(-0.6, -6, 1.2, 3);
    g.restore();
  }
  function drawHand(h) {
    var t = G.time, closed = h.state === "hold", rising = h.state === "rise";
    var sway = Math.sin(t * 4.2) * 3 * (closed ? 0.4 : 1);
    var x = h.x, top = h.y, px = x + sway * 0.5, py = top + 14;
    var wristY = top + 34, baseY = LAVA_Y + 46, midY = (wristY + baseY) / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    glow(px, py + 10, 90, "rgba(255,90,10,0.5)");
    ctx.globalCompositeOperation = "source-over";
    // forearm: tapered and muscular, swaying up out of the lava
    var ag = ctx.createLinearGradient(x - 28, 0, x + 28, 0);
    ag.addColorStop(0, "#1f0400"); ag.addColorStop(0.28, "#6b1603"); ag.addColorStop(0.55, "#b0360a"); ag.addColorStop(0.8, "#5a1203"); ag.addColorStop(1, "#1f0400");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.moveTo(x - 26, baseY);
    ctx.bezierCurveTo(x - 34 + sway, midY + 26, x - 28 + sway, midY - 14, x - 17 + sway * 0.5, wristY);
    ctx.lineTo(x + 17 + sway * 0.5, wristY);
    ctx.bezierCurveTo(x + 30 + sway, midY - 14, x + 35 + sway, midY + 26, x + 26, baseY);
    ctx.closePath(); ctx.fill();
    // glowing magma veins
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (var v = 0; v < 4; v++) {
      var vx0 = x - 13 + v * 8.5;
      ctx.strokeStyle = "rgba(255," + (150 + v * 20) + ",40," + (0.55 + 0.3 * Math.sin(t * 3 + v)).toFixed(2) + ")";
      ctx.lineWidth = 1.4 + (v % 2) * 0.8;
      ctx.beginPath(); ctx.moveTo(vx0, baseY - 8);
      for (var sgm = 1; sgm <= 6; sgm++) {
        var yy = baseY - 8 - (baseY - wristY - 6) * sgm / 6;
        ctx.lineTo(vx0 * (1 - sgm / 14) + px * (sgm / 14) + Math.sin(sgm * 2.3 + v * 1.9 + t * 1.6) * 4 + sway * sgm / 6 * 0.6, yy);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    // cooled-crust wrist band with hot cracks
    ctx.fillStyle = "#2c0d05"; roundRect(ctx, px - 20, wristY - 4, 40, 10, 4); ctx.fill();
    ctx.strokeStyle = "rgba(255,140,40,0.85)"; ctx.lineWidth = 1;
    ctx.beginPath(); for (var c = 0; c < 5; c++) { var cx = px - 16 + c * 8; ctx.moveTo(cx, wristY - 3); ctx.lineTo(cx + 2, wristY + 1); ctx.lineTo(cx - 1, wristY + 5); } ctx.stroke();
    // palm
    var pg = ctx.createRadialGradient(px - 6, py - 7, 2, px, py, 26);
    pg.addColorStop(0, "#ff9a4a"); pg.addColorStop(0.45, "#cf4a0e"); pg.addColorStop(1, "#430b01");
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(px, py, 21, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(60,10,0,0.45)";
    ctx.beginPath(); ctx.ellipse(px + 2, py + 4, 9, 4, -0.3, 0, TAU); ctx.fill();
    // fingers: open and grasping on the way up, curled tight around a catch
    var spread = [-1.5, -0.5, 0.5, 1.5], lens = [20, 25, 24, 19];
    var flex = rising ? -0.25 - 0.22 * (0.5 + 0.5 * Math.sin(t * 9)) : -0.12;
    for (var i = 0; i < 4; i++) {
      ctx.save(); ctx.translate(px + spread[i] * 9, py - 11);
      drawFinger(ctx, lens[i], 8.5, closed ? spread[i] * 0.12 - 0.15 : spread[i] * 0.26, closed ? -0.95 : flex, t);
      ctx.restore();
    }
    ctx.save(); ctx.translate(px + 19, py - 2);
    drawFinger(ctx, 17, 9, closed ? -0.2 : 0.75, closed ? -1.1 : -0.35, t);
    ctx.restore();
    // molten drips falling back into the lava
    ctx.globalCompositeOperation = "lighter";
    for (var d = 0; d < 4; d++) {
      var ph = ((t * 0.9 + d * 0.27) % 1);
      var dx = px - 14 + d * 9 + Math.sin(d * 3) * 3, dy = py + 14 + ph * (LAVA_Y - py - 6);
      ctx.globalAlpha = 1 - ph;
      ctx.fillStyle = "#ffb347";
      ctx.beginPath(); ctx.ellipse(dx, dy, 2.2, 3.6, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    glow(px, py - 4, closed ? 46 : 38, "rgba(255,120,30,0.45)");
    ctx.restore();
  }

  function drawLava() {
    var t = G.time;
    ctx.save();
    var gr = ctx.createLinearGradient(0, LAVA_Y - 6, 0, H);
    gr.addColorStop(0, "#fff1a6"); gr.addColorStop(0.08, "#ffc233"); gr.addColorStop(0.35, "#ff6a00"); gr.addColorStop(1, "#6b0e00");
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 8) ctx.lineTo(x, LAVA_Y + Math.sin(x * 5 * TAU / W + t * 2) * 2.5 + Math.sin(x * 11 * TAU / W - t * 3.1) * 1.8);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 14; i++) {
      var sx = (i * 97 + t * (18 + (i % 4) * 9)) % (W + 120) - 60;
      var sy = LAVA_Y + 10 + (i % 5) * 9 + Math.sin(t * 2 + i) * 2;
      ctx.fillStyle = "rgba(255,230,120," + (0.12 + 0.1 * Math.sin(t * 3 + i * 1.7)).toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(sx, sy, 26 + (i % 3) * 10, 2.2, 0, 0, TAU); ctx.fill();
    }
    var hg = ctx.createLinearGradient(0, LAVA_Y - 110, 0, LAVA_Y + 4);
    var pulse = 0.22 + Math.sin(t * 1.7) * 0.05;
    hg.addColorStop(0, "rgba(255,80,0,0)"); hg.addColorStop(1, "rgba(255,90,10," + pulse.toFixed(3) + ")");
    ctx.fillStyle = hg; ctx.fillRect(0, LAVA_Y - 110, W, 114);
    ctx.restore();
  }

  function drawPadGlows() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    pads().forEach(function (p, i) {
      var a = 0.25 + Math.sin(G.time * 2.2 + i) * 0.1;
      glow(p.x, p.y + 2, 46, "rgba(140,190,255," + a.toFixed(3) + ")");
    });
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      var a = clamp(p.life / p.max, 0, 1);
      if (p.type === "spark" || p.type === "ember") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
        if (p.size > 2.2) { ctx.globalAlpha = a * 0.5; glow(p.x, p.y, p.size * 3.5, "rgba(255,200,120,0.7)"); }
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.type === "feather") { ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, TAU); ctx.fill(); }
        else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function text(str, x, y, size, color, align, glowCol, font) {
    ctx.font = "800 " + size + "px " + (font || FONT);
    ctx.textAlign = align || "center";
    ctx.textBaseline = "middle";
    if (glowCol) { ctx.shadowColor = glowCol; ctx.shadowBlur = size * 0.6 * K; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function drawLifeIcon(x, y, style) {
    ctx.save(); ctx.translate(x, y); ctx.scale(0.36, 0.36);
    drawMount(ctx, style.mount, { flying: false, wing: 0, leg: 0, moving: false, rider: style });
    ctx.restore();
  }

  function drawHud() {
    var py = BASE.y + 44;
    G.players.forEach(function (p, i) {
      var x0 = i === 0 ? BASE.x + 40 : BASE.x + BASE.w / 2 + 20;
      var col = i === 0 ? "#ffd23f" : "#6cc4ff";
      text(pad6(p.score), x0, py, 26, col, "left", col, MONO);
      var n = Math.min(Math.max(p.lives, 0), 7);
      for (var k = 0; k < n; k++) drawLifeIcon(x0 + 122 + k * 15, py + 11, p.style);
      if (p.lives > 7) text("+" + (p.lives - 7), x0 + 122 + 7 * 15, py, 14, col, "left");
    });
    if (G.players.length < 2 && !G.demo) text("WAVE " + G.wave, BASE.x + BASE.w - 44, py, 20, "#ffb37a", "right", null, MONO);
    var hi = highScore;
    if (!G.demo) G.players.forEach(function (p) { hi = Math.max(hi, p.score); });
    text("HIGH " + pad6(hi), W / 2, 22, 18, "#ffe9b0", "center", "rgba(255,200,80,0.8)", MONO);
    if (G.players.length > 1) text("WAVE " + G.wave, W / 2, 44, 14, "#ffb37a", "center", null, MONO);
  }

  // Portrait-camera HUD, in view units (VW x H): score and lives top-left, high score and wave top-centre.
  function drawHudCam() {
    G.players.forEach(function (p, i) {
      var col = i === 0 ? "#ffd23f" : "#6cc4ff", y0 = 24 + i * 50;
      text(pad6(p.score), 14, y0, 22, col, "left", col, MONO);
      var n = Math.min(Math.max(p.lives, 0), 7);
      for (var k = 0; k < n; k++) drawLifeIcon(20 + k * 15, y0 + 30, p.style);
    });
    var hi = highScore;
    if (!G.demo) G.players.forEach(function (p) { hi = Math.max(hi, p.score); });
    var hx = Math.min(VW / 2, VW - 230);
    text("HIGH " + pad6(hi), hx, 20, 15, "#ffe9b0", "center", "rgba(255,200,80,0.8)", MONO);
    if (!G.demo && G.mode !== "attract") text("WAVE " + G.wave, hx, 42, 15, "#ffb37a", "center", null, MONO);
  }
  // Arrows on the view edges point at riders and pterodactyls that are off camera.
  function drawEdgeMarkers() {
    var c = G.camX + VW / 2, t = G.time;
    function mark(x, y, col) {
      var dx = wrapDx(x - wrapX(c));
      if (Math.abs(dx) < VW / 2 + 8) return;
      var right = dx > 0, ex = right ? VW - 7 : 7, ey = clamp(y - 22, 70, H - 70);
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 6 + y);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(ex + (right ? 5 : -5), ey); ctx.lineTo(ex + (right ? -7 : 7), ey - 9); ctx.lineTo(ex + (right ? -7 : 7), ey + 9); ctx.closePath(); ctx.fill();
    }
    if (G.mode !== "attract") {
      G.enemies.forEach(function (e) { if (e.state === "fly" || e.state === "spawn") mark(e.x, e.y, TIERS[e.type] ? TIERS[e.type].armorHi : "#fff"); });
      G.pteros.forEach(function (q) { mark(q.x, q.y, "#ff6a5a"); });
    }
    ctx.globalAlpha = 1;
  }

  function drawTitle() {
    var t = G.time;
    ctx.save();
    ctx.fillStyle = "rgba(4,2,10,0.55)";
    ctx.fillRect(-W, -H, W * 3, H * 3);
    var y = 200;
    ctx.font = "900 150px " + FONT;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var g = ctx.createLinearGradient(0, y - 70, 0, y + 70);
    g.addColorStop(0, "#fff7c2"); g.addColorStop(0.45, "#ffcc33"); g.addColorStop(0.55, "#ff9a1a"); g.addColorStop(1, "#b34700");
    ctx.shadowColor = "rgba(255,150,30,0.85)"; ctx.shadowBlur = (40 + Math.sin(t * 2) * 10) * K;
    ctx.lineWidth = 6; ctx.strokeStyle = "#3a1200";
    ctx.strokeText("JOUST", W / 2, y);
    ctx.fillStyle = g; ctx.fillText("JOUST", W / 2, y);
    ctx.shadowBlur = 0;
    text("A TRIBUTE TO THE 1982 ARCADE CLASSIC", W / 2, y + 90, 18, "#ffd9a8", "center");
    var rows = [["bounder", "BOUNDER", "500"], ["hunter", "HUNTER", "750"], ["shadow", "SHADOW LORD", "1500"]];
    rows.forEach(function (r, i) {
      var ry = 370 + i * 52;
      ctx.save(); ctx.translate(W / 2 - 150, ry + 20); ctx.scale(0.8, 0.8);
      drawMount(ctx, "buzzard", { flying: true, wing: (Math.sin(t * 8 + i) + 1) / 2, leg: 0, rider: TIERS[r[0]] });
      ctx.restore();
      text(r[1], W / 2 - 100, ry, 20, TIERS[r[0]].armorHi, "left");
      text(r[2], W / 2 + 160, ry, 20, "#ffe680", "right", null, MONO);
    });
    text("EGGS 250 \u2022 500 \u2022 750 \u2022 1000      PTERODACTYL 1000", W / 2, 530, 15, "#e9d8ff", "center");
    var blink = Math.sin(t * 5) > -0.3;
    if (blink) text(touch.active ? "TAP TO START" : "PRESS " + keyName(bindings.p1Flap).toUpperCase() + " TO START  \u2022  2 FOR TWO PLAYERS", W / 2, 572, 22, "#ffffff", "center", "rgba(255,255,255,0.7)");
    ctx.restore();
  }

  // One copy of the arena, shifted ox logical units (the camera draws a second copy across the wrap seam).
  function worldPass(ox, sx, sy) {
    ox = Math.round(ox * K) / K;          // whole device pixels, so the wrap seam never shows a hairline
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, ox * K, 0);
    if (CAM) { ctx.beginPath(); ctx.rect(0, 0, Math.ceil(W * K) + 1, H * K); ctx.clip(); }
    ctx.drawImage(bgLayer, 0, 0);
    sx += ox;
    ctx.setTransform(K, 0, 0, K, sx * K, sy * K);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (var s = 0; s < 12; s++) {
      var tw = Math.sin(G.time * (1 + s * 0.3) + s * 2);
      if (tw > 0.7) { ctx.globalAlpha = (tw - 0.7) * 3; ctx.beginPath(); ctx.arc((s * 211) % W, (s * 97) % 480 + 20, 1.6, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    drawLava();
    if (G.hand) drawHand(G.hand);
    ctx.setTransform(1, 0, 0, 1, sx * K, sy * K);
    ctx.drawImage(ledgeLayer, 0, 0);
    ctx.setTransform(K, 0, 0, K, sx * K, sy * K);
    if (G.burnT > 0) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      [BRIDGE_L, BRIDGE_R].forEach(function (B) { ctx.fillStyle = "rgba(255,120,20," + (0.35 + Math.random() * 0.3).toFixed(2) + ")"; ctx.fillRect(B.x, B.y - 4, B.w, B.h + 6); });
      ctx.restore();
    }
    drawPadGlows();
    G.eggs.forEach(drawEgg);
    G.hatchlings.forEach(drawHatchling);
    G.pickups.forEach(function (b) { drawFreeBuzzard({ x: b.x, y: b.y, face: b.face, wing: b.wing, mount: "buzzard" }); });
    G.enemies.forEach(drawRider);
    G.players.forEach(function (p) { if (p.state === "fly" || p.state === "spawn") drawRider(p); });
    G.loose.forEach(drawFreeBuzzard);
    G.pteros.forEach(drawPtero);
    drawParticles();
    G.popups.forEach(function (p) {
      ctx.globalAlpha = clamp(p.t, 0, 1);
      text(p.text, p.x, p.y, 16, p.color, "center", "rgba(0,0,0,0.9)");
      ctx.globalAlpha = 1;
    });
    if (G.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (G.flash * 1.2).toFixed(3) + ")"; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.restore();
  }
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    var sx = 0, sy = 0;
    if (G.shake > 0) { sx = rand(-1, 1) * G.shake * 10; sy = rand(-1, 1) * G.shake * 10; }
    if (!CAM) worldPass(0, sx, sy);
    else {
      ctx.fillStyle = "#07040f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      var cx = G.camX || 0;
      worldPass(-cx, sx, sy);
      if (cx + VW > W) worldPass(W - cx, sx, sy);
    }
    ctx.setTransform(K, 0, 0, K, 0, 0);
    if (CAM) { drawHudCam(); drawEdgeMarkers(); }
    else drawHud();
    // Overlays (title, messages, pause, game over) are laid out for the full 960 arena; in camera
    // mode they are scaled up a little from "fit width" since their content sits near the centre.
    if (CAM) { var os = Math.min(1, VW / W * 1.3); ctx.setTransform(K * os, 0, 0, K * os, (VW / 2 - W / 2 * os) * K, (H - H * os) / 2 * K); }
    if (G.message && G.mode !== "attract") {
      ctx.globalAlpha = clamp(G.message.t * 2, 0, 1);
      text(G.message.title, W / 2, 270, 46, "#ffe066", "center", "rgba(255,150,30,0.9)");
      if (G.message.sub) text(G.message.sub, W / 2, 318, 19, "#ffffff", "center", "rgba(0,0,0,0.9)");
      ctx.globalAlpha = 1;
    }
    if (G.mode === "attract") drawTitle();
    if (G.mode === "paused") {
      ctx.fillStyle = "rgba(4,2,10,0.6)"; ctx.fillRect(-W, -H, W * 3, H * 3);
      text("PAUSED", W / 2, 300, 64, "#ffe066", "center", "rgba(255,150,30,0.9)");
      text(touch.active ? "TAP TO RESUME" : "PRESS " + keyName(bindings.pause).toUpperCase() + " OR ESC TO RESUME", W / 2, 360, 20, "#ffffff", "center");
    }
    if (G.mode === "gameover") {
      ctx.fillStyle = "rgba(4,2,10,0.55)"; ctx.fillRect(-W, -H, W * 3, H * 3);
      text("GAME OVER", W / 2, 260, 72, "#ff6a3d", "center", "rgba(255,80,20,0.9)");
      G.players.forEach(function (p, i) {
        text((G.players.length > 1 ? "P" + (i + 1) + "  " : "SCORE  ") + pad6(p.score), W / 2, 340 + i * 36, 28, i ? "#6cc4ff" : "#ffd23f", "center", null, MONO);
      });
      if (G.newHigh) text("NEW HIGH SCORE!", W / 2, 420, 26, "#7dff8a", "center", "rgba(100,255,120,0.8)");
      if (G.overT <= 0 && Math.sin(G.time * 5) > -0.3) text(touch.active ? "TAP TO CONTINUE" : "PRESS SPACE TO CONTINUE", W / 2, 480, 20, "#ffffff", "center");
    }
  }

  // ---------------------------------------------------------------- layout
  var stage = document.getElementById("stage");
  var wrap = document.getElementById("canvas-wrap");
  var touchEl = document.getElementById("touch");
  var isTouch = params.get("touch") === "1" || ("ontouchstart" in window) || (navigator.maxTouchPoints > 0 && window.matchMedia && matchMedia("(pointer: coarse)").matches);
  if (params.get("touch") === "0") isTouch = false;
  if (isTouch) { document.body.classList.add("is-touch"); touch.active = true; }

  function layout() {
    var portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle("is-portrait", portrait);
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var reserve = (isTouch && portrait) ? 150 : 0;
    // Phone portrait: narrow the view (camera follows the player) until the game fills the width
    // and all spare height, keeping at least ~210 px for thumb controls.
    var wasCam = CAM;
    VW = W; CAM = false;
    if (isTouch && portrait && params.get("cam") !== "0") {
      var want = clamp(H * sw / Math.max(200, sh - 210), VW_MIN, W);
      if (want < W - 40) { VW = Math.round(want); CAM = true; reserve = 210; }
    }
    if (CAM && !wasCam) G.camSnap = true;
    var ah = Math.max(60, sh - reserve), aw = Math.max(80, sw);
    var cw = Math.floor(Math.min(aw, ah * VW / H)), ch = Math.floor(cw * H / VW);
    touchEl.style.height = reserve ? Math.max(reserve, sh - ch) + "px" : "";
    wrap.style.width = cw + "px"; wrap.style.height = ch + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr));
    K = canvas.width / VW;
    rebuildBg(); rebuildLedgeLayer();
    RSCALE = (isTouch && Math.min(window.innerWidth, window.innerHeight) <= 600) ? 1.15 : 1;
    var hint = document.getElementById("rotate-hint");
    if (hint) hint.hidden = !(isTouch && portrait && !hint.dataset.dismissed);
  }
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", function () { setTimeout(layout, 150); });
  window.addEventListener("jsp-banner-ready", layout);

  // ---------------------------------------------------------------- touch
  function bindHold(el, on, off) {
    var active = {};
    el.addEventListener("pointerdown", function (e) {
      e.preventDefault(); Audio.unlock(); active[e.pointerId] = 1;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      el.classList.add("down"); on();
    });
    function up(e) { if (!active[e.pointerId]) return; delete active[e.pointerId]; if (!Object.keys(active).length) { el.classList.remove("down"); off(); } }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up); el.addEventListener("lostpointercapture", up);
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  bindHold(document.getElementById("btn-left"), function () { touch.left = true; touch.active = true; }, function () { touch.left = false; });
  bindHold(document.getElementById("btn-right"), function () { touch.right = true; touch.active = true; }, function () { touch.right = false; });
  bindHold(document.getElementById("btn-flap"), function () {
    touch.active = true;
    if (G.mode === "attract") { startGame(1); return; }
    if (G.mode === "gameover") { if (G.overT <= 0) overContinue(); return; }
    if (G.mode === "paused") { togglePause(); return; }
    if (G.mode !== "playing") return;
    touch.flapQ++; touch.flapHeld = true; touch.holdT = 0;
  }, function () { touch.flapHeld = false; touch.holdT = 0; });

  canvas.addEventListener("pointerdown", function (e) {
    Audio.unlock();
    if (e.pointerType === "touch") touch.active = true;
    if (G.mode === "attract") { e.preventDefault(); startGame(1); }
    else if (G.mode === "gameover" && G.overT <= 0) { e.preventDefault(); overContinue(); }
    else if (G.mode === "paused") { e.preventDefault(); togglePause(); }
  });
  ["touchmove", "gesturestart", "gesturechange"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(".settings-panel")) return;
      e.preventDefault();
    }, { passive: false });
  });
  document.addEventListener("dblclick", function (e) { e.preventDefault(); });
  var rh = document.getElementById("rotate-hint");
  function hideHint() { if (rh) { rh.dataset.dismissed = "1"; rh.hidden = true; } }
  if (rh) { rh.addEventListener("click", hideHint); setTimeout(hideHint, 7000); }
  // iOS Safari only unlocks audio on certain gestures; listen to all of them.
  ["touchend", "click", "pointerup"].forEach(function (ev) { document.addEventListener(ev, function () { Audio.unlock(); }, { passive: true }); });

  // ---------------------------------------------------------------- toolbar & settings
  var btnPause = document.getElementById("btn-pause");
  var btnMute = document.getElementById("btn-mute");
  var btnSettings = document.getElementById("btn-settings");
  var panel = document.getElementById("settings");
  var list = document.getElementById("binding-list");
  var muteCheck = document.getElementById("mute-check");

  function toggleMute() { Audio.unlock(); Audio.setMuted(!Audio.isMuted()); updateButtons(); }
  function updateButtons() {
    var m = Audio.isMuted();
    btnMute.textContent = m ? "\uD83D\uDD07" : "\uD83D\uDD0A";
    btnMute.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    btnMute.setAttribute("aria-pressed", m ? "true" : "false");
    btnPause.textContent = G.mode === "paused" ? "\u25B6" : "\u275A\u275A";
    btnPause.setAttribute("aria-label", G.mode === "paused" ? "Resume" : "Pause");
    btnPause.disabled = !(G.mode === "playing" || G.mode === "paused");
    muteCheck.checked = m;
    if (Mus) Mus.setMuted(m);
  }
  btnMute.addEventListener("click", function () { toggleMute(); btnMute.blur(); });
  btnPause.addEventListener("click", function () { togglePause(); btnPause.blur(); });
  btnSettings.addEventListener("click", function () { openSettings(); });
  document.getElementById("settings-close").addEventListener("click", closeSettings);
  document.getElementById("settings-reset").addEventListener("click", function () { resetBindings(); renderBindings(); });
  muteCheck.addEventListener("change", function (e) { Audio.unlock(); Audio.setMuted(e.target.checked); updateButtons(); });
  var holdCheck = document.getElementById("holdflap-check");
  if (holdCheck) {
    holdCheck.checked = holdFlap;
    holdCheck.addEventListener("change", function (e) { holdFlap = !!e.target.checked; try { localStorage.setItem("joust.holdFlap", holdFlap ? "1" : "0"); } catch (x) {} });
  }
  panel.addEventListener("click", function (e) { if (e.target === panel) closeSettings(); });

  var pausedBySettings = false;
  function settingsOpen() { return !panel.hidden; }
  function openSettings() {
    if (G.mode === "playing") { togglePause(); pausedBySettings = true; }
    rebinding = null; renderBindings(); panel.hidden = false;
    var first = panel.querySelector(".bind-key"); if (first) first.focus();
  }
  function closeSettings() {
    rebinding = null; panel.hidden = true;
    if (pausedBySettings && G.mode === "paused") togglePause();
    pausedBySettings = false; btnSettings.blur();
  }
  function renderBindings() {
    list.innerHTML = "";
    ACTIONS.forEach(function (a) {
      var row = document.createElement("div"); row.className = "bind-row";
      var lab = document.createElement("span"); lab.textContent = a.label;
      var b = document.createElement("button"); b.type = "button"; b.className = "bind-key"; b.dataset.action = a.id;
      b.textContent = rebinding === a.id ? "Press a key\u2026" : keyName(bindings[a.id]);
      if (rebinding === a.id) b.classList.add("listening");
      b.addEventListener("click", function () { rebinding = a.id; renderBindings(); });
      row.appendChild(lab); row.appendChild(b); list.appendChild(row);
    });
  }
  function finishRebind(code) {
    var id = rebinding; rebinding = null;
    if (code !== "Escape") {
      for (var other in bindings) if (other !== id && bindings[other] === code) bindings[other] = bindings[id];
      bindings[id] = code; saveBindings();
    }
    renderBindings();
    var btn = list.querySelector('[data-action="' + id + '"]'); if (btn) btn.focus();
  }

  document.addEventListener("visibilitychange", function () { if (document.hidden && G.mode === "playing") togglePause(); });

  // ---------------------------------------------------------------- loop
  var last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = (ts - last) / 1000; last = ts;
    if (!(dt > 0)) dt = 0;
    fpsT += dt; fpsN++; if (fpsT >= 1) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
    if (dt > 0.1) dt = 0.1;
    acc += dt * G.timeScale;
    var steps = 0;
    while (acc >= DT && steps < 600) { update(DT); acc -= DT; steps++; }
    if (steps >= 600) acc = 0;
    render();
    syncOverlay();
  }
  // Pause / game over / victory buttons: Resume or Play again, plus Main menu (games/shared/game-menu.js)
  var ov = window.ArcadeOverlay ? window.ArcadeOverlay.mount(document.getElementById("canvas-wrap")) : null;
  function syncOverlay() {
    var splashUp = !!(Splash && Splash.isOpen());
    if (Mus) Mus.duck(G.mode === "paused" || splashUp || settingsOpen());
    if (!ov) return;
    if (settingsOpen() || splashUp) ov.hide();
    else if (G.mode === "paused") ov.show({ primary: { label: "\u25B6 Resume", onClick: function () { togglePause(); } } });
    else if (G.mode === "gameover" && G.overT <= 0) ov.show({ primary: { label: "\u21BB Play again", onClick: function () { overContinue(); } } });
    else if (G.mode === "victory" && G.overT <= 0) ov.show({ primary: { label: "\u21BB Play again", onClick: function () { overContinue(); } } });
    else ov.hide();
  }

  layout();
  startDemo();
  updateButtons();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks
  window.__joust = {
    state: function () {
      return {
        mode: G.mode, wave: G.wave, waveKind: G.waveKind, phase: G.phase, bridges: G.bridges, fps: Math.round(fps),
        enemies: G.enemies.length, spawning: G.spawnQ.length, eggs: G.eggs.length, hatchlings: G.hatchlings.length, pteros: G.pteros.length,
        view: { w: VW, cam: CAM, camX: Math.round(G.camX || 0) }, hand: !!G.hand, handState: G.hand ? G.hand.state : null, holdFlap: holdFlap, riderScale: RSCALE, splash: !!(Splash && Splash.isOpen()), highScore: highScore, audio: Audio.state(), muted: Audio.isMuted(), touch: isTouch, music: Mus ? Mus.current : null, overlay: !!(ov && ov.visible),
        players: G.players.map(function (p) { return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, state: p.state, score: p.score, lives: p.lives, inv: p.inv, face: p.face }; }),
        bindings: Object.assign({}, bindings), canvas: { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight }
      };
    },
    start: function (n) { startGame(n || 1); },
    debug: {
      defeatAllEnemies: function () {
        var p = G.players[0];
        G.spawnQ.forEach(function (q) { spawnEnemy(q.type); }); G.spawnQ = [];
        G.enemies.slice().forEach(function (e) { e.state = "fly"; killRider(e, p, "joust"); });
      },
      collectAllEggs: function () {
        var p = G.players[0];
        G.eggs.slice().forEach(function (g) { collectEgg(g, p); });
        G.eggs = []; G.hatchlings = []; G.pickups = [];
      },
      killPlayer: function (i) { var p = G.players[i || 0]; if (p.state === "fly") { p.inv = 0; killRider(p, null, "joust"); } return p.state; },
      setAutopilot: function (b) { G.autopilot = !!b; },
      setTimeScale: function (s) { G.timeScale = s; },
      spawnPtero: spawnPtero,
      skipTo: function (n) { G.enemies = []; G.eggs = []; G.hatchlings = []; G.pickups = []; G.spawnQ = []; startWave(n); },
      lowRider: function () { var p = G.players[0]; p.x = 60; p.y = LAVA_Y - 30; p.vy = 0; p.vx = 0; p.onGround = false; p.inv = 0; p.state = "fly"; }
    }
  };
})();

/*
 * Rampart tribute for the EduAccess arcade. Original code, art and sound.
 * Loop: choose a home castle, place cannons, fight off the fleet, then rebuild the walls
 * with block pieces before time runs out. Enclose a castle or lose a life. 12 levels.
 * Written by: Howie
 */
(function () {
  "use strict";
  var LV = window.RampartLevels, C = window.RampartCore, R = window.RampartRender, AU = window.RampartAudio, K = window.VKit;
  var TILE = R.TILE, MAX_LEVEL = 12, MAX_CANNONS = 16;
  var DEBUG = K.DEBUG;
  function $(id) { return document.getElementById(id); }
  var canvas = $("game"), ctx = canvas.getContext("2d"), wrap = $("wrap"), stage = $("stage"), touchEl = $("touch");
  var isTouch = K.isTouch;
  document.body.classList.toggle("is-touch", !!isTouch);
  var touchPref = K.store.get("rampart.touch", "auto");
  function showTouch() { return touchPref === "on" || (touchPref === "auto" && isTouch); }

  // ---------------------------------------------------------------- input (arrows + Space by default, all remappable)
  var ACTIONS = [
    { id: "up", label: "Move / aim up", keys: ["ArrowUp", "KeyW"] },
    { id: "down", label: "Move / aim down", keys: ["ArrowDown", "KeyS"] },
    { id: "left", label: "Move / aim left", keys: ["ArrowLeft", "KeyA"] },
    { id: "right", label: "Move / aim right", keys: ["ArrowRight", "KeyD"] },
    { id: "action", label: "Choose / place / fire", keys: ["Space", "Enter"] },
    { id: "rotate", label: "Rotate wall piece", keys: ["KeyZ", "KeyX"] },
    { id: "pause", label: "Pause", keys: ["KeyP", "Escape"] },
    { id: "mute", label: "Mute", keys: ["KeyM", null] }
  ];
  var settingsOpen = false;
  var input = K.input({
    actions: ACTIONS, storeKey: "rampart.keys",
    onKey: function (e) {
      unlockAudio();
      if (settingsOpen || (window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen())) return false;
    },
    pad: function (gp) {
      var b = function (i) { return !!(gp.buttons[i] && gp.buttons[i].pressed); }, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      return { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5,
        action: b(0) || b(7), rotate: b(1) || b(2) || b(5), pause: b(9) };
    }
  });

  // ---------------------------------------------------------------- persistence
  var highScore = K.store.get("rampart.high", 0) || 0;
  var maxLevel = K.clamp(K.store.get("rampart.maxLevel", 1) || 1, 1, MAX_LEVEL);
  var tipSeen = !!K.store.get("rampart.tipSeen", false);

  // ---------------------------------------------------------------- state
  var G = {
    mode: "title", paused: false, splash: false, level: 1, startLevel: 1, round: 0, spawned: -1, lives: 3, score: 0,
    levelDef: LV.LEVELS[0], map: null, grid: null, castles: [], home: -1, cannons: [], ships: [], balls: [], parts: [], grunts: [],
    timer: 0, cursor: { x: 10, y: 10 }, aim: { x: 10, y: 10 }, piece: null, next: null, cannonsLeft: 0, buildQueue: [],
    banner: null, claimFlash: 0, shake: 0, inputLock: 0, k: 1, t: 0, spawnQ: [], wind: null, demo: true, selIdx: 0,
    hint: "", hintT: 0, newHigh: false, enclosedCount: 0, art: null
  };
  var LW = 1280, LH = 960, HUD = 72;

  // ---------------------------------------------------------------- layout
  var artQ = 0, resizeT = 0;
  function wantPortrait() { return window.innerHeight > window.innerWidth * 1.05; }
  function layout() {
    var portrait = G.grid ? G.grid.rows > G.grid.cols : wantPortrait();
    document.body.classList.toggle("is-portrait", wantPortrait());
    var cols = G.grid ? G.grid.cols : LV.COLS, rows = G.grid ? G.grid.rows : LV.ROWS;
    HUD = portrait ? 124 : 72;
    LW = cols * TILE; LH = rows * TILE + HUD;
    var st = showTouch();
    touchEl.hidden = !st;
    touchEl.classList.toggle("landscape", st && !wantPortrait());
    var r = stage.getBoundingClientRect();
    var aw = Math.max(160, r.width - 4), ah = Math.max(160, r.height - 4);
    var k = Math.min(aw / LW, ah / LH);
    var cw = Math.floor(LW * k), ch = Math.floor(LH * k);
    wrap.style.width = cw + "px"; wrap.style.height = ch + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr));
    G.k = canvas.width / LW;
    var q = K.clamp(Math.round(G.k * 2) / 2, 1, 2);
    if (G.grid && G.art && Math.abs(q - artQ) > 0.3) { artQ = q; R.buildLevelArt(G, artQ); }
  }
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(layout, 120); });
  window.addEventListener("orientationchange", function () { setTimeout(layout, 300); });
  window.addEventListener("jsp-banner-ready", layout);

  // ---------------------------------------------------------------- level setup
  function setupMap(n) {
    G.level = n; G.levelDef = LV.LEVELS[n - 1];
    G.map = LV.buildMap(G.levelDef, wantPortrait());
    G.grid = C.makeGrid(G.map);
    G.castles = G.map.castles; G.home = -1;
    G.cannons = []; G.ships = []; G.balls = []; G.parts = []; G.grunts = []; G.spawnQ = []; G.wx = null;
    G.round = 0; G.spawned = -1;
    G.seaList = []; for (var i = 0; i < G.grid.sea.length; i++) if (G.grid.sea[i]) G.seaList.push(i);
    G.wind = G.levelDef.weather === "storm" ? { x: 0.9, y: 0.35 } : G.levelDef.weather === "breezy" ? { x: 0.25, y: 0.1 } : null;
    G.art = null; layout();
    artQ = K.clamp(Math.round(G.k * 2) / 2, 1, 2); R.buildLevelArt(G, artQ);
    C.computeTerritory(G.grid); G.art.dirty = true;
  }
  // difficulty knobs that scale with the level on top of each level's own fleet and timers
  function diff() {
    var n = G.level - 1;
    return { spd: 1 + n * 0.035, reload: (n === 0 ? 1.25 : 1) * (1 - n * 0.03), scatter: Math.max(0.3, 1.15 - n * 0.07), grunt: Math.max(0.6, 1.3 - n * 0.05) };
  }
  function startGame(level) {
    G.score = 0; G.lives = 3; G.newHigh = false; G.demo = false;
    ov.hide();
    loadLevel(level || 1);
  }
  function loadLevel(n) {
    G.demo = false;
    setupMap(n);
    G.mode = "select"; G.timer = 15; G.selIdx = 0; G.reselected = false;
    banner("LEVEL " + n + ": " + G.levelDef.name.toUpperCase(), G.levelDef.blurb, 3.4);
    hint(isTouch ? "Tap a castle to make it your home" : "Arrows pick a castle. Space (or click) chooses it.");
    music();
  }
  function banner(text, sub, dur) { G.banner = { text: text, sub: sub || "", t: 0, dur: dur || 1.8 }; }
  function hint(s) { G.hint = s; G.hintT = (G.level <= 2 || !tipSeen) ? 7 : 0; }

  // ---------------------------------------------------------------- phases
  function confirmCastle(k) {
    G.home = k; var c = G.castles[k], g = G.grid;
    G.grunts = G.grunts.filter(function (gr) { // sappers standing on the new ring are driven off
      var j = gr.ty * g.cols + gr.tx; if (C.homeRing(g, c).indexOf(j) < 0) return true; g.grunt[j] = 0; return false;
    });
    var ring = C.homeRing(g, c).filter(function (i) { return !g.wall[i] && g.cannon[i] < 0 && !g.grunt[i]; });
    ring.forEach(function (i) { g.crater[i] = 0; g.fire[i] = 0; });
    var cx = c.x + 0.5, cy = c.y + 0.5;
    ring.sort(function (a, b) { return Math.atan2((a / g.cols | 0) - cy, a % g.cols - cx) - Math.atan2((b / g.cols | 0) - cy, b % g.cols - cx); });
    G.buildQueue = ring; G.buildT = 0; G.mode = "raise";
    AU.play("select");
  }
  function enterCannons(first) {
    C.computeTerritory(G.grid); G.art.dirty = true;
    var allow = first ? 3 : C.cannonAllowance(G.grid, G.castles, G.home, false);
    if (G.reselected) { allow = Math.max(allow, 2); G.reselected = false; }
    allow = Math.min(allow, Math.max(0, MAX_CANNONS - G.cannons.length));
    G.cannonsLeft = allow;
    var c = G.castles[G.home] || G.castles[0];
    G.cursor = { x: c.x + 2, y: c.y - 2 };
    var spot = findCannonSpot(G.cursor.x, G.cursor.y);
    if (!spot) allow = G.cannonsLeft = 0; else G.cursor = spot;
    if (allow <= 0) { startBattle(); return; }
    G.mode = "cannons"; G.timer = G.levelDef.cannonT;
    banner("PLACE CANNONS", allow + (allow === 1 ? " cannon" : " cannons") + " to place inside your walls", 1.8);
    hint(isTouch ? "Tap inside your walls to place a cannon" : "Arrows move. Space places a cannon inside your walls.");
    AU.play("bell"); music();
  }
  function findCannonSpot(fx, fy) {
    var g = G.grid, best = null, bd = 1e9;
    for (var y = 0; y < g.rows - 1; y++) for (var x = 0; x < g.cols - 1; x++) {
      if (!C.canPlaceCannon(g, x, y)) continue;
      var d = (x - fx) * (x - fx) + (y - fy) * (y - fy);
      if (d < bd) { bd = d; best = { x: x, y: y }; }
    }
    return best;
  }
  function placeCannon(x, y) {
    var g = G.grid;
    if (G.cannonsLeft <= 0 || !C.canPlaceCannon(g, x, y)) { AU.play("deny"); return false; }
    var cn = { x: x, y: y, ang: -Math.PI / 2, hp: 3, active: true, reload: 0, ball: false, recoil: 0 };
    G.cannons.push(cn); markCannons();
    G.cannonsLeft--;
    AU.play("cannonPlace"); dust(x + 1, y + 1, 10);
    if (G.cannonsLeft > 0) { var s = findCannonSpot(x, y); if (s) G.cursor = s; else G.cannonsLeft = 0; }
    if (G.cannonsLeft <= 0) { G.mode = "cannonsDone"; G.timer = 0.7; }
    return true;
  }
  function markCannons() {
    var g = G.grid; g.cannon.fill(-1);
    G.cannons.forEach(function (cn, k) { for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) g.cannon[(cn.y + dy) * g.cols + cn.x + dx] = k; });
  }
  function startBattle() {
    G.mode = "battle"; G.timer = G.levelDef.battleT; G.battleT = 0;
    var rounds = G.levelDef.rounds;
    if (G.spawned < G.round && G.round < rounds.length) {
      G.spawned = G.round;
      rounds[G.round].forEach(function (type, i) { G.spawnQ.push({ type: type, at: 0.3 + i * 0.9 }); });
    }
    var c = G.castles[G.home]; G.aim = { x: c.x + 1, y: c.y - 4 }; clampAim();
    G.cannons.forEach(function (cn) { cn.reload = 0; cn.ball = false; });
    var armed = G.cannons.filter(function (c2) { return c2.active; }).length;
    banner("BATTLE!", armed ? "" : "No cannons inside your walls: survive the barrage", 1.4);
    hint(isTouch ? "Tap a ship to fire. Hold to keep firing." : "Aim with the arrows or mouse. Space or click fires.");
    AU.play("bell"); music();
  }
  function ceaseFire() { G.mode = "cease"; G.timer = 2.2; banner("CEASE FIRE", "", 1.2); }
  function startRepair() {
    G.mode = "repair"; G.timer = G.levelDef.repairT; G.balls.length = 0;
    G.cannons.forEach(function (cn) { cn.ball = false; });
    G.piece = randomPiece(); G.next = randomPiece();
    G.cursor = repairStart(); clampCursor();
    G.enclosedCount = C.computeTerritory(G.grid); G.art.dirty = true;
    G.lastTick = Math.ceil(G.timer);
    banner("REBUILD!", "Close the walls around a castle", 1.6);
    hint(isTouch ? "Drag the piece, lift to place. ROTATE turns it." : "Arrows move. Space places. " + K.keyName(input.binds.rotate[0]) + " or right-click rotates.");
    AU.play("bell"); music();
  }
  // start the repair cursor on the breach nearest your home castle (or just outside its ring)
  function repairStart() {
    var g = G.grid, c = G.castles[G.home], best = null, bd = 1e9;
    for (var i = 0; i < g.rubble.length; i++) if (g.rubble[i] && !g.wall[i] && C.tileFree(g, i % g.cols, (i / g.cols) | 0)) {
      var d = Math.hypot(i % g.cols - c.x, ((i / g.cols) | 0) - c.y); if (d < bd) { bd = d; best = { x: i % g.cols, y: (i / g.cols) | 0 }; }
    }
    return best || { x: c.x, y: Math.max(0, c.y - 5) };
  }
  function resolve() {
    var g = G.grid, n = C.computeTerritory(g); G.art.dirty = true;
    G.grunts = G.grunts.filter(function (gr) { // sappers trapped inside your walls surrender
      var i = gr.ty * g.cols + gr.tx;
      if (g.enclosed[i]) { g.grunt[i] = 0; addScore(100, gr.tx + 0.5, gr.ty + 0.3); AU.play("capture"); return false; }
      return true;
    });
    for (var i = 0; i < g.crater.length; i++) if (g.crater[i]) g.crater[i]--;
    var owned = 0; G.castles.forEach(function (c) { if (C.castleEnclosed(g, c)) owned++; });
    G.cannons.forEach(function (cn) { cn.active = cannonEnclosed(cn); });
    if (!owned) { lifeLost(); return; }
    var bonus = n * 5 + owned * 250;
    var hc = C.castleEnclosed(g, G.castles[G.home]) ? G.castles[G.home] : G.castles.filter(function (c) { return C.castleEnclosed(g, c); })[0];
    addScore(bonus, hc.x + 1, hc.y - 0.5, "+" + bonus + " territory");
    G.claimFlash = 1; AU.play("claim");
    G.round++;
    var cleared = G.round >= G.levelDef.rounds.length && !liveShips() && !G.spawnQ.length;
    G.mode = "resolve"; G.timer = 1.6; G.after = cleared ? "clear" : "cannons";
    if (!tipSeen && G.round >= 2) { tipSeen = true; K.store.set("rampart.tipSeen", true); }
  }
  function cannonEnclosed(cn) { var g = G.grid; for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) if (!g.enclosed[(cn.y + dy) * g.cols + cn.x + dx]) return false; return true; }
  function liveShips() { return G.ships.filter(function (s) { return !s.sink; }).length; }
  function lifeLost() {
    G.lives--; G.mode = "lifelost"; G.timer = 3;
    AU.play("loseLife"); AU.music("defeat");
  }
  function afterLifeLost() {
    if (G.lives <= 0) { gameOver(); return; }
    showSplash({ tag: "lost-l" + G.level, title: "CASTLE LOST", sub: "Level " + G.level + " \u00b7 " + G.lives + (G.lives === 1 ? " life" : " lives") + " left \u00b7 Score " + G.score, contLabel: "Rebuild" }, function () {
      G.mode = "select"; G.timer = 15; G.reselected = true; G.balls.length = 0;
      G.selIdx = Math.max(0, G.home);
      hint(isTouch ? "Tap a castle to rebuild around it" : "Pick a castle to rebuild around.");
      music();
    });
  }
  function levelClear() {
    var bonus = 1000 * G.level;
    addScore(bonus, G.grid.cols / 2, G.grid.rows / 2, "+" + bonus + " level bonus");
    if (G.level >= maxLevel && G.level < MAX_LEVEL) { maxLevel = G.level + 1; K.store.set("rampart.maxLevel", maxLevel); }
    G.mode = "levelclear"; G.timer = 3.4;
    AU.music("victory");
  }
  function afterLevelClear() {
    if (G.level >= MAX_LEVEL) {
      maxLevel = MAX_LEVEL; K.store.set("rampart.maxLevel", MAX_LEVEL);
      showSplash({ tag: "victory", title: "THE COAST IS SECURED", sub: "All 12 levels held \u00b7 Score " + G.score, contLabel: "Victory!" }, victory);
      return;
    }
    showSplash({ tag: "level" + G.level, title: "LEVEL " + G.level + " HELD", sub: "Score " + G.score + " \u00b7 Next: " + LV.LEVELS[G.level].name, contLabel: "Next level" }, function () { loadLevel(G.level + 1); });
  }
  function victory() {
    updateHigh(); G.mode = "victory"; G.vicT = 0; G.banner = null; G.ships = []; G.balls = [];
    AU.music("victory");
    ov.show({ primary: { label: "Play again", onClick: function () { startGame(1); } }, secondary: { label: "Title screen", onClick: toTitle } });
  }
  function gameOver() {
    updateHigh(); G.mode = "gameover"; G.timer = 2.6; G.overSplash = false;
    ov.show({ primary: { label: "Play again (level " + G.level + ")", onClick: function () { startGame(G.level); } }, secondary: { label: "Title screen", onClick: toTitle } });
  }
  function toTitle() {
    ov.hide(); G.paused = false;
    G.mode = "title"; G.demo = true; G.startLevel = Math.min(G.startLevel, maxLevel);
    setupMap(1); demoSetup(); music();
  }
  function updateHigh() { if (G.score > highScore) { highScore = G.score; G.newHigh = true; K.store.set("rampart.high", highScore); } }
  function addScore(v, x, y, label) {
    G.score += v;
    if (x != null) G.parts.push({ k: "text", s: label || "+" + v, x: x, y: y, z: 0, vz: 18, r0: label ? 22 : 18, c: "255,226,150", age: 0, life: 1.6 });
  }
  function showSplash(opts, cb) {
    var done = function () { G.splash = false; G.inputLock = performance.now() + 350; input.clear(); cb(); };
    if (!window.ScoutSplash || !window.ScoutSplash.show) { done(); return; }
    G.splash = true; music();
    window.ScoutSplash.show({ kind: "rampart", campaign: "rampart", tag: opts.tag, title: opts.title, sub: opts.sub, contLabel: opts.contLabel,
      accent: "#e8c36a", glow: "rgba(232,195,106,.28)", onContinue: done });
  }
  function music() {
    if (G.paused) { AU.music(null); return; }
    var m = G.mode;
    if (G.splash || m === "title") AU.music("title");
    else if (m === "battle" || m === "cease") AU.music("battle");
    else if (m === "select" || m === "raise" || m === "cannons" || m === "cannonsDone" || m === "repair" || m === "resolve") AU.music("build");
    else if (m === "victory") AU.music("victory");
  }
  var audioOn = false;
  function unlockAudio() {
    if (audioOn && AU.state() === "running") return;
    AU.init(); if (!audioOn) { audioOn = true; setTimeout(music, 60); }
  }

  // ---------------------------------------------------------------- pieces and cursors
  function randomPiece() {
    var pool = LV.piecePool(G.level), p = pool[(Math.random() * pool.length) | 0];
    var r = (Math.random() * 4) | 0; for (var i = 0; i < r; i++) p = C.rotate(p);
    return C.normalize(p);
  }
  function clampCursor() {
    var g = G.grid, w = 2, h = 2;
    if (G.mode === "repair" && G.piece) { var s = C.size(G.piece); w = s.w; h = s.h; }
    G.cursor.x = K.clamp(G.cursor.x, 0, g.cols - w); G.cursor.y = K.clamp(G.cursor.y, 0, g.rows - h);
  }
  function clampAim() { var g = G.grid; G.aim.x = K.clamp(G.aim.x, 0.3, g.cols - 0.3); G.aim.y = K.clamp(G.aim.y, 0.3, g.rows - 0.3); }
  function rotatePiece() {
    if (!G.piece) return;
    var s0 = C.size(G.piece), cx = G.cursor.x + s0.w / 2, cy = G.cursor.y + s0.h / 2;
    G.piece = C.rotate(G.piece);
    var s1 = C.size(G.piece);
    G.cursor.x = Math.round(cx - s1.w / 2); G.cursor.y = Math.round(cy - s1.h / 2); clampCursor();
    AU.play("rotate");
  }
  function placePiece() {
    var g = G.grid, before = ownedCount();
    if (!C.placePiece(g, G.piece, G.cursor.x, G.cursor.y)) { AU.play("deny"); return false; }
    AU.play("place");
    G.piece.forEach(function (c) { dust(G.cursor.x + c[0] + 0.5, G.cursor.y + c[1] + 0.5, 2); });
    G.enclosedCount = C.computeTerritory(g); G.art.dirty = true;
    if (ownedCount() > before) { AU.play("claim"); G.claimFlash = 0.8; }
    G.piece = G.next; G.next = randomPiece(); clampCursor();
    return true;
  }
  function ownedCount() { var n = 0; G.castles.forEach(function (c) { if (C.castleEnclosed(G.grid, c)) n++; }); return n; }

  // stepped cursor movement with key repeat
  var rep = { t: 0, dir: null };
  function stepDir(dt) {
    var dirs = ["up", "down", "left", "right"], d = null, hit = null;
    for (var i = 0; i < 4; i++) { if (input.hit(dirs[i])) hit = dirs[i]; if (input.isDown(dirs[i])) d = d || dirs[i]; }
    if (hit) { rep.dir = hit; rep.t = 0.2; return hit; }
    if (d && d === rep.dir) { rep.t -= dt; if (rep.t <= 0) { rep.t = 0.07; return d; } }
    else if (d) { rep.dir = d; rep.t = 0.2; }
    else rep.dir = null;
    return null;
  }
  var DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // ---------------------------------------------------------------- ships
  function spawnShip(type) {
    var def = LV.SHIPS[type], g = G.grid, cand = [];
    G.seaList.forEach(function (i) {
      var x = i % g.cols, y = (i / g.cols) | 0;
      if (x !== 0 && y !== 0 && x !== g.cols - 1 && y !== g.rows - 1) return;
      for (var k = 0; k < G.ships.length; k++) { var s = G.ships[k]; if (Math.abs(s.x - x - 0.5) + Math.abs(s.y - y - 0.5) < 3) return; }
      cand.push(i);
    });
    if (!cand.length) cand = G.seaList.slice();
    if (!cand.length) return;
    var j = cand[(Math.random() * cand.length) | 0], sx = j % g.cols + 0.5, sy = ((j / g.cols) | 0) + 0.5;
    var s2 = { type: type, def: def, x: sx, y: sy, ang: Math.atan2(g.rows / 2 - sy, g.cols / 2 - sx), hp: def.hp, reload: def.reload * (0.4 + Math.random() * 0.5) + 1.2,
      path: [], seed: Math.random() * 100, troops: def.troops || 0, state: def.troops ? "land" : "sail", vis: G.levelDef.weather === "fog" ? 0 : 1, volleys: 0, wakeT: 0, burst: 0, burstT: 0 };
    G.ships.push(s2); planShip(s2);
    if (def.boss) { banner("THE FLAGSHIP!", "Pound it with every cannon", 2.2); AU.play("horn"); }
  }
  function structDist() {
    var g = G.grid, n = g.cols * g.rows, d = new Int16Array(n).fill(999), q = [], i;
    for (i = 0; i < n; i++) if (g.wall[i] || g.cannon[i] >= 0 || (g.castle[i] >= 0 && g.castle[i] === G.home)) { d[i] = 0; q.push(i); }
    for (var h = 0; h < q.length; h++) {
      var c = q[h], x = c % g.cols, y = (c / g.cols) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= g.cols || ay >= g.rows) continue;
        var j = ay * g.cols + ax; if (d[j] > d[c] + 1) { d[j] = d[c] + 1; q.push(j); }
      }
    }
    return d;
  }
  function seaBfs(s) {
    var g = G.grid, n = g.cols * g.rows, dist = new Int16Array(n).fill(-1), par = new Int32Array(n).fill(-1), q = [];
    var st = (s.y | 0) * g.cols + (s.x | 0);
    if (!g.sea[st]) { // drifted onto a shore pixel: start from the nearest sea tile
      var bd = 1e9; G.seaList.forEach(function (i) { var d = Math.abs(i % g.cols + 0.5 - s.x) + Math.abs(((i / g.cols) | 0) + 0.5 - s.y); if (d < bd) { bd = d; st = i; } });
    }
    dist[st] = 0; q.push(st);
    for (var h = 0; h < q.length; h++) {
      var c = q[h], x = c % g.cols, y = (c / g.cols) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= g.cols || ay >= g.rows) continue;
        var j = ay * g.cols + ax; if (!g.sea[j] || dist[j] >= 0) continue;
        if (dx && dy && (!g.sea[y * g.cols + ax] || !g.sea[ay * g.cols + x])) continue; // no corner cutting
        dist[j] = dist[c] + 1; par[j] = c; q.push(j);
      }
    }
    return { dist: dist, par: par, start: st };
  }
  function planShip(s) {
    var g = G.grid, sd = structDist(), b = seaBfs(s), best = -1, bs = 1e9, range = s.def.range;
    var claimed = G.ships.filter(function (o) { return o !== s && o.dest != null && !o.sink; }).map(function (o) { return o.dest; });
    function free(i) { for (var k = 0; k < claimed.length; k++) { var c = claimed[k]; if (Math.abs(c % g.cols - i % g.cols) < 3 && Math.abs(((c / g.cols) | 0) - ((i / g.cols) | 0)) < 3) return false; } return true; }
    G.seaList.forEach(function (i) {
      if (b.dist[i] < 0) return;
      var x = i % g.cols, y = (i / g.cols) | 0, score;
      if (s.state === "leave") { if (x && y && x < g.cols - 1 && y < g.rows - 1) return; score = b.dist[i]; }
      else if (s.state === "land") {
        if (sd[i] > 7 || !landingSpots(x, y).length) return;
        score = b.dist[i] + sd[i] * 2 + Math.random() * 6 + (free(i) ? 0 : 20);
      } else {
        if (sd[i] < 2 || sd[i] > range - 1) return;
        score = b.dist[i] * 0.6 + Math.random() * 8 + (free(i) ? 0 : 40);
      }
      if (score < bs) { bs = score; best = i; }
    });
    if (best < 0) { // nothing in range: head for the sea tile closest to your walls
      if (s.state === "land") s.state = "leave";
      G.seaList.forEach(function (i) { if (b.dist[i] < 0) return; var sc = sd[i] * 3 + b.dist[i] * 0.3; if (sc < bs) { bs = sc; best = i; } });
    }
    s.dest = best; s.path = [];
    for (var c = best; c >= 0 && c !== b.start; c = b.par[c]) s.path.unshift([c % g.cols + 0.5, ((c / g.cols) | 0) + 0.5]);
  }
  function landingSpots(x, y) {
    var g = G.grid, out = [];
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var ax = x + dx, ay = y + dy; if (ax < 0 || ay < 0 || ax >= g.cols || ay >= g.rows) continue;
      var j = ay * g.cols + ax;
      if (g.t[j] === C.LAND && !g.wall[j] && g.castle[j] < 0 && g.cannon[j] < 0 && !g.grunt[j] && !g.enclosed[j]) out.push(j);
    }
    return out;
  }
  function updateShips(dt, firing) {
    var g = G.grid, D = diff();
    for (var k = G.ships.length - 1; k >= 0; k--) {
      var s = G.ships[k];
      if (s.sink) { s.sink += dt / 2.4; if (Math.random() < dt * 8) G.parts.push({ k: "smoke", x: s.x + K.rand(-0.4, 0.4), y: s.y, z: 4, vz: 10, r0: 4, r1: 16, c: "60,56,52", a: 0.5, age: 0, life: 1.8 }); if (s.sink >= 1) G.ships.splice(k, 1); continue; }
      if (G.levelDef.weather === "fog") {
        var near = 99; G.castles.forEach(function (c) { near = Math.min(near, Math.hypot(c.x + 1 - s.x, c.y + 1 - s.y)); });
        G.cannons.forEach(function (c) { near = Math.min(near, Math.hypot(c.x + 1 - s.x, c.y + 1 - s.y)); });
        var want = near < 8 ? 1 : near < 11 ? 0.45 : 0.12; s.vis += (want - s.vis) * Math.min(1, dt * 2);
      }
      var moving = false;
      if (s.path.length) {
        var p = s.path[0], dx = p[0] - s.x, dy = p[1] - s.y, d = Math.hypot(dx, dy);
        if (d < 0.3) s.path.shift();
        else {
          var want2 = Math.atan2(dy, dx), da = Math.atan2(Math.sin(want2 - s.ang), Math.cos(want2 - s.ang));
          s.ang += K.clamp(da, -2.4 * dt, 2.4 * dt);
          var sp = s.def.speed * D.spd * Math.max(0.35, Math.cos(da));
          s.x += Math.cos(s.ang) * sp * dt; s.y += Math.sin(s.ang) * sp * dt; moving = true;
        }
      } else if (s.state === "land") {
        if (!firing) continue;
        var spots = landingSpots(s.x | 0, s.y | 0);
        if (!spots.length) { s.state = "leave"; planShip(s); }
        else {
          while (s.troops > 0 && spots.length) { var j = spots.splice((Math.random() * spots.length) | 0, 1)[0]; addGrunt(j % g.cols, (j / g.cols) | 0); s.troops--; }
          AU.play("horn"); s.state = "leave"; planShip(s);
        }
      } else if (s.state === "leave") {
        var bx = s.x | 0, by = s.y | 0; if (bx <= 0 || by <= 0 || bx >= g.cols - 1 || by >= g.rows - 1) { G.ships.splice(k, 1); continue; }
        planShip(s); if (!s.path.length) { G.ships.splice(k, 1); continue; }
      } else {
        s.ang += Math.sin(G.t * 0.7 + s.seed) * 0.05 * dt;
      }
      s.wakeT -= dt;
      if (moving && s.wakeT <= 0) { s.wakeT = 0.12; G.parts.push({ k: "wake", layer: 0, x: s.x - Math.cos(s.ang) * s.def.len * 0.45, y: s.y - Math.sin(s.ang) * s.def.len * 0.45, r0: 2, r1: 9, age: 0, life: 1.4 }); }
      if (!firing || !s.def.shots || s.state !== "sail") continue;
      if (s.burst > 0) { s.burstT -= dt; if (s.burstT <= 0) { s.burst--; s.burstT = 0.2; shipShoot(s, D); } continue; }
      s.reload -= dt;
      if (s.reload <= 0) {
        if (shipShoot(s, D)) { s.burst = s.def.shots - 1; s.burstT = 0.2; s.volleys++; }
        s.reload = s.def.reload * D.reload * (0.8 + Math.random() * 0.4);
        if (!s.path.length && s.volleys >= 3 && Math.random() < 0.35) { s.volleys = 0; planShip(s); }
      }
    }
  }
  function shipShoot(s, D) {
    var g = G.grid, range = s.def.range, walls = [], guns = [];
    var x0 = Math.max(0, (s.x - range) | 0), x1 = Math.min(g.cols - 1, (s.x + range) | 0), y0 = Math.max(0, (s.y - range) | 0), y1 = Math.min(g.rows - 1, (s.y + range) | 0);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var i = y * g.cols + x; if (Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) > range) continue;
      if (g.wall[i]) walls.push(i); else if (g.cannon[i] >= 0) guns.push(i);
    }
    var t;
    if (guns.length && (Math.random() < 0.3 || !walls.length)) t = guns[(Math.random() * guns.length) | 0];
    else if (walls.length) t = walls[(Math.random() * walls.length) | 0];
    else return false;
    var tx = t % g.cols + 0.5 + K.rand(-1, 1) * D.scatter, ty = ((t / g.cols) | 0) + 0.5 + K.rand(-1, 1) * D.scatter;
    launch(s.x + Math.cos(s.ang) * 0.3, s.y + Math.sin(s.ang) * 0.3, tx, ty, true, s.def.fire);
    AU.play("enemyBoom", { pan: (s.x / g.cols) * 2 - 1 });
    G.parts.push({ k: "flash", x: s.x, y: s.y, r0: 18, age: 0, life: 0.25 });
    G.parts.push({ k: "smoke", x: s.x, y: s.y, z: 2, vz: 8, r0: 4, r1: 14, c: "200,196,186", a: 0.5, age: 0, life: 1.4 });
    return true;
  }
  function launch(x0, y0, x1, y1, enemy, fire, cannon) {
    var d = Math.hypot(x1 - x0, y1 - y0);
    G.balls.push({ x0: x0, y0: y0, x1: x1, y1: y1, t: 0, T: (enemy ? 0.55 : 0.3) + d * (enemy ? 0.1 : 0.045), peak: 18 + d * (enemy ? 9 : 6), enemy: enemy, fire: !!fire, cannon: cannon });
  }
  function sinkShip(s) {
    s.sink = 0.001; s.path = [];
    addScore(s.def.score, s.x, s.y - 0.6);
    AU.play("sink");
    for (var i = 0; i < 14; i++) G.parts.push({ k: "debris", x: s.x + K.rand(-0.6, 0.6), y: s.y + K.rand(-0.4, 0.4), z: K.rand(4, 20), vz: K.rand(10, 40), r0: K.rand(2, 5), c: "90,60,30", age: 0, life: K.rand(0.6, 1.2) });
    G.parts.push({ k: "flash", x: s.x, y: s.y, r0: 46, age: 0, life: 0.5 });
    G.parts.push({ k: "ring", layer: 0, x: s.x, y: s.y, r0: 8, r1: 40, age: 0, life: 1.5 });
  }

  // ---------------------------------------------------------------- sappers (landed troops)
  function addGrunt(tx, ty) {
    var g = G.grid; g.grunt[ty * g.cols + tx] = 1;
    G.grunts.push({ tx: tx, ty: ty, x: tx, y: ty, step: 1 + Math.random(), chip: 0, seed: Math.random() * 10, moving: false });
  }
  function updateGrunts(dt) {
    var g = G.grid, D = diff(), home = G.castles[G.home] || G.castles[0];
    G.grunts.forEach(function (gr) {
      gr.x += (gr.tx - gr.x) * Math.min(1, dt * 6); gr.y += (gr.ty - gr.y) * Math.min(1, dt * 6);
      gr.moving = Math.abs(gr.tx - gr.x) + Math.abs(gr.ty - gr.y) > 0.05;
      gr.step -= dt; if (gr.step > 0) return;
      gr.step = D.grunt * (0.8 + Math.random() * 0.4);
      var hx = home.x + 0.5, hy = home.y + 0.5, cur = Math.abs(gr.tx - hx) + Math.abs(gr.ty - hy), best = null, bd = cur, wall = null;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var ax = gr.tx + d[0], ay = gr.ty + d[1]; if (ax < 0 || ay < 0 || ax >= g.cols || ay >= g.rows) return;
        var j = ay * g.cols + ax, dd = Math.abs(ax - hx) + Math.abs(ay - hy);
        if (g.wall[j]) { if (dd < cur && wall == null) wall = j; return; }
        if (g.t[j] !== C.LAND || g.castle[j] >= 0 || g.cannon[j] >= 0 || g.grunt[j]) return;
        if (dd < bd) { bd = dd; best = j; }
      });
      if (best != null) {
        g.grunt[gr.ty * g.cols + gr.tx] = 0; gr.tx = best % g.cols; gr.ty = (best / g.cols) | 0; g.grunt[best] = 1; gr.chip = 0;
      } else if (wall != null) {
        gr.chip++; AU.play("sapper");
        if (gr.chip >= 5) { breakWall(wall); gr.chip = 0; }
      }
    });
  }
  function breakWall(i) {
    var g = G.grid, x = i % g.cols + 0.5, y = ((i / g.cols) | 0) + 0.5;
    g.wall[i] = 0; g.rubble[i] = 1; G.art.dirty = true;
    for (var k = 0; k < 8; k++) G.parts.push({ k: "debris", x: x + K.rand(-0.3, 0.3), y: y + K.rand(-0.3, 0.3), z: K.rand(2, 10), vz: K.rand(20, 50), r0: K.rand(2, 4), c: "150,144,132", age: 0, life: K.rand(0.5, 1) });
    G.parts.push({ k: "smoke", x: x, y: y, z: 4, vz: 12, r0: 6, r1: 22, c: "170,160,140", a: 0.55, age: 0, life: 1.4 });
  }
  function dust(x, y, n) { for (var k = 0; k < n; k++) G.parts.push({ k: "smoke", x: x + K.rand(-0.5, 0.5), y: y + K.rand(-0.3, 0.3), z: 1, vz: 6, r0: 2, r1: 8, c: "190,176,150", a: 0.35, age: 0, life: 0.8 }); }

  // ---------------------------------------------------------------- player fire
  function fireAt(x, y) {
    var best = null, bd = 1e9;
    G.cannons.forEach(function (cn) {
      if (!cn.active || cn.ball || cn.reload > 0) return;
      var d = Math.hypot(cn.x + 1 - x, cn.y + 1 - y); if (d < bd) { bd = d; best = cn; }
    });
    if (!best) return false;
    var cx = best.x + 1, cy = best.y + 1;
    best.ang = Math.atan2(y - cy, x - cx); best.ball = true; best.recoil = 5;
    var tx = x, ty = y;
    if (G.wind) { var T = 0.3 + Math.hypot(x - cx, y - cy) * 0.045; tx += G.wind.x * T; ty += G.wind.y * T; }
    launch(cx + Math.cos(best.ang) * 0.7, cy + Math.sin(best.ang) * 0.7, tx, ty, false, false, best);
    AU.play("boom", { pan: (cx / G.grid.cols) * 2 - 1 }); AU.play("whistle");
    G.parts.push({ k: "flash", x: cx + Math.cos(best.ang) * 0.75, y: cy + Math.sin(best.ang) * 0.75, r0: 22, age: 0, life: 0.22 });
    G.parts.push({ k: "smoke", x: cx + Math.cos(best.ang) * 0.8, y: cy + Math.sin(best.ang) * 0.8, z: 3, vz: 10, r0: 5, r1: 18, c: "220,214,200", a: 0.55, age: 0, life: 1.3 });
    G.shake = Math.max(G.shake, 1.5);
    return true;
  }
  function updateBalls(dt) {
    for (var k = G.balls.length - 1; k >= 0; k--) {
      var b = G.balls[k]; b.t += dt;
      if (b.t >= b.T) { G.balls.splice(k, 1); land(b); }
    }
  }
  function land(b) {
    var g = G.grid, x = b.x1, y = b.y1, tx = Math.floor(x), ty = Math.floor(y), inb = tx >= 0 && ty >= 0 && tx < g.cols && ty < g.rows;
    var i = inb ? ty * g.cols + tx : -1, water = !inb || g.t[i] === C.WATER;
    if (!b.enemy) {
      if (b.cannon) { b.cannon.ball = false; b.cannon.reload = 0.3; }
      for (var k = 0; k < G.ships.length; k++) {
        var s = G.ships[k]; if (s.sink) continue;
        var dx = x - s.x, dy = y - s.y, c = Math.cos(s.ang), sn = Math.sin(s.ang), lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
        var a = lx / (s.def.len / 2 + 0.3), bb = ly / (s.def.beam / 2 + 0.35);
        if (a * a + bb * bb <= 1) {
          s.hp -= s.def.armor ? 1 - s.def.armor : 1;
          AU.play("hitShip");
          G.parts.push({ k: "flash", x: x, y: y, r0: 30, age: 0, life: 0.35 });
          G.parts.push({ k: "fire", x: x, y: y, r0: 14, age: 0, life: 0.7 });
          for (var q = 0; q < 6; q++) G.parts.push({ k: "debris", x: x, y: y, z: 6, vz: K.rand(20, 50), r0: K.rand(1.5, 3.5), c: "110,74,40", age: 0, life: K.rand(0.4, 0.9) });
          G.parts.push({ k: "smoke", x: x, y: y, z: 6, vz: 12, r0: 5, r1: 20, c: "50,46,42", a: 0.6, age: 0, life: 1.6 });
          if (s.hp <= 0.001) sinkShip(s);
          return;
        }
      }
      if (water) splash(x, y);
      else {
        for (var m = G.grunts.length - 1; m >= 0; m--) {
          var gr = G.grunts[m];
          if (Math.hypot(gr.tx + 0.5 - x, gr.ty + 0.5 - y) < 0.85) { g.grunt[gr.ty * g.cols + gr.tx] = 0; G.grunts.splice(m, 1); addScore(50, gr.tx + 0.5, gr.ty); }
        }
        AU.play("thud"); G.parts.push({ k: "flash", x: x, y: y, r0: 20, age: 0, life: 0.25 }); dust(x, y, 5);
      }
      return;
    }
    if (water) { splash(x, y); return; }
    if (g.wall[i]) {
      breakWall(i); AU.play("impact", { pan: (x / g.cols) * 2 - 1 }); G.shake = Math.max(G.shake, 4);
      if (b.fire) { g.fire[i] = 7; AU.play("fire"); }
    } else if (g.cannon[i] >= 0) {
      var cn = G.cannons[g.cannon[i]];
      cn.hp--; AU.play("impact"); G.shake = Math.max(G.shake, 4);
      G.parts.push({ k: "flash", x: x, y: y, r0: 26, age: 0, life: 0.3 });
      if (cn.hp <= 0) {
        G.cannons.splice(g.cannon[i], 1);
        for (var dy2 = 0; dy2 < 2; dy2++) for (var dx2 = 0; dx2 < 2; dx2++) g.crater[(cn.y + dy2) * g.cols + cn.x + dx2] = 2;
        markCannons(); G.art.dirty = true; AU.play("sink");
        G.parts.push({ k: "flash", x: cn.x + 1, y: cn.y + 1, r0: 50, age: 0, life: 0.5 });
        for (var p = 0; p < 10; p++) G.parts.push({ k: "debris", x: cn.x + 1, y: cn.y + 1, z: 6, vz: K.rand(30, 60), r0: K.rand(2, 4), c: "70,56,40", age: 0, life: K.rand(0.6, 1.1) });
      }
    } else if (g.castle[i] >= 0) {
      AU.play("impact"); G.parts.push({ k: "spark", x: x, y: y, z: 6, vz: 30, age: 0, life: 0.4 }); dust(x, y, 4);
    } else {
      AU.play("thud", { pan: (x / g.cols) * 2 - 1 }); dust(x, y, 5);
      if (g.t[i] === C.LAND && !g.grunt[i]) { g.crater[i] = 2; G.art.dirty = true; }
      if (b.fire && g.t[i] === C.LAND) { g.fire[i] = 6; AU.play("fire"); }
    }
    G.parts.push({ k: "smoke", x: x, y: y, z: 3, vz: 10, r0: 5, r1: 18, c: "120,110,96", a: 0.5, age: 0, life: 1.3 });
  }
  function splash(x, y) {
    AU.play("splash", { pan: (x / G.grid.cols) * 2 - 1 });
    for (var k = 0; k < 9; k++) G.parts.push({ k: "drop", x: x + K.rand(-0.15, 0.15), y: y + K.rand(-0.1, 0.1), z: 2, vz: K.rand(25, 60), r0: K.rand(1, 2.2), age: 0, life: K.rand(0.4, 0.7), grav: 1 });
    G.parts.push({ k: "ring", layer: 0, x: x, y: y, r0: 3, r1: 18, age: 0, life: 0.9 });
  }

  // ---------------------------------------------------------------- title demo
  function demoSetup() {
    var g = G.grid, c = G.castles[0];
    G.home = 0;
    C.homeRing(g, c).forEach(function (i) { g.wall[i] = 1; });
    C.computeTerritory(g);
    var s1 = findCannonSpot(c.x - 2, c.y - 2); if (s1) { G.cannons.push({ x: s1.x, y: s1.y, ang: 0, hp: 3, active: true, reload: 0, recoil: 0 }); markCannons(); }
    var s2 = findCannonSpot(c.x + 2, c.y + 2); if (s2) { G.cannons.push({ x: s2.x, y: s2.y, ang: 0.5, hp: 3, active: true, reload: 0, recoil: 0 }); markCannons(); }
    if (G.castles[1]) { var c1 = G.castles[1]; C.homeRing(g, c1).forEach(function (i, k) { if (k % 5) g.wall[i] = 1; else g.rubble[i] = 1; }); }
    C.computeTerritory(g); G.art.dirty = true;
    ["galleon", "frigate", "brig"].forEach(function (t) { spawnShip(t); });
    G.demoFire = 2;
  }
  function updateDemo(dt) {
    updateShips(dt, false);
    G.demoFire -= dt;
    if (G.demoFire <= 0 && G.ships.length) {
      G.demoFire = 2.5 + Math.random() * 2;
      var s = G.ships[(Math.random() * G.ships.length) | 0];
      var cn = G.cannons[(Math.random() * G.cannons.length) | 0];
      if (cn && !s.sink) {
        cn.ang = Math.atan2(s.y - cn.y - 1, s.x - cn.x - 1);
        G.parts.push({ k: "flash", x: cn.x + 1 + Math.cos(cn.ang) * 0.75, y: cn.y + 1 + Math.sin(cn.ang) * 0.75, r0: 20, age: 0, life: 0.22 });
        G.balls.push({ x0: cn.x + 1, y0: cn.y + 1, x1: s.x + K.rand(-1.5, 1.5), y1: s.y + K.rand(-1.5, 1.5), t: 0, T: 1.2, peak: 80, enemy: false });
      }
    }
    for (var k = G.balls.length - 1; k >= 0; k--) {
      var b = G.balls[k]; b.t += dt;
      if (b.t >= b.T) { G.balls.splice(k, 1); G.parts.push({ k: "ring", layer: 0, x: b.x1, y: b.y1, r0: 3, r1: 18, age: 0, life: 0.9 }); for (var q = 0; q < 6; q++) G.parts.push({ k: "drop", x: b.x1, y: b.y1, z: 2, vz: K.rand(25, 60), r0: 1.5, age: 0, life: 0.6, grav: 1 }); }
    }
    if (G.ships.length < 3 && Math.random() < dt * 0.3) spawnShip(["brig", "frigate", "sloop", "galleon"][(Math.random() * 4) | 0]);
    G.ships.forEach(function (s) { if (!s.path.length && Math.random() < dt * 0.2) { s.state = "sail"; planShip(s); } });
  }

  // ---------------------------------------------------------------- pointer (mouse + touch)
  var ptr = null;
  function toMap(e) {
    var r = canvas.getBoundingClientRect();
    var lx = (e.clientX - r.left) / r.width * LW, ly = (e.clientY - r.top) / r.height * LH;
    return { x: lx / TILE, y: (ly - HUD) / TILE, lx: lx, ly: ly };
  }
  function castleAt(p) {
    for (var k = 0; k < G.castles.length; k++) { var c = G.castles[k]; if (p.x >= c.x - 0.6 && p.x <= c.x + 2.6 && p.y >= c.y - 0.6 && p.y <= c.y + 2.6) return k; }
    return -1;
  }
  function pieceAt(p, touch) {
    var s = C.size(G.piece);
    G.cursor.x = Math.round(p.x - s.w / 2); G.cursor.y = Math.round(p.y - s.h / 2 - (touch ? 1.6 : 0)); clampCursor();
  }
  function blocked() { return G.paused || G.splash || settingsOpen || performance.now() < G.inputLock; }
  canvas.addEventListener("pointerdown", function (e) {
    unlockAudio(); try { canvas.focus({ preventScroll: true }); } catch (x) { /* old browsers */ }
    if (blocked()) return;
    e.preventDefault();
    var p = toMap(e), touch = e.pointerType !== "mouse";
    ptr = { id: e.pointerId, touch: touch, p: p, fireT: 0.35 };
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (e.button === 2) { if (G.mode === "repair") rotatePiece(); ptr = null; return; }
    switch (G.mode) {
      case "title":
        if (maxLevel > 1 && p.ly > LH * 0.63 && p.ly < LH * 0.75) { G.startLevel = p.lx < LW / 2 ? Math.max(1, G.startLevel - 1) : Math.min(maxLevel, G.startLevel + 1); AU.play("move"); ptr = null; return; }
        startGame(G.startLevel); ptr = null; break;
      case "select": var k = castleAt(p); if (k >= 0) { G.selIdx = k; confirmCastle(k); } ptr = null; break;
      case "cannons": G.cursor = { x: Math.floor(p.x - 0.5), y: Math.floor(p.y - 0.5) }; clampCursor(); placeCannon(G.cursor.x, G.cursor.y); ptr = null; break;
      case "battle": G.aim = { x: p.x, y: p.y }; clampAim(); fireAt(G.aim.x, G.aim.y); break;
      case "repair": pieceAt(p, touch); if (!touch) { placePiece(); ptr = null; } break;
      case "gameover": case "victory": break;
      default: ptr = null;
    }
  });
  canvas.addEventListener("pointermove", function (e) {
    if (blocked() || !G.grid) return;
    var p = toMap(e);
    if (ptr && ptr.id === e.pointerId) ptr.p = p;
    else if (e.pointerType !== "mouse") return;
    if (G.mode === "select") { var k = castleAt(p); if (k >= 0) G.selIdx = k; }
    else if (G.mode === "cannons") { G.cursor = { x: Math.floor(p.x - 0.5), y: Math.floor(p.y - 0.5) }; clampCursor(); }
    else if (G.mode === "battle") { G.aim = { x: p.x, y: p.y }; clampAim(); }
    else if (G.mode === "repair" && G.piece) pieceAt(p, ptr && ptr.touch);
  });
  canvas.addEventListener("pointerup", function (e) {
    if (!ptr || ptr.id !== e.pointerId) return;
    if (ptr.touch && G.mode === "repair" && !blocked()) placePiece();
    ptr = null;
  });
  canvas.addEventListener("pointercancel", function () { ptr = null; });
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------- main update
  function update(dt) {
    G.t += dt;
    input.pollPad();
    if (input.hit("mute")) toggleMute();
    if (input.hit("pause") && !G.splash && !settingsOpen) togglePause();
    if (G.paused || G.splash || settingsOpen) { input.clear(); return; }
    if (performance.now() < G.inputLock) input.clear();
    if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
    if (G.hintT > 0) G.hintT -= dt;
    G.claimFlash = Math.max(0, G.claimFlash - dt * 1.2);
    G.shake = Math.max(0, G.shake - dt * 12);
    updateParts(dt);
    var g = G.grid;
    if (g) for (var i = 0; i < g.fire.length; i++) if (g.fire[i] > 0) { g.fire[i] -= dt; if (g.fire[i] <= 0) { g.fire[i] = 0; if (!g.wall[i]) { g.crater[i] = Math.max(g.crater[i], 1); G.art.dirty = true; } } }
    G.cannons.forEach(function (cn) { cn.recoil = Math.max(0, (cn.recoil || 0) - dt * 20); if (cn.reload > 0) cn.reload -= dt; });
    var d, m = G.mode;
    if (m === "title") {
      updateDemo(dt);
      if (input.hit("left") && maxLevel > 1) { G.startLevel = Math.max(1, G.startLevel - 1); AU.play("move"); }
      if (input.hit("right") && maxLevel > 1) { G.startLevel = Math.min(maxLevel, G.startLevel + 1); AU.play("move"); }
      if (input.hit("action")) startGame(G.startLevel);
      input.hit("up"); input.hit("down"); input.hit("rotate");
    } else if (m === "select") {
      G.timer -= dt;
      d = stepDir(dt);
      if (d) { G.selIdx = nearestCastle(G.selIdx, DV[d]); AU.play("move"); }
      if (input.hit("action") || G.timer <= 0) confirmCastle(G.selIdx);
    } else if (m === "raise") {
      G.buildT += dt;
      while (G.buildT > 0.035 && G.buildQueue.length) {
        G.buildT -= 0.035; var j = G.buildQueue.shift(); g.wall[j] = 1; g.rubble[j] = 0; G.art.dirty = true;
        if (G.buildQueue.length % 4 === 0) AU.play("place");
        dust(j % g.cols + 0.5, ((j / g.cols) | 0) + 0.5, 1);
      }
      if (!G.buildQueue.length && G.buildT > 0.5) enterCannons(G.round === 0);
    } else if (m === "cannons") {
      G.timer -= dt;
      d = stepDir(dt);
      if (d) { G.cursor.x += DV[d][0]; G.cursor.y += DV[d][1]; clampCursor(); AU.play("move"); }
      if (input.hit("action")) placeCannon(G.cursor.x, G.cursor.y);
      if (G.timer <= 0 && G.mode === "cannons") startBattle();
    } else if (m === "cannonsDone") {
      G.timer -= dt; if (G.timer <= 0) startBattle();
    } else if (m === "battle" || m === "cease") {
      G.timer -= dt;
      if (m === "battle") {
        G.battleT += dt;
        while (G.spawnQ.length && G.spawnQ[0].at <= G.battleT) spawnShip(G.spawnQ.shift().type);
        var ax = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0), ay = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
        if (ax || ay) { var sp = 13 * dt / (ax && ay ? 1.414 : 1); G.aim.x += ax * sp; G.aim.y += ay * sp; clampAim(); }
        ["up", "down", "left", "right"].forEach(function (a) { input.hit(a); });
        if (input.hit("action")) { fireAt(G.aim.x, G.aim.y); G.autoT = 0.3; }
        else if (input.isDown("action")) { G.autoT = (G.autoT || 0) - dt; if (G.autoT <= 0) { G.autoT = 0.25; fireAt(G.aim.x, G.aim.y); } }
        if (ptr && ptr.touch) { ptr.fireT -= dt; if (ptr.fireT <= 0) { ptr.fireT = 0.35; fireAt(G.aim.x, G.aim.y); } }
        G.cannons.forEach(function (cn) { if (cn.active && !cn.ball) { var wa = Math.atan2(G.aim.y - cn.y - 1, G.aim.x - cn.x - 1), da = Math.atan2(Math.sin(wa - cn.ang), Math.cos(wa - cn.ang)); cn.ang += K.clamp(da, -6 * dt, 6 * dt); } });
        updateGrunts(dt);
        if (G.timer <= 0) ceaseFire();
        else if (!liveShips() && !G.spawnQ.length && G.battleT > 2 && !G.balls.length) { banner("ALL SHIPS SUNK", "", 1.2); G.mode = "cease"; G.timer = 1.6; }
      } else if (G.timer <= 0) startRepair();
      updateShips(dt, m === "battle");
      updateBalls(dt);
      input.hit("rotate");
    } else if (m === "repair") {
      G.timer -= dt;
      d = stepDir(dt);
      if (d) { G.cursor.x += DV[d][0]; G.cursor.y += DV[d][1]; clampCursor(); AU.play("move"); }
      if (input.hit("rotate")) rotatePiece();
      if (input.hit("action")) placePiece();
      var sec = Math.ceil(G.timer);
      if (sec !== G.lastTick && sec <= 5 && sec > 0) { G.lastTick = sec; AU.play("tick", { hi: sec <= 3 }); }
      if (G.timer <= 0) resolve();
      updateShips(dt, false);
    } else if (m === "resolve") {
      G.timer -= dt; if (G.timer <= 0) { if (G.after === "clear") levelClear(); else enterCannons(false); }
    } else if (m === "lifelost") {
      G.timer -= dt; updateShips(dt, false); if (G.timer <= 0) afterLifeLost();
    } else if (m === "levelclear") {
      G.timer -= dt; if (G.timer <= 0) afterLevelClear();
    } else if (m === "gameover") {
      G.timer -= dt; updateShips(dt, false);
      if (G.timer <= 0 && !G.overSplash) {
        G.overSplash = true; ov.hide();
        showSplash({ tag: "gameover", title: "GAME OVER", sub: "Reached level " + G.level + " \u00b7 Score " + G.score + (G.newHigh ? " \u00b7 New high score!" : ""), contLabel: "Continue" }, function () { gameOver(); G.overSplash = true; G.timer = 0; });
      }
      if (input.hit("action") && G.overSplash && G.timer <= 0) startGame(G.level);
    } else if (m === "victory") {
      G.vicT += dt;
      if (Math.random() < dt * 3) firework();
      if (input.hit("action") && G.vicT > 2) startGame(1);
    }
  }
  function nearestCastle(cur, v) {
    var c0 = G.castles[cur], best = cur, bs = 1e9;
    G.castles.forEach(function (c, k) {
      if (k === cur) return;
      var dx = c.x - c0.x, dy = c.y - c0.y, dot = dx * v[0] + dy * v[1]; if (dot <= 0) return;
      var len = Math.hypot(dx, dy), s = len / (dot / len + 0.05); if (s < bs) { bs = s; best = k; }
    });
    return best;
  }
  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i]; p.age += dt;
      if (p.age >= p.life) { G.parts.splice(i, 1); continue; }
      if (p.vz) { p.z = (p.z || 0) + p.vz * dt; if (p.grav || p.k === "debris") p.vz -= 120 * dt; if (p.z < 0) { p.z = 0; p.vz = 0; } }
      if (p.k === "firework") { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 2.5 * dt; }
    }
    if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  }
  function firework() {
    var g = G.grid, x = K.rand(4, g.cols - 4), y = K.rand(3, g.rows * 0.55), col = ["255,210,110", "255,120,90", "160,210,255", "200,255,170"][(Math.random() * 4) | 0];
    for (var k = 0; k < 40; k++) { var a = k / 40 * Math.PI * 2, v = K.rand(3, 6); G.parts.push({ k: "firework", x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: col, age: 0, life: K.rand(1, 1.6) }); }
    AU.play("boom");
  }

  // ---------------------------------------------------------------- drawing
  var FONT = "Georgia, 'Times New Roman', serif";
  function draw() {
    var x = ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = "#0b0f14"; x.fillRect(0, 0, canvas.width, canvas.height);
    if (!G.grid || !G.art) return;
    var k = G.k, sx = G.shake ? K.rand(-G.shake, G.shake) : 0, sy = G.shake ? K.rand(-G.shake, G.shake) : 0;
    x.setTransform(k, 0, 0, k, sx * k, (HUD + sy) * k);
    x.save(); x.beginPath(); x.rect(0, G.mode === "title" ? -HUD : -8, LW, LH + 8); x.clip();
    R.drawWorld(x, G, G.t);
    drawCursor(x);
    R.drawWeather(x, G, G.t, G.art.W, G.art.H);
    drawFireworks(x);
    x.restore();
    x.setTransform(k, 0, 0, k, 0, 0);
    if (G.mode !== "title") drawHud(x);
    drawOverlayText(x);
  }
  function drawFireworks(x) {
    x.save(); x.globalCompositeOperation = "lighter";
    G.parts.forEach(function (p) { if (p.k !== "firework") return; var a = 1 - p.age / p.life; x.fillStyle = "rgba(" + p.c + "," + a + ")"; x.beginPath(); x.arc(p.x * TILE, p.y * TILE, 2.4, 0, 7); x.fill(); });
    x.restore();
  }
  function drawCursor(x) {
    var g = G.grid, t = G.t, m = G.mode, pulse = 0.5 + 0.5 * Math.sin(t * 6);
    if (m === "select") {
      G.castles.forEach(function (c, k) {
        var sel = k === G.selIdx;
        x.save(); x.strokeStyle = sel ? "rgba(255,214,110," + (0.6 + pulse * 0.4) + ")" : "rgba(255,240,200,0.35)"; x.lineWidth = sel ? 3 : 1.5;
        x.setLineDash(sel ? [] : [6, 6]); x.beginPath(); R.roundRect(x, c.x * TILE - 8, c.y * TILE - 8, 80, 80, 12); x.stroke(); x.restore();
        if (sel) {
          x.fillStyle = "rgba(255,226,150,0.16)";
          C.homeRing(g, c).forEach(function (i) { x.fillRect((i % g.cols) * TILE + 3, ((i / g.cols) | 0) * TILE + 3, TILE - 6, TILE - 6); });
          label(x, "HOME?", c.x * TILE + 32, c.y * TILE - 22, 20);
        }
      });
    } else if (m === "cannons") {
      var ok = C.canPlaceCannon(g, G.cursor.x, G.cursor.y), X = G.cursor.x * TILE, Y = G.cursor.y * TILE;
      x.fillStyle = ok ? "rgba(120,230,140,0.28)" : "rgba(240,80,60,0.3)"; x.fillRect(X, Y, 64, 64);
      x.strokeStyle = ok ? "rgba(170,255,180,0.95)" : "rgba(255,120,100,0.95)"; x.lineWidth = 2.5; x.strokeRect(X + 1, Y + 1, 62, 62);
      x.fillStyle = ok ? "rgba(40,30,20,0.6)" : "rgba(60,20,20,0.5)"; x.beginPath(); x.arc(X + 32, Y + 32, 14, 0, 7); x.fill();
      x.fillRect(X + 32, Y + 28, 22, 8);
    } else if (m === "battle" || m === "cease") {
      var ax = G.aim.x * TILE, ay = G.aim.y * TILE, r = 15 + pulse * 3;
      x.save(); x.strokeStyle = "rgba(0,0,0,0.5)"; x.lineWidth = 5; crosshair(x, ax, ay, r);
      var ready = G.cannons.some(function (c) { return c.active && !c.ball && c.reload <= 0; });
      x.strokeStyle = ready ? "#ffd86a" : "rgba(255,216,106,0.45)"; x.lineWidth = 2.2; crosshair(x, ax, ay, r); x.restore();
      if (G.wind) { x.save(); x.strokeStyle = "rgba(200,230,255,0.55)"; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + G.wind.x * TILE, ay + G.wind.y * TILE); x.stroke(); x.restore(); }
    } else if (m === "repair" && G.piece) {
      var okp = C.canPlacePiece(g, G.piece, G.cursor.x, G.cursor.y);
      G.castles.forEach(function (c, k) { if (!C.castleEnclosed(g, c) && k === G.home) { x.strokeStyle = "rgba(255,90,70," + (0.3 + pulse * 0.4) + ")"; x.lineWidth = 2; x.strokeRect(c.x * TILE - 2, c.y * TILE - 2, 68, 68); } });
      G.piece.forEach(function (c) {
        var px = (G.cursor.x + c[0]) * TILE, py = (G.cursor.y + c[1]) * TILE, free = C.tileFree(g, G.cursor.x + c[0], G.cursor.y + c[1]);
        x.fillStyle = free ? "rgba(214,204,182," + (okp ? 0.88 : 0.55) + ")" : "rgba(230,70,50,0.7)"; x.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        x.fillStyle = "rgba(255,255,255,0.25)"; x.fillRect(px + 1, py + 1, TILE - 2, 3);
        x.fillStyle = "rgba(0,0,0,0.25)"; x.fillRect(px + 1, py + TILE - 4, TILE - 2, 3);
        x.strokeStyle = "rgba(60,50,36,0.7)"; x.lineWidth = 1; x.beginPath();
        x.moveTo(px + 1, py + 16.5); x.lineTo(px + TILE - 1, py + 16.5); x.moveTo(px + 10.5, py + 1); x.lineTo(px + 10.5, py + 16.5); x.moveTo(px + 22.5, py + 16.5); x.lineTo(px + 22.5, py + TILE - 1); x.stroke();
      });
      x.strokeStyle = okp ? "rgba(255,240,180," + (0.5 + pulse * 0.5) + ")" : "rgba(255,110,90,0.9)"; x.lineWidth = 2;
      G.piece.forEach(function (c) { x.strokeRect((G.cursor.x + c[0]) * TILE + 1, (G.cursor.y + c[1]) * TILE + 1, TILE - 2, TILE - 2); });
    }
  }
  function crosshair(x, ax, ay, r) {
    x.beginPath(); x.arc(ax, ay, r, 0, 7);
    x.moveTo(ax - r - 8, ay); x.lineTo(ax - r + 6, ay); x.moveTo(ax + r - 6, ay); x.lineTo(ax + r + 8, ay);
    x.moveTo(ax, ay - r - 8); x.lineTo(ax, ay - r + 6); x.moveTo(ax, ay + r - 6); x.lineTo(ax, ay + r + 8); x.stroke();
  }
  function label(x, s, px, py, size, col) {
    x.font = "700 " + size + "px " + FONT; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "rgba(0,0,0,0.65)"; x.fillText(s, px + 2, py + 2); x.fillStyle = col || "#ffe2a0"; x.fillText(s, px, py);
  }
  var PHASE = { select: "CHOOSE YOUR CASTLE", raise: "RAISING WALLS", cannons: "PLACE CANNONS", cannonsDone: "PLACE CANNONS", battle: "BATTLE", cease: "CEASE FIRE",
    repair: "REPAIR", resolve: "TERRITORY", lifelost: "CASTLE LOST", levelclear: "LEVEL HELD", gameover: "GAME OVER", victory: "VICTORY" };
  function phaseMax() { var m = G.mode, L = G.levelDef; return m === "select" ? 15 : m === "cannons" ? L.cannonT : m === "battle" ? L.battleT : m === "repair" ? L.repairT : 0; }
  function drawHud(x) {
    var W = LW, H = HUD, portrait = G.grid.rows > G.grid.cols;
    var bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#2c2822"); bg.addColorStop(1, "#14120e");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255,240,210,0.035)"; for (var i = 0; i < W; i += 46) x.fillRect(i, 0, 1, H);
    x.fillStyle = "#b8923e"; x.fillRect(0, H - 3, W, 3); x.fillStyle = "rgba(0,0,0,0.5)"; x.fillRect(0, H - 1, W, 1);
    x.textBaseline = "middle";
    var row1 = portrait ? 28 : 24, row2 = portrait ? 64 : 52, row3 = 98;
    x.textAlign = "left"; x.font = "700 " + (portrait ? 26 : 22) + "px " + FONT; x.fillStyle = "#f1dfb0";
    x.fillText("LEVEL " + G.level + "  \u00b7  " + G.levelDef.name.toUpperCase(), 18, row1);
    x.font = "600 " + (portrait ? 24 : 19) + "px " + FONT; x.fillStyle = "#e9d7a8";
    x.fillText("SCORE " + G.score, 18, row2);
    var sw = x.measureText("SCORE " + G.score).width;
    for (var l = 0; l < G.lives; l++) drawKeepIcon(x, 18 + sw + 30 + l * 26, row2 + 2);
    var pt = PHASE[G.mode] || "", mx = phaseMax();
    var cx = portrait ? W - 170 : W / 2 + 60, pw = 300;
    x.textAlign = "center"; x.font = "800 " + (portrait ? 26 : 24) + "px " + FONT;
    x.fillStyle = G.mode === "battle" ? "#ff9a6a" : G.mode === "repair" ? "#9fe0a8" : "#ffd98a";
    x.fillText(pt, cx, portrait ? row2 : row1);
    if (mx) {
      var f = K.clamp(G.timer / mx, 0, 1), bx = cx - pw / 2, by = (portrait ? row3 : row2) - 7;
      x.fillStyle = "rgba(0,0,0,0.55)"; x.fillRect(bx - 2, by - 2, pw + 4, 18);
      var tg = x.createLinearGradient(bx, 0, bx + pw, 0); tg.addColorStop(0, f < 0.25 ? "#e04a2a" : "#c89a3a"); tg.addColorStop(1, f < 0.25 ? "#ff8a5a" : "#f4d47a");
      x.fillStyle = tg; x.fillRect(bx, by, pw * f, 14);
      x.font = "700 13px " + FONT; x.fillStyle = f > 0.12 ? "#1a140c" : "#fff"; x.fillText(Math.max(0, Math.ceil(G.timer)) + "s", f > 0.12 ? bx + pw * f - 16 : bx + pw * f + 16, by + 7.5);
    }
    var rx = W - 18;
    x.textAlign = "right"; x.font = "600 " + (portrait ? 22 : 18) + "px " + FONT; x.fillStyle = "#e9d7a8";
    if (G.mode === "repair" && G.next) {
      var ns = C.size(G.next), cs = portrait ? 11 : 10, my = portrait ? row1 : H / 2 - 2;
      drawPieceMini(x, G.next, rx - ns.w * cs, my - ns.h * cs / 2, cs);
      x.fillText("NEXT", rx - ns.w * cs - 10, my);
    } else {
      var info;
      if (G.mode === "cannons" || G.mode === "cannonsDone") info = "CANNONS LEFT " + G.cannonsLeft;
      else if (G.mode === "battle" || G.mode === "cease") info = "SHIPS " + (liveShips() + G.spawnQ.length) + "  \u00b7  GUNS " + G.cannons.filter(function (c) { return c.active; }).length;
      else info = "HIGH " + Math.max(highScore, G.score);
      x.fillText(info, rx, row1);
    }
    x.font = "500 " + (portrait ? 18 : 14) + "px " + FONT; x.fillStyle = "rgba(233,215,168,0.75)";
    var rnd = "ROUND " + Math.min(G.round + 1, G.levelDef.rounds.length) + " OF " + G.levelDef.rounds.length;
    if (portrait) { x.textAlign = "left"; x.fillText(rnd, 18, row3); } else if (!(G.mode === "repair" && G.next)) { x.textAlign = "right"; x.fillText(rnd, rx, row2); }
  }
  function drawKeepIcon(x, px, py) {
    x.fillStyle = "#8c8476"; x.fillRect(px - 9, py - 6, 18, 12);
    x.fillStyle = "#b8ae9a"; x.fillRect(px - 9, py - 9, 4, 4); x.fillRect(px - 2, py - 9, 4, 4); x.fillRect(px + 5, py - 9, 4, 4);
    x.fillStyle = "#c8a23a"; x.fillRect(px - 0.5, py - 16, 1.5, 7); x.fillRect(px + 1, py - 16, 5, 3);
    x.fillStyle = "#2a1c10"; x.fillRect(px - 2, py + 1, 4, 5);
  }
  function drawPieceMini(x, p, px, py, s) {
    p.forEach(function (c) { x.fillStyle = "#cfc4aa"; x.fillRect(px + c[0] * s, py + c[1] * s, s - 1, s - 1); x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(px + c[0] * s, py + c[1] * s, s - 1, 2); });
  }
  function band(x, y, h, a) { var g2 = x.createLinearGradient(0, y - h / 2, 0, y + h / 2); g2.addColorStop(0, "rgba(10,8,6,0)"); g2.addColorStop(0.2, "rgba(10,8,6," + a + ")"); g2.addColorStop(0.8, "rgba(10,8,6," + a + ")"); g2.addColorStop(1, "rgba(10,8,6,0)"); x.fillStyle = g2; x.fillRect(0, y - h / 2, LW, h); }
  function bigText(x, s, px, py, size, mid) {
    x.font = "800 " + size + "px " + FONT; x.textAlign = "center"; x.textBaseline = "middle";
    x.lineJoin = "round"; x.lineWidth = size * 0.14; x.strokeStyle = "rgba(20,14,8,0.92)"; x.strokeText(s, px, py);
    var g2 = x.createLinearGradient(0, py - size / 2, 0, py + size / 2); g2.addColorStop(0, "#fff1c8"); g2.addColorStop(0.5, mid || "#e3b85a"); g2.addColorStop(1, "#8a6224");
    x.fillStyle = g2; x.fillText(s, px, py);
  }
  function fitSize(x, s, size, maxW) { x.font = "800 " + size + "px " + FONT; var w = x.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  function drawOverlayText(x) {
    var mapTop = HUD, cy = HUD + (LH - HUD) / 2, m = G.mode, s;
    if (m === "title") {
      x.fillStyle = "rgba(8,10,14,0.38)"; x.fillRect(0, 0, LW, LH);
      var vg = x.createRadialGradient(LW / 2, LH / 2, LH * 0.2, LW / 2, LH / 2, LH * 0.8); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.6)"); x.fillStyle = vg; x.fillRect(0, 0, LW, LH);
      var ts = fitSize(x, "RAMPART", 160, LW * 0.84);
      band(x, LH * 0.3, ts * 1.9, 0.45);
      bigText(x, "RAMPART", LW / 2, LH * 0.28, ts);
      label(x, "BUILD  \u00b7  BATTLE  \u00b7  REBUILD", LW / 2, LH * 0.28 + ts * 0.66, Math.round(ts * 0.2), "#e9d7a8");
      var blink = 0.78 + 0.22 * Math.sin(G.t * 3), ps = isTouch ? "TAP TO DEFEND THE COAST" : "PRESS SPACE TO DEFEND THE COAST";
      x.globalAlpha = blink; label(x, ps, LW / 2, LH * 0.53, fitSize(x, ps, Math.round(ts * 0.26), LW * 0.9), "#fff1c8"); x.globalAlpha = 1;
      if (maxLevel > 1) {
        var lv = LV.LEVELS[G.startLevel - 1], ls = "\u25c0   START AT LEVEL " + G.startLevel + ": " + lv.name.toUpperCase() + "   \u25b6";
        band(x, LH * 0.69, 64, 0.6);
        label(x, ls, LW / 2, LH * 0.69, fitSize(x, "\u25c0   START AT LEVEL 10: THE LAST BASTION   \u25b6", 28, LW * 0.9), "#ffd98a");
      }
      var info = isTouch ? "Drag pieces, tap ships to fire. The buttons below work too." : "Arrows move \u00b7 Space places and fires \u00b7 Z rotates \u00b7 P pauses \u00b7 M mutes";
      band(x, LH * 0.845, 96, 0.5);
      label(x, info, LW / 2, LH * 0.82, fitSize(x, info, 22, LW * 0.9) * 0.9, "#e8dab4");
      label(x, "12 LEVELS  \u00b7  HIGH SCORE " + highScore, LW / 2, LH * 0.87, Math.round(ts * 0.15), "#cdb98a");
      return;
    }
    if (G.banner && m !== "victory" && m !== "gameover") {
      var b = G.banner, a = Math.min(1, b.t * 4, (b.dur - b.t) * 3);
      x.globalAlpha = K.clamp(a, 0, 1);
      band(x, cy - 10, b.sub ? 150 : 100, 0.62);
      var bs = fitSize(x, b.text, 56, LW * 0.92);
      bigText(x, b.text, LW / 2, cy - (b.sub ? 28 : 10), bs);
      if (b.sub) label(x, b.sub, LW / 2, cy + 28, fitSize(x, b.sub, 24, LW * 0.92) * 0.85, "#f1dfb0");
      x.globalAlpha = 1;
    }
    if (G.hintT > 0 && G.hint && !G.banner && !G.paused && PLAYING[m]) {
      x.globalAlpha = Math.min(1, G.hintT);
      band(x, LH - 34, 50, 0.6);
      label(x, G.hint, LW / 2, LH - 34, fitSize(x, G.hint, 22, LW * 0.92) * 0.85, "#fff1c8");
      x.globalAlpha = 1;
    }
    if (m === "lifelost") { band(x, cy, 170, 0.7); bigText(x, "CASTLE LOST", LW / 2, cy - 18, fitSize(x, "CASTLE LOST", 76, LW * 0.9), "#d0603a"); s = "No castle stands inside your walls"; label(x, s, LW / 2, cy + 40, fitSize(x, s, 24, LW * 0.9), "#f1dfb0"); }
    if (m === "levelclear") { band(x, cy, 170, 0.7); s = "LEVEL " + G.level + " HELD"; bigText(x, s, LW / 2, cy - 20, fitSize(x, s, 76, LW * 0.9)); s = "The fleet is broken. Score " + G.score; label(x, s, LW / 2, cy + 40, fitSize(x, s, 24, LW * 0.9), "#f1dfb0"); }
    if (m === "gameover") {
      x.fillStyle = "rgba(8,6,4,0.55)"; x.fillRect(0, mapTop, LW, LH - mapTop);
      bigText(x, "GAME OVER", LW / 2, cy - 90, fitSize(x, "GAME OVER", 100, LW * 0.88), "#c8502e");
      s = "The coast fell at level " + G.level + ": " + G.levelDef.name;
      label(x, s, LW / 2, cy - 10, fitSize(x, s, 26, LW * 0.9), "#f1dfb0");
      s = "Score " + G.score + (G.newHigh ? "  \u00b7  NEW HIGH SCORE!" : "  \u00b7  High " + highScore);
      label(x, s, LW / 2, cy + 32, fitSize(x, s, 26, LW * 0.9), "#ffd98a");
    }
    if (m === "victory") {
      x.fillStyle = "rgba(8,6,4,0.35)"; x.fillRect(0, mapTop, LW, LH - mapTop);
      var vs = fitSize(x, "VICTORY", 140, LW * 0.8);
      band(x, cy - 90, vs * 2.2, 0.5);
      bigText(x, "VICTORY", LW / 2, cy - 120, vs);
      s = "THE COAST IS SECURED"; label(x, s, LW / 2, cy - 120 + vs * 0.72, fitSize(x, s, 44, LW * 0.9), "#fff1c8");
      s = "All twelve levels held against the fleet"; label(x, s, LW / 2, cy + 20, fitSize(x, s, 26, LW * 0.9), "#f1dfb0");
      s = "Final score " + G.score + (G.newHigh ? "  \u00b7  NEW HIGH SCORE!" : ""); label(x, s, LW / 2, cy + 60, fitSize(x, s, 28, LW * 0.9), "#ffd98a");
    }
    if (G.paused) { x.fillStyle = "rgba(6,6,8,0.55)"; x.fillRect(0, 0, LW, LH); bigText(x, "PAUSED", LW / 2, cy - 60, fitSize(x, "PAUSED", 96, LW * 0.8)); label(x, "P or Esc to resume", LW / 2, cy + 6, 26, "#f1dfb0"); }
  }

  // ---------------------------------------------------------------- toolbar, settings, overlay
  var ov = window.ArcadeOverlay ? ArcadeOverlay.mount(wrap) : { show: function () {}, hide: function () {}, visible: false };
  var btnMute = $("btn-mute"), btnPause = $("btn-pause");
  function refreshMute() {
    var m = AU.isMuted();
    btnMute.innerHTML = (m ? "&#128263;" : "&#128266;") + ' <span class="lbl">' + (m ? "Sound off" : "Sound on") + "</span>";
    btnMute.setAttribute("aria-pressed", m ? "true" : "false");
    btnMute.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    var cb = $("opt-sound"); if (cb) cb.checked = !m;
  }
  function toggleMute() { unlockAudio(); AU.toggleMute(); refreshMute(); }
  var PLAYING = { select: 1, raise: 1, cannons: 1, cannonsDone: 1, battle: 1, cease: 1, repair: 1, resolve: 1 };
  function togglePause(force) {
    if (!PLAYING[G.mode]) return;
    G.paused = force != null ? force : !G.paused;
    input.releaseTouch();
    if (G.paused) ov.show({ primary: { label: "Resume", onClick: function () { togglePause(false); } }, secondary: { label: "Quit to title", onClick: toTitle } });
    else ov.hide();
    music();
  }
  btnMute.addEventListener("click", function (e) { e.preventDefault(); toggleMute(); btnMute.blur(); });
  btnPause.addEventListener("click", function (e) { e.preventDefault(); unlockAudio(); togglePause(); btnPause.blur(); });
  $("btn-full").addEventListener("click", function () {
    var el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
  });
  var settingsEl = $("settings"), panel = K.settings({ input: input, actions: ACTIONS, body: $("keys-body"), msg: $("keys-msg") });
  function openSettings(on) {
    settingsOpen = on; settingsEl.hidden = !on;
    if (on) { if (PLAYING[G.mode] && !G.paused) togglePause(true); panel.render(); refreshMute(); $("opt-music").checked = AU.musicOn(); $("opt-touch").value = touchPref; $("settings-close").focus(); }
    input.clear();
  }
  $("btn-settings").addEventListener("click", function () { unlockAudio(); openSettings(true); });
  $("settings-close").addEventListener("click", function () { openSettings(false); });
  $("keys-reset").addEventListener("click", function () { input.reset(); panel.render(); $("keys-msg").textContent = "Defaults restored."; });
  $("opt-sound").addEventListener("change", function (e) { unlockAudio(); AU.setMuted(!e.target.checked); refreshMute(); });
  $("opt-music").addEventListener("change", function (e) { unlockAudio(); AU.setMusic(e.target.checked); });
  $("opt-touch").addEventListener("change", function (e) { touchPref = e.target.value; K.store.set("rampart.touch", touchPref); layout(); });
  settingsEl.addEventListener("keydown", function (e) { if (e.key === "Escape" && !input.listening) { e.stopPropagation(); openSettings(false); } });
  K.bindTouch(touchEl, input, unlockAudio);
  document.addEventListener("visibilitychange", function () { if (document.hidden && PLAYING[G.mode] && !G.paused) togglePause(true); });
  refreshMute();

  // ---------------------------------------------------------------- loop
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    try { update(dt); draw(); } catch (err) { if (window.console) console.error(err); }
    requestAnimationFrame(frame);
  }
  setupMap(1); demoSetup();
  requestAnimationFrame(frame);

  window.RampartGame = { get mode() { return G.mode; }, get level() { return G.level; }, get score() { return G.score; } };
  if (DEBUG) {
    window.RampartGame.debug = {
      G: G,
      start: function (n) { startGame(n || 1); },
      toBattle: function () {
        if (G.mode === "select") confirmCastle(G.selIdx);
        while (G.buildQueue && G.buildQueue.length) G.grid.wall[G.buildQueue.shift()] = 1;
        C.computeTerritory(G.grid); G.art.dirty = true;
        if (!G.cannons.length) { var c = G.castles[G.home]; G.cannonsLeft = 3; G.mode = "cannons"; for (var i = 0; i < 3; i++) { var s = findCannonSpot(c.x, c.y); if (s) placeCannon(s.x, s.y); } }
        startBattle();
      },
      toRepair: function () { startRepair(); },
      clear: function () { G.ships = []; G.spawnQ = []; G.round = G.levelDef.rounds.length; levelClear(); },
      victory: function () { G.level = MAX_LEVEL; victory(); },
      lose: function () { G.lives = 1; lifeLost(); }
    };
  }
})();

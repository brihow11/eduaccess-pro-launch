/*
 * Galaga tribute for the EduAccess arcade. Original code, art and sound.
 * Bees, butterflies and Boss Galaga fly in looping entry waves, settle into a breathing formation and dive-bomb.
 * A Boss can catch your fighter in its tractor beam; shoot that Boss while it dives to win the fighter back and fly
 * a dual ship. Challenging Stages (no enemy fire) arrive at stages 3, 7 and 11. 12 stages, then victory.
 * Written by: Howie
 */
(function () {
  "use strict";
  var LV = window.GalagaLevels, ART = window.GalagaArt, AU = window.GalagaAudio, K = window.VKit;
  var Mus = window.ArcadeMusic || null, Songs = window.GalagaSongs || null;
  var W = LV.W, H = LV.H, MAX_LEVEL = 12, PY = H - 70, TAU = Math.PI * 2, OY = 0;
  var DEBUG = K.DEBUG;
  function $(id) { return document.getElementById(id); }
  var canvas = $("game"), ctx = canvas.getContext("2d"), wrap = $("wrap"), stage = $("stage"), touchEl = $("touch");
  var isTouch = K.isTouch;
  document.body.classList.toggle("is-touch", !!isTouch);
  var touchPref = K.store.get("galaga.touch", "auto");
  function showTouch() { return touchPref === "on" || (touchPref === "auto" && isTouch); }
  var rnd = K.rand, clamp = K.clamp;

  // ---------------------------------------------------------------- input (arrows + Space by default, all remappable)
  var ACTIONS = [
    { id: "left", label: "Move left", keys: ["ArrowLeft", "KeyA"] },
    { id: "right", label: "Move right", keys: ["ArrowRight", "KeyD"] },
    { id: "fire", label: "Fire / start", keys: ["Space", "KeyZ"] },
    { id: "pause", label: "Pause", keys: ["KeyP", "Escape"] },
    { id: "mute", label: "Mute", keys: ["KeyM", null] }
  ];
  var settingsOpen = false;
  var input = K.input({
    actions: ACTIONS, storeKey: "galaga.keys",
    onKey: function (e) {
      unlockAudio();
      if (settingsOpen || (window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen())) return false;
      if (e.code === "Enter" && !e.repeat && (G.mode === "title")) { input.press("fire"); e.preventDefault(); }
    },
    pad: function (gp) {
      var b = function (i) { return !!(gp.buttons[i] && gp.buttons[i].pressed); }, ax = gp.axes[0] || 0;
      return { left: b(14) || ax < -0.4, right: b(15) || ax > 0.4, fire: b(0) || b(1) || b(2) || b(7), pause: b(9) };
    }
  });

  // ---------------------------------------------------------------- persistence
  var highScore = K.store.get("galaga.high", 30000) || 30000;
  var maxLevel = clamp(K.store.get("galaga.maxLevel", 1) || 1, 1, MAX_LEVEL);

  // ---------------------------------------------------------------- state
  var G = {
    mode: "title", phase: "", paused: false, splash: false, level: 1, startLevel: 1, lives: 2, score: 0, nextLife: 20000,
    def: LV.LEVELS[0], enemies: [], shots: [], eshots: [], parts: [], pops: [], spawnQ: [], captive: null,
    P: { x: W / 2, alive: true, dual: false, respawn: 0, inv: 0, state: "ok", fireCd: 0, target: null },
    t: 0, ft: 0, phaseT: 0, diveT: 3, formed: false, breathe: 0, fired: 0, hits: 0, stageHits: 0, stageTotal: 0,
    msg: "", msgT: 0, newHigh: false, shake: 0, flash: 0, inputLock: 0, demoT: 0, warp: 0, results: null
  };
  var stars = [];
  (function () {
    var cols = ["255,255,255", "255,220,160", "160,200,255", "255,160,160", "200,255,220", "220,180,255"];
    for (var i = 0; i < 190; i++) {
      var layer = i % 3;
      stars.push({ x: Math.random() * W, y: Math.random() * H, z: layer, sp: [22, 48, 95][layer], r: [0.6, 0.9, 1.35][layer], c: cols[(Math.random() * cols.length) | 0], ph: Math.random() * TAU, tw: rnd(1, 4) });
    }
  })();

  // ---------------------------------------------------------------- layout
  var resizeT = 0, K_SCALE = 1;
  function wantPortrait() { return window.innerHeight > window.innerWidth * 1.05; }
  function layout() {
    document.body.classList.toggle("is-portrait", wantPortrait());
    var st = showTouch();
    touchEl.hidden = !st;
    touchEl.classList.toggle("landscape", st && !wantPortrait());
    var r = stage.getBoundingClientRect();
    var aw = Math.max(160, r.width - 4), ah = Math.max(160, r.height - 4);
    // tall phone screens get a taller playfield instead of empty bars (formation stays put, the fighter sits lower)
    H = Math.round(clamp(W * ah / aw, LV.H, 800)); PY = H - 70; OY = (H - LV.H) / 2;
    stars.forEach(function (s) { if (s.y > H) s.y = Math.random() * H; });
    var k = Math.min(aw / W, ah / H);
    var cw = Math.floor(W * k), ch = Math.floor(H * k);
    wrap.style.width = cw + "px"; wrap.style.height = ch + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr));
    K_SCALE = canvas.width / W;
  }
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(layout, 100); });
  window.addEventListener("orientationchange", function () { setTimeout(layout, 300); });
  window.addEventListener("jsp-banner-ready", layout);

  // ---------------------------------------------------------------- audio + music
  var audioOn = false;
  function unlockAudio() { AU.unlock(); if (!audioOn) { audioOn = true; setTimeout(music, 60); } }
  function sfx(n, o) { AU.sfx(n, o); }
  var musicKey = "";
  function music() {
    if (!Mus || !Songs) return;
    Mus.duck(!!(G.paused || G.splash || settingsOpen));
    var want;
    if (G.splash || G.mode === "title") want = "title";
    else if (G.mode === "play") want = G.def.challenge ? "challenge" : "play" + Math.min(2, Math.floor((G.level - 1) / 4));
    else want = G.mode;
    if (want === musicKey) return;
    musicKey = want;
    if (want === "title") Mus.play(Songs.title);
    else if (want === "challenge") Mus.play(Songs.challenge);
    else if (want.indexOf("play") === 0) Mus.play(Songs.play[+want.slice(4)]);
    else if (want === "victory") Mus.sting(Songs.victory, Songs.title);
    else if (want === "gameover") Mus.sting(Songs.over, Songs.title);
  }

  // ---------------------------------------------------------------- helpers
  function updateHigh() { if (G.score > highScore) { highScore = G.score; G.newHigh = true; K.store.set("galaga.high", highScore); } }
  function addScore(v, x, y, show) {
    G.score += v;
    if (G.score >= G.nextLife) { G.lives = Math.min(G.lives + 1, 6); G.nextLife += G.nextLife < 70000 ? 50000 : 70000; sfx("life"); say("EXTRA FIGHTER", 1.6); }
    if (show) G.pops.push({ x: x, y: y, s: String(v), t: 0 });
    updateHigh();
  }
  function say(s, t) { G.msg = s; G.msgT = t || 2; }
  function slotXY(e) { return LV.slotPos(e.r, e.c, G.breathe, G.sway); }
  function inFormation() { return G.enemies.filter(function (e) { return e.st === "form"; }); }
  var DIVING = { dive: 1, track: 1, beamGo: 1, beam: 1, escort: 1, loop: 1, ret: 1 };
  function diverCount() { var n = 0; G.enemies.forEach(function (e) { if (DIVING[e.st]) n++; }); return n; }
  function pX(i) { var P = G.P; return P.dual ? P.x + (i ? 17 : -17) : P.x; }
  function shipCount() { return G.P.dual ? 2 : 1; }

  function burst(x, y, pal, n, big) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = rnd(30, big ? 260 : 170);
      G.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.35, big ? 1.3 : 0.75), age: 0, c: pal[(Math.random() * pal.length) | 0], r: rnd(0.8, big ? 2.6 : 1.9) });
    }
    G.parts.push({ ring: true, x: x, y: y, age: 0, life: big ? 0.7 : 0.4, R: big ? 46 : 26, c: pal[0] });
  }
  var PALS = { bee: ["255,230,90", "80,140,255", "255,120,40"], butterfly: ["255,80,70", "255,255,255", "90,130,255"], boss: ["120,255,140", "255,210,60", "255,255,255"],
    boss2: ["190,140,255", "120,200,255", "255,255,255"], dragonfly: ["120,255,200", "255,220,60"], scorpion: ["255,170,60", "255,80,40"], fighter: ["255,255,255", "255,90,60", "255,220,120", "120,170,255"] };

  // ---------------------------------------------------------------- stage setup
  function startGame(n) {
    G.level = n || 1; G.startLevel = G.level; G.score = 0; G.lives = 2; G.nextLife = 20000; G.fired = 0; G.hits = 0; G.newHigh = false; G.results = null;
    G.P = { x: W / 2, alive: true, dual: false, respawn: 0, inv: 0, state: "ok", fireCd: 0, target: null };
    G.captive = null; ov.hide();
    G.mode = "play"; startStage();
    sfx("start");
  }
  function startStage() {
    G.def = LV.LEVELS[G.level - 1];
    G.enemies = []; G.shots = []; G.eshots = []; G.spawnQ = []; G.pops = [];
    G.phase = "intro"; G.phaseT = 0; G.ft = 0; G.formed = false; G.breathe = 0; G.sway = 0; G.diveT = 2.5; G.stageHits = 0; G.stageTotal = 0; G.warp = 1;
    if (G.captive && G.captive.st !== "held") G.captive = null;
    if (G.level > maxLevel) { maxLevel = G.level; K.store.set("galaga.maxLevel", maxLevel); }
    var d = G.def, spd = d.entry, gap = 0.15;
    var waves = d.challenge ? d.cwaves : d.waves;
    waves.forEach(function (wv, w) {
      var start = 2.6 + w * (d.challenge ? 3.4 : 3.0) * 270 / spd;
      var members = LV.WAVES[w];
      members.forEach(function (slot, i) {
        var r = (slot / 10) | 0, c = slot % 10, mode = wv[1], mirror, at;
        if (mode === "pair") { mirror = i % 2 === 1; at = start + ((i / 2) | 0) * gap * 1.6; }
        else { mirror = mode === "mirror"; at = start + i * gap; }
        var kind = d.challenge ? wv[2] : LV.slotKind(r);
        G.spawnQ.push({ at: at, r: r, c: c, kind: kind, path: wv[0], mirror: mirror, wave: w });
      });
    });
    G.spawnQ.sort(function (a, b) { return a.at - b.at; });
    G.stageTotal = G.spawnQ.length;
    say(d.challenge ? "CHALLENGING STAGE" : (d.final ? "FINAL STAGE" : "STAGE " + G.level), 2.4);
    music();
  }
  function spawn(q) {
    var d = G.def;
    var e = { kind: q.kind, r: q.r, c: q.c, hp: q.kind === "boss" ? 2 : 1, st: "entry", path: d.challenge ? LV.challengePath(q.path, q.mirror) : LV.entryPath(q.path, q.mirror),
      d: 0, spd: d.entry * (q.kind === "boss" ? 0.95 : 1), x: 0, y: -40, a: Math.PI / 2, t: Math.random() * 3, fireAt: -1, captive: null, leader: null, kills: 0, wave: q.wave, challenge: !!d.challenge };
    if (!d.challenge && d.entryFire && Math.random() < d.entryFire) e.fireAt = rnd(0.35, 0.75) * e.path.total;
    var p = LV.at(e.path, 0); e.x = p.x; e.y = p.y; e.a = p.a;
    G.enemies.push(e);
  }

  // ---------------------------------------------------------------- dives
  function launchDive(e, mode) {
    var s = slotXY(e), side = s.x < W / 2 ? -1 : 1;
    if (Math.random() < 0.25) side = -side;
    var segs = side > 0 ? [["m", s.x, s.y], ["a", s.x + 26, s.y, 26, 180, 360]] : [["m", s.x, s.y], ["a", s.x - 26, s.y, 26, 0, -180]];
    e.path = LV.build(segs, false); e.d = 0; e.st = "dive"; e.mode = mode || "attack";
    e.spd = G.def.diveSpd; e.vx = 0; e.shotsLeft = G.def.shots; e.nextShot = rnd(0.25, 0.8); e.loopDone = Math.random() > G.def.loops; e.wob = Math.random() * TAU;
    sfx("dive");
  }
  function tryDive() {
    var d = G.def, form = inFormation(), left = G.enemies.length;
    if (G.noDive || !form.length || !G.P.alive || G.P.state !== "ok") return;
    var cap = d.maxDivers + (left <= 6 ? 3 : 0);
    if (diverCount() >= cap) return;
    var bosses = form.filter(function (e) { return e.kind === "boss"; });
    var beamBusy = G.enemies.some(function (e) { return e.mode === "beam"; });
    if (bosses.length && Math.random() < 0.3) {
      var b = bosses[(Math.random() * bosses.length) | 0];
      var canBeam = !b.captive && !G.captive && !G.P.dual && !beamBusy && Math.random() < d.beam;
      if (canBeam) { launchDive(b, "beam"); return; }
      launchDive(b, "attack");
      // up to two butterfly escorts from the boss's neighborhood
      var esc = form.filter(function (e) { return e.kind === "butterfly" && e.r === 1 && Math.abs(e.c - b.c) <= 1; }).slice(0, 2);
      esc.forEach(function (e, i) { e.st = "escort"; e.leader = b; e.spd = d.diveSpd; e.wob = Math.random() * TAU; e.loopDone = true; e.mode = "attack"; e.ox = esc.length === 1 ? (e.c < b.c ? -24 : 24) : (i ? 24 : -24); e.oy = -20; e.shotsLeft = d.shots; e.nextShot = rnd(0.4, 1); });
      return;
    }
    var pool = form.filter(function (e) { return e.kind !== "boss"; });
    if (!pool.length) pool = form;
    // edge columns go first, like the arcade
    pool.sort(function (a, b) { return Math.abs(b.c - 4.5) - Math.abs(a.c - 4.5) + rnd(-3, 3); });
    launchDive(pool[0]);
    if (G.level >= 5 && pool[1] && pool[1].kind === pool[0].kind && Math.random() < 0.35 && diverCount() < cap) launchDive(pool[1]);
  }
  function enemyFire(e) {
    if (!G.P.alive || G.def.challenge || e.y > PY - 90) return;
    var dx = G.P.x - e.x, dy = PY - e.y, sp = G.def.shot, vx = clamp(dx / Math.max(60, dy), -0.42, 0.42) * sp;
    G.eshots.push({ x: e.x, y: e.y + 10, vx: vx, vy: sp });
  }

  // ---------------------------------------------------------------- enemy update
  function updateEnemy(e, dt) {
    e.t += dt;
    var ox = e.x, oy = e.y, P = G.P;
    switch (e.st) {
      case "entry": {
        e.d += e.spd * dt;
        var p = LV.at(e.path, e.d); e.x = p.x; e.y = p.y;
        if (e.fireAt > 0 && e.d >= e.fireAt) { e.fireAt = -1; enemyFire(e); }
        if (e.challenge && (p.done || (e.d > 200 && (e.y > H + 30 || e.x < -40 || e.x > W + 40)))) { e.gone = true; return; }
        if (p.done) e.st = "home";
        break;
      }
      case "home": case "ret": {
        var s = slotXY(e), dx = s.x - e.x, dy = s.y - e.y, dist = Math.hypot(dx, dy), v = (e.st === "ret" ? G.def.diveSpd * 1.1 : e.spd) * dt;
        if (dist <= v + 0.5) { e.x = s.x; e.y = s.y; e.st = "form"; e.mode = null; }
        else { e.x += dx / dist * v; e.y += dy / dist * v; }
        break;
      }
      case "form": { var f = slotXY(e); e.x = f.x; e.y = f.y; break; }
      case "dive": {
        e.d += e.spd * 1.1 * dt;
        var q = LV.at(e.path, e.d); e.x = q.x; e.y = q.y;
        if (q.done) { e.st = e.mode === "beam" ? "beamGo" : "track"; e.vx = 0; e.tx = clamp(P.x + rnd(-20, 20), 50, W - 50); }
        break;
      }
      case "beamGo": {
        var ty = PY - 250, bx = e.tx - e.x, by = ty - e.y, bd = Math.hypot(bx, by), bv = e.spd * dt;
        if (bd <= bv) { e.x = e.tx; e.y = ty; e.st = "beam"; e.beamT = 0; sfx("beam"); }
        else { e.x += bx / bd * bv; e.y += by / bd * bv; }
        break;
      }
      case "beam": {
        e.beamT += dt;
        var len = beamLen(e);
        if (len > 200 && P.alive && P.state === "ok" && !P.dual && !G.captive && Math.abs(P.x - e.x) < 30 && e.beamT < 3.6) {
          // caught: the fighter is pulled up into the beam
          P.state = "captured"; P.capY = PY; P.spin = 0;
          G.captive = { x: P.x, y: PY, st: "rise", boss: e, a: 0 };
          sfx("capture"); say("FIGHTER CAPTURED", 3);
        }
        if (G.captive && G.captive.boss === e && G.captive.st === "rise") e.beamT = Math.min(e.beamT, 3.0);
        if (e.beamT > 4.4) { e.mode = null; if (e.captive) { e.st = "ret"; } else { e.st = "track"; e.vx = 0; e.loopDone = true; } }
        break;
      }
      case "track": case "loop": case "escort": {
        if (e.st === "escort") {
          var L = e.leader;
          if (!L || L.dead || (L.st !== "dive" && L.st !== "track" && L.st !== "loop")) { e.st = "track"; e.vx = 0; e.loopDone = true; break; }
          var k = Math.min(1, dt * 7);
          e.x += (L.x + e.ox - e.x) * k; e.y += (L.y + e.oy - e.y) * k;
        } else if (e.st === "loop") {
          e.d += e.spd * dt;
          var lp = LV.at(e.path, e.d); e.x = lp.x; e.y = lp.y;
          if (lp.done) { e.st = "track"; e.vx = 0; }
        } else {
          var targ = P.alive ? P.x : W / 2, acc = e.kind === "bee" ? 260 : 200;
          e.vx += clamp(targ - e.x, -1, 1) * acc * dt;
          e.vx = clamp(e.vx, -150, 150);
          var wob = e.kind === "butterfly" ? Math.sin(e.t * 4 + e.wob) * 60 : 0;
          e.x += (e.vx + wob) * dt; e.y += e.spd * dt;
          e.x = clamp(e.x, 14, W - 14);
          if (!e.loopDone && e.y > H * 0.58) {
            e.loopDone = true; var sd = e.x < W / 2 ? 1 : -1;
            e.path = LV.build(sd > 0 ? [["m", e.x, e.y], ["a", e.x + 34, e.y, 34, 180, -180]] : [["m", e.x, e.y], ["a", e.x - 34, e.y, 34, 0, 360]], false);
            e.d = 0; e.st = "loop";
          }
        }
        if (e.shotsLeft > 0 && e.y > 150) { e.nextShot -= dt; if (e.nextShot <= 0) { e.shotsLeft--; e.nextShot = rnd(0.25, 0.6); enemyFire(e); } }
        if (e.y > H + 30) {
          // fly off the bottom and come back in from the top
          e.x = clamp(slotXY(e).x + rnd(-40, 40), 30, W - 30); e.y = -30; e.st = "ret"; e.leader = null;
        }
        break;
      }
    }
    var mx = e.x - ox, my = e.y - oy;
    if (e.st === "form") e.a = lerpAngle(e.a, Math.PI / 2, dt * 6);
    else if (e.st === "beam") e.a = lerpAngle(e.a, Math.PI / 2, dt * 8);
    else if (mx * mx + my * my > 0.01) e.a = lerpAngle(e.a, Math.atan2(my, mx), Math.min(1, dt * 14));
  }
  function lerpAngle(a, b, t) { var d = ((b - a + Math.PI * 3) % TAU) - Math.PI; return a + d * Math.min(1, t); }
  function beamLen(e) {
    var t = e.beamT, full = PY - e.y + 30;
    if (t < 0.6) return 0;
    if (t < 1.4) return full * (t - 0.6) / 0.8;
    if (t < 3.6) return full;
    if (t < 4.4) return full * (1 - (t - 3.6) / 0.8);
    return 0;
  }

  // ---------------------------------------------------------------- captive fighter
  function updateCaptive(dt) {
    var c = G.captive; if (!c) return;
    var P = G.P;
    if (c.st === "rise") {
      var b = c.boss, ty = b.y + 30;
      c.y -= 70 * dt; c.x += (b.x - c.x) * Math.min(1, dt * 3); c.a += dt * 9;
      if (c.y <= ty || b.dead) {
        if (b.dead) { c.st = "defect"; } else { c.st = "held"; b.captive = c; c.a = 0; }
        P.state = "ok"; P.alive = false; P.respawn = 2.4; P.lostToBeam = true;
        loseLife();
      }
    } else if (c.st === "held") {
      var B = c.boss;
      if (!B || B.dead) { c.st = "defect"; return; }
      var bx = B.x - Math.cos(B.a) * 30, by = B.y - Math.sin(B.a) * 30;
      if (B.st === "form" || B.st === "home" || B.st === "ret") { bx = B.x; by = B.y - 30; }
      c.x = bx; c.y = by; c.a = lerpAngle(c.a, B.st === "form" ? 0 : B.a + Math.PI / 2 + Math.PI, dt * 6);
    } else if (c.st === "rescue") {
      c.a += dt * 10; c.t += dt;
      if (!P.alive || P.state !== "ok") { c.st = "defect"; return; }
      var dock = clamp(P.x + 34, 40, W - 20), dx = dock - c.x, dy = PY - c.y;
      var dd = Math.hypot(dx, dy), v = 220 * dt;
      if (c.t > 0.8) {
        if (dd <= v + 1) {
          P.dual = true; P.x = clamp(P.x + 17, 37, W - 37); G.captive = null; sfx("rescue"); say("DUAL FIGHTER", 1.8);
          return;
        }
        c.x += dx / dd * v; c.y += dy / dd * v;
      } else c.y += 20 * dt;
    } else if (c.st === "defect") {
      c.t = (c.t || 0) + dt; c.y -= 160 * dt; c.x += Math.sin(c.t * 4) * 90 * dt; c.a = lerpAngle(c.a, Math.PI, dt * 4);
      if (c.y < -40) G.captive = null;
    }
  }

  // ---------------------------------------------------------------- player
  function fire() {
    var P = G.P;
    if (!P.alive || P.state !== "ok" || G.phase === "results") return;
    var n = shipCount(), live = G.shots.length;
    if (live + n > 2 * n) return;
    for (var i = 0; i < n; i++) G.shots.push({ x: pX(i), y: PY - 18 });
    G.fired += n; P.fireCd = 0.14;
    sfx("shot");
  }
  function killPlayer(which) {
    var P = G.P;
    if (P.inv > 0 || !P.alive || P.state !== "ok") return;
    if (P.dual) {
      var x = pX(which);
      burst(x, PY, PALS.fighter, 40, true); sfx("die");
      P.dual = false; P.x = which ? P.x - 17 : P.x + 17; P.inv = 1.0; G.shake = 0.4;
      return;
    }
    burst(P.x, PY, PALS.fighter, 60, true); sfx("die"); G.shake = 0.7; G.flash = 0.25;
    P.alive = false; P.respawn = 2.6; P.lostToBeam = false;
    loseLife();
  }
  function loseLife() {
    G.eshots = [];
    if (G.lives <= 0) { G.P.respawn = 0; G.phase = "over"; G.phaseT = 0; return; }
    G.lives--;
  }
  function updatePlayer(dt) {
    var P = G.P;
    P.fireCd = Math.max(0, P.fireCd - dt); P.inv = Math.max(0, P.inv - dt);
    if (!P.alive) {
      if (G.phase === "over") return;
      P.respawn -= dt;
      var busy = G.enemies.some(function (e) { return DIVING[e.st] && e.st !== "ret"; });
      if (P.respawn <= 0 && (!busy || P.respawn < -4)) { P.alive = true; P.state = "ok"; P.x = W / 2; P.inv = 2.0; P.dual = false; say("READY", 1.2); }
      return;
    }
    if (P.state !== "ok") return;
    var dir = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0), sp = 250;
    if (dir) P.target = null;
    if (P.target != null) { var dx = P.target - P.x; dir = Math.abs(dx) < 3 ? 0 : dx > 0 ? 1 : -1; if (Math.abs(dx) < sp * dt) { P.x = P.target; dir = 0; } }
    P.x += dir * sp * dt;
    var m = P.dual ? 37 : 20; P.x = clamp(P.x, m, W - m);
    if (input.hit("fire")) fire();
    else if (input.isDown("fire") && P.fireCd <= 0) fire();
  }

  // ---------------------------------------------------------------- collisions
  var RAD = { bee: 12, butterfly: 13, boss: 15, dragonfly: 13, scorpion: 12 };
  function hitEnemy(e) {
    G.hits++;
    e.hp--;
    if (e.hp > 0) { sfx("bossHit"); e.hurt = 0.15; burst(e.x, e.y, PALS.boss2, 8); return; }
    e.dead = true; if (e.challenge) G.stageHits++;
    var diving = e.st !== "form" && e.st !== "home" && e.st !== "entry", pts;
    if (e.challenge) pts = 100;
    else if (e.kind === "bee") pts = diving ? 100 : 50;
    else if (e.kind === "butterfly") pts = diving ? 160 : 80;
    else pts = diving ? [400, 800, 1600][Math.min(2, e.kills)] : 150;
    if (e.st === "escort" && e.leader) e.leader.kills++;
    addScore(pts, e.x, e.y, e.kind === "boss" && diving);
    burst(e.x, e.y, PALS[e.kind === "boss" && e.hp <= 0 ? "boss2" : e.kind] || PALS.bee, e.kind === "boss" ? 34 : 20, e.kind === "boss");
    sfx(e.kind === "boss" ? "boom" : "hit", { big: e.kind === "boss" });
    if (e.kind === "boss") sfx("boom", { big: true });
    // a Boss holding your fighter: shoot it on a dive to win the fighter back
    if (e.captive) {
      var c = e.captive; e.captive = null;
      if (diving && G.P.alive && G.P.state === "ok" && !G.P.dual) { c.st = "rescue"; c.t = 0; say("FIGHTER RESCUED", 1.6); }
      else { c.st = "defect"; c.t = 0; }
    }
  }
  function collide() {
    var P = G.P;
    for (var i = G.shots.length - 1; i >= 0; i--) {
      var s = G.shots[i], hit = false;
      for (var j = 0; j < G.enemies.length && !hit; j++) {
        var e = G.enemies[j]; if (e.dead || e.gone) continue;
        var r = RAD[e.kind] || 12;
        if (Math.abs(s.x - e.x) < r && Math.abs(s.y - e.y) < r + 6) { hitEnemy(e); hit = true; }
      }
      var c = G.captive;
      if (!hit && c && (c.st === "held" || c.st === "defect") && Math.abs(s.x - c.x) < 11 && Math.abs(s.y - c.y) < 14) {
        burst(c.x, c.y, PALS.fighter, 30, true); sfx("boom", { big: true }); if (c.boss) c.boss.captive = null; G.captive = null; hit = true; say("FIGHTER LOST", 1.5);
      }
      if (hit) G.shots.splice(i, 1);
    }
    if (!P.alive || P.state !== "ok" || P.inv > 0) return;
    for (var n = 0; n < shipCount(); n++) {
      var x = pX(n);
      for (var k = G.eshots.length - 1; k >= 0; k--) {
        var b = G.eshots[k];
        if (Math.abs(b.x - x) < 9 && Math.abs(b.y - PY) < 12) { G.eshots.splice(k, 1); killPlayer(n); return; }
      }
      for (var m = 0; m < G.enemies.length; m++) {
        var en = G.enemies[m]; if (en.dead || en.gone || en.st === "form") continue;
        if (Math.abs(en.x - x) < 18 && Math.abs(en.y - PY) < 18) { if (!en.challenge) { en.hp = 1; hitEnemy(en); } killPlayer(n); return; }
      }
    }
  }

  // ---------------------------------------------------------------- stage flow
  function updatePlay(dt) {
    var d = G.def;
    G.ft += dt; G.phaseT += dt;
    // formation sway while filling, then breathe once complete
    var filling = G.spawnQ.length || G.enemies.some(function (e) { return e.st === "entry" || e.st === "home"; });
    if (!filling && !G.formed && G.phase === "fight") { G.formed = true; G.diveT = 1.2; }
    var bt = G.formed ? 1 : 0;
    G.breatheAmt = (G.breatheAmt || 0) + (bt - (G.breatheAmt || 0)) * Math.min(1, dt * 1.5);
    G.breathe = G.breatheAmt * (1 - Math.cos(G.ft * 1.7)) / 2;
    G.sway = (1 - G.breatheAmt) * Math.sin(G.ft * 1.1) * 22;
    if (G.phase === "intro") { if (G.phaseT > 2.2) { G.phase = "fight"; G.phaseT = 0; G.stageClock = 0; } }
    if (G.phase === "fight" || G.phase === "over") {
      G.stageClock = (G.stageClock || 0) + dt;
      while (G.spawnQ.length && G.spawnQ[0].at - 2.6 <= G.stageClock) spawn(G.spawnQ.shift());
      if (G.formed && !d.challenge && G.phase === "fight") {
        G.diveT -= dt;
        if (G.diveT <= 0) { tryDive(); var left = G.enemies.length; G.diveT = d.dive * rnd(0.6, 1.25) * (left <= 6 ? 0.4 : left <= 14 ? 0.7 : 1); }
      }
    }
    for (var i = 0; i < G.enemies.length; i++) updateEnemy(G.enemies[i], dt);
    G.enemies = G.enemies.filter(function (e) { return !e.dead && !e.gone; });
    updateCaptive(dt);
    updatePlayer(dt);
    for (var s = G.shots.length - 1; s >= 0; s--) { G.shots[s].y -= 760 * dt; if (G.shots[s].y < -20) G.shots.splice(s, 1); }
    for (var b = G.eshots.length - 1; b >= 0; b--) { var e = G.eshots[b]; e.x += e.vx * dt; e.y += e.vy * dt; if (e.y > H + 20) G.eshots.splice(b, 1); }
    collide();
    if (G.phase === "fight" && !G.spawnQ.length && !G.enemies.length && (!G.captive || G.captive.st === "defect")) {
      if (d.challenge) { G.phase = "results"; G.phaseT = 0; var bonus = G.stageHits >= G.stageTotal ? 10000 : G.stageHits * 100; G.cBonus = bonus; addScore(bonus); sfx(G.stageHits >= G.stageTotal ? "perfect" : "tick"); }
      else { G.phase = "clear"; G.phaseT = 0; }
    }
    if (G.phase === "clear" && G.phaseT > 1.6 && G.P.alive) stageDone();
    if (G.phase === "results" && G.phaseT > 3.8 && G.P.alive) stageDone();
    if (G.phase === "over" && G.phaseT > 2.4) gameOver();
  }
  function stageDone() {
    G.phase = "done";
    if (G.level >= MAX_LEVEL) { victory(); return; }
    var n = G.level;
    showSplash({ tag: "stage" + G.level, title: (G.def.challenge ? "CHALLENGING STAGE " : "STAGE ") + n + " CLEARED", sub: "Score " + G.score + "  \u00b7  Hit ratio " + ratio() + "%", contLabel: "Stage " + (n + 1) }, function () {
      G.level = n + 1; G.shots = []; G.eshots = []; startStage();
    });
  }
  function ratio() { return G.fired ? Math.round(G.hits / G.fired * 1000) / 10 : 0; }
  function results() { return { fired: G.fired, hits: G.hits, ratio: ratio() }; }
  function gameOver() {
    G.mode = "gameover"; G.phase = ""; G.results = results(); updateHigh(); music();
    G.overT = 0;
    showSplash({ tag: "gameover", title: "GAME OVER", sub: "Stage " + G.level + "  \u00b7  Score " + G.score + "  \u00b7  Hit ratio " + ratio() + "%", contLabel: "See results" }, function () {
      ov.show({ primary: { label: "Play again", onClick: function () { startGame(1); } }, secondary: maxLevel > 1 ? { label: "Continue from stage " + Math.min(G.level, maxLevel), onClick: function () { startGame(Math.min(G.level, maxLevel)); } } : null });
    });
  }
  function victory() {
    G.mode = "victory"; G.results = results(); updateHigh(); musicKey = ""; music(); sfx("perfect");
    showSplash({ tag: "victory", title: "ALL 12 STAGES CLEARED", sub: "Final score " + G.score + "  \u00b7  Hit ratio " + ratio() + "%", contLabel: "Victory screen" }, function () {
      ov.show({ primary: { label: "Play again", onClick: function () { startGame(1); } } });
    });
  }
  function showSplash(o, cb) {
    var done = function () { G.splash = false; G.inputLock = performance.now() + 350; input.clear(); input.releaseTouch(); music(); cb(); };
    if (!window.ScoutSplash || !window.ScoutSplash.show) { done(); return; }
    G.splash = true; ov.hide(); music();
    window.ScoutSplash.show({ kind: "galaga", campaign: "galaga", tag: o.tag, title: o.title, sub: o.sub, contLabel: o.contLabel,
      accent: "#7fb4ff", glow: "rgba(90,150,255,.3)", onContinue: done });
  }
  function toTitle() { G.mode = "title"; G.paused = false; G.enemies = []; G.shots = []; G.eshots = []; G.captive = null; ov.hide(); musicKey = ""; music(); }

  // ---------------------------------------------------------------- main update
  function update(dt) {
    input.pollPad();
    if (input.hit("mute")) toggleMute();
    if (input.hit("pause")) togglePause();
    G.t += dt;
    var starSpeed = G.mode === "play" && G.phase === "intro" ? 3.2 : 1;
    G.warp += (starSpeed - G.warp) * Math.min(1, dt * 2);
    if (!G.paused) stars.forEach(function (s) { s.y += s.sp * G.warp * dt; if (s.y > H) { s.y -= H; s.x = Math.random() * W; } });
    if (G.paused || G.splash || settingsOpen) { input.clear(); return; }
    if (performance.now() < G.inputLock) input.clear();
    for (var i = G.parts.length - 1; i >= 0; i--) { var p = G.parts[i]; p.age += dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; } if (p.age > p.life) G.parts.splice(i, 1); }
    for (var j = G.pops.length - 1; j >= 0; j--) { G.pops[j].t += dt; if (G.pops[j].t > 1.2) G.pops.splice(j, 1); }
    G.msgT -= dt; G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt);
    if (G.mode === "title") {
      G.demoT += dt;
      if (input.hit("left") && maxLevel > 1) { G.startLevel = G.startLevel > 1 ? G.startLevel - 1 : maxLevel; sfx("ui"); }
      if (input.hit("right") && maxLevel > 1) { G.startLevel = G.startLevel < maxLevel ? G.startLevel + 1 : 1; sfx("ui"); }
      G.startLevel = clamp(G.startLevel, 1, maxLevel);
      if (input.hit("fire")) startGame(G.startLevel);
      return;
    }
    if (G.mode === "play") updatePlay(dt);
    else if (G.mode === "gameover" || G.mode === "victory") {
      G.overT = (G.overT || 0) + dt;
      if (!G.splash && ov.visible && input.hit("fire") && G.overT > 1) startGame(1);
      input.clear();
    }
  }

  // ---------------------------------------------------------------- drawing
  var nebula = {}, nebKey = "";
  function buildNebula(th) {
    var cv = document.createElement("canvas"); cv.width = 240; cv.height = 320;
    var c = cv.getContext("2d");
    c.fillStyle = "#02030a"; c.fillRect(0, 0, 240, 320);
    var seed = th.planet.charCodeAt(1) + th.planet.charCodeAt(3);
    function sr() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 7; i++) {
      var x = sr() * 240, y = sr() * 320, r = 60 + sr() * 110, g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, i % 2 ? th.a : th.b); g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 0.75; c.fillStyle = g; c.fillRect(0, 0, 240, 320);
    }
    c.globalAlpha = 1;
    // a distant planet low in one corner
    var px = sr() < 0.5 ? 30 + sr() * 30 : 180 + sr() * 30, py = 60 + sr() * 200, pr = 16 + sr() * 22;
    var pg = c.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, th.planet); pg.addColorStop(0.7, "rgba(10,10,20,0.9)"); pg.addColorStop(1, "rgba(0,0,0,0.0)");
    c.globalAlpha = 0.55; c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill(); c.globalAlpha = 1;
    return cv;
  }
  function drawBackground(x) {
    var th = (G.mode === "title" ? LV.LEVELS[0] : G.def).theme, key = th.planet;
    if (!nebula[key]) nebula[key] = buildNebula(th);
    x.imageSmoothingEnabled = true; x.drawImage(nebula[key], 0, 0, W, H);
    x.globalCompositeOperation = "lighter";
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], tw = 0.55 + 0.45 * Math.sin(G.t * s.tw + s.ph), len = s.sp * (G.warp - 1) * 0.06;
      x.globalAlpha = tw * (0.45 + s.z * 0.25); x.fillStyle = "rgb(" + s.c + ")";
      if (len > 1.5) x.fillRect(s.x - s.r / 2, s.y - len, s.r, len + s.r);
      else { x.beginPath(); x.arc(s.x, s.y, s.r, 0, TAU); x.fill(); }
    }
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
  }
  function spr(x, kind, frame, px, py, a, alpha, scale) {
    var s = ART.sprite(kind, frame), sz = s.s * (scale || 1);
    x.save(); x.translate(px, py); if (a) x.rotate(a); if (alpha != null) x.globalAlpha = alpha;
    x.drawImage(s.cv, -sz / 2, -sz / 2, sz, sz); x.restore();
  }
  function enemySprite(e) { return e.kind === "boss" && e.hp < 2 ? "boss2" : e.kind; }
  function drawEnemy(x, e) {
    var frame = e.st === "form" ? (Math.floor(G.t * 2.2 + e.c * 0.3) % 2) : (Math.floor(e.t * 8) % 2);
    // soft shadow-glow under each ship for depth
    var rot = e.a + Math.PI / 2;
    spr(x, enemySprite(e), frame, e.x, e.y, rot);
    if (e.hurt > 0) { e.hurt -= 1 / 60; x.save(); x.globalCompositeOperation = "lighter"; spr(x, enemySprite(e), frame, e.x, e.y, rot, 0.6); x.restore(); }
  }
  function drawBeam(x, e) {
    var len = beamLen(e); if (len <= 0) return;
    var top = e.y + 14, half0 = 10, half1 = 50;
    x.save(); x.globalCompositeOperation = "lighter";
    var g = x.createLinearGradient(0, top, 0, top + len);
    g.addColorStop(0, "rgba(140,200,255,0.55)"); g.addColorStop(1, "rgba(80,140,255,0.15)");
    x.fillStyle = g; x.beginPath(); x.moveTo(e.x - half0, top); x.lineTo(e.x + half0, top);
    var hb = half0 + (half1 - half0) * Math.min(1, len / 230);
    x.lineTo(e.x + hb, top + len); x.lineTo(e.x - hb, top + len); x.closePath(); x.fill();
    // travelling energy bands
    for (var i = 0; i < 9; i++) {
      var f = ((i / 9) + G.t * 0.9) % 1, y = top + f * len, hw = half0 + (half1 - half0) * Math.min(1, (f * len) / 230);
      x.strokeStyle = "rgba(" + (i % 2 ? "200,230,255" : "255,120,220") + "," + (0.7 * (1 - f * 0.6)) + ")"; x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(e.x - hw, y); x.quadraticCurveTo(e.x, y + 6, e.x + hw, y); x.stroke();
    }
    x.restore();
  }
  function drawShots(x) {
    x.save(); x.globalCompositeOperation = "lighter";
    G.shots.forEach(function (s) {
      var g = x.createLinearGradient(0, s.y - 10, 0, s.y + 8); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,230,120,0.9)"); g.addColorStop(1, "rgba(255,80,40,0)");
      x.fillStyle = g; x.fillRect(s.x - 1.6, s.y - 10, 3.2, 18);
      x.fillStyle = "rgba(255,200,120,0.25)"; x.fillRect(s.x - 3.5, s.y - 8, 7, 12);
    });
    G.eshots.forEach(function (b) {
      x.save(); x.translate(b.x, b.y); x.rotate(Math.atan2(b.vy, b.vx) - Math.PI / 2);
      x.fillStyle = "rgba(255,60,40,0.35)"; x.beginPath(); x.ellipse(0, 0, 4.5, 8, 0, 0, TAU); x.fill();
      x.fillStyle = "#fff4c0"; x.beginPath(); x.moveTo(0, 6); x.lineTo(2, 0); x.lineTo(0, -5); x.lineTo(-2, 0); x.closePath(); x.fill();
      x.restore();
    });
    x.restore();
  }
  function drawParts(x) {
    x.save(); x.globalCompositeOperation = "lighter";
    G.parts.forEach(function (p) {
      var k = 1 - p.age / p.life;
      if (p.ring) { x.strokeStyle = "rgba(" + p.c + "," + k * 0.8 + ")"; x.lineWidth = 2.5 * k + 0.5; x.beginPath(); x.arc(p.x, p.y, p.R * (1 - k * k) + 3, 0, TAU); x.stroke(); return; }
      x.fillStyle = "rgba(" + p.c + "," + k + ")"; x.beginPath(); x.arc(p.x, p.y, p.r * (0.5 + k), 0, TAU); x.fill();
    });
    x.restore();
  }
  function txt(x, s, px, py, size, col, align, weight) {
    x.font = (weight || 800) + " " + size + "px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif"; x.textAlign = align || "center"; x.textBaseline = "middle";
    x.lineWidth = Math.max(2, size / 7); x.strokeStyle = "rgba(0,0,10,0.85)"; x.strokeText(s, px, py);
    x.fillStyle = col || "#fff"; x.fillText(s, px, py);
  }
  function drawHUD(x) {
    var g = x.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, "rgba(0,0,10,0.75)"); g.addColorStop(1, "rgba(0,0,10,0)");
    x.fillStyle = g; x.fillRect(0, 0, W, 40);
    var blink = Math.floor(G.t * 2.5) % 2 === 0 || G.mode !== "play";
    if (blink) txt(x, "1UP", 18, 12, 13, "#ff4a4a", "left");
    txt(x, String(G.score).padStart(2, "0"), 18, 28, 16, "#fff", "left");
    txt(x, "HIGH SCORE", W / 2, 12, 13, "#ff4a4a");
    txt(x, String(Math.max(highScore, G.score)), W / 2, 28, 16, "#fff");
    if (G.mode === "title") return;
    // reserve fighters bottom left, stage badges bottom right
    for (var i = 0; i < Math.min(G.lives, 6); i++) spr(x, "fighter", 1, 16 + i * 20, H - 14, 0, 1, 0.5);
    var n = G.level, list = [];
    [50, 30, 20, 10, 5, 1].forEach(function (v) { while (n >= v) { list.push(v); n -= v; } });
    var bx = W - 10;
    for (var j = list.length - 1; j >= 0; j--) { var v = list[j], wdt = v === 1 ? 8 : v === 5 ? 9 : 13; bx -= wdt; ART.badge(x, bx + wdt / 2, H - 6, v, 1); bx -= 2; }
  }
  function drawResults(x, top, r) {
    txt(x, "\u2014 RESULTS \u2014", W / 2, top, 22, "#ff5a4a");
    txt(x, "SHOTS FIRED", 110, top + 44, 17, "#ffe060", "left"); txt(x, String(r.fired), 370, top + 44, 17, "#ffe060", "right");
    txt(x, "NUMBER OF HITS", 110, top + 74, 17, "#ffe060", "left"); txt(x, String(r.hits), 370, top + 74, 17, "#ffe060", "right");
    txt(x, "HIT-MISS RATIO", 110, top + 104, 17, "#fff", "left"); txt(x, r.ratio.toFixed(1) + " %", 370, top + 104, 17, "#fff", "right");
  }
  function drawLogo(x, cy, size) {
    x.save();
    x.font = "900 " + size + "px 'Arial Black', 'Trebuchet MS', Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    var g = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    g.addColorStop(0, "#fff8d0"); g.addColorStop(0.45, "#ffc83a"); g.addColorStop(0.55, "#e0661a"); g.addColorStop(1, "#7a1a08");
    x.lineJoin = "round"; x.lineWidth = size / 6; x.strokeStyle = "#1a2a8a"; x.strokeText("GALAGA", W / 2, cy);
    x.lineWidth = size / 14; x.strokeStyle = "#7fb4ff"; x.strokeText("GALAGA", W / 2, cy);
    x.fillStyle = g; x.fillText("GALAGA", W / 2, cy);
    x.globalCompositeOperation = "lighter"; x.globalAlpha = 0.25 + 0.15 * Math.sin(G.t * 2); x.fillStyle = "#fff"; x.fillText("GALAGA", W / 2, cy - 1);
    x.restore();
  }
  function drawTitle(x) {
    x.translate(0, OY);
    drawLogo(x, 112, 74);
    txt(x, "ARCADE TRIBUTE", W / 2, 162, 14, "#9ec4ff", "center", 700);
    txt(x, "\u2014 SCORE \u2014", W / 2, 214, 16, "#7fd8ff");
    var rows = [["boss", "BOSS GALAGA", "150", "400+"], ["butterfly", "GOEI", "80", "160"], ["bee", "ZAKO", "50", "100"]];
    txt(x, "FORMATION", 300, 240, 11, "#9ec4ff", "center", 700); txt(x, "DIVING", 392, 240, 11, "#9ec4ff", "center", 700);
    rows.forEach(function (r, i) {
      var y = 274 + i * 46;
      spr(x, r[0], Math.floor(G.t * 3) % 2, 108, y, Math.PI, 1, 1.15);
      txt(x, r[1], 146, y, 14, "#fff", "left", 700); txt(x, r[2], 300, y, 16, "#ffe060"); txt(x, r[3], 392, y, 16, "#ffe060");
    });
    // a little tractor-beam vignette
    var bx = W / 2 + Math.sin(G.t * 0.7) * 120;
    spr(x, "fighter", 1, bx, 470, 0);
    var pulse = 0.5 + 0.5 * Math.sin(G.t * 3);
    var blink = Math.floor(G.t * 1.6) % 2 === 0;
    if (blink) txt(x, isTouch ? "TAP FIRE TO START" : "PRESS SPACE TO START", W / 2, 530, 20, "#fff");
    if (maxLevel > 1) txt(x, "\u25C0  START AT STAGE " + G.startLevel + "  \u25B6", W / 2, 562, 15, "rgba(255,224,96," + (0.7 + 0.3 * pulse) + ")");
    txt(x, "12 STAGES \u00b7 CHALLENGING STAGES 3, 7, 11 \u00b7 RESCUE YOUR FIGHTER", W / 2, 596, 11, "#9ec4ff", "center", 600);
    txt(x, "\u2190 \u2192 MOVE   SPACE FIRE   P PAUSE   M MUTE", W / 2, 614, 11, "#6f8fbf", "center", 600);
  }
  function draw() {
    var x = ctx;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = "#000"; x.fillRect(0, 0, canvas.width, canvas.height);
    var sh = G.shake > 0 ? G.shake * 6 : 0;
    x.setTransform(K_SCALE, 0, 0, K_SCALE, sh ? rnd(-sh, sh) * K_SCALE : 0, sh ? rnd(-sh, sh) * K_SCALE : 0);
    drawBackground(x);
    if (G.mode === "title") { drawHUD(x); drawTitle(x); return; }
    var live = G.mode === "play";
    if (live) G.enemies.forEach(function (e) { if (e.st === "beam") drawBeam(x, e); });
    var c = G.captive;
    if (c && live) spr(x, "captive", 1, c.x, c.y, c.a);
    if (live) G.enemies.forEach(function (e) { drawEnemy(x, e); });
    var P = G.P;
    if (live && P.alive && P.state === "ok" && (P.inv <= 0 || Math.floor(G.t * 12) % 2)) {
      for (var i = 0; i < shipCount(); i++) spr(x, "fighter", Math.floor(G.t * 10) % 2, pX(i), PY, 0);
    }
    if (live) drawShots(x);
    drawParts(x);
    G.pops.forEach(function (p) { txt(x, p.s, p.x, p.y - p.t * 16, 14, "#7fd8ff"); });
    if (G.flash > 0) { x.fillStyle = "rgba(255,255,255," + G.flash * 0.6 + ")"; x.fillRect(0, 0, W, H); }
    drawHUD(x);
    if (G.mode === "play") {
      if (G.msgT > 0) txt(x, G.msg, W / 2, H / 2 - 20, G.msg.length > 14 ? 24 : 30, G.msg === "READY" ? "#7fd8ff" : "#ff5a4a");
      if (G.phase === "intro" && G.phaseT < 2.2) txt(x, G.def.name.toUpperCase(), W / 2, H / 2 + 16, 15, "#9ec4ff", "center", 700);
      if (G.phase === "results") {
        txt(x, "NUMBER OF HITS   " + G.stageHits, W / 2, H / 2 - 30, 20, "#7fd8ff");
        if (G.stageHits >= G.stageTotal) txt(x, "PERFECT !", W / 2, H / 2 + 6, 26, "#ff5a4a");
        txt(x, "BONUS   " + G.cBonus, W / 2, H / 2 + 40, 20, "#ffe060");
      }
      if (G.phase === "over") txt(x, "GAME OVER", W / 2, H / 2, 34, "#ff5a4a");
    } else if (G.mode === "gameover") {
      x.translate(0, OY);
      txt(x, "GAME OVER", W / 2, 150, 40, "#ff5a4a");
      txt(x, "STAGE " + G.level + "   \u00b7   SCORE " + G.score, W / 2, 196, 16, "#fff");
      if (G.newHigh) txt(x, "NEW HIGH SCORE!", W / 2, 222, 16, "#ffe060");
      if (G.results) drawResults(x, 270, G.results);
    } else if (G.mode === "victory") {
      x.translate(0, OY);
      drawLogo(x, 110, 54);
      txt(x, "VICTORY", W / 2, 172, 40, "#ffe060");
      txt(x, "THE GALAGA ARMADA IS BROKEN", W / 2, 210, 16, "#9ec4ff");
      txt(x, "FINAL SCORE " + G.score + (G.newHigh ? "  \u00b7  NEW HIGH!" : ""), W / 2, 238, 16, "#fff");
      if (G.results) drawResults(x, 290, G.results);
      for (var k = 0; k < 5; k++) spr(x, ["bee", "butterfly", "boss", "butterfly", "bee"][k], Math.floor(G.t * 3) % 2, 120 + k * 60, 450 + Math.sin(G.t * 2 + k) * 6, Math.PI);
    }
    if (G.paused) {
      x.setTransform(K_SCALE, 0, 0, K_SCALE, 0, 0);
      x.fillStyle = "rgba(0,0,12,0.6)"; x.fillRect(0, 0, W, H);
      txt(x, "PAUSED", W / 2, H / 2 - 50, 44, "#fff"); txt(x, "P or Esc to resume", W / 2, H / 2 - 10, 16, "#9ec4ff", "center", 600);
    }
  }

  // ---------------------------------------------------------------- toolbar, settings, overlay, pointer
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
  function togglePause(force) {
    if (G.mode !== "play") return;
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
    if (on) { if (G.mode === "play" && !G.paused) togglePause(true); panel.render(); refreshMute(); $("opt-music").checked = AU.musicOn(); $("opt-touch").value = touchPref; $("settings-close").focus(); }
    input.clear(); music();
  }
  $("btn-settings").addEventListener("click", function () { unlockAudio(); openSettings(true); });
  $("settings-close").addEventListener("click", function () { openSettings(false); });
  $("keys-reset").addEventListener("click", function () { input.reset(); panel.render(); $("keys-msg").textContent = "Defaults restored."; });
  $("opt-sound").addEventListener("change", function (e) { unlockAudio(); AU.setMuted(!e.target.checked); refreshMute(); });
  $("opt-music").addEventListener("change", function (e) { unlockAudio(); AU.setMusic(e.target.checked); });
  $("opt-touch").addEventListener("change", function (e) { touchPref = e.target.value; K.store.set("galaga.touch", touchPref); layout(); });
  settingsEl.addEventListener("keydown", function (e) { if (e.key === "Escape" && !input.listening) { e.stopPropagation(); openSettings(false); } });
  K.bindTouch(touchEl, input, unlockAudio);
  // drag on the playfield to steer; tap the playfield on the title screen to start
  function logicalX(e) { var r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / r.width * W; }
  var dragId = null;
  canvas.addEventListener("pointerdown", function (e) {
    unlockAudio(); canvas.focus();
    if (G.splash || settingsOpen) return;
    if (G.mode === "title") { input.press("fire"); return; }
    if (G.mode === "play" && !G.paused) { dragId = e.pointerId; G.P.target = logicalX(e); try { canvas.setPointerCapture(e.pointerId); } catch (x) { } }
  });
  canvas.addEventListener("pointermove", function (e) { if (dragId === e.pointerId && G.mode === "play") G.P.target = logicalX(e); });
  function endDrag(e) { if (dragId === e.pointerId) { dragId = null; G.P.target = null; } }
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && G.mode === "play" && !G.paused) togglePause(true); });
  refreshMute();

  // ---------------------------------------------------------------- loop
  var last = performance.now(), STEPS = 1;
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    try { for (var s = 0; s < STEPS; s++) update(dt); draw(); } catch (err) { if (window.console) console.error(err); }
    requestAnimationFrame(frame);
  }
  layout(); music();
  requestAnimationFrame(frame);

  window.GalagaGame = { get mode() { return G.mode; }, get level() { return G.level; }, get score() { return G.score; }, get phase() { return G.phase; } };
  if (DEBUG) {
    window.GalagaGame.debug = {
      G: G,
      start: function (n) { startGame(n || 1); },
      skipIntro: function () { G.phaseT = 9; },
      fillFormation: function () {
        G.phase = "fight"; G.stageClock = 999;
        while (G.spawnQ.length) spawn(G.spawnQ.shift());
        G.enemies.forEach(function (e) { if (!e.challenge) { e.st = "form"; var s = slotXY(e); e.x = s.x; e.y = s.y; } });
      },
      dive: function (mode) { var b = inFormation().filter(function (e) { return mode === "beam" ? e.kind === "boss" : e.kind !== "boss"; })[0]; if (b) launchDive(b, mode); return !!b; },
      clear: function () { G.spawnQ = []; G.enemies = []; G.captive = null; G.phase = "fight"; },
      victory: function () { G.level = MAX_LEVEL; victory(); },
      lose: function () { G.lives = 0; G.P.inv = 0; killPlayer(0); },
      dual: function () { G.P.dual = true; },
      speed: function (n) { STEPS = Math.max(1, n | 0); }
    };
  }
})();

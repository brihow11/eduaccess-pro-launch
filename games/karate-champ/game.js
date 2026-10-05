/*
 * Karate Champ tribute for the EduAccess arcade. Original code, art and sound.
 * Dual-stick arcade tribute: left stick moves/guards, right stick attacks (24 chart techniques).
 * Referee awards attack scores 100-1000; <=500 half point, >=600 full point. First to two full points
 * in 30 seconds wins. Twelve bouts, bonus rounds, Grand Champion screen.
 * Written by: Howie
 */
(function () {
  "use strict";
  var K = window.VKit, C = window.KarateCore, LV = window.KarateLevels, R = window.KarateRender, AU = window.KarateAudio;
  var MAX_LEVEL = 12, W = R.W, FLOOR = R.FLOOR, BOUNDS = [80, 1200], SEP = 84, MAX_GAP = 640;
  var DEBUG = K.DEBUG;
  function $(id) { return document.getElementById(id); }
  var canvas = $("game"), ctx = canvas.getContext("2d"), wrap = $("wrap"), stage = $("stage"), touchEl = $("touch");
  var isTouch = K.isTouch;
  document.body.classList.toggle("is-touch", !!isTouch);
  var touchPref = K.store.get("karate-champ.touch", "auto");
  function showTouch() { return touchPref === "on" || (touchPref === "auto" && isTouch); }

  // ---------------------------------------------------------------- input: arrows + Space by default, every key remappable
  // Dual sticks like the 1984 cabinet: left = move/stance (WASD), right = attack (arrows).
  var ACTIONS = [
    { id: "left", label: "Left stick \u2190 (retreat / block)", keys: ["KeyA", "KeyH"] },
    { id: "right", label: "Left stick \u2192 (approach)", keys: ["KeyD", "KeyL"] },
    { id: "up", label: "Left stick \u2191 (jump)", keys: ["KeyW", "KeyK"] },
    { id: "down", label: "Left stick \u2193 (crouch)", keys: ["KeyS", "KeyJ"] },
    { id: "rleft", label: "Right stick \u2190 (back kicks)", keys: ["ArrowLeft", null] },
    { id: "rright", label: "Right stick \u2192 (front / lunge / reverse)", keys: ["ArrowRight", null] },
    { id: "rup", label: "Right stick \u2191 (round / jump kicks)", keys: ["ArrowUp", null] },
    { id: "rdown", label: "Right stick \u2193 (low kicks / sweeps)", keys: ["ArrowDown", null] },
    { id: "kick", label: "Touch: tap attack (uses held left stick)", keys: ["Space", null] },
    { id: "pause", label: "Pause", keys: ["KeyP", "Escape"] },
    { id: "mute", label: "Mute", keys: ["KeyM", null] }
  ];
  var settingsOpen = false;
  var input = K.input({
    actions: ACTIONS, storeKey: "karate-champ.keys",
    onKey: function (e) {
      unlockAudio();
      if (settingsOpen || (window.ScoutSplash && ScoutSplash.isOpen && ScoutSplash.isOpen())) return false;
      if (e.code === "Enter" && !e.repeat) input.press("start");
    },
    pad: function (gp) {
      var b = function (i) { return !!(gp.buttons[i] && gp.buttons[i].pressed); };
      var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, ax2 = gp.axes[2] != null ? gp.axes[2] : (gp.axes[3] || 0), ay2 = gp.axes[3] != null && gp.axes.length > 3 ? gp.axes[3] : (gp.axes[1] || 0);
      // Dual-stick pads: left stick move, right stick attack. Fallback: d-pad = left, face buttons nudge right stick.
      return {
        up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5,
        rup: b(3) || ay2 < -0.55, rdown: b(0) || ay2 > 0.55, rleft: b(2) || ax2 < -0.5, rright: b(1) || ax2 > 0.5,
        pause: b(9)
      };
    }
  });

  // ---------------------------------------------------------------- persistence
  var highScore = K.store.get("karate-champ.high", 0) || 0;
  var maxLevel = K.clamp(K.store.get("karate-champ.maxLevel", 1) || 1, 1, MAX_LEVEL);
  var tipSeen = !!K.store.get("karate-champ.tipSeen", false);

  // ---------------------------------------------------------------- state
  var G = {
    mode: "title", paused: false, splash: false, level: 1, startLevel: 1, lives: 3, score: 0, newHigh: false,
    halves: { p: 0, c: 0 }, attackScore: { p: 0, c: 0 }, lastHit: null, timer: C.BOUT_TIME, modeT: 0, freeze: 0, shake: 0, t: 0, inputLock: 0,
    ref: { pose: "idle", msg: "", msgT: 0, flagSide: 0 }, sparks: [], debris: [], floats: [], bonus: null, result: null, lastTick: 0, introShort: false
  };
  var LW = 1280, LH = 720, SCENE_Y = 0, portrait = false;

  // ---------------------------------------------------------------- layout
  var resizeT = 0, artQ = 1;
  function wantPortrait() { return window.innerHeight > window.innerWidth * 1.05; }
  function layout() {
    portrait = wantPortrait();
    document.body.classList.toggle("is-portrait", portrait);
    if (portrait) { LW = 760; LH = 1100; SCENE_Y = 200; } else { LW = 1280; LH = 720; SCENE_Y = 0; }
    var st = showTouch();
    touchEl.hidden = !st;
    touchEl.classList.toggle("landscape", st && !portrait);
    var r = stage.getBoundingClientRect();
    var aw = Math.max(160, r.width - 2), ah = Math.max(160, r.height - 2);
    var k = Math.min(aw / LW, ah / LH);
    var cw = Math.floor(LW * k), ch = Math.floor(LH * k);
    wrap.style.width = cw + "px"; wrap.style.height = ch + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cw * dpr)); canvas.height = Math.max(1, Math.round(ch * dpr));
    G.k = canvas.width / LW;
    artQ = K.clamp(Math.round(G.k * 4) / 4, 0.5, 2);
  }
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(layout, 100); });
  window.addEventListener("orientationchange", function () { setTimeout(layout, 300); });
  window.addEventListener("jsp-banner-ready", layout);

  // ---------------------------------------------------------------- fighters
  function newFighter(side, x, facing, speed) {
    return { side: side, x: x, y: 0, vx: 0, vy: 0, facing: facing, state: "stand", stateT: 0, move: null, mt: 0, mdur: 1, hitDone: false,
      speed: speed || 1, pose: C.mix(C.POSES.stance, C.POSES.stance, 0), walk: 0, trail: [], moveId: 0, airT: 0, flipDir: 1, kiai: false };
  }
  var P = newFighter("p", 440, 1), E = newFighter("c", 840, -1);
  var lvl = LV.LEVELS[0];
  function other(f) { return f === P ? E : P; }
  function grounded(f) { return f.y >= 0 && f.vy >= 0; }
  function canAct(f) { return f.state === "stand" || f.state === "walk" || f.state === "crouch" || f.state === "block" || f.state === "lowblock"; }
  function panOf(f) { return K.clamp((f.x - 640) / 700, -0.8, 0.8); }

  function startMove(f, id, fromAir) {
    var m = C.MOVES[id]; if (!m) return;
    f.state = "move"; f.move = id; f.mdur = m.t / f.speed; f.mt = fromAir ? f.mdur * 0.16 : 0; f.hitDone = false; f.trail = []; f.moveId++;
    f.kiai = Math.random() < (m.fullPts >= 600 ? 0.55 : 0.2);
    if (m.air && !fromAir) { f.airPending = true; } else f.airPending = false;
    if (m.air) f.vx = f.facing * 190 * f.speed;
    if (m.step && !fromAir && f.y >= 0) { var step = m.step * f.facing; if (walkOK(f, step)) f.x += step; }
    AU.play(m.fullPts >= 600 ? "whooshBig" : "whoosh", panOf(f));
  }
  function startJump(f, dirX) { f.state = "air"; f.vy = -900; f.y = -1; f.vx = dirX * 170; f.airT = 0; AU.play("whoosh", panOf(f)); }
  function startFlip(f, back) { f.state = "flip"; f.vy = -980; f.y = -1; f.flipDir = back ? -1 : 1; f.vx = f.facing * (back ? -300 : 370); f.airT = 0; AU.play("whooshBig", panOf(f)); }
  function setState(f, s) { if (f.state !== s) { f.state = s; f.stateT = 0; } }

  // the pose the fighter should show this frame
  function targetPose(f) {
    var Pz = C.POSES;
    switch (f.state) {
      case "move": return C.movePose(f.move, K.clamp(f.mt / f.mdur, 0, 1));
      case "walk": return C.mix(Pz.walkA, Pz.walkB, (Math.sin(f.walk) + 1) / 2);
      case "crouch": return Pz.crouch;
      case "block": return Pz.block;
      case "lowblock": return Pz.lowblock;
      case "air": return Pz.jump;
      case "flip": var tp = C.mix(Pz.jump, Pz.jump, 0); tp.rot = f.flipDir * Math.min(1, f.airT / 0.62) * Math.PI * 2; return tp;
      case "hit": return Pz.hit;
      case "down": return Pz.down;
      case "win": return f.stateT < 0.6 ? Pz.stance : Pz.win;
      case "kneel": return Pz.kneel;
      case "bow": return Pz.bow;
      case "chop": return C.movePose("chop", K.clamp(f.mt / f.mdur, 0, 1));
      default: return C.mix(Pz.stance, Pz.stance2, (Math.sin(G.t * 3 + (f === P ? 0 : 1.7)) + 1) / 2);
    }
  }
  function updatePose(f, dt) {
    var tp = targetPose(f), rate = (f.state === "move" || f.state === "chop") ? 38 : f.state === "flip" ? 1000 : 16;
    var a = 1 - Math.exp(-dt * rate);
    var keepRot = f.state === "flip";
    f.pose = C.mix(f.pose, tp, a);
    if (keepRot) f.pose.rot = tp.rot; else if (Math.abs(f.pose.rot) > Math.PI) f.pose.rot = 0;
    f.pose.turn = tp.turn;
  }
  function world(f) { return C.toWorld(f, f.pose, C.skeleton(f.pose), FLOOR); }

  function physics(f, dt) {
    f.stateT += dt;
    var airborne = f.state === "air" || f.state === "flip" || (f.state === "move" && C.MOVES[f.move].air && !f.airPending) || f.y < 0;
    if (f.state === "move" && f.airPending && f.mt >= f.mdur * 0.12) { f.airPending = false; f.vy = -880; f.y = -1; airborne = true; }
    if (airborne) {
      f.airT += dt; f.vy += 2500 * dt; f.y += f.vy * dt; f.x += f.vx * dt;
      if (f.y >= 0) {
        f.y = 0; f.vy = 0; f.vx = 0; f.airT = 0; AU.play("land", panOf(f));
        if (f.state === "air" || f.state === "flip") { f.state = "stand"; f.pose.rot = 0; }
        else if (f.state === "move" && f.mt < f.mdur * 0.86) f.mt = f.mdur * 0.86;
      }
    } else if (f.state === "hit" || f.state === "down") {
      f.x += f.vx * dt; f.vx *= Math.pow(0.02, dt);
    }
    if (f.state === "move") {
      f.mt += dt;
      if (f.mt >= f.mdur) { if (f.y < 0) f.state = "air"; else { f.state = "stand"; f.move = null; } }
    }
    if (f.state === "hit" && f.stateT > 0.32) setState(f, "down");
    if (f.state === "blockstun" && f.stateT > 0.16) setState(f, "stand");
    f.x = K.clamp(f.x, BOUNDS[0], BOUNDS[1]);
  }
  function faceEachOther() {
    [P, E].forEach(function (f) {
      var o = other(f);
      if (f.y >= 0 && (canAct(f) || f.state === "blockstun") && Math.abs(o.x - f.x) > 4) f.facing = o.x > f.x ? 1 : -1;
    });
    if (P.y >= 0 && E.y >= 0 && P.state !== "flip" && E.state !== "flip") {
      var d = E.x - P.x, ad = Math.abs(d);
      if (ad < SEP) {
        var push = (SEP - ad) / 2, s = d >= 0 ? 1 : -1;
        P.x -= push * s; E.x += push * s;
        if (P.x < BOUNDS[0]) { E.x += BOUNDS[0] - P.x; P.x = BOUNDS[0]; } if (E.x < BOUNDS[0]) { P.x += BOUNDS[0] - E.x; E.x = BOUNDS[0]; }
        if (P.x > BOUNDS[1]) { E.x -= P.x - BOUNDS[1]; P.x = BOUNDS[1]; } if (E.x > BOUNDS[1]) { P.x -= E.x - BOUNDS[1]; E.x = BOUNDS[1]; }
      }
    }
  }
  function walkOK(f, dx) { var o = other(f), nd = Math.abs(o.x - (f.x + dx)); return nd <= MAX_GAP || nd < Math.abs(o.x - f.x); }

  // ---------------------------------------------------------------- player control (dual sticks)
  function stickDir(prefix) {
    // Returns absolute screen dir 'n'|'l'|'r'|'u'|'d' for left ("" ) or right ("r") stick.
    var L = prefix === "r";
    var u = input.isDown(L ? "rup" : "up"), d = input.isDown(L ? "rdown" : "down");
    var l = input.isDown(L ? "rleft" : "left"), r = input.isDown(L ? "rright" : "right");
    if (u && !d) return "u";
    if (d && !u) return "d";
    if (l && !r) return "l";
    if (r && !l) return "r";
    return "n";
  }
  function relStick(abs, facing) {
    // Convert absolute left/right to toward/away relative to facing (+1 faces right).
    if (abs === "l" || abs === "r") {
      if (facing > 0) return abs; // facing right: left=away(l), right=toward(r)
      return abs === "l" ? "r" : "l"; // facing left: mirrored
    }
    return abs;
  }
  function playerControl(dt) {
    var f = P, dist = Math.abs(E.x - f.x), close = dist < C.CLOSE;
    var leftAbs = stickDir(""), rightAbs = stickDir("r");
    var left = relStick(leftAbs, f.facing), right = relStick(rightAbs, f.facing);
    // Air: right-stick forward = jumping side kick; back = jumping back kick; up/down = flip
    if (f.state === "air") {
      if (right !== "n" && (input.hit("rright") || input.hit("rleft") || input.hit("rup") || input.hit("rdown") || input.hit("kick"))) {
        var airCmd = C.dualCommand("u", right, close);
        if (airCmd.type === "move") startMove(f, airCmd.id, true);
        else if (airCmd.type === "flip") startFlip(f, !!airCmd.back);
      } else if (input.hit("kick")) startMove(f, "jumpside", true);
      return;
    }
    if (!canAct(f)) return;
    // Right-stick edge (or Space) fires an attack from the dual-stick chart
    var fired = input.hit("rright") || input.hit("rleft") || input.hit("rup") || input.hit("rdown") || input.hit("kick");
    if (fired && right === "n" && input.hit("kick")) right = "r"; // Space alone = toward attack (front/reverse by range)
    if (fired) {
      var cmd = C.dualCommand(left, right === "n" ? "r" : right, close);
      if (cmd.type === "move" && C.MOVES[cmd.id]) { startMove(f, cmd.id); return; }
      if (cmd.type === "flip") { startFlip(f, !!cmd.back); return; }
    }
    // Left stick only: jump / crouch / walk / block
    var idle = C.dualCommand(left, "n", close);
    if (idle.type === "jump" && input.hit("up")) { startJump(f, leftAbs === "r" ? f.facing : leftAbs === "l" ? -f.facing : 0); return; }
    if (idle.type === "jump" && input.isDown("up") && !input.isDown("down")) {
      // holding up without a fresh jump edge: already handled by hit; fall through to stand if airborne pending
    }
    if (input.hit("up")) { startJump(f, 0); return; }
    if (idle.type === "block" || (left === "l" && close && input.isDown("left"))) { setState(f, "block"); return; }
    if (idle.type === "crouch" || input.isDown("down")) { setState(f, "crouch"); return; }
    var mv = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    if (mv) {
      var sp = (mv === f.facing ? 215 : 195) * dt;
      if (walkOK(f, mv * sp)) { f.x += mv * sp; f.walk += dt * 11 * mv * f.facing; }
      setState(f, "walk");
      if (Math.floor(f.walk / Math.PI) !== Math.floor((f.walk - dt * 11 * mv * f.facing) / Math.PI)) AU.play("step", panOf(f));
    } else setState(f, "stand");
  }
  function dirs(f) {
    var l = input.isDown("left"), r = input.isDown("right");
    return { up: input.isDown("up"), down: input.isDown("down"), toward: f.facing > 0 ? r : l, away: f.facing > 0 ? l : r };
  }

  // ---------------------------------------------------------------- CPU opponent
  var RANGE = {
    reverse: [80, 160], revcrouch: [90, 170], upper: [85, 155], lunge: [140, 230], upperlunge: [145, 235],
    front: [110, 192], lowkick: [95, 175], round: [78, 155], back: [106, 186], turnback: [110, 195],
    backround: [120, 230], sweep: [92, 205], revsweep: [92, 200], jumpside: [135, 235], jumpback: [135, 235],
    punch: [80, 160], lowpunch: [90, 170], jump: [135, 235]
  };
  var AI = { next: 0, walk: 0, walkT: 0, guard: null, guardT: 0, pending: null, seen: -1, now: 0 };
  function resetAI() { AI.next = 0.4; AI.walk = 0; AI.walkT = 0; AI.guard = null; AI.guardT = 0; AI.pending = null; AI.seen = P.moveId; }
  function pickWeighted(list) { var tot = 0; list.forEach(function (m) { tot += m[1]; }); var r = Math.random() * tot; for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; } return list[0] && list[0][0]; }
  function cpuControl(dt) {
    var f = E, o = P, c = lvl.cpu, dist = Math.abs(o.x - f.x);
    AI.now += dt;
    // notice the player's attack and plan a reply after the reaction time
    if (o.state === "move" && o.moveId !== AI.seen) { AI.seen = o.moveId; AI.pending = { at: AI.now + (Math.random() < c.smart * 0.55 ? 0.03 : c.react * (0.8 + Math.random() * 0.4)), id: o.move, mid: o.moveId }; }
    if (o.state === "flip" && AI.seen !== -o.moveId - 1000) { AI.seen = -o.moveId - 1000; }
    if (f.state === "air") { if (dist < 230 && Math.random() < c.aggr * dt * 6) startMove(f, "jump", true); return; }
    if (!canAct(f)) return;
    if (AI.pending && AI.now >= AI.pending.at) {
      var pd = AI.pending; AI.pending = null;
      if (o.state === "move" && o.moveId === pd.mid && o.mt < o.mdur * C.MOVES[pd.id].active[1] && dist < 270) {
        var h = C.MOVES[pd.id].h, r = Math.random();
        if (r < c.smart) {
          if (h === "high") { if (Math.random() < c.aggr * 0.8 && dist < 205) { startMove(f, Math.random() < 0.5 ? "sweep" : "revcrouch"); return; } AI.guard = "crouch"; AI.guardT = 0.5; }
          else if (h === "low") { if (Math.random() < c.aggr * 0.7) { startMove(f, "jumpside"); return; } startJump(f, 0); return; }
          else { AI.guard = "block"; AI.guardT = 0.42; }
        } else if (r < c.smart + c.block * (1 - c.smart)) { AI.guard = h === "low" ? "lowblock" : "block"; AI.guardT = 0.4; }
      }
    }
    if (AI.guard) {
      AI.guardT -= dt;
      setState(f, AI.guard);
      if (AI.guardT <= 0) { AI.guard = null; setState(f, "stand"); }
      return;
    }
    if (AI.walkT > 0) {
      AI.walkT -= dt;
      var sp = (AI.walk === f.facing ? 230 : 200) * f.speed * dt;
      if (walkOK(f, AI.walk * sp)) { f.x += AI.walk * sp; f.walk += dt * 11 * AI.walk * f.facing; }
      setState(f, "walk");
      if (AI.walkT <= 0) setState(f, "stand");
    } else if (f.state === "walk") setState(f, "stand");
    // punish a whiffed attack while the player is still recovering
    if (o.state === "move" && o.mt > o.mdur * C.MOVES[o.move].active[1] && AI.punish !== o.moveId) {
      AI.punish = o.moveId;
      if (Math.random() < c.smart * 0.9) { var pm = bestMove(dist, o); if (pm) { startMove(f, pm); return; } }
    }
    if (AI.now < AI.next) return;
    AI.next = AI.now + Math.max(0.06, c.react * 0.4 + Math.random() * 0.2);
    var threat = 205, r2 = Math.random();
    var near = f.x < BOUNDS[0] + 60 || f.x > BOUNDS[1] - 60;
    if (near && dist < 170 && Math.random() < c.smart * 0.3) { startFlip(f, false); return; }
    if (dist <= threat) {
      if (o.state === "move") return; // its reply is already planned
      if (r2 < c.aggr * 0.85) {
        var pick = bestMove(dist, o);
        if (pick) {
          var mv = C.MOVES[pick];
          if (mv.power > 1 && dist < mv.full - 6 && Math.random() < c.range * 0.6) { AI.walk = -f.facing; AI.walkT = 0.1 + Math.random() * 0.1; return; }
          startMove(f, pick); return;
        }
      }
      if (r2 < c.aggr * 0.85 + c.block * 0.6) { AI.guard = Math.random() < 0.72 ? "block" : "lowblock"; AI.guardT = 0.22 + Math.random() * 0.28; return; }
      if (Math.random() < c.smart) { AI.walk = -f.facing; AI.walkT = 0.12 + Math.random() * 0.14; return; }
      if (dist < 105 && Math.random() < 0.6) { AI.walk = -f.facing; AI.walkT = 0.2; }
      return;
    }
    // outside the player's reach: careful fighters hover at the edge and dash in; green ones just walk in
    if (dist < 245 && (lvl.moves.jumpside || lvl.moves.jump) && Math.random() < c.aggr * 0.35) { startMove(f, "jumpside"); return; }
    if (dist < 260 && Math.random() < c.smart * 0.55) { if (Math.random() < 0.3) { AI.walk = -f.facing; AI.walkT = 0.1; } return; }
    if (r2 < 0.5 + c.aggr * 0.45) { AI.walk = f.facing; AI.walkT = 0.12 + Math.random() * 0.25; }
  }
  function bestMove(dist, o) {
    var c = lvl.cpu, opts = [];
    for (var id in lvl.moves) { var rg = RANGE[id]; if (rg && dist >= rg[0] && dist <= rg[1]) opts.push([id, lvl.moves[id]]); }
    var oppDown = o.state === "crouch" || o.state === "lowblock", oppAir = o.y < -40;
    if (oppDown) opts = opts.filter(function (m) { return m[0] !== "round" && m[0] !== "upper" && m[0] !== "upperlunge"; });
    if (oppAir) opts = opts.filter(function (m) { return m[0] === "reverse" || m[0] === "round" || m[0] === "jumpside" || m[0] === "upper"; });
    opts.forEach(function (m) {
      var mv = C.MOVES[m[0]];
      if (o.state === "block" && mv.h === "low") m[1] *= 1 + 4 * c.smart;
      if (o.state === "lowblock" && mv.h === "high") m[1] *= 1 + 4 * c.smart;
      if (mv.power > 1 && dist >= mv.full) m[1] *= 1 + 2 * c.range; // from the tip of the reach: a full point
    });
    return opts.length ? pickWeighted(opts) : null;
  }

  // ---------------------------------------------------------------- hits, the referee's call and bouts
  function strikeOf(f) {
    if (f.state !== "move" || f.hitDone) return null;
    var u = f.mt / f.mdur; if (!C.inActive(f.move, u)) return null;
    var w = world(f), pt = C.strikePoint(f.move, w);
    f.trail.push(pt); if (f.trail.length > 6) f.trail.shift();
    var o = other(f); if (o.state === "down" || o.state === "hit") return null;
    var hit = C.hitTest(pt, world(o));
    return hit ? { f: f, o: o, pt: pt, zone: hit.zone } : null;
  }
  function guardOf(f) { return f.state === "block" || f.state === "blockstun" ? "block" : f.state === "lowblock" ? "lowblock" : null; }
  function resolveHits() {
    var a = strikeOf(P), b = strikeOf(E);
    if (a && b) { // both land together: a clash, nobody scores
      [P, E].forEach(function (f) { f.hitDone = true; f.mt = Math.max(f.mt, f.mdur * C.MOVES[f.move].active[1]); f.x -= f.facing * 40; });
      AU.play("block", 0); G.sparks.push({ x: (a.pt.x + b.pt.x) / 2, y: (a.pt.y + b.pt.y) / 2, t: 0, big: false }); say("AIUCHI!", "stop", 0.9); return;
    }
    var s = a || b; if (!s) return;
    var f = s.f, o = s.o, m = C.MOVES[f.move];
    s.f.hitDone = true;
    var facingAtt = o.facing === (f.x > o.x ? 1 : -1);
    var g = guardOf(o);
    if (g && facingAtt && C.blocks(g, m.h)) {
      f.mt = Math.max(f.mt, f.mdur * m.active[1]); f.x -= f.facing * 36; o.x += f.facing * 18; setState(o, g === "block" ? "blockstun" : "lowblock");
      AU.play("block", panOf(o)); G.sparks.push({ x: s.pt.x, y: s.pt.y, t: 0, big: false, block: true });
      return;
    }
    var counter = o.state === "move" && o.mt < o.mdur * C.MOVES[o.move].active[1];
    var dist = Math.abs(f.x - o.x), v = C.judge(f.move, dist, counter);
    if (DEBUG) (G.events = G.events || []).push(f.side + ":" + f.move + ":" + v.halves + "/" + v.score + " vs " + o.state + (o.move ? "/" + o.move : "") + " d" + (dist | 0) + " t" + G.timer.toFixed(1));
    awardPoint(f, o, v, s.pt, counter);
  }
  function awardPoint(f, o, verdict, pt, counter) {
    // verdict: { halves, score } from C.judge, or a legacy number 1|2
    var v = typeof verdict === "number" ? { halves: verdict, score: verdict === 2 ? 1000 : 400 } : verdict;
    G.halves[f.side] += v.halves;
    G.attackScore[f.side] += v.score;
    G.lastHit = f.side;
    if (f === P) { var pts = C.pointsFor(v.halves, G.level, v.score); G.score += pts; G.floats.push({ x: pt.x, y: pt.y - 30, s: "+" + pts, t: 0 }); updateHigh(); }
    setState(o, "hit"); o.vx = f.facing * (v.halves === 2 ? 420 : 300); o.move = null;
    G.freeze = v.halves === 2 ? 0.16 : 0.1; G.shake = v.halves === 2 ? 10 : 5; G.flash = v.halves === 2 ? 0.18 : 0.08;
    G.sparks.push({ x: pt.x, y: pt.y, t: 0, big: v.halves === 2 });
    AU.play(v.halves === 2 ? "hitBig" : "hit", panOf(o)); if (f.kiai || v.halves === 2) AU.play("kiai", panOf(f), f === E);
    setTimeout(function () { AU.play("fall", panOf(o)); }, 380);
    setTimeout(function () { AU.play("point", v.halves === 2); }, 520);
    G.ref.flagSide = f.x > 640 ? 1 : -1;
    var call = v.halves === 2 ? (counter ? "COUNTER! FULL POINT" : "FULL POINT!") : "HALF POINT!";
    say(call + "  +" + v.score, G.ref.flagSide > 0 ? "pointR" : "pointL", 2.2);
    G.mode = "point"; G.modeT = 0; G.pointBy = f.side;
  }
  function say(msg, pose, t) { G.ref.msg = msg; G.ref.pose = pose || "idle"; G.ref.msgT = t || 1.6; }

  function placeFighters() {
    P.x = 380; E.x = 900; P.y = E.y = 0; P.vx = E.vx = P.vy = E.vy = 0; P.facing = 1; E.facing = -1;
    P.state = E.state = "stand"; P.move = E.move = null; P.pose = C.mix(C.POSES.stance, C.POSES.stance, 0); E.pose = C.mix(C.POSES.stance, C.POSES.stance, 0);
    P.trail = []; E.trail = []; resetAI(); input.clear();
  }
  function startBout(n, short) {
    G.level = n; lvl = LV.LEVELS[n - 1]; E.speed = lvl.cpu.speed;
    if (!short) { G.halves = { p: 0, c: 0 }; G.attackScore = { p: 0, c: 0 }; G.lastHit = null; G.timer = C.BOUT_TIME; }
    placeFighters();
    if (!short) { P.state = E.state = "bow"; }
    G.mode = "intro"; G.modeT = short ? 0.9 : 0; G.introShort = !!short;
    say(short ? "" : "BOUT " + n + ": " + lvl.opp.toUpperCase(), "idle", short ? 0.1 : 1.3);
    music();
  }
  function startGame(n) {
    G.score = 0; G.lives = 3; G.newHigh = false; G.startLevel = n; G.paused = false; ov.hide();
    if (!tipSeen) { tipSeen = true; K.store.set("karate-champ.tipSeen", true); G.showTip = 6; }
    startBout(n, false);
  }
  function endBout(winner, why) {
    G.mode = "boutEnd"; G.modeT = 0; G.boutWinner = winner;
    var wf = winner === "player" ? P : E, lf = other(wf);
    setState(wf, "win"); if (lf.state !== "down") setState(lf, "kneel");
    G.ref.flagSide = wf.x > 640 ? 1 : -1;
    say((winner === "player" ? "WHITE" : "RED") + " WINS" + (why ? " ON " + why : "!"), G.ref.flagSide > 0 ? "pointR" : "pointL", 3);
    if (winner === "player") {
      var bonus = Math.ceil(G.timer) * 100; G.score += bonus; G.timeBonus = bonus; updateHigh();
      if (G.level + 1 > maxLevel && G.level < MAX_LEVEL) { maxLevel = G.level + 1; K.store.set("karate-champ.maxLevel", maxLevel); }
      AU.music("win"); setTimeout(function () { AU.play("cheer"); }, 300);
    } else { AU.music("over"); }
    AU.play("gong");
  }
  function afterBout() {
    if (G.boutWinner === "player") {
      var spec = lvl.bonus ? LV.bonusSpec(lvl.bonus, G.level) : null;
      if (spec && G.level < MAX_LEVEL) { startBonus(spec); return; }
      levelWonSplash();
    } else {
      G.lives--;
      if (G.lives <= 0) {
        showSplash({ tag: "gameover", title: "GAME OVER", sub: "Bout " + G.level + " vs " + lvl.opp + "  \u00b7  Score " + G.score, contLabel: "Continue" }, function () { G.mode = "gameover"; G.modeT = 0; music(); showEndOverlay(); });
      } else {
        showSplash({ tag: "lost-l" + G.level, title: "BOUT " + G.level + " LOST", sub: lvl.opp + " took it. " + G.lives + (G.lives === 1 ? " try" : " tries") + " left.", contLabel: "Rematch" }, function () { startBout(G.level, false); });
      }
    }
  }
  function levelWonSplash() {
    if (G.level >= MAX_LEVEL) {
      showSplash({ tag: "victory", title: "GRAND CHAMPION!", sub: "All twelve bouts won  \u00b7  Score " + G.score, contLabel: "Victory" }, function () { victory(); });
      return;
    }
    showSplash({ tag: "level" + G.level, title: "BOUT " + G.level + " WON", sub: lvl.opp + " defeated  \u00b7  Score " + G.score, contLabel: "Next bout" }, function () { startBout(G.level + 1, false); });
  }
  function victory() {
    G.mode = "victory"; G.modeT = 0; updateHigh();
    placeFighters(); P.x = 520; P.facing = 1; setState(P, "win"); E.x = 2000;
    say("", "pointL", 99); G.ref.flagSide = -1;
    AU.music("victory"); AU.play("gong"); AU.play("cheer"); showEndOverlay();
  }
  function showEndOverlay() {
    ov.show({ primary: { label: "Play again", onClick: function () { ov.hide(); startGame(1); } }, secondary: { label: "Title screen", onClick: toTitle } });
  }
  function toTitle() { ov.hide(); G.paused = false; G.mode = "title"; G.modeT = 0; placeFighters(); if (!portrait) { P.x = 215; E.x = 1065; } E.speed = 1; say("", "idle", 0); music(); }
  function updateHigh() { if (G.score > highScore) { highScore = G.score; G.newHigh = true; K.store.set("karate-champ.high", highScore); } }
  function showSplash(opts, cb) {
    var done = function () { G.splash = false; AU.duck(false); G.inputLock = performance.now() + 350; input.clear(); cb(); };
    if (!window.ScoutSplash || !window.ScoutSplash.show) { done(); return; }
    G.splash = true; AU.duck(true); AU.music("title");
    window.ScoutSplash.show({ kind: "karate-champ", campaign: "karate-champ", tag: opts.tag, title: opts.title, sub: opts.sub, contLabel: opts.contLabel,
      accent: "#e8433a", glow: "rgba(232,67,58,.28)", onContinue: done });
  }
  function music() {
    if (G.paused) { AU.duck(true); return; }
    AU.duck(false);
    var m = G.mode;
    if (G.splash || m === "title") AU.music("title");
    else if (m === "intro" || m === "fight" || m === "point") AU.music("play", G.level);
    else if (m === "bonus") AU.music("bonus");
    else if (m === "victory") AU.music("victory");
  }

  // ---------------------------------------------------------------- bonus rounds
  function startBonus(spec) {
    G.mode = "bonus"; G.modeT = 0; G.bonus = { spec: spec, t: 0, done: false, score: 0, objs: [], next: 1.2, broke: 0, dodged: 0, bumps: 0, meter: 0, mdir: 1, hits: 0, bull: null, msg: "" };
    placeFighters(); E.x = 3000;
    var B = G.bonus;
    if (spec.kind === "boards") { P.x = 520; P.facing = 1; B.msg = "BREAK THE BOARDS! Strike at the top of the meter."; }
    if (spec.kind === "objects") { P.x = 640; P.facing = 1; B.msg = "DODGE OR SMASH THE OBJECTS! Jump, crouch, kick and punch."; }
    if (spec.kind === "bull") { P.x = 380; P.facing = 1; B.bull = { x: 1500, dir: -1, speed: spec.speed, stun: 0, wait: 1.4 }; B.msg = "STOP THE CHARGING BULL! Strike it " + spec.hits + " times."; }
    say("BONUS ROUND", "begin", 2); AU.play("gong"); music();
  }
  function bonusUpdate(dt) {
    var B = G.bonus, sp = B.spec; B.t += dt;
    if (B.done) { B.doneT += dt; if (P.state !== "chop") physics(P, dt); updatePose(P, dt); if (B.crackT) B.crackT += dt; if (B.bull && B.bull.stun <= 0) B.bull.x += B.bull.dir * B.bull.speed * dt; if (B.doneT > 2.6) finishBonus(); return; }
    if (sp.kind === "boards") {
      if (P.state !== "chop") {
        B.meter += B.mdir * dt * sp.meterSpeed; if (B.meter > 1) { B.meter = 1; B.mdir = -1; } if (B.meter < 0) { B.meter = 0; B.mdir = 1; }
        if (Math.random() < dt * 12) AU.play("meter", B.meter);
        if (B.t > 0.6 && (input.hit("kick") || input.hit("rright") || input.hit("rup") || input.hit("rdown") || input.hit("rleft") || input.hit("start") || B.t > 9)) { P.state = "chop"; P.mt = 0; P.mdur = C.MOVES.chop.t; B.power = B.meter; AU.play("whooshBig", 0); AU.play("kiai", 0, false); }
      } else {
        P.mt += dt;
        if (P.mt >= P.mdur * 0.44 && !B.struck) {
          B.struck = true; var acc = Math.pow(B.power, 1.6); B.broke = Math.max(B.power > 0.15 ? 1 : 0, Math.round(sp.boards * acc));
          B.score = B.broke * 300 + (B.broke === sp.boards ? 2000 : 0); B.crackT = 0.001; G.shake = 6 + B.broke;
          if (B.broke) AU.play("crack"); else AU.play("bump", 0);
          for (var i = 0; i < B.broke * 3; i++) G.debris.push({ x: 700 + (Math.random() - 0.5) * 160, y: FLOOR - 110 - Math.random() * 60, vx: (Math.random() - 0.5) * 400, vy: -200 - Math.random() * 300, r: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: "#d8b07a", life: 1.4 });
          endBonus((B.broke === sp.boards ? "PERFECT! " : "") + B.broke + " OF " + sp.boards + " BOARDS");
        }
      }
      if (B.crackT) B.crackT += dt;
      updatePose(P, dt);
      return;
    }
    // objects and bull: free movement on the spot, facing by direction
    bonusControl(dt);
    physics(P, dt); updatePose(P, dt);
    if (sp.kind === "objects") {
      B.next -= dt;
      if (B.t < sp.time && B.next <= 0) {
        B.next = sp.rate * (0.6 + Math.random() * 0.7);
        var fromL = Math.random() < 0.5, hgt = [210, 140, 52][(Math.random() * 3) | 0];
        B.objs.push({ x: fromL ? -40 : W + 40, y: FLOOR - hgt, vx: (fromL ? 1 : -1) * sp.speed * (0.85 + Math.random() * 0.3), spin: 0, type: (Math.random() * 3) | 0 });
        AU.play("throwIt", fromL ? -0.8 : 0.8);
      }
      var w = world(P), segs = C.hurtSegs(w), strike = null;
      if (P.state === "move" && C.inActive(P.move, P.mt / P.mdur)) strike = C.strikePoint(P.move, w);
      B.objs = B.objs.filter(function (o) {
        o.x += o.vx * dt; o.spin += dt * 6 * Math.sign(o.vx);
        if (strike && Math.hypot(strike.x - o.x, strike.y - o.y) < 52) { B.broke++; B.score += 300; smash(o); AU.play("shatter", (o.x - 640) / 700); G.floats.push({ x: o.x, y: o.y - 30, s: "+300", t: 0 }); return false; }
        for (var i = 0; i < segs.length; i++) { var sg = segs[i]; var dd = segDist(o.x, o.y, sg[0], sg[1]); if (dd < sg[2] + 18) { B.bumps++; smash(o); AU.play("bump", 0); setState(P, "hit"); P.vx = -Math.sign(o.vx) * -120; G.shake = 5; return false; } }
        if (o.x < -80 || o.x > W + 80) { B.dodged++; B.score += 100; return false; }
        return true;
      });
      if (P.state === "hit" && P.stateT > 0.3) setState(P, "stand");
      if (B.t >= sp.time && !B.objs.length) { if (!B.bumps) B.score += 2000; endBonus(B.broke + " SMASHED  \u00b7  " + B.dodged + " DODGED" + (B.bumps ? "" : "  \u00b7  UNTOUCHED!")); }
    }
    if (sp.kind === "bull") {
      var b = B.bull;
      if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) AU.play("moo", 0.6); }
      else if (b.stun > 0) { b.stun -= dt; b.x += 260 * dt * (b.stun > 0.5 ? 1 : 0); if (b.stun <= 0) AU.play("moo", 0.5); }
      else {
        b.x += b.dir * b.speed * dt; if (Math.random() < dt * 6) AU.play("hooves", (b.x - 640) / 700);
        var w2 = world(P);
        if (P.state === "move" && C.inActive(P.move, P.mt / P.mdur) && !P.hitDone) {
          var st = C.strikePoint(P.move, w2);
          if (st.x > b.x - 190 && st.x < b.x - 60 && st.y > FLOOR - 250 && st.y < FLOOR - 50) {
            P.hitDone = true; B.hits++; b.stun = 0.9; B.score += 1000; G.shake = 9; AU.play("hitBig", 0.2); G.sparks.push({ x: st.x, y: st.y, t: 0, big: true });
            G.floats.push({ x: st.x, y: st.y - 30, s: "+1000", t: 0 });
            if (B.hits >= sp.hits) { B.score += 3000; endBonus("THE BULL IS STOPPED!"); b.stun = 99; }
          }
        }
        if (b.x - 80 < P.x && !B.done) { setState(P, "hit"); P.vx = -520; AU.play("bump", 0); G.shake = 12; b.speed *= 1.5; endBonus("TOSSED BY THE BULL  \u00b7  " + B.hits + " HITS"); }
      }
      if (B.t > sp.time && !B.done) endBonus("TIME  \u00b7  " + B.hits + " HITS");
    }
  }
  function bonusControl(dt) {
    var f = P;
    if (f.state === "air") {
      if (input.hit("kick") || input.hit("rright") || input.hit("rup") || input.hit("rleft") || input.hit("rdown")) startMove(f, "jumpside", true);
      f.vx = 0; return;
    }
    if (!canAct(f)) return;
    if (G.bonus.spec.kind === "objects") { if (input.isDown("left")) f.facing = -1; if (input.isDown("right")) f.facing = 1; }
    var right = "n";
    if (input.hit("rright") || input.hit("kick")) right = "r";
    else if (input.hit("rleft")) right = "l";
    else if (input.hit("rup")) right = "u";
    else if (input.hit("rdown")) right = "d";
    if (right !== "n") {
      var left = input.isDown("up") ? "u" : input.isDown("down") ? "d" : "n";
      var cmd = C.dualCommand(left, right, false);
      if (cmd.type === "move" && C.MOVES[cmd.id]) { startMove(f, cmd.id); if (C.MOVES[cmd.id].air) f.vx = 0; return; }
    }
    if (input.hit("up")) { startJump(f, 0); return; }
    if (input.isDown("down")) setState(f, "crouch"); else setState(f, "stand");
  }
  function segDist(px, py, a, b) { var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0; t = K.clamp(t, 0, 1); return Math.hypot(a.x + dx * t - px, a.y + dy * t - py); }
  function smash(o) { var cols = ["#a8582a", "#e8eef4", "#b08850"]; for (var i = 0; i < 9; i++) G.debris.push({ x: o.x, y: o.y, vx: (Math.random() - 0.5) * 500, vy: -150 - Math.random() * 350, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, c: cols[o.type], life: 1.2 }); }
  function endBonus(msg) { var B = G.bonus; if (B.done) return; B.done = true; B.doneT = 0; B.result = msg; G.score += B.score; updateHigh(); AU.play("point", true); say("BONUS " + B.score, "begin", 2.6); }
  function finishBonus() { G.bonus = null; levelWonSplash(); }

  // ---------------------------------------------------------------- main update
  var PLAYING = { intro: 1, fight: 1, point: 1, boutEnd: 1, bonus: 1 };
  function update(dt) {
    G.t += dt;
    input.pollPad();
    if (input.hit("mute")) toggleMute();
    if (input.hit("pause")) { if (PLAYING[G.mode]) togglePause(); }
    updateFx(dt);
    if (G.ref.msgT > 0) { G.ref.msgT -= dt; if (G.ref.msgT <= 0 && G.mode !== "victory") { G.ref.msg = ""; G.ref.pose = "idle"; } }
    if (G.paused || G.splash || settingsOpen) { input.clear(); return; }
    if (performance.now() < G.inputLock) input.clear();
    if (G.showTip > 0) G.showTip -= dt;
    G.modeT += dt;
    var m = G.mode;
    if (m === "title") { titleUpdate(dt); return; }
    if (m === "gameover" || m === "victory") {
      if (m === "victory") { physics(P, dt); updatePose(P, dt); if (Math.random() < dt * 3) G.sparks.push({ x: 200 + Math.random() * 880, y: 80 + Math.random() * 260, t: 0, big: true, fire: true }); }
      if (G.modeT > 1.2 && (input.hit("start") || input.hit("kick") || input.hit("rright"))) startGame(1);
      input.clear(); return;
    }
    if (m === "bonus") { bonusUpdate(dt); input.clear(); return; }
    if (G.freeze > 0) { G.freeze -= dt; return; }
    if (m === "intro") {
      if (!G.introShort && G.modeT > 1.0 && P.state === "bow") { P.state = E.state = "stand"; }
      if (G.modeT > 1.25 && G.ref.pose !== "begin" && !G.began) { say("BEGIN!", "begin", 0.9); AU.play("whistle"); G.began = true; }
      if (G.modeT > 1.9) { G.mode = "fight"; G.modeT = 0; G.began = false; input.clear(); }
      [P, E].forEach(function (f) { physics(f, dt); updatePose(f, dt); });
      input.clear(); return;
    }
    if (m === "fight") {
      var before = Math.ceil(G.timer);
      G.timer = Math.max(0, G.timer - dt);
      if (Math.ceil(G.timer) !== before && G.timer <= 5 && G.timer > 0) AU.play("tick");
      playerControl(dt); if (!G.cpuOff) cpuControl(dt);
      [P, E].forEach(function (f) { physics(f, dt); });
      faceEachOther();
      [P, E].forEach(function (f) { updatePose(f, dt); });
      resolveHits();
      if (G.mode === "fight" && G.timer <= 0) timeUp();
      input.clear(); return;
    }
    if (m === "point") {
      [P, E].forEach(function (f) { physics(f, dt); updatePose(f, dt); });
      if (G.modeT > 2.1) { var w = C.boutOver(G.halves.p, G.halves.c); if (w) endBout(w, null); else startBout(G.level, true); }
      input.clear(); return;
    }
    if (m === "boutEnd") {
      [P, E].forEach(function (f) { physics(f, dt); updatePose(f, dt); });
      if (G.modeT > 3.2) { G.mode = "between"; afterBout(); }
      input.clear(); return;
    }
    input.clear();
  }
  function timeUp() {
    AU.play("whistle");
    var d = C.timeDecision(G.halves.p, G.halves.c, G.attackScore.p, G.attackScore.c, G.lastHit);
    if (d === "draw") { say("TIME! DRAW \u2014 REMATCH", "stop", 2); G.mode = "point"; G.modeT = 0.2; G.halves = { p: 0, c: 0 }; G.attackScore = { p: 0, c: 0 }; G.lastHit = null; G.timer = C.BOUT_TIME; return; }
    endBout(d, "DECISION");
  }
  function updateFx(dt) {
    G.sparks = G.sparks.filter(function (s) { s.t += dt; return s.t < (s.fire ? 1.1 : 0.35); });
    G.debris = G.debris.filter(function (d) { d.life -= dt; d.vy += 1400 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; if (d.y > FLOOR + 6) { d.y = FLOOR + 6; d.vy *= -0.3; d.vx *= 0.6; } return d.life > 0; });
    G.floats = G.floats.filter(function (f) { f.t += dt; f.y -= dt * 50; return f.t < 1.3; });
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt);
  }
  // title: the two fighters spar for show while you choose a starting bout
  var demoT = 0;
  function titleUpdate(dt) {
    demoT -= dt;
    if (demoT <= 0) { demoT = 1.1 + Math.random() * 0.9; var f = Math.random() < 0.5 ? P : E; if (canAct(f)) { var ids = ["front", "round", "back", "sweep", "reverse", "jumpside", "lunge", "backround"]; startMove(f, ids[(Math.random() * ids.length) | 0]); f.hitDone = true; } }
    [P, E].forEach(function (f) { f.hitDone = true; physics(f, dt); updatePose(f, dt); });
    faceEachOther();
    if (input.hit("left")) { G.startLevel = Math.max(1, G.startLevel - 1); AU.play("select"); }
    if (input.hit("right")) { G.startLevel = Math.min(maxLevel, G.startLevel + 1); AU.play("select"); }
    if (G.modeT > 0.4 && (input.hit("kick") || input.hit("start") || input.hit("rright") || input.hit("rup"))) { AU.play("gong"); startGame(G.startLevel); }
    input.clear();
  }

  // ---------------------------------------------------------------- drawing
  function draw() {
    var x = ctx, k = G.k;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = "#07060a"; x.fillRect(0, 0, canvas.width, canvas.height);
    x.setTransform(k, 0, 0, k, 0, 0);
    var stageName = (G.mode === "title") ? "dojo" : G.mode === "victory" ? "arena" : lvl.stage;
    // camera: whole arena in landscape, follow the fighters in portrait
    var camX = 0;
    if (portrait) { var mid = G.mode === "bonus" && G.bonus && G.bonus.spec.kind !== "objects" ? (G.bonus.spec.kind === "boards" ? 610 : P.x + 230) : E.x > 1500 ? P.x : (P.x + E.x) / 2; camX = K.clamp(mid - LW / 2, 0, W - LW); }
    var sx = G.shake ? (Math.random() - 0.5) * G.shake : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
    x.save(); x.translate(-camX + sx, SCENE_Y + sy);
    var bg = R.stage(stageName, artQ);
    x.drawImage(bg, 0, 0, W, R.H);
    if (portrait) { x.drawImage(bg, 0, bg.height - 4, bg.width, 4, 0, R.H - 1, W, LH - SCENE_Y - R.H + 20); x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(0, R.H, W, LH); }
    R.ambient(x, stageName, G.t);
    drawReferee(x);
    if (G.mode === "bonus" && G.bonus) drawBonusBack(x);
    var order = (P.state === "move" || P.state === "flip") ? [E, P] : [P, E];
    order.forEach(function (f) { if (f.x < 1500) drawFighter(x, f); });
    if (G.mode === "bonus" && G.bonus) drawBonusFront(x);
    G.debris.forEach(function (d) { x.save(); x.translate(d.x, d.y); x.rotate(d.r); x.fillStyle = d.c; x.globalAlpha = Math.min(1, d.life * 2); x.fillRect(-7, -4, 14, 8); x.restore(); });
    G.sparks.forEach(function (s) { R.spark(x, s.x, s.y, 1 - s.t / (s.fire ? 1.1 : 0.35), s.big); });
    x.font = "900 30px system-ui, sans-serif"; x.textAlign = "center";
    G.floats.forEach(function (f) { x.globalAlpha = Math.max(0, 1 - f.t / 1.3); x.lineWidth = 5; x.strokeStyle = "#000"; x.strokeText(f.s, f.x, f.y); x.fillStyle = "#ffd24a"; x.fillText(f.s, f.x, f.y); });
    x.globalAlpha = 1;
    drawBubble(x);
    x.restore();
    if (G.flash > 0) { x.fillStyle = "rgba(255,250,235," + (G.flash * 2.2).toFixed(3) + ")"; x.fillRect(0, SCENE_Y, LW, LH - SCENE_Y); }
    drawHUD(x);
    drawScreens(x);
  }
  function drawFighter(x, f) {
    var w = world(f);
    if (f.state === "move" && C.inActive(f.move, f.mt / f.mdur) && f.trail.length > 1) R.trail(x, f.trail, f === P ? "rgba(255,255,255,A)" : "rgba(255,140,120,A)");
    R.fighter(x, w, f === P ? R.PAL.white : R.PAL.red, { t: G.t + (f === P ? 0 : 2), belt: f === P ? "#151515" : (G.mode === "title" ? "#151515" : lvl.belt), look: f.state === "move" });
  }
  var REFP = null;
  function drawReferee(x) {
    if (G.mode === "bonus" || G.mode === "title") return;
    var base = { torso: 0.02, head: 0, fa: 0.15, fe: 0.1, ba: -0.12, be: 0.1, fl: 0.08, fk: -0.04, bl: -0.08, bk: -0.02, ff: 1.5, bf: 1.5, rot: 0, turn: 0, tilt: 0 };
    var poses = {
      idle: base,
      pointR: Object.assign({}, base, { fa: 2.35, fe: 0.05, torso: 0.08 }),
      pointL: Object.assign({}, base, { ba: -2.35, be: -0.05, torso: -0.08 }),
      begin: Object.assign({}, base, { fa: 1.45, fe: 0.1, ba: -1.45, be: -0.1 }),
      stop: Object.assign({}, base, { fa: 2.7, fe: -0.6, ba: -2.7, be: 0.6 })
    };
    var tp = poses[G.ref.pose] || base;
    REFP = REFP ? C.mix(REFP, tp, 0.2) : tp;
    var rf = { x: 640, y: -6, facing: 1 };
    var w = C.toWorld(rf, REFP, C.skeleton(REFP), FLOOR - 26);
    x.save(); x.translate(640, FLOOR - 58); x.scale(0.74, 0.74); x.translate(-640, -(FLOOR - 26));
    var leftCol = P.x < E.x ? "#f6f2e6" : "#c8282a", rightCol = P.x < E.x ? "#c8282a" : "#f6f2e6";
    if (G.mode === "victory") { leftCol = rightCol = "#f6f2e6"; }
    R.fighter(x, w, R.PAL.ref, { t: G.t, flags: [leftCol, rightCol], shadow: 0.7 });
    x.restore();
    G.refHead = { x: 640, y: FLOOR - 58 - (FLOOR - 26 - w.N.y) * 0.74 };
  }
  function drawBubble(x) {
    var msg = G.ref.msg; if (!msg || G.ref.msgT <= 0) return;
    var hx = 640, hy = G.mode === "bonus" || G.mode === "title" ? 150 : (G.refHead ? G.refHead.y - 60 : 300);
    x.font = "900 34px system-ui, -apple-system, sans-serif"; var tw = x.measureText(msg).width + 46, th = 58;
    if (portrait) hx = K.clamp(hx, (W - LW) / 2 + tw / 2, W - tw / 2);
    var bx = hx - tw / 2, by = hy - th;
    x.fillStyle = "rgba(255,252,240,0.96)"; x.strokeStyle = "#1a1410"; x.lineWidth = 4;
    x.beginPath(); x.moveTo(bx + 14, by); x.lineTo(bx + tw - 14, by); x.quadraticCurveTo(bx + tw, by, bx + tw, by + 14); x.lineTo(bx + tw, by + th - 14); x.quadraticCurveTo(bx + tw, by + th, bx + tw - 14, by + th);
    x.lineTo(hx + 12, by + th); x.lineTo(hx, by + th + 20); x.lineTo(hx - 8, by + th); x.lineTo(bx + 14, by + th); x.quadraticCurveTo(bx, by + th, bx, by + th - 14); x.lineTo(bx, by + 14); x.quadraticCurveTo(bx, by, bx + 14, by); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = /FULL|WINS|CHAMPION/.test(msg) ? "#b8141a" : "#1a1410"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(msg, hx, by + th / 2 + 2); x.textBaseline = "alphabetic";
  }
  function drawBonusBack(x) {
    var B = G.bonus;
    if (B.spec.kind === "boards") R.boards(x, 700, B.spec.boards, B.broke, B.crackT || 0);
  }
  function drawBonusFront(x) {
    var B = G.bonus;
    if (B.spec.kind === "objects") B.objs.forEach(function (o) { R.object(x, o); });
    if (B.spec.kind === "bull" && B.bull) R.bull(x, B.bull, G.t);
  }
  function txt(x, s, px, py, size, col, align, weight) {
    x.font = (weight || 900) + " " + size + "px system-ui, -apple-system, 'Segoe UI', sans-serif"; x.textAlign = align || "center";
    x.lineWidth = Math.max(3, size / 6); x.strokeStyle = "rgba(0,0,0,0.85)"; x.lineJoin = "round"; x.strokeText(s, px, py); x.fillStyle = col || "#fff"; x.fillText(s, px, py);
  }
  function fit(x, s, size, maxW, weight) { x.font = (weight || 900) + " " + size + "px system-ui, sans-serif"; var w = x.measureText(s).width; return w > maxW ? Math.floor(size * maxW / w) : size; }
  function drawHUD(x) {
    if (G.mode === "title") return;
    var top = portrait ? 0 : 0, hh = portrait ? 200 : 96;
    x.fillStyle = portrait ? "#0d0b10" : "rgba(8,6,10,0.55)"; x.fillRect(0, top, LW, hh);
    x.fillStyle = "rgba(232,67,58,0.7)"; x.fillRect(0, top + hh - 3, LW, 3);
    var cx = LW / 2, sz = portrait ? 1.25 : 1;
    if (G.mode === "bonus" && G.bonus) {
      var B = G.bonus;
      txt(x, "BONUS ROUND", cx, top + 40 * sz, 30 * sz, "#ffd24a");
      txt(x, "SCORE " + (G.score + (B.done ? 0 : B.score)), cx, top + 76 * sz, 22 * sz, "#fff", "center", 800);
      var s = B.done ? B.result : B.msg; txt(x, s, cx, top + hh + 34, fit(x, s, 24, LW - 30, 800), B.done ? "#ffd24a" : "#fff", "center", 800);
      if (B.spec.kind === "boards" && !B.done) { // power meter
        var mx = portrait ? LW / 2 - 30 : 1000, my = top + hh + 80, mh = 300;
        x.fillStyle = "rgba(0,0,0,0.6)"; x.fillRect(mx, my, 60, mh); x.strokeStyle = "#e8d8a8"; x.lineWidth = 3; x.strokeRect(mx, my, 60, mh);
        var g = x.createLinearGradient(0, my + mh, 0, my); g.addColorStop(0, "#2a6"); g.addColorStop(0.7, "#ec3"); g.addColorStop(1, "#e33"); x.fillStyle = g;
        var v = P.state === "chop" ? B.power : B.meter; x.fillRect(mx + 6, my + mh - (mh - 12) * v - 6, 48, (mh - 12) * v);
        txt(x, "POWER", mx + 30, my - 12, 20, "#ffd24a");
      }
      if (B.spec.kind === "objects" && !B.done) txt(x, Math.ceil(Math.max(0, B.spec.time - B.t)) + "", portrait ? LW - 60 : LW - 80, top + 60 * sz, 44 * sz, "#fff");
      if (B.spec.kind === "bull" && !B.done) txt(x, "HITS " + B.hits + " / " + B.spec.hits, portrait ? LW - 110 : LW - 140, top + 60 * sz, 28 * sz, "#fff");
      return;
    }
    if (G.mode === "victory" || G.mode === "gameover") return;
    var pad = portrait ? 18 : 24;
    // white (player) on the left, red (CPU) on the right
    txt(x, "WHITE", pad, top + 36 * sz, 26 * sz, "#f6f2e6", "left");
    txt(x, "SCORE " + G.score, pad, top + 70 * sz, 20 * sz, "#ffd24a", "left", 800);
    txt(x, "RED  " + lvl.opp.toUpperCase(), LW - pad, top + 36 * sz, fit(x, "RED  " + lvl.opp.toUpperCase(), 26 * sz, portrait ? LW * 0.3 : LW * 0.36), "#ff6a5a", "right");
    txt(x, "HI " + Math.max(highScore, G.score), LW - pad, top + 70 * sz, 20 * sz, "#e8d8a8", "right", 800);
    var r = 15 * sz, yy = top + (portrait ? 168 : 52);
    var pxs = portrait ? [pad + r, pad + r * 3.4] : [pad + 186 + r, pad + 186 + r * 3.4];
    var cxs = portrait ? [LW - pad - r * 3.4, LW - pad - r] : [LW - pad - 186 - r * 3.4, LW - pad - 186 - r];
    if (!portrait) { yy = top + 34; }
    R.yinyang(x, pxs[0], yy, r, Math.min(2, G.halves.p)); R.yinyang(x, pxs[1], yy, r, Math.max(0, G.halves.p - 2));
    R.yinyang(x, cxs[0], yy, r, Math.max(0, G.halves.c - 2)); R.yinyang(x, cxs[1], yy, r, Math.min(2, G.halves.c));
    // lives
    for (var i = 0; i < G.lives; i++) { x.fillStyle = "#f6f2e6"; x.beginPath(); x.arc((portrait ? pad + 110 : pxs[1] + 40) + i * 22 * sz, yy, 6 * sz, 0, 7); x.fill(); }
    // timer
    var tsec = Math.ceil(G.timer), tw = 92 * sz, th = 62 * sz, ty = top + (portrait ? 22 : 14);
    x.fillStyle = "#1a0a08"; x.strokeStyle = "#c9a24a"; x.lineWidth = 3; x.beginPath(); x.rect(cx - tw / 2, ty, tw, th); x.fill(); x.stroke();
    txt(x, String(tsec), cx, ty + th * 0.78, 48 * sz, tsec <= 5 ? "#ff5a4a" : "#ffe9a8");
    var bl = "BOUT " + G.level + " / 12  \u00b7  " + lvl.name;
    txt(x, bl, cx, portrait ? top + 132 : top + 92, fit(x, bl, 18 * sz, portrait ? LW * 0.46 : LW * 0.6, 800), "#e8d8a8", "center", 800);
    if (portrait) txt(x, lvl.beltName, cx, top + 160, fit(x, lvl.beltName, 18, LW * 0.4, 700), "#c9b88e", "center", 700);
    if (G.showTip > 0 && G.mode !== "title") {
      var tip = isTouch ? "Left pad moves. Right pad attacks (hold left + tap right). Away+right = back round. Up+right = jump kick." : "WASD = left stick (move). Arrows = right stick (attack). Away+\u2192 = back round. \u2191+\u2192 = jump side kick.";
      txt(x, tip, cx, portrait ? LH - 40 : LH - 24, fit(x, tip, 20, LW - 30, 700), "#ffe9a8", "center", 700);
    }
  }
  function drawScreens(x) {
    var cx = LW / 2, m = G.mode;
    if (m === "title") {
      x.fillStyle = "rgba(6,4,8,0.42)"; x.fillRect(0, 0, LW, LH);
      var ty = portrait ? 150 : 120, s1 = fit(x, "KARATE", portrait ? 120 : 132, LW * 0.9);
      x.save(); x.translate(cx, ty); x.transform(1, 0, -0.12, 1, 0, 0);
      x.font = "900 " + s1 + "px Georgia, 'Times New Roman', serif"; x.textAlign = "center"; x.lineWidth = 14; x.strokeStyle = "#1a0606"; x.strokeText("KARATE", 0, 0);
      var g = x.createLinearGradient(0, -s1, 0, 0); g.addColorStop(0, "#fff3d0"); g.addColorStop(0.5, "#f2c25a"); g.addColorStop(1, "#c8282a"); x.fillStyle = g; x.fillText("KARATE", 0, 0);
      x.font = "900 " + (s1 * 0.78 | 0) + "px Georgia, 'Times New Roman', serif"; x.strokeText("CHAMP", 0, s1 * 0.8); x.fillStyle = "#e8433a"; x.fillText("CHAMP", 0, s1 * 0.8);
      x.restore();
      txt(x, "THE TOURNAMENT OF TWELVE", cx, ty + s1 * 1.15, portrait ? 26 : 24, "#f6e2a8", "center", 800);
      var by = portrait ? 872 : 640;
      var go = isTouch ? "TAP ATTACK PAD TO BEGIN" : "PRESS SPACE OR \u2192 TO BEGIN";
      if (Math.sin(G.t * 5) > -0.3) txt(x, go, cx, by, portrait ? 40 : 36, "#ffffff");
      if (maxLevel > 1) txt(x, "\u2190  START AT BOUT " + G.startLevel + " OF " + maxLevel + " UNLOCKED  \u2192", cx, by + (portrait ? 42 : 40), portrait ? 22 : 20, "#ffd24a", "center", 800);
      txt(x, "HI SCORE " + highScore, cx, portrait ? ty + s1 * 1.15 + 40 : ty + s1 * 1.15 + 34, 20, "#e8d8a8", "center", 700);
      var help = isTouch ? ["LEFT pad: move, jump, crouch, retreat-block", "RIGHT pad: attacks. Hold left + tap right for combos", "Away+toward = back round kick  \u00b7  Up+toward = jump side kick", "Down+toward = foot sweep  \u00b7  First to 2 full points in 30 s"]
        : ["WASD left stick: \u2190 retreat/block  \u2192 approach  \u2191 jump  \u2193 crouch", "Arrow keys right stick: tap a direction to attack", "Away+\u2192 back round  \u00b7  \u2191+\u2192 jump side  \u00b7  \u2193+\u2192 sweep  \u00b7  toward alone = front/reverse", "Attack score \u2264500 = half point, \u2265600 = full  \u00b7  First to 2 full points in 30 s"];
      var hy = portrait ? 972 : 430, bw2 = portrait ? LW * 0.96 : 780;
      x.fillStyle = "rgba(0,0,0,0.6)"; x.fillRect(cx - bw2 / 2, hy - 28, bw2, help.length * 29 + 18);
      help.forEach(function (h, i) { txt(x, h, cx, hy + i * 29, fit(x, h, portrait ? 20 : 19, bw2 - 24, 700), "#f1e6c8", "center", 700); });
    }
    if (m === "gameover") {
      x.fillStyle = "rgba(6,4,8,0.6)"; x.fillRect(0, 0, LW, LH);
      var cy = LH / 2 - 60;
      txt(x, "GAME OVER", cx, cy, fit(x, "GAME OVER", 110, LW * 0.86), "#e8433a");
      txt(x, "Defeated at bout " + G.level + " by " + lvl.opp, cx, cy + 60, fit(x, "Defeated at bout 12 by Master Oyama", 28, LW * 0.9, 700), "#f6e2a8", "center", 700);
      txt(x, "Score " + G.score + (G.newHigh ? "  \u00b7  NEW HIGH SCORE!" : "  \u00b7  High " + highScore), cx, cy + 100, fit(x, "Score 000000  .  NEW HIGH SCORE!", 28, LW * 0.9, 800), "#ffd24a", "center", 800);
    }
    if (m === "victory") {
      x.fillStyle = "rgba(6,4,8,0.35)"; x.fillRect(0, portrait ? 0 : 0, LW, portrait ? SCENE_Y + 40 : 260);
      var vy = portrait ? 120 : 110, vs = fit(x, "GRAND CHAMPION", portrait ? 80 : 96, LW * 0.92);
      txt(x, "GRAND CHAMPION", cx, vy, vs, "#ffd24a");
      txt(x, "All twelve bouts won. The tournament is yours.", cx, vy + 50, fit(x, "All twelve bouts won. The tournament is yours.", 28, LW * 0.92, 700), "#fff3d0", "center", 700);
      txt(x, "Final score " + G.score + (G.newHigh ? "  \u00b7  NEW HIGH SCORE!" : ""), cx, vy + 90, fit(x, "Final score 000000  .  NEW HIGH SCORE!", 28, LW * 0.9, 800), "#ffe9a8", "center", 800);
      // trophy
      var tx = portrait ? cx : 980, tyy = portrait ? SCENE_Y + 330 : 420; x.save(); x.translate(tx, tyy);
      x.fillStyle = "#e8b83a"; x.strokeStyle = "#5a3a0a"; x.lineWidth = 4;
      x.beginPath(); x.moveTo(-60, -90); x.lineTo(60, -90); x.quadraticCurveTo(58, -10, 0, 10); x.quadraticCurveTo(-58, -10, -60, -90); x.fill(); x.stroke();
      x.fillRect(-10, 10, 20, 40); x.strokeRect(-10, 10, 20, 40); x.fillRect(-46, 50, 92, 22); x.strokeRect(-46, 50, 92, 22);
      x.beginPath(); x.arc(-62, -60, 22, Math.PI * 0.5, Math.PI * 1.5); x.stroke(); x.beginPath(); x.arc(62, -60, 22, -Math.PI * 0.5, Math.PI * 0.5); x.stroke();
      x.fillStyle = "rgba(255,255,255,0.5)"; x.fillRect(-36, -82, 12, 60); x.restore();
    }
    if (G.paused) {
      x.fillStyle = "rgba(6,6,8,0.6)"; x.fillRect(0, 0, LW, LH);
      txt(x, "PAUSED", cx, LH / 2 - 40, fit(x, "PAUSED", 96, LW * 0.8), "#fff");
      txt(x, "P or Esc to resume", cx, LH / 2 + 10, 26, "#f1dfb0", "center", 700);
    }
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
  function togglePause(force) {
    if (!PLAYING[G.mode]) return;
    G.paused = force != null ? force : !G.paused;
    input.releaseTouch();
    if (G.paused) ov.show({ primary: { label: "Resume", onClick: function () { togglePause(false); } }, secondary: { label: "Quit to title", onClick: toTitle } });
    else ov.hide();
    music();
  }
  var audioOn = false;
  function unlockAudio() { AU.unlock(); if (!audioOn) { audioOn = true; setTimeout(music, 60); } }
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
  $("opt-touch").addEventListener("change", function (e) { touchPref = e.target.value; K.store.set("karate-champ.touch", touchPref); layout(); });
  settingsEl.addEventListener("keydown", function (e) { if (e.key === "Escape" && !input.listening) { e.stopPropagation(); openSettings(false); } });
  K.bindTouch(touchEl, input, unlockAudio);
  // tapping the playfield starts from the title, game over and victory screens
  canvas.addEventListener("pointerdown", function (e) {
    unlockAudio(); canvas.focus();
    if (G.mode === "title" || ((G.mode === "gameover" || G.mode === "victory") && G.modeT > 1.2 && !ov.visible)) { e.preventDefault(); input.press("start"); }
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden && PLAYING[G.mode] && !G.paused) togglePause(true); });
  refreshMute();

  // ---------------------------------------------------------------- loop
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    try { update(dt); draw(); } catch (err) { if (window.console) console.error(err); }
    requestAnimationFrame(frame);
  }
  layout(); toTitle();
  requestAnimationFrame(frame);

  window.KarateGame = { get mode() { return G.mode; }, get level() { return G.level; }, get score() { return G.score; } };
  if (DEBUG) {
    window.KarateGame.debug = {
      G: G, P: P, E: E,
      start: function (n) { startGame(n || 1); },
      fight: function () { if (G.mode === "intro") { G.modeT = 2; } },
      point: function (side, v) { var f = side === "c" ? E : P; awardPoint(f, other(f), v || 2, { x: other(f).x, y: FLOOR - 200 }, false); },
      win: function () { G.halves.p = 3; awardPoint(P, E, 2, { x: E.x, y: FLOOR - 200 }, false); },
      lose: function () { G.halves.c = 3; G.lives = 1; awardPoint(E, P, 2, { x: P.x, y: FLOOR - 200 }, false); },
      bonus: function (kind, n) { G.level = n || 2; lvl = LV.LEVELS[G.level - 1]; startBonus(LV.bonusSpec(kind || "boards", G.level)); },
      victory: function () { G.level = MAX_LEVEL; lvl = LV.LEVELS[11]; victory(); },
      move: function (f, id) { startMove(f === "c" ? E : P, id); },
      sfx: AU.sfx
    };
  }
})();

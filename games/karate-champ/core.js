/* Karate Champ tribute: rules, dual-stick move chart, poses and skeleton math (no DOM; unit-tested in node).
   Angles: limbs from straight down, + toward facing; torso from straight up, + leaning forward.
   Knee/elbow values are relative bends (knee < 0 folds the shin back).
   Controls mirror the 1984 arcade: left stick = move/stance, right stick = attack; distance picks close/far variants.
   Written by: Howie */
(function (root) {
  "use strict";
  var L = { thigh: 74, shin: 72, foot: 26, torso: 94, neck: 9, head: 22, uarm: 52, farm: 48 };
  var FIELDS = ["torso", "head", "fa", "fe", "ba", "be", "fl", "fk", "bl", "bk", "ff", "bf", "rot", "turn", "tilt"];
  function P(o) { var p = { torso: 0.08, head: 0, fa: 0.85, fe: 1.45, ba: 0.3, be: 1.85, fl: 0.42, fk: -0.34, bl: -0.42, bk: -0.12, ff: 1.45, bf: 1.45, rot: 0, turn: 0, tilt: 0 }; for (var k in o) p[k] = o[k]; return p; }
  var POSES = {
    stance: P({}),
    stance2: P({ torso: 0.12, fa: 0.9, fe: 1.5, ba: 0.34, be: 1.9, fl: 0.46, fk: -0.42, bl: -0.38, bk: -0.2 }),
    walkA: P({ fl: 0.62, fk: -0.5, bl: -0.2, bk: -0.25 }),
    walkB: P({ fl: 0.2, fk: -0.15, bl: -0.6, bk: -0.05 }),
    crouch: P({ torso: 0.45, head: 0.35, fa: 1.0, fe: 1.3, ba: 0.6, be: 1.6, fl: 1.35, fk: -2.05, bl: 0.25, bk: -1.95 }),
    jump: P({ torso: 0.1, fa: 1.4, fe: 1.1, ba: 0.6, be: 1.5, fl: 1.45, fk: -2.25, bl: 0.75, bk: -2.1 }),
    block: P({ torso: -0.06, head: -0.1, fa: 1.05, fe: 1.95, ba: 1.25, be: 1.55, fl: 0.4, fk: -0.3, bl: -0.45, bk: -0.12 }),
    lowblock: P({ torso: 0.28, head: -0.1, fa: 0.95, fe: -0.25, ba: 0.6, be: 1.7, fl: 1.1, fk: -1.55, bl: -0.2, bk: -1.0 }),
    punchC: P({ torso: 0.02, fa: 0.2, fe: 1.9, ba: 0.9, be: 1.3, fl: 0.5, fk: -0.45, bl: -0.45, bk: -0.12 }),
    punch: P({ torso: 0.22, head: 0.05, fa: 1.62, fe: 0.02, ba: 0.15, be: 1.95, fl: 0.68, fk: -0.62, bl: -0.62, bk: -0.04 }),
    lowpunch: P({ torso: 0.5, head: 0.1, fa: 1.25, fe: 0.02, ba: 0.4, be: 1.9, fl: 1.35, fk: -2.05, bl: 0.2, bk: -1.95 }),
    lungeC: P({ torso: 0.18, fa: 0.35, fe: 1.7, ba: 0.7, be: 1.4, fl: 0.85, fk: -0.7, bl: -0.55, bk: -0.1 }),
    lunge: P({ torso: 0.38, head: 0.1, fa: 1.85, fe: 0.02, ba: -0.1, be: 1.8, fl: 1.05, fk: -0.85, bl: -0.75, bk: -0.05 }),
    upperC: P({ torso: -0.15, fa: 0.4, fe: 1.6, ba: 0.5, be: 1.5, fl: 0.45, fk: -0.4, bl: -0.4, bk: -0.1 }),
    upper: P({ torso: -0.05, head: -0.2, fa: 2.15, fe: -0.15, ba: 0.2, be: 1.9, fl: 0.55, fk: -0.5, bl: -0.5, bk: -0.08 }),
    frontC: P({ torso: -0.12, fa: 0.9, fe: 1.5, ba: 0.1, be: 1.7, fl: 1.45, fk: -1.75, bl: -0.08, bk: -0.08 }),
    front: P({ torso: -0.3, head: 0.15, fa: 0.75, fe: 1.55, ba: -0.25, be: 1.2, fl: 1.62, fk: -0.02, ff: 0.6, bl: -0.12, bk: -0.06 }),
    roundC: P({ torso: -0.35, fa: 0.6, fe: 1.5, ba: -0.3, be: 1.0, fl: 1.75, fk: -2.0, bl: -0.12, bk: 0 }),
    round: P({ torso: -0.72, head: 0.5, fa: 0.4, fe: 1.3, ba: -0.75, be: 0.7, fl: 2.3, fk: -0.02, ff: 1.0, bl: -0.16, bk: 0 }),
    backC: P({ turn: 1, torso: 0.55, head: -0.3, fa: 0.9, fe: 1.6, ba: 0.3, be: 1.2, fl: 0.1, fk: -0.25, bl: 0.95, bk: -2.1 }),
    back: P({ turn: 1, torso: 0.95, head: -0.55, fa: 0.95, fe: 1.4, ba: -0.4, be: 0.5, fl: 0.18, fk: -0.18, bl: -1.62, bk: 0.02, bf: 1.7 }),
    backroundC: P({ turn: 1, torso: 0.7, head: -0.4, fa: 0.5, fe: 1.3, ba: -0.5, be: 0.8, fl: 0.15, fk: -0.2, bl: 1.5, bk: -2.2 }),
    backround: P({ turn: 1, torso: 1.05, head: -0.6, fa: 0.4, fe: 1.1, ba: -0.9, be: 0.4, fl: 0.2, fk: -0.15, bl: -2.1, bk: 0.05, bf: 1.2 }),
    sweepC: P({ torso: 0.5, head: 0.05, fa: 0.55, fe: 0.1, ba: 0.2, be: 1.5, fl: 1.3, fk: -2.15, bl: -1.4, bk: 0 }),
    sweep: P({ torso: 0.62, head: 0.15, fa: 0.5, fe: 0.05, ba: -0.4, be: 1.2, fl: 1.3, fk: -2.15, bl: 1.48, bk: 0, bf: 1.0 }),
    revsweepC: P({ torso: 0.55, head: 0.05, fa: 0.4, fe: 0.1, ba: 0.5, be: 1.4, fl: -1.35, fk: 0, bl: 1.35, bk: -2.1 }),
    revsweep: P({ torso: 0.68, head: 0.1, fa: 0.3, fe: 0.05, ba: 0.6, be: 1.2, fl: 1.45, bk: 0, bf: 1.0, bl: 1.35, fk: -2.1 }),
    lowkickC: P({ torso: 0.25, fa: 0.8, fe: 1.4, ba: 0.3, be: 1.5, fl: 1.2, fk: -1.9, bl: -0.1, bk: -0.1 }),
    lowkick: P({ torso: 0.35, head: 0.1, fa: 0.7, fe: 1.3, ba: 0.2, be: 1.4, fl: 1.55, fk: -0.15, ff: 0.8, bl: -0.15, bk: -0.05 }),
    jumpkick: P({ torso: -0.22, head: 0.15, fa: 1.2, fe: 0.8, ba: -0.6, be: 0.9, fl: 1.18, fk: -0.02, ff: 0.9, bl: 0.35, bk: -2.2 }),
    jumpback: P({ turn: 1, torso: 0.4, head: -0.2, fa: 0.9, fe: 1.0, ba: -0.5, be: 0.8, fl: 0.3, fk: -1.8, bl: -1.35, bk: 0.02, bf: 1.0 }),
    hit: P({ torso: -0.62, head: -0.45, fa: -0.7, fe: 0.45, ba: -1.1, be: 0.35, fl: 0.55, fk: -0.25, bl: -0.2, bk: 0 }),
    down: P({ rot: -1.5, torso: -0.05, head: -0.15, fa: -0.9, fe: 0.3, ba: -1.4, be: 0.4, fl: 0.6, fk: -0.9, bl: 0.2, bk: -0.3 }),
    win: P({ torso: 0, head: -0.1, fa: 2.95, fe: 0.1, ba: 0.05, be: 1.9, fl: 0.18, fk: -0.05, bl: -0.18, bk: -0.02 }),
    bow: P({ torso: 0.72, head: 0.3, fa: 0.08, fe: 0.05, ba: -0.02, be: 0.05, fl: 0.06, fk: 0, bl: -0.06, bk: 0 }),
    kneel: P({ torso: 0.35, head: 0.5, fa: 0.3, fe: 0.2, ba: 0.1, be: 0.2, fl: 1.4, fk: -1.4, bl: 0.05, bk: -1.55 }),
    chopUp: P({ torso: -0.05, fa: 2.75, fe: 0.5, ba: 0.4, be: 1.7, fl: 0.5, fk: -0.45, bl: -0.45, bk: -0.1 }),
    chop: P({ torso: 0.55, head: 0.25, fa: 1.0, fe: 0.05, ba: 0.2, be: 1.8, fl: 0.9, fk: -1.1, bl: -0.5, bk: -0.4 })
  };

  // Arcade attack scores (half / full). Clean tip or counter uses full; jammed uses half.
  // Match point: attack score <= 500 => half point, >= 600 => full point.
  var MOVES = {
    reverse: { name: "Reverse punch", h: "mid", power: 1, limb: "farm", t: 0.40, active: [0.30, 0.55], keys: [[0, "stance"], [0.16, "punchC"], [0.32, "punch"], [0.55, "punch"], [1, "stance"]], full: 155, halfPts: 200, fullPts: 400 },
    revcrouch: { name: "Lower reverse punch", h: "low", power: 2, limb: "farm", t: 0.48, active: [0.34, 0.58], keys: [[0, "crouch"], [0.34, "lowpunch"], [0.58, "lowpunch"], [1, "crouch"]], full: 150, halfPts: 400, fullPts: 800, low: true },
    upper: { name: "Upper punch", h: "high", power: 1, limb: "farm", t: 0.44, active: [0.32, 0.56], keys: [[0, "stance"], [0.2, "upperC"], [0.36, "upper"], [0.58, "upper"], [1, "stance"]], full: 145, halfPts: 200, fullPts: 400 },
    lunge: { name: "Lunge punch", h: "mid", power: 1, limb: "farm", t: 0.50, active: [0.34, 0.58], keys: [[0, "stance"], [0.2, "lungeC"], [0.38, "lunge"], [0.6, "lunge"], [1, "stance"]], full: 195, halfPts: 300, fullPts: 600, step: 55 },
    upperlunge: { name: "Upper lunge punch", h: "high", power: 1, limb: "farm", t: 0.52, active: [0.36, 0.58], keys: [[0, "stance"], [0.22, "upperC"], [0.4, "upper"], [0.62, "upper"], [1, "stance"]], full: 200, halfPts: 300, fullPts: 600, step: 50 },
    front: { name: "Front kick", h: "mid", power: 1, limb: "fleg", t: 0.52, active: [0.38, 0.60], keys: [[0, "stance"], [0.24, "frontC"], [0.40, "front"], [0.62, "front"], [0.8, "frontC"], [1, "stance"]], full: 165, halfPts: 100, fullPts: 200 },
    lowkick: { name: "Low kick", h: "low", power: 1, limb: "fleg", t: 0.46, active: [0.36, 0.58], keys: [[0, "stance"], [0.22, "lowkickC"], [0.4, "lowkick"], [0.6, "lowkick"], [1, "stance"]], full: 155, halfPts: 100, fullPts: 200, low: true },
    round: { name: "Round kick", h: "high", power: 2, limb: "fleg", t: 0.66, active: [0.44, 0.64], keys: [[0, "stance"], [0.3, "roundC"], [0.46, "round"], [0.66, "round"], [0.82, "roundC"], [1, "stance"]], full: 128, halfPts: 400, fullPts: 800 },
    back: { name: "Back kick", h: "mid", power: 1, limb: "bleg", t: 0.70, active: [0.44, 0.64], keys: [[0, "stance"], [0.28, "backC"], [0.46, "back"], [0.66, "back"], [0.84, "backC"], [1, "stance"]], full: 160, halfPts: 200, fullPts: 400 },
    turnback: { name: "Turn back kick", h: "mid", power: 1, limb: "bleg", t: 0.72, active: [0.46, 0.66], keys: [[0, "stance"], [0.3, "backC"], [0.48, "back"], [0.68, "back"], [0.86, "backC"], [1, "stance"]], full: 170, halfPts: 200, fullPts: 400 },
    backround: { name: "Back round kick", h: "high", power: 2, limb: "bleg", t: 0.82, active: [0.48, 0.70], keys: [[0, "stance"], [0.32, "backroundC"], [0.5, "backround"], [0.72, "backround"], [0.88, "backC"], [1, "stance"]], full: 175, halfPts: 500, fullPts: 1000 },
    sweep: { name: "Front foot sweep", h: "low", power: 1, limb: "bleg", t: 0.64, active: [0.4, 0.60], keys: [[0, "stance"], [0.2, "sweepC"], [0.42, "sweep"], [0.62, "sweep"], [0.82, "crouch"], [1, "stance"]], full: 170, halfPts: 100, fullPts: 200, low: true },
    revsweep: { name: "Back foot sweep", h: "low", power: 1, limb: "fleg", t: 0.64, active: [0.4, 0.60], keys: [[0, "stance"], [0.2, "revsweepC"], [0.42, "revsweep"], [0.62, "revsweep"], [0.82, "crouch"], [1, "stance"]], full: 165, halfPts: 100, fullPts: 200, low: true },
    jumpside: { name: "Jumping side kick", h: "high", power: 2, limb: "fleg", t: 0.78, active: [0.32, 0.72], keys: [[0, "crouch"], [0.14, "jump"], [0.34, "jumpkick"], [0.72, "jumpkick"], [0.86, "jump"], [1, "stance"]], full: 150, halfPts: 500, fullPts: 1000, air: true },
    jumpback: { name: "Jumping back kick", h: "high", power: 2, limb: "bleg", t: 0.80, active: [0.34, 0.72], keys: [[0, "crouch"], [0.14, "jump"], [0.36, "jumpback"], [0.72, "jumpback"], [0.88, "jump"], [1, "stance"]], full: 155, halfPts: 500, fullPts: 1000, air: true },
    // Legacy aliases used by older tests / bonus / title demo
    punch: null, lowpunch: null, jump: null,
    chop: { name: "Board chop", h: "low", power: 2, limb: "farm", t: 0.62, active: [0.42, 0.6], keys: [[0, "stance"], [0.3, "chopUp"], [0.44, "chop"], [0.7, "chop"], [1, "stance"]], full: 999, halfPts: 400, fullPts: 800 }
  };
  // Aliases keep old call sites working
  MOVES.punch = MOVES.reverse;
  MOVES.lowpunch = MOVES.revcrouch;
  MOVES.jump = MOVES.jumpside;

  var CLOSE = 155; // px — close/far branch for dual-stick chart
  var WIN_HALVES = 4, BOUT_TIME = 30;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function mix(a, b, t) { var o = {}; for (var i = 0; i < FIELDS.length; i++) { var f = FIELDS[i]; o[f] = lerp(a[f], b[f], t); } return o; }
  function pose(name) { return typeof name === "string" ? POSES[name] : name; }
  function movePose(id, u) {
    var m = MOVES[id]; if (!m) return POSES.stance;
    var k = m.keys;
    if (u <= 0) return pose(k[0][1]);
    for (var i = 1; i < k.length; i++) if (u <= k[i][0]) { var a = k[i - 1], b = k[i]; return mix(pose(a[1]), pose(b[1]), ease((u - a[0]) / Math.max(1e-6, b[0] - a[0]))); }
    return pose(k[k.length - 1][1]);
  }
  function inActive(id, u) { var a = MOVES[id].active; return u >= a[0] && u <= a[1]; }

  function limb(o, a, len) { return { x: o.x + Math.sin(a) * len, y: o.y + Math.cos(a) * len }; }
  function skeleton(p) {
    var H = { x: 0, y: 0 };
    var S = { x: Math.sin(p.torso) * L.torso, y: -Math.cos(p.torso) * L.torso };
    var hd = p.torso + p.head * 0.6, N = { x: S.x + Math.sin(hd) * (L.neck + L.head), y: S.y - Math.cos(hd) * (L.neck + L.head) };
    var fK = limb(H, p.fl, L.thigh), fA = limb(fK, p.fl + p.fk, L.shin), fT = limb(fA, p.fl + p.fk + p.ff, L.foot);
    var bK = limb(H, p.bl, L.thigh), bA = limb(bK, p.bl + p.bk, L.shin), bT = limb(bA, p.bl + p.bk + p.bf, L.foot);
    var sF = { x: S.x + Math.sin(p.torso) * -6, y: S.y + 8 }, sB = { x: S.x - Math.sin(p.torso) * 6 - 4, y: S.y + 6 };
    var fE = limb(sF, p.fa, L.uarm), fH = limb(fE, p.fa + p.fe, L.farm);
    var bE = limb(sB, p.ba, L.uarm), bH = limb(bE, p.ba + p.be, L.farm);
    var j = { H: H, S: S, N: N, fK: fK, fA: fA, fT: fT, bK: bK, bA: bA, bT: bT, sF: sF, sB: sB, fE: fE, fH: fH, bE: bE, bH: bH };
    if (p.rot) {
      var c = Math.cos(p.rot), s = Math.sin(p.rot), cy = -60;
      for (var key in j) { var q = j[key], dx = q.x, dy = q.y - cy; j[key] = { x: dx * c - dy * s, y: cy + dx * s + dy * c }; }
    }
    var low = -1e9; for (var k2 in j) if (j[k2].y > low) low = j[k2].y;
    j.ground = low;
    return j;
  }
  function toWorld(f, p, j, floorY) {
    var dir = f.facing * (p.turn > 0.5 ? -1 : 1), oy = floorY + (f.y || 0) - j.ground - 1, out = { dir: dir };
    for (var k in j) if (k !== "ground") out[k] = { x: f.x + dir * j[k].x, y: oy + j[k].y };
    return out;
  }
  function strikePoint(id, w) {
    var m = MOVES[id];
    if (m.limb === "farm") return { x: w.fH.x, y: w.fH.y };
    var A = m.limb === "fleg" ? w.fA : w.bA, T = m.limb === "fleg" ? w.fT : w.bT;
    return { x: (A.x * 2 + T.x) / 3, y: (A.y * 2 + T.y) / 3 };
  }
  function segDist(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t; var x = a.x + dx * t - px, y = a.y + dy * t - py; return Math.sqrt(x * x + y * y);
  }
  function hurtSegs(w) {
    return [[w.H, w.S, 30, "mid"], [w.N, w.N, 25, "high"], [w.S, w.N, 18, "high"], [w.H, w.fK, 17, "low"], [w.fK, w.fA, 14, "low"], [w.H, w.bK, 17, "low"], [w.bK, w.bA, 14, "low"]];
  }
  var STRIKE_R = 15;
  function hitTest(pt, w) {
    var segs = hurtSegs(w), best = null;
    for (var i = 0; i < segs.length; i++) { var s = segs[i], d = segDist(pt.x, pt.y, s[0], s[1]) - s[2] - STRIKE_R; if (d < 0 && (!best || d < best.d)) best = { d: d, zone: s[3] }; }
    return best;
  }
  function blocks(guard, h) {
    if (guard === "block") return h === "high" || h === "mid";
    if (guard === "lowblock") return h === "low" || h === "mid";
    return false;
  }

  // Referee: return { halves: 1|2, score: number }. Counter or tip reach => fullPts; jammed => halfPts.
  function judge(id, dist, counter) {
    var m = MOVES[id];
    var clean = !!(counter || dist >= m.full);
    var score = clean ? m.fullPts : m.halfPts;
    // Moves that cannot award a full point even when clean (front/low/sweep halfPts max 200)
    if (score >= 600) return { halves: 2, score: score };
    if (score >= 100) return { halves: 1, score: score };
    return { halves: 1, score: Math.max(100, score) };
  }
  function boutOver(a, b) { return a >= WIN_HALVES ? "player" : b >= WIN_HALVES ? "cpu" : null; }
  // Time-up: match halves first, then attack score, then last hitter ('p'|'c'|null)
  function timeDecision(a, b, scoreA, scoreB, lastHit) {
    if (a > b) return "player";
    if (b > a) return "cpu";
    var sa = scoreA || 0, sb = scoreB || 0;
    if (sa > sb) return "player";
    if (sb > sa) return "cpu";
    if (lastHit === "p") return "player";
    if (lastHit === "c") return "cpu";
    return "draw";
  }

  // Stick dirs: 'n' | 'l' | 'r' | 'u' | 'd'  (relative to facing: l=away, r=toward)
  // Relativize absolute left/right to facing before calling.
  function dualCommand(left, right, close) {
    // Movement-only when right stick neutral
    if (right === "n") {
      if (left === "u") return { type: "jump", back: false };
      if (left === "d") return { type: "crouch" };
      if (left === "l") return close ? { type: "block" } : { type: "walk", dir: -1 };
      if (left === "r") return { type: "walk", dir: 1 };
      return { type: "stand" };
    }
    // Attack chart (StrategyWiki / arcade)
    var id = null;
    if (left === "n") {
      if (right === "l") id = "back";
      else if (right === "r") id = close ? "reverse" : "front";
      else if (right === "u") id = "round";
      else if (right === "d") id = "lowkick";
    } else if (left === "l") {
      if (right === "l") id = "back";
      else if (right === "r") id = "backround";
      else if (right === "u") id = "upper";
      else if (right === "d") id = "lowkick";
    } else if (left === "r") {
      if (right === "l") id = close ? "back" : "turnback";
      else if (right === "r") id = close ? "front" : "lunge";
      else if (right === "u") id = close ? "round" : "upperlunge";
      else if (right === "d") id = "lowkick";
    } else if (left === "u") {
      if (right === "l") id = "jumpback";
      else if (right === "r") id = "jumpside";
      else if (right === "u") return { type: "flip", back: true };
      else if (right === "d") return { type: "flip", back: false };
    } else if (left === "d") {
      if (right === "l") id = "revsweep";
      else if (right === "r") id = "sweep";
      else if (right === "u") id = "revcrouch";
      else if (right === "d") id = "sweep";
    }
    if (id) return { type: "move", id: id };
    return { type: "stand" };
  }

  // Legacy button+direction helper (kept for tests / bonus fallback)
  function command(btn, d) {
    if (btn === "kick") { if (d.up) return "jumpside"; if (d.down) return "sweep"; if (d.away) return "back"; return "front"; }
    if (btn === "punch") { if (d.down) return "revcrouch"; if (d.toward) return "lunge"; if (d.up) return "upper"; return "reverse"; }
    if (btn === "round") { if (d.down) return "sweep"; if (d.away) return "backround"; return "round"; }
    if (btn === "block") { if (d.up) return d.away ? "backflip" : "flip"; if (d.down) return "lowblock"; return "block"; }
    return null;
  }

  function pointsFor(halves, level, attackScore) {
    var base = attackScore != null ? attackScore : (halves === 2 ? 1000 : 400);
    return base + 50 * (level - 1);
  }

  var RANK = { reverse: 1, punch: 1, revcrouch: 2, lowpunch: 2, upper: 1, lunge: 1, upperlunge: 1, front: 1, lowkick: 1, round: 2, back: 1, turnback: 1, backround: 2, sweep: 1, revsweep: 1, jumpside: 2, jump: 2, jumpback: 2 };

  var api = { L: L, POSES: POSES, MOVES: MOVES, RANK: RANK, FIELDS: FIELDS, CLOSE: CLOSE, mix: mix, ease: ease, movePose: movePose, inActive: inActive, skeleton: skeleton, toWorld: toWorld,
    strikePoint: strikePoint, hitTest: hitTest, hurtSegs: hurtSegs, blocks: blocks, judge: judge, boutOver: boutOver, timeDecision: timeDecision, dualCommand: dualCommand, command: command,
    pointsFor: pointsFor, WIN_HALVES: WIN_HALVES, BOUT_TIME: BOUT_TIME };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KarateCore = api;
})(typeof window !== "undefined" ? window : this);

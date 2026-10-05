/* Karate Champ tribute: rules, moves, poses and skeleton math (no DOM, so it is unit-tested in node).
   Angles: limbs measured from straight down, + toward the way the fighter faces; torso from straight up, + leaning forward.
   Knee/elbow values are relative bends (knee < 0 folds the shin back). Written by: Howie */
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
    frontC: P({ torso: -0.12, fa: 0.9, fe: 1.5, ba: 0.1, be: 1.7, fl: 1.45, fk: -1.75, bl: -0.08, bk: -0.08 }),
    front: P({ torso: -0.3, head: 0.15, fa: 0.75, fe: 1.55, ba: -0.25, be: 1.2, fl: 1.62, fk: -0.02, ff: 0.6, bl: -0.12, bk: -0.06 }),
    roundC: P({ torso: -0.35, fa: 0.6, fe: 1.5, ba: -0.3, be: 1.0, fl: 1.75, fk: -2.0, bl: -0.12, bk: 0 }),
    round: P({ torso: -0.72, head: 0.5, fa: 0.4, fe: 1.3, ba: -0.75, be: 0.7, fl: 2.3, fk: -0.02, ff: 1.0, bl: -0.16, bk: 0 }),
    backC: P({ turn: 1, torso: 0.55, head: -0.3, fa: 0.9, fe: 1.6, ba: 0.3, be: 1.2, fl: 0.1, fk: -0.25, bl: 0.95, bk: -2.1 }),
    back: P({ turn: 1, torso: 0.95, head: -0.55, fa: 0.95, fe: 1.4, ba: -0.4, be: 0.5, fl: 0.18, fk: -0.18, bl: -1.62, bk: 0.02, bf: 1.7 }),
    sweepC: P({ torso: 0.5, head: 0.05, fa: 0.55, fe: 0.1, ba: 0.2, be: 1.5, fl: 1.3, fk: -2.15, bl: -1.4, bk: 0 }),
    sweep: P({ torso: 0.62, head: 0.15, fa: 0.5, fe: 0.05, ba: -0.4, be: 1.2, fl: 1.3, fk: -2.15, bl: 1.48, bk: 0, bf: 1.0 }),
    jumpkick: P({ torso: -0.22, head: 0.15, fa: 1.2, fe: 0.8, ba: -0.6, be: 0.9, fl: 1.18, fk: -0.02, ff: 0.9, bl: 0.35, bk: -2.2 }),
    hit: P({ torso: -0.62, head: -0.45, fa: -0.7, fe: 0.45, ba: -1.1, be: 0.35, fl: 0.55, fk: -0.25, bl: -0.2, bk: 0 }),
    down: P({ rot: -1.5, torso: -0.05, head: -0.15, fa: -0.9, fe: 0.3, ba: -1.4, be: 0.4, fl: 0.6, fk: -0.9, bl: 0.2, bk: -0.3 }),
    win: P({ torso: 0, head: -0.1, fa: 2.95, fe: 0.1, ba: 0.05, be: 1.9, fl: 0.18, fk: -0.05, bl: -0.18, bk: -0.02 }),
    bow: P({ torso: 0.72, head: 0.3, fa: 0.08, fe: 0.05, ba: -0.02, be: 0.05, fl: 0.06, fk: 0, bl: -0.06, bk: 0 }),
    kneel: P({ torso: 0.35, head: 0.5, fa: 0.3, fe: 0.2, ba: 0.1, be: 0.2, fl: 1.4, fk: -1.4, bl: 0.05, bk: -1.55 }),
    chopUp: P({ torso: -0.05, fa: 2.75, fe: 0.5, ba: 0.4, be: 1.7, fl: 0.5, fk: -0.45, bl: -0.45, bk: -0.1 }),
    chop: P({ torso: 0.55, head: 0.25, fa: 1.0, fe: 0.05, ba: 0.2, be: 1.8, fl: 0.9, fk: -1.1, bl: -0.5, bk: -0.4 })
  };
  // timing in seconds at speed 1; active = [from, to] as fractions of the move; keys = [fraction, pose]
  var MOVES = {
    punch: { name: "Punch", h: "mid", power: 1, limb: "farm", t: 0.42, active: [0.32, 0.56], keys: [[0, "stance"], [0.18, "punchC"], [0.34, "punch"], [0.58, "punch"], [1, "stance"]], full: 999 },
    lowpunch: { name: "Low punch", h: "low", power: 1, limb: "farm", t: 0.46, active: [0.34, 0.58], keys: [[0, "crouch"], [0.36, "lowpunch"], [0.6, "lowpunch"], [1, "crouch"]], full: 999, low: true },
    front: { name: "Front kick", h: "mid", power: 2, limb: "fleg", t: 0.56, active: [0.4, 0.62], keys: [[0, "stance"], [0.26, "frontC"], [0.42, "front"], [0.64, "front"], [0.8, "frontC"], [1, "stance"]], full: 165 },
    round: { name: "Roundhouse", h: "high", power: 2, limb: "fleg", t: 0.66, active: [0.44, 0.64], keys: [[0, "stance"], [0.3, "roundC"], [0.46, "round"], [0.66, "round"], [0.82, "roundC"], [1, "stance"]], full: 128 },
    back: { name: "Back kick", h: "mid", power: 2, limb: "bleg", t: 0.74, active: [0.46, 0.66], keys: [[0, "stance"], [0.3, "backC"], [0.48, "back"], [0.68, "back"], [0.84, "backC"], [1, "stance"]], full: 160 },
    sweep: { name: "Low sweep", h: "low", power: 2, limb: "bleg", t: 0.66, active: [0.4, 0.62], keys: [[0, "stance"], [0.2, "sweepC"], [0.42, "sweep"], [0.64, "sweep"], [0.82, "crouch"], [1, "stance"]], full: 170, low: true },
    jump: { name: "Jumping kick", h: "high", power: 2, limb: "fleg", t: 0.78, active: [0.32, 0.72], keys: [[0, "crouch"], [0.14, "jump"], [0.34, "jumpkick"], [0.72, "jumpkick"], [0.86, "jump"], [1, "stance"]], full: 150, air: true },
    chop: { name: "Board chop", h: "low", power: 2, limb: "farm", t: 0.62, active: [0.42, 0.6], keys: [[0, "stance"], [0.3, "chopUp"], [0.44, "chop"], [0.7, "chop"], [1, "stance"]], full: 999 }
  };
  var RANK = { punch: 1, lowpunch: 1, front: 2, round: 2, back: 2, sweep: 2, jump: 2 };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function mix(a, b, t) { var o = {}; for (var i = 0; i < FIELDS.length; i++) { var f = FIELDS[i]; o[f] = lerp(a[f], b[f], t); } return o; }
  function pose(name) { return typeof name === "string" ? POSES[name] : name; }
  // pose of a move at fraction u (0..1)
  function movePose(id, u) {
    var k = MOVES[id].keys;
    if (u <= 0) return pose(k[0][1]);
    for (var i = 1; i < k.length; i++) if (u <= k[i][0]) { var a = k[i - 1], b = k[i]; return mix(pose(a[1]), pose(b[1]), ease((u - a[0]) / Math.max(1e-6, b[0] - a[0]))); }
    return pose(k[k.length - 1][1]);
  }
  function inActive(id, u) { var a = MOVES[id].active; return u >= a[0] && u <= a[1]; }

  // ---- skeleton: local coords, x forward, y down, hip at (0,0) before grounding
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
      var c = Math.cos(p.rot), s = Math.sin(p.rot), cy = -60; // rotate about the belly
      for (var key in j) { var q = j[key], dx = q.x, dy = q.y - cy; j[key] = { x: dx * c - dy * s, y: cy + dx * s + dy * c }; }
    }
    var low = -1e9; for (var k2 in j) if (j[k2].y > low) low = j[k2].y;
    j.ground = low; // add -ground to put the lowest joint on the floor
    return j;
  }
  // world transform: facing +1 right, -1 left; a turned pose (back kick) is drawn mirrored
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
  // hurt zones of a fighter in world coords: [a, b, radius, zone]
  function hurtSegs(w) {
    return [[w.H, w.S, 30, "mid"], [w.N, w.N, 25, "high"], [w.S, w.N, 18, "high"], [w.H, w.fK, 17, "low"], [w.fK, w.fA, 14, "low"], [w.H, w.bK, 17, "low"], [w.bK, w.bA, 14, "low"]];
  }
  var STRIKE_R = 15;
  function hitTest(pt, w) {
    var segs = hurtSegs(w), best = null;
    for (var i = 0; i < segs.length; i++) { var s = segs[i], d = segDist(pt.x, pt.y, s[0], s[1]) - s[2] - STRIKE_R; if (d < 0 && (!best || d < best.d)) best = { d: d, zone: s[3] }; }
    return best;
  }
  // blocking: standing guard stops high + mid, low guard stops low + mid. Must face the attacker.
  function blocks(guard, h) {
    if (guard === "block") return h === "high" || h === "mid";
    if (guard === "lowblock") return h === "low" || h === "mid";
    return false;
  }
  // the referee's call: 2 = full point (ippon), 1 = half point (waza-ari).
  // A power move landed from the tip of its reach, or any counter-strike into an attacking opponent, is a full point.
  function judge(id, dist, counter) {
    var m = MOVES[id];
    if (m.power >= 2 && (dist >= m.full || counter)) return 2;
    if (m.power < 2 && counter) return 2;
    return 1;
  }
  var WIN_HALVES = 4, BOUT_TIME = 30;
  function boutOver(a, b) { return a >= WIN_HALVES ? "player" : b >= WIN_HALVES ? "cpu" : null; }
  function timeDecision(a, b) { return a > b ? "player" : b > a ? "cpu" : "draw"; }
  // controls: a button plus the held direction (relative to facing) picks the move
  function command(btn, d) {
    // d: { up, down, toward, away }
    if (btn === "kick") { if (d.up) return "jump"; if (d.down) return "sweep"; if (d.away) return "back"; return "front"; }
    if (btn === "punch") { if (d.down) return "lowpunch"; if (d.toward) return "round"; if (d.up) return "jump"; return "punch"; }
    if (btn === "round") { if (d.down) return "sweep"; if (d.away) return "back"; return "round"; }
    if (btn === "block") { if (d.up) return d.away ? "backflip" : "flip"; if (d.down) return "lowblock"; return "block"; }
    return null;
  }
  function pointsFor(halves, level) { return (halves === 2 ? 1000 : 400) + 100 * (level - 1); }
  var api = { L: L, POSES: POSES, MOVES: MOVES, RANK: RANK, FIELDS: FIELDS, mix: mix, ease: ease, movePose: movePose, inActive: inActive, skeleton: skeleton, toWorld: toWorld,
    strikePoint: strikePoint, hitTest: hitTest, hurtSegs: hurtSegs, blocks: blocks, judge: judge, boutOver: boutOver, timeDecision: timeDecision, command: command,
    pointsFor: pointsFor, WIN_HALVES: WIN_HALVES, BOUT_TIME: BOUT_TIME };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KarateCore = api;
})(typeof window !== "undefined" ? window : this);

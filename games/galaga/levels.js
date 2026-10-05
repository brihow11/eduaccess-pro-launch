/* Galaga tribute: stage table, formation slots and flight paths (pure data + math, no DOM, so tests can load it).
   Playfield is 480 x 640 logical units. Written by: Howie */
(function (root) {
  "use strict";
  var W = 480, H = 640;
  var COLS = 10, ROWS = 5, SLOT_DX = 36, SLOT_DY = 33, TOP = 118;

  // ---------------------------------------------------------------- formation
  // row 0: Boss Galaga (cols 3-6), rows 1-2: butterflies (cols 1-8), rows 3-4: bees (all ten columns)
  function slotKind(r) { return r === 0 ? "boss" : r <= 2 ? "butterfly" : "bee"; }
  function slotUsed(r, c) { return r === 0 ? c >= 3 && c <= 6 : r <= 2 ? c >= 1 && c <= 8 : true; }
  // breathe: 0 (tight) .. 1 (spread); sway: horizontal offset while the formation is still filling in
  function slotPos(r, c, breathe, sway) {
    var b = breathe || 0;
    return { x: W / 2 + (c - 4.5) * SLOT_DX * (1 + 0.16 * b) + (sway || 0), y: TOP + r * SLOT_DY * (1 + 0.14 * b) - 8 * b };
  }
  function S(r, c) { return r * COLS + c; }
  var WAVES = [ // classic arrival order: 5 waves of 8
    [S(1, 4), S(3, 4), S(1, 5), S(3, 5), S(2, 4), S(4, 4), S(2, 5), S(4, 5)],
    [S(0, 3), S(1, 3), S(0, 4), S(2, 3), S(0, 5), S(1, 6), S(0, 6), S(2, 6)],
    [S(1, 1), S(1, 8), S(1, 2), S(1, 7), S(2, 1), S(2, 8), S(2, 2), S(2, 7)],
    [S(3, 2), S(3, 7), S(3, 3), S(3, 6), S(4, 2), S(4, 7), S(4, 3), S(4, 6)],
    [S(3, 0), S(3, 9), S(3, 1), S(3, 8), S(4, 0), S(4, 9), S(4, 1), S(4, 8)]
  ];

  // ---------------------------------------------------------------- paths
  // segments: ['m', x, y] start, ['l', x, y] line, ['a', cx, cy, r, fromDeg, toDeg] arc (screen coords, y down)
  function build(segs, mirror) {
    var pts = [], step = 5;
    function push(x, y) { pts.push([mirror ? W - x : x, y]); }
    segs.forEach(function (s) {
      if (s[0] === "m") push(s[1], s[2]);
      else if (s[0] === "l") {
        var p = pts[pts.length - 1], x0 = mirror ? W - p[0] : p[0], y0 = p[1], d = Math.hypot(s[1] - x0, s[2] - y0), n = Math.max(1, Math.ceil(d / step));
        for (var i = 1; i <= n; i++) push(x0 + (s[1] - x0) * i / n, y0 + (s[2] - y0) * i / n);
      } else if (s[0] === "a") {
        var a0 = s[4] * Math.PI / 180, a1 = s[5] * Math.PI / 180, len = Math.abs(a1 - a0) * s[3], m = Math.max(2, Math.ceil(len / step));
        for (var j = 0; j <= m; j++) { var a = a0 + (a1 - a0) * j / m; push(s[1] + s[3] * Math.cos(a), s[2] + s[3] * Math.sin(a)); }
      }
    });
    // light smoothing so line/arc joins never kink
    for (var pass = 0; pass < 2; pass++) for (var k = 1; k < pts.length - 1; k++) {
      pts[k] = [(pts[k - 1][0] + 2 * pts[k][0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * pts[k][1] + pts[k + 1][1]) / 4];
    }
    var acc = [0];
    for (var q = 1; q < pts.length; q++) acc.push(acc[q - 1] + Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]));
    return { pts: pts, len: acc, total: acc[acc.length - 1] };
  }
  // position + heading at distance d along a built path
  function at(path, d) {
    var L = path.len, P = path.pts, n = P.length;
    if (d <= 0) return { x: P[0][0], y: P[0][1], a: Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]), done: false };
    if (d >= path.total) return { x: P[n - 1][0], y: P[n - 1][1], a: Math.atan2(P[n - 1][1] - P[n - 2][1], P[n - 1][0] - P[n - 2][0]), done: true };
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (L[mid] <= d) lo = mid; else hi = mid; }
    var t = (d - L[lo]) / Math.max(1e-6, L[hi] - L[lo]);
    return { x: P[lo][0] + (P[hi][0] - P[lo][0]) * t, y: P[lo][1] + (P[hi][1] - P[lo][1]) * t, a: Math.atan2(P[hi][1] - P[lo][1], P[hi][0] - P[lo][0]), done: false };
  }
  var PATHS = {
    // drop from the top, one big loop low on the right, rise toward the formation
    topLoop: [["m", 282, -30], ["l", 282, 290], ["a", 362, 290, 80, 180, -45]],
    // sweep in from the lower left, curl up
    sideSweep: [["m", -30, 520], ["l", 120, 520], ["a", 120, 420, 100, 90, -60]],
    // S-curve with a closing loop
    serpent: [["m", 150, -30], ["l", 150, 200], ["a", 230, 200, 80, 180, 90], ["a", 230, 360, 80, -90, 180]],
    // corkscrew down the middle
    corkscrew: [["m", 240, -30], ["l", 240, 230], ["a", 300, 230, 60, 180, -180], ["l", 240, 300], ["a", 290, 300, 50, 180, -90]],
    // wide arc in from the left edge
    wideArc: [["m", -30, 170], ["l", 120, 170], ["a", 120, 290, 120, -90, 120]],
    // late-game hook: dives deep then hooks back up
    deepHook: [["m", 330, -30], ["l", 330, 120], ["a", 250, 120, 80, 0, 90], ["l", 120, 200], ["a", 120, 360, 160, -90, -270]]
  };
  // challenging-stage fly-throughs: entry shape plus an exit leg that leaves the screen
  var CPATHS = {
    loopExit: [["m", 240, -30], ["l", 240, 260], ["a", 310, 260, 70, 180, -135], ["l", 620, 60]],
    crossSwoop: [["m", -30, 430], ["l", 140, 430], ["a", 140, 330, 100, 90, -90], ["l", 300, 230], ["a", 300, 330, 100, -90, 90], ["l", 620, 430]],
    figure8: [["m", 160, -30], ["l", 160, 180], ["a", 240, 180, 80, 180, -180], ["a", 240, 340, 80, -90, 180], ["l", -140, 120]],
    zigzag: [["m", -30, 120], ["l", 360, 200], ["a", 360, 260, 60, -90, 90], ["l", 120, 360], ["a", 120, 420, 60, -90, -270], ["l", 620, 470]],
    dropLoop: [["m", 400, -30], ["l", 400, 300], ["a", 330, 300, 70, 0, 270], ["l", -140, 160]],
    rainbow: [["m", -30, 600], ["a", 240, 600, 270, 180, 360]]
  };
  function entryPath(name, mirror) { return build(PATHS[name], mirror); }
  function challengePath(name, mirror) { return build(CPATHS[name], mirror); }

  // ---------------------------------------------------------------- stages
  // waves: [path, mode] mode 'pair' = two mirrored streams, 'single' = one stream, 'mirror' = one mirrored stream
  var T = [ // backdrop themes: nebula colors
    { a: "#0d1a3a", b: "#2a0f3a", planet: "#3a5a9a" }, { a: "#08243a", b: "#0a3a3a", planet: "#3a8a7a" }, { a: "#1a0d2a", b: "#3a1030", planet: "#a05a8a" },
    { a: "#201406", b: "#3a1a08", planet: "#c07a3a" }, { a: "#06202a", b: "#102a4a", planet: "#5aa0c0" }, { a: "#1a0606", b: "#3a0a14", planet: "#c04a4a" },
    { a: "#0a1a10", b: "#14301a", planet: "#5aa060" }, { a: "#14082a", b: "#2a0a4a", planet: "#8a5ad0" }, { a: "#22180a", b: "#3a2a08", planet: "#d0b050" },
    { a: "#061226", b: "#200a30", planet: "#7a90e0" }, { a: "#1a1a1a", b: "#2a1a2a", planet: "#b0a0c0" }, { a: "#2a0606", b: "#0a0a2a", planet: "#e06030" }
  ];
  var LEVELS = [
    { name: "First Contact", waves: [["topLoop", "pair"], ["sideSweep", "single"], ["sideSweep", "mirror"], ["topLoop", "mirror"], ["topLoop", "single"]], dive: 3.4, maxDivers: 2, shot: 220, shots: 1, entry: 250, diveSpd: 165, entryFire: 0, beam: 0.4, loops: 0 },
    { name: "Hive Patrol", waves: [["serpent", "pair"], ["sideSweep", "single"], ["sideSweep", "mirror"], ["serpent", "mirror"], ["serpent", "single"]], dive: 3.0, maxDivers: 2, shot: 235, shots: 1, entry: 260, diveSpd: 175, entryFire: 0, beam: 0.45, loops: 0 },
    { name: "Challenging Stage", challenge: true, cwaves: [["loopExit", "pair", "bee"], ["crossSwoop", "single", "butterfly"], ["crossSwoop", "mirror", "butterfly"], ["loopExit", "mirror", "bee"], ["loopExit", "single", "boss"]], entry: 270 },
    { name: "Crimson Swarm", waves: [["corkscrew", "pair"], ["wideArc", "single"], ["wideArc", "mirror"], ["corkscrew", "mirror"], ["topLoop", "single"]], dive: 2.6, maxDivers: 3, shot: 250, shots: 2, entry: 275, diveSpd: 185, entryFire: 0.15, beam: 0.5, loops: 0.2 },
    { name: "Ion Drift", waves: [["topLoop", "pair"], ["wideArc", "single"], ["sideSweep", "mirror"], ["serpent", "mirror"], ["corkscrew", "single"]], dive: 2.3, maxDivers: 3, shot: 260, shots: 2, entry: 285, diveSpd: 195, entryFire: 0.2, beam: 0.5, loops: 0.3 },
    { name: "Blood Moon", waves: [["deepHook", "pair"], ["sideSweep", "single"], ["wideArc", "mirror"], ["deepHook", "mirror"], ["serpent", "single"]], dive: 2.0, maxDivers: 4, shot: 275, shots: 2, entry: 295, diveSpd: 205, entryFire: 0.25, beam: 0.55, loops: 0.35 },
    { name: "Challenging Stage", challenge: true, cwaves: [["figure8", "pair", "dragonfly"], ["zigzag", "single", "butterfly"], ["zigzag", "mirror", "dragonfly"], ["figure8", "mirror", "bee"], ["dropLoop", "pair", "boss"]], entry: 290 },
    { name: "Violet Front", waves: [["corkscrew", "pair"], ["deepHook", "single"], ["deepHook", "mirror"], ["wideArc", "mirror"], ["serpent", "single"]], dive: 1.75, maxDivers: 4, shot: 290, shots: 2, entry: 305, diveSpd: 215, entryFire: 0.3, beam: 0.6, loops: 0.45 },
    { name: "Solar Wind", waves: [["serpent", "pair"], ["wideArc", "single"], ["sideSweep", "mirror"], ["deepHook", "mirror"], ["corkscrew", "single"]], dive: 1.55, maxDivers: 5, shot: 305, shots: 3, entry: 315, diveSpd: 225, entryFire: 0.35, beam: 0.6, loops: 0.5 },
    { name: "Dark Lattice", waves: [["deepHook", "pair"], ["corkscrew", "single"], ["corkscrew", "mirror"], ["topLoop", "mirror"], ["deepHook", "single"]], dive: 1.35, maxDivers: 5, shot: 320, shots: 3, entry: 325, diveSpd: 235, entryFire: 0.4, beam: 0.65, loops: 0.6 },
    { name: "Challenging Stage", challenge: true, cwaves: [["rainbow", "pair", "scorpion"], ["dropLoop", "single", "dragonfly"], ["dropLoop", "mirror", "scorpion"], ["crossSwoop", "pair", "butterfly"], ["figure8", "pair", "boss"]], entry: 320 },
    { name: "Queen's Armada", waves: [["deepHook", "pair"], ["wideArc", "pair"], ["serpent", "pair"], ["corkscrew", "pair"], ["deepHook", "pair"]], dive: 1.1, maxDivers: 7, shot: 340, shots: 3, entry: 340, diveSpd: 250, entryFire: 0.5, beam: 0.7, loops: 0.7, final: true }
  ];
  LEVELS.forEach(function (l, i) { l.n = i + 1; l.theme = T[i]; });

  var api = { W: W, H: H, COLS: COLS, ROWS: ROWS, WAVES: WAVES, PATHS: PATHS, CPATHS: CPATHS, LEVELS: LEVELS,
    slotKind: slotKind, slotUsed: slotUsed, slotPos: slotPos, build: build, at: at, entryPath: entryPath, challengePath: challengePath };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GalagaLevels = api;
})(this);

/*
 * Rampart tribute: 12 designed levels and the map generator.
 * Each level has its own coastline, castles, obstacles, weather, enemy fleet and timers.
 * Pure data + pure functions so Node tests can load it. Written by: Howie
 */
(function (root) {
  "use strict";
  var COLS = 40, ROWS = 28; // canonical (landscape) map; phones in portrait get the transpose

  // ---- seeded helpers ----
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
  }
  function hash2(x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed) { return vnoise(x, y, seed) * 0.6 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.28 + vnoise(x * 4.3, y * 4.3, seed + 13) * 0.12; }
  function bump(t, c, w) { var d = (t - c) / w; return Math.exp(-d * d); }
  function inEllipse(u, v, cx, cy, rx, ry) { var a = (u - cx) / rx, b = (v - cy) / ry; return a * a + b * b; }

  // Ship classes. speed in tiles/s, range in tiles, reload in s.
  var SHIPS = {
    sloop:    { name: "Sloop",      hp: 1,  speed: 1.45, range: 7, reload: 3.4, shots: 1, len: 1.5, beam: 0.62, masts: 1, score: 100 },
    brig:     { name: "Brigantine", hp: 2,  speed: 1.2,  range: 7, reload: 3.0, shots: 1, len: 1.95, beam: 0.78, masts: 2, score: 200 },
    frigate:  { name: "Frigate",    hp: 4,  speed: 1.0,  range: 8, reload: 3.1, shots: 2, len: 2.4, beam: 0.9, masts: 3, score: 400 },
    ketch:    { name: "Bomb ketch", hp: 2,  speed: 1.0,  range: 9, reload: 4.6, shots: 1, len: 1.9, beam: 0.85, masts: 2, score: 300, fire: true },
    barge:    { name: "Landing barge", hp: 2, speed: 1.3, range: 1, reload: 99, shots: 0, len: 1.6, beam: 0.9, masts: 0, score: 250, troops: 3 },
    galleon:  { name: "Galleon",    hp: 7,  speed: 0.72, range: 8, reload: 3.3, shots: 3, len: 3.0, beam: 1.15, masts: 3, score: 800 },
    ironclad: { name: "Ironclad",   hp: 10, speed: 0.8,  range: 9, reload: 2.7, shots: 2, len: 2.8, beam: 1.0, masts: 0, score: 1200, armor: 0.35, funnel: true },
    flagship: { name: "Dreadnought flagship", hp: 30, speed: 0.5, range: 10, reload: 1.9, shots: 4, len: 4.4, beam: 1.6, masts: 3, score: 5000, armor: 0.2, boss: true }
  };

  // 12 designed levels. sea(u,v,n) -> true for water, u/v in 0..1, n = coast noise 0..1.
  var LEVELS = [
    { id: 1, name: "Seaward Watch", blurb: "A quiet coast. Learn the loop: cannons, battle, repair.", theme: "spring", weather: "clear",
      castles: 3, rocks: 3, seed: 11, rounds: [["sloop", "sloop", "sloop"], ["sloop", "sloop", "sloop", "sloop"]],
      sea: function (u, v, n) { return u > 0.7 + 0.04 * Math.sin(v * 6.5) + (n - 0.5) * 0.06; }, cannonT: 15, battleT: 22, repairT: 30 },
    { id: 2, name: "Twin Coves", blurb: "Two bays bite into the land. Brigantines join the sloops.", theme: "spring", weather: "clear",
      castles: 4, rocks: 4, seed: 23, rounds: [["sloop", "sloop", "sloop", "brig"], ["sloop", "sloop", "brig", "brig"]],
      sea: function (u, v, n) { return u > 0.7 - 0.2 * bump(v, 0.27, 0.1) - 0.17 * bump(v, 0.75, 0.09) + (n - 0.5) * 0.07; }, cannonT: 15, battleT: 22, repairT: 29 },
    { id: 3, name: "Riverbend", blurb: "A river splits the meadow. The first landing barges bring sappers.", theme: "spring", weather: "clear",
      castles: 4, rocks: 4, seed: 37, rounds: [["brig", "brig", "sloop", "sloop"], ["brig", "brig", "barge", "sloop", "sloop"]],
      sea: function (u, v, n) {
        if (u > 0.74 + 0.03 * Math.sin(v * 9) + (n - 0.5) * 0.06) return true;
        var rv = 0.47 + 0.13 * Math.sin(u * 7.5 + 0.6);
        return Math.abs(v - rv) < 0.033 && u > 0.04;
      }, cannonT: 15, battleT: 23, repairT: 28 },
    { id: 4, name: "Gull Isles", blurb: "Your island is open on three sides. Frigates fire twin shots.", theme: "spring", weather: "breezy",
      castles: 4, rocks: 3, seed: 41, rounds: [["brig", "brig", "brig", "frigate"], ["frigate", "frigate", "sloop", "sloop", "sloop"], ["frigate", "frigate", "brig", "brig"]],
      sea: function (u, v, n) {
        if (inEllipse(u, v, 0.8, 0.2, 0.06, 0.09) < 1 || inEllipse(u, v, 0.84, 0.78, 0.05, 0.08) < 1) return false;
        return inEllipse(u, v, 0.36, 0.5, 0.39, 0.46) > 1 + (n - 0.5) * 0.25;
      }, cannonT: 15, battleT: 24, repairT: 28 },
    { id: 5, name: "Amber Marsh", blurb: "Autumn lakes break up the ground. Barges land sapper squads.", theme: "autumn", weather: "leaves",
      castles: 4, rocks: 4, seed: 53, rounds: [["barge", "barge", "brig", "brig"], ["frigate", "barge", "barge", "sloop", "sloop"], ["frigate", "frigate", "barge", "barge", "brig"]],
      sea: function (u, v, n) {
        if (u > 0.73 + 0.05 * Math.sin(v * 5 + 1) + (n - 0.5) * 0.07) return true;
        return inEllipse(u, v, 0.3, 0.27, 0.07, 0.09) < 1 || inEllipse(u, v, 0.47, 0.75, 0.06, 0.08) < 1 || inEllipse(u, v, 0.12, 0.62, 0.045, 0.07) < 1;
      }, cannonT: 15, battleT: 24, repairT: 27 },
    { id: 6, name: "Sunset Strait", blurb: "Ships sail a strait between two shores. Bomb ketches throw fire.", theme: "sunset", weather: "sunset",
      castles: 5, rocks: 3, seed: 67, rounds: [["ketch", "ketch", "brig", "brig"], ["frigate", "frigate", "ketch", "ketch"], ["frigate", "frigate", "ketch", "ketch", "sloop", "sloop"]],
      sea: function (u, v, n) { return Math.abs(u - (0.6 + 0.05 * Math.sin(v * 5))) < 0.12 + (n - 0.5) * 0.05; }, cannonT: 15, battleT: 25, repairT: 26 },
    { id: 7, name: "Fogbound Reach", blurb: "Thick fog. Ships stay hidden until they are close.", theme: "moor", weather: "fog",
      castles: 4, rocks: 5, seed: 71, rounds: [["brig", "brig", "brig", "frigate", "frigate"], ["frigate", "frigate", "frigate", "barge", "barge"], ["frigate", "frigate", "ketch", "ketch", "brig", "brig"]],
      sea: function (u, v, n) { return u > 0.75 - 0.36 * bump(v, 0.5, 0.06) + (n - 0.5) * 0.08; }, cannonT: 15, battleT: 25, repairT: 26 },
    { id: 8, name: "Desert Citadel", blurb: "Sand, palms and oases. The great galleons arrive.", theme: "desert", weather: "heat",
      castles: 5, rocks: 5, seed: 83, rounds: [["galleon", "brig", "brig", "brig"], ["galleon", "frigate", "frigate", "barge"], ["galleon", "galleon", "ketch", "ketch"]],
      sea: function (u, v, n) {
        if (u + v * 0.55 > 1.12 + (n - 0.5) * 0.08) return true;
        return inEllipse(u, v, 0.22, 0.3, 0.05, 0.07) < 1 || inEllipse(u, v, 0.52, 0.2, 0.04, 0.06) < 1;
      }, cannonT: 15, battleT: 26, repairT: 25 },
    { id: 9, name: "Moonlit Harbor", blurb: "A night raid on the harbor. Watch for ship lanterns.", theme: "night", weather: "night",
      castles: 5, rocks: 3, seed: 97, rounds: [["frigate", "frigate", "frigate", "ketch", "ketch"], ["galleon", "galleon", "barge", "barge", "sloop", "sloop"], ["galleon", "galleon", "frigate", "frigate", "ketch", "ketch"]],
      sea: function (u, v, n) {
        var mole = (u > 0.6 && u < 0.86 && Math.abs(v - 0.3) < 0.035) || (u > 0.8 && u < 0.84 && v > 0.3 && v < 0.5);
        if (mole) return false;
        return u > 0.64 + 0.03 * Math.sin(v * 7) + (n - 0.5) * 0.06;
      }, cannonT: 15, battleT: 26, repairT: 25 },
    { id: 10, name: "Frost Fjord", blurb: "Icy fjords cut deep. Armored ironclads shrug off glancing hits.", theme: "snow", weather: "snow",
      castles: 5, rocks: 5, seed: 101, rounds: [["ironclad", "frigate", "frigate"], ["ironclad", "galleon", "barge", "barge"], ["ironclad", "ironclad", "frigate", "frigate", "ketch"]],
      sea: function (u, v, n) {
        var c = 0.76 - 0.3 * bump(v, 0.2, 0.035) - 0.36 * bump(v, 0.55, 0.035) - 0.26 * bump(v, 0.85, 0.035);
        return u > c + (n - 0.5) * 0.06;
      }, cannonT: 15, battleT: 27, repairT: 24 },
    { id: 11, name: "Storm Coast", blurb: "Gale winds push your shots off course. Lead your targets.", theme: "storm", weather: "storm",
      castles: 5, rocks: 4, seed: 113, rounds: [["galleon", "galleon", "frigate", "frigate", "ketch", "ketch"], ["ironclad", "ironclad", "barge", "barge", "brig", "brig"], ["ironclad", "ironclad", "galleon", "galleon", "ketch", "ketch"]],
      sea: function (u, v, n) { return u > 0.66 + 0.06 * Math.sin(v * 11) + (n - 0.5) * 0.16; }, cannonT: 15, battleT: 28, repairT: 24 },
    { id: 12, name: "The Last Bastion", blurb: "The enemy flagship leads the final assault. Hold the island.", theme: "ember", weather: "embers",
      castles: 5, rocks: 3, seed: 127, final: true, rounds: [["ironclad", "ironclad", "galleon", "galleon"], ["frigate", "frigate", "frigate", "ketch", "ketch", "barge", "barge", "barge"], ["flagship", "ironclad", "ironclad", "frigate", "frigate"]],
      sea: function (u, v, n) { return inEllipse(u, v, 0.4, 0.5, 0.36, 0.44) > 1 + (n - 0.5) * 0.22; }, cannonT: 16, battleT: 32, repairT: 24 }
  ];

  // Build the tile map for a level. portrait=true returns the transpose (ROWS x COLS).
  function buildMap(level, portrait) {
    var L = typeof level === "number" ? LEVELS[level - 1] : level;
    var cols = portrait ? ROWS : COLS, rows = portrait ? COLS : ROWS;
    var n = cols * rows, water = new Uint8Array(n), rock = new Uint8Array(n);
    var x, y, i;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      var cx = portrait ? y : x, cy = portrait ? x : y; // canonical coords
      var u = (cx + 0.5) / COLS, v = (cy + 0.5) / ROWS;
      var nz = fbm(cx * 0.22, cy * 0.22, L.seed);
      water[y * cols + x] = L.sea(u, v, nz) ? 1 : 0;
    }
    // remove 1-tile specks so the coast is clean
    for (var pass = 0; pass < 2; pass++) for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      i = y * cols + x; var same = 0, tot = 0;
      for (var d = 0; d < 4; d++) {
        var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        tot++; if (water[ny * cols + nx] === water[i]) same++;
      }
      if (same <= 1 && tot >= 3) water[i] = 1 - water[i];
    }
    // distance from water (Chebyshev BFS), used for castle placement
    var dist = new Int16Array(n).fill(999), q = [];
    for (i = 0; i < n; i++) if (water[i]) { dist[i] = 0; q.push(i); }
    for (var h = 0; h < q.length; h++) {
      var c = q[h], qx = c % cols, qy = (c / cols) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var ax = qx + dx, ay = qy + dy; if (ax < 0 || ay < 0 || ax >= cols || ay >= rows) continue;
        var j = ay * cols + ax; if (dist[j] > dist[c] + 1) { dist[j] = dist[c] + 1; q.push(j); }
      }
    }
    var R = rng(L.seed * 7919 + (portrait ? 3 : 1));
    // castles: farthest-point sampling over tiles with room for the 8x8 home ring
    function roomy(tx, ty) {
      for (var yy = ty - 3; yy <= ty + 4; yy++) for (var xx = tx - 3; xx <= tx + 4; xx++) {
        if (xx < 1 || yy < 1 || xx >= cols - 1 || yy >= rows - 1) return false;
        if (water[yy * cols + xx]) return false;
      }
      return true;
    }
    var cand = [];
    for (y = 4; y < rows - 5; y++) for (x = 4; x < cols - 5; x++) if (roomy(x, y)) cand.push([x, y, dist[y * cols + x] + dist[(y + 1) * cols + x + 1]]);
    var castles = [];
    if (cand.length) {
      // first castle: the most central candidate closest to the sea (a classic "home" pick)
      cand.sort(function (a, b) { return a[2] - b[2] || (a[0] * 31 + a[1]) - (b[0] * 31 + b[1]); });
      castles.push({ x: cand[(R() * Math.min(6, cand.length)) | 0][0], y: 0 });
      castles[0].y = cand.filter(function (c2) { return c2[0] === castles[0].x; })[0][1];
      while (castles.length < L.castles) {
        var best = null, bd = -1;
        for (var k = 0; k < cand.length; k++) {
          var md = 1e9;
          for (var m = 0; m < castles.length; m++) { var ddx = cand[k][0] - castles[m].x, ddy = cand[k][1] - castles[m].y; md = Math.min(md, ddx * ddx + ddy * ddy); }
          md -= cand[k][2] * 1.5; // prefer castles nearer the coast
          md += R() * 4;
          if (md > bd) { bd = md; best = cand[k]; }
        }
        if (!best) break;
        var bdx = 0; for (var m2 = 0; m2 < castles.length; m2++) { var e1 = best[0] - castles[m2].x, e2 = best[1] - castles[m2].y; if (e1 * e1 + e2 * e2 < 36) bdx = 1; }
        if (bdx) break;
        castles.push({ x: best[0], y: best[1] });
      }
    }
    // obstacles: small rock / tree clusters away from castles and their home rings
    function nearCastle(tx, ty) { for (var c3 = 0; c3 < castles.length; c3++) if (Math.abs(tx - castles[c3].x - 0.5) < 5.5 && Math.abs(ty - castles[c3].y - 0.5) < 5.5) return true; return false; }
    var placed = 0, tries = 0;
    while (placed < L.rocks && tries++ < 400) {
      var rx = 1 + ((R() * (cols - 2)) | 0), ry = 1 + ((R() * (rows - 2)) | 0);
      if (water[ry * cols + rx] || nearCastle(rx, ry) || dist[ry * cols + rx] < 2) continue;
      var size = 2 + ((R() * 3) | 0);
      for (var s = 0; s < size; s++) {
        var sx = rx + ((R() * 3) | 0) - 1, sy = ry + ((R() * 3) | 0) - 1;
        if (sx < 1 || sy < 1 || sx >= cols - 1 || sy >= rows - 1) continue;
        if (!water[sy * cols + sx] && !nearCastle(sx, sy)) rock[sy * cols + sx] = 1;
      }
      placed++;
    }
    return { cols: cols, rows: rows, water: water, rock: rock, castles: castles, landDist: dist, portrait: !!portrait, level: L };
  }

  // Wall pieces (polyominoes). Harder levels add awkward shapes.
  var PIECES = {
    easy: [
      [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]]
    ],
    mid: [
      [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]], [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]
    ],
    hard: [
      [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]], [[0, 0]], [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]]
    ]
  };
  function piecePool(levelId) {
    var p = PIECES.easy.slice();
    if (levelId >= 3) p = p.concat(PIECES.mid);
    if (levelId >= 6) p = p.concat(PIECES.hard);
    return p;
  }

  var API = { COLS: COLS, ROWS: ROWS, LEVELS: LEVELS, SHIPS: SHIPS, PIECES: PIECES, piecePool: piecePool, buildMap: buildMap, rng: rng, fbm: fbm, vnoise: vnoise, hash2: hash2 };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.RampartLevels = API;
})(typeof window !== "undefined" ? window : this);

/*
 * Rampart tribute: pure rules shared by the game and the Node tests.
 * Grid state, wall pieces, territory (enclosure) and placement checks. Written by: Howie
 */
(function (root) {
  "use strict";
  // Tile codes for grid.t
  var LAND = 0, WATER = 1, ROCK = 2;

  // Make a playable grid from a built map (see levels.js buildMap).
  function makeGrid(map) {
    var n = map.cols * map.rows;
    var g = {
      cols: map.cols, rows: map.rows,
      t: new Uint8Array(n),        // LAND / WATER / ROCK
      wall: new Uint8Array(n),     // 1 = wall block
      rubble: new Uint8Array(n),   // 1 = wall rubble (buildable, cosmetic)
      crater: new Uint8Array(n),   // >0 = rounds a crater / fire scar blocks building
      fire: new Float32Array(n),   // seconds of burning left (blocks building)
      cannon: new Int16Array(n).fill(-1), // cannon index occupying the tile
      castle: new Int16Array(n).fill(-1), // castle index occupying the tile
      grunt: new Uint8Array(n),    // 1 = enemy sapper standing here
      sea: new Uint8Array(n),      // water connected to the map edge (ships sail here)
      enclosed: new Uint8Array(n)
    };
    for (var i = 0; i < n; i++) g.t[i] = map.water[i] ? WATER : (map.rock[i] ? ROCK : LAND);
    map.castles.forEach(function (c, k) {
      for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) g.castle[(c.y + dy) * g.cols + c.x + dx] = k;
    });
    // sea = water reachable from the border
    var q = [];
    for (var y = 0; y < g.rows; y++) for (var x = 0; x < g.cols; x++) {
      if (x && y && x < g.cols - 1 && y < g.rows - 1) continue;
      var j = y * g.cols + x; if (g.t[j] === WATER && !g.sea[j]) { g.sea[j] = 1; q.push(j); }
    }
    flood(g, q, function (k) { return g.t[k] === WATER && !g.sea[k]; }, function (k) { g.sea[k] = 1; });
    return g;
  }

  function flood(g, q, ok, mark) {
    for (var h = 0; h < q.length; h++) {
      var c = q[h], x = c % g.cols, y = (c / g.cols) | 0;
      if (x > 0 && ok(c - 1)) { mark(c - 1); q.push(c - 1); }
      if (x < g.cols - 1 && ok(c + 1)) { mark(c + 1); q.push(c + 1); }
      if (y > 0 && ok(c - g.cols)) { mark(c - g.cols); q.push(c - g.cols); }
      if (y < g.rows - 1 && ok(c + g.cols)) { mark(c + g.cols); q.push(c + g.cols); }
    }
  }

  // Territory: every non-wall land tile that cannot reach the map edge or any water
  // through 4-way steps without crossing a wall. Diagonal wall joints seal, as in the arcade.
  function computeTerritory(g) {
    var n = g.cols * g.rows, out = new Uint8Array(n), q = [], x, y, i;
    for (i = 0; i < n; i++) if (g.t[i] === WATER) { out[i] = 1; q.push(i); }
    for (y = 0; y < g.rows; y++) for (x = 0; x < g.cols; x++) {
      if (x && y && x < g.cols - 1 && y < g.rows - 1) continue;
      i = y * g.cols + x; if (!g.wall[i] && !out[i]) { out[i] = 1; q.push(i); }
    }
    flood(g, q, function (k) { return !out[k] && !g.wall[k]; }, function (k) { out[k] = 1; });
    var enc = new Uint8Array(n), count = 0;
    for (i = 0; i < n; i++) if (!out[i] && !g.wall[i]) { enc[i] = 1; count++; }
    g.enclosed = enc;
    return count;
  }

  function castleEnclosed(g, c) {
    for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) if (!g.enclosed[(c.y + dy) * g.cols + c.x + dx]) return false;
    return true;
  }

  // The 8x8 starting ring of walls around a castle (castle sits at the ring's center).
  function homeRing(g, c) {
    var tiles = [];
    for (var y = c.y - 3; y <= c.y + 4; y++) for (var x = c.x - 3; x <= c.x + 4; x++) {
      if (x !== c.x - 3 && x !== c.x + 4 && y !== c.y - 3 && y !== c.y + 4) continue;
      if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
      var i = y * g.cols + x;
      if (g.t[i] === LAND && g.castle[i] < 0) tiles.push(i);
    }
    return tiles;
  }

  // Piece helpers: a piece is a list of [x, y] cells.
  function normalize(p) {
    var mx = Infinity, my = Infinity;
    p.forEach(function (c) { mx = Math.min(mx, c[0]); my = Math.min(my, c[1]); });
    return p.map(function (c) { return [c[0] - mx, c[1] - my]; });
  }
  function rotate(p) { return normalize(p.map(function (c) { return [-c[1], c[0]]; })); }
  function size(p) { var w = 0, h = 0; p.forEach(function (c) { w = Math.max(w, c[0] + 1); h = Math.max(h, c[1] + 1); }); return { w: w, h: h }; }

  function tileFree(g, x, y) {
    if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return false;
    var i = y * g.cols + x;
    return g.t[i] === LAND && !g.wall[i] && g.castle[i] < 0 && g.cannon[i] < 0 && !g.crater[i] && !(g.fire[i] > 0) && !g.grunt[i];
  }
  function canPlacePiece(g, p, ox, oy) {
    for (var k = 0; k < p.length; k++) if (!tileFree(g, ox + p[k][0], oy + p[k][1])) return false;
    return true;
  }
  function placePiece(g, p, ox, oy) {
    if (!canPlacePiece(g, p, ox, oy)) return false;
    p.forEach(function (c) { var i = (oy + c[1]) * g.cols + ox + c[0]; g.wall[i] = 1; g.rubble[i] = 0; });
    return true;
  }
  // Cannons are 2x2 and must sit entirely inside your territory.
  function canPlaceCannon(g, x, y) {
    for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
      if (!tileFree(g, x + dx, y + dy)) return false;
      if (!g.enclosed[(y + dy) * g.cols + x + dx]) return false;
    }
    return true;
  }
  // How many cannons you may place this build phase.
  function cannonAllowance(g, castles, homeIdx, firstRound) {
    if (firstRound) return 3;
    var n = 0;
    castles.forEach(function (c, k) { if (castleEnclosed(g, c)) n += k === homeIdx ? 2 : 1; });
    return Math.max(n, 0);
  }

  var API = { LAND: LAND, WATER: WATER, ROCK: ROCK, makeGrid: makeGrid, computeTerritory: computeTerritory, castleEnclosed: castleEnclosed,
    homeRing: homeRing, rotate: rotate, normalize: normalize, size: size, tileFree: tileFree, canPlacePiece: canPlacePiece,
    placePiece: placePiece, canPlaceCannon: canPlaceCannon, cannonAllowance: cannonAllowance };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.RampartCore = API;
})(typeof window !== "undefined" ? window : this);

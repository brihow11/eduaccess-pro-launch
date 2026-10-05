/* Gauntlet tribute: 12 dungeon floors, built from a seeded room-and-corridor generator so every
   floor is the same on every visit and is always solvable (a key always lies before each door).
   Legend: # wall   w breakable wall   . floor   S start   E exit   D door (needs a key)
           K key   F food   J cider jug (can be shot!)   X poison   P potion   T treasure
           G ghost bones   R grunt den   M demon pit   L lobber hut   O sorcerer altar   (monster generators)
           g r m l o  a monster already awake    x Death
   Written by: Howie */
(function () {
  'use strict';
  var LEVELS = [
    { name: 'The Gate', theme: 0, seed: 11, w: 34, h: 24, cols: 4, rows: 3, doors: 0, loops: 0.25, gens: 'GGGG', rank: [1, 1], awake: 'ggg', food: 4, jugs: 1, treas: 5, potions: 1, poison: 0, death: 0, bw: 1, pillars: 0.4,
      tip: 'Shoot the bone piles. They keep making ghosts.' },
    { name: 'Grunt Barracks', theme: 1, seed: 23, w: 38, h: 26, cols: 4, rows: 3, doors: 1, loops: 0.25, gens: 'RRRGG', rank: [1, 2], awake: 'rrg', food: 4, jugs: 1, treas: 5, potions: 1, poison: 0, death: 0, bw: 2, pillars: 0.5,
      tip: 'Grunts club you up close. Keep your distance and fire.' },
    { name: 'The Demon Pits', theme: 2, seed: 37, w: 40, h: 28, cols: 5, rows: 3, doors: 1, loops: 0.3, gens: 'MMMRG', rank: [1, 2], awake: 'mmr', food: 5, jugs: 1, treas: 6, potions: 1, poison: 1, death: 0, bw: 2, pillars: 0.5,
      tip: 'Demons spit fire from a distance. Use the walls for cover.' },
    { name: 'Lobber Gallery', theme: 3, seed: 41, w: 40, h: 28, cols: 5, rows: 4, doors: 1, loops: 0.3, gens: 'LLLGRM', rank: [1, 2], awake: 'llg', food: 5, jugs: 2, treas: 6, potions: 2, poison: 1, death: 0, bw: 5, pillars: 0.6,
      tip: 'Lobbers throw rocks over walls. Hunt them down fast.' },
    { name: 'Hall of Doors', theme: 4, seed: 59, w: 42, h: 30, cols: 5, rows: 4, doors: 3, vaults: 2, loops: 0.15, gens: 'GGRRMM', rank: [1, 2], awake: 'grm', food: 5, jugs: 1, treas: 8, potions: 2, poison: 1, death: 0, bw: 2, pillars: 0.5,
      tip: 'A key opens a whole door. Grab every key you see.' },
    { name: 'Sorcerer Crypt', theme: 5, seed: 67, w: 42, h: 30, cols: 5, rows: 4, doors: 2, vaults: 1, loops: 0.3, gens: 'OOOGGR', rank: [2, 2], awake: 'oog', food: 5, jugs: 2, treas: 7, potions: 2, poison: 2, death: 0, bw: 3, pillars: 0.6,
      tip: 'Sorcerers vanish. Your shots pass through them while they are unseen.' },
    { name: 'Death Walks', theme: 6, seed: 73, w: 44, h: 30, cols: 5, rows: 4, doors: 2, vaults: 1, loops: 0.35, gens: 'GGRMLO', rank: [1, 3], awake: 'grl', food: 6, jugs: 2, treas: 7, potions: 3, poison: 2, death: 1, bw: 3, pillars: 0.5,
      tip: 'Death cannot be shot. Outrun it, or blast it with a potion.' },
    { name: 'The Pit', theme: 7, seed: 89, w: 44, h: 32, cols: 4, rows: 4, doors: 1, loops: 0.9, open: 0.55, gens: 'GGGRRMMLL', rank: [2, 3], awake: 'ggrrm', food: 7, jugs: 2, treas: 6, potions: 3, poison: 2, death: 1, bw: 2, pillars: 0.8,
      tip: 'The pit is open ground. Do not let them surround you.' },
    { name: 'Treasure Vault', theme: 8, seed: 97, w: 44, h: 32, cols: 6, rows: 4, doors: 3, vaults: 3, loops: 0.2, gens: 'GRRMLO', rank: [2, 3], awake: 'gro', food: 6, jugs: 2, treas: 22, potions: 2, poison: 2, death: 1, bw: 3, pillars: 0.5,
      tip: 'Grab the gold, but the vault guards are wide awake.' },
    { name: 'The Labyrinth', theme: 9, seed: 103, w: 43, h: 31, cols: 10, rows: 7, doors: 2, vaults: 1, loops: 0.12, gens: 'GGGGGRO', rank: [2, 3], awake: 'gggo', food: 7, jugs: 2, treas: 8, potions: 3, poison: 3, death: 1, bw: 4, pillars: 0,
      tip: 'Twisting halls. Ghosts love tight corners.' },
    { name: 'Burning Halls', theme: 10, seed: 113, w: 46, h: 32, cols: 6, rows: 4, doors: 3, vaults: 1, loops: 0.3, gens: 'GGRRMMMLLO', rank: [2, 3], awake: 'mmrlo', food: 7, jugs: 3, treas: 8, potions: 3, poison: 3, death: 2, bw: 3, pillars: 0.6,
      tip: 'Fire everywhere. Find food before your strength fails.' },
    { name: "Death's Throne", theme: 11, seed: 131, w: 48, h: 34, cols: 6, rows: 5, doors: 3, vaults: 2, loops: 0.35, gens: 'GGGRRMMLLOO', rank: [3, 3], awake: 'gmrlo', food: 8, jugs: 3, treas: 10, potions: 4, poison: 3, death: 3, bw: 4, pillars: 0.6,
      tip: 'The last hall. Everything that lives down here wants you dead.' }
  ];

  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // flood fill over walkable tiles; 'block' says which chars stop the fill
  function flood(g, sx, sy, block) {
    var H = g.length, W = g[0].length, seen = new Uint8Array(W * H), q = [sx + sy * W], n = 0;
    seen[sx + sy * W] = 1;
    while (q.length) {
      var i = q.pop(), x = i % W, y = (i / W) | 0; n++;
      for (var d = 0; d < 4; d++) {
        var nx = x + DIRS[d][0], ny = y + DIRS[d][1], j = nx + ny * W;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j]) continue;
        if (block.indexOf(g[ny][nx]) >= 0) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return { seen: seen, n: n };
  }

  function build(L) {
    var R = rng(L.seed * 7919 + 17), W = L.w, H = L.h, cols = L.cols, rows = L.rows;
    var ri = function (a, b) { return a + Math.floor(R() * (b - a + 1)); };
    var g = [], x, y;
    for (y = 0; y < H; y++) { g.push([]); for (x = 0; x < W; x++) g[y].push('#'); }
    // cell boundaries (wall lines) spread evenly
    var xs = [], ys = [];
    for (var c = 0; c <= cols; c++) xs.push(Math.round(c * (W - 1) / cols));
    for (var r = 0; r <= rows; r++) ys.push(Math.round(r * (H - 1) / rows));
    var cells = [];
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var cell = { c: c, r: r, x0: xs[c] + 1, x1: xs[c + 1] - 1, y0: ys[r] + 1, y1: ys[r + 1] - 1, adj: [], id: cells.length };
      for (y = cell.y0; y <= cell.y1; y++) for (x = cell.x0; x <= cell.x1; x++) g[y][x] = '.';
      cells.push(cell);
    }
    var at = function (c, r) { return cells[r * cols + c]; };
    // spanning tree (randomized DFS), then extra loops
    var edges = [], key = function (a, b) { return a < b ? a + ':' + b : b + ':' + a; }, has = {};
    function link(a, b) { var e = { a: a, b: b, door: false }; edges.push(e); has[key(a.id, b.id)] = e; a.adj.push({ to: b, e: e }); b.adj.push({ to: a, e: e }); }
    var visited = {}, stack = [cells[0]]; visited[0] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1], nb = [];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var cc = cur.c + d[0], rr = cur.r + d[1];
        if (cc >= 0 && rr >= 0 && cc < cols && rr < rows && !visited[rr * cols + cc]) nb.push(at(cc, rr));
      });
      if (!nb.length) { stack.pop(); continue; }
      var nx = nb[Math.floor(R() * nb.length)]; visited[nx.id] = true; link(cur, nx); stack.push(nx);
    }
    var tree = edges.slice();
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      if (c + 1 < cols && !has[key(at(c, r).id, at(c + 1, r).id)] && R() < L.loops) link(at(c, r), at(c + 1, r));
      if (r + 1 < rows && !has[key(at(c, r).id, at(c, r + 1).id)] && R() < L.loops) link(at(c, r), at(c, r + 1));
    }
    // carve the openings between linked cells (open levels knock out whole walls)
    function carve(e, ch) {
      var a = e.a, b = e.b, t = [], i;
      if (a.r === b.r) {
        var wx = Math.max(a.x1, b.x1) === b.x1 && b.c > a.c ? a.x1 + 1 : b.x1 + 1;
        var lo = Math.max(a.y0, b.y0), hi = Math.min(a.y1, b.y1), span = hi - lo + 1;
        var gw = L.open && R() < L.open ? span : Math.min(span, span <= 3 ? span : ri(2, 3));
        var s = lo + ri(0, span - gw);
        for (i = 0; i < gw; i++) t.push([wx, s + i]);
      } else {
        var wy = b.r > a.r ? a.y1 + 1 : b.y1 + 1;
        var lo2 = Math.max(a.x0, b.x0), hi2 = Math.min(a.x1, b.x1), span2 = hi2 - lo2 + 1;
        var gw2 = L.open && R() < L.open ? span2 : Math.min(span2, span2 <= 3 ? span2 : ri(2, 3));
        var s2 = lo2 + ri(0, span2 - gw2);
        for (i = 0; i < gw2; i++) t.push([s2 + i, wy]);
      }
      e.tiles = t;
      t.forEach(function (p) { g[p[1]][p[0]] = ch || '.'; });
    }
    edges.forEach(function (e) { carve(e); });
    // open levels: also knock out wall-line crossings left standing alone
    // start in a corner cell, exit in the farthest cell
    var start = cells[0];
    function dist(from, blocked) {
      var d = {}, q = [from]; d[from.id] = 0;
      while (q.length) { var u = q.shift(); u.adj.forEach(function (a) { if (blocked && blocked(a.e)) return; if (d[a.to.id] == null) { d[a.to.id] = d[u.id] + 1; a.to.prev = a.e; a.to.prevCell = u; q.push(a.to); } }); }
      return d;
    }
    cells.forEach(function (cc) { cc.prev = null; });
    var d0 = dist(start), exitCell = start;
    cells.forEach(function (cc) { if (d0[cc.id] > d0[exitCell.id]) exitCell = cc; });
    // path of edges from start to exit
    var pathE = [], pc = exitCell, onPath = {};
    while (pc !== start) { pathE.unshift(pc.prev); onPath[pc.id] = 1; pc = pc.prevCell; }
    onPath[start.id] = 1;
    var occupied = {};
    function freeTile(cell, margin) {
      margin = margin == null ? 1 : margin;
      for (var tries = 0; tries < 60; tries++) {
        var tx = ri(cell.x0 + margin > cell.x1 ? cell.x0 : cell.x0 + margin, cell.x1 - margin < cell.x0 ? cell.x1 : cell.x1 - margin);
        var ty = ri(cell.y0 + margin > cell.y1 ? cell.y0 : cell.y0 + margin, cell.y1 - margin < cell.y0 ? cell.y1 : cell.y1 - margin);
        if (g[ty][tx] === '.' && !occupied[tx + ',' + ty]) { occupied[tx + ',' + ty] = 1; return [tx, ty]; }
      }
      return null;
    }
    function put(cell, ch, margin) { var p = freeTile(cell, margin); if (p) g[p[1]][p[0]] = ch; return p; }
    // pillars and wall stubs inside bigger rooms, only if the floor stays connected
    cells.forEach(function (cc) {
      var cw = cc.x1 - cc.x0 + 1, chh = cc.y1 - cc.y0 + 1;
      if (cw < 6 || chh < 5 || R() > L.pillars || cc === start) return;
      var shape = ri(0, 2), placed = [];
      if (shape === 0) { // four pillars
        [[cc.x0 + 2, cc.y0 + 2], [cc.x1 - 2, cc.y0 + 2], [cc.x0 + 2, cc.y1 - 2], [cc.x1 - 2, cc.y1 - 2]].forEach(function (p) { if (g[p[1]][p[0]] === '.') { g[p[1]][p[0]] = '#'; placed.push(p); } });
      } else if (shape === 1) { // a short wall across the middle
        var my = Math.floor((cc.y0 + cc.y1) / 2);
        for (x = cc.x0 + 2; x <= cc.x1 - 2; x++) if (g[my][x] === '.') { g[my][x] = '#'; placed.push([x, my]); }
      } else { // an L corner
        var lx = cc.x0 + 2, ly = cc.y0 + 2, len = Math.min(cw, chh) - 3;
        for (var k = 0; k < len; k++) { if (g[ly][lx + k] === '.') { g[ly][lx + k] = '#'; placed.push([lx + k, ly]); } if (g[ly + k][lx] === '.') { g[ly + k][lx] = '#'; placed.push([lx, ly + k]); } }
      }
      var total = 0; for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (g[y][x] !== '#') total++;
      if (flood(g, start.x0, start.y0, '#').n !== total) placed.forEach(function (p) { g[p[1]][p[0]] = '.'; });
      else placed.forEach(function (p) { occupied[p[0] + ',' + p[1]] = 1; });
    });
    // doors along the path, spread out; the key for each lies before it
    var nd = Math.min(L.doors, pathE.length), doorEdges = [];
    for (var di = 0; di < nd; di++) doorEdges.push(pathE[Math.min(pathE.length - 1, Math.floor((di + 1) * pathE.length / (nd + 1)))]);
    doorEdges = doorEdges.filter(function (e, i) { return doorEdges.indexOf(e) === i; });
    // if a loop bypasses a door, the door would be pointless; close loop edges that create a bypass
    doorEdges.forEach(function (de) {
      de.door = true;
      for (var guard = 0; guard < 20; guard++) {
        var dd = dist(start, function (e) { return e.door; });
        if (dd[de.b.id] == null || dd[de.a.id] == null) break;
        // find a non-tree edge to close: any edge that is not a door and not in the tree, crossing between sides
        var closed = false;
        for (var ei = 0; ei < edges.length && !closed; ei++) {
          var e = edges[ei]; if (e.door || tree.indexOf(e) >= 0 || e.closed) continue;
          e.closed = true; e.door = true; e.tiles.forEach(function (p) { g[p[1]][p[0]] = '#'; });
          var test = dist(start, function (x2) { return x2.door; });
          if (test[de.a.id] != null && test[de.b.id] != null) { closed = false; } else closed = true;
        }
        if (!closed) break;
      }
    });
    doorEdges.forEach(function (de) { de.tiles.forEach(function (p) { g[p[1]][p[0]] = 'D'; occupied[p[0] + ',' + p[1]] = 1; }); });
    // place keys
    doorEdges.forEach(function (de, i) {
      var blocked = doorEdges.slice(i);
      var dd = dist(start, function (e) { return blocked.indexOf(e) >= 0 || (e.door && e.closed); });
      var opts = cells.filter(function (cc) { return dd[cc.id] != null && cc !== start; });
      var deadEnds = opts.filter(function (cc) { return !onPath[cc.id]; });
      var pick = (deadEnds.length ? deadEnds : opts.length ? opts : [start]);
      pick.sort(function (a, b) { return dd[b.id] - dd[a.id]; });
      put(pick[Math.floor(R() * Math.min(2, pick.length))], 'K');
    });
    // treasure vaults: dead-end cells (one opening) off the path, sealed with a door; key placed near the start
    var vaults = 0;
    cells.forEach(function (cc) {
      if (vaults >= (L.vaults || 0) || onPath[cc.id] || cc === start) return;
      var open = cc.adj.filter(function (a) { return !a.e.closed; });
      if (open.length !== 1 || open[0].e.door) return;
      var e = open[0].e; e.door = true; e.tiles.forEach(function (p) { g[p[1]][p[0]] = 'D'; occupied[p[0] + ',' + p[1]] = 1; });
      cc.vault = true; vaults++;
      for (var t = 0; t < 4; t++) put(cc, 'T', 0);
      put(cc, R() < 0.5 ? 'P' : 'F', 0);
      var before = dist(start, function (x2) { return x2.door; });
      var near = cells.filter(function (k2) { return before[k2.id] != null && before[k2.id] <= 2 && k2 !== start; });
      put(near.length ? near[Math.floor(R() * near.length)] : start, 'K');
    });
    // start and exit
    var sp = put(start, 'S', 1) || put(start, 'S', 0);
    put(exitCell, 'E', 1) || put(exitCell, 'E', 0);
    // generators away from the start, spread across cells
    var far = cells.filter(function (cc) { return cc !== start && cc !== exitCell && !cc.vault && Math.abs(cc.c - start.c) + Math.abs(cc.r - start.r) >= 2; });
    if (!far.length) far = cells.filter(function (cc) { return cc !== start; });
    L.gens.split('').forEach(function (ch, i) { put(far[(i * 7 + ri(0, far.length - 1)) % far.length], ch, 1); });
    var mid = cells.filter(function (cc) { return cc !== start && !cc.vault; });
    L.awake.split('').forEach(function (ch) { put(mid[ri(0, mid.length - 1)], ch, 0); });
    for (var dth = 0; dth < L.death; dth++) put(far[ri(0, far.length - 1)], 'x', 1);
    function scatter(ch, n) { for (var i2 = 0; i2 < n; i2++) put(cells[ri(0, cells.length - 1)], ch, 0); }
    scatter('F', L.food); scatter('J', L.jugs); scatter('T', L.treas); scatter('P', L.potions); scatter('X', L.poison);
    if (L.food > 1) put(start, 'F', 0);
    // breakable walls: knock a shortcut through a solid stretch of wall between two rooms
    var bwDone = 0;
    for (var tries2 = 0; tries2 < 400 && bwDone < L.bw; tries2++) {
      var bx = ri(2, W - 3), by = ri(2, H - 3);
      if (g[by][bx] !== '#') continue;
      var horiz = g[by][bx - 1] === '.' && g[by][bx + 1] === '.' && g[by - 1][bx] === '#' && g[by + 1][bx] === '#';
      var vert = g[by - 1][bx] === '.' && g[by + 1][bx] === '.' && g[by][bx - 1] === '#' && g[by][bx + 1] === '#';
      if (!horiz && !vert) continue;
      g[by][bx] = 'w'; bwDone++;
      // the shortcut must not skip a door: undo it if a door becomes bypassable
      var keysFree = flood(g, sp[0], sp[1], '#D');
      var ex = null; for (y = 0; y < H && !ex; y++) for (x = 0; x < W; x++) if (g[y][x] === 'E') { ex = [x, y]; break; }
      var before2 = g[by][bx]; g[by][bx] = '#';
      var withoutW = flood(g, sp[0], sp[1], '#D');
      g[by][bx] = before2;
      if (keysFree.n !== withoutW.n + 0 && doorEdges.length && keysFree.seen[ex[0] + ex[1] * W] && !withoutW.seen[ex[0] + ex[1] * W]) { g[by][bx] = '#'; bwDone--; }
      else if (keysFree.n !== withoutW.n) {
        // opened access to a door-sealed region: forbid
        g[by][bx] = '#'; bwDone--;
      }
    }
    return g.map(function (row) { return row.join(''); });
  }

  for (var i = 0; i < LEVELS.length; i++) LEVELS[i].rows = build(LEVELS[i]);

  // solver used by the tests and by ?debug=1: can the hero reach the exit, picking up keys as it goes?
  function solvable(rows) {
    var g = rows.map(function (r) { return r.replace(/w/g, '.').split(''); }), H = g.length, W = g[0].length, s, e;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { if (g[y][x] === 'S') s = [x, y]; if (g[y][x] === 'E') e = [x, y]; }
    if (!s || !e) return false;
    var keys = 0, taken = {};
    for (var it = 0; it < 99; it++) {
      var f = flood(g, s[0], s[1], '#D');
      if (f.seen[e[0] + e[1] * W]) return true;
      var door = null;
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (f.seen[x + y * W] && g[y][x] === 'K' && !taken[x + ',' + y]) { taken[x + ',' + y] = 1; keys++; }
      }
      for (y = 0; y < H && !door; y++) for (x = 0; x < W; x++) if (g[y][x] === 'D') {
        for (var d = 0; d < 4; d++) { var nx = x + DIRS[d][0], ny = y + DIRS[d][1]; if (f.seen[nx + ny * W]) { door = [x, y]; break; } }
        if (door) break;
      }
      if (!door || keys < 1) return false;
      keys--;
      var st = [door];
      while (st.length) { var p = st.pop(); if (g[p[1]][p[0]] !== 'D') continue; g[p[1]][p[0]] = '.'; for (d = 0; d < 4; d++) st.push([p[0] + DIRS[d][0], p[1] + DIRS[d][1]]); }
    }
    return false;
  }

  var api = { LEVELS: LEVELS, solvable: solvable, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GauntletLevels = api;
})();

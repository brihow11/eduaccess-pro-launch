/* Gauntlet tribute art: original 16-bit-style dungeon art painted procedurally into offscreen canvases
   (stone floors and walls with depth, doors, exits, four heroes in eight facings, monsters, generators,
   items and shots). No image files and no copied arcade graphics. Written by: Howie
     GArt.THEMES[i]                       dungeon palettes, one per level
     GArt.paintLevel(cv, rows, theme, px) paint the static layer (px pixels per tile)
     GArt.repaint(cv, rows, theme, px, x, y)  repaint one tile and its neighbours (door opened, wall broken)
     GArt.setScale(k)                     pixels per world unit for the sprite cache
     GArt.sprite(name, dir, frame, rank)  -> cached canvas, 40 x 40 world units, centred */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var A = window.GArt = {};

  function hash(x, y, s) { var h = (x * 374761393 + y * 668265263 + (s || 0) * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function srand(seed) { var a = (seed * 4294967296) >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hex(c) { if (c.charAt(0) === 'r') return c.replace(/[^\d,]/g, '').split(',').slice(0, 3).map(Number); c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function shade(c, k) { var v = hex(c); var f = function (x) { return Math.max(0, Math.min(255, Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k)))); }; return 'rgb(' + f(v[0]) + ',' + f(v[1]) + ',' + f(v[2]) + ')'; }
  function rgba(c, a) { var v = hex(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }
  function lin(g, x0, y0, x1, y1, st) { var gr = g.createLinearGradient(x0, y0, x1, y1); st.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
  function rad(g, x, y, r0, r1, st, fx, fy) { var gr = g.createRadialGradient(fx == null ? x : fx, fy == null ? y : fy, r0, x, y, r1); st.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
  function poly(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
  function ell(g, x, y, rx, ry, fill, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } }
  function line(g, p, w, col) { g.lineWidth = w; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function outline(g, w) { g.lineWidth = w || 0.7; g.strokeStyle = 'rgba(10,6,4,.85)'; g.stroke(); }
  A.util = { shade: shade, rgba: rgba, rad: rad, lin: lin, hash: hash };

  /* ------------------------------------------------------------------ themes */
  A.THEMES = [
    { name: 'granite', floor: '#5b5850', wall: '#7c7466', mortar: '#2a2620', dark: 0.42, torch: '#ffb060' },
    { name: 'barracks', floor: '#5e4b38', wall: '#6e5c49', mortar: '#241a12', dark: 0.46, torch: '#ffa850' },
    { name: 'pits', floor: '#4c2c24', wall: '#6c382b', mortar: '#1e0c08', dark: 0.5, torch: '#ff8a40', embers: 0.25 },
    { name: 'sandstone', floor: '#6c5c40', wall: '#8b7752', mortar: '#2e2414', dark: 0.46, torch: '#ffc070' },
    { name: 'slate', floor: '#3f4757', wall: '#5c6677', mortar: '#151a24', dark: 0.5, torch: '#ffb468' },
    { name: 'crypt', floor: '#463b52', wall: '#5f4e70', mortar: '#18111f', dark: 0.56, torch: '#c890ff' },
    { name: 'ashen', floor: '#4b4a43', wall: '#5b6151', mortar: '#1a1c16', dark: 0.56, torch: '#b8ff9a', moss: 0.35 },
    { name: 'pit', floor: '#3c3127', wall: '#504437', mortar: '#140e09', dark: 0.58, torch: '#ff9c50' },
    { name: 'vault', floor: '#5a4a2d', wall: '#7c6438', mortar: '#211808', dark: 0.5, torch: '#ffd070' },
    { name: 'moss', floor: '#3b4a3b', wall: '#4f5f49', mortar: '#111a10', dark: 0.6, torch: '#ffb060', moss: 0.6 },
    { name: 'burning', floor: '#3b2b25', wall: '#5c3222', mortar: '#140805', dark: 0.56, torch: '#ff7030', embers: 0.7 },
    { name: 'obsidian', floor: '#2c2833', wall: '#423a4d', mortar: '#0b080f', dark: 0.64, torch: '#ff4a4a', embers: 0.2 }
  ];

  /* ------------------------------------------------------------------ static layer */
  var isWall = function (c) { return c === '#' || c === 'w' || c === 'D'; };
  function cellAt(rows, x, y) { return y < 0 || y >= rows.length || x < 0 || x >= rows[0].length ? '#' : rows[y][x]; }

  function floorTile(g, x, y, T, th) {
    var R = srand(hash(x, y, 3)), base = shade(th.floor, -0.18), px = x * T, py = y * T;
    // flagstones: 2x2 slabs with jittered seams, sometimes one big slab
    var big = R() < 0.25, slabs = big ? [[0, 0, 1, 1]] : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
    if (!big && R() < 0.35) slabs = R() < 0.5 ? [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] : [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
    g.fillStyle = th.mortar; g.fillRect(px, py, T, T);
    var gap = Math.max(1, T * 0.035);
    slabs.forEach(function (s) {
      var k = (R() - 0.5) * 0.12, sx = px + s[0] * T + gap, sy = py + s[1] * T + gap, sw = s[2] * T - gap * 2, sh = s[3] * T - gap * 2;
      g.fillStyle = lin(g, sx, sy, sx + sw, sy + sh, [[0, shade(base, k + 0.1)], [1, shade(base, k - 0.12)]]);
      rr(g, sx, sy, sw, sh, T * 0.04); g.fill();
      // worn top-left edge highlight, bottom-right lip shadow
      g.fillStyle = 'rgba(255,240,220,.07)'; g.fillRect(sx, sy, sw, Math.max(1, T * 0.025)); g.fillRect(sx, sy, Math.max(1, T * 0.025), sh);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(sx, sy + sh - Math.max(1, T * 0.03), sw, Math.max(1, T * 0.03));
    });
    // grit and speckle
    for (var i = 0; i < 16; i++) {
      var d = R() < 0.5; g.fillStyle = d ? 'rgba(0,0,0,' + (0.08 + R() * 0.14) + ')' : 'rgba(255,240,210,' + (0.03 + R() * 0.06) + ')';
      var s2 = T * (0.02 + R() * 0.035); g.fillRect(px + R() * T, py + R() * T, s2, s2);
    }
    if (R() < 0.18) { // crack
      var cx = px + R() * T, cy = py + R() * T; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, T * 0.02); g.beginPath(); g.moveTo(cx, cy);
      for (var c = 0; c < 4; c++) { cx += (R() - 0.5) * T * 0.35; cy += (R() - 0.3) * T * 0.3; g.lineTo(cx, cy); } g.stroke();
    }
    if (th.moss && R() < th.moss * 0.5) { for (var m = 0; m < 6; m++) ell(g, px + R() * T, py + R() * T, T * (0.03 + R() * 0.07), T * (0.02 + R() * 0.05), 'rgba(70,110,40,' + (0.25 + R() * 0.3) + ')'); }
    if (th.embers && R() < th.embers * 0.35) { // glowing fissure
      var ex = px + R() * T * 0.6 + T * 0.2, ey = py + R() * T * 0.6 + T * 0.2; g.strokeStyle = 'rgba(255,110,30,.55)'; g.lineWidth = Math.max(1, T * 0.03); g.beginPath(); g.moveTo(ex, ey);
      for (var e = 0; e < 3; e++) { ex += (R() - 0.5) * T * 0.3; ey += (R() - 0.5) * T * 0.3; g.lineTo(ex, ey); } g.stroke();
    }
  }
  function bricks(g, px, py, w, h, T, col, mortar, R, rowsN, dark) {
    g.fillStyle = mortar; g.fillRect(px, py, w, h);
    var rh = h / rowsN, m = Math.max(1, T * 0.03);
    for (var r = 0; r < rowsN; r++) {
      var off = (r % 2) * 0.5, n = 2;
      for (var b = -1; b < n + 1; b++) {
        var bx0 = px + (b + off) * w / n, bx1 = bx0 + w / n;
        var x0 = Math.max(px, bx0) + m * 0.5, x1 = Math.min(px + w, bx1) - m * 0.5;
        if (x1 - x0 < 1) continue;
        var y0 = py + r * rh + m * 0.5, k = (R() - 0.5) * 0.2 - (dark || 0);
        g.fillStyle = lin(g, 0, y0, 0, y0 + rh - m, [[0, shade(col, k + 0.12)], [1, shade(col, k - 0.15)]]);
        g.fillRect(x0, y0, x1 - x0, rh - m);
        g.fillStyle = 'rgba(255,245,225,.10)'; g.fillRect(x0, y0, x1 - x0, Math.max(1, T * 0.02));
        if (R() < 0.3) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0 + R() * (x1 - x0) * 0.7, y0 + R() * rh * 0.5, T * 0.06, T * 0.04); }
      }
    }
  }
  function wallTile(g, rows, x, y, T, th) {
    var R = srand(hash(x, y, 7)), px = x * T, py = y * T, ch = cellAt(rows, x, y);
    var below = cellAt(rows, x, y + 1), face = !isWall(below), fh = face ? Math.round(T * 0.42) : 0;
    var col = ch === 'w' ? shade(th.wall, 0.12) : th.wall;
    if (ch === 'D') { doorTile(g, rows, x, y, T, th, fh); return; }
    // top face: large dressed blocks
    bricks(g, px, py, T, T - fh, T, shade(col, 0.2), th.mortar, R, face ? 1 : 2, 0);
    g.fillStyle = 'rgba(255,240,215,.05)'; g.fillRect(px, py, T, T - fh);
    // bevels where the top meets open floor
    var bw = Math.max(1, T * 0.06);
    if (!isWall(cellAt(rows, x, y - 1))) { g.fillStyle = 'rgba(255,240,215,.28)'; g.fillRect(px, py, T, bw); }
    if (!isWall(cellAt(rows, x - 1, y))) { g.fillStyle = 'rgba(255,240,215,.18)'; g.fillRect(px, py, bw, T - fh); }
    if (!isWall(cellAt(rows, x + 1, y))) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px + T - bw, py, bw, T - fh); }
    var ow = Math.max(1, T * 0.025); g.fillStyle = 'rgba(8,4,2,.85)';
    if (!isWall(cellAt(rows, x, y - 1))) g.fillRect(px, py, T, ow);
    if (!isWall(cellAt(rows, x - 1, y))) g.fillRect(px, py, ow, T);
    if (!isWall(cellAt(rows, x + 1, y))) g.fillRect(px + T - ow, py, ow, T);
    if (face) g.fillRect(px, py + T - ow, T, ow);
    if (face) {
      // front face: smaller courses, darker, with a lip and a soot gradient
      bricks(g, px, py + T - fh, T, fh, T, shade(col, -0.25), th.mortar, R, 2, 0.05);
      g.fillStyle = lin(g, 0, py + T - fh, 0, py + T, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); g.fillRect(px, py + T - fh, T, fh);
      g.fillStyle = 'rgba(255,235,200,.22)'; g.fillRect(px, py + T - fh, T, Math.max(1, T * 0.03));
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(px, py + T - fh - Math.max(1, T * 0.025), T, Math.max(1, T * 0.025));
    }
    if (ch === 'w') { // cracked, crumbling wall
      g.strokeStyle = 'rgba(20,10,5,.7)'; g.lineWidth = Math.max(1, T * 0.035);
      for (var k = 0; k < 3; k++) { var cx = px + T * (0.2 + R() * 0.6), cy = py + T * (0.15 + R() * 0.5); g.beginPath(); g.moveTo(cx, cy); for (var j = 0; j < 3; j++) { cx += (R() - 0.5) * T * 0.4; cy += R() * T * 0.2; g.lineTo(cx, cy); } g.stroke(); }
      g.fillStyle = 'rgba(255,220,160,.08)'; g.fillRect(px, py, T, T);
    }
    if (th.moss && R() < th.moss * 0.4) for (var mm = 0; mm < 5; mm++) ell(g, px + R() * T, py + (T - fh) * R(), T * 0.06, T * 0.04, 'rgba(60,100,40,.45)');
  }
  function doorTile(g, rows, x, y, T, th, fh) {
    var px = x * T, py = y * T, R = srand(hash(x, y, 9));
    var horiz = isWall(cellAt(rows, x - 1, y)) || isWall(cellAt(rows, x + 1, y));
    var vert = !horiz;
    g.fillStyle = '#1a1008'; g.fillRect(px, py, T, T);
    // oak planks
    var n = 3, i;
    for (i = 0; i < n; i++) {
      var k = (R() - 0.5) * 0.15;
      if (vert) { g.fillStyle = lin(g, px, 0, px + T, 0, [[0, shade('#6e4422', k - 0.1)], [0.5, shade('#8a5a2e', k)], [1, shade('#5a3418', k - 0.15)]]); g.fillRect(px + 1, py + i * T / n + 1, T - 2, T / n - 2); }
      else { g.fillStyle = lin(g, 0, py, 0, py + T, [[0, shade('#8a5a2e', k + 0.05)], [1, shade('#5a3418', k - 0.15)]]); g.fillRect(px + i * T / n + 1, py + 1, T / n - 2, T - 2); }
    }
    // iron bands and rivets
    g.fillStyle = lin(g, 0, py, 0, py + T, [[0, '#9aa0a8'], [1, '#4a4e56']]);
    var bt = T * 0.1;
    if (vert) { g.fillRect(px + T * 0.18, py, bt, T); g.fillRect(px + T * 0.72, py, bt, T); }
    else { g.fillRect(px, py + T * 0.18, T, bt); g.fillRect(px, py + T * 0.68, T, bt); }
    g.fillStyle = '#d8dce2';
    for (i = 0; i < 3; i++) {
      var t = (i + 0.5) / 3;
      if (vert) { g.fillRect(px + T * 0.21, py + t * T, T * 0.04, T * 0.04); g.fillRect(px + T * 0.75, py + t * T, T * 0.04, T * 0.04); }
      else { g.fillRect(px + t * T, py + T * 0.21, T * 0.04, T * 0.04); g.fillRect(px + t * T, py + T * 0.71, T * 0.04, T * 0.04); }
    }
    // keyhole plate
    ell(g, px + T / 2, py + T / 2, T * 0.11, T * 0.11, '#c8a040'); ell(g, px + T / 2, py + T * 0.48, T * 0.03, T * 0.03, '#1a1008'); g.fillStyle = '#1a1008'; g.fillRect(px + T * 0.49, py + T * 0.5, T * 0.025, T * 0.07);
    if (fh) { g.fillStyle = lin(g, 0, py + T - fh, 0, py + T, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); g.fillRect(px, py + T - fh, T, fh); }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = Math.max(1, T * 0.03); g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
  }
  function exitTile(g, x, y, T, th) {
    var px = x * T, py = y * T;
    g.fillStyle = shade(th.mortar, -0.3); g.fillRect(px, py, T, T);
    // stairs spiralling down into the dark
    for (var i = 0; i < 5; i++) {
      var inset = T * (0.08 + i * 0.07), k = -0.05 - i * 0.16;
      g.fillStyle = lin(g, 0, py + inset, 0, py + T - inset, [[0, shade(th.floor, k + 0.12)], [1, shade(th.floor, k - 0.1)]]);
      g.fillRect(px + inset, py + inset + i * T * 0.03, T - inset * 2, T - inset * 2 - i * T * 0.03);
      g.fillStyle = 'rgba(255,230,180,.12)'; g.fillRect(px + inset, py + inset + i * T * 0.03, T - inset * 2, Math.max(1, T * 0.02));
    }
    g.fillStyle = rad(g, px + T / 2, py + T * 0.6, 0, T * 0.3, [[0, 'rgba(0,0,0,.95)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(px, py, T, T);
    g.strokeStyle = '#c8a040'; g.lineWidth = Math.max(1, T * 0.05); g.strokeRect(px + T * 0.05, py + T * 0.05, T * 0.9, T * 0.9);
    g.fillStyle = '#ffe08a'; g.font = '800 ' + Math.round(T * 0.26) + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('EXIT', px + T / 2, py + T * 0.22);
  }
  function shadowOn(g, rows, x, y, T) {
    var px = x * T, py = y * T;
    if (isWall(cellAt(rows, x, y - 1))) { g.fillStyle = lin(g, 0, py, 0, py + T * 0.38, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(px, py, T, T * 0.38); }
    if (isWall(cellAt(rows, x - 1, y))) { g.fillStyle = lin(g, px, 0, px + T * 0.3, 0, [[0, 'rgba(0,0,0,.42)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(px, py, T * 0.3, T); }
    if (isWall(cellAt(rows, x - 1, y - 1)) && !isWall(cellAt(rows, x, y - 1)) && !isWall(cellAt(rows, x - 1, y))) { g.fillStyle = rad(g, px, py, 0, T * 0.35, [[0, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(px, py, T * 0.4, T * 0.4); }
  }
  function paintTile(g, rows, x, y, T, th) {
    var c = cellAt(rows, x, y);
    if (isWall(c)) wallTile(g, rows, x, y, T, th);
    else { if (c === 'E') exitTile(g, x, y, T, th); else floorTile(g, x, y, T, th); shadowOn(g, rows, x, y, T); }
  }
  A.isWall = isWall;
  A.paintLevel = function (cv, rows, th, T) {
    cv.width = rows[0].length * T; cv.height = rows.length * T;
    var g = cv.getContext('2d');
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[0].length; x++) paintTile(g, rows, x, y, T, th);
  };
  A.repaint = function (cv, rows, th, T, x, y) {
    var g = cv.getContext('2d');
    for (var yy = y - 1; yy <= y + 1; yy++) for (var xx = x - 1; xx <= x + 1; xx++) if (yy >= 0 && xx >= 0 && yy < rows.length && xx < rows[0].length) {
      g.save(); g.beginPath(); g.rect(xx * T, yy * T, T, T); g.clip(); paintTile(g, rows, xx, yy, T, th); g.restore();
    }
  };
  A.sconce = function (g, x, y, s) { // iron bracket on a wall front face (world coords, s = tile size)
    g.fillStyle = '#2a2420'; g.fillRect(x - s * 0.05, y - s * 0.02, s * 0.1, s * 0.22);
    g.fillStyle = lin(g, x - s * 0.12, 0, x + s * 0.12, 0, [[0, '#3a332c'], [0.5, '#7a6e60'], [1, '#2a241e']]);
    poly(g, [x - s * 0.13, y - s * 0.06, x + s * 0.13, y - s * 0.06, x + s * 0.07, y + s * 0.06, x - s * 0.07, y + s * 0.06]); g.fill();
  };

  /* ------------------------------------------------------------------ sprite cache */
  var SC = 3, cache = {};
  A.setScale = function (k) { k = Math.max(1.5, Math.min(4, Math.round(k * 2) / 2)); if (k !== SC) { SC = k; cache = {}; } return SC; };
  A.scale = function () { return SC; };
  A.sprite = function (name, dir, frame, rank) {
    var key = name + '|' + (dir || 0) + '|' + (frame || 0) + '|' + (rank || 0), c = cache[key];
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = Math.ceil(40 * SC);
    var g = c.getContext('2d'); g.scale(SC, SC);
    var fn = PAINT[name];
    if (fn) {
      var d = dir || 0, mirror = d === 3 || d === 4 || d === 5; // SW, W, NW drawn as mirrored SE, E, NE
      if (mirror && fn.mirrorable !== false) { g.translate(40, 0); g.scale(-1, 1); d = { 3: 1, 4: 0, 5: 7 }[d]; }
      fn(g, d, frame || 0, rank || 0);
    }
    cache[key] = c; return c;
  };

  /* ------------------------------------------------------------------ heroes */
  var HEROES = {
    warrior: { skin: '#c98a62', main: '#8e2a1a', main2: '#4e140a', trim: '#d8a84a', metal: '#b0b4bc', hair: '#5a3416', boots: '#3a2414', cape: null, beard: '#6a3c18' },
    valkyrie: { skin: '#e2b494', main: '#2f62b8', main2: '#152c66', trim: '#e8c860', metal: '#d0d4de', hair: '#ecc85c', boots: '#3a2a20', cape: '#8a1c1c' },
    wizard: { skin: '#d8a882', main: '#b4862a', main2: '#5e4210', trim: '#f0dc8a', metal: '#c0c4cc', hair: '#e8e8ec', boots: '#3a2a18', cape: '#4a2f78', beard: '#ececf0' },
    elf: { skin: '#dcae88', main: '#3e7a2e', main2: '#1a3e14', trim: '#b8904a', metal: '#b8bcc4', hair: '#d2a64e', boots: '#4a3018', cape: '#2a5422' }
  };
  A.HEROES = HEROES;
  // dir: 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE (3,4,5 are mirrored by the cache)
  function hero(type) {
    var P = HEROES[type];
    var fn = function (g, d, f) {
      var view = d === 0 ? 'side' : (d === 1 || d === 2) ? 'front' : 'back';
      var lean = d === 1 || d === 7 ? 1.4 : 0, wSide = d === 2 ? -1 : 1;
      var ph = f / 4 * TAU, sw = Math.sin(ph) * 2.6, bob = -Math.abs(Math.sin(ph)) * 0.8;
      if (f >= 4) { sw = 0; bob = 0; } // frame 4 = attack pose
      var atk = f >= 4;
      ell(g, 20, 35.5, 10.5, 3.6, 'rgba(0,0,0,.42)');
      g.save(); g.translate(0, bob);
      if (view === 'side') sideHero(g, type, P, sw, atk);
      else if (view === 'front') frontHero(g, type, P, sw, lean, wSide, atk);
      else backHero(g, type, P, sw, lean, atk);
      g.restore();
    };
    return fn;
  }
  function legs(g, P, xl, xr, top, lenL, lenR, robe) {
    [[xl, lenL], [xr, lenR]].forEach(function (l) {
      g.fillStyle = lin(g, l[0], 0, l[0] + 4, 0, [[0, shade(P.main2, -0.2)], [0.5, shade(P.main2, 0.15)], [1, shade(P.main2, -0.3)]]);
      rr(g, l[0], top, 4, l[1], 1.4); g.fill(); outline(g, 0.5);
      g.fillStyle = lin(g, 0, top + l[1] - 3.5, 0, top + l[1], [[0, shade(P.boots, 0.25)], [1, shade(P.boots, -0.3)]]);
      rr(g, l[0] - 0.4, top + l[1] - 3.6, 4.8, 3.8, 1.3); g.fill(); outline(g, 0.5);
    });
  }
  function torso(g, type, P, x, w, top, h, back) {
    var grad = lin(g, x, top, x + w, top + h, [[0, shade(P.main, 0.28)], [0.45, P.main], [1, P.main2]]);
    g.fillStyle = grad;
    if (type === 'wizard') { poly(g, [x + 1.5, top, x + w - 1.5, top, x + w + 2.5, top + h + 7, x - 2.5, top + h + 7]); }
    else { rr(g, x, top, w, h, 3); }
    g.fill(); outline(g, 0.6);
    if (back) return;
    if (type === 'warrior') { // bare chest under a leather harness
      g.fillStyle = lin(g, x, top, x + w, top, [[0, shade(P.skin, 0.1)], [1, shade(P.skin, -0.3)]]); rr(g, x + 2.2, top + 0.5, w - 4.4, h - 5, 2.5); g.fill();
      g.strokeStyle = 'rgba(90,40,20,.45)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x + w / 2, top + 2); g.lineTo(x + w / 2, top + h - 6); g.stroke();
      line(g, [x + 1.5, top + 1, x + w - 2, top + h - 4], 1.8, '#3e2210');
      ell(g, x + w * 0.62, top + h * 0.48, 1, 1, P.trim);
    } else if (type === 'valkyrie') {
      g.fillStyle = lin(g, x, top, x + w, top + 6, [[0, '#ffffff'], [0.4, P.metal], [1, '#5a6070']]);
      rr(g, x + 1.5, top + 0.5, w - 3, 6.5, 2.5); g.fill(); outline(g, 0.4);
      g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, x + 4.2, top + 2.4, 1.4, 0.8);
      g.fill();
    } else if (type === 'wizard') {
      g.fillStyle = P.trim; poly(g, [x + w / 2 - 1.2, top, x + w / 2 + 1.2, top, x + w / 2 + 1.8, top + h + 7, x + w / 2 - 1.8, top + h + 7]); g.fill();
      for (var s = 0; s < 3; s++) { g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(x + w / 2, top + 3 + s * 4.5, 0.55, 0, TAU); g.fill(); }
    } else if (type === 'elf') {
      line(g, [x + 2, top + 1, x + w - 1.5, top + h - 2], 1.1, '#5a3a18');
    }
    // belt
    if (type !== 'wizard') {
      g.fillStyle = lin(g, 0, top + h - 3.4, 0, top + h - 1, [[0, '#6a4420'], [1, '#2e1a0a']]); g.fillRect(x + 0.4, top + h - 3.6, w - 0.8, 2.4);
      g.fillStyle = P.trim; g.fillRect(x + w / 2 - 1.3, top + h - 3.8, 2.6, 2.8);
    } else {
      g.fillStyle = '#5a3a14'; g.fillRect(x - 0.2, top + h - 3, w + 0.4, 1.6);
    }
  }
  function arm(g, P, x, y, len, ang, skin, back) {
    g.save(); g.translate(x, y); g.rotate(ang);
    var c = skin ? P.skin : P.main;
    g.fillStyle = lin(g, -2, 0, 2, 0, [[0, shade(c, back ? -0.3 : 0.15)], [1, shade(c, back ? -0.5 : -0.3)]]);
    rr(g, -1.9, -0.6, 3.8, len, 1.8); g.fill(); outline(g, 0.5);
    if (P === HEROES.warrior || P === HEROES.valkyrie) { g.fillStyle = shade(P.metal, -0.1); rr(g, -2.1, len * 0.45, 4.2, 2.2, 0.8); g.fill(); }
    ell(g, 0, len, 1.9, 1.9, shade(P.skin, back ? -0.35 : 0)); outline(g, 0.4);
    g.restore();
  }
  function weapon(g, type, P, x, y, ang, scale) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(scale || 1, scale || 1);
    if (type === 'warrior') { // two-headed battle axe
      line(g, [0, 4, 0, -15], 1.6, '#4a2c14'); line(g, [0, 4, 0, -15], 0.6, '#8a5a2e');
      g.fillStyle = lin(g, -6, -15, 6, -8, [[0, '#f4f6fa'], [0.5, '#9aa0aa'], [1, '#4a4e58']]);
      g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(7.5, -17, 7.5, -10.5); g.quadraticCurveTo(7.5, -6, 0, -9); g.quadraticCurveTo(-7.5, -6, -7.5, -10.5); g.quadraticCurveTo(-7.5, -17, 0, -14); g.fill(); outline(g, 0.5);
      ell(g, 0, -11.5, 1.1, 1.1, '#d8a84a');
    } else if (type === 'valkyrie') { // longsword
      g.fillStyle = lin(g, -1.2, 0, 1.2, 0, [[0, '#ffffff'], [0.5, '#b8c0cc'], [1, '#5a6270']]);
      poly(g, [-1.2, -2, 1.2, -2, 1, -16, 0, -18.5, -1, -16]); g.fill(); outline(g, 0.4);
      g.fillStyle = P.trim; g.fillRect(-3.2, -2.4, 6.4, 1.4); g.fillStyle = '#3a2210'; g.fillRect(-0.8, -1, 1.6, 3.6); ell(g, 0, 3, 1, 1, P.trim);
    } else if (type === 'wizard') { // gnarled staff with a glowing gem
      line(g, [0, 10, 0.6, 0, -0.5, -10, 0.4, -17], 1.5, '#5a3818'); line(g, [0, 10, 0.6, 0, -0.5, -10], 0.5, '#9a6a38');
      g.fillStyle = rad(g, 0.4, -19, 0, 5, [[0, 'rgba(255,255,255,.95)'], [0.3, 'rgba(120,220,255,.8)'], [1, 'rgba(60,120,255,0)']]); g.fillRect(-5, -24, 10, 10);
      ell(g, 0.4, -19, 1.6, 2, '#bff0ff'); outline(g, 0.4);
      line(g, [-1.6, -17, 0.4, -21.5, 2.4, -17], 0.7, '#5a3818');
    } else if (type === 'elf') { // recurve bow
      g.strokeStyle = '#6a4218'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(4.5, -6, 3, 0); g.quadraticCurveTo(4.5, 6, 0, 10); g.stroke();
      g.strokeStyle = '#c89a58'; g.lineWidth = 0.5; g.stroke();
      line(g, [0, -10, 0, 10], 0.35, 'rgba(240,240,230,.9)');
    }
    g.restore();
  }
  function shield(g, P, x, y, r, squash) {
    ell(g, x, y, r * (squash || 1), r, lin(g, x - r, y - r, x + r, y + r, [[0, shade(P.main, 0.35)], [1, P.main2]])); outline(g, 0.6);
    g.lineWidth = 1; g.strokeStyle = P.trim; ell(g, x, y, r * (squash || 1) - 0.8, r - 0.8); g.stroke();
    ell(g, x, y, 1.6 * (squash || 1), 1.6, lin(g, x - 1, y - 1, x + 1, y + 1, [[0, '#fff'], [1, P.trim]]));
  }
  function head(g, type, P, x, y, view, face) {
    var r = 5;
    if (type === 'valkyrie' && view !== 'side') { // braids
      line(g, [x - 4.2, y + 1, x - 4.8, y + 8], 1.8, shade(P.hair, -0.15)); line(g, [x + 4.2, y + 1, x + 4.8, y + 8], 1.8, shade(P.hair, -0.15));
    }
    if (type === 'elf' && view !== 'back') { // pointed ears
      g.fillStyle = shade(P.skin, -0.1); poly(g, [x - 4.5, y - 0.5, x - 8, y - 3.2, x - 4.2, y + 1.6]); g.fill(); outline(g, 0.4);
      if (view !== 'side') { poly(g, [x + 4.5, y - 0.5, x + 8, y - 3.2, x + 4.2, y + 1.6]); g.fill(); outline(g, 0.4); }
    }
    ell(g, x, y, r, r * 1.02, rad(g, x - 1.5, y - 1.5, 0.5, r + 1, [[0, shade(P.skin, 0.25)], [1, shade(P.skin, -0.3)]])); outline(g, 0.6);
    if (view === 'back') { ell(g, x, y + 0.3, r - 0.3, r - 0.2, rad(g, x - 1, y - 2, 0.5, r, [[0, shade(P.hair, 0.2)], [1, shade(P.hair, -0.35)]])); }
    else {
      var fx = x + (face || 0);
      // brow shadow and eyes: narrowed, a little grim
      g.fillStyle = 'rgba(60,25,10,.35)'; g.fillRect(fx - 3.6, y - 1.6, 7.2, 1.1);
      if (view === 'side') { g.fillStyle = '#1a0e08'; g.fillRect(fx + 1.6, y - 0.6, 1.4, 1); g.fillStyle = shade(P.skin, -0.1); poly(g, [x + 4.6, y - 0.6, x + 6.2, y + 1.4, x + 4.6, y + 1.8]); g.fill(); }
      else { g.fillStyle = '#f2ece0'; g.fillRect(fx - 2.9, y - 0.6, 2, 1.1); g.fillRect(fx + 0.9, y - 0.6, 2, 1.1); g.fillStyle = '#1a0e08'; g.fillRect(fx - 2.1, y - 0.6, 1, 1.1); g.fillRect(fx + 1.6, y - 0.6, 1, 1.1); g.fillStyle = 'rgba(90,40,20,.5)'; g.fillRect(fx - 1.2, y + 2.6, 2.4, 0.5); }
      if (P.beard && view !== 'back') {
        var bx = view === 'side' ? x + 1.5 : fx, long = type === 'wizard';
        g.fillStyle = lin(g, 0, y + 1, 0, y + (long ? 11 : 6), [[0, shade(P.beard, 0.1)], [1, shade(P.beard, -0.35)]]);
        g.beginPath(); g.moveTo(bx - 4, y + 1); g.quadraticCurveTo(bx - 3.6, y + (long ? 9 : 5.5), bx, y + (long ? 12 : 6.8)); g.quadraticCurveTo(bx + 3.6, y + (long ? 9 : 5.5), bx + 4, y + 1); g.quadraticCurveTo(bx, y + 3.4, bx - 4, y + 1); g.fill(); outline(g, 0.4);
      }
    }
    // headgear
    if (type === 'warrior') {
      g.fillStyle = lin(g, x - 5, y - 6, x + 5, y, [[0, '#eef0f4'], [0.5, P.metal], [1, '#4a4e58']]);
      g.beginPath(); g.arc(x, y - 0.4, 5.5, Math.PI, 0); g.closePath(); g.fill(); outline(g, 0.5);
      g.fillStyle = '#5a5e68'; g.fillRect(x - 5.6, y - 1, 11.2, 1.5);
      if (view !== 'back') { g.fillStyle = '#7a7e88'; g.fillRect(x - 0.6 + (face || 0), y - 1, 1.2, 3.6); }
      // horns
      g.fillStyle = lin(g, 0, y - 10, 0, y - 2, [[0, '#fff8e8'], [1, '#a89474']]);
      var hs = view === 'side' ? [[-1, 0.7]] : [[-1, 1], [1, 1]];
      hs.forEach(function (h) { g.beginPath(); g.moveTo(x + h[0] * 3.6, y - 3.4); g.quadraticCurveTo(x + h[0] * 9 * h[1], y - 5, x + h[0] * 8.5 * h[1], y - 11); g.quadraticCurveTo(x + h[0] * 7 * h[1], y - 6, x + h[0] * 2.2, y - 5.2); g.closePath(); g.fill(); outline(g, 0.4); });
    } else if (type === 'valkyrie') {
      g.fillStyle = lin(g, x - 5, y - 6, x + 5, y, [[0, '#ffffff'], [0.5, P.metal], [1, '#585e6c']]);
      g.beginPath(); g.arc(x, y - 0.3, 5.4, Math.PI, 0); g.closePath(); g.fill(); outline(g, 0.5);
      g.fillStyle = P.trim; g.fillRect(x - 5.4, y - 1.2, 10.8, 1.3);
      var ws = view === 'side' ? [-1] : [-1, 1];
      ws.forEach(function (s) { // feathered wings
        g.fillStyle = lin(g, 0, y - 9, 0, y - 2, [[0, '#ffffff'], [1, '#b8c0d0']]);
        g.beginPath(); g.moveTo(x + s * 4.4, y - 2.5); g.quadraticCurveTo(x + s * 10, y - 6, x + s * 9.5, y - 11.5); g.lineTo(x + s * 8, y - 8.5); g.lineTo(x + s * 7.8, y - 10); g.lineTo(x + s * 6.4, y - 6.8); g.quadraticCurveTo(x + s * 5, y - 5, x + s * 3.6, y - 4.6); g.closePath(); g.fill(); outline(g, 0.4);
      });
    } else if (type === 'wizard') {
      ell(g, x, y - 3.6, 8, 2.6, lin(g, x - 8, 0, x + 8, 0, [[0, shade(P.main, 0.2)], [1, P.main2]])); outline(g, 0.5);
      g.fillStyle = lin(g, x - 5, 0, x + 5, 0, [[0, shade(P.main, 0.3)], [0.5, P.main], [1, P.main2]]);
      g.beginPath(); g.moveTo(x - 4.8, y - 4); g.quadraticCurveTo(x - 1.5, y - 10, x + 1.5, y - 15); g.quadraticCurveTo(x + 4.5, y - 15.5, x + 5.5, y - 13.5); g.quadraticCurveTo(x + 2.6, y - 13, x + 4.8, y - 4); g.closePath(); g.fill(); outline(g, 0.5);
      g.fillStyle = P.trim; g.fillRect(x - 4.8, y - 5.4, 9.6, 1.3);
      ell(g, x + 0.6, y - 9, 0.8, 0.8, '#fff6c0');
    } else if (type === 'elf') {
      g.fillStyle = lin(g, x - 5, y - 6, x + 5, y, [[0, shade(P.cape, 0.3)], [1, shade(P.cape, -0.3)]]);
      g.beginPath(); g.moveTo(x - 5.4, y - 0.2); g.quadraticCurveTo(x - 5, y - 6.5, x, y - 6); g.quadraticCurveTo(x + 6, y - 6, x + 8.5, y - 9.5); g.quadraticCurveTo(x + 6.5, y - 4, x + 5.4, y - 0.2); g.quadraticCurveTo(x, y - 3, x - 5.4, y - 0.2); g.fill(); outline(g, 0.5);
      line(g, [x + 3, y - 5.5, x + 6.5, y - 12, x + 8, y - 13.5], 1.1, '#c8342a'); line(g, [x + 3.4, y - 6.4, x + 6.6, y - 12], 0.4, '#ffb0a0');
      if (view !== 'back') { g.fillStyle = P.hair; g.fillRect(x - 4.2, y - 2.6, 8.4, 1.4); }
    }
  }
  function cape(g, P, top, spread, back) {
    if (!P.cape) return;
    g.fillStyle = lin(g, 0, top, 0, top + 20, [[0, shade(P.cape, back ? 0.15 : -0.1)], [1, shade(P.cape, -0.45)]]);
    g.beginPath(); g.moveTo(20 - 6.5, top); g.lineTo(20 + 6.5, top); g.quadraticCurveTo(20 + 9 + spread, top + 10, 20 + 8 + spread, top + 19);
    g.lineTo(20 + 4, top + 18); g.lineTo(20, top + 19.5); g.lineTo(20 - 4, top + 18); g.lineTo(20 - 8 - spread, top + 19); g.quadraticCurveTo(20 - 9 - spread, top + 10, 20 - 6.5, top); g.closePath(); g.fill(); outline(g, 0.5);
    if (back) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(17, top + 3); g.lineTo(15.5, top + 18); g.moveTo(23, top + 3); g.lineTo(24.5, top + 18); g.stroke(); }
  }
  function frontHero(g, type, P, sw, lean, wSide, atk) {
    var cx = 20 + lean * 0.5, top = 15.5;
    if (P.cape) cape(g, P, top, 1, false);
    if (type === 'elf') { line(g, [cx + 6, top - 1, cx + 8, top + 10], 2.4, '#5a3818'); }
    if (type !== 'wizard') legs(g, P, cx - 5.2, cx + 1.2, top + 10, 9.5 - Math.max(0, sw) * 0.7, 9.5 - Math.max(0, -sw) * 0.7);
    else { g.fillStyle = P.boots; ell(g, cx - 3, 34, 2.4, 1.4, P.boots); ell(g, cx + 3, 34, 2.4, 1.4, P.boots); }
    var armSwing = sw * 0.06;
    // off arm
    var offX = cx - wSide * 7.3, onX = cx + wSide * 7.3;
    if (type === 'valkyrie') { arm(g, P, offX, top + 1.5, 7, -wSide * 0.1, true); shield(g, P, offX - wSide * 0.5, top + 7, 5.4, 0.95); }
    else arm(g, P, offX, top + 1.5, 8, -wSide * 0.15 + armSwing, type === 'warrior');
    torso(g, type, P, cx - 6.2, 12.4, top, 11.5);
    head(g, type, P, cx, top - 4.6, 'front', lean);
    // weapon arm
    if (atk) { weapon(g, type, P, onX + wSide * 1.5, top + 1, wSide * 1.25, 1); arm(g, P, onX, top + 1.5, 8, -wSide * 1.6, type === 'warrior'); }
    else { weapon(g, type, P, onX + wSide * 0.4, top + 9.5, wSide * 0.12, 1); arm(g, P, onX, top + 1.5, 8, -wSide * 0.1 - armSwing, type === 'warrior'); }
  }
  function backHero(g, type, P, sw, lean, atk) {
    var cx = 20 + lean * 0.5, top = 15.5;
    if (type !== 'wizard') legs(g, P, cx - 5.2, cx + 1.2, top + 10, 9.5 - Math.max(0, -sw) * 0.7, 9.5 - Math.max(0, sw) * 0.7);
    else { ell(g, cx - 3, 34, 2.4, 1.4, P.boots); ell(g, cx + 3, 34, 2.4, 1.4, P.boots); }
    // weapon shows over the shoulder on the right
    if (atk) weapon(g, type, P, cx + 8.5, top + 2, 0.5, 1); else weapon(g, type, P, cx + 8.2, top + 7, 0.25, 1);
    arm(g, P, cx - 7.3, top + 1.5, 8, 0.12 + sw * 0.05, type === 'warrior', true);
    arm(g, P, cx + 7.3, top + 1.5, 8, atk ? -2.4 : -0.12 - sw * 0.05, type === 'warrior', true);
    torso(g, type, P, cx - 6.2, 12.4, top, 11.5, true);
    if (type === 'elf') { g.save(); g.translate(cx + 2, top + 5); g.rotate(0.45); g.fillStyle = lin(g, -2, 0, 2, 0, [[0, '#7a4a20'], [1, '#3a2010']]); rr(g, -2, -7, 4, 13, 1.2); g.fill(); outline(g, 0.4); for (var i = 0; i < 3; i++) line(g, [-1 + i, -7, -1.2 + i, -10], 0.8, '#e8e0d0'); g.restore(); }
    if (P.cape) cape(g, P, top, 0.5, true);
    if (type === 'valkyrie') shield(g, P, cx - 6, top + 7, 5, 0.55);
    head(g, type, P, cx, top - 4.6, 'back', 0);
  }
  function sideHero(g, type, P, sw, atk) {
    var cx = 19, top = 15.5;
    // trailing cape
    if (P.cape) { g.fillStyle = lin(g, 0, top, 0, top + 18, [[0, shade(P.cape, -0.05)], [1, shade(P.cape, -0.5)]]); g.beginPath(); g.moveTo(cx - 2, top); g.quadraticCurveTo(cx - 9 - Math.abs(sw), top + 9, cx - 8 - Math.abs(sw) * 1.2, top + 18); g.lineTo(cx + 1, top + 17); g.closePath(); g.fill(); outline(g, 0.5); }
    // far leg / near leg
    if (type !== 'wizard') {
      [[-sw, -0.25], [sw, 0.05]].forEach(function (l) {
        g.save(); g.translate(cx, top + 10); g.rotate(l[0] * 0.12);
        g.fillStyle = shade(P.main2, l[1]); rr(g, -2, 0, 4, 9.5, 1.4); g.fill(); outline(g, 0.5);
        g.fillStyle = shade(P.boots, l[1]); rr(g, -2.2, 6.2, 6, 3.6, 1.4); g.fill(); outline(g, 0.5);
        g.restore();
      });
    } else { ell(g, cx - 1 - sw * 0.4, 34, 2.6, 1.3, P.boots); ell(g, cx + 2 + sw * 0.4, 34, 2.6, 1.3, P.boots); }
    if (type === 'elf') line(g, [cx - 4, top, cx - 6, top + 10], 2.4, '#5a3818');
    // back arm
    arm(g, P, cx - 1, top + 1.5, 8, 0.25 * sw / 2.6, type === 'warrior', true);
    if (type === 'wizard') torso(g, type, P, cx - 4.4, 9, top, 11.5); else torso(g, type, P, cx - 4.6, 9.4, top, 11.5);
    if (type === 'valkyrie') { shield(g, P, cx - 1.2, top + 6.5, 5.6, 0.45); }
    head(g, type, P, cx + 0.5, top - 4.6, 'side', 1.2);
    // weapon forward
    if (atk) { weapon(g, type, P, cx + 7.5, top + 4, 1.45, 1); arm(g, P, cx + 1, top + 1.5, 8, -1.5, type === 'warrior'); }
    else { weapon(g, type, P, cx + 2.8 + sw * 0.4, top + 9.5, 0.35, 1); arm(g, P, cx + 1, top + 1.5, 8, -0.25 * sw / 2.6, type === 'warrior'); }
  }

  /* ------------------------------------------------------------------ monsters (rank 1 pale, rank 3 deep) */
  function rankK(rank) { return rank === 1 ? 0.28 : rank === 2 ? 0.1 : -0.08; }
  function eyes(g, x, y, sp, col, r) {
    [-1, 1].forEach(function (s) {
      g.fillStyle = rad(g, x + s * sp, y, 0, (r || 1.2) * 3, [[0, col], [1, 'rgba(0,0,0,0)']]); g.fillRect(x + s * sp - 4, y - 4, 8, 8);
      ell(g, x + s * sp, y, r || 1.1, (r || 1.1) * 0.75, '#fff6d0');
    });
  }
  function ghost(g, d, f, rank) {
    var wav = f % 2 ? 1 : -1;
    g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, 20, 35, 8, 2.6); g.fill();
    g.fillStyle = rad(g, 20, 18, 2, 16, [[0, 'rgba(180,190,255,.22)'], [1, 'rgba(120,130,200,0)']]); g.fillRect(0, 0, 40, 40);
    var tone = rank === 1 ? '214,218,236' : rank === 2 ? '176,182,214' : '140,146,196';
    g.fillStyle = lin(g, 0, 6, 0, 34, [[0, 'rgba(' + tone + ',.95)'], [0.65, 'rgba(96,100,140,.78)'], [1, 'rgba(40,40,70,0)']]);
    g.beginPath(); g.moveTo(10, 30); g.quadraticCurveTo(8, 6, 20, 5); g.quadraticCurveTo(32, 6, 30, 30);
    for (var i = 0; i < 5; i++) { var tx = 30 - (i + 1) * 4; g.lineTo(tx + 2, 34 + ((i + (f % 2)) % 2 ? 2 : -1.5)); g.lineTo(tx, 30.5); }
    g.closePath(); g.fill();
    // arms reaching forward with claws
    g.strokeStyle = rgba('#b8bcd8', 0.85); g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(12, 17); g.quadraticCurveTo(7, 21 + wav, 5, 25 + wav); g.moveTo(28, 17); g.quadraticCurveTo(33, 21 - wav, 35, 25 - wav); g.stroke();
    line(g, [5, 25 + wav, 3.6, 27.5 + wav, 5, 25 + wav, 5.6, 28 + wav], 0.7, '#e8e8f8'); line(g, [35, 25 - wav, 36.4, 27.5 - wav, 35, 25 - wav, 34.4, 28 - wav], 0.7, '#e8e8f8');
    // hollow hooded face
    ell(g, 20, 14.5, 6.2, 6.8, rad(g, 20, 15, 0.5, 7, [[0, '#05040a'], [0.75, '#1a1a2c'], [1, 'rgba(40,40,70,.0)']]));
    eyes(g, 20, 13.6, 2.6, 'rgba(255,60,30,.9)', 1);
    g.fillStyle = 'rgba(0,0,0,.8)'; poly(g, [17.5, 18, 22.5, 18, 21.5, 20.5, 18.5, 20.5]); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(12, 24); g.quadraticCurveTo(11, 12, 18, 6.5); g.stroke();
  }
  function grunt(g, d, f, rank) {
    var k = rankK(rank), skin = shade('#7a8640', k), up = f % 2;
    ell(g, 20, 35.5, 10, 3.2, 'rgba(0,0,0,.4)');
    // stubby legs
    [[13.5, up], [22.5, 1 - up]].forEach(function (l) { g.fillStyle = shade('#4a3418', k); rr(g, l[0], 26 + l[1], 4.5, 8 - l[1], 1.5); g.fill(); outline(g, 0.5); g.fillStyle = '#2a1a0c'; rr(g, l[0] - 0.5, 31.5, 5.5, 3, 1.2); g.fill(); });
    // hulking body
    ell(g, 20, 22, 10.5, 9, rad(g, 17, 18, 1, 13, [[0, shade(skin, 0.3)], [0.6, skin], [1, shade(skin, -0.45)]])); outline(g, 0.7);
    g.fillStyle = lin(g, 0, 23, 0, 30, [[0, '#6a4420'], [1, '#3a2210']]); poly(g, [11, 24, 29, 24, 27, 30, 13, 30]); g.fill(); outline(g, 0.5);
    g.fillStyle = '#8a8e98'; g.fillRect(18.6, 24, 2.8, 2.6);
    // left arm and fist
    ell(g, 9.5, 22 + up, 3, 4.5, shade(skin, -0.15)); outline(g, 0.5);
    // head with iron cap and tusks
    ell(g, 20, 12, 5.8, 5.3, rad(g, 18.5, 10.5, 0.5, 7, [[0, shade(skin, 0.25)], [1, shade(skin, -0.35)]])); outline(g, 0.6);
    g.fillStyle = lin(g, 0, 5, 0, 11, [[0, '#c8ccd4'], [1, '#4a4e58']]); g.beginPath(); g.arc(20, 10.6, 6, Math.PI, 0); g.closePath(); g.fill(); outline(g, 0.5);
    poly(g, [19, 5, 20, 1.8, 21, 5]); g.fillStyle = '#d8dce4'; g.fill();
    eyes(g, 20, 12, 2.4, 'rgba(255,170,40,.8)', 0.9);
    g.fillStyle = '#f4ecd8'; poly(g, [16.4, 14.6, 17.6, 14.6, 17, 12.4]); g.fill(); poly(g, [22.4, 14.6, 23.6, 14.6, 23, 12.4]); g.fill();
    // spiked club, raised then swung
    g.save(); g.translate(30.5, 22 - up); g.rotate(up ? -0.25 : 0.55);
    line(g, [0, 4, 0, -10], 2.4, '#5a3a18'); ell(g, 0, -12, 3.4, 4.4, lin(g, -3, -16, 3, -8, [[0, '#8a5a2e'], [1, '#4a2c12']])); outline(g, 0.5);
    g.fillStyle = '#d8dce4'; [[-3.2, -13], [3.2, -12], [0, -16.4], [-2.4, -9], [2.6, -9.4]].forEach(function (s) { g.fillRect(s[0] - 0.6, s[1] - 0.6, 1.2, 1.2); });
    g.restore();
    ell(g, 30.5, 23 - up, 2.6, 2.6, shade(skin, 0.05)); outline(g, 0.5);
  }
  function demon(g, d, f, rank) {
    var k = rankK(rank), skin = shade('#a8261a', k), flap = f % 2;
    ell(g, 20, 35.5, 9, 3, 'rgba(0,0,0,.4)');
    // bat wings
    [-1, 1].forEach(function (s) {
      g.fillStyle = lin(g, 20, 8, 20 + s * 18, 18, [[0, shade('#5a0e0a', k)], [1, shade('#2a0404', k)]]);
      g.beginPath(); g.moveTo(20 + s * 4, 15); g.lineTo(20 + s * (15 + flap * 2), 5 + flap * 4); g.lineTo(20 + s * 19, 17 + flap * 2);
      g.lineTo(20 + s * 15, 15.5 + flap * 2); g.lineTo(20 + s * 13, 21); g.lineTo(20 + s * 10, 18.5); g.lineTo(20 + s * 6, 22); g.closePath(); g.fill(); outline(g, 0.5);
      line(g, [20 + s * 4, 15, 20 + s * (15 + flap * 2), 5 + flap * 4], 0.7, shade(skin, 0.1));
    });
    // tail
    g.strokeStyle = shade(skin, -0.3); g.lineWidth = 1.4; g.beginPath(); g.moveTo(22, 29); g.quadraticCurveTo(31, 33, 32, 27 + flap); g.stroke();
    g.fillStyle = shade(skin, -0.3); poly(g, [32, 25 + flap, 34, 28 + flap, 30.6, 27.6 + flap]); g.fill();
    // legs, body
    [[15, flap], [21, 1 - flap]].forEach(function (l) { g.fillStyle = shade(skin, -0.3); rr(g, l[0], 26 + l[1], 4, 7.5 - l[1], 1.5); g.fill(); outline(g, 0.5); g.fillStyle = '#1a0606'; poly(g, [l[0] - 0.5, 33.5, l[0] + 4.5, 33.5, l[0] + 2, 31]); g.fill(); });
    g.fillStyle = rad(g, 18, 18, 1, 10, [[0, shade(skin, 0.35)], [0.6, skin], [1, shade(skin, -0.45)]]);
    g.beginPath(); g.moveTo(12, 16); g.quadraticCurveTo(20, 12, 28, 16); g.quadraticCurveTo(28, 26, 24, 28.5); g.lineTo(16, 28.5); g.quadraticCurveTo(12, 26, 12, 16); g.fill(); outline(g, 0.6);
    g.strokeStyle = 'rgba(40,0,0,.45)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(20, 17); g.lineTo(20, 26); g.moveTo(16, 21); g.lineTo(24, 21); g.stroke();
    ell(g, 11, 20 + flap, 2.4, 4, shade(skin, -0.1)); outline(g, 0.5); ell(g, 29, 20 - flap, 2.4, 4, shade(skin, -0.1)); outline(g, 0.5);
    // head, horns, burning eyes, fanged maw
    ell(g, 20, 11, 5.4, 5, rad(g, 18.5, 9.5, 0.5, 7, [[0, shade(skin, 0.3)], [1, shade(skin, -0.4)]])); outline(g, 0.6);
    [-1, 1].forEach(function (s) { g.fillStyle = lin(g, 0, 2, 0, 8, [[0, '#f0e6d0'], [1, '#6a5a40']]); g.beginPath(); g.moveTo(20 + s * 2.4, 7); g.quadraticCurveTo(20 + s * 7, 5, 20 + s * 6.2, 0.6); g.quadraticCurveTo(20 + s * 5, 4, 20 + s * 4.6, 8.6); g.closePath(); g.fill(); outline(g, 0.4); });
    eyes(g, 20, 10.6, 2.3, 'rgba(255,230,60,.9)', 1);
    g.fillStyle = '#1a0202'; poly(g, [16.5, 13.4, 23.5, 13.4, 22, 15.6, 18, 15.6]); g.fill();
    g.fillStyle = '#fff4dc'; poly(g, [17.4, 13.4, 18.4, 13.4, 17.9, 15]); g.fill(); poly(g, [21.6, 13.4, 22.6, 13.4, 22.1, 15]); g.fill();
  }
  function lobber(g, d, f, rank) {
    var k = rankK(rank), skin = shade('#7a8a9a', k), up = f % 2;
    g.save(); g.translate(20, 22); g.scale(0.88, 0.88); g.translate(-20, -22);
    ell(g, 20, 35.5, 8.5, 3, 'rgba(0,0,0,.4)');
    [[15, up], [21, 1 - up]].forEach(function (l) { g.fillStyle = shade(skin, -0.35); rr(g, l[0], 27 + l[1], 3.8, 7 - l[1], 1.5); g.fill(); outline(g, 0.5); });
    // sack of rocks on the back
    ell(g, 27, 21, 5, 6, lin(g, 22, 15, 32, 27, [[0, '#a08458'], [1, '#4a3820']])); outline(g, 0.5);
    line(g, [24.5, 16, 29, 16.5], 0.8, '#3a2a14');
    // hunched body, rags
    ell(g, 19, 22, 7.5, 7.5, rad(g, 17, 19, 1, 9, [[0, shade(skin, 0.25)], [1, shade(skin, -0.4)]])); outline(g, 0.6);
    g.fillStyle = lin(g, 0, 22, 0, 30, [[0, '#5a4a32'], [1, '#2a2014']]); poly(g, [12.5, 23, 26, 23, 25, 29.5, 22, 28, 19, 30, 16, 28, 13, 29.5]); g.fill(); outline(g, 0.4);
    // big ears, beady eyes, long nose
    ell(g, 19, 12.5, 5, 4.6, rad(g, 18, 11, 0.5, 6, [[0, shade(skin, 0.3)], [1, shade(skin, -0.35)]])); outline(g, 0.5);
    [-1, 1].forEach(function (s) { g.fillStyle = shade(skin, -0.05); poly(g, [19 + s * 4, 11, 19 + s * 10, 8, 19 + s * 4.4, 14]); g.fill(); outline(g, 0.4); });
    eyes(g, 19, 11.8, 2, 'rgba(255,220,80,.75)', 0.8);
    g.fillStyle = shade(skin, -0.15); poly(g, [18, 13, 20, 13, 19.4, 16.6]); g.fill();
    // rock held overhead on the throw frame
    if (up) { ell(g, 13, 21, 2, 3.6, shade(skin, -0.1)); ell(g, 13, 4.5, 3.4, 3, lin(g, 10, 2, 16, 8, [[0, '#b0aaa0'], [1, '#4a4640']])); outline(g, 0.5); line(g, [13, 18, 13, 7.5], 2.2, shade(skin, -0.1)); }
    else { ell(g, 11.5, 22, 2, 4, shade(skin, -0.1)); outline(g, 0.4); }
    g.restore();
  }
  function sorcerer(g, d, f, rank) {
    var k = rankK(rank), robe = shade('#5a2a7a', k), up = f % 2;
    ell(g, 20, 35.5, 9, 3, 'rgba(0,0,0,.4)');
    g.fillStyle = lin(g, 12, 10, 28, 34, [[0, shade(robe, 0.3)], [0.55, robe], [1, shade(robe, -0.5)]]);
    g.beginPath(); g.moveTo(15, 12); g.lineTo(25, 12); g.quadraticCurveTo(28, 24, 30, 34); g.lineTo(26, 33); g.lineTo(22, 34.5); g.lineTo(18, 33); g.lineTo(14, 34.5); g.lineTo(10, 34); g.quadraticCurveTo(12, 24, 15, 12); g.fill(); outline(g, 0.6);
    g.strokeStyle = '#c8a040'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(20, 16); g.lineTo(20, 33.5); g.stroke();
    // sleeves raised, green witch-fire between the hands
    [-1, 1].forEach(function (s) { g.save(); g.translate(20 + s * 5, 15); g.rotate(s * (up ? -2.3 : -0.6)); g.fillStyle = shade(robe, -0.1); poly(g, [-2.4, 0, 2.4, 0, 3.4, 9, -3.4, 9]); g.fill(); outline(g, 0.5); ell(g, 0, 9.6, 1.6, 1.6, '#c8b0a0'); g.restore(); });
    var oy = up ? 4 : 23, ox = up ? 20 : 20;
    g.fillStyle = rad(g, ox, oy, 0, 7, [[0, 'rgba(230,255,200,.95)'], [0.3, 'rgba(120,255,120,.6)'], [1, 'rgba(40,200,60,0)']]); g.fillRect(ox - 7, oy - 7, 14, 14);
    // deep hood with two eyes
    g.fillStyle = lin(g, 14, 4, 26, 16, [[0, shade(robe, 0.25)], [1, shade(robe, -0.4)]]);
    g.beginPath(); g.moveTo(13.5, 15); g.quadraticCurveTo(13, 4, 20, 3); g.quadraticCurveTo(27, 4, 26.5, 15); g.quadraticCurveTo(20, 17, 13.5, 15); g.fill(); outline(g, 0.6);
    ell(g, 20, 11, 4, 4.4, '#0a040e');
    eyes(g, 20, 10.6, 1.8, 'rgba(160,255,140,.9)', 0.8);
  }
  function death(g, d, f) {
    var sway = f % 2 ? 0.8 : -0.8;
    g.fillStyle = rad(g, 20, 20, 2, 19, [[0, 'rgba(120,40,160,.35)'], [1, 'rgba(60,0,90,0)']]); g.fillRect(0, 0, 40, 40);
    ell(g, 20, 36, 9, 2.8, 'rgba(0,0,0,.5)');
    // scythe behind
    line(g, [31, 36, 30 + sway, 3], 1.4, '#3a2a1c');
    g.fillStyle = lin(g, 14, 0, 31, 8, [[0, '#f0f2f8'], [1, '#6a6e7a']]);
    g.beginPath(); g.moveTo(30 + sway, 3); g.quadraticCurveTo(20, -1, 11, 7); g.quadraticCurveTo(20, 2.5, 30 + sway, 6.5); g.closePath(); g.fill(); outline(g, 0.5);
    // tall tattered robe
    g.fillStyle = lin(g, 10, 6, 30, 36, [[0, '#3a3046'], [0.5, '#1a1422'], [1, '#08060c']]);
    g.beginPath(); g.moveTo(14, 12); g.quadraticCurveTo(13, 4, 20, 3.5); g.quadraticCurveTo(27, 4, 26, 12); g.quadraticCurveTo(29, 24, 30, 35);
    for (var i = 0; i < 5; i++) g.lineTo(30 - (i + 0.5) * 4, i % 2 ? 35.8 : 33);
    g.lineTo(10, 35); g.quadraticCurveTo(11, 24, 14, 12); g.fill(); outline(g, 0.6);
    // bony hands on the shaft
    ell(g, 29.5, 18, 1.6, 1.4, '#e8e2d2'); ell(g, 29.8, 24, 1.6, 1.4, '#e8e2d2');
    g.strokeStyle = '#2a2232'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(24, 15); g.quadraticCurveTo(28, 16, 29.5, 18); g.moveTo(24, 21); g.quadraticCurveTo(28, 23, 29.8, 24); g.stroke();
    // skull in the hood
    ell(g, 20, 11, 4.6, 5.2, '#050308');
    ell(g, 20, 11, 3.4, 3.8, rad(g, 19, 10, 0.4, 4.4, [[0, '#fbf6ea'], [1, '#a89c86']]));
    ell(g, 18.6, 10.6, 1.05, 1.2, '#0a0408'); ell(g, 21.4, 10.6, 1.05, 1.2, '#0a0408');
    g.fillStyle = 'rgba(255,40,60,.9)'; g.fillRect(18.3, 10.4, 0.6, 0.6); g.fillRect(21.1, 10.4, 0.6, 0.6);
    g.fillStyle = '#0a0408'; poly(g, [19.4, 12.2, 20.6, 12.2, 20, 13.2]); g.fill();
    g.strokeStyle = '#3a3026'; g.lineWidth = 0.4; g.beginPath(); for (var t = 0; t < 4; t++) { g.moveTo(18.5 + t, 13.6); g.lineTo(18.5 + t, 14.6); } g.stroke();
  }

  /* ------------------------------------------------------------------ generators */
  function bones(g, d, f, rank) {
    var R = srand(0.37 + rank * 0.1), n = 3 + rank * 2;
    ell(g, 20, 30, 15, 6, 'rgba(0,0,0,.45)');
    ell(g, 20, 27, 13 + rank, 6 + rank * 0.8, rad(g, 20, 27, 2, 14, [[0, '#4a4034'], [1, 'rgba(40,30,20,0)']]));
    for (var i = 0; i < n; i++) {
      var x = 9 + R() * 22, y = 20 + R() * 12, a = R() * TAU;
      g.save(); g.translate(x, y); g.rotate(a); line(g, [-4.5, 0, 4.5, 0], 1.6, '#d8ceb4'); ell(g, -4.8, -0.8, 1.1, 1.1, '#e8e0cc'); ell(g, -4.8, 0.8, 1.1, 1.1, '#e8e0cc'); ell(g, 4.8, -0.8, 1.1, 1.1, '#e8e0cc'); ell(g, 4.8, 0.8, 1.1, 1.1, '#e8e0cc'); g.restore();
    }
    var skulls = [[20, 18 - rank * 1.5], [13, 25], [27, 26]].slice(0, rank);
    skulls.forEach(function (s, j) {
      ell(g, s[0], s[1], 4.2, 3.8, rad(g, s[0] - 1, s[1] - 1, 0.4, 5, [[0, '#fbf4e2'], [1, '#9a8e76']])); outline(g, 0.5);
      g.fillStyle = '#e8e0cc'; g.fillRect(s[0] - 2.4, s[1] + 2.2, 4.8, 2.2);
      ell(g, s[0] - 1.6, s[1] + 0.2, 1.1, 1.2, '#140c08'); ell(g, s[0] + 1.6, s[1] + 0.2, 1.1, 1.2, '#140c08');
      if (f % 2 === j % 2) { g.fillStyle = 'rgba(255,60,40,.85)'; g.fillRect(s[0] - 2, s[1], 0.8, 0.7); g.fillRect(s[0] + 1.2, s[1], 0.8, 0.7); }
    });
    // wisps rising
    g.fillStyle = rad(g, 20, 14, 0, 12, [[0, 'rgba(170,180,255,' + (0.15 + 0.1 * (f % 2)) + ')'], [1, 'rgba(120,130,220,0)']]); g.fillRect(6, 0, 28, 28);
  }
  function den(glow, rune) {
    return function (g, d, f, rank) {
      var s = 0.78 + rank * 0.08;
      g.save(); g.translate(20, 22); g.scale(s, s); g.translate(-20, -22);
      ell(g, 20, 34, 16, 4, 'rgba(0,0,0,.5)');
      // stone block with a darker front face
      g.fillStyle = lin(g, 0, 6, 0, 24, [[0, '#9a9286'], [1, '#625a50']]); rr(g, 5, 6, 30, 19, 2); g.fill(); outline(g, 0.6);
      g.fillStyle = lin(g, 0, 24, 0, 34, [[0, '#4e463e'], [1, '#2a241e']]); rr(g, 5, 23, 30, 11, 1.5); g.fill(); outline(g, 0.6);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(5, 15.5); g.lineTo(35, 15.5); g.moveTo(15, 6); g.lineTo(15, 15.5); g.moveTo(26, 15.5); g.lineTo(26, 24); g.stroke();
      // glowing grate on the face
      var pulse = f % 2 ? 1 : 0.7;
      g.fillStyle = rad(g, 20, 29, 0, 10, [[0, rgba(glow, 0.95 * pulse)], [1, rgba(glow, 0)]]); g.fillRect(8, 20, 24, 16);
      g.fillStyle = '#120a06'; rr(g, 12, 25.5, 16, 6.5, 1); g.fill();
      g.fillStyle = rgba(glow, 0.9 * pulse); for (var i = 0; i < 4; i++) g.fillRect(13.2 + i * 3.8, 26.5, 2.2, 4.5);
      // carved rune on top
      g.strokeStyle = rgba(glow, 0.75); g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); rune(g); g.stroke();
      // rank studs
      for (var r = 0; r < rank; r++) ell(g, 9 + r * 4, 9.5, 1.2, 1.2, '#d8c890');
      g.restore();
    };
  }

  /* ------------------------------------------------------------------ items and shots */
  function food(g) {
    ell(g, 20, 27, 11, 5, 'rgba(0,0,0,.4)');
    ell(g, 20, 25, 11, 5.4, lin(g, 9, 20, 31, 30, [[0, '#f4f0e6'], [1, '#8a8478']])); outline(g, 0.5);
    ell(g, 20, 24.6, 8, 3.6, '#c8c2b4');
    // roast with a bone
    g.fillStyle = rad(g, 18, 19, 1, 9, [[0, '#e0904a'], [0.6, '#9a4a1a'], [1, '#4a1e08']]);
    g.beginPath(); g.ellipse(18, 21, 7.5, 5.2, -0.3, 0, TAU); g.fill(); outline(g, 0.5);
    line(g, [23, 19, 28.5, 15], 2.2, '#f0e8d4'); ell(g, 29, 14.2, 1.6, 1.6, '#fbf4e4'); ell(g, 28, 13.2, 1.4, 1.4, '#fbf4e4');
    g.fillStyle = 'rgba(255,240,200,.5)'; g.beginPath(); g.ellipse(15.5, 18.6, 2.6, 1.2, -0.4, 0, TAU); g.fill();
  }
  function jug(g) {
    ell(g, 20, 33, 8, 3, 'rgba(0,0,0,.4)');
    g.strokeStyle = '#6a3a16'; g.lineWidth = 2; g.beginPath(); g.arc(27, 19, 4, -1.3, 1.3); g.stroke();
    g.fillStyle = rad(g, 17, 19, 1, 12, [[0, '#e2a868'], [0.6, '#a2602a'], [1, '#4a2208']]);
    g.beginPath(); g.moveTo(16, 9); g.lineTo(24, 9); g.lineTo(24, 12); g.quadraticCurveTo(30, 16, 28.5, 25); g.quadraticCurveTo(27, 33, 20, 33); g.quadraticCurveTo(13, 33, 11.5, 25); g.quadraticCurveTo(10, 16, 16, 12); g.closePath(); g.fill(); outline(g, 0.6);
    g.fillStyle = '#d8c8a0'; rr(g, 14, 20, 12, 6, 1); g.fill(); g.fillStyle = '#5a2a10'; g.font = '700 4.4px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('CIDER', 20, 24.6);
    g.fillStyle = '#7a5a3a'; rr(g, 16.5, 6.5, 7, 3.4, 1); g.fill();
  }
  function poison(g) {
    ell(g, 20, 33, 7, 2.6, 'rgba(0,0,0,.4)');
    g.fillStyle = rad(g, 18, 22, 1, 10, [[0, '#c0ff80'], [0.5, '#3a9a20'], [1, '#0a3a08']]);
    g.beginPath(); g.moveTo(17.5, 8); g.lineTo(22.5, 8); g.lineTo(22.5, 14); g.quadraticCurveTo(29, 18, 28, 26); g.quadraticCurveTo(27, 33, 20, 33); g.quadraticCurveTo(13, 33, 12, 26); g.quadraticCurveTo(11, 18, 17.5, 14); g.closePath(); g.fill(); outline(g, 0.6);
    g.fillStyle = '#4a3020'; rr(g, 17, 5.5, 6, 3.4, 1); g.fill();
    // skull mark
    ell(g, 20, 23, 3.4, 3, '#f0ecdc'); g.fillStyle = '#f0ecdc'; g.fillRect(18.4, 25, 3.2, 1.8); ell(g, 18.8, 22.8, 0.9, 1, '#0a2a08'); ell(g, 21.2, 22.8, 0.9, 1, '#0a2a08');
  }
  function potion(g, d, f) {
    ell(g, 20, 33, 7, 2.6, 'rgba(0,0,0,.4)');
    g.fillStyle = rad(g, 20, 24, 0, 15, [[0, 'rgba(120,200,255,' + (f % 2 ? 0.45 : 0.3) + ')'], [1, 'rgba(60,120,255,0)']]); g.fillRect(4, 8, 32, 32);
    g.fillStyle = rad(g, 18, 23, 1, 10, [[0, '#e0f4ff'], [0.35, '#4aa0ff'], [1, '#102a7a']]);
    g.beginPath(); g.moveTo(18, 9); g.lineTo(22, 9); g.lineTo(22, 15); g.quadraticCurveTo(29, 18, 28.5, 25); g.quadraticCurveTo(28, 33, 20, 33); g.quadraticCurveTo(12, 33, 11.5, 25); g.quadraticCurveTo(11, 18, 18, 15); g.closePath(); g.fill(); outline(g, 0.6);
    g.fillStyle = '#c8a040'; g.fillRect(17.4, 12.6, 5.2, 1.6); g.fillStyle = '#8a5a30'; rr(g, 17.6, 6.4, 4.8, 3.6, 1); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(16.4, 22, 1.4, 3, 0.2, 0, TAU); g.fill();
  }
  function keyItem(g) {
    ell(g, 20, 31, 9, 2.6, 'rgba(0,0,0,.35)');
    g.save(); g.translate(20, 22); g.rotate(-0.6);
    var gold = lin(g, -10, -4, 10, 4, [[0, '#fff2a8'], [0.5, '#e0b030'], [1, '#7a5208']]);
    g.lineWidth = 2.6; g.strokeStyle = gold; g.beginPath(); g.arc(-7, 0, 4, 0, TAU); g.stroke();
    g.fillStyle = gold; g.fillRect(-3.4, -1.2, 13, 2.4); g.fillRect(6, 1, 2, 3.6); g.fillRect(9, 1, 1.6, 2.6);
    g.strokeStyle = 'rgba(80,50,0,.8)'; g.lineWidth = 0.4; g.strokeRect(-3.4, -1.2, 13, 2.4);
    g.restore();
  }
  function treasure(g) {
    ell(g, 20, 33, 12, 3, 'rgba(0,0,0,.45)');
    // spilled coins
    [[9, 31], [12, 33], [30, 32], [27, 34]].forEach(function (c) { ell(g, c[0], c[1], 2, 1.2, '#f0c040'); });
    g.fillStyle = lin(g, 0, 18, 0, 32, [[0, '#8a5a2a'], [1, '#3a2010']]); rr(g, 8, 18, 24, 14, 1.5); g.fill(); outline(g, 0.6);
    // heaped gold and gems under an open lid
    g.fillStyle = lin(g, 0, 10, 0, 6, [[0, '#6a4420'], [1, '#2a1808']]); poly(g, [8, 18, 32, 18, 30, 9, 10, 9]); g.fill(); outline(g, 0.5);
    g.fillStyle = rad(g, 18, 17, 1, 10, [[0, '#fffbd0'], [0.4, '#f4c840'], [1, '#9a6a10']]);
    g.beginPath(); g.moveTo(9, 19); g.quadraticCurveTo(14, 12.5, 20, 13.5); g.quadraticCurveTo(26, 12.5, 31, 19); g.closePath(); g.fill();
    ell(g, 16, 16, 1.4, 1.2, '#ff3050'); ell(g, 24, 15.6, 1.4, 1.2, '#30a0ff');
    g.fillStyle = '#c8a040'; g.fillRect(8, 22, 24, 1.6); g.fillRect(18.5, 21, 3, 6); g.fillStyle = '#3a2010'; g.fillRect(19.4, 23.6, 1.2, 2);
  }
  function shotAxe(g, d, f) { g.translate(20, 20); g.rotate(f * TAU / 4); g.translate(-20, -20); weapon(g, 'warrior', HEROES.warrior, 20, 26, 0, 0.75); }
  function shotSword(g, d) { g.translate(20, 20); g.rotate(d * TAU / 8 + Math.PI / 2); g.translate(-20, -20); weapon(g, 'valkyrie', HEROES.valkyrie, 20, 28, 0, 0.75); }
  function shotFire(g, d, f, rank) {
    var hot = rank === 1 ? ['rgba(255,255,230,1)', 'rgba(120,200,255,.85)', 'rgba(40,90,255,0)'] : rank === 2 ? ['rgba(255,255,220,1)', 'rgba(255,140,40,.9)', 'rgba(200,30,0,0)'] : ['rgba(255,250,210,1)', 'rgba(255,90,40,.9)', 'rgba(140,0,0,0)'];
    g.fillStyle = rad(g, 20, 20, 0, 9, [[0, hot[0]], [0.35, hot[1]], [1, hot[2]]]); g.fillRect(8, 8, 24, 24);
    for (var i = 0; i < 5; i++) { var a = i / 5 * TAU + f; ell(g, 20 + Math.cos(a) * 4.5, 20 + Math.sin(a) * 4.5, 1.4, 1.4, hot[1]); }
  }
  function shotArrow(g, d) {
    g.translate(20, 20); g.rotate(d * TAU / 8); g.translate(-20, -20);
    line(g, [9, 20, 29, 20], 1, '#8a5a2e'); g.fillStyle = '#d8dce4'; poly(g, [29, 17.8, 33.5, 20, 29, 22.2]); g.fill(); outline(g, 0.3);
    g.fillStyle = '#c8342a'; poly(g, [8, 20, 12, 17.4, 13, 20, 12, 22.6]); g.fill();
  }
  function shotRock(g) { ell(g, 20, 20, 3.6, 3.2, lin(g, 16, 16, 24, 24, [[0, '#c8c0b4'], [1, '#4a443c']])); outline(g, 0.5); }

  var PAINT = {
    warrior: hero('warrior'), valkyrie: hero('valkyrie'), wizard: hero('wizard'), elf: hero('elf'),
    ghost: ghost, grunt: grunt, demon: demon, lobber: lobber, sorcerer: sorcerer, death: death,
    gen_ghost: bones,
    gen_grunt: den('#ff9a30', function (g) { g.moveTo(14, 9); g.lineTo(26, 13); g.moveTo(26, 9); g.lineTo(14, 13); }),
    gen_demon: den('#ff3a20', function (g) { g.moveTo(16, 13); g.lineTo(18, 8); g.lineTo(20, 12); g.lineTo(22, 8); g.lineTo(24, 13); }),
    gen_lobber: den('#e0c050', function (g) { g.arc(20, 11, 3, 0, TAU); }),
    gen_sorcerer: den('#b070ff', function (g) { g.moveTo(20, 7.5); g.lineTo(23.5, 13.5); g.lineTo(16.5, 13.5); g.closePath(); }),
    food: food, jug: jug, poison: poison, potion: potion, key: keyItem, treasure: treasure,
    shot_warrior: shotAxe, shot_valkyrie: shotSword, shot_wizard: shotFire, shot_elf: shotArrow, fireball: shotFire, rock: shotRock
  };
  ['ghost', 'grunt', 'demon', 'lobber', 'sorcerer', 'death', 'gen_ghost', 'gen_grunt', 'gen_demon', 'gen_lobber', 'gen_sorcerer', 'food', 'jug', 'poison', 'potion', 'key', 'treasure', 'shot_warrior', 'shot_valkyrie', 'shot_elf', 'shot_wizard', 'fireball', 'rock'].forEach(function (n) { PAINT[n].mirrorable = false; });
  A.mirrorDir = function (d) { return d; };
})();

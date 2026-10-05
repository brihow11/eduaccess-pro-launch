/* Karate Champ tribute: painted stages, layered fighter sprites from the skeleton, referee, bull and props.
   Everything is drawn in code (no image files). Written by: Howie */
(function () {
  "use strict";
  var C = window.KarateCore;
  var R = window.KarateRender = {};
  var W = 1280, H = 720, FLOOR = 610;
  R.W = W; R.H = H; R.FLOOR = FLOOR;
  function rnd(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function grad(x, y0, y1, stops) { var g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function rect(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }

  // ------------------------------------------------------------------ shared scenery pieces
  function mountains(x, r, y, h, col, n, jag) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    var px = -40; x.lineTo(px, y);
    while (px < W + 60) { var w = 80 + r() * 160 / (n || 1); px += w; x.lineTo(px - w / 2, y - h * (0.4 + r() * 0.6)); if (jag) x.lineTo(px - w / 3, y - h * (0.3 + r() * 0.4)); x.lineTo(px, y - r() * h * 0.2); }
    x.lineTo(W + 60, H); x.closePath(); x.fill();
  }
  function snowCaps(x, r, y, h) { /* light ridge highlights */ x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 3; for (var i = 0; i < 9; i++) { var cx = r() * W, cy = y - h * (0.5 + r() * 0.4); x.beginPath(); x.moveTo(cx - 30, cy + 22); x.lineTo(cx, cy); x.lineTo(cx + 26, cy + 20); x.stroke(); } }
  function pine(x, cx, by, s, col, snow) {
    x.fillStyle = "#3a2618"; x.fillRect(cx - 5 * s, by - 30 * s, 10 * s, 30 * s);
    for (var i = 0; i < 4; i++) {
      var y = by - 30 * s - i * 34 * s, w = (70 - i * 13) * s;
      x.fillStyle = col; x.beginPath(); x.moveTo(cx - w, y); x.quadraticCurveTo(cx, y - 18 * s, cx + w, y); x.lineTo(cx + w * 0.3, y - 40 * s); x.lineTo(cx - w * 0.3, y - 40 * s); x.closePath(); x.fill();
      if (snow) { x.fillStyle = "rgba(240,246,255,0.9)"; x.beginPath(); x.moveTo(cx - w * 0.8, y - 6 * s); x.quadraticCurveTo(cx, y - 24 * s, cx + w * 0.8, y - 6 * s); x.quadraticCurveTo(cx, y - 14 * s, cx - w * 0.8, y - 6 * s); x.fill(); }
    }
  }
  function roof(x, cx, y, w, h, col, edge) {
    x.fillStyle = col; x.beginPath(); x.moveTo(cx - w / 2 - 26, y + 6); x.quadraticCurveTo(cx - w / 2, y - 4, cx - w / 2 + 30, y - h); x.lineTo(cx + w / 2 - 30, y - h);
    x.quadraticCurveTo(cx + w / 2, y - 4, cx + w / 2 + 26, y + 6); x.quadraticCurveTo(cx, y - 8, cx - w / 2 - 26, y + 6); x.fill();
    x.strokeStyle = edge || "rgba(0,0,0,0.35)"; x.lineWidth = 2; x.stroke();
    x.strokeStyle = "rgba(0,0,0,0.18)"; x.lineWidth = 1; for (var i = -w / 2 + 34; i < w / 2 - 30; i += 9) { x.beginPath(); x.moveTo(cx + i, y - h + 1); x.lineTo(cx + i * 1.12, y - 2); x.stroke(); }
  }
  function pagoda(x, cx, by, s, wall, rf) {
    var y = by;
    for (var i = 0; i < 4; i++) {
      var w = (190 - i * 32) * s, hh = 58 * s;
      rect(x, wall, cx - w / 2 + 14 * s, y - hh, w - 28 * s, hh);
      x.fillStyle = "rgba(0,0,0,0.25)"; for (var k = 0; k < 4; k++) x.fillRect(cx - w / 2 + 22 * s + k * (w - 44 * s) / 3.3, y - hh + 10 * s, 6 * s, hh - 14 * s);
      roof(x, cx, y - hh, w + 30 * s, 22 * s, rf);
      y -= hh + 18 * s;
    }
    x.strokeStyle = "#b08a3a"; x.lineWidth = 5 * s; x.beginPath(); x.moveTo(cx, y + 18 * s); x.lineTo(cx, y - 60 * s); x.stroke();
    for (var r2 = 0; r2 < 5; r2++) { x.beginPath(); x.ellipse(cx, y - 4 * s - r2 * 10 * s, 9 * s, 3 * s, 0, 0, 7); x.stroke(); }
  }
  function torii(x, cx, by, s, col) {
    x.fillStyle = col;
    x.fillRect(cx - 120 * s, by - 300 * s, 22 * s, 300 * s); x.fillRect(cx + 98 * s, by - 300 * s, 22 * s, 300 * s);
    x.fillRect(cx - 150 * s, by - 250 * s, 300 * s, 18 * s);
    x.beginPath(); x.moveTo(cx - 185 * s, by - 312 * s); x.quadraticCurveTo(cx, by - 296 * s, cx + 185 * s, by - 312 * s); x.lineTo(cx + 170 * s, by - 288 * s); x.quadraticCurveTo(cx, by - 278 * s, cx - 170 * s, by - 288 * s); x.fill();
    rect(x, "#1a1210", cx - 190 * s, by - 322 * s, 380 * s, 10 * s);
    rect(x, col, cx - 10 * s, by - 286 * s, 20 * s, 36 * s);
  }
  function lantern(x, cx, by, s) {
    x.fillStyle = "#8d8a80"; x.fillRect(cx - 9 * s, by - 70 * s, 18 * s, 70 * s); x.fillRect(cx - 26 * s, by - 8 * s, 52 * s, 8 * s);
    x.fillRect(cx - 22 * s, by - 80 * s, 44 * s, 10 * s); x.fillStyle = "#a8a498"; x.fillRect(cx - 18 * s, by - 112 * s, 36 * s, 32 * s);
    x.fillStyle = "#ffd27a"; x.fillRect(cx - 9 * s, by - 106 * s, 18 * s, 20 * s);
    x.fillStyle = "#77746b"; x.beginPath(); x.moveTo(cx - 34 * s, by - 112 * s); x.lineTo(cx, by - 136 * s); x.lineTo(cx + 34 * s, by - 112 * s); x.fill();
  }
  function cherry(x, r, cx, by, s) {
    x.strokeStyle = "#3b2418"; x.lineCap = "round";
    function br(px, py, a, len, w, d) {
      var ex = px + Math.sin(a) * len, ey = py - Math.cos(a) * len; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
      if (d > 0) { br(ex, ey, a - 0.45 - r() * 0.3, len * 0.72, w * 0.66, d - 1); br(ex, ey, a + 0.4 + r() * 0.3, len * 0.7, w * 0.66, d - 1); }
      else for (var i = 0; i < 9; i++) { x.fillStyle = ["#f7c6d6", "#f2a7bf", "#fde3ec", "#e98aa8"][(r() * 4) | 0]; x.beginPath(); x.arc(ex + (r() - 0.5) * 50 * s, ey + (r() - 0.5) * 40 * s, (6 + r() * 9) * s, 0, 7); x.fill(); }
    }
    br(cx, by, -0.1, 120 * s, 22 * s, 4);
  }
  function crowd(x, r, y0, y1, dark) {
    for (var y = y0; y < y1; y += 14) for (var cx = (y / 7) % 18; cx < W; cx += 18 + r() * 6) {
      var sh = 0.55 + (y - y0) / (y1 - y0) * 0.45;
      x.fillStyle = "rgba(" + ((60 + r() * 120) * sh | 0) + "," + ((40 + r() * 80) * sh | 0) + "," + ((50 + r() * 90) * sh | 0) + "," + (dark ? 0.8 : 1) + ")";
      x.fillRect(cx, y + 6, 12, 10); x.fillStyle = "rgba(" + (200 * sh | 0) + "," + (150 * sh | 0) + "," + (110 * sh | 0) + ",1)"; x.beginPath(); x.arc(cx + 6, y + 4, 4.5, 0, 7); x.fill();
    }
  }
  function woodFloor(x, r, top, base, line, shine) {
    x.fillStyle = grad(x, top, H, [[0, base[0]], [1, base[1]]]); x.fillRect(0, top, W, H - top);
    x.strokeStyle = line; x.lineWidth = 1.5;
    for (var i = 0; i < 9; i++) { var yy = top + Math.pow(i / 9, 1.6) * (H - top); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    for (var k = -20; k < 20; k++) { x.beginPath(); x.moveTo(W / 2 + k * 60, top); x.lineTo(W / 2 + k * 150, H); x.stroke(); }
    if (shine) { x.fillStyle = grad(x, top, H, [[0, "rgba(255,240,200,0.18)"], [0.5, "rgba(255,240,200,0)"]]); x.fillRect(0, top, W, H - top); }
  }
  function stoneFloor(x, r, top, c1, c2, mortar) {
    x.fillStyle = grad(x, top, H, [[0, c1], [1, c2]]); x.fillRect(0, top, W, H - top);
    x.strokeStyle = mortar; x.lineWidth = 2; var row = 0;
    for (var y = top; y < H; row++) { var h = 14 + row * 9; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); var w = 70 + row * 28;
      for (var cx = (row % 2) * w / 2; cx < W; cx += w) { x.beginPath(); x.moveTo(cx, y); x.lineTo(cx + (cx - W / 2) * 0.08, y + h); x.stroke(); } y += h; }
    for (var i = 0; i < 300; i++) { x.fillStyle = "rgba(0,0,0," + (r() * 0.08) + ")"; x.fillRect(r() * W, top + r() * (H - top), 3 + r() * 6, 2 + r() * 3); }
  }

  // ------------------------------------------------------------------ the twelve stages
  var STAGES = {
    dojo: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#4a3220"], [1, "#6d4a2c"]]); x.fillRect(0, 0, W, FLOOR);
      for (var i = 0; i < W; i += 40) { x.fillStyle = "rgba(0,0,0," + (0.05 + r() * 0.1) + ")"; x.fillRect(i, 0, 3, FLOOR); }
      rect(x, "#2a1a10", 0, 70, W, 26); rect(x, "#2a1a10", 0, FLOOR - 70, W, 18);
      for (var p = 0; p < 4; p++) { var px = 70 + p * 300; rect(x, "#e9dfc6", px, 120, 220, 330); x.strokeStyle = "#3a2616"; x.lineWidth = 5; x.strokeRect(px, 120, 220, 330);
        x.lineWidth = 3; for (var a = 1; a < 4; a++) { x.beginPath(); x.moveTo(px + a * 55, 120); x.lineTo(px + a * 55, 450); x.stroke(); } for (var b = 1; b < 6; b++) { x.beginPath(); x.moveTo(px, 120 + b * 55); x.lineTo(px + 220, 120 + b * 55); x.stroke(); }
        x.fillStyle = grad(x, 120, 450, [[0, "rgba(255,230,170,0.25)"], [1, "rgba(255,230,170,0)"]]); x.fillRect(px, 120, 220, 330); }
      // hanging scroll with an abstract brush mark and a rack of bo staffs
      rect(x, "#f4ecd8", 607, 110, 66, 240); rect(x, "#5a1a14", 600, 104, 80, 10); rect(x, "#5a1a14", 600, 346, 80, 10);
      x.strokeStyle = "#151010"; x.lineWidth = 9; x.lineCap = "round"; x.beginPath(); x.moveTo(622, 150); x.quadraticCurveTo(660, 170, 640, 210); x.moveTo(628, 236); x.lineTo(656, 300); x.moveTo(654, 236); x.lineTo(622, 304); x.stroke();
      x.fillStyle = "#b8231c"; x.fillRect(645, 318, 16, 16);
      woodFloor(x, r, FLOOR - 52, ["#b98a52", "#7a5230"], "rgba(60,30,10,0.35)", true);
    },
    garden: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#9cc8e8"], [0.7, "#e8eef0"], [1, "#d6dcc8"]]); x.fillRect(0, 0, W, FLOOR);
      mountains(x, r, 380, 160, "#9fb3c0", 1); mountains(x, r, 470, 120, "#7f9a86", 1.5);
      x.fillStyle = "#5f7d55"; x.fillRect(0, 470, W, 90);
      for (var i = 0; i < 30; i++) { x.fillStyle = "rgba(40,80,40," + (0.3 + r() * 0.4) + ")"; x.beginPath(); x.ellipse(r() * W, 480 + r() * 60, 30 + r() * 50, 16 + r() * 18, 0, 0, 7); x.fill(); }
      cherry(x, r, 190, 560, 1.2); cherry(x, r, 1110, 560, 1.05);
      lantern(x, 360, 556, 1); lantern(x, 930, 556, 0.9);
      x.fillStyle = "#cfc6ae"; x.fillRect(0, FLOOR - 52, W, H); x.strokeStyle = "rgba(120,105,80,0.4)"; x.lineWidth = 2;
      for (var y = FLOOR - 46; y < H; y += 9) { x.beginPath(); x.moveTo(0, y); for (var xx = 0; xx <= W; xx += 40) x.lineTo(xx, y + Math.sin(xx * 0.02 + y) * 2); x.stroke(); }
      x.fillStyle = "#6d6a62"; x.beginPath(); x.ellipse(70, H - 30, 60, 26, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(1220, FLOOR + 10, 44, 20, 0, 0, 7); x.fill();
    },
    bridge: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#f1c88a"], [0.6, "#f7e2b8"], [1, "#c8d6d0"]]); x.fillRect(0, 0, W, FLOOR);
      x.fillStyle = "rgba(255,240,200,0.8)"; x.beginPath(); x.arc(980, 170, 70, 0, 7); x.fill();
      mountains(x, r, 360, 220, "#a59fae", 0.8, true); mountains(x, r, 430, 150, "#7a8894", 1.1, true);
      x.fillStyle = grad(x, 430, FLOOR, [[0, "#6c9aa8"], [1, "#2f5f70"]]); x.fillRect(0, 430, W, FLOOR - 430);
      x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 2; for (var i = 0; i < 40; i++) { var y = 440 + r() * 140, w = 20 + r() * 60, xx = r() * W; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx + w, y); x.stroke(); }
      // railing behind the fighters
      x.fillStyle = "#a8261c"; for (var p = 0; p < W; p += 160) { x.fillRect(p + 20, FLOOR - 160, 18, 120); rect(x, "#c9a24a", p + 16, FLOOR - 168, 26, 10); }
      x.fillRect(0, FLOOR - 140, W, 14); x.fillRect(0, FLOOR - 92, W, 10);
      woodFloor(x, r, FLOOR - 40, ["#8a5a36", "#4a2c18"], "rgba(20,10,0,0.45)", false);
    },
    temple: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#7fa9cf"], [1, "#d8e4ea"]]); x.fillRect(0, 0, W, FLOOR);
      mountains(x, r, 400, 240, "#8697a8", 0.7, true); snowCaps(x, r, 400, 240);
      pine(x, 110, 520, 1.3, "#2f4a33"); pine(x, 1180, 520, 1.4, "#2f4a33");
      pagoda(x, 640, 520, 1.1, "#c8b89a", "#2f3a3c");
      rect(x, "#9a907e", 300, 510, 680, 16); rect(x, "#867c6a", 330, 526, 620, 16);
      lantern(x, 380, 556, 0.85); lantern(x, 900, 556, 0.85);
      stoneFloor(x, r, FLOOR - 50, "#a49a88", "#6c6456", "rgba(60,50,40,0.45)");
    },
    harbor: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#2b2148"], [0.45, "#a2486a"], [0.75, "#f09a4e"], [1, "#f5c27a"]]); x.fillRect(0, 0, W, FLOOR);
      x.fillStyle = "#ffd59a"; x.beginPath(); x.arc(400, 430, 64, 0, 7); x.fill();
      x.fillStyle = grad(x, 440, FLOOR, [[0, "#6a4a6a"], [1, "#2a2440"]]); x.fillRect(0, 440, W, FLOOR - 440);
      x.fillStyle = "rgba(255,210,150,0.5)"; for (var i = 0; i < 26; i++) x.fillRect(360 + (r() - 0.5) * 120, 446 + i * 6, 30 + r() * 60, 2);
      function boat(cx, y, s) { x.fillStyle = "#1a1424"; x.beginPath(); x.moveTo(cx - 80 * s, y); x.lineTo(cx + 80 * s, y); x.lineTo(cx + 60 * s, y + 20 * s); x.lineTo(cx - 64 * s, y + 20 * s); x.fill(); x.fillRect(cx - 2, y - 120 * s, 4, 120 * s); x.beginPath(); x.moveTo(cx + 4, y - 115 * s); x.lineTo(cx + 70 * s, y - 20 * s); x.lineTo(cx + 4, y - 20 * s); x.fill(); }
      boat(860, 470, 1); boat(1120, 455, 0.6); boat(140, 462, 0.7);
      for (var p = 0; p < W; p += 220) { rect(x, "#2a1c18", p + 40, FLOOR - 130, 22, 130); }
      woodFloor(x, r, FLOOR - 44, ["#6a4630", "#2e1c14"], "rgba(10,0,0,0.5)", false);
    },
    bamboo: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#c9e2b0"], [1, "#6e9a5a"]]); x.fillRect(0, 0, W, FLOOR);
      [[0.35, "#8fb47a", 22], [0.6, "#5f8a4a", 30], [0.9, "#3e6a32", 38]].forEach(function (L) {
        for (var i = 0; i < 26; i++) { var cx = r() * W, w = L[2] * (0.6 + r() * 0.5); x.fillStyle = L[1]; x.fillRect(cx, 0, w, FLOOR); x.fillStyle = "rgba(255,255,255,0.15)"; x.fillRect(cx + w * 0.2, 0, w * 0.15, FLOOR);
          x.fillStyle = "rgba(0,0,0,0.25)"; for (var y = 40 + r() * 60; y < FLOOR; y += 90 + r() * 40) x.fillRect(cx - 2, y, w + 4, 5);
          x.fillStyle = L[1]; for (var k = 0; k < 3; k++) { var ly = 60 + r() * 400; x.beginPath(); x.ellipse(cx + w + 26, ly, 34, 6, 0.4, 0, 7); x.fill(); } }
      });
      x.fillStyle = "rgba(220,240,200,0.25)"; x.fillRect(0, 0, W, FLOOR);
      stoneFloor(x, r, FLOOR - 46, "#6a7a4a", "#3a4a2a", "rgba(20,30,10,0.4)");
    },
    snow: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#8aa2c2"], [1, "#e6ecf4"]]); x.fillRect(0, 0, W, FLOOR);
      mountains(x, r, 380, 260, "#c8d4e4", 0.6, true); mountains(x, r, 470, 160, "#a8b8cc", 0.9, true); snowCaps(x, r, 470, 160);
      for (var i = 0; i < 9; i++) pine(x, 40 + i * 150 + r() * 40, 560, 0.9 + r() * 0.5, "#2c4438", true);
      x.fillStyle = grad(x, FLOOR - 50, H, [[0, "#f4f8fc"], [1, "#c4d0e0"]]); x.fillRect(0, FLOOR - 50, W, H);
      x.fillStyle = "rgba(150,170,200,0.3)"; for (var k = 0; k < 40; k++) { x.beginPath(); x.ellipse(r() * W, FLOOR - 30 + r() * 140, 40 + r() * 60, 6, 0, 0, 7); x.fill(); }
    },
    castle: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#5d8fc4"], [1, "#cfe0ee"]]); x.fillRect(0, 0, W, FLOOR);
      x.fillStyle = "rgba(255,255,255,0.7)"; for (var c = 0; c < 6; c++) { x.beginPath(); x.ellipse(r() * W, 60 + r() * 120, 80 + r() * 60, 18, 0, 0, 7); x.fill(); }
      x.fillStyle = "#7c776c"; x.beginPath(); x.moveTo(330, 470); x.lineTo(950, 470); x.lineTo(990, 560); x.lineTo(290, 560); x.fill();
      x.strokeStyle = "rgba(40,36,30,0.4)"; x.lineWidth = 2; for (var y = 480; y < 560; y += 14) { x.beginPath(); x.moveTo(300, y); x.lineTo(980, y); x.stroke(); }
      var cx = 640, by = 470; [[520, 70], [400, 64], [300, 60], [200, 56]].forEach(function (t) { rect(x, "#f2efe6", cx - t[0] / 2 + 20, by - t[1], t[0] - 40, t[1]); x.fillStyle = "#3a3a40"; for (var k = 0; k < t[0] / 60; k++) x.fillRect(cx - t[0] / 2 + 40 + k * 60, by - t[1] + 18, 14, 18); roof(x, cx, by - t[1], t[0], 24, "#4a5258"); by -= t[1] + 20; });
      rect(x, "#e3dccb", 0, 540, W, 30); x.fillStyle = "#4a5258"; x.fillRect(0, 530, W, 12);
      stoneFloor(x, r, FLOOR - 40, "#b4aa96", "#7e7464", "rgba(60,50,40,0.4)");
    },
    falls: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#9ac6c0"], [1, "#e4f0ea"]]); x.fillRect(0, 0, W, FLOOR);
      x.fillStyle = "#4e5a52"; x.beginPath(); x.moveTo(0, 0); x.lineTo(520, 0); x.lineTo(500, 160); x.lineTo(540, 560); x.lineTo(0, 560); x.fill();
      x.beginPath(); x.moveTo(W, 0); x.lineTo(780, 0); x.lineTo(800, 200); x.lineTo(760, 560); x.lineTo(W, 560); x.fill();
      x.fillStyle = "#3a453e"; for (var i = 0; i < 30; i++) { x.beginPath(); x.ellipse(r() < 0.5 ? r() * 480 : 800 + r() * 480, r() * 560, 30 + r() * 40, 16 + r() * 20, r(), 0, 7); x.fill(); }
      x.fillStyle = grad(x, 0, 560, [[0, "#dff4f8"], [1, "#9ad0dc"]]); x.fillRect(530, 0, 250, 560);
      x.fillStyle = "rgba(255,255,255,0.85)"; x.beginPath(); x.ellipse(655, 560, 220, 40, 0, 0, 7); x.fill();
      pine(x, 120, 300, 0.8, "#2e4a3a"); pine(x, 1160, 320, 0.9, "#2e4a3a");
      stoneFloor(x, r, FLOOR - 46, "#7a8a84", "#46524e", "rgba(20,30,30,0.45)");
    },
    shrine: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#070b1e"], [0.7, "#1c2246"], [1, "#2c2a46"]]); x.fillRect(0, 0, W, FLOOR);
      for (var i = 0; i < 160; i++) { x.fillStyle = "rgba(255,255,255," + (0.2 + r() * 0.7) + ")"; x.fillRect(r() * W, r() * 400, 1.5, 1.5); }
      var g = x.createRadialGradient(920, 150, 10, 920, 150, 170); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(0.35, "rgba(255,240,200,0.9)"); g.addColorStop(0.4, "rgba(200,210,255,0.25)"); g.addColorStop(1, "rgba(200,210,255,0)");
      x.fillStyle = g; x.fillRect(700, 0, 440, 360);
      mountains(x, r, 470, 140, "#141a32", 1);
      torii(x, 640, 560, 1.05, "#b8261c");
      lantern(x, 260, 560, 1); lantern(x, 1020, 560, 1);
      stoneFloor(x, r, FLOOR - 46, "#4a4a5e", "#22222e", "rgba(0,0,0,0.5)");
      x.fillStyle = "rgba(20,30,80,0.25)"; x.fillRect(0, 0, W, H);
    },
    palace: function (x, r) {
      x.fillStyle = grad(x, 0, FLOOR, [[0, "#3a0e0c"], [1, "#6a1c14"]]); x.fillRect(0, 0, W, FLOOR);
      for (var p = 0; p < 5; p++) { var px = 40 + p * 300; x.fillStyle = grad(x, 120, 520, [[0, "#e8c25a"], [1, "#a8801e"]]); x.fillRect(px + 50, 140, 200, 360);
        x.strokeStyle = "rgba(90,50,10,0.6)"; x.lineWidth = 2; x.strokeRect(px + 50, 140, 200, 360); x.fillStyle = "rgba(255,255,255,0.18)"; x.beginPath(); x.ellipse(px + 150, 300, 60, 30, 0, 0, 7); x.fill();
        x.strokeStyle = "#2a3a2a"; x.lineWidth = 4; x.beginPath(); x.moveTo(px + 70, 470); x.quadraticCurveTo(px + 140, 380, px + 200, 300); x.stroke(); }
      for (var c = 0; c < 6; c++) { var cx = c * 256; x.fillStyle = grad(x, 0, FLOOR, [[0, "#9a1a12"], [1, "#5a0c08"]]); x.fillRect(cx - 18, 60, 36, FLOOR); rect(x, "#e0b23a", cx - 24, 60, 48, 14); rect(x, "#e0b23a", cx - 24, FLOOR - 70, 48, 14); }
      rect(x, "#2a0806", 0, 30, W, 40); x.fillStyle = "#e0b23a"; for (var k = 0; k < W; k += 40) x.fillRect(k + 10, 40, 20, 20);
      woodFloor(x, r, FLOOR - 50, ["#5a2a18", "#2a100a"], "rgba(0,0,0,0.4)", true);
    },
    arena: function (x, r) {
      x.fillStyle = "#0e0d14"; x.fillRect(0, 0, W, FLOOR);
      crowd(x, r, 150, 470, false);
      x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(0, 150, W, 40);
      for (var b = 0; b < 4; b++) { var bx = 110 + b * 320; x.fillStyle = b % 2 ? "#b8202a" : "#f2efe6"; x.fillRect(bx, 20, 100, 120); x.fillStyle = b % 2 ? "#f2efe6" : "#b8202a"; x.beginPath(); x.arc(bx + 50, 80, 26, 0, 7); x.fill(); }
      for (var l = 0; l < 6; l++) { var g = x.createRadialGradient(100 + l * 216, 0, 0, 100 + l * 216, 0, 260); g.addColorStop(0, "rgba(255,250,220,0.35)"); g.addColorStop(1, "rgba(255,250,220,0)"); x.fillStyle = g; x.fillRect(0, 0, W, 400); }
      rect(x, "#2a2a34", 0, 470, W, 90);
      x.fillStyle = grad(x, FLOOR - 56, H, [[0, "#c8b47a"], [1, "#8a7442"]]); x.fillRect(0, FLOOR - 56, W, H);
      x.fillStyle = "#b8202a"; x.beginPath(); x.moveTo(250, FLOOR - 40); x.lineTo(1030, FLOOR - 40); x.lineTo(1150, H); x.lineTo(130, H); x.fill();
      x.fillStyle = "#e8d8a8"; x.beginPath(); x.moveTo(290, FLOOR - 32); x.lineTo(990, FLOOR - 32); x.lineTo(1100, H); x.lineTo(180, H); x.fill();
      x.strokeStyle = "rgba(90,60,20,0.25)"; x.lineWidth = 1.5; for (var k = -10; k < 11; k++) { x.beginPath(); x.moveTo(640 + k * 40, FLOOR - 32); x.lineTo(640 + k * 64, H); x.stroke(); }
    }
  };
  var cache = {};
  R.stage = function (name, q) {
    var key = name + "@" + q;
    if (cache[key]) return cache[key];
    var cv = document.createElement("canvas"); cv.width = Math.round(W * q); cv.height = Math.round(H * q);
    var x = cv.getContext("2d"); x.scale(q, q);
    (STAGES[name] || STAGES.dojo)(x, rnd(name.length * 7919 + name.charCodeAt(0)));
    // floor shadow line where the fighters stand
    x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(0, FLOOR + 4, W, 3);
    var vg = x.createRadialGradient(W / 2, H * 0.55, H * 0.4, W / 2, H * 0.55, W * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.35)"); x.fillStyle = vg; x.fillRect(0, 0, W, H);
    cache[key] = cv; return cv;
  };
  R.stageNames = Object.keys(STAGES);

  // per-frame ambient effects (petals, snow, water, lantern glow)
  R.ambient = function (x, name, t) {
    var i, px, py;
    if (name === "garden") { x.fillStyle = "rgba(247,190,210,0.85)"; for (i = 0; i < 26; i++) { px = (i * 151 + t * (30 + i % 5 * 9)) % (W + 40) - 20; py = (i * 97 + t * (40 + i % 7 * 6)) % FLOOR; x.beginPath(); x.ellipse(px, py, 4, 2.4, t + i, 0, 7); x.fill(); } }
    else if (name === "snow") { x.fillStyle = "rgba(255,255,255,0.9)"; for (i = 0; i < 70; i++) { px = (i * 173 + Math.sin(t * 0.7 + i) * 30 + t * 12) % W; py = (i * 89 + t * (40 + i % 9 * 8)) % H; x.beginPath(); x.arc(px, py, 1.5 + i % 3, 0, 7); x.fill(); } }
    else if (name === "falls") { x.fillStyle = "rgba(255,255,255,0.45)"; for (i = 0; i < 18; i++) { px = 540 + i * 13; py = (t * 420 + i * 67) % 560; x.fillRect(px, py, 4, 50); } }
    else if (name === "shrine" || name === "temple") { var a = 0.15 + Math.sin(t * 7) * 0.04 + Math.sin(t * 13) * 0.03; x.fillStyle = "rgba(255,190,90," + a + ")"; [[name === "shrine" ? 260 : 380, 465], [name === "shrine" ? 1020 : 900, 465]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 60, 0, 7); x.fill(); }); }
    else if (name === "bridge" || name === "harbor") { x.strokeStyle = "rgba(255,255,255,0.25)"; x.lineWidth = 2; for (i = 0; i < 12; i++) { px = (i * 211 + t * 20) % W; py = 450 + (i * 37) % 120; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 30, py); x.stroke(); } }
    else if (name === "arena") { for (i = 0; i < 8; i++) { if (Math.sin(t * 3 + i * 9.1) > 0.97) { x.fillStyle = "rgba(255,255,255,0.8)"; x.beginPath(); x.arc((i * 167) % W, 170 + (i * 53) % 280, 5, 0, 7); x.fill(); } } }
  };

  // ------------------------------------------------------------------ fighters
  var PAL = {
    white: { gi: "#f3f0e8", giS: "#c8c2b4", giD: "#9a9384", skin: "#e2ac82", skinS: "#b97f58", hair: "#1c1612", band: "#c41e1e", line: "#1e1a16" },
    red: { gi: "#c8282a", giS: "#8e1618", giD: "#5e0c0e", skin: "#c88a5c", skinS: "#94603c", hair: "#120e0c", band: "#f3f0e8", line: "#1a0a08" },
    ref: { gi: "#f6f6f2", giS: "#c8c8c2", pants: "#24242a", pantsS: "#14141a", skin: "#e0b08a", skinS: "#b07e5a", hair: "#b8b8b0", band: null, line: "#141418" }
  };
  R.PAL = PAL;
  function capsule(x, a, b, ra, rb, fill, line) {
    var dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l, ang = Math.atan2(dy, dx);
    x.beginPath(); x.moveTo(a.x + nx * ra, a.y + ny * ra); x.lineTo(b.x + nx * rb, b.y + ny * rb);
    x.arc(b.x, b.y, rb, ang + Math.PI / 2, ang - Math.PI / 2, true); x.lineTo(a.x - nx * ra, a.y - ny * ra);
    x.arc(a.x, a.y, ra, ang - Math.PI / 2, ang + Math.PI / 2, true); x.closePath();
    x.fillStyle = fill; x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = 2.6; x.stroke(); }
  }
  function shade(x, a, b, r, col, side) { // a soft fold shadow along one side of a limb
    var dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l * side, ny = dx / l * side;
    x.strokeStyle = col; x.lineWidth = r * 0.7; x.lineCap = "round"; x.beginPath(); x.moveTo(a.x + nx * r * 0.45, a.y + ny * r * 0.45); x.lineTo(b.x + nx * r * 0.45, b.y + ny * r * 0.45); x.stroke();
  }
  function along(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function leg(x, w, k, A, T, pal, far, ref) {
    var gi = ref ? pal.pants : far ? pal.giS : pal.gi, s = ref ? pal.pantsS : far ? pal.giD : pal.giS;
    // foot
    x.lineJoin = "round";
    capsule(x, A, T, 7.5, 6, far ? pal.skinS : pal.skin, pal.line);
    if (ref) capsule(x, A, T, 8, 6.5, "#101014", pal.line);
    capsule(x, w.H, k, 18, 15, gi, pal.line);
    capsule(x, k, along(k, A, 1.04), 15, 13.5, gi, pal.line);
    shade(x, w.H, k, 18, s, w.dir); shade(x, k, A, 14, s, w.dir);
    if (!ref) { x.strokeStyle = s; x.lineWidth = 2; x.beginPath(); var m = along(k, A, 0.55); x.moveTo(m.x - 6, m.y - 2); x.lineTo(m.x + 5, m.y + 3); x.stroke(); }
  }
  function arm(x, sh, el, hd, pal, far, ref) {
    var gi = far ? pal.giS : pal.gi, s = far ? (pal.giD || pal.giS) : pal.giS, sk = far ? pal.skinS : pal.skin;
    var cuff = along(el, hd, ref ? 0.75 : 0.45);
    capsule(x, el, hd, 8.5, 7.5, sk, pal.line);
    capsule(x, sh, el, 14, 12, gi, pal.line);
    capsule(x, el, cuff, 12, 11.5, gi, pal.line);
    shade(x, sh, el, 13, s, 1);
    x.beginPath(); x.arc(hd.x, hd.y, 10, 0, 7); x.fillStyle = sk; x.fill(); x.strokeStyle = pal.line; x.lineWidth = 2.4; x.stroke();
    x.strokeStyle = pal.skinS; x.lineWidth = 1.6; x.beginPath(); x.arc(hd.x, hd.y, 6, -0.6, 0.9); x.stroke();
  }
  function torso(x, w, pal, ref, belt, t) {
    var H0 = w.H, S0 = w.S, dx = S0.x - H0.x, dy = S0.y - H0.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / l, uy = dy / l, fx = -uy * w.dir, fy = ux * w.dir;
    function P(u, v) { return { x: H0.x + ux * u + fx * v, y: H0.y + uy * u + fy * v }; } // u up the spine, v toward the front
    function outline() {
      var p0 = P(-4, -22), p1 = P(l * 0.55, -27), p2 = P(l - 6, -24), p3 = P(l + 8, -6), p4 = P(l + 4, 14), p5 = P(l - 18, 26), p6 = P(l * 0.45, 22), p7 = P(-4, 21);
      x.beginPath(); x.moveTo(p0.x, p0.y);
      x.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      x.quadraticCurveTo(p3.x, p3.y, p4.x, p4.y);
      x.quadraticCurveTo(p5.x, p5.y, p6.x, p6.y);
      x.lineTo(p7.x, p7.y); x.closePath();
    }
    outline(); x.fillStyle = ref ? pal.gi : pal.gi; x.fill();
    // cloth shading: the back half in shadow, a soft highlight down the chest
    x.save(); outline(); x.clip();
    var bk = P(l * 0.5, -40), mid = P(l * 0.5, -2);
    var g = x.createLinearGradient(bk.x, bk.y, mid.x, mid.y); g.addColorStop(0, pal.giS); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(Math.min(H0.x, S0.x) - 60, Math.min(H0.y, S0.y) - 60, 120 + Math.abs(dx), 120 + Math.abs(dy));
    x.strokeStyle = ref ? pal.giS : pal.giS; x.lineWidth = 2; x.globalAlpha = 0.8;
    var c1 = P(l * 0.3, 4), c2 = P(l * 0.55, 12), c3 = P(l * 0.2, -12), c4 = P(l * 0.45, -6);
    x.beginPath(); x.moveTo(c1.x, c1.y); x.quadraticCurveTo(P(l * 0.42, 14).x, P(l * 0.42, 14).y, c2.x, c2.y); x.moveTo(c3.x, c3.y); x.quadraticCurveTo(P(l * 0.32, -2).x, P(l * 0.32, -2).y, c4.x, c4.y); x.stroke();
    x.globalAlpha = 1; x.restore();
    outline(); x.strokeStyle = pal.line; x.lineWidth = 2.6; x.stroke();
    if (ref) { // shirt buttons, black bow tie and the top of the trousers
      var bt = P(l - 6, 10); x.fillStyle = "#101014"; x.beginPath(); x.moveTo(bt.x - 9, bt.y - 5); x.lineTo(bt.x + 9, bt.y + 5); x.lineTo(bt.x + 9, bt.y - 5); x.lineTo(bt.x - 9, bt.y + 5); x.fill();
      x.fillStyle = pal.giS; for (var b2 = 0.3; b2 < 0.9; b2 += 0.2) { var q = P(l * b2, 14); x.beginPath(); x.arc(q.x, q.y, 2, 0, 7); x.fill(); }
      var t0 = P(-6, -22), t1 = P(16, -24), t2 = P(16, 21), t3 = P(-6, 20);
      x.fillStyle = pal.pants; x.beginPath(); x.moveTo(t0.x, t0.y); x.lineTo(t1.x, t1.y); x.lineTo(t2.x, t2.y); x.lineTo(t3.x, t3.y); x.closePath(); x.fill(); x.strokeStyle = pal.line; x.lineWidth = 2; x.stroke();
      return;
    }
    // lapels: the crossed V of the jacket, open at the neck
    var nk = P(l - 2, 2), lf = P(l * 0.42, 20), lb = P(l * 0.5, -4), nb = P(l + 2, -12), nf = P(l - 4, 16);
    x.fillStyle = pal.skinS; x.beginPath(); x.moveTo(nb.x, nb.y); x.lineTo(nf.x, nf.y); x.lineTo(P(l * 0.7, 10).x, P(l * 0.7, 10).y); x.closePath(); x.fill();
    x.strokeStyle = pal.giD || pal.line; x.lineWidth = 3;
    x.beginPath(); x.moveTo(nb.x, nb.y); x.lineTo(lf.x, lf.y); x.moveTo(nf.x, nf.y); x.lineTo(P(l * 0.66, 8).x, P(l * 0.66, 8).y); x.stroke();
    x.lineWidth = 1.5; x.beginPath(); x.moveTo(nk.x, nk.y); x.lineTo(lb.x, lb.y); x.stroke();
    // belt with knot and swinging tails
    var bc = P(l * 0.1, 0);
    x.save(); x.translate(bc.x, bc.y); x.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    x.fillStyle = belt; x.fillRect(-26, -6, 52, 12); x.strokeStyle = pal.line; x.lineWidth = 2; x.strokeRect(-26, -6, 52, 12);
    var sw = Math.sin(t * 6) * 0.15;
    x.save(); x.translate(10 * w.dir, 2); x.rotate(0.25 * w.dir + sw); x.fillRect(-4, 0, 8, 30); x.strokeRect(-4, 0, 8, 30); x.restore();
    x.save(); x.translate(6 * w.dir, 2); x.rotate(-0.15 * w.dir + sw * 0.7); x.fillRect(-4, 0, 8, 26); x.strokeRect(-4, 0, 8, 26); x.restore();
    x.beginPath(); x.arc(8 * w.dir, 0, 6, 0, 7); x.fill(); x.stroke();
    x.restore();
  }
  function head(x, w, pal, ref, t, look) {
    var N = w.N, S0 = w.S, d = w.dir, ang = Math.atan2(N.y - S0.y, N.x - S0.x) + Math.PI / 2;
    capsule(x, S0, along(S0, N, 0.5), 9, 9, pal.skinS, pal.line);
    x.save(); x.translate(N.x, N.y); x.rotate(ang); x.scale(d, 1);
    // skull + jaw
    x.beginPath(); x.moveTo(-17, -6); x.quadraticCurveTo(-18, -24, 0, -25); x.quadraticCurveTo(19, -24, 19, -4); x.lineTo(20, 6); x.lineTo(15, 10); x.quadraticCurveTo(10, 21, 1, 21); x.quadraticCurveTo(-13, 19, -16, 6); x.closePath();
    x.fillStyle = pal.skin; x.fill(); x.strokeStyle = pal.line; x.lineWidth = 2.6; x.stroke();
    x.fillStyle = pal.skinS; x.beginPath(); x.moveTo(-16, 4); x.quadraticCurveTo(-8, 18, 1, 21); x.quadraticCurveTo(-12, 18, -16, 4); x.fill();
    // hair
    x.fillStyle = pal.hair; x.beginPath(); x.moveTo(-19, 2); x.quadraticCurveTo(-23, -26, 2, -27); x.quadraticCurveTo(19, -27, 20, -10); x.quadraticCurveTo(10, -16, 4, -12); x.quadraticCurveTo(-4, -16, -8, -6); x.quadraticCurveTo(-12, -2, -19, 2); x.fill();
    // ear, brow, eye, nose, mouth: a serious look
    x.fillStyle = pal.skinS; x.beginPath(); x.ellipse(-4, 0, 4, 6, 0, 0, 7); x.fill();
    x.strokeStyle = pal.line; x.lineWidth = 3; x.beginPath(); x.moveTo(7, -9); x.lineTo(17, -7); x.stroke();
    x.fillStyle = "#fff"; x.fillRect(10, -5, 6, 3); x.fillStyle = "#151010"; x.fillRect(look ? 13 : 12, -5, 3, 3);
    x.lineWidth = 2; x.beginPath(); x.moveTo(19, -3); x.lineTo(23, 4); x.lineTo(19, 6); x.stroke();
    x.beginPath(); x.moveTo(12, 12); x.lineTo(18, 11); x.stroke();
    if (pal.band) { // headband with tails in the wind
      x.fillStyle = pal.band; x.beginPath(); x.moveTo(-19, -10); x.lineTo(20, -14); x.lineTo(20, -8); x.lineTo(-19, -3); x.fill(); x.strokeStyle = pal.line; x.lineWidth = 1.6; x.stroke();
      var f = Math.sin(t * 9) * 4; x.beginPath(); x.moveTo(-18, -8); x.quadraticCurveTo(-32, -10 + f, -42, -2 + f * 1.4); x.lineTo(-40, 3 + f); x.quadraticCurveTo(-30, -2, -18, -3); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(-18, -6); x.quadraticCurveTo(-28, 2 - f, -36, 10 - f); x.lineTo(-32, 13 - f); x.quadraticCurveTo(-26, 4, -17, -2); x.fill(); x.stroke();
    }
    x.restore();
  }
  // draw a fighter from its world joints
  R.fighter = function (x, w, pal, opt) {
    opt = opt || {};
    var ref = pal === PAL.ref, t = opt.t || 0;
    // floor shadow
    x.fillStyle = "rgba(0,0,0,0.28)"; x.beginPath(); x.ellipse(w.H.x, FLOOR + 4, 70 * (opt.shadow || 1), 11, 0, 0, 7); x.fill();
    x.lineCap = "round"; x.lineJoin = "round";
    arm(x, w.sB, w.bE, w.bH, pal, true, ref);
    leg(x, w, w.bK, w.bA, w.bT, pal, true, ref);
    torso(x, w, pal, ref, opt.belt || "#151515", t);
    leg(x, w, w.fK, w.fA, w.fT, pal, false, ref);
    head(x, w, pal, ref, t, opt.look);
    if (opt.flags) { // referee's flags in each hand
      [[w.bH, opt.flags[0]]].forEach(function (f) { var h = f[0]; x.strokeStyle = "#5a3a1a"; x.lineWidth = 3; x.beginPath(); x.moveTo(h.x, h.y + 6); x.lineTo(h.x, h.y - 40); x.stroke(); x.fillStyle = f[1]; x.fillRect(h.x, h.y - 40, 30 * w.dir, 22); x.strokeStyle = PAL.ref.line; x.lineWidth = 1.5; x.strokeRect(h.x, h.y - 40, 30 * w.dir, 22); });
    }
    arm(x, w.sF, w.fE, w.fH, pal, false, ref);
    if (opt.flags) { var h2 = w.fH; x.strokeStyle = "#5a3a1a"; x.lineWidth = 3; x.beginPath(); x.moveTo(h2.x, h2.y + 6); x.lineTo(h2.x, h2.y - 40); x.stroke(); x.fillStyle = opt.flags[1]; x.fillRect(h2.x, h2.y - 40, 30 * w.dir, 22); x.strokeStyle = PAL.ref.line; x.lineWidth = 1.5; x.strokeRect(h2.x, h2.y - 40, 30 * w.dir, 22); }
  };
  // motion trail along the striking limb
  R.trail = function (x, pts, col) {
    if (pts.length < 2) return;
    x.lineCap = "round";
    for (var i = 1; i < pts.length; i++) { x.strokeStyle = col.replace("A", (i / pts.length * 0.5).toFixed(2)); x.lineWidth = 6 + i * 2; x.beginPath(); x.moveTo(pts[i - 1].x, pts[i - 1].y); x.lineTo(pts[i].x, pts[i].y); x.stroke(); }
  };
  R.spark = function (x, px, py, a, big) {
    x.save(); x.translate(px, py); x.globalAlpha = Math.max(0, a);
    var n = big ? 12 : 8, r1 = (big ? 70 : 42) * (1.2 - a * 0.4);
    x.fillStyle = big ? "#fff3b0" : "#ffffff"; x.beginPath();
    for (var i = 0; i < n * 2; i++) { var ang = i / (n * 2) * Math.PI * 2, rr = i % 2 ? r1 * 0.35 : r1; x.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    x.closePath(); x.fill(); x.strokeStyle = big ? "#ff8a2a" : "#ffd24a"; x.lineWidth = 3; x.stroke();
    x.restore();
  };

  // ------------------------------------------------------------------ bonus props
  R.bull = function (x, b, t) {
    var d = b.dir, cx = b.x, by = FLOOR, run = b.stun > 0 ? 0 : t * (b.speed / 40), bob = Math.sin(run * 2) * 4;
    x.save(); x.translate(cx, by); x.scale(d, 1);
    x.fillStyle = "rgba(0,0,0,0.3)"; x.beginPath(); x.ellipse(0, 4, 130, 14, 0, 0, 7); x.fill();
    function legP(px, ph) { var s = Math.sin(run * 2 + ph) * 0.5; x.save(); x.translate(px, -88 + bob); x.rotate(s); x.fillStyle = "#2a1a12"; x.fillRect(-9, 0, 18, 56); x.translate(0, 54); x.rotate(-s * 0.6 - 0.1); x.fillRect(-7, 0, 14, 36); x.fillStyle = "#111"; x.fillRect(-8, 32, 16, 8); x.restore(); }
    legP(-70, 0); legP(50, Math.PI);
    x.fillStyle = "#3a2418"; x.beginPath(); x.ellipse(-10, -120 + bob, 105, 52, 0, 0, 7); x.fill(); x.strokeStyle = "#140a06"; x.lineWidth = 3; x.stroke();
    x.fillStyle = "#4a3020"; x.beginPath(); x.ellipse(40, -138 + bob, 60, 40, -0.2, 0, 7); x.fill();
    legP(-50, Math.PI * 0.5); legP(70, Math.PI * 1.5);
    x.save(); x.translate(100, -128 + bob + (b.stun > 0 ? -10 : 8)); x.rotate(b.stun > 0 ? -0.4 : 0.35);
    x.fillStyle = "#2e1c12"; x.beginPath(); x.ellipse(20, 6, 40, 28, 0, 0, 7); x.fill(); x.stroke();
    x.fillStyle = "#c8a070"; x.beginPath(); x.ellipse(50, 14, 14, 13, 0, 0, 7); x.fill();
    x.fillStyle = "#f2ead8"; x.strokeStyle = "#140a06"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(6, -14); x.quadraticCurveTo(-10, -50, 30, -56); x.quadraticCurveTo(0, -42, 18, -14); x.fill(); x.stroke();
    x.fillStyle = "#ff3a1a"; x.beginPath(); x.arc(30, -2, 4, 0, 7); x.fill();
    x.restore();
    x.strokeStyle = "#2a1a12"; x.lineWidth = 5; x.beginPath(); x.moveTo(-110, -130 + bob); x.quadraticCurveTo(-140, -110 + Math.sin(t * 8) * 12, -132, -70); x.stroke();
    if (b.stun > 0) { x.fillStyle = "#ffe066"; for (var i = 0; i < 4; i++) { var a = t * 5 + i * 1.57; x.beginPath(); x.arc(130 + Math.cos(a) * 30, -190 + Math.sin(a) * 8, 5, 0, 7); x.fill(); } }
    x.restore();
  };
  R.object = function (x, o) {
    x.save(); x.translate(o.x, o.y); x.rotate(o.spin);
    if (o.type === 0) { x.fillStyle = "#a8582a"; x.beginPath(); x.ellipse(0, 4, 24, 22, 0, 0, 7); x.fill(); x.fillRect(-12, -24, 24, 10); x.strokeStyle = "#4a200c"; x.lineWidth = 2.5; x.stroke(); x.beginPath(); x.ellipse(0, 4, 24, 22, 0, 0, 7); x.stroke(); x.strokeStyle = "#e8c070"; x.beginPath(); x.moveTo(-20, 0); x.lineTo(20, 0); x.stroke(); }
    else if (o.type === 1) { x.fillStyle = "#e8eef4"; x.beginPath(); x.moveTo(-10, -28); x.lineTo(10, -28); x.quadraticCurveTo(26, 0, 12, 26); x.lineTo(-12, 26); x.quadraticCurveTo(-26, 0, -10, -28); x.fill(); x.strokeStyle = "#2a3a6a"; x.lineWidth = 2.5; x.stroke(); x.strokeStyle = "#3a5ab0"; x.beginPath(); x.arc(0, 2, 9, 0, 7); x.stroke(); }
    else { x.fillStyle = "#b08850"; x.fillRect(-22, -16, 44, 32); x.strokeStyle = "#4a3418"; x.lineWidth = 2.5; x.strokeRect(-22, -16, 44, 32); x.beginPath(); x.moveTo(-22, 0); x.lineTo(22, 0); x.stroke(); }
    x.restore();
  };
  R.boards = function (x, cx, n, broken, crackT) {
    var by = FLOOR, bw = 190;
    function block(px) { x.fillStyle = "#8c8a84"; x.fillRect(px, by - 90, 50, 90); x.strokeStyle = "#4a4844"; x.lineWidth = 2.5; x.strokeRect(px, by - 90, 50, 90); x.fillStyle = "#5c5a54"; x.fillRect(px + 10, by - 70, 30, 22); x.fillRect(px + 10, by - 38, 30, 22); }
    block(cx - bw / 2 - 10); block(cx + bw / 2 - 40);
    for (var i = 0; i < n; i++) {
      var y = by - 90 - (i + 1) * 13, isBroken = i >= n - broken;
      if (isBroken && crackT > 0) { var dd = Math.min(1, crackT * 3) * 40; x.save(); x.translate(cx - 4, y + 13 + dd * (1 + (n - i) * 0.12)); x.rotate(-0.35 * Math.min(1, crackT * 3)); x.fillStyle = "#d8b07a"; x.fillRect(-bw / 2, -13, bw / 2, 11); x.strokeStyle = "#7a5228"; x.lineWidth = 2; x.strokeRect(-bw / 2, -13, bw / 2, 11); x.restore();
        x.save(); x.translate(cx + 4, y + 13 + dd * (1 + (n - i) * 0.12)); x.rotate(0.35 * Math.min(1, crackT * 3)); x.fillStyle = "#d8b07a"; x.fillRect(0, -13, bw / 2, 11); x.strokeRect(0, -13, bw / 2, 11); x.restore(); continue; }
      x.fillStyle = i % 2 ? "#d8b07a" : "#ccA46c"; x.fillRect(cx - bw / 2, y, bw, 11); x.strokeStyle = "#7a5228"; x.lineWidth = 2; x.strokeRect(cx - bw / 2, y, bw, 11);
      x.strokeStyle = "rgba(122,82,40,0.4)"; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - bw / 2 + 10, y + 5); x.quadraticCurveTo(cx, y + 3 + (i % 3), cx + bw / 2 - 10, y + 6); x.stroke();
    }
  };

  // yin-yang point marker: 0 empty, 1 half, 2 full
  R.yinyang = function (x, cx, cy, r, v) {
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = "rgba(0,0,0,0.45)"; x.fill(); x.strokeStyle = "#e8d8a8"; x.lineWidth = 2; x.stroke();
    if (v > 0) {
      x.fillStyle = "#f6f2e6"; x.beginPath(); x.arc(cx, cy, r - 2, -Math.PI / 2, Math.PI / 2); x.arc(cx, cy + (r - 2) / 2, (r - 2) / 2, Math.PI / 2, -Math.PI / 2, true); x.arc(cx, cy - (r - 2) / 2, (r - 2) / 2, Math.PI / 2, -Math.PI / 2); x.fill();
      if (v > 1) { x.fillStyle = "#c41e1e"; x.beginPath(); x.arc(cx, cy, r - 2, Math.PI / 2, Math.PI * 1.5); x.arc(cx, cy - (r - 2) / 2, (r - 2) / 2, -Math.PI / 2, Math.PI / 2); x.arc(cx, cy + (r - 2) / 2, (r - 2) / 2, -Math.PI / 2, Math.PI / 2, true); x.fill(); }
      x.fillStyle = v > 1 ? "#f6f2e6" : "rgba(0,0,0,0.5)"; x.beginPath(); x.arc(cx, cy + (r - 2) / 2, (r - 2) / 6, 0, 7); x.fill();
      x.fillStyle = "#c41e1e"; x.beginPath(); x.arc(cx, cy - (r - 2) / 2, (r - 2) / 6, 0, 7); x.fill();
    }
    x.restore();
  };
})();

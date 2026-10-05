/*
 * Rampart tribute: renderer. Painted terrain, stone walls, castles, ships, smoke and weather,
 * all drawn procedurally on canvas at device resolution. Written by: Howie
 */
(function () {
  "use strict";
  var LV = window.RampartLevels;
  var TILE = 32;
  var THEMES = {
    spring: { g0: [62, 84, 42], g1: [92, 112, 56], g2: [48, 66, 34], sand: [196, 178, 138], wet: [150, 136, 104], sh: [58, 110, 112], dp: [18, 46, 70], stone: [148, 142, 130], tree: "oak", treeP: 0.5 },
    autumn: { g0: [92, 88, 46], g1: [128, 104, 50], g2: [70, 64, 36], sand: [190, 168, 126], wet: [144, 126, 96], sh: [62, 106, 102], dp: [22, 48, 60], stone: [150, 140, 124], tree: "autumn", treeP: 0.6 },
    sunset: { g0: [78, 88, 46], g1: [108, 108, 58], g2: [60, 66, 38], sand: [200, 172, 128], wet: [150, 128, 96], sh: [66, 104, 112], dp: [26, 42, 72], stone: [154, 138, 120], tree: "oak", treeP: 0.4 },
    moor: { g0: [70, 82, 56], g1: [90, 96, 70], g2: [88, 70, 82], sand: [170, 160, 132], wet: [124, 116, 96], sh: [64, 96, 100], dp: [24, 40, 52], stone: [128, 128, 124], tree: "pine", treeP: 0.4 },
    desert: { g0: [196, 164, 106], g1: [214, 184, 124], g2: [168, 134, 82], sand: [226, 206, 158], wet: [176, 156, 114], sh: [56, 136, 138], dp: [20, 70, 92], stone: [190, 166, 120], tree: "palm", treeP: 0.35 },
    night: { g0: [60, 84, 50], g1: [80, 104, 60], g2: [46, 66, 40], sand: [186, 170, 134], wet: [140, 128, 100], sh: [48, 92, 104], dp: [12, 30, 52], stone: [140, 138, 132], tree: "oak", treeP: 0.5 },
    snow: { g0: [222, 228, 234], g1: [204, 214, 224], g2: [176, 188, 200], sand: [168, 172, 170], wet: [128, 134, 136], sh: [72, 104, 120], dp: [22, 42, 60], stone: [140, 146, 152], tree: "snowpine", treeP: 0.5 },
    storm: { g0: [62, 80, 54], g1: [80, 96, 62], g2: [50, 64, 44], sand: [170, 160, 132], wet: [124, 118, 98], sh: [56, 84, 88], dp: [18, 32, 42], stone: [132, 132, 128], tree: "pine", treeP: 0.4 },
    ember: { g0: [74, 70, 48], g1: [92, 78, 50], g2: [52, 46, 36], sand: [150, 130, 104], wet: [110, 96, 80], sh: [48, 66, 72], dp: [16, 26, 34], stone: [122, 112, 102], tree: "dead", treeP: 0.35 }
  };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, k, a) { k = k == null ? 1 : k; return "rgba(" + (clamp(c[0] * k, 0, 255) | 0) + "," + (clamp(c[1] * k, 0, 255) | 0) + "," + (clamp(c[2] * k, 0, 255) | 0) + "," + (a == null ? 1 : a) + ")"; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mk(w, h) { var c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function H(x, y, s) { return LV.hash2(x, y, s || 0); }

  // ---------------------------------------------------------------- level art
  // Builds the static layers for a level: water (under), foam bands, and land (with alpha).
  function buildLevelArt(G, Q) {
    var g = G.grid, cols = g.cols, rows = g.rows, W = cols * TILE, Hh = rows * TILE;
    var th = THEMES[G.levelDef.theme] || THEMES.spring, seed = G.levelDef.seed;
    // blurred water field + water depth field
    var wf = new Float32Array(cols * rows), wb = new Float32Array(cols * rows), depth = new Float32Array(cols * rows);
    var i, x, y;
    for (i = 0; i < wf.length; i++) wf[i] = g.t[i] === 1 ? 1 : 0;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
      var s = 0, n = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var xx = clamp(x + dx, 0, cols - 1), yy = clamp(y + dy, 0, rows - 1); var w = (dx === 0 && dy === 0) ? 4 : (dx === 0 || dy === 0) ? 2 : 1;
        s += wf[yy * cols + xx] * w; n += w;
      }
      wb[y * cols + x] = s / n;
    }
    // depth: BFS distance of water from land
    var q = [], dd = new Int16Array(cols * rows).fill(999);
    for (i = 0; i < wf.length; i++) if (!wf[i]) { dd[i] = 0; q.push(i); }
    for (var h = 0; h < q.length; h++) {
      var c = q[h], cx = c % cols, cy = (c / cols) | 0;
      for (var k = 0; k < 4; k++) {
        var ax = cx + [1, -1, 0, 0][k], ay = cy + [0, 0, 1, -1][k]; if (ax < 0 || ay < 0 || ax >= cols || ay >= rows) continue;
        var j = ay * cols + ax; if (dd[j] > dd[c] + 1) { dd[j] = dd[c] + 1; q.push(j); }
      }
    }
    for (i = 0; i < depth.length; i++) depth[i] = Math.min(dd[i], 8);
    function bil(f, tx, ty) {
      tx = clamp(tx, 0, cols - 1); ty = clamp(ty, 0, rows - 1);
      var x0 = Math.floor(tx), y0 = Math.floor(ty), x1 = Math.min(x0 + 1, cols - 1), y1 = Math.min(y0 + 1, rows - 1), fx = tx - x0, fy = ty - y0;
      var a = f[y0 * cols + x0], b = f[y0 * cols + x1], c2 = f[y1 * cols + x0], d = f[y1 * cols + x1];
      return (a + (b - a) * fx) * (1 - fy) + (c2 + (d - c2) * fx) * fy;
    }
    var landC = mk(W, Hh), waterC = mk(W, Hh), foamC = mk(W, Hh), foam2C = mk(W, Hh);
    var lc = landC.getContext("2d"), wc = waterC.getContext("2d"), fc = foamC.getContext("2d"), f2 = foam2C.getContext("2d");
    var LI = lc.createImageData(W, Hh), WI = wc.createImageData(W, Hh), FI = fc.createImageData(W, Hh), F2 = f2.createImageData(W, Hh);
    var hgt = new Float32Array(W * Hh), edgeA = new Float32Array(W * Hh), n1A = new Float32Array(W * Hh), n2A = new Float32Array(W * Hh);
    var p;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      p = y * W + x;
      var tx = (x + 0.5) / TILE, ty = (y + 0.5) / TILE;
      var n1 = LV.fbm(tx * 0.3, ty * 0.3, seed), n2 = LV.vnoise(tx * 1.6, ty * 1.6, seed + 3), n3 = LV.vnoise(tx * 5, ty * 5, seed + 9);
      var e = bil(wb, tx - 0.5, ty - 0.5) + (n2 - 0.5) * 0.16 + (n3 - 0.5) * 0.04;
      edgeA[p] = e; n1A[p] = n1; n2A[p] = n2;
      hgt[p] = n1 * 0.6 + n2 * 0.3 + n3 * 0.1;
    }
    var light = [0.7, 0.55];
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      p = y * W + x;
      var e2 = edgeA[p], gr = H(x, y, seed) - 0.5, o = p * 4;
      // water (everywhere, under land)
      var tx2 = (x + 0.5) / TILE - 0.5, ty2 = (y + 0.5) / TILE - 0.5;
      var dep = clamp((bil(depth, tx2, ty2) - 0.3) / 5, 0, 1);
      dep = clamp(dep + (n2A[p] - 0.5) * 0.25, 0, 1);
      var wcol = mix(th.sh, th.dp, Math.pow(dep, 0.8));
      var wk = 1 + gr * 0.04 + (n1A[p] - 0.5) * 0.12;
      WI.data[o] = clamp(wcol[0] * wk, 0, 255); WI.data[o + 1] = clamp(wcol[1] * wk, 0, 255); WI.data[o + 2] = clamp(wcol[2] * wk, 0, 255); WI.data[o + 3] = 255;
      // foam bands just off the beach
      if (e2 >= 0.5 && e2 < 0.57) { var fa = (1 - (e2 - 0.5) / 0.07) * (0.55 + 0.45 * n2A[p]); FI.data[o] = 240; FI.data[o + 1] = 246; FI.data[o + 2] = 244; FI.data[o + 3] = clamp(fa * 230, 0, 255); }
      if (e2 >= 0.6 && e2 < 0.67) { var fb = Math.sin((e2 - 0.6) / 0.07 * Math.PI) * (0.4 + 0.6 * n1A[p]); F2.data[o] = 230; F2.data[o + 1] = 240; F2.data[o + 2] = 240; F2.data[o + 3] = clamp(fb * 150, 0, 255); }
      if (e2 >= 0.5) continue;
      // land
      var a = clamp((0.5 - e2) * 60, 0, 1);
      var hx = hgt[y * W + Math.min(x + 1, W - 1)] - hgt[y * W + Math.max(x - 1, 0)];
      var hy = hgt[Math.min(y + 1, Hh - 1) * W + x] - hgt[Math.max(y - 1, 0) * W + x];
      var shade = 1 - (hx * light[0] + hy * light[1]) * 9;
      var col = mix(th.g2, th.g0, smooth(0.25, 0.6, n1A[p]));
      col = mix(col, th.g1, smooth(0.45, 0.85, n2A[p]) * 0.7);
      var beach = smooth(0.3, 0.47, e2);
      col = mix(col, th.sand, beach);
      col = mix(col, th.wet, smooth(0.45, 0.5, e2) * 0.6);
      var kk = shade * (1 + gr * 0.09);
      LI.data[o] = clamp(col[0] * kk, 0, 255); LI.data[o + 1] = clamp(col[1] * kk, 0, 255); LI.data[o + 2] = clamp(col[2] * kk, 0, 255); LI.data[o + 3] = a * 255;
    }
    lc.putImageData(LI, 0, 0); wc.putImageData(WI, 0, 0); fc.putImageData(FI, 0, 0); f2.putImageData(F2, 0, 0);

    // upscale land to Q and paint details at full resolution
    var land = mk(W * Q, Hh * Q), L = land.getContext("2d");
    L.imageSmoothingEnabled = true; L.imageSmoothingQuality = "high";
    L.drawImage(landC, 0, 0, W * Q, Hh * Q);
    L.save(); L.scale(Q, Q);
    var R = LV.rng(seed * 31 + 5);
    // grass tufts, pebbles, flowers
    for (var t = 0; t < cols * rows * 1.6; t++) {
      var px = R() * W, py = R() * Hh, ti = ((py / TILE) | 0) * cols + ((px / TILE) | 0);
      if (g.t[ti] !== 0 || edgeA[((py | 0) * W) + (px | 0)] > 0.36) continue;
      var kind = R();
      if (G.levelDef.theme === "snow") {
        L.fillStyle = "rgba(150,165,185," + (0.25 + R() * 0.2) + ")"; L.beginPath(); L.ellipse(px, py, 2 + R() * 4, 1 + R() * 1.5, 0, 0, 7); L.fill();
      } else if (G.levelDef.theme === "desert") {
        L.strokeStyle = "rgba(120,92,50,0.35)"; L.lineWidth = 0.8; L.beginPath(); L.moveTo(px - 4, py); L.quadraticCurveTo(px, py - 2, px + 4, py); L.stroke();
      } else if (kind < 0.75) {
        var gc = mix(th.g2, [30, 40, 20], 0.4);
        L.strokeStyle = rgb(gc, 1, 0.5); L.lineWidth = 0.9;
        for (var b = 0; b < 4; b++) { var ang = -Math.PI / 2 + (R() - 0.5) * 1.3; L.beginPath(); L.moveTo(px, py); L.lineTo(px + Math.cos(ang) * (3 + R() * 3), py + Math.sin(ang) * (3 + R() * 3)); L.stroke(); }
      } else if (kind < 0.92) {
        L.fillStyle = "rgba(120,116,104,0.55)"; L.beginPath(); L.ellipse(px, py, 1.5 + R() * 1.5, 1 + R(), R() * 3, 0, 7); L.fill();
        L.fillStyle = "rgba(220,214,200,0.35)"; L.beginPath(); L.arc(px - 0.5, py - 0.5, 0.8, 0, 7); L.fill();
      } else if (G.levelDef.theme !== "ember" && G.levelDef.theme !== "storm") {
        L.fillStyle = ["rgba(210,200,120,0.7)", "rgba(200,190,210,0.6)", "rgba(220,220,220,0.6)"][(R() * 3) | 0];
        L.beginPath(); L.arc(px, py, 1, 0, 7); L.fill();
      }
    }
    if (G.levelDef.theme === "ember") { // scorched earth patches
      for (var sc = 0; sc < 30; sc++) { var sx = R() * W, sy = R() * Hh, rr = 10 + R() * 30, gg = L.createRadialGradient(sx, sy, 0, sx, sy, rr); gg.addColorStop(0, "rgba(20,14,10,0.45)"); gg.addColorStop(1, "rgba(20,14,10,0)"); L.fillStyle = gg; L.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
    }
    // rocks and trees on obstacle tiles
    var obs = [];
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (g.t[y * cols + x] === 2) obs.push([x, y]);
    obs.forEach(function (o2) { var tree = H(o2[0], o2[1], seed + 77) < th.treeP; drawObstacleShadow(L, o2[0], o2[1], tree, seed); });
    obs.forEach(function (o2) { var tree = H(o2[0], o2[1], seed + 77) < th.treeP; if (tree) drawTree(L, o2[0], o2[1], th, seed); else drawRock(L, o2[0], o2[1], th, seed); });
    L.restore();
    // land-only grain at Q for crispness
    var grain = mk(128, 128), gx = grain.getContext("2d"), gid = gx.createImageData(128, 128);
    for (i = 0; i < 128 * 128; i++) { var v = Math.random() < 0.5 ? 0 : 255; gid.data[i * 4] = gid.data[i * 4 + 1] = gid.data[i * 4 + 2] = v; gid.data[i * 4 + 3] = 10 + Math.random() * 14; }
    gx.putImageData(gid, 0, 0);
    L.globalCompositeOperation = "source-atop"; L.fillStyle = L.createPattern(grain, "repeat"); L.fillRect(0, 0, land.width, land.height); L.globalCompositeOperation = "source-over";

    G.art = { Q: Q, W: W, H: Hh, land: land, water: waterC, foam: foamC, foam2: foam2C, theme: th, dirty: true,
      dyn: mk(W * Q, (Hh + TILE) * Q), waves: makeWaves(), castle: {}, fog: G.levelDef.weather === "fog" ? makeFog() : null,
      flag: null, court: makeCourt(Q), wallTex: makeWallTex(Q, th), dark: null };
  }

  function drawObstacleShadow(L, x, y, tree) {
    var cx = x * TILE + 16, cy = y * TILE + 16;
    L.fillStyle = "rgba(10,14,8,0.32)"; L.beginPath(); L.ellipse(cx + 6, cy + 7, tree ? 15 : 13, tree ? 10 : 8, 0.4, 0, 7); L.fill();
  }
  function drawRock(L, x, y, th, seed) {
    var cx = x * TILE + 16, cy = y * TILE + 16, n = 2 + ((H(x, y, seed + 5) * 2) | 0);
    for (var k = 0; k < n; k++) {
      var ox = (H(x, y, seed + k * 11) - 0.5) * 14, oy = (H(y, x, seed + k * 13) - 0.5) * 12, r = 7 + H(x + k, y, seed) * 6;
      var base = th.tree === "palm" ? [168, 140, 100] : th.tree === "snowpine" ? [120, 126, 134] : [118, 114, 106];
      var gr = L.createRadialGradient(cx + ox - r * 0.4, cy + oy - r * 0.5, r * 0.1, cx + ox, cy + oy, r * 1.1);
      gr.addColorStop(0, rgb(base, 1.45)); gr.addColorStop(0.55, rgb(base, 1)); gr.addColorStop(1, rgb(base, 0.55));
      L.fillStyle = gr; L.beginPath();
      for (var a = 0; a < 7; a++) { var ang = a / 7 * Math.PI * 2, rr = r * (0.8 + H(x * 7 + a, y + k, seed) * 0.35); if (a === 0) L.moveTo(cx + ox + Math.cos(ang) * rr, cy + oy + Math.sin(ang) * rr * 0.85); else L.lineTo(cx + ox + Math.cos(ang) * rr, cy + oy + Math.sin(ang) * rr * 0.85); }
      L.closePath(); L.fill(); L.strokeStyle = "rgba(30,28,24,0.45)"; L.lineWidth = 0.8; L.stroke();
      L.strokeStyle = "rgba(40,36,30,0.4)"; L.beginPath(); L.moveTo(cx + ox - r * 0.3, cy + oy - r * 0.1); L.lineTo(cx + ox + r * 0.1, cy + oy + r * 0.25); L.stroke();
      if (th.tree === "snowpine") { L.fillStyle = "rgba(240,246,250,0.85)"; L.beginPath(); L.ellipse(cx + ox - r * 0.15, cy + oy - r * 0.35, r * 0.6, r * 0.35, -0.3, 0, 7); L.fill(); }
      else if (th.tree !== "palm") { L.fillStyle = "rgba(80,104,52,0.35)"; L.beginPath(); L.ellipse(cx + ox - r * 0.2, cy + oy - r * 0.4, r * 0.45, r * 0.25, -0.3, 0, 7); L.fill(); }
    }
  }
  function drawTree(L, x, y, th, seed) {
    var cx = x * TILE + 16 + (H(x, y, seed + 1) - 0.5) * 6, cy = y * TILE + 15 + (H(y, x, seed + 2) - 0.5) * 6, k, gr;
    var t = th.tree;
    if (t === "oak" || t === "autumn") {
      var base = t === "autumn" ? [[150, 84, 30], [176, 120, 40], [120, 60, 26]][(H(x, y, seed + 3) * 3) | 0] : [52, 82, 38];
      for (k = 0; k < 6; k++) {
        var a = k / 6 * Math.PI * 2 + H(x, y, k), rr = 6 + H(x + k, y, seed) * 3, ox = Math.cos(a) * 6, oy = Math.sin(a) * 5;
        gr = L.createRadialGradient(cx + ox - 3, cy + oy - 3, 1, cx + ox, cy + oy, rr + 2);
        gr.addColorStop(0, rgb(base, 1.55)); gr.addColorStop(0.6, rgb(base, 1)); gr.addColorStop(1, rgb(base, 0.6));
        L.fillStyle = gr; L.beginPath(); L.arc(cx + ox, cy + oy, rr, 0, 7); L.fill();
      }
      gr = L.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 9); gr.addColorStop(0, rgb(base, 1.7)); gr.addColorStop(1, rgb(base, 0.9));
      L.fillStyle = gr; L.beginPath(); L.arc(cx, cy, 8, 0, 7); L.fill();
    } else if (t === "pine" || t === "snowpine") {
      for (k = 3; k >= 0; k--) {
        var r2 = 4 + k * 3.4;
        L.fillStyle = rgb([34, 60, 40], 0.75 + (3 - k) * 0.12); L.beginPath();
        for (var s = 0; s < 16; s++) { var an = s / 16 * Math.PI * 2, rad = s % 2 ? r2 * 0.62 : r2; if (!s) L.moveTo(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad); else L.lineTo(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad); }
        L.closePath(); L.fill();
        if (t === "snowpine") { L.fillStyle = "rgba(236,242,248,0.8)"; L.beginPath(); L.arc(cx - r2 * 0.25, cy - r2 * 0.3, r2 * 0.45, 0, 7); L.fill(); }
      }
    } else if (t === "palm") {
      for (k = 0; k < 7; k++) {
        var pa = k / 7 * Math.PI * 2 + H(x, y, seed) * 2, len = 12 + H(x, k, seed) * 4;
        L.strokeStyle = "rgba(60,90,40,0.95)"; L.lineWidth = 3; L.beginPath(); L.moveTo(cx, cy);
        L.quadraticCurveTo(cx + Math.cos(pa) * len * 0.6 - Math.sin(pa) * 3, cy + Math.sin(pa) * len * 0.6 + Math.cos(pa) * 3, cx + Math.cos(pa) * len, cy + Math.sin(pa) * len); L.stroke();
        L.strokeStyle = "rgba(120,150,70,0.6)"; L.lineWidth = 1; L.stroke();
      }
      L.fillStyle = "#6b4a2a"; L.beginPath(); L.arc(cx, cy, 2.5, 0, 7); L.fill();
    } else { // dead tree
      L.strokeStyle = "#2a2018"; L.lineCap = "round";
      for (k = 0; k < 5; k++) { var da = k / 5 * Math.PI * 2 + H(x, y, k); L.lineWidth = 2.4; L.beginPath(); L.moveTo(cx, cy); var ex = cx + Math.cos(da) * 11, ey = cy + Math.sin(da) * 9; L.lineTo(ex, ey); L.stroke(); L.lineWidth = 1.2; L.beginPath(); L.moveTo(ex, ey); L.lineTo(ex + Math.cos(da + 0.6) * 5, ey + Math.sin(da + 0.6) * 5); L.stroke(); }
      L.fillStyle = "#3a2c20"; L.beginPath(); L.arc(cx, cy, 3, 0, 7); L.fill();
    }
  }

  function makeWaves() {
    var c = mk(256, 256), x = c.getContext("2d");
    x.lineCap = "round";
    for (var i = 0; i < 70; i++) {
      var px = Math.random() * 256, py = Math.random() * 256, w = 8 + Math.random() * 22;
      x.strokeStyle = "rgba(220,240,250," + (0.05 + Math.random() * 0.12) + ")"; x.lineWidth = 0.8 + Math.random() * 1.4;
      for (var ox = -256; ox <= 256; ox += 256) for (var oy = -256; oy <= 256; oy += 256) { x.beginPath(); x.moveTo(px + ox - w / 2, py + oy); x.quadraticCurveTo(px + ox, py + oy - 2.5, px + ox + w / 2, py + oy); x.stroke(); }
    }
    return c;
  }
  function makeFog() {
    var c = mk(160, 112), x = c.getContext("2d"), d = x.createImageData(160, 112);
    for (var j = 0; j < 112; j++) for (var i = 0; i < 160; i++) { var v = LV.fbm(i * 0.05, j * 0.05, 909); var o = (j * 160 + i) * 4; d.data[o] = d.data[o + 1] = d.data[o + 2] = 214; d.data[o + 3] = clamp((v - 0.25) * 330, 0, 210); }
    x.putImageData(d, 0, 0); return c;
  }
  // flagstone courtyard pattern that fills your territory
  function makeCourt(Q) {
    var S = 64, c = mk(S * Q, S * Q), x = c.getContext("2d"); x.scale(Q, Q);
    x.fillStyle = "#2c3e58"; x.fillRect(0, 0, S, S);
    var R = LV.rng(4242);
    for (var row = 0; row < 4; row++) {
      var ox = row % 2 ? -8 : 0;
      for (var col = -1; col < 5; col++) {
        var w = 16, bx = col * 16 + ox, by = row * 16, k = 0.85 + R() * 0.3;
        var gr = x.createLinearGradient(bx, by, bx + w, by + 16); gr.addColorStop(0, rgb([92, 112, 140], k * 1.08)); gr.addColorStop(1, rgb([70, 88, 116], k * 0.92));
        x.fillStyle = gr; x.beginPath(); roundRect(x, bx + 1, by + 1, w - 2, 14, 2.5); x.fill();
        x.fillStyle = "rgba(255,255,255,0.07)"; x.fillRect(bx + 2, by + 2, w - 4, 1.2);
      }
    }
    return c;
  }
  function makeWallTex(Q, th) {
    var S = 32, c = mk(S * Q, S * Q), x = c.getContext("2d"); x.scale(Q, Q);
    var st = th.stone; x.fillStyle = rgb(st, 0.62); x.fillRect(0, 0, S, S);
    var R = LV.rng(777);
    for (var row = 0; row < 4; row++) {
      var by = row * 8, bx = row % 2 ? -6 : 0;
      while (bx < S) {
        var w = 9 + ((R() * 7) | 0), k = 0.86 + R() * 0.28;
        var gr = x.createLinearGradient(0, by, 0, by + 8); gr.addColorStop(0, rgb(st, k * 1.15)); gr.addColorStop(1, rgb(st, k * 0.9));
        x.fillStyle = gr; x.fillRect(bx + 0.6, by + 0.6, w - 1.2, 6.8);
        x.fillStyle = "rgba(255,255,255,0.12)"; x.fillRect(bx + 0.6, by + 0.6, w - 1.2, 1);
        if (R() < 0.3) { x.fillStyle = "rgba(60,70,40,0.2)"; x.fillRect(bx + 1 + R() * w * 0.5, by + 4, 3, 3); }
        bx += w;
      }
    }
    return c;
  }
  function roundRect(x, a, b, w, h, r) { x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  // ---------------------------------------------------------------- dynamic static layer (territory, walls, rubble, craters)
  var WALL_H = 7;
  function buildDyn(G) {
    var A = G.art, g = G.grid, Q = A.Q, c = A.dyn, x = c.getContext("2d"), cols = g.cols, rows = g.rows;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    x.setTransform(Q, 0, 0, Q, 0, TILE * Q); // shifted down one tile so walls on row 0 have headroom
    var i, tx, ty;
    // territory courtyard fill
    var pat = x.createPattern(A.court, "repeat"); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / Q));
    x.globalAlpha = G.claimFlash > 0 ? 0.9 : 0.78; x.fillStyle = pat;
    x.beginPath();
    for (ty = 0; ty < rows; ty++) for (tx = 0; tx < cols; tx++) if (g.enclosed[ty * cols + tx]) x.rect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
    x.fill(); x.globalAlpha = 1;
    // territory rim
    x.strokeStyle = "rgba(140,180,235,0.55)"; x.lineWidth = 1.5; x.beginPath();
    for (ty = 0; ty < rows; ty++) for (tx = 0; tx < cols; tx++) {
      i = ty * cols + tx; if (!g.enclosed[i]) continue;
      if (tx > 0 && !g.enclosed[i - 1] && !g.wall[i - 1]) { x.moveTo(tx * TILE + 1, ty * TILE); x.lineTo(tx * TILE + 1, ty * TILE + TILE); }
      if (tx < cols - 1 && !g.enclosed[i + 1] && !g.wall[i + 1]) { x.moveTo(tx * TILE + TILE - 1, ty * TILE); x.lineTo(tx * TILE + TILE - 1, ty * TILE + TILE); }
    }
    x.stroke();
    // craters
    for (i = 0; i < g.crater.length; i++) if (g.crater[i]) {
      tx = i % cols; ty = (i / cols) | 0; var cx = tx * TILE + 16 + (H(tx, ty, 3) - 0.5) * 6, cy = ty * TILE + 16 + (H(ty, tx, 4) - 0.5) * 6;
      var gr = x.createRadialGradient(cx, cy, 1, cx, cy, 14); gr.addColorStop(0, "rgba(18,12,8,0.85)"); gr.addColorStop(0.55, "rgba(48,34,22,0.65)"); gr.addColorStop(0.8, "rgba(110,90,60,0.35)"); gr.addColorStop(1, "rgba(110,90,60,0)");
      x.fillStyle = gr; x.beginPath(); x.ellipse(cx, cy, 14, 12, 0, 0, 7); x.fill();
    }
    // rubble
    var st = A.theme.stone;
    for (i = 0; i < g.rubble.length; i++) if (g.rubble[i] && !g.wall[i]) {
      tx = i % cols; ty = (i / cols) | 0;
      x.fillStyle = "rgba(30,26,20,0.35)"; x.beginPath(); x.ellipse(tx * TILE + 17, ty * TILE + 18, 13, 10, 0, 0, 7); x.fill();
      for (var k = 0; k < 7; k++) {
        var rx = tx * TILE + 5 + H(tx * 9 + k, ty, 1) * 22, ry = ty * TILE + 5 + H(tx, ty * 9 + k, 2) * 22, rs = 2.5 + H(k, tx + ty, 3) * 4;
        x.fillStyle = rgb(st, 0.75 + H(k, tx, 5) * 0.4); x.save(); x.translate(rx, ry); x.rotate(H(tx, k, 6) * 3); x.fillRect(-rs / 2, -rs / 2.6, rs, rs / 1.3); x.fillStyle = "rgba(255,255,255,0.15)"; x.fillRect(-rs / 2, -rs / 2.6, rs, 1); x.restore();
      }
    }
    // wall shadows
    x.fillStyle = "rgba(8,10,6,0.38)";
    x.beginPath();
    for (i = 0; i < g.wall.length; i++) if (g.wall[i]) { tx = i % cols; ty = (i / cols) | 0; x.rect(tx * TILE + 5, ty * TILE + 3, TILE, TILE); }
    x.fill();
    // walls, back to front
    var tex = x.createPattern(A.wallTex, "repeat"); if (tex.setTransform) tex.setTransform(new DOMMatrix().scale(1 / Q));
    for (ty = 0; ty < rows; ty++) for (tx = 0; tx < cols; tx++) {
      i = ty * cols + tx; if (!g.wall[i]) continue;
      var L = tx > 0 && g.wall[i - 1], Rr = tx < cols - 1 && g.wall[i + 1], U = ty > 0 && g.wall[i - cols], D = ty < rows - 1 && g.wall[i + cols];
      var X = tx * TILE, Y = ty * TILE - WALL_H;
      // front face
      if (!D) {
        var fg = x.createLinearGradient(0, Y + TILE, 0, Y + TILE + WALL_H); fg.addColorStop(0, rgb(st, 0.62)); fg.addColorStop(1, rgb(st, 0.38));
        x.fillStyle = fg; x.fillRect(X, Y + TILE, TILE, WALL_H);
        x.fillStyle = "rgba(0,0,0,0.25)"; for (var j = 0; j < 4; j++) x.fillRect(X + j * 8 + (tx % 2) * 4, Y + TILE, 0.8, WALL_H);
      }
      // top face (textured)
      x.fillStyle = tex; x.fillRect(X, Y, TILE, TILE);
      // edge bevels
      x.fillStyle = "rgba(255,250,235,0.28)";
      if (!U) x.fillRect(X, Y, TILE, 2);
      if (!L) x.fillRect(X, Y, 2, TILE);
      x.fillStyle = "rgba(0,0,0,0.3)";
      if (!Rr) x.fillRect(X + TILE - 2, Y, 2, TILE);
      if (!D) x.fillRect(X, Y + TILE - 2, TILE, 2);
      // merlons on exposed edges
      x.fillStyle = rgb(st, 1.18);
      if (!U) for (var m = 0; m < 3; m++) x.fillRect(X + 3 + m * 10, Y - 2, 6, 4);
      if (!L) for (var m2 = 0; m2 < 3; m2++) x.fillRect(X - 1, Y + 3 + m2 * 10, 3, 6);
      if (!Rr) for (var m3 = 0; m3 < 3; m3++) x.fillRect(X + TILE - 2, Y + 3 + m3 * 10, 3, 6);
    }
    A.dirty = false;
  }

  // ---------------------------------------------------------------- sprites drawn live
  function drawCastle(x, G, c, k, t) {
    var A = G.art, owned = G.grid && window.RampartCore.castleEnclosed(G.grid, c), home = k === G.home;
    var X = c.x * TILE, Y = c.y * TILE, st = A.theme.stone, S = 64;
    x.save(); x.translate(X, Y);
    x.fillStyle = "rgba(6,8,4,0.42)"; x.beginPath(); roundRect(x, 8, 8, S, S, 8); x.fill();
    // curtain wall
    var gr = x.createLinearGradient(0, 0, S, S); gr.addColorStop(0, rgb(st, 1.2)); gr.addColorStop(1, rgb(st, 0.8));
    x.fillStyle = rgb(st, 0.5); x.fillRect(4, 10, S - 8, S - 8);
    x.fillStyle = gr; x.fillRect(4, 4, S - 8, S - 10);
    x.fillStyle = rgb(st, 0.55); x.fillRect(10, 10, S - 20, S - 22); // inner bailey
    x.fillStyle = owned ? "rgba(70,90,120,0.6)" : "rgba(80,70,50,0.5)"; x.fillRect(11, 11, S - 22, S - 24);
    // keep with pyramid roof
    var kx = 20, ky = 17, ks = 24;
    x.fillStyle = rgb(st, 0.5); x.fillRect(kx, ky + 4, ks, ks);
    x.fillStyle = rgb(st, 1.05); x.fillRect(kx, ky, ks, ks);
    var roof = owned ? [60, 78, 112] : [84, 66, 56];
    x.fillStyle = rgb(roof, 1.25); tri(x, kx + 2, ky + 2, kx + ks - 2, ky + 2, kx + ks / 2, ky + ks / 2);
    x.fillStyle = rgb(roof, 0.95); tri(x, kx + ks - 2, ky + 2, kx + ks - 2, ky + ks - 2, kx + ks / 2, ky + ks / 2);
    x.fillStyle = rgb(roof, 0.7); tri(x, kx + 2, ky + ks - 2, kx + ks - 2, ky + ks - 2, kx + ks / 2, ky + ks / 2);
    x.fillStyle = rgb(roof, 1.1); tri(x, kx + 2, ky + 2, kx + 2, ky + ks - 2, kx + ks / 2, ky + ks / 2);
    // gate
    x.fillStyle = "#2a1c10"; x.fillRect(S / 2 - 5, S - 10, 10, 6);
    // crenellations on the curtain
    x.fillStyle = rgb(st, 1.35);
    for (var m = 0; m < 6; m++) { x.fillRect(8 + m * 9, 2, 5, 3); x.fillRect(8 + m * 9, S - 9, 5, 3); }
    // round towers
    [[6, 6], [S - 6, 6], [6, S - 8], [S - 6, S - 8]].forEach(function (p) {
      x.fillStyle = rgb(st, 0.45); x.beginPath(); x.arc(p[0], p[1] + 4, 9, 0, 7); x.fill();
      var tg = x.createRadialGradient(p[0] - 3, p[1] - 3, 1, p[0], p[1], 9); tg.addColorStop(0, rgb(st, 1.35)); tg.addColorStop(1, rgb(st, 0.8));
      x.fillStyle = tg; x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fill();
      x.fillStyle = rgb(st, 0.45); x.beginPath(); x.arc(p[0], p[1], 5.5, 0, 7); x.fill();
      x.fillStyle = rgb(st, 1.3); for (var a = 0; a < 8; a++) { var an = a / 8 * Math.PI * 2; x.fillRect(p[0] + Math.cos(an) * 7.5 - 1.3, p[1] + Math.sin(an) * 7.5 - 1.3, 2.6, 2.6); }
    });
    // flag on the keep
    var fx = kx + ks / 2, fy = ky + ks / 2;
    x.strokeStyle = "#2a2018"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx, fy - 22); x.stroke();
    var fcol = home ? "#c8a23a" : owned ? "#3c64a8" : "#6c6a64";
    x.fillStyle = fcol; x.beginPath(); x.moveTo(fx, fy - 22);
    for (var s = 0; s <= 6; s++) { var u = s / 6; x.lineTo(fx + u * 16, fy - 22 + Math.sin(t * 6 + u * 4 + k) * 1.6 * u); }
    for (var s2 = 6; s2 >= 0; s2--) { var u2 = s2 / 6; x.lineTo(fx + u2 * 16, fy - 13 + Math.sin(t * 6 + u2 * 4 + k) * 1.6 * u2); }
    x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,0.35)"; x.lineWidth = 0.6; x.stroke();
    if (home) { x.fillStyle = "#1b2c4c"; x.beginPath(); x.arc(fx + 7, fy - 17.5, 2.4, 0, 7); x.fill(); }
    x.restore();
  }
  function tri(x, a, b, c, d, e, f) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.lineTo(e, f); x.closePath(); x.fill(); }

  function drawCannon(x, G, cn, t) {
    var X = cn.x * TILE + 32, Y = cn.y * TILE + 32;
    x.save(); x.translate(X, Y);
    x.fillStyle = "rgba(6,8,4,0.4)"; x.beginPath(); x.arc(4, 5, 26, 0, 7); x.fill();
    // earthwork ring of gabions
    for (var k = 0; k < 14; k++) {
      var a = k / 14 * Math.PI * 2, gx = Math.cos(a) * 22, gy = Math.sin(a) * 22;
      var gr = x.createRadialGradient(gx - 2, gy - 2, 0.5, gx, gy, 6); gr.addColorStop(0, "#8a6a42"); gr.addColorStop(1, "#4a3420");
      x.fillStyle = gr; x.beginPath(); x.arc(gx, gy, 5.5, 0, 7); x.fill();
      x.strokeStyle = "rgba(30,20,10,0.6)"; x.lineWidth = 0.6; x.stroke();
    }
    // plank platform
    var pg = x.createRadialGradient(-6, -6, 2, 0, 0, 19); pg.addColorStop(0, "#9a7a52"); pg.addColorStop(1, "#5e4528");
    x.fillStyle = pg; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill();
    x.strokeStyle = "rgba(40,26,12,0.45)"; x.lineWidth = 0.7; for (var p = -15; p <= 15; p += 5) { var hw = Math.sqrt(Math.max(0, 324 - p * p)); x.beginPath(); x.moveTo(-hw, p); x.lineTo(hw, p); x.stroke(); }
    // carriage + barrel
    x.rotate(cn.ang);
    var rec = cn.recoil || 0;
    x.fillStyle = "#3e2a16"; x.fillRect(-12 - rec, -9, 18, 18);
    x.fillStyle = "#1e1a16"; x.fillRect(-8 - rec, -11, 6, 3); x.fillRect(-8 - rec, 8, 6, 3); x.fillRect(0 - rec, -11, 5, 3); x.fillRect(0 - rec, 8, 5, 3);
    var bg = x.createLinearGradient(0, -6, 0, 6);
    var dead = cn.active ? 0 : 1;
    bg.addColorStop(0, dead ? "#5a5a56" : "#4a3a1a"); bg.addColorStop(0.35, dead ? "#a8a8a0" : "#d8b060"); bg.addColorStop(1, dead ? "#3a3a36" : "#5a4214");
    x.fillStyle = bg; x.beginPath(); roundRect(x, -14 - rec, -5.5, 36, 11, 5); x.fill();
    x.fillStyle = dead ? "#4a4a46" : "#6a4e18"; x.fillRect(19 - rec, -6.5, 4, 13); x.fillRect(-4 - rec, -6, 2.5, 12);
    x.fillStyle = "#120c06"; x.beginPath(); x.arc(22.5 - rec, 0, 3, 0, 7); x.fill();
    x.restore();
    if (cn.hp < 3) { // cracks / smoke hint
      x.fillStyle = "rgba(20,16,12,0.5)"; x.beginPath(); x.arc(X + 8, Y - 6, 3 + (3 - cn.hp), 0, 7); x.fill();
    }
    if (!cn.active) { x.fillStyle = "rgba(20,20,20,0.25)"; x.beginPath(); x.arc(X, Y, 27, 0, 7); x.fill(); }
  }

  function hullPath(x, L, B, bowSharp) {
    x.beginPath(); x.moveTo(L / 2, 0);
    x.bezierCurveTo(L / 2 - L * 0.12, -B * 0.42 * bowSharp, L * 0.12, -B / 2, -L * 0.1, -B / 2);
    x.lineTo(-L / 2 + B * 0.18, -B * 0.46); x.quadraticCurveTo(-L / 2, -B * 0.42, -L / 2, 0);
    x.quadraticCurveTo(-L / 2, B * 0.42, -L / 2 + B * 0.18, B * 0.46); x.lineTo(-L * 0.1, B / 2);
    x.bezierCurveTo(L * 0.12, B / 2, L / 2 - L * 0.12, B * 0.42 * bowSharp, L / 2, 0); x.closePath();
  }
  function drawShip(x, s, t, alpha) {
    var D = s.def, L = D.len * TILE, B = D.beam * TILE * 1.05, sink = s.sink || 0;
    x.save(); x.translate(s.x * TILE, s.y * TILE); x.rotate(s.ang);
    x.globalAlpha = alpha * (1 - sink * 0.85);
    var sc = 1 - sink * 0.25; x.scale(sc, sc);
    var roll = Math.sin(t * 1.7 + s.seed) * 0.04;
    // shadow on water
    x.fillStyle = "rgba(0,10,20,0.35)"; x.save(); x.translate(4, 5); hullPath(x, L, B, 1); x.fill(); x.restore();
    var iron = D.funnel, barge = D.troops;
    var hg = x.createLinearGradient(0, -B / 2, 0, B / 2);
    if (iron) { hg.addColorStop(0, "#2a2e32"); hg.addColorStop(0.5 + roll, "#5c6268"); hg.addColorStop(1, "#202428"); }
    else { hg.addColorStop(0, "#2e1c0e"); hg.addColorStop(0.5 + roll, "#6e4c2a"); hg.addColorStop(1, "#24160a"); }
    x.fillStyle = hg; hullPath(x, L, B, barge ? 0.2 : 1); x.fill();
    x.strokeStyle = iron ? "#16181a" : "#1a0f06"; x.lineWidth = 1; x.stroke();
    // deck
    x.save(); x.scale(0.82, 0.74); x.fillStyle = iron ? "#6a7076" : barge ? "#7a6040" : "#9c7a4e"; hullPath(x, L, B, barge ? 0.2 : 1); x.fill(); x.restore();
    if (!iron) { x.strokeStyle = "rgba(50,30,14,0.4)"; x.lineWidth = 0.6; for (var pl = -2; pl <= 2; pl++) { x.beginPath(); x.moveTo(-L * 0.38, pl * B * 0.12); x.lineTo(L * 0.34, pl * B * 0.12); x.stroke(); } }
    // gunports
    if (!barge && !iron) { x.fillStyle = "#120a04"; var gp = Math.max(2, Math.round(D.len * 2)); for (var g2 = 0; g2 < gp; g2++) { var gx = -L * 0.32 + g2 * (L * 0.6 / Math.max(1, gp - 1)); x.fillRect(gx - 1.5, -B / 2 + 1, 3, 2); x.fillRect(gx - 1.5, B / 2 - 3, 3, 2); } }
    // stern castle on big ships
    if (D.len >= 2.4 && !iron) { x.fillStyle = "#5a3a1c"; x.fillRect(-L / 2 + 3, -B * 0.32, L * 0.18, B * 0.64); x.strokeStyle = D.boss ? "#d4a840" : "#8a6a3a"; x.lineWidth = 1; x.strokeRect(-L / 2 + 3, -B * 0.32, L * 0.18, B * 0.64); }
    if (iron) {
      x.fillStyle = "#3a3e42"; x.beginPath(); x.arc(L * 0.18, 0, B * 0.28, 0, 7); x.fill(); x.fillStyle = "#24282a"; x.fillRect(L * 0.18, -2, L * 0.25, 4);
      x.fillStyle = "#141414"; x.beginPath(); x.ellipse(-L * 0.08, 0, B * 0.16, B * 0.2, 0, 0, 7); x.fill();
      x.fillStyle = "#7a2020"; x.fillRect(-L * 0.08 - B * 0.16, -1, B * 0.32, 2);
    }
    if (barge) { // troops
      x.fillStyle = "#7a1c1c"; for (var tr = 0; tr < (s.troops || 0); tr++) { x.beginPath(); x.arc(-L * 0.2 + tr * L * 0.18, (tr % 2 ? 1 : -1) * B * 0.15, 2.6, 0, 7); x.fill(); }
      x.fillStyle = "#c8b890"; for (var tr2 = 0; tr2 < (s.troops || 0); tr2++) { x.beginPath(); x.arc(-L * 0.2 + tr2 * L * 0.18, (tr2 % 2 ? 1 : -1) * B * 0.15, 1.1, 0, 7); x.fill(); }
    }
    // masts and sails
    for (var mi = 0; mi < D.masts; mi++) {
      var mx = D.masts === 1 ? L * 0.05 : L * (0.28 - mi * (0.56 / (D.masts - 1)));
      var sw = B * (1.25 - (mi === 0 && D.masts > 1 ? 0.15 : 0)) * (D.boss ? 1.1 : 1), billow = 4 + Math.sin(t * 2 + mi + s.seed) * 1.2;
      x.fillStyle = "rgba(0,0,0,0.25)"; x.beginPath(); x.moveTo(mx + 3, -sw / 2 + 4); x.quadraticCurveTo(mx + billow + 6, 4, mx + 3, sw / 2 + 4); x.lineTo(mx, sw / 2 + 4); x.quadraticCurveTo(mx + billow * 0.5 + 3, 4, mx, -sw / 2 + 4); x.fill();
      var sg = x.createLinearGradient(mx, 0, mx + billow + 4, 0); sg.addColorStop(0, D.boss ? "#3a1414" : "#b8ac90"); sg.addColorStop(1, D.boss ? "#6a2020" : "#ece2c8");
      x.fillStyle = sg; x.beginPath(); x.moveTo(mx, -sw / 2); x.quadraticCurveTo(mx + billow + 3, 0, mx, sw / 2); x.lineTo(mx - 2.5, sw / 2); x.quadraticCurveTo(mx + billow * 0.5, 0, mx - 2.5, -sw / 2); x.closePath(); x.fill();
      x.strokeStyle = "rgba(60,40,20,0.6)"; x.lineWidth = 0.7; x.stroke();
      x.strokeStyle = "#3a2a18"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(mx - 1, -sw / 2 - 1); x.lineTo(mx - 1, sw / 2 + 1); x.stroke();
      x.fillStyle = "#2a1a0c"; x.beginPath(); x.arc(mx + 1, 0, 1.8, 0, 7); x.fill();
      x.strokeStyle = "rgba(30,20,10,0.35)"; x.lineWidth = 0.4; x.beginPath(); x.moveTo(mx, -sw / 2); x.lineTo(L / 2 - 2, 0); x.lineTo(mx, sw / 2); x.stroke();
    }
    // ensign at the stern
    x.fillStyle = D.boss ? "#d4a840" : "#7a1c1c"; x.beginPath(); x.moveTo(-L / 2 + 2, 0); x.lineTo(-L / 2 - 8, -2 + Math.sin(t * 7 + s.seed) * 1.5); x.lineTo(-L / 2 - 7, 3 + Math.sin(t * 7 + s.seed) * 1.5); x.closePath(); x.fill();
    // damage glow
    if (s.hp < s.def.hp * 0.5 && !sink) { x.globalCompositeOperation = "lighter"; var fg = x.createRadialGradient(-L * 0.1, B * 0.1, 0, -L * 0.1, B * 0.1, 8); fg.addColorStop(0, "rgba(255,170,60,0.8)"); fg.addColorStop(1, "rgba(255,80,0,0)"); x.fillStyle = fg; x.beginPath(); x.arc(-L * 0.1, B * 0.1, 8 + Math.sin(t * 20) * 1.5, 0, 7); x.fill(); x.globalCompositeOperation = "source-over"; }
    x.restore();
    // health pips for armored / boss ships
    if (!sink && s.def.hp >= 4) {
      var w = Math.min(60, s.def.hp * 5), hx = s.x * TILE - w / 2, hy = s.y * TILE - D.beam * TILE - 6;
      x.fillStyle = "rgba(0,0,0,0.5)"; x.fillRect(hx - 1, hy - 1, w + 2, 5); x.fillStyle = s.def.boss ? "#d4a840" : "#c84a3a"; x.fillRect(hx, hy, w * s.hp / s.def.hp, 3);
    }
  }

  function drawGrunt(x, gr, t) {
    var X = gr.x * TILE + 16, Y = gr.y * TILE + 16, bob = Math.sin(t * 10 + gr.seed) * (gr.moving ? 1.2 : 0.3);
    x.fillStyle = "rgba(0,0,0,0.35)"; x.beginPath(); x.ellipse(X + 2, Y + 7, 6, 3, 0, 0, 7); x.fill();
    x.fillStyle = "#5a1414"; x.beginPath(); x.ellipse(X, Y + bob, 5, 6, 0, 0, 7); x.fill();
    x.fillStyle = "#8a2a20"; x.beginPath(); x.ellipse(X - 1, Y - 1 + bob, 3.5, 4, 0, 0, 7); x.fill();
    x.fillStyle = "#2a2a2a"; x.beginPath(); x.arc(X, Y - 5 + bob, 3, 0, 7); x.fill();
    x.strokeStyle = "#9a9a9a"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X + 4, Y + bob); x.lineTo(X + 8, Y - 7 + bob); x.stroke();
    if (gr.chip > 0) { x.strokeStyle = "rgba(255,220,140," + (0.5 + 0.5 * Math.sin(t * 20)) + ")"; x.beginPath(); x.arc(X, Y, 10, -Math.PI / 2, -Math.PI / 2 + gr.chip / 5 * Math.PI * 2); x.stroke(); }
  }

  // ---------------------------------------------------------------- frame
  function drawWorld(x, G, t) {
    var A = G.art, W = A.W, Hh = A.H;
    if (A.dirty) buildDyn(G);
    // water + waves + foam
    x.drawImage(A.water, 0, 0, W, Hh);
    var pat = x.createPattern(A.waves, "repeat");
    var drift = G.levelDef.weather === "storm" ? 26 : 10;
    x.save(); x.globalAlpha = 0.7; x.translate((t * drift) % 256, (t * drift * 0.4) % 256); x.fillStyle = pat; x.fillRect(-256, -256, W + 512, Hh + 512); x.restore();
    x.save(); x.globalAlpha = 0.45; x.translate(-(t * drift * 0.6) % 256, (t * drift * 0.7) % 256); x.scale(1.6, 1.6); x.fillStyle = pat; x.fillRect(-256, -256, W, Hh); x.restore();
    x.globalAlpha = 0.55 + 0.35 * Math.sin(t * 1.3); x.drawImage(A.foam, 0, 0, W, Hh);
    x.globalAlpha = 0.5 + 0.45 * Math.sin(t * 1.3 + 2.2); x.drawImage(A.foam2, 0, 0, W, Hh); x.globalAlpha = 1;
    // wakes and water particles below the land
    drawParts(x, G, t, 0);
    x.drawImage(A.land, 0, 0, W, Hh);
    x.drawImage(A.dyn, 0, -TILE, W, Hh + TILE);
    if (G.claimFlash > 0) { x.save(); x.globalAlpha = G.claimFlash * 0.5; x.globalCompositeOperation = "lighter"; x.drawImage(A.dyn, 0, -TILE, W, Hh + TILE); x.restore(); }
    // fires on tiles
    var g = G.grid;
    for (var i = 0; i < g.fire.length; i++) if (g.fire[i] > 0) {
      var tx = i % g.cols, ty = (i / g.cols) | 0, fx = tx * TILE + 16, fy = ty * TILE + 18;
      x.save(); x.globalCompositeOperation = "lighter";
      for (var f = 0; f < 3; f++) { var fl = Math.sin(t * 13 + f * 2 + i) * 2, rg = x.createRadialGradient(fx + (f - 1) * 6, fy - 4 + fl, 0, fx + (f - 1) * 6, fy - 4 + fl, 9); rg.addColorStop(0, "rgba(255,220,120,0.9)"); rg.addColorStop(0.4, "rgba(255,120,30,0.6)"); rg.addColorStop(1, "rgba(160,30,0,0)"); x.fillStyle = rg; x.beginPath(); x.arc(fx + (f - 1) * 6, fy - 4 + fl, 9, 0, 7); x.fill(); }
      x.restore();
    }
    G.castles.forEach(function (c, k) { drawCastle(x, G, c, k, t); });
    G.cannons.forEach(function (c) { drawCannon(x, G, c, t); });
    G.grunts.forEach(function (gr) { drawGrunt(x, gr, t); });
    var fog = G.levelDef.weather === "fog";
    G.ships.forEach(function (s) { drawShip(x, s, t, fog ? s.vis : 1); });
    // projectiles: shadows then balls
    G.balls.forEach(function (b) {
      var p = b.t / b.T, bx = b.x0 + (b.x1 - b.x0) * p, by = b.y0 + (b.y1 - b.y0) * p, hgt = Math.sin(p * Math.PI) * b.peak;
      x.fillStyle = "rgba(0,0,0," + (0.35 - hgt / 400) + ")"; x.beginPath(); x.ellipse(bx * TILE, by * TILE, 3.5, 2.2, 0, 0, 7); x.fill();
    });
    G.balls.forEach(function (b) {
      var p = b.t / b.T, bx = b.x0 + (b.x1 - b.x0) * p, by = b.y0 + (b.y1 - b.y0) * p, hgt = Math.sin(p * Math.PI) * b.peak, r = 3.2 + hgt / 28;
      var px = bx * TILE, py = by * TILE - hgt;
      if (b.fire) { x.save(); x.globalCompositeOperation = "lighter"; var fg = x.createRadialGradient(px, py, 0, px, py, r * 3); fg.addColorStop(0, "rgba(255,200,90,0.9)"); fg.addColorStop(1, "rgba(255,60,0,0)"); x.fillStyle = fg; x.beginPath(); x.arc(px, py, r * 3, 0, 7); x.fill(); x.restore(); }
      var bg = x.createRadialGradient(px - r * 0.35, py - r * 0.35, 0.3, px, py, r); bg.addColorStop(0, b.enemy ? "#8a7a6a" : "#9a9aa0"); bg.addColorStop(1, "#141414");
      x.fillStyle = bg; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    });
    drawParts(x, G, t, 1);
  }

  function drawParts(x, G, t, layer) {
    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i]; if (layer === 0 ? p.layer !== 0 : p.layer === 0) continue;
      var life = p.age / p.life, a = 1 - life;
      var px = p.x * TILE, py = p.y * TILE - (p.z || 0);
      switch (p.k) {
        case "smoke": var r = p.r0 + (p.r1 - p.r0) * life; x.fillStyle = "rgba(" + p.c + "," + (a * p.a) + ")"; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); break;
        case "fire": x.save(); x.globalCompositeOperation = "lighter"; var fr = p.r0 * (1 - life * 0.6), fg = x.createRadialGradient(px, py, 0, px, py, fr); fg.addColorStop(0, "rgba(255,230,160," + a + ")"); fg.addColorStop(0.4, "rgba(255,130,40," + a * 0.8 + ")"); fg.addColorStop(1, "rgba(200,40,0,0)"); x.fillStyle = fg; x.beginPath(); x.arc(px, py, fr, 0, 7); x.fill(); x.restore(); break;
        case "debris": x.fillStyle = "rgba(" + p.c + "," + Math.min(1, a * 2) + ")"; x.fillRect(px - p.r0 / 2, py - p.r0 / 2, p.r0, p.r0 * 0.7); break;
        case "drop": x.fillStyle = "rgba(225,240,250," + a * 0.9 + ")"; x.beginPath(); x.arc(px, py, p.r0, 0, 7); x.fill(); break;
        case "ring": x.strokeStyle = "rgba(230,245,250," + a * 0.7 + ")"; x.lineWidth = 1.5; x.beginPath(); x.ellipse(px, py, p.r0 + life * p.r1, (p.r0 + life * p.r1) * 0.7, 0, 0, 7); x.stroke(); break;
        case "wake": x.fillStyle = "rgba(225,238,240," + a * 0.32 + ")"; x.beginPath(); x.arc(px, py, p.r0 + life * p.r1, 0, 7); x.fill(); break;
        case "spark": x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255,210,120," + a + ")"; x.fillRect(px - 1, py - 1, 2.2, 2.2); x.restore(); break;
        case "flash": x.save(); x.globalCompositeOperation = "lighter"; var fl = x.createRadialGradient(px, py, 0, px, py, p.r0); fl.addColorStop(0, "rgba(255,240,200," + a + ")"); fl.addColorStop(0.3, "rgba(255,170,60," + a * 0.7 + ")"); fl.addColorStop(1, "rgba(255,80,0,0)"); x.fillStyle = fl; x.beginPath(); x.arc(px, py, p.r0, 0, 7); x.fill(); x.restore(); break;
        case "text": x.font = "700 " + p.r0 + "px Georgia, 'Times New Roman', serif"; x.textAlign = "center"; x.fillStyle = "rgba(0,0,0," + a * 0.6 + ")"; x.fillText(p.s, px + 1.5, py + 1.5); x.fillStyle = "rgba(" + p.c + "," + a + ")"; x.fillText(p.s, px, py); break;
      }
    }
  }

  // weather + lighting overlays (map space)
  function drawWeather(x, G, t, W, Hh) {
    var w = G.levelDef.weather, A = G.art;
    if (!G.wx) G.wx = { flakes: [], cloud: [], flash: 0, nextFlash: 4 };
    var X = G.wx;
    if (!X.cloud.length) for (var c = 0; c < 5; c++) X.cloud.push({ x: Math.random() * W, y: Math.random() * Hh, r: 120 + Math.random() * 160 });
    if (w !== "night" && w !== "fog") {
      X.cloud.forEach(function (cl) {
        cl.x += (w === "storm" ? 40 : 12) / 60; if (cl.x - cl.r > W) cl.x = -cl.r;
        var gr = x.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r); gr.addColorStop(0, "rgba(0,10,20," + (w === "storm" ? 0.2 : 0.11) + ")"); gr.addColorStop(1, "rgba(0,10,20,0)");
        x.fillStyle = gr; x.fillRect(cl.x - cl.r, cl.y - cl.r, cl.r * 2, cl.r * 2);
      });
    }
    var n, i, f;
    if (w === "snow" || w === "leaves" || w === "embers" || w === "storm" || w === "heat") {
      n = w === "storm" ? 260 : w === "snow" ? 180 : w === "heat" ? 40 : 60;
      while (X.flakes.length < n) X.flakes.push({ x: Math.random() * W, y: Math.random() * Hh, s: Math.random(), r: Math.random() * 6.28 });
      for (i = 0; i < X.flakes.length; i++) {
        f = X.flakes[i];
        if (w === "storm") { f.x += 7; f.y += 16; x.strokeStyle = "rgba(190,210,230,0.32)"; x.lineWidth = 1; x.beginPath(); x.moveTo(f.x, f.y); x.lineTo(f.x - 7, f.y - 16); x.stroke(); }
        else if (w === "snow") { f.x += Math.sin(t + f.r) * 0.4 + 0.3; f.y += 0.5 + f.s * 0.9; x.fillStyle = "rgba(255,255,255," + (0.5 + f.s * 0.4) + ")"; x.beginPath(); x.arc(f.x, f.y, 1 + f.s * 1.8, 0, 7); x.fill(); }
        else if (w === "leaves") { f.x += 0.6 + Math.sin(t * 2 + f.r) * 0.6; f.y += 0.4 + f.s * 0.5; f.r += 0.03; x.save(); x.translate(f.x, f.y); x.rotate(f.r); x.fillStyle = ["rgba(170,90,30,0.8)", "rgba(190,140,40,0.8)", "rgba(130,50,20,0.8)"][i % 3]; x.beginPath(); x.ellipse(0, 0, 3.5, 1.8, 0, 0, 7); x.fill(); x.restore(); }
        else if (w === "embers") { f.y -= 0.4 + f.s * 0.8; f.x += Math.sin(t * 1.5 + f.r) * 0.5; x.save(); x.globalCompositeOperation = "lighter"; x.fillStyle = "rgba(255," + (120 + f.s * 80 | 0) + ",40," + (0.4 + 0.5 * Math.sin(t * 5 + f.r)) + ")"; x.fillRect(f.x, f.y, 2, 2); x.restore(); }
        else if (w === "heat") { f.y -= 0.15; f.x += 0.2; x.fillStyle = "rgba(255,240,200,0.25)"; x.fillRect(f.x, f.y, 1.5, 1.5); }
        if (f.y > Hh + 20) { f.y = -20; f.x = Math.random() * W; } if (f.y < -20) { f.y = Hh + 10; f.x = Math.random() * W; } if (f.x > W + 20) f.x = -20;
      }
    }
    if (w === "fog" && A.fog) {
      x.save(); x.globalAlpha = 0.5; var ox = (t * 8) % W;
      x.drawImage(A.fog, ox, 0, W, Hh); x.drawImage(A.fog, ox - W, 0, W, Hh);
      x.globalAlpha = 0.22; x.drawImage(A.fog, -ox * 0.5, 0, W * 1.5, Hh * 1.5); x.drawImage(A.fog, -ox * 0.5 + W * 1.5, 0, W * 1.5, Hh * 1.5); x.restore();
    }
    if (w === "storm") {
      X.nextFlash -= 1 / 60; if (X.nextFlash < 0) { X.flash = 1; X.nextFlash = 6 + Math.random() * 9; if (G.onThunder) G.onThunder(); }
      x.fillStyle = "rgba(10,20,30,0.22)"; x.fillRect(0, 0, W, Hh);
      if (X.flash > 0) { x.fillStyle = "rgba(230,240,255," + X.flash * 0.45 + ")"; x.fillRect(0, 0, W, Hh); X.flash -= 0.06; }
    }
    if (w === "sunset") {
      var sg = x.createLinearGradient(0, 0, W, Hh); sg.addColorStop(0, "rgba(255,150,60,0.22)"); sg.addColorStop(0.6, "rgba(200,70,60,0.12)"); sg.addColorStop(1, "rgba(60,30,90,0.25)");
      x.fillStyle = sg; x.fillRect(0, 0, W, Hh);
    }
    if (w === "heat") { x.fillStyle = "rgba(255,200,120,0.08)"; x.fillRect(0, 0, W, Hh); }
    if (w === "leaves") { x.fillStyle = "rgba(255,170,80,0.06)"; x.fillRect(0, 0, W, Hh); }
    if (w === "snow") { x.fillStyle = "rgba(200,220,255,0.06)"; x.fillRect(0, 0, W, Hh); }
    if (w === "embers") { var eg = x.createRadialGradient(W / 2, Hh / 2, Hh * 0.3, W / 2, Hh / 2, W * 0.7); eg.addColorStop(0, "rgba(80,10,0,0)"); eg.addColorStop(1, "rgba(80,14,0,0.4)"); x.fillStyle = eg; x.fillRect(0, 0, W, Hh); }
    if (w === "night") drawNight(x, G, t, W, Hh);
  }
  function drawNight(x, G, t, W, Hh) {
    var A = G.art;
    if (!A.dark) A.dark = mk(W / 2, Hh / 2);
    var d = A.dark.getContext("2d");
    d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = "source-over"; d.clearRect(0, 0, A.dark.width, A.dark.height);
    d.fillStyle = "rgba(4,10,30,0.62)"; d.fillRect(0, 0, A.dark.width, A.dark.height);
    d.scale(0.5, 0.5); d.globalCompositeOperation = "destination-out";
    function hole(px, py, r, s) { var gr = d.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, "rgba(0,0,0," + s + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = gr; d.beginPath(); d.arc(px, py, r, 0, 7); d.fill(); }
    G.castles.forEach(function (c) { hole(c.x * TILE + 32, c.y * TILE + 32, 110, 0.8); });
    G.cannons.forEach(function (c) { hole(c.x * TILE + 32, c.y * TILE + 32, 60, 0.6); });
    G.ships.forEach(function (s) { hole(s.x * TILE, s.y * TILE, 46 + Math.sin(t * 3 + s.seed) * 4, 0.75); });
    G.parts.forEach(function (p) { if (p.k === "flash" || p.k === "fire") hole(p.x * TILE, p.y * TILE, 70, 0.7); });
    var g = G.grid; for (var i = 0; i < g.fire.length; i++) if (g.fire[i] > 0) hole((i % g.cols) * TILE + 16, ((i / g.cols) | 0) * TILE + 16, 60, 0.7);
    if (G.cursor && G.mode === "battle") hole(G.aim.x * TILE, G.aim.y * TILE, 50, 0.5);
    x.drawImage(A.dark, 0, 0, W, Hh);
    // warm lantern glints on ships
    x.save(); x.globalCompositeOperation = "lighter";
    G.ships.forEach(function (s) { if (s.sink) return; var lx = s.x * TILE - Math.cos(s.ang) * s.def.len * 14, ly = s.y * TILE - Math.sin(s.ang) * s.def.len * 14; var gr = x.createRadialGradient(lx, ly, 0, lx, ly, 10); gr.addColorStop(0, "rgba(255,210,120,0.9)"); gr.addColorStop(1, "rgba(255,140,40,0)"); x.fillStyle = gr; x.beginPath(); x.arc(lx, ly, 10, 0, 7); x.fill(); });
    x.restore();
  }

  window.RampartRender = { TILE: TILE, THEMES: THEMES, buildLevelArt: buildLevelArt, drawWorld: drawWorld, drawWeather: drawWeather, drawCastle: drawCastle, drawShip: drawShip, roundRect: roundRect, WALL_H: WALL_H };
})();

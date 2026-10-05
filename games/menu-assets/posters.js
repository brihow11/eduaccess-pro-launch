/*
 * EduAccess Arcade menu posters: original, procedurally painted canvas poster art.
 * No image files, no copied arcade art. Each poster is 480x640 (3:4) in design units.
 * Written by: Howie
 *
 *   ArcadePosters.draw(slug, canvas)   paint the poster for a game slug into a canvas
 *   ArcadePosters.slugs                 slugs that have painted posters
 */
(function () {
  "use strict";
  var W = 480, H = 640, TAU = Math.PI * 2;

  // seeded random so posters look the same on every visit
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

  var grainTile = null;
  function grain(c, alpha) {
    if (!grainTile) {
      grainTile = document.createElement("canvas"); grainTile.width = grainTile.height = 128;
      var g = grainTile.getContext("2d"), img = g.createImageData(128, 128), r = rng(99);
      for (var i = 0; i < img.data.length; i += 4) { var v = r() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    }
    c.save(); c.globalAlpha = alpha || 0.09; c.globalCompositeOperation = "overlay";
    c.fillStyle = c.createPattern(grainTile, "repeat"); c.fillRect(0, 0, W, H); c.restore();
  }
  function vignette(c, k) {
    var g = c.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0," + (k || 0.75) + ")");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  function scratches(c, seed, col) {
    var r = rng(seed); c.save(); c.strokeStyle = col || "rgba(255,240,220,.08)"; c.lineWidth = 0.7;
    for (var i = 0; i < 26; i++) { var x = r() * W, y = r() * H, l = 20 + r() * 90; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 8, y + l); c.stroke(); }
    c.restore();
  }
  function sky(c, stops) { var g = c.createLinearGradient(0, 0, 0, H); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  function stars(c, n, seed, maxY) {
    var r = rng(seed); for (var i = 0; i < n; i++) { var a = r(); c.fillStyle = "rgba(255,255,255," + (0.25 + a * 0.75) + ")"; var s = a > 0.94 ? 2.2 : a > 0.7 ? 1.4 : 0.9; c.fillRect(r() * W, r() * (maxY || H), s, s); }
  }
  function glow(c, x, y, r, col) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function ridge(c, seed, y0, amp, rough, fill, rim) {
    var r = rng(seed), pts = [], n = 48, y = y0;
    for (var i = 0; i <= n; i++) { y += (r() - 0.5) * rough; y = y0 + Math.max(-amp, Math.min(amp, y - y0)); pts.push([i * W / n, y]); }
    c.beginPath(); c.moveTo(0, H); pts.forEach(function (p) { c.lineTo(p[0], p[1]); }); c.lineTo(W, H); c.closePath(); c.fillStyle = fill; c.fill();
    if (rim) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.strokeStyle = rim; c.lineWidth = 2; c.stroke(); }
    return pts;
  }
  // big poster title with metal gradient, heavy outline and drop shadow
  function title(c, text, y, size, top, bottom, edge) {
    c.save(); c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.font = "italic 900 " + size + "px Impact, 'Arial Black', 'Helvetica Neue', sans-serif";
    var m = c.measureText(text), w = m.width, sc = w > W - 40 ? (W - 40) / w : 1;
    c.translate(W / 2, y); c.scale(sc, 1);
    c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 18; c.shadowOffsetY = 6;
    c.lineJoin = "round"; c.lineWidth = size * 0.16; c.strokeStyle = edge || "#120806"; c.strokeText(text, 0, 0);
    c.shadowColor = "transparent";
    var g = c.createLinearGradient(0, -size * 0.8, 0, 0); g.addColorStop(0, top); g.addColorStop(0.55, bottom); g.addColorStop(0.56, shade(bottom)); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillText(text, 0, 0);
    c.lineWidth = 1.2; c.strokeStyle = "rgba(255,255,255,.35)"; c.strokeText(text, 0, -1);
    c.restore();
  }
  function shade(hex) { var n = parseInt(hex.slice(1), 16), r = (n >> 16) * 0.7 | 0, g = (n >> 8 & 255) * 0.7 | 0, b = (n & 255) * 0.7 | 0; return "rgb(" + r + "," + g + "," + b + ")"; }
  function tagline(c, text, y, col) {
    c.save(); c.textAlign = "center"; c.font = "700 15px 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"; c.fillStyle = col || "rgba(255,240,220,.85)";
    c.shadowColor = "rgba(0,0,0,.9)"; c.shadowBlur = 6;
    var spaced = text.toUpperCase().split("").join("\u200A"); c.fillText(spaced, W / 2, y); c.restore();
  }
  // a figure built from thick round limbs (silhouette style)
  function limb(c, pts, w) { c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }

  var P = {};

  P.defender = function (c) {
    sky(c, [[0, "#04030c"], [0.45, "#120c34"], [0.72, "#3a1440"], [0.86, "#7a2a1c"], [1, "#1a0806"]]);
    stars(c, 220, 7, H * 0.7);
    glow(c, 360, 150, 150, "rgba(120,90,255,.18)");
    // distant planet
    var pg = c.createRadialGradient(380, 120, 4, 400, 140, 70); pg.addColorStop(0, "#c9b8ff"); pg.addColorStop(0.5, "#5a3fa8"); pg.addColorStop(1, "#140a30");
    c.fillStyle = pg; c.beginPath(); c.arc(400, 140, 62, 0, TAU); c.fill();
    c.strokeStyle = "rgba(200,180,255,.35)"; c.lineWidth = 2; c.beginPath(); c.ellipse(400, 140, 100, 18, -0.25, 0, TAU); c.stroke();
    ridge(c, 3, 470, 40, 28, "#2a0f2a", "rgba(255,120,60,.5)");
    ridge(c, 5, 520, 60, 46, "#170812", "#ff8a3c");
    var p3 = ridge(c, 11, 585, 30, 30, "#0b0408", "rgba(255,90,40,.35)");
    // burning settlement glow
    glow(c, 120, 600, 130, "rgba(255,110,30,.35)");
    // tractor beams and landers abducting humans
    [[300, 300, 1], [150, 230, 0.7], [410, 360, 0.85]].forEach(function (l, i) {
      var x = l[0], y = l[1], s = l[2];
      var bg = c.createLinearGradient(x, y, x, y + 220 * s); bg.addColorStop(0, "rgba(120,255,160,.45)"); bg.addColorStop(1, "rgba(120,255,160,0)");
      c.fillStyle = bg; c.beginPath(); c.moveTo(x - 10 * s, y + 10 * s); c.lineTo(x + 10 * s, y + 10 * s); c.lineTo(x + 46 * s, y + 230 * s); c.lineTo(x - 46 * s, y + 230 * s); c.fill();
      c.save(); c.translate(x, y); c.scale(s * 1.4, s * 1.4);
      var hg = c.createLinearGradient(0, -18, 0, 12); hg.addColorStop(0, "#9dffb4"); hg.addColorStop(0.5, "#2c9d4c"); hg.addColorStop(1, "#0c3018");
      c.fillStyle = hg; c.beginPath(); c.ellipse(0, 0, 26, 9, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0, -6, 12, 11, 0, Math.PI, 0); c.fill();
      c.fillStyle = "#ffe25a"; for (var k = -2; k <= 2; k++) c.fillRect(k * 9 - 1.5, -1.5, 3, 3);
      c.strokeStyle = "#1c5e30"; c.lineWidth = 2.4; limb(c, [[-14, 6], [-22, 18]], 2.4); limb(c, [[14, 6], [22, 18]], 2.4); limb(c, [[0, 8], [0, 20]], 2.4);
      // human being lifted
      c.fillStyle = "#e9d2b8"; c.strokeStyle = "#d8c0a8"; c.translate(0, 70 + i * 10);
      c.beginPath(); c.arc(0, 0, 3.5, 0, TAU); c.fill(); limb(c, [[0, 4], [0, 16]], 3); limb(c, [[0, 16], [-4, 26]], 2.6); limb(c, [[0, 16], [5, 25]], 2.6); limb(c, [[0, 7], [-7, 2]], 2.2); limb(c, [[0, 7], [7, 1]], 2.2);
      c.restore();
    });
    // hero ship banking in, with engine flare and laser streak
    c.save(); c.translate(120, 395); c.rotate(-0.06);
    c.globalCompositeOperation = "lighter";
    var fl = c.createLinearGradient(-150, 0, 0, 0); fl.addColorStop(0, "rgba(255,90,30,0)"); fl.addColorStop(1, "rgba(255,170,60,.9)");
    c.fillStyle = fl; c.beginPath(); c.moveTo(-150, -3); c.lineTo(-30, -9); c.lineTo(-30, 9); c.lineTo(-150, 3); c.fill();
    var lz = c.createLinearGradient(80, 0, 480, 0); lz.addColorStop(0, "rgba(255,255,255,1)"); lz.addColorStop(0.6, "rgba(255,230,120,.9)"); lz.addColorStop(1, "rgba(255,80,80,0)");
    c.fillStyle = lz; c.fillRect(80, 2, 400, 3); glow(c, 84, 3, 26, "rgba(255,255,220,.8)");
    c.globalCompositeOperation = "source-over";
    var hull = c.createLinearGradient(0, -20, 0, 18); hull.addColorStop(0, "#f4f6ff"); hull.addColorStop(0.45, "#9aa4c8"); hull.addColorStop(0.5, "#5c3bb0"); hull.addColorStop(1, "#1d1240");
    c.fillStyle = hull; c.beginPath(); c.moveTo(-34, -14); c.lineTo(-18, -14); c.lineTo(10, -6); c.lineTo(78, 0); c.lineTo(60, 8); c.lineTo(-34, 12); c.closePath(); c.fill();
    c.fillStyle = "#3a2a7a"; c.beginPath(); c.moveTo(-30, -14); c.lineTo(-38, -30); c.lineTo(-16, -14); c.fill();
    c.fillStyle = "#6fe6ff"; c.beginPath(); c.moveTo(6, -6); c.lineTo(30, -3); c.lineTo(14, 1); c.fill();
    c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1; c.beginPath(); c.moveTo(-30, -2); c.lineTo(60, 2); c.stroke();
    c.restore();
    // explosion burst
    c.save(); c.globalCompositeOperation = "lighter"; glow(c, 300, 300, 70, "rgba(255,200,120,.5)"); c.restore();
    grain(c, 0.12); vignette(c, 0.7); scratches(c, 4);
    title(c, "DEFENDER", 92, 92, "#fff3c4", "#ff6a1a");
    tagline(c, "The last ten humans. One ship.", 124);
  };

  P.joust = function (c) {
    sky(c, [[0, "#050206"], [0.5, "#1c0608"], [0.82, "#5a1004"], [1, "#ff5a10"]]);
    stars(c, 90, 12, H * 0.45);
    // lava sea with molten texture
    var lg = c.createLinearGradient(0, 560, 0, H); lg.addColorStop(0, "#ffb02a"); lg.addColorStop(0.3, "#ff4a10"); lg.addColorStop(1, "#5a0800");
    c.fillStyle = lg; c.fillRect(0, 560, W, 80);
    var r = rng(21); c.globalCompositeOperation = "lighter";
    for (var i = 0; i < 70; i++) { c.fillStyle = "rgba(255," + (180 + r() * 70 | 0) + ",80," + (0.2 + r() * 0.4) + ")"; c.beginPath(); c.ellipse(r() * W, 566 + r() * 70, 10 + r() * 30, 1.5 + r() * 2, 0, 0, TAU); c.fill(); }
    glow(c, 240, 640, 360, "rgba(255,90,20,.45)");
    for (i = 0; i < 90; i++) { var ex = r() * W, ey = 200 + r() * 380; c.fillStyle = "rgba(255," + (120 + r() * 120 | 0) + ",40," + (0.3 + r() * 0.6) + ")"; c.fillRect(ex, ey, 1.6, 1.6 + r() * 3); }
    c.globalCompositeOperation = "source-over";
    // rock ledges with top light from lava below (rim light under)
    function ledge(x, y, w) {
      var g = c.createLinearGradient(0, y, 0, y + 30); g.addColorStop(0, "#5a3a26"); g.addColorStop(0.4, "#2a1810"); g.addColorStop(1, "#ff6a22");
      c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w - 10, y + 14); c.lineTo(x + w * 0.7, y + 30); c.lineTo(x + w * 0.4, y + 22); c.lineTo(x + 12, y + 30); c.closePath(); c.fill();
      c.fillStyle = "rgba(255,210,150,.25)"; c.fillRect(x + 2, y, w - 4, 2);
    }
    ledge(-10, 300, 150); ledge(330, 250, 160); ledge(150, 470, 200);
    // troll hand rising from lava
    c.save(); c.translate(400, 600); c.fillStyle = "#3a0c06"; c.strokeStyle = "#3a0c06";
    limb(c, [[0, 40], [-6, -10]], 26); [[-22, -40], [-10, -52], [4, -50], [16, -38]].forEach(function (f) { limb(c, [[-6, -14], f], 8); });
    c.strokeStyle = "rgba(255,140,40,.6)"; c.lineWidth = 2; c.beginPath(); c.moveTo(6, 30); c.lineTo(4, -8); c.stroke(); c.restore();
    // hero knight on ostrich, rim-lit
    function rider(x, y, s, flip, body, rim, wingUp) {
      c.save(); c.translate(x, y); c.scale(flip ? -s : s, s);
      c.strokeStyle = body; c.fillStyle = body;
      limb(c, [[-6, 18], [-10, 40], [-4, 56]], 5); limb(c, [[8, 18], [12, 40], [20, 54]], 5);
      c.beginPath(); c.ellipse(0, 6, 30, 16, -0.1, 0, TAU); c.fill();
      limb(c, [[22, 0], [30, -24], [40, -34]], 9); c.beginPath(); c.ellipse(44, -36, 9, 6, 0.2, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(51, -38); c.lineTo(64, -34); c.lineTo(51, -32); c.fill();
      c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-50, wingUp ? -70 : -20, -70, wingUp ? -60 : 10); c.quadraticCurveTo(-40, wingUp ? -20 : 10, -20, 14); c.fill();
      c.beginPath(); c.moveTo(-28, 4); c.lineTo(-52, 0); c.lineTo(-30, 14); c.fill();
      // knight
      limb(c, [[0, -8], [2, -34]], 13); c.beginPath(); c.arc(3, -44, 8, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-2, -52); c.lineTo(10, -48); c.lineTo(3, -62); c.fill();
      c.strokeStyle = "#d8d0c0"; limb(c, [[-8, -28], [96, -40]], 3);
      c.fillStyle = body; c.beginPath(); c.ellipse(-8, -24, 7, 10, 0, 0, TAU); c.fill();
      c.globalCompositeOperation = "lighter"; c.strokeStyle = rim; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, 7, 29, 15, -0.1, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.moveTo(-6, 22); c.lineTo(-10, 40); c.stroke(); c.beginPath(); c.moveTo(8, 22); c.lineTo(12, 40); c.stroke();
      c.restore();
    }
    rider(210, 400, 1.55, false, "#120806", "rgba(255,150,60,.85)", true);
    rider(400, 200, 0.85, true, "#0c0606", "rgba(255,90,60,.7)", false);
    rider(70, 250, 0.7, false, "#0c0606", "rgba(255,90,60,.6)", true);
    grain(c, 0.13); vignette(c, 0.6); scratches(c, 9);
    title(c, "JOUST", 100, 112, "#fff4c8", "#ffb31a");
    tagline(c, "Higher lance wins.", 132);
  };

  P["asteroids-deluxe"] = function (c) {
    sky(c, [[0, "#02040a"], [0.6, "#061226"], [1, "#0a0614"]]);
    glow(c, 120, 520, 260, "rgba(60,120,255,.18)"); glow(c, 420, 140, 200, "rgba(255,60,140,.12)");
    stars(c, 260, 33);
    var r = rng(44);
    function rock(x, y, rad, seed) {
      var rr = rng(seed), n = 14, pts = [];
      for (var i = 0; i < n; i++) { var a = i / n * TAU, d = rad * (0.75 + rr() * 0.35); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
      c.save(); c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath();
      var g = c.createRadialGradient(x - rad * 0.4, y - rad * 0.4, rad * 0.1, x, y, rad * 1.1); g.addColorStop(0, "#9a8f86"); g.addColorStop(0.5, "#4a423e"); g.addColorStop(1, "#120e10");
      c.fillStyle = g; c.fill(); c.clip();
      for (var k = 0; k < 6; k++) { var cx = x + (rr() - 0.5) * rad * 1.3, cy = y + (rr() - 0.5) * rad * 1.3, cr = rad * (0.08 + rr() * 0.18);
        c.fillStyle = "rgba(0,0,0,.35)"; c.beginPath(); c.arc(cx, cy, cr, 0, TAU); c.fill(); c.fillStyle = "rgba(255,240,220,.12)"; c.beginPath(); c.arc(cx - cr * 0.25, cy - cr * 0.25, cr * 0.75, 0, TAU); c.fill(); }
      c.restore();
      c.strokeStyle = "rgba(120,200,255,.35)"; c.lineWidth = 1.5; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); c.stroke();
    }
    rock(360, 250, 110, 5); rock(90, 180, 52, 8); rock(420, 520, 60, 13); rock(150, 420, 30, 2); rock(290, 470, 22, 17); rock(60, 560, 40, 23);
    // debris
    for (var i = 0; i < 40; i++) { c.fillStyle = "rgba(200,190,180," + (0.3 + r() * 0.5) + ")"; c.fillRect(200 + r() * 240, 160 + r() * 200, 2 + r() * 3, 2 + r() * 2); }
    // vector ship with shield
    c.save(); c.translate(190, 330); c.rotate(-0.6); c.globalCompositeOperation = "lighter";
    c.strokeStyle = "rgba(90,230,255,.35)"; c.lineWidth = 10; c.beginPath(); c.arc(0, 0, 42, 0, TAU); c.stroke();
    c.strokeStyle = "rgba(140,240,255,.9)"; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 42, 0, TAU); c.stroke();
    c.shadowColor = "#7ff"; c.shadowBlur = 14; c.strokeStyle = "#e8ffff"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -26); c.lineTo(16, 20); c.lineTo(6, 13); c.lineTo(-6, 13); c.lineTo(-16, 20); c.closePath(); c.stroke();
    c.strokeStyle = "#ff9a3a"; c.beginPath(); c.moveTo(-5, 16); c.lineTo(0, 32); c.lineTo(5, 16); c.stroke();
    c.strokeStyle = "#fff"; c.lineWidth = 3; for (var b = 1; b < 5; b++) { c.beginPath(); c.moveTo(0, -36 - b * 30); c.lineTo(0, -42 - b * 30); c.stroke(); }
    c.restore();
    grain(c, 0.1); vignette(c, 0.7); scratches(c, 15, "rgba(200,230,255,.06)");
    title(c, "ASTEROIDS", 86, 84, "#e8fbff", "#39b8ff", "#02101e");
    c.save(); c.font = "italic 900 34px Impact, 'Arial Black', sans-serif"; c.textAlign = "center"; c.fillStyle = "#ff4fae"; c.shadowColor = "#ff2a8a"; c.shadowBlur = 16; c.fillText("D E L U X E", W / 2, 128); c.restore();
    tagline(c, "Shields up. Rocks incoming.", 600);
  };

  P.battlezone = function (c) {
    sky(c, [[0, "#000400"], [0.55, "#011a06"], [0.62, "#000"], [1, "#000"]]);
    stars(c, 70, 61, H * 0.5);
    var hz = 360;
    // crescent moon + volcano
    c.fillStyle = "#b8ffb8"; c.beginPath(); c.arc(380, 120, 30, 0, TAU); c.fill(); c.fillStyle = "#011306"; c.beginPath(); c.arc(392, 112, 28, 0, TAU); c.fill();
    c.strokeStyle = "#3dff6a"; c.lineWidth = 2; c.shadowColor = "#3dff6a"; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(0, hz); c.lineTo(60, hz - 20); c.lineTo(110, hz - 8); c.lineTo(170, hz - 70); c.lineTo(200, hz - 70); c.lineTo(260, hz - 10); c.lineTo(330, hz - 30); c.lineTo(400, hz - 5); c.lineTo(W, hz - 25); c.stroke();
    c.beginPath(); c.moveTo(176, hz - 76); c.lineTo(170, hz - 110); c.moveTo(190, hz - 76); c.lineTo(196, hz - 120); c.moveTo(184, hz - 76); c.lineTo(186, hz - 130); c.stroke();
    // ground grid in perspective
    c.shadowBlur = 0; c.strokeStyle = "rgba(60,255,100,.25)"; c.lineWidth = 1;
    for (var i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(W / 2 + i * 10, hz); c.lineTo(W / 2 + i * 120, H); c.stroke(); }
    for (var z = 1; z < 14; z++) { var y = hz + (H - hz) * Math.pow(z / 14, 2.2); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // 3D wireframe tank
    function proj(p, cam) { var x = p[0] * Math.cos(cam.a) - p[2] * Math.sin(cam.a), zz = p[0] * Math.sin(cam.a) + p[2] * Math.cos(cam.a) + cam.d; return [cam.x + x / zz * cam.f, cam.y - p[1] / zz * cam.f]; }
    var V = [[-3, 0, -5], [3, 0, -5], [3, 0, 5], [-3, 0, 5], [-3.6, 1.4, -6], [3.6, 1.4, -6], [3.6, 1.4, 6], [-3.6, 1.4, 6], [-2.4, 2.6, -3], [2.4, 2.6, -3], [2.4, 2.6, 4], [-2.4, 2.6, 4], [-1.4, 3.6, -1], [1.4, 3.6, -1], [1.4, 3.6, 2.4], [-1.4, 3.6, 2.4], [-0.3, 3.1, -1], [0.3, 3.1, -1], [-0.3, 3.1, -9], [0.3, 3.1, -9]];
    var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7], [4, 8], [5, 9], [6, 10], [7, 11], [8, 9], [9, 10], [10, 11], [11, 8], [8, 12], [9, 13], [10, 14], [11, 15], [12, 13], [13, 14], [14, 15], [15, 12], [16, 18], [17, 19], [18, 19], [16, 17]];
    var cam = { a: 0.75, d: 18, f: 420, x: 250, y: 470 };
    var P2 = V.map(function (p) { return proj(p, cam); });
    c.strokeStyle = "rgba(60,255,100,.25)"; c.lineWidth = 8; E.forEach(function (e) { c.beginPath(); c.moveTo(P2[e[0]][0], P2[e[0]][1]); c.lineTo(P2[e[1]][0], P2[e[1]][1]); c.stroke(); });
    c.strokeStyle = "#9dffb0"; c.lineWidth = 2.2; c.shadowColor = "#3dff6a"; c.shadowBlur = 12;
    E.forEach(function (e) { c.beginPath(); c.moveTo(P2[e[0]][0], P2[e[0]][1]); c.lineTo(P2[e[1]][0], P2[e[1]][1]); c.stroke(); });
    // muzzle flash
    var mz = P2[18]; c.globalCompositeOperation = "lighter"; glow(c, mz[0], mz[1], 60, "rgba(180,255,180,.7)"); c.globalCompositeOperation = "source-over";
    // distant enemy tank + crosshair
    var cam2 = { a: -0.3, d: 60, f: 420, x: 380, y: hz + 6 }, Q = V.map(function (p) { return proj(p, cam2); });
    c.lineWidth = 1.4; E.forEach(function (e) { c.beginPath(); c.moveTo(Q[e[0]][0], Q[e[0]][1]); c.lineTo(Q[e[1]][0], Q[e[1]][1]); c.stroke(); });
    c.shadowBlur = 0; c.strokeStyle = "rgba(255,80,80,.9)"; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(380, hz - 40); c.lineTo(380, hz - 18); c.moveTo(380, hz + 30); c.lineTo(380, hz + 50); c.moveTo(340, hz + 6); c.lineTo(362, hz + 6); c.moveTo(398, hz + 6); c.lineTo(420, hz + 6); c.stroke();
    // scanlines
    c.fillStyle = "rgba(0,0,0,.22)"; for (var s = 0; s < H; s += 3) c.fillRect(0, s, W, 1);
    grain(c, 0.12); vignette(c, 0.8); scratches(c, 31, "rgba(180,255,180,.05)");
    title(c, "BATTLEZONE", 92, 80, "#eaffea", "#2fe85a", "#001a06");
    tagline(c, "Enemy in range.", 124, "rgba(170,255,180,.9)");
  };

  P.rampart = function (c) {
    sky(c, [[0, "#0a0d14"], [0.35, "#2a3240"], [0.55, "#6a4a30"], [0.62, "#1a2a30"], [1, "#050a0c"]]);
    // storm clouds
    var r = rng(77); for (var i = 0; i < 40; i++) { c.fillStyle = "rgba(" + (20 + r() * 30 | 0) + "," + (24 + r() * 30 | 0) + "," + (34 + r() * 30 | 0) + ",.55)"; c.beginPath(); c.ellipse(r() * W, r() * 220, 60 + r() * 90, 20 + r() * 30, 0, 0, TAU); c.fill(); }
    glow(c, 300, 330, 160, "rgba(255,170,80,.35)");
    // lightning
    c.strokeStyle = "rgba(220,230,255,.85)"; c.lineWidth = 2; c.beginPath(); var lx = 380, ly = 0; c.moveTo(lx, ly); while (ly < 240) { lx += (r() - 0.5) * 40; ly += 20 + r() * 20; c.lineTo(lx, ly); } c.stroke();
    // sea with waves
    var sg = c.createLinearGradient(0, 360, 0, H); sg.addColorStop(0, "#1c3a40"); sg.addColorStop(1, "#04100e"); c.fillStyle = sg; c.fillRect(0, 360, W, H - 360);
    c.strokeStyle = "rgba(160,210,210,.18)"; c.lineWidth = 1.2; for (i = 0; i < 60; i++) { var wx = r() * W, wy = 365 + r() * 260; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 10, wy - 4, wx + 22 + r() * 20, wy); c.stroke(); }
    // enemy galleons
    function ship(x, y, s) {
      c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = "#0e0a08";
      c.beginPath(); c.moveTo(-50, 0); c.lineTo(50, 0); c.lineTo(36, 16); c.lineTo(-40, 16); c.closePath(); c.fill();
      c.fillRect(-2, -70, 3, 70); c.fillRect(-28, -50, 3, 50);
      c.fillStyle = "#c9b48a"; c.beginPath(); c.moveTo(2, -66); c.quadraticCurveTo(30, -40, 2, -12); c.fill(); c.beginPath(); c.moveTo(-24, -46); c.quadraticCurveTo(-4, -28, -24, -10); c.fill();
      c.fillStyle = "#ffb050"; c.fillRect(-30, 6, 4, 3); c.fillRect(-10, 6, 4, 3); c.fillRect(10, 6, 4, 3);
      c.restore();
    }
    ship(370, 420, 1.1); ship(90, 400, 0.6); ship(250, 385, 0.45);
    // cannonball arcs with fire trails
    c.globalCompositeOperation = "lighter";
    [[150, 520, 360, 410], [190, 520, 90, 395]].forEach(function (a) {
      var mx = (a[0] + a[2]) / 2, my = Math.min(a[1], a[3]) - 160;
      c.strokeStyle = "rgba(255,150,50,.6)"; c.lineWidth = 3; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mx, my, a[2], a[3]); c.stroke();
      glow(c, (a[0] + 2 * mx + a[2]) / 4, (a[1] + 2 * my + a[3]) / 4, 18, "rgba(255,220,140,.9)");
    });
    glow(c, 370, 410, 50, "rgba(255,140,40,.7)");
    c.globalCompositeOperation = "source-over";
    // castle wall foreground with brick texture
    c.fillStyle = "#2a2622"; c.beginPath(); c.moveTo(0, 520); for (var x = 0; x <= W; x += 40) { c.lineTo(x, 520); c.lineTo(x, 500); c.lineTo(x + 22, 500); c.lineTo(x + 22, 520); } c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = "#3a342c"; c.fillRect(30, 440, 70, 80); c.fillRect(24, 430, 82, 14); for (x = 24; x < 106; x += 20) c.fillRect(x, 418, 12, 14);
    c.strokeStyle = "rgba(0,0,0,.45)"; c.lineWidth = 1; for (var by = 446; by < H; by += 12) { c.beginPath(); c.moveTo(0, by + 74 * (by < 520 ? 0 : 0)); c.lineTo(W, by); c.stroke(); for (x = (by / 12 % 2) * 14; x < W; x += 28) { c.beginPath(); c.moveTo(x, by); c.lineTo(x, by + 12); c.stroke(); } }
    var wl = c.createLinearGradient(0, 500, 0, H); wl.addColorStop(0, "rgba(255,160,80,.25)"); wl.addColorStop(1, "rgba(0,0,0,.6)"); c.fillStyle = wl; c.fillRect(0, 500, W, H - 500);
    // cannons
    c.fillStyle = "#111"; [[150, 512, -0.5], [196, 512, -0.75]].forEach(function (k) { c.save(); c.translate(k[0], k[1]); c.rotate(k[2]); c.fillRect(-4, -6, 34, 12); c.restore(); c.beginPath(); c.arc(k[0], k[1] + 4, 9, 0, TAU); c.fill(); });
    c.globalCompositeOperation = "lighter"; glow(c, 176, 494, 30, "rgba(255,200,120,.8)"); c.globalCompositeOperation = "source-over";
    grain(c, 0.13); vignette(c, 0.65); scratches(c, 51);
    title(c, "RAMPART", 92, 96, "#fff0d0", "#d89a3a", "#140c04");
    tagline(c, "Build. Aim. Hold the wall.", 124);
  };

  P.gauntlet = function (c) {
    sky(c, [[0, "#06040a"], [1, "#120a08"]]);
    var vx = 240, vy = 300;
    // corridor walls in perspective with stone blocks
    function quad(a, b, cc, d, fill) { c.fillStyle = fill; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(d[0], d[1]); c.fill(); }
    quad([0, 0], [180, 240], [180, 360], [0, H], "#2a1e1a"); quad([W, 0], [300, 240], [300, 360], [W, H], "#241a16");
    quad([0, H], [180, 360], [300, 360], [W, H], "#1a1210"); quad([0, 0], [180, 240], [300, 240], [W, 0], "#0e0a0a");
    var back = c.createRadialGradient(240, 300, 4, 240, 300, 80); back.addColorStop(0, "#5a2a60"); back.addColorStop(1, "#140a14"); c.fillStyle = back; c.fillRect(180, 240, 120, 120);
    c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 1.4;
    for (var k = 0; k < 9; k++) { var t = k / 9, f = Math.pow(t, 1.6);
      [[0, 180], [W, 300]].forEach(function (s) { var x = s[0] + (s[1] - s[0]) * f; c.beginPath(); c.moveTo(x, (s[0] ? 0 : 0) + 240 * f); c.lineTo(x, H - (H - 360) * f); c.stroke(); });
      var yy = H - (H - 360) * f; c.beginPath(); c.moveTo(180 * f, yy); c.lineTo(W - 180 * f, yy); c.stroke(); }
    for (k = 1; k < 12; k++) { var yl = k / 12; c.beginPath(); c.moveTo(0, yl * H); c.lineTo(180, 240 + yl * 120); c.moveTo(W, yl * H); c.lineTo(300, 240 + yl * 120); c.stroke(); }
    // torches
    c.globalCompositeOperation = "lighter";
    [[60, 230, 1], [420, 230, 1], [150, 270, 0.5], [330, 270, 0.5]].forEach(function (tq) { glow(c, tq[0], tq[1], 120 * tq[2], "rgba(255,140,40,.45)"); glow(c, tq[0], tq[1], 20 * tq[2], "rgba(255,230,160,.95)"); });
    c.globalCompositeOperation = "source-over";
    // ghost horde: hooded shapes with glowing eyes
    var r = rng(91);
    for (var i = 0; i < 16; i++) {
      var d = 0.3 + r() * 0.7, gx = 200 + (r() - 0.5) * 120 * (1 + d * 2.2), gy = 300 + d * 120, gs = 10 + d * 34;
      var gg = c.createLinearGradient(0, gy - gs, 0, gy + gs * 1.4); gg.addColorStop(0, "rgba(190,180,220,.85)"); gg.addColorStop(1, "rgba(60,40,90,0)");
      c.fillStyle = gg; c.beginPath(); c.moveTo(gx - gs * 0.6, gy + gs * 1.4); c.quadraticCurveTo(gx - gs * 0.8, gy - gs * 1.2, gx, gy - gs); c.quadraticCurveTo(gx + gs * 0.8, gy - gs * 1.2, gx + gs * 0.6, gy + gs * 1.4); c.fill();
      c.fillStyle = "#ff2a2a"; c.shadowColor = "#f00"; c.shadowBlur = 8; c.fillRect(gx - gs * 0.25, gy - gs * 0.45, gs * 0.14, gs * 0.1); c.fillRect(gx + gs * 0.12, gy - gs * 0.45, gs * 0.14, gs * 0.1); c.shadowBlur = 0;
    }
    // warrior from behind, axe raised
    c.save(); c.translate(240, 560); c.fillStyle = "#0a0606"; c.strokeStyle = "#0a0606";
    limb(c, [[-20, 80], [-24, 30]], 26); limb(c, [[20, 80], [24, 30]], 26);
    c.beginPath(); c.moveTo(-46, 0); c.lineTo(46, 0); c.lineTo(34, -96); c.lineTo(-34, -96); c.fill();
    c.beginPath(); c.arc(0, -114, 22, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-18, -126); c.lineTo(-40, -150); c.lineTo(-10, -132); c.fill(); c.beginPath(); c.moveTo(18, -126); c.lineTo(40, -150); c.lineTo(10, -132); c.fill();
    limb(c, [[34, -86], [70, -130], [92, -176]], 16); limb(c, [[-34, -86], [-64, -40]], 15);
    c.strokeStyle = "#1a1210"; limb(c, [[86, -150], [112, -236]], 7);
    c.fillStyle = "#3a3a40"; c.beginPath(); c.moveTo(104, -232); c.quadraticCurveTo(150, -250, 146, -200); c.lineTo(112, -214); c.fill();
    c.fillStyle = "rgba(255,150,60,.5)"; c.fillRect(-46, -96, 4, 96); c.fillRect(42, -96, 4, 96);
    c.restore();
    grain(c, 0.14); vignette(c, 0.7); scratches(c, 71);
    title(c, "GAUNTLET", 92, 92, "#ffe6c8", "#c8401c", "#140404");
    tagline(c, "Four heroes. Endless dungeon.", 124);
  };

  P.galaga = function (c) {
    sky(c, [[0, "#02010a"], [0.6, "#0a0624"], [1, "#160a2a"]]);
    stars(c, 240, 101);
    glow(c, 240, 300, 260, "rgba(120,60,255,.15)");
    function bug(x, y, s, body, wing, eye) {
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = wing; c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(-34, -26, -40, 6); c.quadraticCurveTo(-22, 0, -4, 10); c.fill();
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(34, -26, 40, 6); c.quadraticCurveTo(22, 0, 4, 10); c.fill();
      var g = c.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, "#fff"); g.addColorStop(0.3, body); g.addColorStop(1, shade(body));
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 9, 18, 0, 0, TAU); c.fill();
      c.fillStyle = eye; c.beginPath(); c.arc(-4, -10, 2.6, 0, TAU); c.arc(4, -10, 2.6, 0, TAU); c.fill();
      c.strokeStyle = body; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, -17); c.lineTo(-9, -27); c.moveTo(3, -17); c.lineTo(9, -27); c.stroke();
      c.restore();
    }
    for (var row = 0; row < 4; row++) for (var col = 0; col < 7 - (row === 0 ? 3 : 0); col++) {
      var n = row === 0 ? 4 : 7, x = W / 2 + (col - (n - 1) / 2) * 56, y = 170 + row * 46;
      bug(x, y, 0.8, row === 0 ? "#3ae07a" : row === 1 ? "#ff3a4a" : "#3a8aff", row === 0 ? "rgba(255,200,60,.85)" : row === 1 ? "rgba(80,120,255,.8)" : "rgba(255,220,80,.75)", "#ff2a2a");
    }
    // diving attackers
    bug(110, 380, 1.1, "#ff3a4a", "rgba(80,120,255,.85)", "#fff"); bug(380, 420, 1.3, "#3a8aff", "rgba(255,220,80,.8)", "#fff");
    // boss tractor beam
    c.globalCompositeOperation = "lighter";
    var tb = c.createLinearGradient(0, 170, 0, 520); tb.addColorStop(0, "rgba(90,160,255,.6)"); tb.addColorStop(1, "rgba(90,160,255,0)");
    c.fillStyle = tb; c.beginPath(); c.moveTo(232, 180); c.lineTo(248, 180); c.lineTo(310, 520); c.lineTo(170, 520); c.fill();
    c.strokeStyle = "rgba(160,220,255,.5)"; c.lineWidth = 2; for (var b = 0; b < 6; b++) { var by = 220 + b * 52, bw = 8 + (by - 180) * 0.2; c.beginPath(); c.ellipse(240, by, bw, bw * 0.18, 0, 0, TAU); c.stroke(); }
    // shots
    c.fillStyle = "#fff"; for (b = 0; b < 4; b++) { c.fillRect(238, 470 - b * 60, 3, 16); } glow(c, 240, 560, 60, "rgba(255,80,60,.4)");
    c.globalCompositeOperation = "source-over";
    // fighter
    c.save(); c.translate(240, 570);
    var fg = c.createLinearGradient(0, -36, 0, 24); fg.addColorStop(0, "#fff"); fg.addColorStop(0.6, "#b8c0d8"); fg.addColorStop(1, "#4a5068");
    c.fillStyle = fg; c.beginPath(); c.moveTo(0, -38); c.lineTo(8, -14); c.lineTo(28, 4); c.lineTo(30, 20); c.lineTo(10, 10); c.lineTo(0, 18); c.lineTo(-10, 10); c.lineTo(-30, 20); c.lineTo(-28, 4); c.lineTo(-8, -14); c.closePath(); c.fill();
    c.fillStyle = "#e0242a"; c.fillRect(-30, 0, 4, 18); c.fillRect(26, 0, 4, 18); c.fillStyle = "#3a6aff"; c.beginPath(); c.ellipse(0, -10, 4, 8, 0, 0, TAU); c.fill();
    c.restore();
    grain(c, 0.1); vignette(c, 0.7); scratches(c, 81, "rgba(220,200,255,.05)");
    title(c, "GALAGA", 96, 108, "#ffffff", "#ff3a6a", "#16021a");
    tagline(c, "The swarm dives at dawn.", 128);
  };

  P["karate-champ"] = function (c) {
    sky(c, [[0, "#1a0404"], [0.45, "#8a1a0a"], [0.7, "#f07a2a"], [1, "#2a0a04"]]);
    // giant sun with brush texture
    var sg = c.createRadialGradient(240, 300, 20, 240, 300, 190); sg.addColorStop(0, "#fff0c0"); sg.addColorStop(0.5, "#ff8a2a"); sg.addColorStop(1, "rgba(220,40,10,0)");
    c.fillStyle = sg; c.fillRect(0, 100, W, 400);
    c.fillStyle = "#e8401a"; c.beginPath(); c.arc(240, 300, 150, 0, TAU); c.fill();
    var r = rng(55); c.strokeStyle = "rgba(120,10,0,.25)"; for (var i = 0; i < 30; i++) { var yy = 160 + r() * 280; c.lineWidth = 1 + r() * 4; c.beginPath(); c.moveTo(90 + r() * 40, yy); c.lineTo(350 + r() * 40, yy + (r() - 0.5) * 6); c.stroke(); }
    // mountains & dojo roof silhouettes
    c.fillStyle = "#3a0a06"; c.beginPath(); c.moveTo(0, 470); c.lineTo(80, 400); c.lineTo(150, 450); c.lineTo(260, 380); c.lineTo(360, 450); c.lineTo(430, 410); c.lineTo(W, 440); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = "#140302"; c.beginPath(); c.moveTo(310, 470); c.quadraticCurveTo(360, 440, 400, 420); c.lineTo(450, 420); c.quadraticCurveTo(490, 440, 520, 470); c.fill(); c.fillRect(330, 465, 170, 40);
    // mat
    c.fillStyle = "#1a0604"; c.fillRect(0, 520, W, 120); c.fillStyle = "rgba(255,200,150,.12)"; c.fillRect(0, 520, W, 3);
    // fighters in silhouette: one flying kick, one blocking
    c.fillStyle = c.strokeStyle = "#0a0202";
    c.save(); c.translate(190, 360);
    c.beginPath(); c.arc(30, -66, 13, 0, TAU); c.fill();
    limb(c, [[26, -52], [0, -10]], 26);
    limb(c, [[0, -10], [70, 6], [120, 2]], 17);
    limb(c, [[0, -10], [-30, 20], [-14, 50]], 17);
    limb(c, [[20, -44], [56, -40], [86, -52]], 10);
    limb(c, [[16, -40], [-16, -54], [-30, -80]], 10);
    c.fillStyle = "#c8141a"; c.fillRect(-6, -18, 24, 6);
    c.restore();
    c.save(); c.translate(350, 470); c.fillStyle = c.strokeStyle = "#0a0202";
    c.beginPath(); c.arc(-4, -112, 13, 0, TAU); c.fill();
    limb(c, [[-2, -98], [4, -50]], 26); limb(c, [[4, -50], [-26, -10], [-34, 46]], 18); limb(c, [[4, -50], [28, -6], [30, 46]], 18);
    limb(c, [[-6, -90], [-34, -96], [-40, -124]], 10); limb(c, [[0, -88], [-30, -76], [-50, -90]], 10);
    c.fillStyle = "#1a1a1a"; c.fillRect(-10, -58, 26, 6);
    c.restore();
    // impact spark
    c.globalCompositeOperation = "lighter"; glow(c, 312, 362, 40, "rgba(255,240,200,.9)"); c.globalCompositeOperation = "source-over";
    // ink splatter
    c.fillStyle = "rgba(10,2,2,.75)"; for (i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * W, 560 + r() * 80, r() * 5, 0, TAU); c.fill(); }
    grain(c, 0.16); vignette(c, 0.55); scratches(c, 61);
    title(c, "KARATE CHAMP", 92, 84, "#fff8e8", "#f2e0b0", "#2a0402");
    tagline(c, "One point. One winner.", 124);
  };

  window.ArcadePosters = {
    slugs: Object.keys(P),
    draw: function (slug, canvas) {
      var f = P[slug]; if (!f) return false;
      var dpr = Math.min(window.devicePixelRatio || 1, 2), cssW = canvas.clientWidth || 360, scale = Math.max(0.6, Math.min(2, cssW * dpr / W));
      canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
      var c = canvas.getContext("2d"); c.setTransform(scale, 0, 0, scale, 0, 0);
      try { f(c); } catch (e) { c.fillStyle = "#111"; c.fillRect(0, 0, W, H); }
      canvas.dataset.painted = "1";
      return true;
    }
  };
})();

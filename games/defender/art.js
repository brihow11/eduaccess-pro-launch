/*
 * Defender art pass: hand-built 16-bit style sprites (paths, shading ramps, rim light,
 * multi-frame animation), painted once into offscreen canvases at device resolution.
 * Original artwork; no copied arcade graphics. Written by: Howie
 *
 *   DefenderArt.SPRITES[name] = { w, h, frames, paint(g, frame) }   painted centred in a w x h box
 *   DefenderArt.THEMES[i]     = level colour themes (sky, mountains, terrain, ridge)
 *   DefenderArt.rockTile(scale) -> canvas used as the terrain texture pattern
 */
(function () {
  "use strict";
  var TAU = Math.PI * 2;
  function lin(g, x0, y0, x1, y1, stops) { var gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
  function rad(g, x, y, r0, r1, stops, fx, fy) { var gr = g.createRadialGradient(fx == null ? x : fx, fy == null ? y : fy, r0, x, y, r1); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
  function line(g, pts, w, col) { g.lineWidth = w; g.strokeStyle = col; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
  function dot(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function glowDot(g, x, y, r, col) { g.fillStyle = rad(g, x, y, 0, r, [[0, col], [1, "rgba(0,0,0,0)"]]); g.fillRect(x - r, y - r, r * 2, r * 2); }

  // ------------------------------------------------------------------ player ship (faces right)
  function ship(g, f) {
    // engine housing + nozzle glow
    g.fillStyle = lin(g, 0, 11, 0, 22, [[0, "#5a6078"], [1, "#1c1f2c"]]);
    poly(g, [6, 12, 14, 11, 14, 22, 6, 21]); g.fill();
    glowDot(g, 6, 16.5, 6, "rgba(255,120,40,.85)");
    g.fillStyle = "#ffcf7a"; g.fillRect(4.5, 14, 2, 5);
    // swept tail fin
    g.fillStyle = lin(g, 0, 2, 0, 12, [[0, "#c8cede"], [0.5, "#7d849c"], [1, "#3b3f55"]]);
    poly(g, [8, 12, 11, 2, 16, 2, 22, 12]); g.fill();
    line(g, [11, 2.6, 15.6, 2.6], 0.8, "rgba(255,255,255,.7)");
    // fuselage: metallic top ramp
    g.fillStyle = lin(g, 0, 9, 0, 18, [[0, "#ffffff"], [0.25, "#dfe4f0"], [0.6, "#9aa2b8"], [1, "#4c5370"]]);
    poly(g, [12, 11, 30, 9.5, 44, 10.5, 56, 13.5, 63, 16, 56, 17.5, 12, 18]); g.fill();
    // belly stripe: purple shading ramp
    g.fillStyle = lin(g, 0, 16, 0, 23, [[0, "#9a6cff"], [0.45, "#6236c8"], [1, "#22104e"]]);
    poly(g, [12, 17, 58, 17, 50, 20.5, 30, 22.5, 12, 22]); g.fill();
    line(g, [14, 17.2, 57, 17.2], 0.7, "rgba(210,190,255,.8)");
    // canopy
    g.fillStyle = lin(g, 0, 8, 0, 14, [[0, "#d8fbff"], [0.4, "#5ce1ff"], [1, "#0b5c86"]]);
    poly(g, [33, 10, 39, 6.5, 46, 7, 51, 11.5, 44, 12.4]); g.fill();
    line(g, [38, 7.6, 45, 7.9], 0.8, "rgba(255,255,255,.9)");
    // panel lines + specular
    g.strokeStyle = "rgba(20,24,40,.55)"; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(24, 10); g.lineTo(24, 17); g.moveTo(31, 9.8); g.lineTo(31, 17); g.moveTo(52, 13); g.lineTo(50, 17); g.stroke();
    line(g, [16, 10.9, 30, 9.9, 42, 10.6], 0.8, "rgba(255,255,255,.95)");
    // wing root + gun
    g.fillStyle = lin(g, 0, 18, 0, 26, [[0, "#7a82a0"], [1, "#22263a"]]);
    poly(g, [20, 21, 34, 21, 26, 27, 16, 27]); g.fill();
    g.fillStyle = "#30364c"; g.fillRect(55, 16.4, 9, 1.6);
    // nav lights (blink)
    dot(g, 18, 26.4, 1, f ? "#ff4b4b" : "#5a1a1a");
    if (f) glowDot(g, 18, 26.4, 4, "rgba(255,70,70,.6)");
  }

  // ------------------------------------------------------------------ lander
  function lander(g, f, mut) {
    var cx = 20, j = mut ? [0, 0.8, -0.6, 0.4][f] : 0;
    var hi = mut ? "#ff9ae6" : "#b6ffc8", mid = mut ? "#b02a90" : "#2f8f4a", lo = mut ? "#3a0632" : "#0b2a16", edge = mut ? "#ffc4f0" : "#d8ffe0";
    // jointed grabber claws (three), opening and closing per frame
    var open = [0, 1, 2, 1][f];
    [-1, 0, 1].forEach(function (s) {
      var bx = cx + s * 7, kx = cx + s * (11 + open * 0.6), ky = 25, tx = cx + s * (12 + open), ty = 31;
      line(g, [bx, 18, kx, ky], 2.8, lo); line(g, [bx, 18, kx, ky], 1.2, mut ? "#e070c8" : "#7aa088");
      line(g, [kx, ky, tx, ty, tx - s * (2 + open * 0.5), ty + 1.5], 2, lo); line(g, [kx, ky, tx, ty, tx - s * (2 + open * 0.5), ty + 1.5], 0.9, mut ? "#ffd0f0" : "#c8d8a0");
      dot(g, kx, ky, 1.3, mut ? "#ff9ae6" : "#9ab8a0");
    });
    if (mut) for (var k = 0; k < 3; k++) { var a = (f + k * 1.7) * 0.9; line(g, [cx - 4 + k * 4, 20, cx - 4 + k * 4 + Math.sin(a) * 3, 26, cx - 4 + k * 4 + Math.sin(a + 1.2) * 4, 31], 1.3, "rgba(150,255,120,.85)"); }
    // tractor emitter under the hull
    glowDot(g, cx, 20.5, 6, mut ? "rgba(180,255,80,.5)" : "rgba(120,255,160,.45)");
    // angular carapace hull with a lighting ramp from the upper left
    g.save(); g.translate(j, 0);
    g.fillStyle = lin(g, 4, 6, 30, 24, [[0, hi], [0.35, mid], [1, lo]]);
    poly(g, [cx - 16, 15, cx - 11, 8.5, cx - 4, 6, cx + 4, 6, cx + 11, 8.5, cx + 16, 15, cx + 12, 19.5, cx - 12, 19.5]); g.fill();
    // under-plate in shadow
    g.fillStyle = "rgba(0,0,0,.45)"; poly(g, [cx - 14, 16, cx + 14, 16, cx + 11, 19.5, cx - 11, 19.5]); g.fill();
    // plating seams + rivets
    g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(cx - 6, 6.4); g.lineTo(cx - 8, 15.5); g.moveTo(cx + 6, 6.4); g.lineTo(cx + 8, 15.5); g.moveTo(cx - 15, 15.2); g.lineTo(cx + 15, 15.2); g.stroke();
    line(g, [cx - 15, 14.4, cx - 10.6, 8.6, cx - 4, 6.4, cx + 3, 6.4], 0.8, edge);
    dot(g, cx - 11, 17.6, 0.7, "rgba(255,255,255,.35)"); dot(g, cx + 11, 17.6, 0.7, "rgba(255,255,255,.35)");
    // sensor spines
    line(g, [cx - 3, 6, cx - 5, 1.5], 1, mid); line(g, [cx + 3, 6, cx + 5, 1.5], 1, mid);
    dot(g, cx - 5, 1.5, 0.9, mut ? "#b4ff3a" : "#ff5a3a"); dot(g, cx + 5, 1.5, 0.9, mut ? "#b4ff3a" : "#ff5a3a");
    // visor slit with scanning light
    g.fillStyle = "#050806"; poly(g, [cx - 10, 11, cx + 10, 11, cx + 8.5, 13.6, cx - 8.5, 13.6]); g.fill();
    var sx = cx - 7 + [0, 5, 10, 5][f] * 1.4, vis = mut ? "#d4ff4a" : "#ffcf3a";
    g.fillStyle = lin(g, cx - 10, 0, cx + 10, 0, [[0, "rgba(0,0,0,0)"], [0.5, vis], [1, "rgba(0,0,0,0)"]]);
    g.fillRect(cx - 9, 11.6, 18, 1.4);
    glowDot(g, sx, 12.3, 3.4, mut ? "rgba(210,255,80,.8)" : "rgba(255,200,60,.85)"); dot(g, sx, 12.3, 1, "#ffffff");
    g.restore();
  }

  // ------------------------------------------------------------------ bomber: armoured mine-layer
  function bomber(g, f) {
    var c = 17, a = f * Math.PI / 8;
    g.save(); g.translate(c, c); g.rotate(a);
    g.fillStyle = lin(g, -12, -12, 12, 12, [[0, "#9cc6ff"], [0.45, "#3d6fd8"], [1, "#0c1a48"]]);
    poly(g, [-9, -13, 9, -13, 13, -9, 13, 9, 9, 13, -9, 13, -13, 9, -13, -9]); g.fill();
    g.strokeStyle = "rgba(200,225,255,.6)"; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = "rgba(6,10,30,.85)"; poly(g, [-6, -8, 6, -8, 8, -6, 8, 6, 6, 8, -6, 8, -8, 6, -8, -6]); g.fill();
    [[-10, -10], [10, -10], [10, 10], [-10, 10]].forEach(function (p) { dot(g, p[0], p[1], 1, "#d8e6ff"); });
    g.restore();
    var pulse = [0.6, 0.85, 1, 0.85][f];
    glowDot(g, c, c, 9 * pulse, "rgba(255,200,60,.7)");
    g.fillStyle = rad(g, c, c, 0.5, 5, [[0, "#ffffff"], [0.4, "#ffe23d"], [1, "#b86a00"]]); g.beginPath(); g.arc(c, c, 4.6, 0, TAU); g.fill();
  }

  // ------------------------------------------------------------------ pod: spiked spore
  function pod(g, f) {
    var c = 17, a = f * Math.PI / 8;
    for (var i = 0; i < 8; i++) {
      var t = a + i * TAU / 8, r1 = 8, r2 = i % 2 ? 15 : 13;
      g.fillStyle = i % 2 ? "#ff2d6f" : "#c0306a";
      poly(g, [c + Math.cos(t - 0.22) * r1, c + Math.sin(t - 0.22) * r1, c + Math.cos(t) * r2, c + Math.sin(t) * r2, c + Math.cos(t + 0.22) * r1, c + Math.sin(t + 0.22) * r1]); g.fill();
    }
    g.fillStyle = rad(g, c, c, 1, 10, [[0, "#ffd0f8"], [0.35, "#c45cff"], [0.8, "#4a0f7a"], [1, "#1a0430"]], c - 3, c - 3);
    g.beginPath(); g.arc(c, c, 9, 0, TAU); g.fill();
    for (var k = 0; k < 5; k++) { var u = a * 2 + k * 1.3; dot(g, c + Math.cos(u) * 5, c + Math.sin(u) * 5, 1.1, "rgba(255,230,120,.9)"); }
    g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(c - 3, c - 4, 2.6, 1.4, -0.6, 0, TAU); g.fill();
  }

  // ------------------------------------------------------------------ swarmer: small attack drone
  function swarmer(g, f) {
    var cx = 12, cy = 10, flap = f ? 3 : -1;
    g.fillStyle = "rgba(255,120,120,.55)";
    poly(g, [cx - 2, cy, cx - 10, cy - 6 - flap, cx - 6, cy + 1]); g.fill();
    poly(g, [cx + 2, cy, cx + 10, cy - 6 - flap, cx + 6, cy + 1]); g.fill();
    g.fillStyle = lin(g, 0, cy - 6, 0, cy + 7, [[0, "#ffb0a0"], [0.4, "#ff3d3d"], [1, "#5a0606"]]);
    poly(g, [cx, cy - 7, cx + 6, cy + 2, cx, cy + 7, cx - 6, cy + 2]); g.fill();
    glowDot(g, cx, cy, 5, "rgba(255,230,80,.7)"); dot(g, cx, cy, 1.6, "#fff6c0");
  }

  // ------------------------------------------------------------------ baiter: long hunter saucer
  function baiter(g, f) {
    var cx = 28, cy = 10;
    // swept fins
    g.fillStyle = "#1e3206"; poly(g, [6, cy, 1, cy - 7, 14, cy - 3]); g.fill(); poly(g, [50, cy, 55, cy - 7, 42, cy - 3]); g.fill();
    g.fillStyle = lin(g, 0, 3, 0, 17, [[0, "#d8ff8a"], [0.3, "#7ab820"], [0.65, "#2a4a08"], [1, "#0a1400"]]);
    poly(g, [2, cy + 1, 12, cy - 4, 44, cy - 4, 54, cy + 1, 46, cy + 5, 10, cy + 5]); g.fill();
    line(g, [3, cy + 0.6, 12, cy - 3.6, 44, cy - 3.6], 0.7, "rgba(240,255,200,.8)");
    g.fillStyle = "rgba(0,0,0,.5)"; poly(g, [6, cy + 2.5, 50, cy + 2.5, 46, cy + 5, 10, cy + 5]); g.fill();
    // canopy slit
    g.fillStyle = "#0a0a04"; poly(g, [20, cy - 4, 36, cy - 4, 33, cy - 7, 23, cy - 7]); g.fill();
    g.fillStyle = "rgba(255,70,40,.9)"; g.fillRect(23.5, cy - 6, 9, 1.2);
    for (var i = 0; i < 7; i++) { var on = (i + f) % 4 === 0, lx = 10 + i * 6; dot(g, lx, cy + 1, 0.9, on ? "#ffffff" : "#33500a"); if (on) glowDot(g, lx, cy + 1, 3.6, "rgba(220,255,120,.6)"); }
  }

  // ------------------------------------------------------------------ humanoid (realistic proportions)
  function human(g, f) {
    var cx = 8, up = f === 4;
    var sw = up ? 0 : [-1, -0.35, 1, 0.35][f];
    // legs
    var legA = [cx - 1.2, 15, cx - 1.2 + sw * 2.6, 20.5, cx - 1.2 + sw * 3.2, 25.5];
    var legB = [cx + 1.2, 15, cx + 1.2 - sw * 2.6, 20.5, cx + 1.2 - sw * 3.2, 25.5];
    if (up) { legA = [cx - 1.2, 15, cx - 3, 20.5, cx - 4.5, 25]; legB = [cx + 1.2, 15, cx + 3, 20.5, cx + 4.5, 25]; }
    line(g, legB, 2.4, "#2a4a3a"); line(g, legA, 2.4, "#4a7a5a");
    g.fillStyle = "#1a1a22"; g.fillRect(legA[4] - 1.6, legA[5] - 0.4, 3.2, 1.6); g.fillRect(legB[4] - 1.6, legB[5] - 0.4, 3.2, 1.6);
    // arms
    if (up) { line(g, [cx - 2.4, 8, cx - 5, 4, cx - 5.5, 0.8], 1.8, "#7a4ad0"); line(g, [cx + 2.4, 8, cx + 5, 4, cx + 5.5, 0.8], 1.8, "#7a4ad0"); dot(g, cx - 5.5, 0.8, 1, "#f0c8a0"); dot(g, cx + 5.5, 0.8, 1, "#f0c8a0"); }
    else { line(g, [cx + 2.4, 8, cx + 2.6 + sw * 1.6, 12, cx + 2.6 + sw * 2, 14.6], 1.8, "#4a2a90"); }
    // torso: jumpsuit with shading ramp
    g.fillStyle = lin(g, cx - 3, 0, cx + 3, 0, [[0, "#b08cff"], [0.5, "#7a4ad0"], [1, "#3a1a7a"]]);
    poly(g, [cx - 3, 7.4, cx + 3, 7.4, cx + 2.6, 15.4, cx - 2.6, 15.4]); g.fill();
    g.fillStyle = "#e0b040"; g.fillRect(cx - 2.6, 13, 5.2, 1);
    if (!up) line(g, [cx - 2.4, 8, cx - 2.6 - sw * 1.6, 12, cx - 2.6 - sw * 2, 14.6], 1.8, "#9a6ae8");
    // head
    g.fillStyle = rad(g, cx, 4.4, 0.4, 3.2, [[0, "#ffe2c4"], [0.7, "#e0a878"], [1, "#9a6440"]], cx - 1, 3.4);
    g.beginPath(); g.arc(cx, 4.6, 2.7, 0, TAU); g.fill();
    g.fillStyle = "#3a2414"; g.beginPath(); g.arc(cx, 3.9, 2.8, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  }

  // ------------------------------------------------------------------ mine
  function mine(g, f) {
    var c = 7;
    glowDot(g, c, c, f ? 7 : 5, "rgba(255,45,111,.7)");
    g.fillStyle = f ? "#ff6a9a" : "#d01850";
    poly(g, [c, 1, c + 2, c - 2, c + 6, c, c + 2, c + 2, c, 13, c - 2, c + 2, c - 6, c, c - 2, c - 2]); g.fill();
    dot(g, c, c, 1.5, "#ffffff");
  }

  var SPRITES = {
    shipR: { w: 68, h: 32, frames: 2, paint: ship },
    shipL: { w: 68, h: 32, frames: 2, paint: ship, flip: true },
    lander: { w: 40, h: 34, frames: 4, paint: function (g, f) { lander(g, f, false); } },
    mutant: { w: 40, h: 34, frames: 4, paint: function (g, f) { lander(g, f, true); } },
    bomber: { w: 34, h: 34, frames: 4, paint: bomber },
    pod: { w: 34, h: 34, frames: 4, paint: pod },
    swarmer: { w: 24, h: 20, frames: 2, paint: swarmer },
    baiter: { w: 56, h: 20, frames: 4, paint: baiter },
    human: { w: 16, h: 27, frames: 5, paint: human },
    mine: { w: 14, h: 14, frames: 2, paint: mine }
  };

  // Level colour themes: sky ramp, far mountains, terrain body, ridge light
  var THEMES = [
    { name: "dusk", sky: ["#020210", "#0a0a2a", "#24123e", "#4a1c34"], far: ["#2a1a50", "#120a26"], farRim: "rgba(170,130,255,.45)", rock: ["#7a3e26", "#2a120a"], ridge: "#ff9a3c", ridgeGlow: "rgba(255,120,40,.35)", haze: "rgba(255,110,60,.16)", moon: null },
    { name: "night", sky: ["#000006", "#020818", "#06142a", "#0c2032"], far: ["#0e2236", "#040a14"], farRim: "rgba(120,200,255,.35)", rock: ["#3a4050", "#12141c"], ridge: "#ffb44a", ridgeGlow: "rgba(255,170,60,.28)", haze: "rgba(80,160,255,.10)", moon: "#d8ecff" },
    { name: "ember", sky: ["#080000", "#1a0404", "#3a0a06", "#6a1a08"], far: ["#3a0e0a", "#140404"], farRim: "rgba(255,110,80,.45)", rock: ["#6a2a18", "#200806"], ridge: "#ff5a3a", ridgeGlow: "rgba(255,70,40,.4)", haze: "rgba(255,60,20,.2)", moon: null },
    { name: "dawn", sky: ["#08061a", "#2a1a4a", "#8a3a4a", "#e08a4a"], far: ["#4a2a4a", "#1a0e1e"], farRim: "rgba(255,200,140,.55)", rock: ["#7a4a2a", "#24140a"], ridge: "#ffd06a", ridgeGlow: "rgba(255,200,90,.35)", haze: "rgba(255,170,90,.22)", moon: null },
    { name: "toxic", sky: ["#020604", "#06140a", "#12260e", "#2a3a0a"], far: ["#142a14", "#050c06"], farRim: "rgba(170,255,90,.4)", rock: ["#3e4a2a", "#12160a"], ridge: "#c6ff4a", ridgeGlow: "rgba(170,255,60,.3)", haze: "rgba(160,255,60,.12)", moon: "#ff7ae0" },
    { name: "storm", sky: ["#020306", "#0a0e16", "#161c28", "#262a36"], far: ["#1a1e2a", "#07080c"], farRim: "rgba(190,210,255,.4)", rock: ["#44444e", "#141418"], ridge: "#ff8a4a", ridgeGlow: "rgba(255,120,60,.3)", haze: "rgba(160,180,220,.12)", moon: null, storm: true }
  ];

  // terrain texture: layered rock strata with cracks and pebbles (grey, tinted per theme with multiply)
  function rockTile() {
    var c = document.createElement("canvas"); c.width = 256; c.height = 160;
    var g = c.getContext("2d"), s = 12345;
    function r() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 160);
    for (var y = 0; y < 160; y += 4) { g.fillStyle = "rgba(" + (r() < 0.5 ? "255,255,255" : "0,0,0") + "," + (0.08 + r() * 0.16) + ")"; g.fillRect(0, y, 256, 2 + r() * 4); }
    for (var i = 0; i < 380; i++) { var x = r() * 256, yy = r() * 160, w = 1 + r() * 4; g.fillStyle = "rgba(" + (r() < 0.5 ? "255,255,255,.18" : "0,0,0,.25") + ")"; g.fillRect(x, yy, w, w * 0.6); }
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1;
    for (i = 0; i < 26; i++) { var cx = r() * 256, cy = r() * 160; g.beginPath(); g.moveTo(cx, cy); for (var k = 0; k < 4; k++) { cx += (r() - 0.5) * 18; cy += r() * 10; g.lineTo(cx, cy); } g.stroke(); }
    // make seamless horizontally by mirroring edge blend
    var img = g.getImageData(0, 0, 256, 160), d = img.data;
    for (var yy2 = 0; yy2 < 160; yy2++) for (var xx = 0; xx < 24; xx++) { var a = (yy2 * 256 + xx) * 4, b = (yy2 * 256 + (255 - xx)) * 4, t = xx / 24; for (var ch = 0; ch < 3; ch++) d[a + ch] = d[a + ch] * t + d[b + ch] * (1 - t); }
    g.putImageData(img, 0, 0);
    return c;
  }

  window.DefenderArt = { SPRITES: SPRITES, THEMES: THEMES, rockTile: rockTile };
})();

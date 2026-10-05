/* Galaga tribute: hand-built vector sprites, pre-rendered at high resolution with shading, two wing frames each.
   Armored insect-mech look: a little more serious than the 1981 pixel art, same silhouettes and colors. Written by: Howie */
(function () {
  "use strict";
  var RES = 4; // raster pixels per logical unit
  function lg(c, x0, y0, x1, y1, stops) { var g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function rg(c, x, y, r, stops) { var g = c.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function poly(c, pts, mirror) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (mirror) for (var j = pts.length - 1; j >= 0; j--) c.lineTo(-pts[j][0], pts[j][1]);
    c.closePath();
  }
  function both(c, fn) { fn(1); c.save(); c.scale(-1, 1); fn(-1); c.restore(); }
  function ink(c, w) { c.lineJoin = "round"; c.lineWidth = w || 0.7; c.strokeStyle = "rgba(4,6,14,0.85)"; c.stroke(); }
  function glint(c, x, y, r, a) { c.fillStyle = "rgba(255,255,255," + (a || 0.8) + ")"; c.beginPath(); c.ellipse(x, y, r, r * 0.6, -0.5, 0, Math.PI * 2); c.fill(); }

  // ---------------------------------------------------------------- the fighter
  function fighter(c, f, pal) {
    pal = pal || { hull: ["#ffffff", "#c9d2e0", "#7d889c"], trim: "#e0262e", trim2: "#8a0c14", glass: "#2a6cff" };
    // engine glow
    var fl = f ? 1 : 0.8;
    c.fillStyle = rg(c, 0, 15, 5 * fl, [[0, "rgba(255,255,220,0.95)"], [0.4, "rgba(255,170,60,0.7)"], [1, "rgba(255,80,20,0)"]]);
    c.beginPath(); c.ellipse(0, 15.5, 3.2, 5 * fl, 0, 0, Math.PI * 2); c.fill();
    // swept wings
    both(c, function () {
      poly(c, [[2, -2], [9, 4], [15, 9], [15.5, 13], [11, 12], [4, 10], [2, 8]]);
      c.fillStyle = lg(c, 0, -2, 0, 13, [[0, pal.hull[0]], [0.55, pal.hull[1]], [1, pal.hull[2]]]); c.fill(); ink(c);
      poly(c, [[9, 4], [15, 9], [15.5, 13], [12.5, 12.5], [11, 8]]); c.fillStyle = lg(c, 9, 4, 15, 13, [[0, pal.trim], [1, pal.trim2]]); c.fill(); ink(c, 0.5);
      // wingtip cannons
      c.fillStyle = lg(c, 13, 0, 15, 0, [[0, "#9aa4b8"], [0.5, "#ffffff"], [1, "#6a7488"]]);
      c.fillRect(13.3, 1, 1.6, 9); c.strokeStyle = "rgba(4,6,14,0.8)"; c.lineWidth = 0.4; c.strokeRect(13.3, 1, 1.6, 9);
      // tail fin
      poly(c, [[3, 6], [7, 11], [7.5, 15], [4.5, 14], [2.5, 11]]); c.fillStyle = lg(c, 3, 6, 7, 15, [[0, pal.trim], [1, pal.trim2]]); c.fill(); ink(c, 0.5);
      // panel line
      c.beginPath(); c.moveTo(4, 2); c.lineTo(10, 9); c.strokeStyle = "rgba(60,70,90,0.6)"; c.lineWidth = 0.35; c.stroke();
    });
    // fuselage
    poly(c, [[0, -16], [1.6, -11], [3, -3], [3.6, 6], [3, 13], [1.4, 15]], true);
    c.fillStyle = lg(c, -3.6, 0, 3.6, 0, [[0, pal.hull[2]], [0.35, pal.hull[0]], [0.6, pal.hull[1]], [1, pal.hull[2]]]); c.fill(); ink(c);
    // nose cannon
    c.fillStyle = "#e8ecf4"; c.fillRect(-0.6, -17.5, 1.2, 3);
    // canopy
    c.beginPath(); c.ellipse(0, -3, 1.7, 4.2, 0, 0, Math.PI * 2);
    c.fillStyle = lg(c, 0, -7, 0, 1, [[0, "#bfe4ff"], [0.4, pal.glass], [1, "#0a1a4a"]]); c.fill(); ink(c, 0.4);
    glint(c, -0.5, -5, 0.6, 0.9);
    // red spine stripe
    c.fillStyle = pal.trim; c.fillRect(-0.5, 3, 1, 9);
  }

  // ---------------------------------------------------------------- bee (Zako): armored wasp
  function bee(c, f, pal) {
    pal = pal || { body: ["#fff27a", "#f2b51c", "#8a5206"], band: "#1d3fae", wing: "rgba(120,170,255,", vein: "#2a5ad8", sting: "#e0262e" };
    var spread = f ? 1 : 0.62;
    both(c, function () {
      c.save(); c.translate(3, -1); c.rotate(-0.25 * spread);
      poly(c, [[0, 0], [5, -6 * spread - 2], [11, -7 * spread - 1], [13, -3], [11, 2], [5, 4]]);
      c.fillStyle = lg(c, 0, -8, 12, 3, [[0, pal.wing + "0.85)"], [0.6, pal.wing + "0.55)"], [1, pal.wing + "0.3)"]]); c.fill(); ink(c, 0.55);
      c.beginPath(); c.moveTo(1, 0); c.lineTo(11, -5 * spread); c.moveTo(3, 1.5); c.lineTo(11.5, 0); c.moveTo(5, -2); c.lineTo(8, -6 * spread);
      c.strokeStyle = pal.vein; c.lineWidth = 0.45; c.stroke();
      c.restore();
      // legs
      c.beginPath(); c.moveTo(2, 4); c.lineTo(6, 8); c.lineTo(6.5, 11); c.moveTo(2, 1); c.lineTo(6.5, 3); c.lineTo(8.5, 6);
      c.strokeStyle = "#3a2a10"; c.lineWidth = 0.7; c.stroke();
      // antenna
      c.beginPath(); c.moveTo(1, -9); c.quadraticCurveTo(3, -13, 5.5, -13.5); c.strokeStyle = "#f2c84a"; c.lineWidth = 0.6; c.stroke();
      c.fillStyle = "#ff5a3a"; c.beginPath(); c.arc(5.6, -13.5, 0.9, 0, 7); c.fill();
    });
    // abdomen
    c.beginPath(); c.ellipse(0, 5, 4.2, 7, 0, 0, Math.PI * 2);
    c.fillStyle = lg(c, -4, 0, 4, 0, [[0, pal.body[2]], [0.35, pal.body[0]], [0.65, pal.body[1]], [1, pal.body[2]]]); c.fill(); ink(c);
    c.save(); c.clip();
    [2.5, 6, 9.5].forEach(function (y) { c.fillStyle = pal.band; c.fillRect(-5, y, 10, 1.6); });
    c.restore();
    // stinger
    poly(c, [[0, 14.5], [1.2, 11], [-1.2, 11]]); c.fillStyle = pal.sting; c.fill(); ink(c, 0.4);
    // thorax + head
    c.beginPath(); c.ellipse(0, -3.5, 3.4, 3.2, 0, 0, Math.PI * 2); c.fillStyle = lg(c, -3, -6, 3, -1, [[0, pal.body[0]], [1, pal.body[2]]]); c.fill(); ink(c);
    c.beginPath(); c.ellipse(0, -8.5, 2.8, 2.6, 0, 0, Math.PI * 2); c.fillStyle = lg(c, 0, -11, 0, -6, [[0, "#6a8cff"], [1, pal.band]]); c.fill(); ink(c);
    // eyes
    both(c, function () { c.fillStyle = "#ff3a2a"; c.beginPath(); c.ellipse(1.4, -9, 0.9, 1.1, 0.4, 0, 7); c.fill(); glint(c, 1.2, -9.4, 0.3); });
  }

  // ---------------------------------------------------------------- butterfly (Goei): crimson moth-mech
  function butterfly(c, f, pal) {
    pal = pal || { body: ["#ff8a7a", "#d01818", "#5a0408"], wing: ["#ffffff", "#c8d4ec", "#7a8ab0"], edge: "#1d3fae", mark: "#e0262e" };
    var spread = f ? 1 : 0.55;
    both(c, function () {
      c.save(); c.translate(2, -2); c.scale(1, 0.7 + 0.3 * spread);
      // upper wing
      poly(c, [[0, 0], [4, -8], [10, -11], [15, -8], [15.5, -2], [12, 2], [4, 3]]);
      c.fillStyle = lg(c, 0, -10, 15, 2, [[0, pal.wing[0]], [0.6, pal.wing[1]], [1, pal.wing[2]]]); c.fill();
      c.lineWidth = 1.1; c.strokeStyle = pal.edge; c.stroke(); ink(c, 0.4);
      c.fillStyle = pal.mark; c.beginPath(); c.ellipse(9.5, -5, 2.4, 1.6, -0.4, 0, 7); c.fill(); ink(c, 0.3);
      c.beginPath(); c.moveTo(1, 0); c.lineTo(13, -6); c.moveTo(2, 1.5); c.lineTo(14, -1); c.strokeStyle = "rgba(40,60,140,0.5)"; c.lineWidth = 0.4; c.stroke();
      // lower wing
      poly(c, [[1, 3], [8, 3], [12, 7], [10, 11], [5, 10], [1, 7]]);
      c.fillStyle = lg(c, 0, 3, 10, 11, [[0, pal.wing[1]], [1, pal.wing[2]]]); c.fill(); c.lineWidth = 0.9; c.strokeStyle = pal.edge; c.stroke(); ink(c, 0.35);
      c.restore();
      c.beginPath(); c.moveTo(0.8, -8); c.quadraticCurveTo(2, -13, 4.5, -14); c.strokeStyle = "#ffd0c0"; c.lineWidth = 0.55; c.stroke();
    });
    // body
    c.beginPath(); c.ellipse(0, 2, 2.6, 9.5, 0, 0, Math.PI * 2);
    c.fillStyle = lg(c, -2.6, 0, 2.6, 0, [[0, pal.body[2]], [0.4, pal.body[0]], [0.7, pal.body[1]], [1, pal.body[2]]]); c.fill(); ink(c);
    c.save(); c.clip(); for (var y = -2; y < 12; y += 3) { c.fillStyle = "rgba(60,0,0,0.45)"; c.fillRect(-3, y, 6, 0.7); } c.restore();
    c.beginPath(); c.ellipse(0, -8.5, 2.4, 2.2, 0, 0, Math.PI * 2); c.fillStyle = lg(c, 0, -11, 0, -6, [[0, "#ffb0a0"], [1, pal.body[1]]]); c.fill(); ink(c);
    both(c, function () { c.fillStyle = "#ffe060"; c.beginPath(); c.ellipse(1.2, -9, 0.8, 1, 0.3, 0, 7); c.fill(); });
  }

  // ---------------------------------------------------------------- Boss Galaga: armored beetle commander
  function boss(c, f, pal) {
    pal = pal || { shell: ["#b8ffb0", "#2fb84a", "#0a4a1a"], head: ["#fff6a0", "#f0a020"], mark: "#ffcf3a", wing: "rgba(150,255,190,", eye: "#ff3020" };
    var spread = f ? 1 : 0.6;
    both(c, function () {
      // outer wing blades
      c.save(); c.translate(6, 2); c.rotate(-0.15 * spread);
      poly(c, [[0, -4], [8, -8 * spread - 2], [13, -4], [13.5, 3], [9, 8], [2, 6]]);
      c.fillStyle = lg(c, 0, -8, 13, 8, [[0, pal.wing + "0.8)"], [1, pal.wing + "0.25)"]]); c.fill(); ink(c, 0.55);
      c.beginPath(); c.moveTo(1, -2); c.lineTo(12, -3); c.moveTo(2, 2); c.lineTo(11, 5); c.strokeStyle = pal.shell[1]; c.lineWidth = 0.5; c.stroke();
      c.restore();
      // shoulder plate
      poly(c, [[2, -6], [9, -8], [12, -3], [11, 4], [6, 9], [2, 9]]);
      c.fillStyle = lg(c, 2, -8, 12, 9, [[0, pal.shell[0]], [0.5, pal.shell[1]], [1, pal.shell[2]]]); c.fill(); ink(c);
      c.fillStyle = pal.mark; poly(c, [[6, -5], [9.5, -5], [10, -1], [7, 1]]); c.fill(); ink(c, 0.35);
      // mandible
      poly(c, [[1.5, -11], [5, -15], [6.5, -17], [5.5, -13], [3, -9]]); c.fillStyle = lg(c, 2, -17, 5, -9, [[0, pal.head[0]], [1, pal.head[1]]]); c.fill(); ink(c, 0.45);
    });
    // central shell
    poly(c, [[0, -9], [3.5, -8], [5, -2], [4.6, 7], [2.5, 13], [0, 14.5]], true);
    c.fillStyle = lg(c, -5, 0, 5, 0, [[0, pal.shell[2]], [0.4, pal.shell[0]], [0.65, pal.shell[1]], [1, pal.shell[2]]]); c.fill(); ink(c);
    c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 14); c.strokeStyle = "rgba(0,30,10,0.55)"; c.lineWidth = 0.5; c.stroke();
    [[-2.5, 2], [2.5, 2], [-2, 8], [2, 8]].forEach(function (p) { c.fillStyle = pal.mark; c.beginPath(); c.arc(p[0], p[1], 1, 0, 7); c.fill(); });
    // head with crest
    c.beginPath(); c.ellipse(0, -11, 4, 3.4, 0, 0, Math.PI * 2); c.fillStyle = lg(c, 0, -15, 0, -8, [[0, pal.head[0]], [1, pal.head[1]]]); c.fill(); ink(c);
    poly(c, [[0, -17], [1.5, -14], [-1.5, -14]]); c.fillStyle = pal.head[1]; c.fill(); ink(c, 0.4);
    both(c, function () { c.fillStyle = pal.eye; c.beginPath(); c.ellipse(1.8, -11.3, 1.1, 1.4, 0.3, 0, 7); c.fill(); glint(c, 1.5, -11.8, 0.35); });
  }

  // ---------------------------------------------------------------- challenging-stage visitors
  function dragonfly(c, f) {
    var spread = f ? 1 : 0.5;
    both(c, function () {
      [[-3, 1], [2, 0.85]].forEach(function (w, i) {
        c.save(); c.translate(1, w[0]); c.rotate((i ? 0.25 : -0.2) * spread);
        c.beginPath(); c.ellipse(8, 0, 8, 2.2 * w[1], 0, 0, Math.PI * 2);
        c.fillStyle = lg(c, 0, -2, 16, 2, [[0, "rgba(200,255,230,0.85)"], [1, "rgba(80,220,200,0.3)"]]); c.fill(); ink(c, 0.45);
        c.beginPath(); c.moveTo(1, 0); c.lineTo(15, 0); c.strokeStyle = "#1a8a7a"; c.lineWidth = 0.4; c.stroke();
        c.restore();
      });
    });
    c.beginPath(); c.ellipse(0, 4, 1.6, 10, 0, 0, Math.PI * 2); c.fillStyle = lg(c, -2, 0, 2, 0, [[0, "#0a5a3a"], [0.5, "#7affb0"], [1, "#0a5a3a"]]); c.fill(); ink(c);
    c.save(); c.clip(); for (var y = -2; y < 14; y += 2.6) { c.fillStyle = "#ffd040"; c.fillRect(-2, y, 4, 0.8); } c.restore();
    c.beginPath(); c.ellipse(0, -7, 3, 2.6, 0, 0, Math.PI * 2); c.fillStyle = lg(c, 0, -10, 0, -4, [[0, "#b0ffd0"], [1, "#1a9a5a"]]); c.fill(); ink(c);
    both(c, function () { c.fillStyle = "#30e0ff"; c.beginPath(); c.ellipse(1.6, -7.5, 1.3, 1.5, 0, 0, 7); c.fill(); glint(c, 1.3, -8, 0.4); });
  }
  function scorpion(c, f) {
    var curl = f ? 1 : 0.7;
    both(c, function () {
      // pincers
      c.beginPath(); c.moveTo(2, -6); c.quadraticCurveTo(8, -9, 8, -14); c.lineTo(6, -12); c.quadraticCurveTo(6, -9, 2, -8); c.closePath();
      c.fillStyle = lg(c, 2, -14, 8, -6, [[0, "#ffe0a0"], [1, "#c06a10"]]); c.fill(); ink(c, 0.45);
      // legs
      c.beginPath(); for (var i = 0; i < 3; i++) { c.moveTo(2.5, -2 + i * 3); c.lineTo(8, -3 + i * 4); c.lineTo(10, 1 + i * 4); }
      c.strokeStyle = "#a05010"; c.lineWidth = 0.8; c.stroke();
    });
    c.beginPath(); c.ellipse(0, 0, 4, 6.5, 0, 0, Math.PI * 2); c.fillStyle = lg(c, -4, 0, 4, 0, [[0, "#6a2a06"], [0.4, "#ffb050"], [1, "#6a2a06"]]); c.fill(); ink(c);
    // tail segments curling over
    for (var k = 0; k < 4; k++) {
      var y = 7 + k * 2.6 * curl, r = 2.4 - k * 0.3;
      c.beginPath(); c.arc(0, y, r, 0, 7); c.fillStyle = k === 3 ? "#ff3a2a" : "#e08a30"; c.fill(); ink(c, 0.4);
    }
    c.beginPath(); c.ellipse(0, -6.5, 2.6, 2, 0, 0, Math.PI * 2); c.fillStyle = "#ffcf80"; c.fill(); ink(c);
    both(c, function () { c.fillStyle = "#3040ff"; c.beginPath(); c.arc(1.2, -6.8, 0.7, 0, 7); c.fill(); });
  }

  var DRAW = { fighter: fighter, bee: bee, butterfly: butterfly, boss: boss, dragonfly: dragonfly, scorpion: scorpion };
  var SIZE = { fighter: 38, bee: 34, butterfly: 38, boss: 42, dragonfly: 36, scorpion: 32, captive: 38, boss2: 42 };
  var PAL = {
    captive: { hull: ["#ffd0d0", "#e07070", "#802030"], trim: "#ff3030", trim2: "#600810", glass: "#ff6a2a" },
    boss2: { shell: ["#e0c0ff", "#7a3ad8", "#2a0a5a"], head: ["#c0e0ff", "#3a6ae0"], mark: "#7ad8ff", wing: "rgba(190,160,255,", eye: "#ffd040" }
  };
  var cache = {};
  function sprite(kind, frame) {
    var key = kind + (frame ? 1 : 0);
    if (cache[key]) return cache[key];
    var base = kind === "captive" ? "fighter" : kind === "boss2" ? "boss" : kind;
    var s = SIZE[kind], cv = document.createElement("canvas");
    cv.width = cv.height = Math.ceil(s * RES);
    var c = cv.getContext("2d");
    c.translate(cv.width / 2, cv.height / 2); c.scale(RES, RES);
    DRAW[base](c, frame ? 1 : 0, PAL[kind]);
    return (cache[key] = { cv: cv, s: s });
  }
  // a stage badge (the stack of insignia in the corner): 1, 5, 10, 20, 30, 50
  function badge(c, x, y, val, k) {
    k = k || 1;
    c.save(); c.translate(x, y); c.scale(k, k);
    if (val === 1) {
      c.fillStyle = "#c8ccd8"; c.fillRect(-0.5, -9, 1, 10);
      poly(c, [[0.5, -9], [6, -7], [0.5, -4.5]]); c.fillStyle = "#e0262e"; c.fill();
      poly(c, [[0.5, -4.5], [4, -3.3], [0.5, -2]]); c.fillStyle = "#ffd040"; c.fill();
    } else if (val === 5) {
      poly(c, [[0, -10], [4, -6], [4, 0], [0, -3], [-4, 0], [-4, -6]]); c.fillStyle = lg(c, 0, -10, 0, 0, [[0, "#ff5a5a"], [1, "#a01010"]]); c.fill(); ink(c, 0.5);
      c.fillStyle = "#fff"; c.fillRect(-0.6, -8, 1.2, 4);
    } else {
      var col = val === 10 ? ["#ffffff", "#2a6cff"] : val === 20 ? ["#ffe060", "#d01818"] : val === 30 ? ["#a0ffb0", "#1a8a3a"] : ["#ffd0ff", "#7a2ab0"];
      poly(c, [[0, -12], [6, -8], [6, -2], [0, 2], [-6, -2], [-6, -8]]); c.fillStyle = lg(c, 0, -12, 0, 2, [[0, col[0]], [1, col[1]]]); c.fill(); ink(c, 0.6);
      poly(c, [[0, -9], [3, -6.5], [0, -1.5], [-3, -6.5]]); c.fillStyle = col[1]; c.fill();
    }
    c.restore();
  }
  window.GalagaArt = { sprite: sprite, SIZE: SIZE, badge: badge, RES: RES, KINDS: Object.keys(SIZE) };
})();

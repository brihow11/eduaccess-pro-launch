/* Rampart: Space Edition (orbital tower defense) - procedural art: noise, planets, nebulae, ships, turrets.
   Everything is drawn in code at load time and cached; nothing here flashes. Written by: Howie */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // ---------- seeded value noise (3D, so sphere textures wrap seamlessly) ----------
  function Noise(seed) {
    var p = new Uint8Array(512), r = seed >>> 0 || 1, i;
    function rnd() { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; return (r >>> 0) / 4294967296; }
    var perm = []; for (i = 0; i < 256; i++) perm[i] = i;
    for (i = 255; i > 0; i--) { var j = (rnd() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 512; i++) p[i] = perm[i & 255];
    var vals = new Float32Array(256); for (i = 0; i < 256; i++) vals[i] = rnd();
    function n3(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      xi &= 255; yi &= 255; zi &= 255;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      var a = p[xi] + yi, aa = p[a] + zi, ab = p[a + 1] + zi, b = p[xi + 1] + yi, ba = p[b] + zi, bb = p[b + 1] + zi;
      var x1 = lerp(vals[p[aa]], vals[p[ba]], u), x2 = lerp(vals[p[ab]], vals[p[bb]], u);
      var y1 = lerp(x1, x2, v);
      x1 = lerp(vals[p[aa + 1]], vals[p[ba + 1]], u); x2 = lerp(vals[p[ab + 1]], vals[p[bb + 1]], u);
      return lerp(y1, lerp(x1, x2, v), w);
    }
    function fbm(x, y, z, oct) { var s = 0, a = 0.5, f = 1, n = 0; for (var o = 0; o < oct; o++) { s += a * n3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
    function ridge(x, y, z, oct) { var s = 0, a = 0.5, f = 1, n = 0; for (var o = 0; o < oct; o++) { var v = 1 - Math.abs(n3(x * f, y * f, z * f) * 2 - 1); s += a * v * v; n += a; a *= 0.5; f *= 2.1; } return s / n; }
    return { n3: n3, fbm: fbm, ridge: ridge, rnd: rnd };
  }

  // ---------- planet palettes ----------
  // each returns {c:[r,g,b] 0..255, e:[r,g,b] emissive, sp: specular 0..1} for a texel
  var PAL = {
    terran: function (N, x, y, z, lat) {
      var h = N.fbm(x * 1.6 + 7, y * 1.6, z * 1.6, 6), m = N.fbm(x * 2.2, y * 2.2 + 11, z * 2.2, 4), d = h - 0.52, c, sp = 0, e = [0, 0, 0];
      if (d < 0) { c = mix([8, 28, 74], [30, 104, 160], sstep(-0.16, 0, d)); c = mix(c, [60, 140, 170], sstep(-0.012, 0, d)); sp = 0.9; }
      else if (d < 0.012) c = mix([170, 168, 130], [120, 130, 80], d / 0.012);
      else { var g = mix([46, 100, 40], [120, 112, 64], sstep(0.35, 0.65, m)); g = mix(g, [104, 86, 66], sstep(0.07, 0.14, d)); c = mix(g, [236, 236, 240], sstep(0.16, 0.2, d)); 
        if (N.n3(x * 40, y * 40, z * 40) > 0.83 && d < 0.09 && Math.abs(lat) < 1.1) e = [255, 196, 110]; }
      var ice = sstep(1.18, 1.3, Math.abs(lat) + (N.n3(x * 6, y * 6, z * 6) - 0.5) * 0.3); c = mix(c, [236, 242, 250], ice); if (ice > 0.5) sp = 0.2;
      return { c: c, e: e, sp: sp };
    },
    desert: function (N, x, y, z, lat) {
      var h = N.fbm(x * 2, y * 2, z * 2, 6), r = N.ridge(x * 3, y * 3, z * 3, 5), c = mix([150, 84, 42], [222, 164, 98], h);
      c = mix(c, [96, 50, 30], sstep(0.62, 0.85, r) * 0.7); c = mix(c, [240, 214, 170], sstep(0.62, 0.72, h) * 0.6);
      return { c: c, e: [0, 0, 0], sp: 0 };
    },
    red: function (N, x, y, z, lat) {
      var h = N.fbm(x * 2.4, y * 2.4, z * 2.4, 6), r = N.ridge(x * 2.5 + 3, y * 2.5, z * 2.5, 5), c = mix([96, 32, 20], [190, 86, 48], h);
      c = mix(c, [60, 20, 16], sstep(0.6, 0.85, r) * 0.8); c = mix(c, [236, 226, 220], sstep(1.25, 1.35, Math.abs(lat)));
      return { c: c, e: [0, 0, 0], sp: 0 };
    },
    ice: function (N, x, y, z, lat) {
      var h = N.fbm(x * 2, y * 2, z * 2, 5), r = N.ridge(x * 4, y * 4, z * 4, 5), c = mix([150, 182, 214], [238, 246, 255], h);
      c = mix(c, [70, 110, 160], sstep(0.78, 0.95, r) * 0.8);
      return { c: c, e: [0, 0, 0], sp: 0.35 };
    },
    lava: function (N, x, y, z, lat) {
      var h = N.fbm(x * 2.2, y * 2.2, z * 2.2, 5), r = N.ridge(x * 3.2, y * 3.2, z * 3.2, 5), c = mix([24, 20, 22], [70, 58, 54], h), k = sstep(0.8, 0.95, r);
      return { c: mix(c, [120, 40, 10], k), e: [255 * k, 120 * k, 30 * k], sp: 0 };
    },
    ocean: function (N, x, y, z, lat) {
      var h = N.fbm(x * 1.8, y * 1.8, z * 1.8, 6), d = h - 0.62, c, sp = 0;
      if (d < 0) { c = mix([4, 26, 70], [20, 104, 160], sstep(-0.25, 0, d)); sp = 1; } else c = mix([40, 120, 70], [160, 150, 100], sstep(0, 0.08, d));
      return { c: c, e: [0, 0, 0], sp: sp };
    },
    gas: function (N, x, y, z, lat) {
      var t = N.fbm(x * 1.2, y * 1.2, z * 1.2, 4), b = Math.sin(lat * 9 + (t - 0.5) * 5) * 0.5 + 0.5, c = mix([178, 128, 84], [238, 220, 186], b);
      c = mix(c, [140, 80, 50], sstep(0.55, 0.8, N.fbm(x * 4, y * 9, z * 4, 4)) * 0.4);
      var sx = x - 0.6, sy = y + 0.35, sz = z - 0.7, sd = Math.sqrt(sx * sx + sy * sy * 3 + sz * sz); c = mix(c, [190, 80, 50], sstep(0.32, 0.12, sd) * 0.8);
      return { c: c, e: [0, 0, 0], sp: 0 };
    },
    teal: function (N, x, y, z, lat) {
      var t = N.fbm(x * 1.4, y * 1.4, z * 1.4, 4), b = Math.sin(lat * 7 + (t - 0.5) * 4) * 0.5 + 0.5, c = mix([40, 120, 130], [170, 230, 220], b);
      return { c: c, e: [0, 0, 0], sp: 0 };
    },
    toxic: function (N, x, y, z, lat) {
      var h = N.fbm(x * 2, y * 2, z * 2, 6), b = Math.sin(lat * 5 + h * 6) * 0.5 + 0.5, c = mix([120, 130, 30], [210, 200, 90], b * 0.6 + h * 0.4);
      return { c: c, e: [0, 0, 0], sp: 0 };
    },
    violet: function (N, x, y, z, lat) {
      var h = N.fbm(x * 2, y * 2, z * 2, 6), r = N.ridge(x * 3, y * 3, z * 3, 5), c = mix([46, 20, 70], [150, 80, 170], h), k = sstep(0.82, 0.95, r);
      return { c: mix(c, [80, 200, 160], k * 0.5), e: [60 * k, 255 * k, 170 * k], sp: 0 };
    },
    dark: function (N, x, y, z, lat) {
      var h = N.fbm(x * 1.6, y * 1.6, z * 1.6, 6), d = h - 0.5, c;
      if (d < 0) c = mix([6, 14, 34], [16, 46, 90], sstep(-0.2, 0, d)); else c = mix([50, 64, 44], [110, 100, 90], sstep(0, 0.15, d));
      var e = (d > 0 && N.n3(x * 50, y * 50, z * 50) > 0.78) ? [255, 210, 140] : [0, 0, 0];
      return { c: c, e: e, sp: d < 0 ? 0.8 : 0 };
    }
  };
  var CLOUDS = { terran: 0.75, desert: 0.12, red: 0.15, ice: 0.3, lava: 0.35, ocean: 0.9, gas: 0, teal: 0, toxic: 0.55, violet: 0.25, dark: 0.6 };
  var CLOUDC = { lava: [70, 60, 60], toxic: [220, 220, 150], violet: [200, 170, 230] };

  // Planet: equirect texture + per-pixel sphere projection, rotated by shifting longitude.
  function Planet(type, seed, opt) {
    opt = opt || {};
    var N = Noise(seed), TW = 576, TH = 288, tex = new Uint8ClampedArray(TW * TH * 3), emi = new Uint8ClampedArray(TW * TH * 3), spc = new Uint8ClampedArray(TW * TH), cld = new Uint8ClampedArray(TW * TH);
    var pal = PAL[type] || PAL.terran, cloudAmt = CLOUDS[type] || 0, cc = CLOUDC[type] || [246, 248, 252];
    for (var j = 0; j < TH; j++) {
      var lat = (j / (TH - 1) - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (var i = 0; i < TW; i++) {
        var lon = i / TW * TAU, x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon), k = j * TW + i, s = pal(N, x, y, z, lat);
        tex[k * 3] = s.c[0]; tex[k * 3 + 1] = s.c[1]; tex[k * 3 + 2] = s.c[2]; emi[k * 3] = s.e[0]; emi[k * 3 + 1] = s.e[1]; emi[k * 3 + 2] = s.e[2]; spc[k] = s.sp * 255;
        if (cloudAmt > 0) { var cv = N.fbm(x * 2.6 + 40, y * 5.2, z * 2.6, 5); cv = sstep(0.62 - cloudAmt * 0.16, 0.8, cv) * (0.4 + cloudAmt * 0.6); cld[k] = cv * 255; }
      }
    }
    var S = 0, can = null, cx = null, img = null, pre = null, lastRot = -1;
    var tilt = opt.tilt == null ? 0.35 : opt.tilt, lx = -0.62, ly = -0.42, lz = 0.66, ln = Math.sqrt(lx * lx + ly * ly + lz * lz); lx /= ln; ly /= ln; lz /= ln;
    var hx = lx, hy = ly, hz = lz + 1, hn = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hn; hy /= hn; hz /= hn;
    function setup(size) {
      S = size; can = mk(S, S); cx = can.getContext('2d'); img = cx.createImageData(S, S);
      var n = S * S; pre = { u: new Float32Array(n), v: new Uint16Array(n), fv: new Float32Array(n), L: new Float32Array(n), sp: new Float32Array(n), a: new Float32Array(n) };
      var ct = Math.cos(tilt), st = Math.sin(tilt);
      for (var py = 0; py < S; py++) for (var px = 0; px < S; px++) {
        var k = py * S + px, nx = (px + 0.5) / S * 2 - 1, ny = (py + 0.5) / S * 2 - 1, rr = nx * nx + ny * ny;
        if (rr > 1) { pre.a[k] = 0; continue; }
        var nz = Math.sqrt(1 - rr), edge = clamp((1 - Math.sqrt(rr)) * S * 0.5, 0, 1);
        var tx = nx * ct + ny * st, ty = -nx * st + ny * ct; // axial tilt
        var lat = Math.asin(clamp(ty, -1, 1)), lon = Math.atan2(tx, nz);
        pre.u[k] = (lon / TAU + 1) * TW; var vf = clamp((lat / Math.PI + 0.5) * (TH - 1), 0, TH - 1); pre.v[k] = vf | 0; pre.fv[k] = vf - (vf | 0);
        var d = nx * lx + ny * ly + nz * lz; pre.L[k] = sstep(-0.18, 0.55, d) * (0.25 + 0.75 * clamp(d, 0, 1)) + 0.025;
        var hd = clamp(nx * hx + ny * hy + nz * hz, 0, 1); pre.sp[k] = Math.pow(hd, 40) * 0.9;
        pre.a[k] = edge;
      }
    }
    function render(rot) {
      var D = img.data, n = S * S, sh = rot * TW / TAU, csh = sh * 1.25;
      for (var k = 0; k < n; k++) {
        var a = pre.a[k], o = k * 4; if (a <= 0) { D[o + 3] = 0; continue; }
        var uf = pre.u[k] + sh, u0 = uf | 0, fu = uf - u0, v = pre.v[k], fv = pre.fv[k], u = u0 % TW, u1 = (u0 + 1) % TW, v1 = v < TH - 1 ? v + 1 : v, L = pre.L[k];
        var t = v * TW + u, t1 = v * TW + u1, t2 = v1 * TW + u, t3 = v1 * TW + u1, w0 = (1 - fu) * (1 - fv), w1 = fu * (1 - fv), w2 = (1 - fu) * fv, w3 = fu * fv;
        var uc = ((pre.u[k] + csh) | 0) % TW, uc1 = (uc + 1) % TW, cv = (cld[v * TW + uc] * (1 - fu) + cld[v * TW + uc1] * fu) * (1 - fv) / 255 + (cld[v1 * TW + uc] * (1 - fu) + cld[v1 * TW + uc1] * fu) * fv / 255;
        var r = tex[t * 3] * w0 + tex[t1 * 3] * w1 + tex[t2 * 3] * w2 + tex[t3 * 3] * w3, g = tex[t * 3 + 1] * w0 + tex[t1 * 3 + 1] * w1 + tex[t2 * 3 + 1] * w2 + tex[t3 * 3 + 1] * w3, b = tex[t * 3 + 2] * w0 + tex[t1 * 3 + 2] * w1 + tex[t2 * 3 + 2] * w2 + tex[t3 * 3 + 2] * w3;
        r = r + (cc[0] - r) * cv; g = g + (cc[1] - g) * cv; b = b + (cc[2] - b) * cv;
        var spec = pre.sp[k] * (spc[t] / 255) * (1 - cv) * 255, night = clamp(1 - L * 3, 0, 1) * (1 - cv * 0.8);
        D[o] = r * L + spec + emi[t * 3] * night; D[o + 1] = g * L + spec + emi[t * 3 + 1] * night; D[o + 2] = b * L + spec * 0.95 + emi[t * 3 + 2] * night; D[o + 3] = a * 255;
      }
      cx.putImageData(img, 0, 0);
    }
    var atm = opt.atm || [120, 180, 255];
    return {
      type: type,
      draw: function (ctx, x, y, r, t, pxScale) {
        var want = clamp(Math.round(r * 2 * (pxScale || 1)), 64, 420);
        if (Math.abs(want - S) > 24 || !can) { setup(want); lastRot = -1; }
        var rot = t * (opt.spin || 0.035);
        if (Math.abs(rot - lastRot) > 0.004 || lastRot < 0) { render(rot); lastRot = rot; }
        // soft outer atmosphere
        var g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.28);
        g.addColorStop(0, 'rgba(' + atm + ',0.42)'); g.addColorStop(0.35, 'rgba(' + atm + ',0.14)'); g.addColorStop(1, 'rgba(' + atm + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.28, 0, TAU); ctx.fill();
        ctx.drawImage(can, x - r, y - r, r * 2, r * 2);
        // lit-side rim scattering
        var g2 = ctx.createRadialGradient(x + r * 0.25, y + r * 0.18, r * 0.82, x, y, r * 1.02);
        g2.addColorStop(0, 'rgba(' + atm + ',0)'); g2.addColorStop(0.8, 'rgba(' + atm + ',0.10)'); g2.addColorStop(1, 'rgba(' + atm + ',0.5)');
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.15, r * 1.02, 0, TAU); ctx.fill(); ctx.restore();
      }
    };
  }

  // ---------- nebula backdrop (low-res fbm, upscaled smooth) + crisp stars ----------
  function Backdrop(seed, theme, w, h) {
    var N = Noise(seed), bw = 360, bh = 203, c = mk(bw, bh), x = c.getContext('2d'), im = x.createImageData(bw, bh), D = im.data;
    var A = theme.a, B = theme.b, C = theme.c;
    for (var j = 0; j < bh; j++) for (var i = 0; i < bw; i++) {
      var u = i / bw * 3.2, v = j / bh * 1.8, w1 = N.fbm(u + 3, v, 0.5, 4);
      var f = N.fbm(u + w1 * 1.6, v + w1 * 1.2, 1.3, 6), g = N.fbm(u * 1.7 + 9, v * 1.7 - w1, 2.1, 5), dust = N.ridge(u * 1.3, v * 1.3 + 4, 3.3, 5);
      var band = Math.exp(-Math.pow((v - 0.9 - (u - 1.6) * theme.tilt) / 0.55, 2));
      var k = sstep(0.42, 0.85, f) * (0.35 + band * 0.9), k2 = sstep(0.5, 0.85, g) * band, dk = sstep(0.55, 0.85, dust) * band;
      var r = A[0] * k + B[0] * k2 + C[0] * k * k2, gg = A[1] * k + B[1] * k2 + C[1] * k * k2, b = A[2] * k + B[2] * k2 + C[2] * k * k2;
      var dd = 1 - dk * 0.75, o = (j * bw + i) * 4;
      D[o] = 3 + r * dd; D[o + 1] = 4 + gg * dd; D[o + 2] = 10 + b * dd; D[o + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    var big = mk(w, h), bx = big.getContext('2d'); bx.imageSmoothingQuality = 'high';
    bx.filter = 'blur(2px)'; bx.drawImage(c, 0, 0, w, h); bx.filter = 'none';
    // stars: many faint + few bright with soft halo and diffraction spikes (static, no twinkle here)
    var rnd = N.rnd, n = Math.round(w * h / 900);
    for (var s = 0; s < n; s++) {
      var sx = rnd() * w, sy = rnd() * h, m = Math.pow(rnd(), 3), col = rnd() < 0.15 ? '255,214,180' : rnd() < 0.3 ? '180,210,255' : '240,244,255';
      bx.fillStyle = 'rgba(' + col + ',' + (0.25 + m * 0.75) + ')'; bx.fillRect(sx, sy, m > 0.6 ? 1.6 : 1, m > 0.6 ? 1.6 : 1);
      if (m > 0.85) { var gr = bx.createRadialGradient(sx, sy, 0, sx, sy, 7); gr.addColorStop(0, 'rgba(' + col + ',0.5)'); gr.addColorStop(1, 'rgba(' + col + ',0)'); bx.fillStyle = gr; bx.fillRect(sx - 7, sy - 7, 14, 14);
        bx.strokeStyle = 'rgba(' + col + ',0.22)'; bx.lineWidth = 0.7; bx.beginPath(); bx.moveTo(sx - 9, sy); bx.lineTo(sx + 9, sy); bx.moveTo(sx, sy - 9); bx.lineTo(sx, sy + 9); bx.stroke(); }
    }
    // a distant star cluster glow
    var gx = w * theme.gx, gy = h * theme.gy, gg2 = bx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.12);
    gg2.addColorStop(0, 'rgba(255,240,220,0.16)'); gg2.addColorStop(1, 'rgba(255,240,220,0)'); bx.fillStyle = gg2; bx.fillRect(0, 0, w, h);
    return big;
  }

  // ---------- glow sprite (tinted radial) ----------
  var glowCache = {};
  function glow(col) {
    if (glowCache[col]) return glowCache[col];
    var c = mk(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + col + ',1)'); g.addColorStop(0.25, 'rgba(' + col + ',0.5)'); g.addColorStop(0.6, 'rgba(' + col + ',0.12)'); g.addColorStop(1, 'rgba(' + col + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (glowCache[col] = c);
  }

  // ---------- ships (drawn pointing +x, cached at 2.5x) ----------
  function metal(x, x0, y0, x1, y1, c1, c2, c3) { var g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c3); return g; }
  function poly(x, pts) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); }
  function engine(x, ex, ey, r, col) { var g = x.createRadialGradient(ex, ey, 0, ex, ey, r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(' + col + ',0.8)'); g.addColorStop(1, 'rgba(' + col + ',0)'); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r, 0, TAU); x.fill(); }
  function panel(x, a) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.6; x.beginPath(); for (var i = 0; i < a.length; i += 4) { x.moveTo(a[i], a[i + 1]); x.lineTo(a[i + 2], a[i + 3]); } x.stroke(); }
  function lights(x, a, col) { for (var i = 0; i < a.length; i += 2) { x.fillStyle = 'rgba(' + col + ',0.9)'; x.beginPath(); x.arc(a[i], a[i + 1], 0.9, 0, TAU); x.fill(); } }
  var SHIPS = {
    scout: { L: 26, d: function (x) { poly(x, [13, 0, -4, -7, -11, -5, -8, 0, -11, 5, -4, 7]); x.fillStyle = metal(x, 0, -7, 0, 7, '#dfe8f2', '#8a98aa', '#3a4454'); x.fill(); x.strokeStyle = '#1b2230'; x.lineWidth = 0.8; x.stroke();
      poly(x, [2, -6.5, -6, -9, -8, -6]); x.fillStyle = '#c03a2a'; x.fill(); poly(x, [2, 6.5, -6, 9, -8, 6]); x.fill(); x.fillStyle = 'rgba(120,220,255,.9)'; x.beginPath(); x.ellipse(4, 0, 3.4, 1.6, 0, 0, TAU); x.fill(); panel(x, [-2, -4, -2, 4, 8, -1.5, -6, -1.5]); engine(x, -10, 0, 5, '120,200,255'); } },
    swarmer: { L: 16, d: function (x) { poly(x, [8, 0, -2, -6, -7, -3, -5, 0, -7, 3, -2, 6]); x.fillStyle = metal(x, 0, -6, 0, 6, '#c7f07a', '#5d8a2c', '#24380e'); x.fill(); x.strokeStyle = '#162208'; x.lineWidth = 0.6; x.stroke();
      x.fillStyle = 'rgba(255,90,60,.95)'; x.beginPath(); x.arc(3, 0, 1.6, 0, TAU); x.fill(); engine(x, -6, 0, 3.6, '190,255,110'); } },
    fighter: { L: 15, d: function (x) { poly(x, [8, 0, 0, -2, -3, -7, -6, -7, -4, 0, -6, 7, -3, 7, 0, 2]); x.fillStyle = metal(x, 0, -7, 0, 7, '#f0d2a0', '#a06a3a', '#3e2614'); x.fill(); x.strokeStyle = '#2a1608'; x.lineWidth = 0.6; x.stroke(); engine(x, -5, 0, 3.4, '255,170,90'); } },
    frigate: { L: 40, d: function (x) { poly(x, [20, -3, 16, -8, -6, -11, -16, -9, -20, -5, -20, 5, -16, 9, -6, 11, 16, 8, 20, 3]); x.fillStyle = metal(x, 0, -11, 0, 11, '#b6bcc4', '#6c737c', '#2c3036'); x.fill(); x.strokeStyle = '#15181c'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#d27a1e'; x.fillRect(-4, -10.5, 3, 21); x.fillStyle = '#3a4048'; x.fillRect(-14, -6, 18, 12); x.fillStyle = metal(x, 0, -4, 0, 4, '#9aa2ac', '#5a616a', '#30353c'); x.fillRect(6, -4, 9, 8);
      panel(x, [-16, -3, 14, -3, -16, 3, 14, 3, 8, -8, 8, 8]); lights(x, [17, -5, 17, 5], '255,220,140'); engine(x, -20, -4, 6, '255,150,80'); engine(x, -20, 4, 6, '255,150,80'); } },
    cruiser: { L: 52, d: function (x) { poly(x, [26, 0, 18, -6, 4, -9, -12, -13, -24, -10, -26, -4, -26, 4, -24, 10, -12, 13, 4, 9, 18, 6]); x.fillStyle = metal(x, 0, -13, 0, 13, '#a8c4ea', '#4a6a9c', '#1a2a48'); x.fill(); x.strokeStyle = '#0c1424'; x.lineWidth = 1; x.stroke();
      x.fillStyle = metal(x, 0, -5, 0, 5, '#c8d8f0', '#7890b8', '#34466a'); poly(x, [12, 0, 2, -5, -14, -5, -14, 5, 2, 5]); x.fill(); x.fillStyle = 'rgba(140,230,255,.95)'; x.fillRect(4, -1.2, 6, 2.4);
      panel(x, [-22, -6, 10, -6, -22, 6, 10, 6, -6, -11, -6, 11, -16, -11, -16, 11]); lights(x, [20, -3, 20, 3, -8, -12, -8, 12], '160,230,255'); engine(x, -26, -6, 7, '110,180,255'); engine(x, -26, 0, 7, '110,180,255'); engine(x, -26, 6, 7, '110,180,255'); } },
    phantom: { L: 34, d: function (x) { poly(x, [17, 0, 0, -5, -10, -13, -14, -11, -9, 0, -14, 11, -10, 13, 0, 5]); x.fillStyle = metal(x, 0, -13, 0, 13, '#4a4060', '#1a1626', '#08060e'); x.fill(); x.strokeStyle = 'rgba(190,120,255,.9)'; x.lineWidth = 1; x.stroke();
      x.strokeStyle = 'rgba(190,120,255,.5)'; x.beginPath(); x.moveTo(14, 0); x.lineTo(-8, 0); x.stroke(); x.fillStyle = 'rgba(220,160,255,.9)'; x.beginPath(); x.ellipse(5, 0, 3, 1.3, 0, 0, TAU); x.fill(); engine(x, -10, 0, 5, '190,120,255'); } },
    gunship: { L: 40, d: function (x) { poly(x, [16, -4, 8, -14, -10, -16, -18, -8, -18, 8, -10, 16, 8, 14, 16, 4]); x.fillStyle = metal(x, 0, -16, 0, 16, '#b8c08a', '#6a7440', '#2a3018'); x.fill(); x.strokeStyle = '#141808'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#2a2e22'; x.fillRect(6, -13, 16, 3.4); x.fillRect(6, 9.6, 16, 3.4); x.fillStyle = '#d24a2a'; x.fillRect(20, -12.6, 2.4, 2.6); x.fillRect(20, 10, 2.4, 2.6);
      x.fillStyle = 'rgba(255,200,120,.85)'; x.beginPath(); x.ellipse(6, 0, 4, 2.2, 0, 0, TAU); x.fill(); panel(x, [-14, -8, 6, -8, -14, 8, 6, 8]); engine(x, -18, -6, 6, '255,180,90'); engine(x, -18, 6, 6, '255,180,90'); } },
    mender: { L: 32, d: function (x) { x.fillStyle = metal(x, 0, -12, 0, 12, '#e8f4ee', '#8ab0a0', '#36504a'); x.beginPath(); x.ellipse(0, 0, 15, 11, 0, 0, TAU); x.fill(); x.strokeStyle = '#1a2a24'; x.lineWidth = 1; x.stroke();
      x.strokeStyle = 'rgba(90,255,170,.9)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 7, 0, TAU); x.stroke(); x.fillStyle = 'rgba(90,255,170,.95)'; x.fillRect(-1.2, -4, 2.4, 8); x.fillRect(-4, -1.2, 8, 2.4); engine(x, -15, 0, 5, '90,255,170'); } },
    carrier: { L: 92, d: function (x) { poly(x, [46, -6, 40, -16, 10, -22, -30, -24, -46, -16, -46, 16, -30, 24, 10, 22, 40, 16, 46, 6]); x.fillStyle = metal(x, 0, -24, 0, 24, '#c0c4cc', '#646a74', '#24282e'); x.fill(); x.strokeStyle = '#101216'; x.lineWidth = 1.2; x.stroke();
      x.fillStyle = '#1c1f24'; x.fillRect(-30, -6, 62, 12); for (var i = 0; i < 7; i++) { x.fillStyle = 'rgba(255,190,90,.85)'; x.fillRect(-26 + i * 8.5, -1, 4, 2); }
      x.fillStyle = metal(x, 0, -14, 0, -4, '#a0a6b0', '#5a6068', '#2a2e34'); x.fillRect(-6, -19, 22, 9); panel(x, [-40, -12, 36, -12, -40, 12, 36, 12, -16, -22, -16, 22, 20, -20, 20, 20]);
      lights(x, [42, -8, 42, 8, -20, -22, -20, 22, 0, -21, 0, 21], '255,90,70'); for (var e = -14; e <= 14; e += 7) engine(x, -46, e, 8, '255,160,80'); } },
    dread: { L: 150, d: function (x) { poly(x, [75, 0, 50, -18, 10, -34, -50, -40, -75, -26, -75, 26, -50, 40, 10, 34, 50, 18]); x.fillStyle = metal(x, 0, -40, 0, 40, '#9ca0a8', '#50545c', '#1a1c20'); x.fill(); x.strokeStyle = '#08090b'; x.lineWidth = 1.4; x.stroke();
      x.fillStyle = metal(x, 0, -14, 0, 14, '#b8bcc4', '#686c74', '#2c2e34'); poly(x, [40, 0, 20, -12, -40, -16, -40, 16, 20, 12]); x.fill(); x.fillStyle = '#8b1a1a'; x.fillRect(-20, -38, 6, 76);
      for (var i = 0; i < 6; i++) { x.fillStyle = '#2a2c30'; x.beginPath(); x.arc(-30 + i * 14, -24, 5, 0, TAU); x.arc(-30 + i * 14, 24, 5, 0, TAU); x.fill(); }
      panel(x, [-70, -20, 60, -10, -70, 20, 60, 10, -60, -36, -60, 36, 0, -32, 0, 32, 30, -24, 30, 24]); lights(x, [60, -6, 60, 6, -45, -38, -45, 38, 18, -30, 18, 30], '255,80,60');
      x.fillStyle = 'rgba(255,120,80,.9)'; x.fillRect(28, -2, 10, 4); for (var e = -24; e <= 24; e += 12) engine(x, -75, e, 12, '255,120,70'); } },
    hive: { L: 130, d: function (x) { var g = x.createRadialGradient(-10, -10, 4, 0, 0, 60); g.addColorStop(0, '#d8a0ff'); g.addColorStop(0.5, '#6a2a90'); g.addColorStop(1, '#1c0a2a'); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 60, 46, 0, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(30,8,40,.8)'; x.lineWidth = 1.5; for (var i = 0; i < 9; i++) { var a = i / 9 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * 20, Math.sin(a) * 15); x.quadraticCurveTo(Math.cos(a + 0.3) * 50, Math.sin(a + 0.3) * 40, Math.cos(a) * 60, Math.sin(a) * 46); x.stroke(); }
      for (var p = 0; p < 12; p++) { var b = p / 12 * TAU; x.fillStyle = 'rgba(160,255,120,.85)'; x.beginPath(); x.arc(Math.cos(b) * 38, Math.sin(b) * 29, 3.4, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(255,90,200,.9)'; x.beginPath(); x.ellipse(30, 0, 9, 6, 0, 0, TAU); x.fill(); engine(x, -60, 0, 14, '200,120,255'); } },
    eclipse: { L: 180, d: function (x) { var g = x.createRadialGradient(-20, -20, 10, 0, 0, 80); g.addColorStop(0, '#3c3a48'); g.addColorStop(0.6, '#141320'); g.addColorStop(1, '#050408'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 70, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,170,90,.85)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 70, 0, TAU); x.stroke(); x.strokeStyle = 'rgba(255,200,120,.35)'; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 80, 0, TAU); x.stroke();
      for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; x.fillStyle = metal(x, 0, -8, 0, 8, '#8a8a96', '#40404c', '#18181f'); x.save(); x.rotate(a); x.fillRect(52, -7, 30, 14); x.fillStyle = 'rgba(255,90,60,.9)'; x.fillRect(78, -2, 4, 4); x.restore(); }
      x.fillStyle = 'rgba(255,140,60,.95)'; x.beginPath(); x.arc(0, 0, 14, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,240,200,.95)'; x.beginPath(); x.arc(0, 0, 6, 0, TAU); x.fill(); } }
  };
  var shipCache = {};
  function ship(kind, px) {
    var key = kind + '@' + px; if (shipCache[key]) return shipCache[key];
    var s = SHIPS[kind], sc = px, size = Math.ceil(s.L * 1.6 * sc), c = mk(size, size), x = c.getContext('2d');
    x.translate(size / 2, size / 2); x.scale(sc, sc); s.d(x);
    return (shipCache[key] = { c: c, L: s.L, size: size / sc });
  }

  // ---------- turret platform + heads ----------
  var TCOL = { laser: '255,90,90', rail: '120,210,255', missile: '255,190,90', stasis: '120,160,255', pylon: '120,255,200', drone: '210,150,255' };
  function platform(px) {
    var key = 'plat@' + px; if (shipCache[key]) return shipCache[key];
    var R = 30, size = Math.ceil(R * 2.4 * px), c = mk(size, size), x = c.getContext('2d'); x.translate(size / 2, size / 2); x.scale(px, px);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(2, 4, R, R * 0.92, 0, 0, TAU); x.fill();
    poly(x, (function () { var a = []; for (var i = 0; i < 8; i++) { var t = i / 8 * TAU + TAU / 16; a.push(Math.cos(t) * R, Math.sin(t) * R); } return a; })());
    x.fillStyle = metal(x, -R, -R, R, R, '#9aa4b4', '#4a5260', '#1c2028'); x.fill(); x.strokeStyle = '#0a0c10'; x.lineWidth = 1.2; x.stroke();
    x.fillStyle = metal(x, -R, -R, R, R, '#2a3038', '#14181e', '#08090c'); x.beginPath(); x.arc(0, 0, R * 0.66, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, R * 0.66, Math.PI * 1.05, Math.PI * 1.6); x.stroke();
    for (var i = 0; i < 8; i++) { var t = i / 8 * TAU; x.fillStyle = '#0c0e12'; x.fillRect(Math.cos(t) * R * 0.82 - 1.5, Math.sin(t) * R * 0.82 - 1.5, 3, 3); }
    return (shipCache[key] = { c: c, size: size / px });
  }
  function head(kind, tier, px) {
    var key = 'h' + kind + tier + '@' + px; if (shipCache[key]) return shipCache[key];
    var size = Math.ceil(64 * px), c = mk(size, size), x = c.getContext('2d'); x.translate(size / 2, size / 2); x.scale(px, px);
    var col = TCOL[kind], t = tier, gs = 1 + t * 0.06;
    x.scale(gs, gs);
    if (kind === 'laser') { x.fillStyle = metal(x, 0, -10, 0, 10, '#e8e0e0', '#8a7a7a', '#3a2c2c'); x.beginPath(); x.arc(0, 0, 11, 0, TAU); x.fill(); x.fillStyle = metal(x, 0, -3, 0, 3, '#d0c8c8', '#6a5a5a', '#2a2020');
      x.fillRect(4, -3, 18, 6); if (t >= 2) { x.fillRect(4, -7, 14, 2.6); x.fillRect(4, 4.4, 14, 2.6); } x.fillStyle = 'rgba(' + col + ',0.95)'; x.fillRect(20, -1.6, 3, 3.2); x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.fill(); }
    else if (kind === 'rail') { x.fillStyle = metal(x, 0, -11, 0, 11, '#dfe8f0', '#7a8a9a', '#28323c'); poly(x, [-12, -10, 6, -8, 6, 8, -12, 10]); x.fill(); x.fillStyle = '#20262e'; x.fillRect(4, -5, 24 + t * 2, 3); x.fillRect(4, 2, 24 + t * 2, 3);
      x.fillStyle = 'rgba(' + col + ',0.9)'; x.fillRect(6, -1.2, 20 + t * 2, 2.4); for (var i = 0; i < t + 1; i++) { x.fillStyle = '#aab6c4'; x.fillRect(8 + i * 5, -6.5, 2, 13); } }
    else if (kind === 'missile') { x.fillStyle = metal(x, 0, -12, 0, 12, '#e8dcc0', '#8a7650', '#33281a'); x.fillRect(-12, -12, 22, 24); x.strokeStyle = '#140e06'; x.lineWidth = 1; x.strokeRect(-12, -12, 22, 24);
      var n = t >= 3 ? 3 : 2; for (var r = 0; r < n; r++) for (var q = 0; q < 2; q++) { x.fillStyle = '#18120a'; x.beginPath(); x.arc(-5 + q * 9, -8 + r * (16 / Math.max(1, n - 1)), 3, 0, TAU); x.fill(); x.fillStyle = 'rgba(' + col + ',.9)'; x.beginPath(); x.arc(-5 + q * 9, -8 + r * (16 / Math.max(1, n - 1)), 1.2, 0, TAU); x.fill(); } }
    else if (kind === 'stasis') { var g = x.createRadialGradient(0, 0, 2, 0, 0, 14); g.addColorStop(0, 'rgba(220,235,255,1)'); g.addColorStop(0.5, 'rgba(' + col + ',0.9)'); g.addColorStop(1, 'rgba(30,40,90,1)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 12, 0, TAU); x.fill();
      x.strokeStyle = '#c8d6ff'; x.lineWidth = 2; for (var i2 = 0; i2 < 3; i2++) { x.beginPath(); x.ellipse(0, 0, 16, 5, i2 * TAU / 3, 0, TAU); x.stroke(); } }
    else if (kind === 'pylon') { x.fillStyle = metal(x, -10, -10, 10, 10, '#e0fff4', '#6ab09a', '#1e3a32'); poly(x, [0, -15, 13, 0, 0, 15, -13, 0]); x.fill(); x.strokeStyle = '#0a1a14'; x.stroke();
      x.fillStyle = 'rgba(' + col + ',0.95)'; x.beginPath(); x.arc(0, 0, 4 + t * 0.6, 0, TAU); x.fill(); x.strokeStyle = 'rgba(' + col + ',0.6)'; x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.stroke(); }
    else if (kind === 'drone') { x.fillStyle = metal(x, 0, -13, 0, 13, '#e6dcf4', '#7a6a96', '#2a2236'); x.beginPath(); x.ellipse(0, 0, 15, 12, 0, 0, TAU); x.fill(); x.fillStyle = '#120e1a'; x.fillRect(-9, -3, 18, 6);
      for (var d = 0; d < Math.min(4, t + 1); d++) { x.fillStyle = 'rgba(' + col + ',.95)'; x.fillRect(-8 + d * 4.6, -1.2, 3, 2.4); } }
    return (shipCache[key] = { c: c, size: size / px });
  }
  function drone(px) { var key = 'drone@' + px; if (shipCache[key]) return shipCache[key]; var size = Math.ceil(20 * px), c = mk(size, size), x = c.getContext('2d'); x.translate(size / 2, size / 2); x.scale(px, px);
    poly(x, [6, 0, -4, -4, -2, 0, -4, 4]); x.fillStyle = '#d8c8f0'; x.fill(); engine(x, -3, 0, 3, '210,150,255'); return (shipCache[key] = { c: c, size: size / px }); }

  window.RSArt = { Noise: Noise, Planet: Planet, Backdrop: Backdrop, glow: glow, ship: ship, platform: platform, head: head, drone: drone, TCOL: TCOL, mk: mk };
})();

/* Scout's Lair animation helpers. Pure math — shared by game.js and tests.
   Written by: Howie */
(function (root) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeIn(t) { t = clamp(t, 0, 1); return t * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
  function easeInOut(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  // Slight overshoot for punch snap / land settle.
  function easeOutBack(t) {
    t = clamp(t, 0, 1);
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInCubic(t) { t = clamp(t, 0, 1); return t * t * t; }

  // Opposite-limb run cycle. phase in radians.
  function walkCycle(phase) {
    var s = Math.sin(phase), c = Math.cos(phase);
    var liftL = Math.max(0, s), liftR = Math.max(0, -s);
    return {
      lh: -0.32 + s * 0.58,
      lk: 0.4 + liftL * 0.95,
      rh: 0.32 - s * 0.58,
      rk: -0.4 - liftR * 0.95,
      ls: -0.5 - s * 0.75,
      le: -1.85 - liftR * 0.55,
      rs: 0.5 + s * 0.75,
      re: 1.85 + liftL * 0.55,
      lean: 0.1 + s * 0.05,
      bob: Math.abs(c) * 5.5,
      plant: Math.abs(s) < 0.18 ? 1 : 0
    };
  }

  // Jump height + squash/stretch across takeoff / hang / land.
  // jt: elapsed since takeoff; up/hang/dn in seconds; jh peak height.
  function jumpProfile(jt, up, hang, dn, jh) {
    up = up || 0.22; hang = hang || 0; dn = dn || 0.3; jh = jh || 170;
    if (jt < 0) return { jy: 0, sx: 1, sy: 1, phase: 'ground' };
    var t = jt;
    if (t < up) {
      var u = t / up;
      return { jy: jh * easeOut(u), sx: lerp(1.12, 0.88, easeOut(u)), sy: lerp(0.88, 1.14, easeOut(u)), phase: 'rise' };
    }
    if (t < up + hang) {
      return { jy: jh, sx: 0.9, sy: 1.12, phase: 'hang' };
    }
    if (t < up + hang + dn) {
      var d = (t - up - hang) / dn;
      var jy = jh * (1 - easeIn(d));
      // Stretch mid-fall, squash into the landing.
      var sx = d < 0.7 ? lerp(0.9, 0.95, d / 0.7) : lerp(0.95, 1.22, (d - 0.7) / 0.3);
      var sy = d < 0.7 ? lerp(1.12, 1.05, d / 0.7) : lerp(1.05, 0.78, (d - 0.7) / 0.3);
      return { jy: jy, sx: sx, sy: sy, phase: 'fall' };
    }
    return { jy: 0, sx: 1, sy: 1, phase: 'landed' };
  }

  // Land squash decay: age in seconds since touchdown.
  function landSquash(age) {
    if (age < 0 || age > 0.35) return { sx: 1, sy: 1 };
    var t = age / 0.35;
    var k = 1 - easeOut(t);
    return { sx: 1 + 0.22 * k, sy: 1 - 0.2 * k };
  }

  // Baton / swipe wind-up: pull back, then slam. u in 0..1 over the out window.
  function swipeCurve(u) {
    u = clamp(u, 0, 1);
    if (u < 0.28) return -0.35 * easeOut(u / 0.28);
    return lerp(-0.35, 1, easeInCubic((u - 0.28) / 0.72));
  }

  // Fist parks beside The Machine's eye (logical CX=270, eye at y=220), not over it.
  var EYE = { x: 270, y: 220, r: 42 };
  function fistParkX(sideSign, cx) {
    cx = cx == null ? 270 : cx;
    return cx + (sideSign || 1) * 205;
  }
  // Knuckle AABB for a fist drawn at (x, bot) with drawFist scale 1.
  function fistKnuckleBox(x, bot) {
    return { left: x - 135, right: x + 135, top: bot - 175, bottom: bot };
  }
  function fistCoversEye(x, bot, eye) {
    eye = eye || EYE;
    var b = fistKnuckleBox(x, bot);
    var cx = clamp(eye.x, b.left, b.right);
    var cy = clamp(eye.y, b.top, b.bottom);
    var dx = eye.x - cx, dy = eye.y - cy;
    return dx * dx + dy * dy <= eye.r * eye.r;
  }
  // Approach height: knuckle top stays below the eye band.
  function fistApproachBot(p) {
    // Peak rest ~500 so knuckle top ~325, eye at 220 stays clear.
    return lerp(-80, 500, easeOut(clamp(p, 0, 1)));
  }

  var api = {
    clamp: clamp, lerp: lerp, ease: ease, easeIn: easeIn, easeOut: easeOut,
    easeInOut: easeInOut, easeOutBack: easeOutBack, easeInCubic: easeInCubic,
    walkCycle: walkCycle, jumpProfile: jumpProfile, landSquash: landSquash,
    swipeCurve: swipeCurve, fistParkX: fistParkX, fistKnuckleBox: fistKnuckleBox,
    fistCoversEye: fistCoversEye, fistApproachBot: fistApproachBot, EYE: EYE
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoutAnim = api;
})(this);

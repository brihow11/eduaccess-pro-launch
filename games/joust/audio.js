/*
 * Joust tribute: synthesized sound effects (Web Audio API only, no audio files).
 * Written by: Howie
 */
(function (global) {
  "use strict";

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;
  var lastPlay = {};

  try { muted = localStorage.getItem("joust.muted") === "1"; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    var len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Must be called from a user gesture (iOS Safari / Android Chrome unlock).
  function unlock() {
    var c = ensure();
    if (!c) return;
    if (c.state === "suspended") { c.resume(); }
    // Play a silent buffer: required by older iOS versions.
    try {
      var b = c.createBuffer(1, 1, 22050);
      var s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
  }

  function ready() { return ctx && ctx.state === "running" && !muted; }

  function throttle(name, ms) {
    var now = performance.now();
    if (lastPlay[name] && now - lastPlay[name] < ms) return false;
    lastPlay[name] = now;
    return true;
  }

  function env(g, t, a, peak, d, end) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(end || 0.0001, 0.0001), t + a + d);
  }

  function osc(type, f0, f1, t, dur, peak, dest, attack) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, attack || 0.005, peak, dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  function noise(t, dur, peak, filterType, f0, f1, q, dest, attack) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType || "bandpass";
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    var g = ctx.createGain();
    env(g, t, attack || 0.004, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest || master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  var S = {
    // Wing beat: airy whoosh plus a soft low thump.
    flap: function () {
      if (!ready() || !throttle("flap", 45)) return;
      var t = ctx.currentTime;
      noise(t, 0.13, 0.32, "bandpass", 1400, 420, 1.2);
      osc("triangle", 190, 70, t, 0.1, 0.22);
    },
    // Enemy wing beat (quieter, lower).
    eflap: function () {
      if (!ready() || !throttle("eflap", 90)) return;
      var t = ctx.currentTime;
      noise(t, 0.1, 0.09, "bandpass", 900, 300, 1.4);
    },
    // Running footstep: the classic clicky trot.
    step: function (alt) {
      if (!ready() || !throttle("step", 60)) return;
      var t = ctx.currentTime;
      osc("square", alt ? 820 : 640, alt ? 520 : 400, t, 0.035, 0.11);
      noise(t, 0.03, 0.12, "highpass", 3000, 3000, 0.7);
    },
    // Skid when reversing on the ground.
    skid: function () {
      if (!ready() || !throttle("skid", 200)) return;
      var t = ctx.currentTime;
      noise(t, 0.28, 0.25, "bandpass", 2600, 900, 3);
      osc("sawtooth", 300, 160, t, 0.25, 0.05);
    },
    // Lance clash: metallic ring.
    clash: function () {
      if (!ready() || !throttle("clash", 70)) return;
      var t = ctx.currentTime;
      [1180, 1730, 2410, 3170].forEach(function (f, i) {
        osc(i % 2 ? "square" : "triangle", f, f * 0.97, t, 0.32 - i * 0.05, 0.09);
      });
      noise(t, 0.08, 0.35, "highpass", 4000, 2000, 0.8);
    },
    // Enemy unseated.
    defeat: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      osc("square", 880, 110, t, 0.38, 0.16);
      osc("sawtooth", 660, 90, t + 0.02, 0.36, 0.08);
      noise(t, 0.22, 0.25, "lowpass", 3000, 300, 0.8);
    },
    // Player unseated.
    die: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      osc("square", 520, 60, t, 0.7, 0.18);
      osc("triangle", 260, 40, t + 0.05, 0.8, 0.2);
      noise(t, 0.4, 0.2, "lowpass", 1800, 200, 0.7);
    },
    // Egg collected: bright ascending blips.
    egg: function (n) {
      if (!ready()) return;
      var t = ctx.currentTime;
      var base = 660 * Math.pow(1.12, Math.min(n || 0, 4));
      [1, 1.26, 1.5, 2].forEach(function (m, i) {
        osc("square", base * m, base * m, t + i * 0.045, 0.06, 0.1);
      });
    },
    // Egg bounce tick.
    bounce: function () {
      if (!ready() || !throttle("bounce", 60)) return;
      var t = ctx.currentTime;
      osc("triangle", 900, 500, t, 0.05, 0.08);
    },
    // Egg hatching: crack plus chirp.
    hatch: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      noise(t, 0.06, 0.4, "highpass", 2500, 2500, 1);
      noise(t + 0.07, 0.05, 0.3, "highpass", 3500, 3500, 1);
      osc("sine", 1800, 2600, t + 0.14, 0.08, 0.12);
      osc("sine", 2000, 2900, t + 0.26, 0.08, 0.1);
    },
    // Pterodactyl screech.
    screech: function () {
      if (!ready() || !throttle("screech", 600)) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      var f = ctx.createBiquadFilter();
      var g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(1500, t);
      o.frequency.linearRampToValueAtTime(2600, t + 0.15);
      o.frequency.linearRampToValueAtTime(900, t + 0.6);
      lfo.frequency.value = 38; lg.gain.value = 260;
      lfo.connect(lg); lg.connect(o.frequency);
      f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 2;
      env(g, t, 0.02, 0.22, 0.6);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
      noise(t, 0.5, 0.12, "bandpass", 3000, 1500, 2);
    },
    // Pterodactyl destroyed.
    pteroDie: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 6; i++) osc("square", 1200 - i * 160, 300 - i * 30, t + i * 0.05, 0.12, 0.1);
      noise(t, 0.5, 0.3, "lowpass", 5000, 200, 0.7);
    },
    // Troll hand emerging from the lava.
    troll: function () {
      if (!ready() || !throttle("troll", 500)) return;
      var t = ctx.currentTime;
      osc("sawtooth", 70, 45, t, 0.7, 0.2, null, 0.06);
      osc("square", 55, 40, t, 0.7, 0.08, null, 0.06);
      noise(t, 0.7, 0.25, "lowpass", 500, 150, 1, null, 0.08);
    },
    // Sizzle when something drops into the lava.
    sizzle: function () {
      if (!ready() || !throttle("sizzle", 120)) return;
      var t = ctx.currentTime;
      noise(t, 0.5, 0.25, "highpass", 3500, 6000, 0.5);
      osc("sine", 120, 50, t, 0.4, 0.12);
    },
    // Extra life jingle.
    life: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) {
        osc("square", f, f, t + i * 0.07, 0.09, 0.09);
        osc("triangle", f / 2, f / 2, t + i * 0.07, 0.09, 0.07);
      });
    },
    // Wave start fanfare.
    wave: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      [392, 523, 659, 784].forEach(function (f, i) {
        osc("square", f, f, t + i * 0.11, 0.16, 0.08);
        osc("triangle", f / 2, f / 2, t + i * 0.11, 0.2, 0.09);
      });
      osc("sawtooth", 1047, 1047, t + 0.46, 0.4, 0.05);
    },
    // Rider materializing on a spawn pad.
    spawn: function () {
      if (!ready() || !throttle("spawn", 150)) return;
      var t = ctx.currentTime;
      osc("sine", 200, 1400, t, 0.5, 0.08);
      osc("triangle", 300, 2100, t + 0.05, 0.45, 0.04);
    },
    // Bonus points (survival / gladiator).
    bonus: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 10; i++) osc("square", 700 + i * 90, 700 + i * 90, t + i * 0.04, 0.05, 0.07);
    },
    // Bridge burning away.
    burn: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      noise(t, 1.4, 0.3, "lowpass", 1800, 300, 0.7, null, 0.1);
      osc("sawtooth", 90, 40, t, 1.2, 0.1, null, 0.1);
    },
    gameOver: function () {
      if (!ready()) return;
      var t = ctx.currentTime;
      [392, 370, 349, 262].forEach(function (f, i) {
        osc("square", f, f * 0.98, t + i * 0.28, 0.3, 0.09);
        osc("triangle", f / 2, f / 2, t + i * 0.28, 0.32, 0.1);
      });
    },
    click: function () {
      if (!ready()) return;
      osc("square", 1200, 1200, ctx.currentTime, 0.03, 0.05);
    }
  };

  global.JoustAudio = {
    unlock: unlock,
    play: function (name, arg) {
      var fn = S[name];
      if (!fn || !ctx) return;
      try { fn(arg); } catch (e) {}
    },
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem("joust.muted", muted ? "1" : "0"); } catch (e) {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
    },
    state: function () { return ctx ? ctx.state : "none"; }
  };
})(window);

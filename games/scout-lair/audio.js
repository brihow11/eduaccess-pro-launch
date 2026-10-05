/* Scout's Lair synthesized audio: tense adventure loop, victory theme and SFX. No audio files. Written by: Howie */
(function () {
  'use strict';
  var KEY = 'scoutLair.muted';
  var ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  var muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* private mode */ }
  var mode = 'off', step = 0, nextT = 0, timer = null, tempo = 128, intensity = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended' && !SFX.paused) ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.45; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    timer = setInterval(schedule, 40);
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, t, dur, vol, bus, filt) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur);
    var node = o;
    if (filt) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); node = f; }
    node.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, type, freq, freq1, bus) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 2000, t);
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---------- music ----------
  var N = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  // D minor ostinato, 16 steps a bar, 4 bars.
  var BASS = [38, 0, 38, 50, 0, 38, 41, 0, 38, 0, 38, 48, 0, 46, 45, 0];
  var ROOTS = [0, 0, -2, -4];
  var LEAD = [[74, 0, 0, 72, 0, 0, 69, 0, 70, 0, 69, 0, 65, 0, 67, 0], [74, 0, 0, 77, 0, 0, 76, 0, 74, 0, 72, 0, 70, 0, 69, 0]];
  function schedule() {
    if (!ctx || mode === 'off' || ctx.state !== 'running') return;
    var spb = 60 / tempo / 4;
    while (nextT < ctx.currentTime + 0.2) {
      if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime + 0.02;
      if (mode === 'tense') tenseStep(nextT, step);
      else if (mode === 'victory') victoryStep(nextT, step);
      else if (mode === 'title') titleStep(nextT, step);
      step++; nextT += spb;
    }
  }
  function tenseStep(t, s) {
    var i = s % 16, bar = Math.floor(s / 16) % 4, r = ROOTS[bar];
    var b = BASS[i];
    if (b) tone('sawtooth', N(b + r), 0, t, 0.16, 0.22, musicBus, 520 + intensity * 500);
    if (i % 4 === 0) { tone('sine', 140, 42, t, 0.22, 0.6, musicBus); }
    if (i === 4 || i === 12) noise(t, 0.12, 0.28, 'highpass', 1800, 0, musicBus);
    if (i % 2 === 0) noise(t, 0.03, i % 4 === 2 ? 0.1 : 0.05, 'highpass', 8000, 0, musicBus);
    if (intensity > 0 && i % 2 === 1) noise(t, 0.02, 0.04, 'highpass', 9000, 0, musicBus);
    if (i === 0) {
      [62, 65, 69].forEach(function (m) { tone('triangle', N(m + r), 0, t, 60 / tempo * 3.6, 0.045, musicBus, 1400); });
    }
    if (bar >= 2) {
      var l = LEAD[bar - 2][i];
      if (l) tone('square', N(l + (bar === 3 ? 0 : 0)), 0, t, 0.14, 0.05, musicBus, 2400);
    }
  }
  function titleStep(t, s) {
    var i = s % 16, bar = Math.floor(s / 16) % 4, r = ROOTS[bar];
    if (i === 0 || i === 8) tone('sawtooth', N(38 + r), 0, t, 0.9, 0.18, musicBus, 380);
    if (i === 0) [62, 65, 69, 72].forEach(function (m) { tone('triangle', N(m + r), 0, t, 1.9, 0.04, musicBus, 1200); });
    if (i % 4 === 2) tone('sine', N(81 + r + (i === 10 ? 3 : 0)), 0, t, 0.25, 0.03, musicBus);
  }
  var VIC = [62, 66, 69, 74, 0, 74, 76, 78, 0, 78, 0, 81, 0, 0, 0, 0, 74, 0, 78, 0, 76, 0, 74, 73, 74, 0, 0, 0, 0, 0, 0, 0];
  function victoryStep(t, s) {
    var i = s % 32;
    var m = VIC[i];
    if (m) { tone('square', N(m), 0, t, 0.22, 0.12, musicBus, 3200); tone('triangle', N(m - 12), 0, t, 0.3, 0.14, musicBus); }
    if (i % 8 === 0) { tone('sine', 120, 40, t, 0.25, 0.5, musicBus); [50, 54, 57].forEach(function (n) { tone('triangle', N(n + (i >= 16 ? 5 : 0)), 0, t, 0.9, 0.05, musicBus); }); }
    if (i % 8 === 4) noise(t, 0.14, 0.25, 'highpass', 1800, 0, musicBus);
  }

  // ---------- sfx ----------
  var FX = {
    cue: function (t) { tone('square', 880, 1760, t, 0.08, 0.16); tone('square', 1320, 0, t + 0.07, 0.07, 0.12); },
    punch: function (t) { noise(t, 0.09, 0.9, 'lowpass', 1500, 300); tone('sine', 150, 45, t, 0.16, 0.9); },
    smash: function (t) {
      noise(t, 0.5, 0.7, 'lowpass', 5000, 400);
      [310, 467, 733, 1190].forEach(function (f, j) { tone('square', f, f * 0.8, t + j * 0.01, 0.35, 0.06, sfxBus, 4000); });
      tone('sine', 110, 35, t, 0.3, 0.8);
    },
    whoosh: function (t) { noise(t, 0.28, 0.4, 'bandpass', 400, 3200); },
    zap: function (t) { tone('sawtooth', 1400, 90, t, 0.3, 0.16); noise(t, 0.25, 0.25, 'highpass', 3000, 0); },
    fail: function (t) { tone('sawtooth', 320, 70, t, 0.55, 0.22, sfxBus, 1600); tone('sine', 90, 30, t, 0.4, 0.8); noise(t, 0.3, 0.5, 'lowpass', 900, 200); },
    crash: function (t) { noise(t, 0.8, 0.9, 'lowpass', 2400, 120); tone('sine', 80, 28, t, 0.6, 0.9); },
    splash: function (t) { noise(t, 0.7, 0.6, 'lowpass', 3000, 300); noise(t + 0.05, 0.4, 0.2, 'highpass', 4000, 0); },
    jump: function (t) { tone('square', 220, 660, t, 0.14, 0.08, sfxBus, 2000); noise(t, 0.15, 0.2, 'bandpass', 800, 2400); },
    laser: function (t) { tone('sawtooth', 2200, 1800, t, 0.4, 0.06); tone('square', 110, 108, t, 0.4, 0.06, sfxBus, 800); },
    bark: function (t) { tone('sawtooth', 300, 140, t, 0.12, 0.25, sfxBus, 1400); tone('sawtooth', 280, 120, t + 0.16, 0.14, 0.22, sfxBus, 1400); },
    free: function (t) { [69, 73, 76].forEach(function (m, j) { tone('triangle', N(m), 0, t + j * 0.07, 0.25, 0.14); }); },
    clear: function (t) { [62, 66, 69, 74, 78].forEach(function (m, j) { tone('square', N(m), 0, t + j * 0.08, 0.3, 0.08, sfxBus, 3000); }); },
    alarm: function (t) { tone('square', 660, 440, t, 0.4, 0.06, sfxBus, 1500); },
    boom: function (t) { noise(t, 1.4, 1, 'lowpass', 1800, 60); tone('sine', 70, 20, t, 1.2, 1); },
    blip: function (t) { tone('square', 660, 0, t, 0.05, 0.08); }
  };

  var SFX = window.ScoutAudio = {
    paused: false,
    init: init,
    play: function (name) { if (!ctx || muted || ctx.state !== 'running' || !FX[name]) return; FX[name](ctx.currentTime + 0.005); },
    music: function (m, opts) {
      if (mode === m && !(opts && opts.restart)) { if (opts && opts.tempo) tempo = opts.tempo; return; }
      mode = m; step = 0; tempo = (opts && opts.tempo) || (m === 'victory' ? 140 : m === 'title' ? 84 : 128);
      intensity = (opts && opts.intensity) || 0;
      if (ctx) nextT = ctx.currentTime + 0.05;
    },
    setIntensity: function (v) { intensity = v; },
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* private mode */ }
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
    },
    pause: function (p) {
      SFX.paused = !!p;
      if (!ctx) return;
      if (p) ctx.suspend(); else ctx.resume();
    },
    state: function () { return { mode: mode, ctx: ctx ? ctx.state : 'none', muted: muted }; }
  };
})();

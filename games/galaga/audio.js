/* Galaga tribute: synthesized sound effects (Web Audio, no audio files). Music is the shared ArcadeMusic
   sequencer (see music.js) so the site-wide music setting applies; mute silences both. Written by: Howie */
(function () {
  'use strict';
  var A = window.GalagaAudio = {};
  var ctx = null, master = null, sfxBus = null, verb = null, echo = null, noiseBuf = null;
  var muted = false;
  try { muted = localStorage.getItem('galaga.muted') === '1'; } catch (e) { /* private mode */ }
  A.MASTER = 0.62;

  function impulse(sec, decay) {
    var len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  A.unlock = function () {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : A.MASTER;
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      verb = ctx.createConvolver(); verb.buffer = impulse(2.4, 3.2);
      var vg = ctx.createGain(); vg.gain.value = 0.28; verb.connect(vg); vg.connect(master);
      echo = ctx.createDelay(1); echo.delayTime.value = 0.32;
      var fb = ctx.createGain(); fb.gain.value = 0.3; var eg = ctx.createGain(); eg.gain.value = 0.22;
      var ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2600;
      echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(eg); eg.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
    }
    if (ctx.state === 'suspended') ctx.resume();
  };
  A.ready = function () { return !!ctx; };
  A.isMuted = function () { return muted; };
  A.setMuted = function (m) {
    muted = !!m; try { localStorage.setItem('galaga.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (window.ArcadeMusic) window.ArcadeMusic.setMuted(muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : A.MASTER, ctx.currentTime, 0.03);
  };
  A.musicOn = function () { return window.ArcadeMusic ? window.ArcadeMusic.enabled : false; };
  A.setMusic = function (on) { if (window.ArcadeMusic) window.ArcadeMusic.setEnabled(on); };
  A.duck = function (d) { if (window.ArcadeMusic) window.ArcadeMusic.duck(d); };
  if (window.ArcadeMusic) window.ArcadeMusic.setMuted(muted);

  // ---------- low-level voices ----------
  function env(g, t, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  }
  function osc(type, f, t, dur, vol, opt) {
    opt = opt || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + (opt.glide || dur));
    if (opt.detune) o.detune.value = opt.detune;
    var node = o;
    if (opt.lp) { var f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(opt.lp, t); if (opt.lpTo) f1.frequency.exponentialRampToValueAtTime(opt.lpTo, t + dur); f1.Q.value = opt.q || 0.8; o.connect(f1); node = f1; }
    node.connect(g);
    env(g, t, opt.a || 0.005, vol, opt.d || dur * 0.4, opt.s == null ? 0.5 : opt.s, opt.r || 0.08, t + dur);
    g.connect(opt.bus || sfxBus);
    if (opt.verb) { var vs = ctx.createGain(); vs.gain.value = opt.verb; g.connect(vs); vs.connect(verb); }
    if (opt.echo) { var es = ctx.createGain(); es.gain.value = opt.echo; g.connect(es); es.connect(echo); }
    if (opt.vib) { var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = opt.vib; lg.gain.value = opt.vibAmt || 12; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + (opt.r || 0.08) + 0.05); }
    o.start(t); o.stop(t + dur + (opt.r || 0.08) + 0.05);
    return o;
  }
  function noise(t, dur, vol, opt) {
    opt = opt || {};
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = opt.type || 'lowpass'; f.frequency.setValueAtTime(opt.f || 2000, t);
    if (opt.fTo) f.frequency.exponentialRampToValueAtTime(opt.fTo, t + dur);
    f.Q.value = opt.q || 0.7;
    var g = ctx.createGain(); s.connect(f); f.connect(g);
    env(g, t, opt.a || 0.003, vol, opt.d || dur * 0.3, opt.s == null ? 0.4 : opt.s, opt.r || 0.1, t + dur);
    g.connect(opt.bus || sfxBus);
    if (opt.verb) { var vs = ctx.createGain(); vs.gain.value = opt.verb; g.connect(vs); vs.connect(verb); }
    s.start(t, Math.random()); s.stop(t + dur + (opt.r || 0.1) + 0.05);
  }
  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  // ---------- sound effects ----------
  var last = {};
  var SFX = {
    shot: function (t) { osc('square', 1500, t, 0.07, 0.07, { to: 420, glide: 0.08, lp: 5000, lpTo: 1200 }); noise(t, 0.04, 0.05, { type: 'highpass', f: 3000 }); },
    hit: function (t) { osc('triangle', 900, t, 0.06, 0.12, { to: 180 }); noise(t, 0.08, 0.12, { f: 3000, fTo: 600 }); },
    bossHit: function (t) { osc('square', 620, t, 0.05, 0.08, { to: 590, lp: 3000 }); osc('square', 931, t, 0.12, 0.06, { lp: 4000, verb: 0.4 }); osc('sine', 1860, t, 0.2, 0.05, { verb: 0.5 }); },
    boom: function (t, o) {
      var big = o && o.big;
      noise(t, big ? 0.6 : 0.32, big ? 0.34 : 0.22, { f: big ? 1800 : 2600, fTo: 90, verb: 0.35 });
      osc('sine', big ? 140 : 220, t, big ? 0.5 : 0.25, big ? 0.3 : 0.18, { to: 38 });
    },
    die: function (t) {
      noise(t, 1.3, 0.34, { f: 3000, fTo: 60, verb: 0.5, d: 0.6 });
      osc('sawtooth', 520, t, 1.1, 0.12, { to: 50, lp: 2400, lpTo: 200 });
      osc('square', 260, t + 0.05, 1.0, 0.07, { to: 30, lp: 1200 });
    },
    dive: function (t) { osc('sine', 1400, t, 0.75, 0.05, { to: 300, glide: 0.75, vib: 9, vibAmt: 40, s: 0.8 }); },
    beam: function (t) {
      for (var i = 0; i < 6; i++) osc('triangle', 330 + (i % 2) * 110, t + i * 0.42, 0.42, 0.06, { to: 880 + (i % 2) * 220, glide: 0.42, vib: 22, vibAmt: 60, s: 0.9, verb: 0.3 });
    },
    capture: function (t) { [76, 72, 69, 64, 60, 57].forEach(function (m, i) { osc('square', mtof(m), t + i * 0.16, 0.15, 0.06, { lp: 2200, verb: 0.3 }); }); },
    rescue: function (t) { [60, 64, 67, 72, 76, 79, 84].forEach(function (m, i) { osc('square', mtof(m), t + i * 0.08, 0.1, 0.06, { lp: 3500, echo: 0.3 }); }); },
    life: function (t) { [72, 76, 79, 84, 79, 84].forEach(function (m, i) { osc('triangle', mtof(m), t + i * 0.09, 0.09, 0.09, { verb: 0.3 }); }); },
    morph: function (t) { osc('sawtooth', 200, t, 0.5, 0.06, { to: 1200, lp: 1800, vib: 30, vibAmt: 80 }); },
    perfect: function (t) { [67, 72, 76, 79, 84, 88].forEach(function (m, i) { osc('square', mtof(m), t + i * 0.1, 0.18, 0.06, { lp: 4000, echo: 0.35, verb: 0.3 }); }); },
    tick: function (t) { osc('square', 1760, t, 0.03, 0.04, { lp: 5000 }); },
    start: function (t) { // stage start fanfare (original)
      var seq = [[62, 0, 1], [69, 1, 1], [67, 2, 0.5], [69, 2.5, 0.5], [74, 3, 2], [72, 5, 0.5], [74, 5.5, 0.5], [77, 6, 2]];
      var bt = 0.11;
      seq.forEach(function (n) { osc('square', mtof(n[0]), t + n[1] * bt, n[2] * bt * 0.95, 0.055, { lp: 3200, echo: 0.25 }); osc('triangle', mtof(n[0] - 12), t + n[1] * bt, n[2] * bt * 0.95, 0.07); });
    },
    ui: function (t) { osc('sine', 880, t, 0.05, 0.06, { to: 1320 }); }
  };
  A.sfx = function (name, o) {
    if (!ctx || muted || !SFX[name]) return;
    var now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.03) return; // avoid stacking identical sounds in one frame
    last[name] = now;
    SFX[name](now + 0.005, o);
  };
  A.state = function () { return ctx ? ctx.state : 'none'; };
  A.toggleMute = function () { A.setMuted(!muted); };
})();

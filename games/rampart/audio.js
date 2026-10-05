/*
 * Rampart tribute: synthesized sound effects and a small orchestral soundtrack.
 * Everything is generated live with Web Audio. No audio files. Written by: Howie
 */
(function () {
  "use strict";
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, sfxBus = null, musicBus = null, verb = null, verbSend = null, noiseBuf = null;
  var muted = false, musicOn = true;
  try { muted = localStorage.getItem("rampart.muted") === "1"; musicOn = localStorage.getItem("rampart.music") !== "0"; } catch (e) {}
  var MASTER = 0.72, MUSIC = 0.34;

  function init() {
    if (ctx || !AC) { if (ctx && ctx.state === "suspended") ctx.resume(); return; }
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : MASTER;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? MUSIC : 0; musicBus.connect(master);
    // stone-hall reverb from a generated impulse
    verb = ctx.createConvolver();
    var len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; verbSend = ctx.createGain(); verbSend.gain.value = 0.22; verbSend.connect(verb); verb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0); for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    if (ctx.state === "suspended") ctx.resume();
  }

  // ---- building blocks ----
  function out(node, wet, bus) { node.connect(bus || sfxBus); if (wet) { var s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(verbSend); } }
  function env(g, t, a, peak, d, sus, r) {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
    if (r) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }
  function noise(t, dur, type, f0, f1, q, vol, wet, bus, pan) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur); f.Q.value = q || 0.7;
    var g = ctx.createGain(); env(g, t, 0.005, vol, dur, 0.0001);
    s.connect(f); f.connect(g);
    var last = g; if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
    out(last, wet, bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, dur, vol, wet, bus, a, pan) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); env(g, t, a || 0.004, vol, dur, 0.0001);
    o.connect(g);
    var last = g; if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
    out(last, wet, bus); o.start(t); o.stop(t + dur + (a || 0) + 0.05);
  }
  function bell(t, f, vol, dur, bus) {
    [1, 2.0, 2.76, 3.9, 5.4].forEach(function (m, k) { tone(t, "sine", f * m, f * m, dur / (1 + k * 0.6), vol / (1 + k * 1.3), 0.5, bus); });
  }

  var last = {};
  function throttle(name, ms) { var n = performance.now(); if (last[name] && n - last[name] < ms) return true; last[name] = n; return false; }

  // ---- sound effects ----
  var SFX = {
    boom: function (t, o) { // your cannon
      var p = (o && o.pan) || 0;
      tone(t, "sine", 92, 34, 0.5, 0.95, 0.15, null, 0.002, p);
      tone(t, "triangle", 160, 50, 0.18, 0.35, 0.1, null, 0.001, p);
      noise(t, 0.7, "lowpass", 2600, 180, 0.6, 0.8, 0.35, null, p);
      noise(t + 0.01, 0.12, "highpass", 3000, 1500, 0.5, 0.25, 0, null, p);
    },
    enemyBoom: function (t, o) {
      var p = (o && o.pan) || 0;
      tone(t, "sine", 70, 30, 0.45, 0.42, 0.3, null, 0.01, p);
      noise(t, 0.6, "lowpass", 900, 120, 0.5, 0.42, 0.5, null, p);
    },
    whistle: function (t) { tone(t, "sine", 1700, 700, 0.55, 0.05, 0.3); },
    splash: function (t, o) {
      var p = (o && o.pan) || 0;
      noise(t, 0.55, "bandpass", 1800, 420, 1.1, 0.5, 0.3, null, p);
      noise(t + 0.05, 0.35, "highpass", 5000, 2500, 0.4, 0.12, 0.2, null, p);
      for (var i = 0; i < 4; i++) tone(t + 0.12 + i * 0.05 + Math.random() * 0.04, "sine", 500 + Math.random() * 500, 900 + Math.random() * 600, 0.05, 0.05, 0.2, null, 0.002, p);
    },
    impact: function (t, o) { // wall struck
      var p = (o && o.pan) || 0;
      tone(t, "sine", 120, 45, 0.3, 0.7, 0.2, null, 0.001, p);
      noise(t, 0.45, "lowpass", 3200, 300, 0.8, 0.7, 0.35, null, p);
      for (var i = 0; i < 6; i++) noise(t + 0.08 + i * 0.045 + Math.random() * 0.03, 0.05, "bandpass", 1500 + Math.random() * 2000, 900, 3, 0.18, 0.2, null, p);
    },
    thud: function (t, o) { // shot into earth
      var p = (o && o.pan) || 0;
      tone(t, "sine", 85, 40, 0.25, 0.5, 0.15, null, 0.002, p);
      noise(t, 0.3, "lowpass", 900, 150, 0.6, 0.45, 0.2, null, p);
    },
    hitShip: function (t, o) {
      var p = (o && o.pan) || 0;
      noise(t, 0.35, "bandpass", 900, 300, 1.4, 0.7, 0.3, null, p); // splintering wood
      for (var i = 0; i < 5; i++) noise(t + i * 0.035, 0.06, "bandpass", 2400 + Math.random() * 1600, 1200, 4, 0.22, 0.1, null, p);
      tone(t, "sine", 100, 50, 0.25, 0.5, 0.2, null, 0.002, p);
    },
    sink: function (t, o) {
      var p = (o && o.pan) || 0;
      // creaking timbers then the rush of water and bubbles
      var osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.setValueAtTime(110, t); osc.frequency.linearRampToValueAtTime(70, t + 1.2);
      var lfo = ctx.createOscillator(); lfo.frequency.value = 7; var lg = ctx.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(osc.frequency);
      var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 520; f.Q.value = 5;
      var g = ctx.createGain(); env(g, t, 0.15, 0.22, 1.1, 0.0001); osc.connect(f); f.connect(g); out(g, 0.4);
      osc.start(t); lfo.start(t); osc.stop(t + 1.4); lfo.stop(t + 1.4);
      noise(t + 0.3, 1.6, "lowpass", 1400, 200, 0.6, 0.45, 0.5, null, p);
      for (var i = 0; i < 12; i++) tone(t + 0.5 + i * 0.09 + Math.random() * 0.06, "sine", 260 + Math.random() * 300, 600 + Math.random() * 500, 0.06, 0.06, 0.3, null, 0.003, p);
    },
    place: function (t) { // stone block set down
      tone(t, "sine", 210, 90, 0.14, 0.55, 0.15, null, 0.001);
      noise(t, 0.09, "bandpass", 1800, 700, 1.2, 0.38, 0.15);
      noise(t + 0.03, 0.12, "lowpass", 600, 200, 0.5, 0.25, 0.1);
    },
    cannonPlace: function (t) {
      tone(t, "sine", 140, 60, 0.25, 0.6, 0.2, null, 0.001);
      tone(t + 0.02, "square", 420, 410, 0.18, 0.06, 0.3);
      tone(t + 0.02, "square", 633, 620, 0.12, 0.04, 0.3);
      noise(t, 0.14, "bandpass", 2400, 1100, 2, 0.25, 0.2);
    },
    deny: function (t) { tone(t, "sawtooth", 110, 98, 0.16, 0.12, 0.05); tone(t, "square", 116, 104, 0.16, 0.06, 0.05); },
    rotate: function (t) { noise(t, 0.04, "bandpass", 2600, 1800, 3, 0.25, 0.05); tone(t, "triangle", 900, 700, 0.04, 0.05, 0.05); },
    move: function (t) { tone(t, "triangle", 640, 600, 0.03, 0.025, 0); },
    tick: function (t, o) { var hi = o && o.hi; tone(t, "square", hi ? 1320 : 990, hi ? 1320 : 990, 0.035, 0.07, 0.15); noise(t, 0.02, "highpass", 6000, 5000, 1, 0.08, 0); },
    bell: function (t) { bell(t, 392, 0.22, 2.2); bell(t + 0.32, 523.25, 0.16, 2.2); },
    claim: function (t) { [293.66, 369.99, 440, 587.33].forEach(function (f, i) { bell(t + i * 0.08, f, 0.1, 1.4); }); },
    select: function (t) { tone(t, "triangle", 520, 780, 0.08, 0.12, 0.2); tone(t + 0.06, "triangle", 780, 1040, 0.1, 0.1, 0.3); },
    horn: function (t) { // enemy landing horn
      [0, 0.45].forEach(function (d) {
        var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = o2.type = "sawtooth";
        o1.frequency.setValueAtTime(146.8, t + d); o2.frequency.setValueAtTime(147.8, t + d);
        o1.frequency.linearRampToValueAtTime(138, t + d + 0.4); o2.frequency.linearRampToValueAtTime(139, t + d + 0.4);
        var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700;
        var g = ctx.createGain(); env(g, t + d, 0.06, 0.12, 0.35, 0.0001);
        o1.connect(f); o2.connect(f); f.connect(g); out(g, 0.5); o1.start(t + d); o2.start(t + d); o1.stop(t + d + 0.5); o2.stop(t + d + 0.5);
      });
    },
    fire: function (t) { noise(t, 0.9, "bandpass", 700, 1600, 0.8, 0.3, 0.3); for (var i = 0; i < 8; i++) noise(t + Math.random() * 0.8, 0.03, "highpass", 4000, 3000, 1, 0.12, 0); },
    sapper: function (t) { tone(t, "square", 300, 180, 0.08, 0.05, 0.1); },
    capture: function (t) { tone(t, "triangle", 660, 880, 0.12, 0.12, 0.3); tone(t + 0.1, "triangle", 880, 1320, 0.16, 0.1, 0.3); },
    loseLife: function (t) { [293.66, 277.18, 261.63, 220].forEach(function (f, i) { brass(t + i * 0.32, f, 0.4, 0.14, sfxBus); }); timp(t, 73.4, 0.5, sfxBus); },
    victory: function () { playTrack("victory"); }
  };
  function play(name, opts) {
    if (!ctx || muted || !SFX[name]) return;
    if (throttle(name, name === "tick" ? 60 : 35)) return;
    try { SFX[name](ctx.currentTime + 0.005, opts || {}); } catch (e) {}
  }

  // ---- instruments for the soundtrack ----
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function brass(t, f, dur, vol, bus) {
    var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 1.4;
    fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(2400, t + 0.06); fl.frequency.exponentialRampToValueAtTime(1100, t + Math.max(0.2, dur));
    [-6, 5].forEach(function (cents) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = cents; o.connect(fl); o.start(t); o.stop(t + dur + 0.3); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.05, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    fl.connect(g); out(g, 0.35, bus);
  }
  function strings(t, f, dur, vol, bus) {
    var g = ctx.createGain(), fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 1500; fl.Q.value = 0.5;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; var lg = ctx.createGain(); lg.gain.value = 4; lfo.connect(lg);
    [-9, 0, 8].forEach(function (c) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = c; lg.connect(o.detune); o.connect(fl); o.start(t); o.stop(t + dur + 0.8); });
    lfo.start(t); lfo.stop(t + dur + 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.35, dur * 0.4)); g.gain.setValueAtTime(vol, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    fl.connect(g); out(g, 0.5, bus);
  }
  function bass(t, f, dur, vol, bus) {
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = "triangle"; o2.type = "square"; o.frequency.value = f; o2.frequency.value = f;
    var fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(260, t + dur);
    var g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(fl); o.connect(fl);
    var g = ctx.createGain(); env(g, t, 0.01, vol, dur, 0.0001); fl.connect(g); out(g, 0.08, bus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function pluck(t, f, dur, vol, bus) { tone(t, "triangle", f, f, Math.min(dur, 0.6), vol, 0.4, bus); tone(t, "sine", f * 2, f * 2, 0.25, vol * 0.3, 0.4, bus); }
  function timp(t, f, vol, bus) { tone(t, "sine", f * 1.5, f, 0.9, vol, 0.4, bus, 0.003); noise(t, 0.25, "lowpass", 500, 120, 0.7, vol * 0.5, 0.3, bus); }
  function snare(t, vol, bus) { noise(t, 0.16, "highpass", 1800, 900, 0.6, vol, 0.25, bus); tone(t, "triangle", 210, 160, 0.07, vol * 0.4, 0.1, bus); }
  function cymbal(t, vol, bus) { noise(t, 2.2, "highpass", 7000, 4000, 0.4, vol, 0.5, bus); }

  // Note strings: "D4:4 F4:2 r:2" = note:length in 16th steps. Chords join with "+".
  var NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(s) { var m = /^([A-G])(#|b)?(-?\d)$/.exec(s); if (!m) return null; return 12 * (parseInt(m[3], 10) + 1) + NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); }
  function parse(seq) {
    var evs = [], pos = 0;
    seq.trim().split(/\s+/).forEach(function (tok) {
      var p = tok.split(":"), len = parseFloat(p[1] || "1");
      if (p[0] !== "r" && p[0] !== "x") p[0].split("+").forEach(function (n) { var m = midi(n); if (m != null) evs.push({ s: pos, m: m, len: len }); });
      else if (p[0] === "x") evs.push({ s: pos, m: 0, len: len });
      pos += len;
    });
    return { evs: evs, len: pos };
  }
  function rep(str, n) { var a = []; for (var i = 0; i < n; i++) a.push(str); return a.join(" "); }

  var TRACKS = {
    title: { tempo: 76, loop: true, voices: [
      { inst: "brass", vol: 0.13, seq: "A4:6 D5:2 F5:4 E5:4  D5:6 C5:2 Bb4:8  A4:4 C5:4 F5:6 E5:2  E5:4 D5:4 C5:8  D5:6 E5:2 F5:4 A5:4  G5:6 F5:2 D5:8  E5:4 C#5:4 A4:4 E5:4  D5:16" },
      { inst: "strings", vol: 0.06, seq: "D3+F3+A3:16 Bb2+D3+F3:16 F2+A2+C3:16 C3+E3+G3:16 D3+F3+A3:16 G2+Bb2+D3:16 A2+C#3+E3:16 D3+F3+A3:16" },
      { inst: "bass", vol: 0.2, seq: "D2:8 A1:8 Bb1:8 F1:8 F1:8 C2:8 C2:8 G1:8 D2:8 A1:8 G1:8 D2:8 A1:8 E1:8 D2:16" },
      { inst: "timp", vol: 0.32, seq: "D2:16 r:16 r:16 C2:16 D2:16 r:16 A1:8 A1:4 A1:4 D2:16" }
    ] },
    build: { tempo: 108, loop: true, voices: [
      { inst: "snare", vol: 0.1, seq: rep("x:3 x:1 x:2 x:2 x:3 x:1 x:2 x:1 x:1", 4) },
      { inst: "bass", vol: 0.2, seq: "D2:2 D2:2 A2:2 D2:2 D2:2 D2:2 A2:2 D2:2  D2:2 D2:2 A2:2 D2:2 D2:2 F2:2 E2:2 D2:2  Bb1:2 Bb1:2 F2:2 Bb1:2 Bb1:2 Bb1:2 F2:2 Bb1:2  C2:2 C2:2 G2:2 C2:2 A1:2 A1:2 C#2:2 E2:2" },
      { inst: "pluck", vol: 0.07, seq: "D5:2 r:2 A4:2 r:2 F5:2 r:2 E5:2 D5:2  C5:2 r:2 D5:2 r:2 A4:4 r:4  Bb4:2 r:2 D5:2 r:2 F5:2 r:2 E5:2 D5:2  E5:2 r:2 C#5:2 r:2 A4:4 r:4" },
      { inst: "strings", vol: 0.035, seq: "D3+A3:32 Bb2+F3:16 C3+G3:8 A2+E3:8" }
    ] },
    battle: { tempo: 138, loop: true, voices: [
      { inst: "timp", vol: 0.3, seq: "D2:4 D2:4 D2:4 D2:2 D2:2  D2:4 D2:4 D2:4 A1:2 A1:2  Bb1:4 Bb1:4 Bb1:4 Bb1:2 Bb1:2  A1:4 A1:4 A1:2 A1:2 A1:1 A1:1 A1:1 A1:1" },
      { inst: "bass", vol: 0.22, seq: rep("D2:1 D3:1", 16) + " " + rep("Bb1:1 Bb2:1", 8) + " " + rep("A1:1 A2:1", 8) },
      { inst: "brass", vol: 0.1, seq: "r:2 D4+F4+A4:2 r:4 D4+F4+A4:2 r:2 D4+F4+A4:4  r:2 D4+F4+A4:2 r:4 E4+G4+C5:2 r:2 F4+A4+D5:4  r:2 D4+F4+Bb4:2 r:4 D4+F4+Bb4:2 r:2 F4+Bb4+D5:4  r:2 C#4+E4+A4:2 r:2 E4+A4+C#5:4 r:2 A4+C#5+E5:4" },
      { inst: "pluck", vol: 0.06, seq: "D5:1 E5:1 F5:1 E5:1 D5:1 C#5:1 D5:2 A4:2 r:6  D5:1 E5:1 F5:1 G5:1 A5:2 G5:1 F5:1 E5:2 r:6  F5:1 G5:1 A5:1 G5:1 F5:1 E5:1 D5:2 Bb4:2 r:6  E5:1 F5:1 G5:1 F5:1 E5:1 D5:1 C#5:2 A4:2 r:6" },
      { inst: "snare", vol: 0.07, seq: rep("r:4 x:4", 6) + " r:4 x:2 x:1 x:1 x:1 x:1 x:1 x:1 x:1 x:1 x:1 x:1" }
    ] },
    victory: { tempo: 100, loop: false, voices: [
      { inst: "brass", vol: 0.16, seq: "D4:1 F#4:1 A4:1 D5:1 F#5:2 E5:1 F#5:1 A5:12 D4+F#4+A4+D5:16" },
      { inst: "strings", vol: 0.07, seq: "r:4 D3+A3+F#4:12 D3+A3+D4+F#4:16" },
      { inst: "timp", vol: 0.35, seq: "D2:1 D2:1 D2:1 D2:1 A1:4 D2:8 D2:16" },
      { inst: "cymbal", vol: 0.12, seq: "r:8 x:24" }
    ] },
    defeat: { tempo: 72, loop: false, voices: [
      { inst: "brass", vol: 0.12, seq: "A4:4 G4:4 F4:4 E4:4 D4:16" },
      { inst: "strings", vol: 0.06, seq: "D3+F3+A3:8 Bb2+D3+G3:8 A2+C#3+E3:16" },
      { inst: "timp", vol: 0.3, seq: "D2:8 r:8 A1:16" }
    ] }
  };
  Object.keys(TRACKS).forEach(function (k) {
    var tr = TRACKS[k], L = 0;
    tr.voices.forEach(function (v) { var p = parse(v.seq); v.evs = p.evs; L = Math.max(L, p.len); });
    tr.steps = L;
  });

  var cur = null; // { name, tr, t0, next, gain }
  function playTrack(name) {
    if (!ctx) return;
    if (cur && cur.name === name && TRACKS[name].loop) return;
    stopMusic(0.5);
    var tr = TRACKS[name]; if (!tr) return;
    var g = ctx.createGain(); g.gain.value = 1; g.connect(musicBus);
    cur = { name: name, tr: tr, t0: ctx.currentTime + 0.08, next: 0, gain: g };
  }
  function stopMusic(fade) {
    if (!cur || !ctx) { cur = null; return; }
    var g = cur.gain, t = ctx.currentTime;
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.3));
    setTimeout(function () { try { g.disconnect(); } catch (e) {} }, ((fade || 0.3) + 2.5) * 1000);
    cur = null;
  }
  var INST = { brass: brass, strings: strings, bass: bass, pluck: pluck };
  function schedule() {
    if (!ctx || !cur) return;
    var tr = cur.tr, sd = 60 / tr.tempo / 4, ahead = ctx.currentTime + 0.18;
    while (cur && cur.t0 + cur.next * sd < ahead) {
      var step = cur.next;
      if (!tr.loop && step >= tr.steps) { var done = cur; cur = null; setTimeout(function () { try { done.gain.disconnect(); } catch (e) {} }, 4000); return; }
      var s = step % tr.steps, t = cur.t0 + step * sd;
      if (musicOn && !muted && t > ctx.currentTime - 0.02) {
        for (var vi = 0; vi < tr.voices.length; vi++) {
          var v = tr.voices[vi];
          for (var ei = 0; ei < v.evs.length; ei++) {
            var e = v.evs[ei]; if (e.s !== s) continue;
            var dur = e.len * sd;
            try {
              if (v.inst === "timp") timp(t, mtof(e.m), v.vol, cur.gain);
              else if (v.inst === "snare") snare(t, v.vol, cur.gain);
              else if (v.inst === "cymbal") cymbal(t, v.vol, cur.gain);
              else INST[v.inst](t, mtof(e.m), dur * 0.95, v.vol, cur.gain);
            } catch (x) {}
          }
        }
      }
      cur.next++;
    }
  }
  setInterval(schedule, 40);

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem("rampart.muted", muted ? "1" : "0"); } catch (e) {}
    if (master) { var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(muted ? 0 : MASTER, t, 0.03); }
  }
  function setMusic(on) {
    musicOn = !!on;
    try { localStorage.setItem("rampart.music", musicOn ? "1" : "0"); } catch (e) {}
    if (musicBus) musicBus.gain.setTargetAtTime(musicOn ? MUSIC : 0, ctx.currentTime, 0.1);
  }

  window.RampartAudio = {
    init: init, play: play, music: function (name) { if (!ctx) return; if (name) playTrack(name); else stopMusic(0.6); },
    isMuted: function () { return muted; }, setMuted: setMuted, toggleMute: function () { setMuted(!muted); return muted; },
    musicOn: function () { return musicOn; }, setMusic: setMusic,
    state: function () { return ctx ? ctx.state : "none"; }, track: function () { return cur ? cur.name : null; },
    TRACKS: TRACKS, SFX: Object.keys(SFX)
  };
})();

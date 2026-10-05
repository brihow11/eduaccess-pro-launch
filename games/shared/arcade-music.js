/*
 * EduAccess Arcade music: tiny Web Audio sequencer for synthesized soundtrack loops.
 * No audio files. Every note is an oscillator or filtered noise.
 * Written by: Howie
 *
 *   ArcadeMusic.play(song)            loop a song (replaces the current one, short crossfade)
 *   ArcadeMusic.sting(song, then)     play a song once (victory / game over), then loop `then` if given
 *   ArcadeMusic.stop(fade)            fade out and stop
 *   ArcadeMusic.setMuted(bool)        follow the game's mute button (does not change the saved music preference)
 *   ArcadeMusic.setEnabled(bool)      the "Music" option, saved on this device for every game
 *   ArcadeMusic.duck(bool)            quieter while paused or while a splash is up
 *   ArcadeMusic.enabled / .muted / .current
 *
 * A song: { name, bpm, steps: 16 (per bar), swing: 0..0.3, chords: ['D3m','A#2','F3','C3'],
 *           tracks: [ { inst, vol, gen | notes, oct } ] }
 *   gen: 'pad' | 'bass8' | 'bass4' | 'pulse16' | 'arp16' | 'arp8' | 'root1'
 *   notes: one string per bar (or one string for every bar), space separated steps:
 *          'D4' note, 'D4+F4' chord, '-' hold previous, '.' rest; drums use 'x' (hit) or 'o' (soft hit)
 */
(function () {
  "use strict";
  if (window.ArcadeMusic) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  var PREF = "eduaccess.arcade.music.v1";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

  var ctx = null, master = null, bus = null, verb = null, delay = null, noiseBuf = null;
  var enabled = lsGet(PREF) !== "0", muted = false, ducked = false, hidden = false;
  var song = null, pending = null, then = null, once = false, step = 0, nextT = 0, timer = 0, songGain = null;
  var LEVEL = 0.34;

  var NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
  function midi(name) {
    var m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
    if (!m) return null;
    return 12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]];
  }
  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var QUAL = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], "5": [0, 7, 12], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14] };
  function chord(sym) {
    var m = /^([A-G](?:#|b)?)(-?\d)(.*)$/.exec(sym);
    if (!m) return [60, 64, 67];
    var root = midi(m[1] + m[2]);
    return (QUAL[m[3]] || QUAL[""]).map(function (i) { return root + i; });
  }

  function ensure() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = ctx.createGain();
    master.gain.value = target();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(master);
    // reverb: generated decaying-noise impulse response (no files)
    verb = ctx.createConvolver();
    var len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = ir.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    var vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
    // tempo-free echo
    delay = ctx.createDelay(1); delay.delayTime.value = 0.33;
    var fb = ctx.createGain(); fb.gain.value = 0.32;
    var dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2400;
    delay.connect(dl); dl.connect(fb); fb.connect(delay);
    var dg = ctx.createGain(); dg.gain.value = 0.28; dl.connect(dg); dg.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var nd = noiseBuf.getChannelData(0);
    for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    return true;
  }
  function target() { return enabled && !muted && !hidden ? (ducked ? LEVEL * 0.35 : LEVEL) : 0; }
  function applyLevel() { if (ctx && master) master.gain.setTargetAtTime(target(), ctx.currentTime, 0.12); }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    if (pending && ctx.state !== "closed") { var p = pending; pending = null; start(p.song, p.once, p.then); }
  }
  ["pointerdown", "keydown", "touchend"].forEach(function (ev) { window.addEventListener(ev, unlock, { capture: true, passive: true }); });
  document.addEventListener("visibilitychange", function () { hidden = document.hidden; applyLevel(); });

  // ------------------------------------------------------------- instruments
  function voiceOut(dest, sendVerb, sendDelay) {
    var g = ctx.createGain(); g.connect(dest || songGain || bus);
    if (sendVerb) { var s = ctx.createGain(); s.gain.value = sendVerb; g.connect(s); s.connect(verb); }
    if (sendDelay) { var e = ctx.createGain(); e.gain.value = sendDelay; g.connect(e); e.connect(delay); }
    return g;
  }
  function adsr(g, t, a, d, s, r, dur, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, d / 3);
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), r / 4);
  }
  function osc(type, f, t, end, detune) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.start(t); o.stop(end); return o;
  }
  function noise(t, end) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(end); return s; }

  var INST = {
    pad: function (n, t, dur, v) {
      var out = voiceOut(null, 0.55, 0), f = ctx.createBiquadFilter(), end = t + dur + 1.6;
      f.type = "lowpass"; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1500, t + dur * 0.6); f.Q.value = 0.4;
      f.connect(out); adsr(out, t, Math.min(0.6, dur * 0.4), 0.8, 0.8, 1.4, dur, 0.06 * v);
      [-9, 0, 8].forEach(function (dt) { osc("sawtooth", hz(n), t, end, dt).connect(f); });
    },
    choir: function (n, t, dur, v) {
      var out = voiceOut(null, 0.7, 0), f = ctx.createBiquadFilter(), end = t + dur + 1.8;
      f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.7; f.connect(out);
      adsr(out, t, Math.min(0.5, dur * 0.4), 0.6, 0.85, 1.6, dur, 0.09 * v);
      [-6, 6].forEach(function (dt) { var o = osc("triangle", hz(n), t, end, dt); o.connect(f); });
      var s = osc("square", hz(n), t, end, 2); var sg = ctx.createGain(); sg.gain.value = 0.25; s.connect(sg); sg.connect(f);
    },
    bass: function (n, t, dur, v) {
      var out = voiceOut(null, 0, 0), f = ctx.createBiquadFilter(), end = t + dur + 0.3;
      f.type = "lowpass"; f.Q.value = 6; f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.25, dur));
      f.connect(out); adsr(out, t, 0.006, 0.15, 0.6, 0.08, dur * 0.9, 0.2 * v);
      osc("sawtooth", hz(n), t, end).connect(f);
      var sub = osc("sine", hz(n - 12), t, end); var sg = ctx.createGain(); sg.gain.value = 0.8; sub.connect(sg); sg.connect(out);
    },
    pluck: function (n, t, dur, v) {
      var out = voiceOut(null, 0.25, 0.35), f = ctx.createBiquadFilter(), end = t + 0.6;
      f.type = "lowpass"; f.Q.value = 3; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.22);
      f.connect(out); adsr(out, t, 0.003, 0.12, 0.15, 0.2, 0.05, 0.07 * v);
      osc("square", hz(n), t, end, 4).connect(f); osc("sawtooth", hz(n), t, end, -5).connect(f);
    },
    bell: function (n, t, dur, v) {
      var out = voiceOut(null, 0.5, 0.3), end = t + 2.2;
      adsr(out, t, 0.002, 1.2, 0.0001, 0.6, 0.05, 0.07 * v);
      osc("sine", hz(n), t, end).connect(out);
      var m = osc("sine", hz(n) * 3.01, t, end), mg = ctx.createGain(); mg.gain.setValueAtTime(0.35, t); mg.gain.exponentialRampToValueAtTime(0.001, t + 0.8); m.connect(mg); mg.connect(out);
    },
    lead: function (n, t, dur, v) {
      var out = voiceOut(null, 0.35, 0.3), f = ctx.createBiquadFilter(), end = t + dur + 0.5;
      f.type = "lowpass"; f.Q.value = 1.5; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2800, t + 0.08); f.frequency.setTargetAtTime(1600, t + 0.1, 0.2);
      f.connect(out); adsr(out, t, 0.02, 0.2, 0.75, 0.25, dur, 0.085 * v);
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(12, t + 0.35);
      lfo.connect(lg); lfo.start(t); lfo.stop(end);
      [-7, 7].forEach(function (dt) { var o = osc("sawtooth", hz(n), t, end, dt); lg.connect(o.detune); o.connect(f); });
    },
    brass: function (n, t, dur, v) {
      var out = voiceOut(null, 0.45, 0.15), f = ctx.createBiquadFilter(), end = t + dur + 0.6;
      f.type = "lowpass"; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2600, t + 0.09); f.frequency.setTargetAtTime(1300, t + 0.12, 0.3);
      f.connect(out); adsr(out, t, 0.05, 0.3, 0.8, 0.4, dur, 0.1 * v);
      [-5, 0, 6].forEach(function (dt) { osc("sawtooth", hz(n), t, end, dt).connect(f); });
    },
    organ: function (n, t, dur, v) {
      var out = voiceOut(null, 0.6, 0), end = t + dur + 0.6;
      adsr(out, t, 0.03, 0.2, 0.9, 0.5, dur, 0.05 * v);
      [[1, 1], [2, 0.5], [3, 0.25], [0.5, 0.6]].forEach(function (h) { var o = osc("sine", hz(n) * h[0], t, end), g = ctx.createGain(); g.gain.value = h[1]; o.connect(g); g.connect(out); });
    },
    kick: function (n, t, dur, v) {
      var out = voiceOut(null, 0, 0), end = t + 0.5;
      out.gain.setValueAtTime(0.5 * v, t); out.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      var o = osc("sine", 150, t, end); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); o.connect(out);
    },
    snare: function (n, t, dur, v) {
      var out = voiceOut(null, 0.35, 0), end = t + 0.4, f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = 0.7; f.connect(out);
      out.gain.setValueAtTime(0.32 * v, t); out.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      noise(t, end).connect(f);
      var o = osc("triangle", 190, t, end); o.frequency.exponentialRampToValueAtTime(120, t + 0.1); var g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(out);
    },
    hat: function (n, t, dur, v) {
      var out = voiceOut(null, 0, 0), end = t + 0.1, f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = 7500; f.connect(out);
      out.gain.setValueAtTime(0.09 * v, t); out.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise(t, end).connect(f);
    },
    tom: function (n, t, dur, v) {
      var out = voiceOut(null, 0.4, 0), end = t + 0.6;
      out.gain.setValueAtTime(0.38 * v, t); out.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      var o = osc("sine", n ? hz(n) : 120, t, end); o.frequency.exponentialRampToValueAtTime((n ? hz(n) : 120) * 0.55, t + 0.3); o.connect(out);
      var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600; var ng = ctx.createGain(); ng.gain.setValueAtTime(0.3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08); noise(t, t + 0.1).connect(f); f.connect(ng); ng.connect(out);
    },
    boom: function (n, t, dur, v) {
      var out = voiceOut(null, 0.8, 0), end = t + 2.5;
      out.gain.setValueAtTime(0.55 * v, t); out.gain.exponentialRampToValueAtTime(0.001, t + 2);
      var o = osc("sine", 70, t, end); o.frequency.exponentialRampToValueAtTime(30, t + 1.5); o.connect(out);
      var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.2); noise(t, end).connect(f); var ng = ctx.createGain(); ng.gain.value = 0.5; f.connect(ng); ng.connect(out);
    }
  };
  var DRUMS = { kick: 1, snare: 1, hat: 1, tom: 1, boom: 1 };

  // ------------------------------------------------------------- song compiler
  function compile(s) {
    var steps = s.steps || 16, bars = s.chords ? s.chords.length : (s.bars || 1), total = steps * bars;
    var tracks = (s.tracks || []).map(function (tr) {
      var ev = new Array(total);
      var put = function (i, notes, len, vel) { if (i < total) ev[i] = { n: notes, len: len, v: vel || 1 }; };
      if (tr.gen) {
        for (var b = 0; b < bars; b++) {
          var ch = chord(s.chords[b]).map(function (n) { return n + 12 * (tr.oct || 0); }), b0 = b * steps;
          if (tr.gen === "pad") put(b0, ch, steps);
          else if (tr.gen === "root1") put(b0, [ch[0] - 12], steps);
          else if (tr.gen === "bass8" || tr.gen === "bass4") {
            var every = tr.gen === "bass8" ? 2 : 4;
            for (var i = 0; i < steps; i += every) put(b0 + i, [ch[0] - 12 + ((i / every) % 4 === 3 && tr.gen === "bass8" ? 12 : 0)], every * 0.9);
          } else if (tr.gen === "pulse16") { for (var p = 0; p < steps; p++) put(b0 + p, [ch[0] - 12], 0.8, p % 4 === 0 ? 1 : 0.7); }
          else if (tr.gen === "arp16" || tr.gen === "arp8") {
            var up = ch.concat([ch[0] + 12, ch[1] + 12]), e = tr.gen === "arp16" ? 1 : 2, k = 0;
            for (var a = 0; a < steps; a += e) { put(b0 + a, [up[k % up.length]], e, k % 4 === 0 ? 1 : 0.75); k++; }
          }
        }
      } else if (tr.notes) {
        var src = Array.isArray(tr.notes) ? tr.notes : [tr.notes];
        for (var bb = 0; bb < bars; bb++) {
          var toks = src[bb % src.length].trim().split(/\s+/), last = null;
          for (var q = 0; q < steps && q < toks.length; q++) {
            var tk = toks[q], idx = bb * steps + q;
            if (tk === "-") { if (last) last.len++; continue; }
            if (tk === "." || tk === "_") { last = null; continue; }
            if (tk === "x" || tk === "o") { put(idx, [0], 1, tk === "o" ? 0.55 : 1); last = null; continue; }
            var ns = tk.split("+").map(midi).filter(function (n) { return n != null; });
            if (!ns.length) continue;
            put(idx, ns.map(function (n) { return n + 12 * (tr.oct || 0); }), 1); last = ev[idx];
          }
        }
      }
      return { inst: INST[tr.inst] || INST.pluck, drum: !!DRUMS[tr.inst], vol: tr.vol == null ? 1 : tr.vol, ev: ev };
    });
    return { name: s.name || "song", bpm: s.bpm || 110, steps: steps, total: total, swing: s.swing || 0, tracks: tracks };
  }

  function schedule() {
    if (!song || !ctx) return;
    var sp = 60 / song.bpm / 4;
    while (nextT < ctx.currentTime + 0.18) {
      var t = nextT + (step % 2 ? song.swing * sp : 0);
      for (var i = 0; i < song.tracks.length; i++) {
        var tr = song.tracks[i], e = tr.ev[step];
        if (!e) continue;
        for (var j = 0; j < e.n.length; j++) {
          try { tr.inst(e.n[j], t, e.len * sp, tr.vol * e.v); } catch (err) { /* ignore a bad note */ }
        }
      }
      nextT += sp; step++;
      if (step >= song.total) {
        if (once) {
          var nxt = then; song = null; once = false; then = null;
          if (nxt) { var wait = (nextT - ctx.currentTime + 1.4) * 1000; setTimeout(function () { if (!song && !pending) start(nxt, false, null); }, wait); }
          return;
        }
        step = 0;
      }
    }
  }
  function start(s, isOnce, after) {
    if (!ctx || ctx.state !== "running") { pending = { song: s, once: isOnce, then: after }; if (ctx && ctx.resume) ctx.resume().then(function () { if (pending) unlock(); }, function () {}); return; }
    var old = songGain;
    if (old) { old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 1500); }
    songGain = ctx.createGain(); songGain.connect(bus);
    song = s.tracks && s.tracks[0] && s.tracks[0].ev ? s : compile(s);
    once = !!isOnce; then = after || null; step = 0;
    nextT = ctx.currentTime + 0.06;
    if (!timer) timer = setInterval(schedule, 30);
    schedule();
  }

  var cache = {};
  function prep(s) { if (!s) return null; var key = s.name || JSON.stringify(s).slice(0, 80); return cache[key] || (cache[key] = s); }
  window.ArcadeMusic = {
    play: function (s) { s = prep(s); if (!s) return; if (song && song.name === (s.name || "song") && !once) return; ensure(); start(s, false, null); },
    sting: function (s, after) { ensure(); start(prep(s), true, prep(after)); },
    stop: function () {
      pending = null; song = null; once = false; then = null;
      if (ctx && songGain) { var g = songGain; songGain = null; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2); setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 1500); }
    },
    setMuted: function (m) { muted = !!m; applyLevel(); },
    setEnabled: function (on) { enabled = !!on; lsSet(PREF, on ? "1" : "0"); applyLevel(); },
    duck: function (d) { ducked = !!d; applyLevel(); },
    unlock: unlock,
    compile: compile,
    get enabled() { return enabled; },
    get muted() { return muted; },
    get current() { return song ? song.name : pending ? (pending.song.name || "song") : null; },
    get running() { return !!(ctx && ctx.state === "running"); }
  };
})();

/* Vector arcade kit: storage, remappable input + gamepad, settings panel, synth audio core,
   glow/bloom renderer and phosphor persistence. Shared by the Asteroids Deluxe and Battlezone
   tributes (each folder carries its own copy). Written by: Howie */
(function () {
  'use strict';
  var K = window.VKit = {};
  K.DEBUG = /(?:^|[?&])debug=1(?:&|$)/.test(location.search);
  K.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  K.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  K.rand = function (a, b) { return a + Math.random() * (b - a); };

  var NAMES = { ArrowUp: '\u2191 Up', ArrowDown: '\u2193 Down', ArrowLeft: '\u2190 Left', ArrowRight: '\u2192 Right', Space: 'Space',
    ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
    Enter: 'Enter', Escape: 'Esc', Backspace: 'Bksp', Tab: 'Tab', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'" };
  K.keyName = function (c) {
    if (!c) return '\u2014';
    if (NAMES[c]) return NAMES[c];
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^Numpad/.test(c)) return 'Num ' + c.slice(6);
    return c;
  };

  /* ---------- input: remappable keys, touch holds and gamepads ---------- */
  K.input = function (opts) {
    var I = { binds: {}, listening: null };
    var defs = opts.actions, down = {}, edges = {}, touch = {}, pad = {}, padPrev = {};
    function defaults() { var b = {}; defs.forEach(function (d) { b[d.id] = [d.keys[0] || null, d.keys[1] || null]; }); return b; }
    I.load = function () {
      var saved = K.store.get(opts.storeKey, null), def = defaults();
      defs.forEach(function (d) { I.binds[d.id] = saved && Array.isArray(saved[d.id]) ? [saved[d.id][0] || null, saved[d.id][1] || null] : def[d.id]; });
    };
    I.save = function () { K.store.set(opts.storeKey, I.binds); };
    I.reset = function () { I.binds = defaults(); I.save(); };
    I.load();
    function idsFor(code) { var r = []; for (var id in I.binds) if (I.binds[id].indexOf(code) >= 0) r.push(id); return r; }
    window.addEventListener('keydown', function (e) {
      if (I.listening) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      var ids = idsFor(e.code);
      if (opts.onKey && opts.onKey(e, ids) === false) return;
      if (ids.length) {
        e.preventDefault();
        if (!e.repeat) ids.forEach(function (id) { edges[id] = (edges[id] || 0) + 1; });
      }
      down[e.code] = true;
    });
    window.addEventListener('keyup', function (e) { down[e.code] = false; });
    window.addEventListener('blur', function () { down = {}; touch = {}; });
    I.isDown = function (id) {
      var b = I.binds[id]; if (!b) return false;
      return !!(down[b[0]] || down[b[1]] || touch[id] > 0 || pad[id]);
    };
    I.hit = function (id) { if (edges[id] > 0) { edges[id] = 0; return true; } return false; };
    I.clear = function () { edges = {}; };
    I.press = function (id) { edges[id] = (edges[id] || 0) + 1; };
    I.setTouch = function (id, on) { touch[id] = Math.max(0, (touch[id] || 0) + (on ? 1 : -1)); if (on) I.press(id); };
    I.releaseTouch = function () { touch = {}; };
    I.padConnected = false;
    I.pollPad = function () {
      if (!navigator.getGamepads || !opts.pad) return;
      var pads = navigator.getGamepads() || [], gp = null;
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      I.padConnected = !!gp;
      padPrev = pad; pad = gp ? opts.pad(gp) : {};
      for (var id in pad) if (pad[id] && !padPrev[id]) I.press(id);
    };
    I.axis = {};
    return I;
  };

  /* ---------- settings panel (key capture) ---------- */
  K.settings = function (o) {
    var I = o.input, body = o.body;
    function render() {
      body.innerHTML = '';
      o.actions.forEach(function (d) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + d.label + '</td>';
        [0, 1].forEach(function (slot) {
          var td = document.createElement('td'), b = document.createElement('button');
          b.type = 'button'; b.className = 'keycap' + (I.binds[d.id][slot] ? '' : ' empty');
          b.textContent = K.keyName(I.binds[d.id][slot]);
          b.setAttribute('aria-label', d.label + (slot ? ' alternate key' : ' key') + ': ' + K.keyName(I.binds[d.id][slot]) + '. Click to change.');
          b.addEventListener('click', function () { listen(d.id, slot, b); });
          td.appendChild(b); tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }
    function listen(id, slot, btn) {
      I.listening = { id: id, slot: slot };
      btn.classList.add('listening'); btn.textContent = 'Press a key\u2026';
      if (o.msg) o.msg.textContent = 'Press the new key. Esc cancels, Backspace clears.';
      function onKey(e) {
        e.preventDefault(); e.stopPropagation();
        window.removeEventListener('keydown', onKey, true);
        if (e.code === 'Escape') { /* cancel */ }
        else if (e.code === 'Backspace') { I.binds[id][slot] = null; }
        else {
          for (var other in I.binds) for (var s = 0; s < 2; s++) if (I.binds[other][s] === e.code) I.binds[other][s] = null;
          I.binds[id][slot] = e.code;
        }
        I.save(); setTimeout(function () { I.listening = null; }, 0);
        if (o.msg) o.msg.textContent = 'Saved on this device.';
        render();
      }
      window.addEventListener('keydown', onKey, true);
    }
    render();
    return { render: render };
  };

  /* ---------- audio core: master + compressor + generated space reverb + stereo ---------- */
  K.audio = function (storeKey, volume) {
    var A = { ctx: null, muted: !!K.store.get(storeKey, false), listeners: [] };
    var VOL = volume || 0.7;
    A.unlock = function () {
      if (!A.ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        try { A.ctx = new C(); } catch (e) { return; }
        var c = A.ctx;
        A.master = c.createGain(); A.master.gain.value = A.muted ? 0 : VOL;
        var comp = c.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
        A.master.connect(comp); comp.connect(c.destination);
        A.dry = c.createGain(); A.dry.connect(A.master);
        // synthesized impulse response: decaying stereo noise with a little early-reflection comb
        var len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
        for (var ch = 0; ch < 2; ch++) {
          var d = ir.getChannelData(ch);
          for (var i = 0; i < len; i++) { var tt = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, 3.2) * (i % 1777 < 40 ? 1.6 : 1); }
        }
        A.verb = c.createConvolver(); A.verb.buffer = ir;
        A.wet = c.createGain(); A.wet.gain.value = 0.32;
        A.verb.connect(A.wet); A.wet.connect(A.master);
        var nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
        for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
        A.noiseBuf = nb;
        if (A.onReady) A.onReady();
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
    };
    A.live = function () { return !!(A.ctx && !A.muted && A.ctx.state === 'running'); };
    A.now = function () { return A.ctx ? A.ctx.currentTime : 0; };
    A.setMuted = function (m) {
      A.muted = !!m; K.store.set(storeKey, A.muted);
      if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : VOL, A.ctx.currentTime, 0.02);
      A.listeners.forEach(function (f) { f(A.muted); });
    };
    A.toggle = function () { A.unlock(); A.setMuted(!A.muted); };
    // output node: pan (-1..1) + reverb send amount
    A.out = function (pan, send) {
      var c = A.ctx, g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) { p.pan.value = K.clamp(pan || 0, -1, 1); g.connect(p); p.connect(A.dry); } else g.connect(A.dry);
      var s = c.createGain(); s.gain.value = send == null ? 0.35 : send; g.connect(s); s.connect(A.verb);
      return g;
    };
    // one-shot oscillator with pitch glide and envelope
    A.tone = function (o) {
      if (!A.live()) return;
      var c = A.ctx, t = c.currentTime + (o.delay || 0), dur = o.dur || 0.2;
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'square'; osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide || dur));
      if (o.detune) osc.detune.value = o.detune;
      var pk = o.gain == null ? 0.2 : o.gain, at = o.attack || 0.004;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var node = g;
      if (o.lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); f.connect(g); } else osc.connect(g);
      g.connect(A.out(o.pan, o.send));
      osc.start(t); osc.stop(t + dur + 0.05);
      return node;
    };
    // filtered noise burst with a sweeping cutoff
    A.noise = function (o) {
      if (!A.live()) return;
      var c = A.ctx, t = c.currentTime + (o.delay || 0), dur = o.dur || 0.4;
      var src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
      src.playbackRate.value = o.rate || 1;
      var f = c.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.Q.value = o.q || 0.8;
      f.frequency.setValueAtTime(o.f || 2000, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
      var g = c.createGain(), pk = o.gain == null ? 0.4 : o.gain;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(A.out(o.pan, o.send));
      src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    };
    // continuous loop with a controllable gain (thrust, engines, sirens)
    A.loop = function (build) {
      var L = { g: null, level: 0 };
      L.ensure = function () { if (!L.g && A.ctx) { L.g = A.ctx.createGain(); L.g.gain.value = 0; build(A.ctx, L); } };
      L.set = function (v, tc) { L.ensure(); if (!L.g) return; L.level = v; L.g.gain.setTargetAtTime(A.muted ? 0 : v, A.ctx.currentTime, tc || 0.04); };
      return L;
    };
    return A;
  };


  /* ---------- music: step sequencer of synthesized instruments (title theme, in-game loop, stings) ----------
     Songs: { bpm, len (16th steps), loop, tracks: [{ inst, vel, p: 'a1 - . c2+e2 ...' }] }
     '.' rest, '-' holds the previous note, '+' stacks a chord. Short patterns repeat. Music runs through
     the master bus, so the mute button silences it along with the effects. */
  var NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  K.midi = function (tok) {
    var m = /^([a-g])([#b]?)(-?\d)$/.exec(tok); if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  K.freq = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  function parsePattern(p) {
    var toks = p.trim().split(/\s+/), ev = [], last = null;
    toks.forEach(function (t, i) {
      if (t === '-') { if (last) last.len++; return; }
      last = null;
      if (t === '.') return;
      var ns = t.split('+').map(K.midi).filter(function (n) { return n != null; });
      if (ns.length) { last = { step: i, notes: ns, len: 1 }; ev.push(last); }
    });
    return { n: toks.length, ev: ev };
  }
  K.music = function (A, songs, opt) {
    opt = opt || {};
    var M = { on: K.store.get(opt.storeKey || 'vk.music', true), rate: 1, name: null };
    var VOL = opt.vol || 0.3, bus = null, songGain = null, timer = 0, step = 0, nextT = 0, song = null, parsed = null, want = null, duck = 1;
    function ensure() {
      if (bus || !A.ctx) return bus;
      bus = A.ctx.createGain(); bus.gain.value = M.on ? VOL : 0; bus.connect(A.dry);
      var s = A.ctx.createGain(); s.gain.value = 0.22; bus.connect(s); s.connect(A.verb);
      return bus;
    }
    function env(g, t, v, a, d, rel) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
      g.gain.setTargetAtTime(0.0001, t + Math.max(a, d), rel);
    }
    var INST = {
      bass: function (c, out, t, f, d, v) {
        var o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f / 2;
        fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(f * 9, t); fl.frequency.exponentialRampToValueAtTime(f * 1.6, t + Math.min(0.35, d));
        var g2 = c.createGain(); g2.gain.value = 0.5; o2.connect(g2); g2.connect(fl);
        o.connect(fl); fl.connect(g); g.connect(out); env(g, t, v * 0.42, 0.006, d * 0.8, 0.06);
        o.start(t); o2.start(t); o.stop(t + d + 0.4); o2.stop(t + d + 0.4);
      },
      pad: function (c, out, t, f, d, v) {
        var fl = c.createBiquadFilter(), g = c.createGain();
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(1500, t + d * 0.5); fl.frequency.linearRampToValueAtTime(700, t + d); fl.Q.value = 1.5;
        [-9, 0, 8].forEach(function (dt) { var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(fl); o.start(t); o.stop(t + d + 1.6); });
        fl.connect(g); g.connect(out);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.09, t + Math.min(0.6, d * 0.4)); g.gain.setTargetAtTime(0.0001, t + d, 0.45);
      },
      pluck: function (c, out, t, f, d, v) {
        var o = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
        o.type = 'square'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2.001;
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 12, t); fl.frequency.exponentialRampToValueAtTime(f * 2, t + 0.25);
        o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out); env(g, t, v * 0.16, 0.003, 0.02, 0.12);
        o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
      },
      lead: function (c, out, t, f, d, v) {
        var o = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), fl = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f; o2.detune.value = 6;
        lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.35);
        lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        fl.type = 'lowpass'; fl.frequency.value = Math.min(5000, f * 6); fl.Q.value = 2;
        o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out); env(g, t, v * 0.1, 0.03, d * 0.85, 0.12);
        [o, o2, lfo].forEach(function (x) { x.start(t); x.stop(t + d + 0.8); });
      },
      bell: function (c, out, t, f, d, v) {
        [[1, 1], [2.76, 0.4], [5.4, 0.18], [0.5, 0.3]].forEach(function (p) {
          var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
          o.connect(g); g.connect(out); env(g, t, v * 0.12 * p[1], 0.004, 0.01, 0.5 / p[0] + 0.2); o.start(t); o.stop(t + 3);
        });
      },
      kick: function (c, out, t, f, d, v) {
        var o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
        o.connect(g); g.connect(out); env(g, t, v * 0.75, 0.002, 0.02, 0.09); o.start(t); o.stop(t + 0.6);
      },
      thump: function (c, out, t, f, d, v) { // the heartbeat: a deep tuned thud with a felt click
        var o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
        o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        o.connect(g); g.connect(out); env(g, t, v * 0.9, 0.003, 0.05, 0.08); o.start(t); o.stop(t + 0.6);
        var s = c.createBufferSource(), fl = c.createBiquadFilter(), g2 = c.createGain(); s.buffer = A.noiseBuf;
        fl.type = 'lowpass'; fl.frequency.value = 900; s.connect(fl); fl.connect(g2); g2.connect(out); env(g2, t, v * 0.12, 0.001, 0.005, 0.02);
        s.start(t, Math.random()); s.stop(t + 0.12);
      },
      hat: function (c, out, t, f, d, v) {
        var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = A.noiseBuf;
        fl.type = 'highpass'; fl.frequency.value = 7000; s.connect(fl); fl.connect(g); g.connect(out); env(g, t, v * 0.08, 0.001, 0.005, 0.025);
        s.start(t, Math.random()); s.stop(t + 0.15);
      },
      snare: function (c, out, t, f, d, v) {
        var s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = A.noiseBuf;
        fl.type = 'bandpass'; fl.frequency.value = 1900; fl.Q.value = 0.7; s.connect(fl); fl.connect(g); g.connect(out); env(g, t, v * 0.28, 0.001, 0.01, 0.06);
        s.start(t, Math.random()); s.stop(t + 0.3);
        var o = c.createOscillator(), g2 = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        o.connect(g2); g2.connect(out); env(g2, t, v * 0.25, 0.001, 0.01, 0.04); o.start(t); o.stop(t + 0.3);
      }
    };
    M.INST = INST;
    function tick() {
      if (!song || !A.ctx) return;
      var c = A.ctx, sps = 60 / (song.bpm * M.rate) / 4;
      if (nextT < c.currentTime - 0.25) nextT = c.currentTime + 0.02; // tab was asleep: don't burst-play the backlog
      while (nextT < c.currentTime + 0.16) {
        if (A.live() && M.on) {
          parsed.forEach(function (tr) {
            var local = step % tr.pat.n;
            tr.pat.ev.forEach(function (e) {
              if (e.step !== local) return;
              e.notes.forEach(function (n) { INST[tr.inst](c, songGain, nextT, K.freq(n + (tr.tr || 0)), e.len * sps, tr.vel == null ? 0.7 : tr.vel); });
            });
          });
        }
        step++; nextT += sps;
        if (step >= song.len) {
          if (song.loop) step = 0;
          else { var done = song; stopTimer(); if (done.then) setTimeout(function () { if (!song) M.play(done.then); }, Math.max(0, (nextT - c.currentTime) * 1000 + 400)); return; }
        }
      }
    }
    function stopTimer() { clearInterval(timer); timer = 0; song = null; M.name = null; }
    M.play = function (name, force) {
      want = name;
      if (!A.ctx) return; // starts when the audio context unlocks
      if (!force && M.name === name && song) return;
      M.stop(0.08);
      var s = songs[name]; if (!s) return;
      ensure();
      songGain = A.ctx.createGain(); songGain.gain.value = 1; songGain.connect(bus);
      song = s; M.name = name; step = 0; M.rate = 1; nextT = A.ctx.currentTime + 0.05;
      parsed = s.tracks.map(function (t) { return { inst: t.inst, vel: t.vel, tr: t.tr, pat: parsePattern(t.p) }; });
      timer = setInterval(tick, 25); tick();
    };
    M.stop = function (fade) {
      want = null;
      if (songGain && A.ctx) { var g = songGain; g.gain.setTargetAtTime(0.0001, A.ctx.currentTime, fade || 0.12); setTimeout(function () { try { g.disconnect(); } catch (e) { } }, 1500); }
      songGain = null; stopTimer();
    };
    M.resume = function () { if (want && !song) M.play(want); };
    M.setOn = function (on) { M.on = !!on; K.store.set(opt.storeKey || 'vk.music', M.on); if (bus) bus.gain.setTargetAtTime(M.on ? VOL * duck : 0, A.ctx.currentTime, 0.05); };
    M.duck = function (d) { duck = d; if (bus) bus.gain.setTargetAtTime(M.on ? VOL * duck : 0, A.ctx.currentTime, 0.12); };
    M.setRate = function (r) { M.rate = r; };
    return M;
  };

  /* ---------- vector stroke font (arcade-style, 4x6 grid; 'xy' points, '|' separates strokes) ---------- */
  var GLYPH = {
    A: '06 02 20 42 46|03 43', B: '06 00 30 41 42 33 03|33 44 45 36 06', C: '40 00 06 46', D: '06 00 20 42 44 26 06', E: '40 00 06 46|03 33',
    F: '40 00 06|03 33', G: '30 00 06 46 43 23', H: '00 06|40 46|03 43', I: '00 40|20 26|06 46', J: '40 45 36 16 05', K: '00 06|40 03 46',
    L: '00 06 46', M: '06 00 23 40 46', N: '06 00 46 40', O: '00 40 46 06 00', P: '06 00 40 43 03', Q: '00 40 44 26 06 00|24 46',
    R: '06 00 40 43 03|13 46', S: '40 00 03 43 46 06', T: '00 40|20 26', U: '00 06 46 40', V: '00 26 40', W: '00 06 24 46 40',
    X: '00 46|40 06', Y: '00 23 40|23 26', Z: '00 40 06 46',
    0: '00 40 46 06 00|40 06', 1: '11 20 26|06 46', 2: '00 40 43 03 06 46', 3: '00 40 46 06|03 43', 4: '00 03 43|40 46', 5: '40 00 03 43 46 06',
    6: '00 06 46 43 03', 7: '00 40 46', 8: '00 40 46 06 00|03 43', 9: '43 03 00 40 46',
    '-': '03 43', '.': '25 26', ':': '21 22|24 25', '!': '20 24|25 26', '/': '06 40', '?': '01 00 40 42 23 24|25 26', "'": '20 21', ',': '25 16',
    '+': '03 43|21 25', '(': '30 13 36', ')': '10 33 16', '<': '40 03 46', '>': '00 43 06', '=': '02 42|04 44', '%': '00 11|06 40|35 46', '&': '46 01 10 21 12 05 16 26 44', '*': '13 33|11 35|31 15'
  };
  var GL = {};
  Object.keys(GLYPH).forEach(function (k) { GL[k] = GLYPH[k].split('|').map(function (s) { return s.trim().split(' ').map(function (p) { return [+p[0], +p[1]]; }); }); });
  K.textWidth = function (str, size) { var k = size / 6; return Math.max(0, String(str).length * 6 * k - 2 * k); };
  // strokes text into ctx's current path; caller strokes. align: 0 left, 0.5 center, 1 right
  K.textPath = function (c, str, x, y, size, align) {
    str = String(str).toUpperCase();
    var k = size / 6, x0 = x - K.textWidth(str, size) * (align || 0);
    for (var i = 0; i < str.length; i++) {
      var g = GL[str[i]]; if (!g) continue;
      var gx = x0 + i * 6 * k;
      g.forEach(function (st) { c.moveTo(gx + st[0][0] * k, y + st[0][1] * k); for (var j = 1; j < st.length; j++) c.lineTo(gx + st[j][0] * k, y + st[j][1] * k); });
    }
  };

  /* ---------- glow renderer: phosphor scene + progressive-downsample bloom ---------- */
  K.glow = function (canvas, opt) {
    opt = opt || {};
    var R = { canvas: canvas, vis: canvas.getContext('2d') };
    var scene = document.createElement('canvas'), chain = [];
    R.ctx = scene.getContext('2d');
    for (var i = 0; i < 3; i++) { var cv = document.createElement('canvas'); chain.push({ cv: cv, cx: cv.getContext('2d') }); }
    R.resize = function (w, h) {
      canvas.width = scene.width = w; canvas.height = scene.height = h;
      var s = 2;
      chain.forEach(function (c) { c.cv.width = Math.max(1, Math.round(w / s)); c.cv.height = Math.max(1, Math.round(h / s)); s *= 2; });
      R.w = w; R.h = h;
      R.ctx.lineCap = R.ctx.lineJoin = 'round';
    };
    R.fade = function (a) {
      var c = R.ctx; c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.fillStyle = 'rgba(0,0,0,' + a + ')'; c.fillRect(0, 0, R.w, R.h);
    };
    R.present = function (bg) {
      var prev = scene;
      chain.forEach(function (c) {
        c.cx.globalCompositeOperation = 'copy'; c.cx.imageSmoothingEnabled = true; c.cx.imageSmoothingQuality = 'high';
        c.cx.drawImage(prev, 0, 0, c.cv.width, c.cv.height); prev = c.cv;
      });
      var v = R.vis;
      v.globalCompositeOperation = 'source-over'; v.globalAlpha = 1;
      if (bg) bg(v); else { v.fillStyle = '#000'; v.fillRect(0, 0, R.w, R.h); }
      v.globalCompositeOperation = 'lighter';
      v.drawImage(scene, 0, 0);
      v.imageSmoothingEnabled = true; v.imageSmoothingQuality = 'high';
      v.globalAlpha = opt.b1 == null ? 0.55 : opt.b1; v.drawImage(chain[0].cv, 0, 0, R.w, R.h);
      v.globalAlpha = opt.b2 == null ? 0.75 : opt.b2; v.drawImage(chain[1].cv, 0, 0, R.w, R.h);
      v.globalAlpha = opt.b3 == null ? 0.9 : opt.b3; v.drawImage(chain[2].cv, 0, 0, R.w, R.h);
      v.globalAlpha = 1; v.globalCompositeOperation = 'source-over';
    };
    return R;
  };

  /* ---------- touch buttons: [data-act] elements become hold buttons ---------- */
  K.bindTouch = function (root, input, onAny) {
    var els = root.querySelectorAll('[data-act]');
    Array.prototype.forEach.call(els, function (b) {
      var act = b.getAttribute('data-act'), ids = {};
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); if (onAny) onAny();
        ids[e.pointerId] = 1; b.classList.add('active'); input.setTouch(act, true);
        try { b.setPointerCapture(e.pointerId); } catch (x) { }
      });
      function up(e) { if (!ids[e.pointerId]) return; delete ids[e.pointerId]; input.setTouch(act, false); if (!Object.keys(ids).length) b.classList.remove('active'); }
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  };
})();

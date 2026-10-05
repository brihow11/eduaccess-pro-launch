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

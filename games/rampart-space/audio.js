/* Rampart: Space Edition - synthesized ambient score and sound effects (Web Audio, no files). Written by: Howie */
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext, ctx = null, master = null, musicBus = null, sfxBus = null, verb = null, muted = false, started = false;
  var last = {}, hum = null, humGain = null, music = { on: false, mood: 'calm', step: 0, next: 0, timer: 0, intensity: 0 };
  try { muted = localStorage.getItem('rstd.muted') === '1'; } catch (e) { }
  function impulse(sec, decay) { var n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  var noiseBuf = null;
  function init() {
    if (ctx || !AC) return; ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.34; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);
    verb = ctx.createConvolver(); verb.buffer = impulse(3.4, 2.6); var vg = ctx.createGain(); vg.gain.value = 0.55; verb.connect(vg); vg.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); var nd = noiseBuf.getChannelData(0); for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // continuous laser hum, level follows active beam count
    hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 110; var hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 900; humGain = ctx.createGain(); humGain.gain.value = 0;
    hum.connect(hf); hf.connect(humGain); humGain.connect(sfxBus); hum.start();
  }
  function unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); started = true; }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });
  function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f, t, a, peak, d, dest, f2, wet) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    env(g, t, a, peak, d); o.connect(g); g.connect(dest || sfxBus); if (wet) { var w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); } o.start(t); o.stop(t + a + d + 0.05); return o;
  }
  function noise(t, dur, peak, ftype, f, f2, q, dest, wet) {
    var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = ftype; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || 1;
    env(g, t, 0.005, peak, dur); s.connect(fl); fl.connect(g); g.connect(dest || sfxBus); if (wet) { var w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verb); } s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  var SFX = {
    rail: function (t) { tone('square', 1800, t, 0.002, 0.12, 0.08, null, 300); noise(t, 0.35, 0.3, 'bandpass', 3000, 400, 2, null, 0.3); tone('sine', 90, t, 0.005, 0.35, 0.3, null, 40); },
    missile: function (t) { noise(t, 0.4, 0.16, 'bandpass', 800, 2400, 1.5, null, 0.15); },
    boom: function (t) { noise(t, 0.7, 0.5, 'lowpass', 1400, 80, 0.7, null, 0.35); tone('sine', 70, t, 0.004, 0.45, 0.5, null, 30); },
    bigboom: function (t) { noise(t, 2.2, 0.8, 'lowpass', 900, 40, 0.7, null, 0.6); tone('sine', 55, t, 0.01, 0.7, 1.8, null, 22); },
    pop: function (t) { noise(t, 0.18, 0.22, 'bandpass', 1800, 500, 1.2, null, 0.15); },
    zap: function (t) { tone('triangle', 1400, t, 0.002, 0.08, 0.06, null, 700); },
    build: function (t) { [523, 784, 1046].forEach(function (f, i) { tone('sine', f, t + i * 0.06, 0.005, 0.18, 0.5, null, null, 0.5); }); noise(t, 0.15, 0.1, 'highpass', 3000, 3000); },
    upgrade: function (t) { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone('triangle', f, t + i * 0.055, 0.005, 0.14, 0.45, null, null, 0.5); }); },
    sell: function (t) { [784, 523].forEach(function (f, i) { tone('sine', f, t + i * 0.08, 0.005, 0.15, 0.3, null, null, 0.3); }); },
    click: function (t) { tone('sine', 880, t, 0.002, 0.08, 0.06); },
    deny: function (t) { tone('square', 160, t, 0.004, 0.08, 0.16); },
    wave: function (t) { [196, 294, 392].forEach(function (f, i) { tone('sawtooth', f, t + i * 0.02, 0.25, 0.06, 1.4, null, null, 0.7); }); },
    leak: function (t) { tone('sine', 220, t, 0.01, 0.25, 0.5, null, 150, 0.4); tone('sine', 110, t, 0.01, 0.2, 0.6); },
    strike: function (t) { noise(t, 1.0, 0.25, 'bandpass', 4000, 300, 1, null, 0.4); tone('sine', 1200, t, 0.01, 0.1, 0.8, null, 120); },
    dilate: function (t) { tone('sine', 600, t, 0.05, 0.2, 1.6, null, 150, 0.8); tone('sine', 900, t, 0.05, 0.12, 1.6, null, 220, 0.8); },
    shield: function (t) { tone('sine', 1600, t, 0.002, 0.04, 0.1, null, 1100); },
    disrupt: function (t) { tone('sawtooth', 300, t, 0.005, 0.07, 0.3, null, 80); },
    win: function (t) { [392, 523, 659, 784, 1046].forEach(function (f, i) { tone('triangle', f, t + i * 0.12, 0.01, 0.16, 1.2, null, null, 0.8); }); },
    lose: function (t) { [392, 330, 262, 196].forEach(function (f, i) { tone('sine', f, t + i * 0.25, 0.02, 0.18, 1.0, null, null, 0.7); }); },
    alarm: function (t) { [0, 0.5].forEach(function (d) { tone('sine', 330, t + d, 0.15, 0.12, 0.3, null, 300, 0.6); }); }
  };
  var GAP = { rail: 0.05, missile: 0.07, boom: 0.06, pop: 0.04, zap: 0.05, shield: 0.08, disrupt: 0.2 };
  function play(name) {
    if (!ctx || muted || !SFX[name]) return; var now = ctx.currentTime; if (last[name] && now - last[name] < (GAP[name] || 0.02)) return; last[name] = now;
    try { SFX[name](now + 0.005); } catch (e) { }
  }
  // ---------- ambient score: pad chords + bell arpeggio + bass, slower in calm, pulse in battle ----------
  var SONGS = {
    calm: { bpm: 64, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]] },
    battle: { bpm: 84, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 56]] },
    boss: { bpm: 92, chords: [[40, 47, 52, 55], [41, 48, 53, 56], [38, 45, 50, 53], [40, 47, 52, 56]] }
  };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function pad(f, t, dur, vol) {
    [-6, 6].forEach(function (det) {
      var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; fl.type = 'lowpass'; fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(1300, t + dur * 0.5); fl.frequency.linearRampToValueAtTime(600, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
      o.connect(fl); fl.connect(g); g.connect(musicBus); var w = ctx.createGain(); w.gain.value = 0.6; g.connect(w); w.connect(verb); o.start(t); o.stop(t + dur * 1.1);
    });
  }
  function schedule() {
    if (!ctx || !music.on) return;
    var S = SONGS[music.mood] || SONGS.calm, beat = 60 / S.bpm, now = ctx.currentTime;
    if (music.next < now) music.next = now + 0.05;
    while (music.next < now + 0.6) {
      var t = music.next, st = music.step, bar = Math.floor(st / 8), ch = S.chords[bar % S.chords.length], inBar = st % 8;
      if (inBar === 0) { ch.forEach(function (n) { pad(mtof(n), t, beat * 8, 0.035); }); tone('sine', mtof(ch[0] - 12), t, 0.08, 0.16, beat * 7, musicBus); }
      var arp = [0, 2, 1, 3, 2, 1, 3, 2][inBar], an = ch[arp] + 12 + (bar % 2 ? 12 : 0);
      if (music.mood !== 'calm' || inBar % 2 === 0) tone('sine', mtof(an), t, 0.004, music.mood === 'calm' ? 0.05 : 0.04, beat * 1.6, musicBus, null, 0.9);
      if (music.mood !== 'calm') { if (inBar % 2 === 0) { tone('sine', 60, t, 0.002, 0.22 * music.intensity, 0.18, musicBus, 38); } if (inBar % 4 === 2) noise(t, 0.12, 0.05 * music.intensity, 'highpass', 6000, 6000, 1, musicBus); }
      music.step++; music.next += beat;
    }
  }
  setInterval(schedule, 120);
  window.RSAudio = {
    play: play,
    unlock: unlock,
    setMood: function (m, intensity) { music.mood = m; music.intensity = intensity == null ? 1 : intensity; if (!music.on) { music.on = true; music.step = 0; } },
    stopMusic: function () { music.on = false; },
    beams: function (n) { if (!ctx || !humGain) return; humGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.05, n * 0.012), ctx.currentTime, 0.05); },
    setMuted: function (m) { muted = m; try { localStorage.setItem('rstd.muted', m ? '1' : '0'); } catch (e) { } if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05); },
    isMuted: function () { return muted; },
    suspend: function (s) { if (!ctx) return; if (s) ctx.suspend(); else ctx.resume(); }
  };
})();

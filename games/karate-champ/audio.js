/* Karate Champ tribute: synthesized sound effects (Web Audio, no files) and the soundtrack for the shared ArcadeMusic
   sequencer (title theme, in-game loops, bonus round, victory and defeat stings). Written by: Howie */
(function () {
  "use strict";
  var K = window.VKit;
  var A = K.audio("karate-champ.muted", 0.75);
  var Mus = window.ArcadeMusic || null;
  if (Mus) Mus.setMuted(A.muted);
  var SFX = {
    whoosh: function (p) { A.noise({ f: 900, to: 3200, dur: 0.16, gain: 0.22, ftype: "bandpass", q: 1.4, pan: p, send: 0.1 }); },
    whooshBig: function (p) { A.noise({ f: 500, to: 2600, dur: 0.26, gain: 0.3, ftype: "bandpass", q: 1.1, pan: p, send: 0.15 }); },
    hit: function (p) { // a hard thwack: noise crack + body thump
      A.noise({ f: 3800, to: 600, dur: 0.12, gain: 0.55, ftype: "lowpass", pan: p, send: 0.2 });
      A.tone({ type: "sine", f: 170, to: 55, dur: 0.22, gain: 0.6, pan: p, send: 0.15 });
      A.tone({ type: "square", f: 90, to: 50, dur: 0.08, gain: 0.12, lp: 900, pan: p });
    },
    hitBig: function (p) {
      SFX.hit(p);
      A.noise({ f: 1800, to: 200, dur: 0.4, gain: 0.35, pan: p, send: 0.4, delay: 0.02 });
      A.tone({ type: "triangle", f: 120, to: 40, dur: 0.45, gain: 0.5, pan: p, send: 0.3 });
    },
    block: function (p) { A.tone({ type: "square", f: 820, to: 500, dur: 0.06, gain: 0.16, lp: 2600, pan: p }); A.noise({ f: 2400, dur: 0.05, gain: 0.3, ftype: "highpass", pan: p }); A.tone({ type: "triangle", f: 300, dur: 0.1, gain: 0.25, pan: p }); },
    kiai: function (p, hi) { // a short shout: buzzy voice through a falling vowel filter
      var base = hi ? 230 : 160;
      A.tone({ type: "sawtooth", f: base * 1.3, to: base, dur: 0.22, gain: 0.16, lp: 1400, q: 5, pan: p, send: 0.3 });
      A.tone({ type: "sawtooth", f: base * 2.6, to: base * 2, dur: 0.18, gain: 0.06, lp: 2200, q: 8, pan: p, send: 0.3 });
      A.noise({ f: 2800, to: 900, dur: 0.12, gain: 0.08, ftype: "bandpass", q: 2, pan: p });
    },
    fall: function (p) { A.noise({ f: 700, to: 90, dur: 0.35, gain: 0.5, pan: p, send: 0.2 }); A.tone({ type: "sine", f: 90, to: 40, dur: 0.3, gain: 0.5, pan: p }); },
    step: function (p) { A.noise({ f: 500, dur: 0.05, gain: 0.06, ftype: "lowpass", pan: p, send: 0 }); },
    land: function (p) { A.noise({ f: 400, to: 120, dur: 0.12, gain: 0.25, pan: p }); },
    gong: function () { [1, 2.02, 2.76, 4.1].forEach(function (m, i) { A.tone({ type: "sine", f: 98 * m, dur: 2.6 - i * 0.4, gain: 0.22 / (i + 1), send: 0.7, attack: 0.01 }); }); A.noise({ f: 300, dur: 0.6, gain: 0.12, send: 0.6 }); },
    whistle: function () { A.tone({ type: "sine", f: 2600, dur: 0.18, gain: 0.14, send: 0.2 }); A.tone({ type: "sine", f: 2900, dur: 0.3, gain: 0.12, delay: 0.16, send: 0.2 }); },
    point: function (full) { var n = full ? [523, 659, 784, 1046] : [523, 659]; n.forEach(function (f, i) { A.tone({ type: "triangle", f: f, dur: 0.22, gain: 0.18, delay: i * 0.08, send: 0.4 }); }); },
    tick: function () { A.tone({ type: "square", f: 1300, dur: 0.04, gain: 0.07, lp: 4000 }); },
    select: function () { A.tone({ type: "triangle", f: 660, to: 990, dur: 0.1, gain: 0.15 }); },
    crack: function () { A.noise({ f: 5000, to: 400, dur: 0.25, gain: 0.6, send: 0.3 }); A.tone({ type: "square", f: 220, to: 60, dur: 0.18, gain: 0.25, lp: 1200 }); A.noise({ f: 1200, to: 200, dur: 0.5, gain: 0.3, delay: 0.05, send: 0.4 }); },
    shatter: function (p) { for (var i = 0; i < 4; i++) A.tone({ type: "triangle", f: 1800 + Math.random() * 2400, dur: 0.12, gain: 0.08, delay: i * 0.03, pan: p, send: 0.3 }); A.noise({ f: 6000, to: 1500, dur: 0.22, gain: 0.35, ftype: "highpass", pan: p }); },
    throwIt: function (p) { A.noise({ f: 600, to: 1800, dur: 0.3, gain: 0.12, ftype: "bandpass", q: 2, pan: p }); },
    bump: function (p) { A.tone({ type: "sine", f: 200, to: 70, dur: 0.2, gain: 0.45, pan: p }); A.noise({ f: 900, to: 200, dur: 0.2, gain: 0.3, pan: p }); },
    moo: function (p) { A.tone({ type: "sawtooth", f: 120, to: 85, dur: 0.9, gain: 0.2, lp: 700, q: 6, pan: p, send: 0.3, attack: 0.08 }); A.tone({ type: "sawtooth", f: 240, to: 170, dur: 0.8, gain: 0.06, lp: 900, pan: p, attack: 0.1 }); },
    hooves: function (p) { A.noise({ f: 700, dur: 0.05, gain: 0.18, pan: p }); A.noise({ f: 600, dur: 0.05, gain: 0.14, delay: 0.09, pan: p }); },
    meter: function (v) { A.tone({ type: "square", f: 300 + v * 900, dur: 0.03, gain: 0.04, lp: 3000 }); }
  };
  // ---- songs for ArcadeMusic: minor pentatonic koto plucks, taiko toms, brass and organ pads
  var SONGS = {
    title: { name: "kc-title", bpm: 92, steps: 16, chords: ["D3m", "A#2", "C3", "A2", "D3m", "F2", "G2m", "A2"],
      tracks: [
        { inst: "organ", gen: "pad", vol: 0.6, oct: 0 },
        { inst: "bass", gen: "bass4", vol: 0.6, oct: 1 },
        { inst: "boom", notes: ["x . . . . . . . x . . . . . . .", "x . . . . . . . . . . . x . x ."], vol: 0.55 },
        { inst: "tom", notes: ". . . . x . . x . . x . . . . .", vol: 0.45 },
        { inst: "pluck", vol: 0.7, notes: ["D5 . A4 . D5 F5 . E5 D5 . C5 . A4 . . .", "A#4 . D5 . F5 . D5 . C5 . A#4 . A4 . . .", "C5 . E5 . G5 . E5 D5 C5 . G4 . E4 . . .", "A4 . C#5 . E5 . - . A5 . G5 . E5 . C#5 .",
          "D5 . F5 . A5 . G5 F5 D5 . C5 . A4 . . .", "C5 . A4 . F4 . A4 . C5 . F5 . E5 . . .", "D5 . A#4 . G4 . A#4 D5 G5 . F5 . D5 . . .", "E5 - - - C#5 - - - A4 - - - - - . ."] },
        { inst: "brass", vol: 0.4, notes: ["D4 - - - - - - - - - - - - - - -", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", "E4 - - - - - - - C#4 - - - - - - -"] }
      ] },
    fight: [
      { name: "kc-fight1", bpm: 128, steps: 16, chords: ["A2m", "A2m", "F2", "G2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.8, oct: 1 }, { inst: "pluck", gen: "arp8", vol: 0.35, oct: 2 },
          { inst: "tom", notes: "x . . x . . x . x . x . x . . .", vol: 0.5 }, { inst: "kick", notes: "x . . . x . . . x . . . x . . .", vol: 0.65 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . o", vol: 0.45 }, { inst: "hat", notes: "x . x . x . x . x . x . x . x .", vol: 0.4 },
          { inst: "lead", vol: 0.34, notes: ["A4 - C5 - D5 - E5 - G5 - E5 - D5 - C5 -", "A4 - - - E5 - - - D5 - C5 - A4 - - -", "F4 - A4 - C5 - - - D5 - C5 - A4 - F4 -", "G4 - B4 - D5 - - - E5 - D5 - B4 - - -"] }
        ] },
      { name: "kc-fight2", bpm: 138, steps: 16, swing: 0.04, chords: ["D3m", "C3", "A#2", "A2"],
        tracks: [
          { inst: "bass", gen: "pulse16", vol: 0.55, oct: 1 }, { inst: "organ", gen: "pad", vol: 0.35, oct: 1 },
          { inst: "kick", notes: "x . . x . . x . x . . x . . x .", vol: 0.75 }, { inst: "snare", notes: ". . . . x . . . . . . . x . x o", vol: 0.5 }, { inst: "tom", notes: ". . . . . . . . . . . . . x x x", vol: 0.45 },
          { inst: "brass", vol: 0.42, notes: ["D5 - - - A4 - - - F4 - A4 - D5 - - -", "C5 - - - G4 - - - E4 - G4 - C5 - - -", "A#4 - - - F4 - - - D4 - F4 - A#4 - - -", "A4 - - - C#5 - - - E5 - - - A5 - - -"] }
        ] },
      { name: "kc-fight3", bpm: 150, steps: 16, chords: ["E3m", "C3", "D3", "B2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.9, oct: 1 }, { inst: "pluck", gen: "arp16", vol: 0.32, oct: 2 }, { inst: "choir", gen: "pad", vol: 0.35, oct: 1 },
          { inst: "kick", notes: "x . x . x . . x x . x . x . . .", vol: 0.8 }, { inst: "boom", notes: "x . . . . . . . . . . . . . . .", vol: 0.4 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . .", vol: 0.5 },
          { inst: "lead", vol: 0.36, notes: ["E5 - - - B4 - G4 - E5 - F#5 - G5 - - -", "E5 - - - C5 - - - G4 - - - C5 - - -", "D5 - F#5 - A5 - - - F#5 - D5 - A4 - - -", "B4 - - - D#5 - - - F#5 - - - B5 - - -"] }
        ] }
    ],
    bonus: { name: "kc-bonus", bpm: 144, steps: 16, chords: ["G2", "E2m", "C3", "D3"],
      tracks: [
        { inst: "bass", gen: "bass8", vol: 0.75, oct: 1 }, { inst: "bell", gen: "arp8", vol: 0.4, oct: 2 },
        { inst: "kick", notes: "x . . . x . . . x . . . x . . .", vol: 0.6 }, { inst: "hat", notes: ". . x . . . x . . . x . . . x .", vol: 0.5 }, { inst: "tom", notes: ". . . . . . . . . . . . x . x x", vol: 0.4 }
      ] },
    victory: { name: "kc-victory", bpm: 112, steps: 16, chords: ["D3", "G3", "A3", "D3"],
      tracks: [
        { inst: "brass", vol: 0.85, notes: ["D4+F#4+A4 - - A4 D5 - - - F#5 - - - E5 - D5 -", "B4+D5 - - - G5 - - - D5 - - - B4 - - -", "C#5+E5 - - - E5 - A5 - G5 - - - E5 - C#5 -", "D5+F#5+A5 - - - - - - - - - - - - - - -"] },
        { inst: "organ", gen: "pad", vol: 0.6, oct: 0 }, { inst: "bass", gen: "bass4", vol: 0.7, oct: 1 },
        { inst: "boom", notes: ["x . . . . . . . x . . . . . . .", "x . . . . . . . . . . . . . . .", "x . . x x . . . x . x . x . x x", "x . . . . . . . . . . . . . . ."], vol: 0.6 }
      ] },
    win: { name: "kc-boutwin", bpm: 132, steps: 16, chords: ["A2", "D3"],
      tracks: [{ inst: "brass", vol: 0.7, notes: ["A4+C#5 - - E5 - A5 - - - - - - - - - -", "F#5+A5 - - - - - - - - - - - - - - -"] }, { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", "x . . . . . . . . . . . . . . ."], vol: 0.5 }] },
    over: { name: "kc-over", bpm: 76, steps: 16, chords: ["D3m", "G2m", "A2"],
      tracks: [
        { inst: "organ", gen: "pad", vol: 0.7, oct: 0 },
        { inst: "pluck", vol: 0.55, notes: ["A4 - - - F4 - - - D4 - - - - - - -", "D4 - - - A#3 - - - G3 - - - - - - -", "A3 - C#4 - E4 - - - - - - - - - - -"] },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", "x . . . . . . . . . . . . . . ."], vol: 0.5 }
      ] }
  };
  window.KarateSongs = SONGS;
  var current = null;
  var AU = window.KarateAudio = {
    sfx: SFX, songs: SONGS,
    play: function (n) { var f = SFX[n]; if (f) try { f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { } },
    unlock: function () { A.unlock(); if (Mus && Mus.unlock) Mus.unlock(); },
    // music("title" | "play" | "bonus" | "victory" | "win" | "over" | null), level picks the fight loop
    music: function (name, level) {
      if (!Mus) return;
      var key = name === "play" ? "play" + ((level - 1) % 3) : name;
      if (key === current) return; current = key;
      if (!name) { Mus.stop(); return; }
      if (name === "play") Mus.play(SONGS.fight[(level - 1) % 3]);
      else if (name === "victory") Mus.sting(SONGS.victory, SONGS.title);
      else if (name === "win") Mus.sting(SONGS.win, null);
      else if (name === "over") Mus.sting(SONGS.over, null);
      else Mus.play(SONGS[name]);
    },
    duck: function (d) { if (Mus) Mus.duck(d); },
    isMuted: function () { return A.muted; },
    setMuted: function (m) { A.setMuted(m); if (Mus) Mus.setMuted(m); },
    toggleMute: function () { A.unlock(); AU.setMuted(!A.muted); },
    musicOn: function () { return Mus ? Mus.enabled : false; },
    setMusic: function (on) { if (Mus) Mus.setEnabled(on); },
    state: function () { return A.ctx ? A.ctx.state : "none"; },
    get track() { return Mus ? Mus.current : null; }
  };
})();

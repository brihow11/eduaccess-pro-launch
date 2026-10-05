/* Defender soundtrack: synthesized songs for ArcadeMusic (no audio files). Written by: Howie */
(function () {
  "use strict";
  var K4 = "x . . . x . . . x . . . x . . .", SN = ". . . . x . . . . . . . x . . .", HH = ". . x . . . x . . . x . . . x .";
  window.DefenderSongs = {
    title: { name: "def-title", bpm: 92, steps: 16, chords: ["D3m", "A#2", "F2", "C3", "D3m", "A#2", "G2m", "A2"],
      tracks: [
        { inst: "pad", gen: "pad", vol: 0.9, oct: 1 },
        { inst: "bass", gen: "bass4", vol: 0.8, oct: 1 },
        { inst: "bell", gen: "arp8", vol: 0.5, oct: 2 },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . ."], vol: 0.5 },
        { inst: "tom", notes: ". . . . . . . . . . . . x . x x", vol: 0.45 },
        { inst: "brass", vol: 0.7, notes: ["D4 - - - - - A4 - - - G4 - F4 - - -", "F4 - - - G4 - - - A4 - - - - - - -", "C5 - - - A4 - - - F4 - - - C4 - - -", "E4 - - - - - G4 - - - E4 - - - - -",
          "D4 - - - - - A4 - - - G4 - F4 - - -", "D5 - - - C5 - - - A#4 - - - - - - -", "A#4 - - - A4 - G4 - - - A#4 - D5 - - -", "C#5 - - - - - - - E5 - - - - - - -"] }
      ] },
    play: [
      { name: "def-run1", bpm: 138, steps: 16, chords: ["E3m", "C3", "D3", "B2m"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.9, oct: 1 }, { inst: "pluck", gen: "arp16", vol: 0.45, oct: 2 },
          { inst: "pad", gen: "pad", vol: 0.45, oct: 1 },
          { inst: "kick", notes: K4, vol: 0.85 }, { inst: "snare", notes: SN, vol: 0.55 }, { inst: "hat", notes: HH, vol: 0.8 },
          { inst: "lead", vol: 0.42, notes: ["E5 - - - D5 - B4 - - - G4 - A4 - B4 -", "C5 - - - - - G4 - - - E4 - G4 - C5 -", "D5 - - - F#5 - - - E5 - D5 - A4 - - -", "B4 - - - - - - - D5 - - - F#5 - - -"] }
        ] },
      { name: "def-run2", bpm: 148, steps: 16, swing: 0.04, chords: ["A2m", "F2", "G2", "E2", "A2m", "F2", "D3m", "E2"],
        tracks: [
          { inst: "bass", gen: "pulse16", vol: 0.7, oct: 1 }, { inst: "pluck", gen: "arp8", vol: 0.5, oct: 2 },
          { inst: "kick", notes: "x . . x x . . . x . . x x . . .", vol: 0.85 }, { inst: "snare", notes: ". . . . x . . . . . . . x . x o", vol: 0.55 }, { inst: "hat", notes: "x x x x x x x x x x x x x x x x", vol: 0.5 },
          { inst: "lead", vol: 0.4, notes: ["A4 - C5 - E5 - - - D5 - C5 - B4 - - -", "A4 - - - F4 - - - A4 - C5 - - - - -", "B4 - D5 - G5 - - - F5 - E5 - D5 - - -", "E5 - - - G#4 - - - B4 - - - E5 - - -"] }
        ] },
      { name: "def-run3", bpm: 160, steps: 16, chords: ["C3m", "G#2", "A#2", "G2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.95, oct: 1 }, { inst: "pluck", gen: "arp16", vol: 0.5, oct: 3 },
          { inst: "choir", gen: "pad", vol: 0.5, oct: 1 },
          { inst: "kick", notes: "x . . . x . . x x . . . x . x .", vol: 0.9 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . x", vol: 0.6 }, { inst: "hat", notes: ". x . x . x . x . x . x . x . x", vol: 0.6 },
          { inst: "brass", vol: 0.5, notes: ["C5 - - - D#5 - - - G5 - - - F5 - D#5 -", "C5 - - - - - - - G#4 - - - C5 - - -", "D5 - - - F5 - - - A#5 - - - G5 - F5 -", "G5 - - - - - - - D5 - - - B4 - - -"] }
        ] }
    ],
    victory: { name: "def-victory", bpm: 112, steps: 16, chords: ["C3", "F3", "G3", "C3"],
      tracks: [
        { inst: "brass", vol: 0.9, notes: ["C4+E4+G4 - - G4 C5 - - - E5 - - - D5 - C5 -", "A4+C5 - - - F5 - - - C5 - - - A4 - - -", "B4+D5 - - - D5 - G5 - F5 - - - D5 - B4 -", "C5+E5+G5 - - - - - - - - - - - - - - -"] },
        { inst: "pad", gen: "pad", vol: 0.8, oct: 1 }, { inst: "bass", gen: "bass4", vol: 0.8, oct: 1 },
        { inst: "tom", notes: ["x . . x x . . . x . . . . . . .", "x . . . . . . . x . . . . . . .", "x . . x x . . . x . x . x . x x", "x . . . . . . . . . . . . . . ."], vol: 0.6 },
        { inst: "boom", notes: [". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", "x . . . . . . . . . . . . . . ."], vol: 0.6 }
      ] },
    over: { name: "def-over", bpm: 84, steps: 16, chords: ["D3m", "A#2", "A2"],
      tracks: [
        { inst: "pad", gen: "pad", vol: 0.8, oct: 1 },
        { inst: "lead", vol: 0.55, notes: ["A4 - - - G4 - - - F4 - - - E4 - - -", "D4 - - - - - - - F4 - - - - - - -", "C#4 - - - - - - - - - - - - - - -"] },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . ."], vol: 0.5 }
      ] }
  };
})();

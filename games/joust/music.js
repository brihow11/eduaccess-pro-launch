/* Joust soundtrack: synthesized songs for ArcadeMusic (no audio files). Written by: Howie */
(function () {
  "use strict";
  window.JoustSongs = {
    title: { name: "joust-title", bpm: 84, steps: 16, chords: ["D3m", "C3", "A#2", "A2", "D3m", "F2", "G2m", "A2"],
      tracks: [
        { inst: "organ", gen: "pad", vol: 0.8, oct: 0 },
        { inst: "bass", gen: "bass4", vol: 0.7, oct: 1 },
        { inst: "tom", notes: "x . . . . . x . x . . . . . . .", vol: 0.55 },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . ."], vol: 0.4 },
        { inst: "brass", vol: 0.7, notes: ["D4 - - - F4 - A4 - - - G4 - F4 - E4 -", "E4 - - - - - G4 - - - - - C4 - - -", "D4 - - - F4 - A#4 - - - A4 - G4 - F4 -", "E4 - - - - - - - C#4 - - - - - - -",
          "A4 - - - - - D5 - - - C5 - A4 - - -", "A4 - - - C5 - - - F4 - - - - - - -", "G4 - - - A#4 - - - D5 - C5 - A#4 - A4 -", "A4 - - - - - - - C#5 - - - E5 - - -"] }
      ] },
    play: [
      { name: "joust-run1", bpm: 126, steps: 16, chords: ["A2m", "G2", "F2", "E2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.85, oct: 1 }, { inst: "pluck", gen: "arp8", vol: 0.45, oct: 2 },
          { inst: "tom", notes: "x . . x . . x . x . . x . . x x", vol: 0.5 }, { inst: "kick", notes: "x . . . x . . . x . . . x . . .", vol: 0.7 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . .", vol: 0.45 },
          { inst: "lead", vol: 0.38, notes: ["A4 - - - C5 - E5 - D5 - C5 - B4 - A4 -", "G4 - - - B4 - D5 - - - B4 - G4 - - -", "F4 - A4 - C5 - - - A4 - F4 - A4 - C5 -", "B4 - - - - - G#4 - - - E4 - - - - -"] }
        ] },
      { name: "joust-run2", bpm: 138, steps: 16, swing: 0.05, chords: ["D3m", "A#2", "C3", "A2"],
        tracks: [
          { inst: "bass", gen: "pulse16", vol: 0.65, oct: 1 }, { inst: "organ", gen: "pad", vol: 0.45, oct: 1 },
          { inst: "kick", notes: "x . . x . . x . x . . x . . x .", vol: 0.8 }, { inst: "snare", notes: ". . . . x . . . . . . . x . x o", vol: 0.5 }, { inst: "hat", notes: ". . x . . . x . . . x . . . x .", vol: 0.7 },
          { inst: "brass", vol: 0.45, notes: ["D5 - - - A4 - - - F4 - A4 - D5 - - -", "D5 - - - - - A#4 - - - F4 - - - - -", "E5 - - - C5 - - - G4 - C5 - E5 - - -", "C#5 - - - - - - - A4 - - - E4 - - -"] }
        ] },
      { name: "joust-run3", bpm: 152, steps: 16, chords: ["E3m", "C3", "A2m", "B2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.95, oct: 1 }, { inst: "pluck", gen: "arp16", vol: 0.45, oct: 2 }, { inst: "choir", gen: "pad", vol: 0.45, oct: 1 },
          { inst: "kick", notes: "x . x . x . . x x . x . x . . .", vol: 0.85 }, { inst: "tom", notes: ". . . . . . . . . . . . x x x x", vol: 0.45 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . .", vol: 0.55 },
          { inst: "lead", vol: 0.4, notes: ["E5 - - - B4 - G4 - E5 - F#5 - G5 - - -", "E5 - - - C5 - - - G4 - - - C5 - - -", "A4 - C5 - E5 - - - D5 - C5 - A4 - - -", "B4 - - - D#5 - - - F#5 - - - B5 - - -"] }
        ] }
    ],
    victory: { name: "joust-victory", bpm: 108, steps: 16, chords: ["D3", "G3", "A3", "D3"],
      tracks: [
        { inst: "brass", vol: 0.9, notes: ["D4+F#4+A4 - - A4 D5 - - - F#5 - - - E5 - D5 -", "B4+D5 - - - G5 - - - D5 - - - B4 - - -", "C#5+E5 - - - E5 - A5 - G5 - - - E5 - C#5 -", "D5+F#5+A5 - - - - - - - - - - - - - - -"] },
        { inst: "organ", gen: "pad", vol: 0.7, oct: 0 }, { inst: "bass", gen: "bass4", vol: 0.8, oct: 1 },
        { inst: "tom", notes: ["x . . x x . . . x . . . . . . .", "x . . . . . . . x . . . . . . .", "x . . x x . . . x . x . x . x x", "x . . . . . . . . . . . . . . ."], vol: 0.6 }
      ] },
    over: { name: "joust-over", bpm: 76, steps: 16, chords: ["D3m", "G2m", "A2"],
      tracks: [
        { inst: "organ", gen: "pad", vol: 0.8, oct: 0 },
        { inst: "brass", vol: 0.5, notes: ["A4 - - - F4 - - - D4 - - - - - - -", "D4 - - - A#3 - - - G3 - - - - - - -", "A3+C#4+E4 - - - - - - - - - - - - - - -"] },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . ."], vol: 0.5 }
      ] }
  };
})();

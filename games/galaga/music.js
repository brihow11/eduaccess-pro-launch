/* Galaga tribute soundtrack: original synthesized songs for the shared ArcadeMusic sequencer (no audio files).
   Title theme, three in-game loops that intensify with the stage, a challenging-stage loop, victory and game-over stings.
   Written by: Howie */
(function () {
  "use strict";
  window.GalagaSongs = {
    title: { name: "galaga-title", bpm: 92, steps: 16, chords: ["E3m", "C3", "D3", "B2", "E3m", "A2m", "C3", "B2"],
      tracks: [
        { inst: "pad", gen: "pad", vol: 0.8, oct: 0 },
        { inst: "bass", gen: "bass4", vol: 0.6, oct: 1 },
        { inst: "bell", gen: "arp8", vol: 0.35, oct: 2 },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . ."], vol: 0.35 },
        { inst: "lead", vol: 0.55, notes: ["E5 - - - B4 - - - G4 - A4 - B4 - - -", "C5 - - - G4 - - - E4 - - - - - - -", "D5 - - - A4 - - - F#4 - G4 - A4 - - -", "B4 - - - - - - - D#5 - - - F#5 - - -",
          "G5 - - - F#5 - E5 - B4 - - - E5 - - -", "E5 - - - C5 - - - A4 - - - - - - -", "C5 - - - E5 - G5 - - - F#5 - E5 - - -", "D#5 - - - - - - - B4 - - - - - - -"] }
      ] },
    play: [
      { name: "galaga-sortie1", bpm: 120, steps: 16, chords: ["A2m", "F2", "G2", "E2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.8, oct: 1 }, { inst: "pluck", gen: "arp16", vol: 0.32, oct: 2 }, { inst: "pad", gen: "pad", vol: 0.35, oct: 1 },
          { inst: "kick", notes: "x . . . x . . . x . . . x . . .", vol: 0.6 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . .", vol: 0.35 }, { inst: "hat", notes: ". . x . . . x . . . x . . . x .", vol: 0.5 },
          { inst: "lead", vol: 0.3, notes: ["A4 - - - E5 - - - D5 - C5 - B4 - - -", "A4 - - - C5 - - - F5 - - - E5 - - -", "D5 - - - B4 - - - G4 - A4 - B4 - - -", "G#4 - - - - - - - B4 - - - E5 - - -"] }
        ] },
      { name: "galaga-sortie2", bpm: 132, steps: 16, swing: 0.04, chords: ["D3m", "A#2", "C3", "A2"],
        tracks: [
          { inst: "bass", gen: "pulse16", vol: 0.6, oct: 1 }, { inst: "choir", gen: "pad", vol: 0.4, oct: 1 },
          { inst: "kick", notes: "x . . x . . x . x . . x . . x .", vol: 0.7 }, { inst: "snare", notes: ". . . . x . . . . . . . x . x o", vol: 0.42 }, { inst: "hat", notes: "x . x . x . x . x . x . x . x .", vol: 0.45 },
          { inst: "brass", vol: 0.4, notes: ["D5 - - - A4 - - - F4 - A4 - D5 - - -", "D5 - - - - - A#4 - - - F4 - - - - -", "E5 - - - C5 - - - G4 - C5 - E5 - - -", "C#5 - - - - - - - A4 - - - E4 - - -"] }
        ] },
      { name: "galaga-sortie3", bpm: 146, steps: 16, chords: ["E3m", "C3", "A2m", "B2"],
        tracks: [
          { inst: "bass", gen: "bass8", vol: 0.9, oct: 1 }, { inst: "pluck", gen: "arp16", vol: 0.38, oct: 2 }, { inst: "pad", gen: "pad", vol: 0.4, oct: 1 },
          { inst: "kick", notes: "x . x . x . . x x . x . x . . .", vol: 0.75 }, { inst: "tom", notes: ". . . . . . . . . . . . x x x x", vol: 0.4 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . .", vol: 0.45 },
          { inst: "lead", vol: 0.34, notes: ["E5 - - - B4 - G4 - E5 - F#5 - G5 - - -", "E5 - - - C5 - - - G4 - - - C5 - - -", "A4 - C5 - E5 - - - D5 - C5 - A4 - - -", "B4 - - - D#5 - - - F#5 - - - B5 - - -"] }
        ] }
    ],
    challenge: { name: "galaga-challenge", bpm: 138, steps: 16, chords: ["C3", "G2", "A2m", "F2", "C3", "G2", "F2", "G2"],
      tracks: [
        { inst: "bass", gen: "bass8", vol: 0.75, oct: 1 }, { inst: "bell", gen: "arp16", vol: 0.3, oct: 2 },
        { inst: "kick", notes: "x . . . x . . . x . . . x . . .", vol: 0.6 }, { inst: "hat", notes: ". . x . . . x . . . x . . . x x", vol: 0.5 }, { inst: "snare", notes: ". . . . x . . . . . . . x . . .", vol: 0.35 },
        { inst: "pluck", vol: 0.55, notes: ["C5 - E5 - G5 - E5 - C6 - - - G5 - - -", "B4 - D5 - G5 - - - D5 - - - B4 - - -", "A4 - C5 - E5 - - - A5 - - - E5 - - -", "F5 - - - A5 - - - C6 - - - A5 - - -",
          "G5 - E5 - C5 - E5 - G5 - - - C6 - - -", "D6 - - - B5 - - - G5 - - - D5 - - -", "C6 - - - A5 - - - F5 - - - A5 - - -", "B5 - - - - - - - D6 - - - - - - -"] }
      ] },
    victory: { name: "galaga-victory", bpm: 104, steps: 16, chords: ["E3", "C3", "D3", "E3"],
      tracks: [
        { inst: "brass", vol: 0.9, notes: ["E4+G#4+B4 - - B4 E5 - - - G#5 - - - F#5 - E5 -", "C5+E5 - - - G5 - - - E5 - - - C5 - - -", "D5+F#5 - - - F#5 - A5 - G5 - - - F#5 - D5 -", "E5+G#5+B5 - - - - - - - - - - - - - - -"] },
        { inst: "pad", gen: "pad", vol: 0.7, oct: 0 }, { inst: "bass", gen: "bass4", vol: 0.8, oct: 1 },
        { inst: "tom", notes: ["x . . x x . . . x . . . . . . .", "x . . . . . . . x . . . . . . .", "x . . x x . . . x . x . x . x x", "x . . . . . . . . . . . . . . ."], vol: 0.55 }
      ] },
    over: { name: "galaga-over", bpm: 74, steps: 16, chords: ["E3m", "A2m", "B2"],
      tracks: [
        { inst: "pad", gen: "pad", vol: 0.8, oct: 0 },
        { inst: "lead", vol: 0.45, notes: ["B4 - - - G4 - - - E4 - - - - - - -", "E4 - - - C4 - - - A3 - - - - - - -", "B3+D#4+F#4 - - - - - - - - - - - - - - -"] },
        { inst: "boom", notes: ["x . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . .", ". . . . . . . . . . . . . . . ."], vol: 0.45 }
      ] }
  };
})();

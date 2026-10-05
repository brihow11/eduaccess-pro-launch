/* Gauntlet tribute soundtrack: synthesized songs for the shared ArcadeMusic sequencer (no audio files).
   A brooding minor-key march for the title, three in-game dungeon loops, a victory fanfare,
   a level-clear sting and a game-over dirge. Written by: Howie */
(function () {
  'use strict';
  window.GauntletSongs = {
    title: { name: 'gauntlet-title', bpm: 92, steps: 16, chords: ['D3m', 'A#2', 'C3', 'A2', 'D3m', 'G2m', 'A#2', 'A2'],
      tracks: [
        { inst: 'organ', gen: 'pad', vol: 0.7, oct: 0 },
        { inst: 'bass', gen: 'bass4', vol: 0.8, oct: 1 },
        { inst: 'tom', notes: 'x . . . . . x . x . . . x . . .', vol: 0.5 },
        { inst: 'boom', notes: ['x . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'], vol: 0.35 },
        { inst: 'brass', vol: 0.65, notes: ['D4 - - - A4 - - - F4 - G4 - A4 - - -', 'A#4 - - - A4 - G4 - F4 - - - D4 - - -', 'E4 - - - G4 - - - C5 - A#4 - A4 - G4 -', 'A4 - - - - - - - C#5 - - - E5 - - -',
          'D5 - - - C5 - A4 - F4 - - - A4 - - -', 'G4 - - - A#4 - - - D5 - C5 - A#4 - - -', 'F4 - - - A#4 - - - D5 - - - F5 - - -', 'E5 - - - - - C#5 - A4 - - - - - - -'] }
      ] },
    game: [
      { name: 'gauntlet-crawl1', bpm: 118, steps: 16, swing: 0.06, chords: ['A2m', 'A2m', 'F2', 'G2', 'A2m', 'A2m', 'D3m', 'E2'],
        tracks: [
          { inst: 'bass', gen: 'bass8', vol: 0.85, oct: 1 },
          { inst: 'organ', gen: 'pad', vol: 0.35, oct: 1 },
          { inst: 'kick', notes: 'x . . . x . . . x . . . x . . .', vol: 0.65 },
          { inst: 'snare', notes: '. . . . x . . . . . . . x . . o', vol: 0.4 },
          { inst: 'hat', notes: '. . x . . . x . . . x . . . x x', vol: 0.5 },
          { inst: 'pluck', vol: 0.5, notes: ['A4 . C5 . E5 . C5 . A4 . E4 . A4 . C5 .', 'B4 . C5 . D5 . E5 . D5 . C5 . B4 . G4 .', 'A4 . C5 . F5 . C5 . A4 . F4 . A4 . C5 .', 'B4 . D5 . G5 . D5 . B4 . G4 . B4 . D5 .',
            'A4 . C5 . E5 . A5 . G5 . E5 . C5 . E5 .', 'A5 . G5 . E5 . C5 . D5 . E5 . C5 . A4 .', 'D5 . F5 . A5 . F5 . D5 . A4 . D5 . F5 .', 'E5 . G#4 . B4 . E5 . G#5 . E5 . B4 . G#4 .'] }
        ] },
      { name: 'gauntlet-crawl2', bpm: 126, steps: 16, chords: ['D3m', 'C3', 'A#2', 'A2'],
        tracks: [
          { inst: 'bass', gen: 'pulse16', vol: 0.6, oct: 1 },
          { inst: 'choir', gen: 'pad', vol: 0.45, oct: 1 },
          { inst: 'kick', notes: 'x . . x . . x . x . . x . . x .', vol: 0.75 },
          { inst: 'snare', notes: '. . . . x . . . . . . . x . x o', vol: 0.45 },
          { inst: 'hat', notes: 'x . x . x . x . x . x . x . x .', vol: 0.4 },
          { inst: 'lead', vol: 0.38, notes: ['D5 - - - A4 - - - F5 - E5 - D5 - - -', 'E5 - - - - - G4 - C5 - - - E5 - - -', 'F5 - - - D5 - - - A#4 - - - D5 - F5 -', 'E5 - - - - - - - C#5 - - - A4 - - -'] }
        ] },
      { name: 'gauntlet-crawl3', bpm: 140, steps: 16, chords: ['E3m', 'C3', 'D3', 'B2'],
        tracks: [
          { inst: 'bass', gen: 'bass8', vol: 0.95, oct: 1 },
          { inst: 'pluck', gen: 'arp16', vol: 0.42, oct: 2 },
          { inst: 'organ', gen: 'pad', vol: 0.35, oct: 1 },
          { inst: 'kick', notes: 'x . x . x . . x x . x . x . . .', vol: 0.8 },
          { inst: 'tom', notes: '. . . . . . . . . . . . x x x x', vol: 0.45 },
          { inst: 'snare', notes: '. . . . x . . . . . . . x . . .', vol: 0.5 },
          { inst: 'brass', vol: 0.4, notes: ['E5 - - - B4 - G4 - E5 - F#5 - G5 - - -', 'E5 - - - C5 - - - G4 - - - C5 - - -', 'F#5 - - - D5 - A4 - D5 - - - F#5 - - -', 'D#5 - - - - - B4 - F#4 - - - B4 - - -'] }
        ] }
    ],
    clear: { name: 'gauntlet-clear', bpm: 132, steps: 16, chords: ['A2m', 'F2', 'G2', 'A2'],
      tracks: [
        { inst: 'brass', vol: 0.8, notes: ['A4+C5+E5 - - - E5 - A5 - - - - - G5 - - -', 'F5 - - - A5 - - - C6 - - - - - - -', 'B5 - - - G5 - - - D5 - - - B4 - - -', 'C#5+E5+A5 - - - - - - - - - - - - - - -'] },
        { inst: 'organ', gen: 'pad', vol: 0.5, oct: 0 }, { inst: 'bass', gen: 'bass4', vol: 0.7, oct: 1 },
        { inst: 'tom', notes: ['x . . x x . . . x . . . . . . .', 'x . . . . . . . x . . . . . . .', 'x . . x x . . . x . x . x . x x', 'x . . . . . . . . . . . . . . .'], vol: 0.55 }
      ] },
    victory: { name: 'gauntlet-victory', bpm: 104, steps: 16, chords: ['D3', 'G3', 'A3', 'D3', 'B2m', 'G2', 'A2', 'D3'],
      tracks: [
        { inst: 'brass', vol: 0.9, notes: ['D4+F#4+A4 - - A4 D5 - - - F#5 - - - E5 - D5 -', 'B4+D5 - - - G5 - - - D5 - - - B4 - - -', 'C#5+E5 - - - E5 - A5 - G5 - - - E5 - C#5 -', 'D5+F#5+A5 - - - - - - - - - - - - - - -',
          'B4+D5 - - - F#5 - - - D5 - B4 - F#4 - - -', 'G4+B4 - - - D5 - G5 - - - F#5 - E5 - - -', 'E5 - - - C#5 - A4 - C#5 - E5 - A5 - - -', 'D5+F#5+A5+D6 - - - - - - - - - - - - - - -'] },
        { inst: 'organ', gen: 'pad', vol: 0.7, oct: 0 }, { inst: 'bass', gen: 'bass4', vol: 0.8, oct: 1 },
        { inst: 'bell', gen: 'arp8', vol: 0.35, oct: 2 },
        { inst: 'tom', notes: ['x . . x x . . . x . . . . . . .', 'x . . . . . . . x . . . . . . .', 'x . . x x . . . x . x . x . x x', 'x . . . . . . . . . . . . . . .'], vol: 0.6 }
      ] },
    over: { name: 'gauntlet-over', bpm: 70, steps: 16, chords: ['D3m', 'G2m', 'A2'],
      tracks: [
        { inst: 'organ', gen: 'pad', vol: 0.8, oct: 0 },
        { inst: 'brass', vol: 0.5, notes: ['A4 - - - F4 - - - D4 - - - - - - -', 'D4 - - - A#3 - - - G3 - - - - - - -', 'A3+C#4+E4 - - - - - - - - - - - - - - -'] },
        { inst: 'boom', notes: ['x . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'], vol: 0.5 }
      ] }
  };
})();

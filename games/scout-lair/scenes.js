/* Scout's Lair scene script. Written by: Howie
   Shared by the browser game (window.SCOUT_LAIR) and the node tests (module.exports). */
(function (root) {
  'use strict';
  // k: the move that saves Scout (left, right, up, down, strike). t: the threat. side: L/R/F (front)/T (top).
  var SCENES = [
    { id: 'server-hall', name: 'Server Hall Collapse', bg: 'hall', face: 'talk',
      line: 'Forty thousand resumes filed in this hall. Every one is a person. I\'m getting them out.',
      beats: [
        { k: 'left', t: 'rack', side: 'R', fail: 'CRUSHED' },
        { k: 'up', t: 'cable', side: 'L', fail: 'SHOCKED' },
        { k: 'strike', t: 'bot', side: 'F', fail: 'CLUBBED' }
      ] },
    { id: 'grabbing-arms', name: 'The Grabbing Corridor', bg: 'corridor', face: 'shout',
      line: 'Hands off. They are not inventory.',
      beats: [
        { k: 'strike', t: 'arm', side: 'L', fail: 'GRABBED' },
        { k: 'down', t: 'sweep', side: 'R', fail: 'SWATTED' },
        { k: 'strike', t: 'arm', side: 'R', fail: 'GRABBED' }
      ] },
    { id: 'flooding-vault', name: 'The Flooding Vault', bg: 'vault', face: 'shout',
      line: 'Water\'s rising. Hold on, I\'ve got you!',
      beats: [
        { k: 'strike', t: 'captive', side: 'L', fail: 'SWEPT BACK' },
        { k: 'up', t: 'water', side: 'F', fail: 'DROWNED OUT' },
        { k: 'strike', t: 'captive', side: 'R', fail: 'SWEPT BACK' },
        { k: 'left', t: 'debris', side: 'T', fail: 'FLATTENED' }
      ], cutin: 'poster2' },
    { id: 'drone-swarm', name: 'Drone Swarm', bg: 'roof', face: 'talk',
      line: 'Scoring drones. Watching, ranking, rejecting. Not tonight.',
      beats: [
        { k: 'strike', t: 'drone', side: 'F', fail: 'ZAPPED' },
        { k: 'left', t: 'drone', side: 'R', fail: 'RAMMED' },
        { k: 'down', t: 'laserH', side: 'high', fail: 'SCANNED' },
        { k: 'strike', t: 'drone', side: 'F', fail: 'ZAPPED' }
      ] },
    { id: 'shredder', name: 'The Resume Shredder', bg: 'conveyor', face: 'talk',
      line: 'That belt feeds the shredder. Somebody\'s whole career is riding on it.',
      beats: [
        { k: 'up', t: 'shredder', side: 'F', fail: 'SHREDDED' },
        { k: 'strike', t: 'arm', side: 'L', fail: 'GRABBED' },
        { k: 'right', t: 'debris', side: 'T', fail: 'STAMPED' },
        { k: 'up', t: 'shredder', side: 'F', fail: 'SHREDDED' }
      ] },
    { id: 'elevator-shaft', name: 'The Elevator Shaft', bg: 'shaft', face: 'shout',
      line: 'The only way to its core is down. Hang on.',
      beats: [
        { k: 'left', t: 'debris', side: 'T', fail: 'FLATTENED' },
        { k: 'strike', t: 'arm', side: 'R', fail: 'YANKED' },
        { k: 'right', t: 'debris', side: 'T', fail: 'FLATTENED' },
        { k: 'up', t: 'gap', side: 'F', fail: 'FELL' }
      ] },
    { id: 'laser-grid', name: 'The Laser Filter', bg: 'lasers', face: 'talk',
      line: 'Keyword filters. Miss one and you\'re cut. Watch me.',
      beats: [
        { k: 'up', t: 'laserH', side: 'low', fail: 'FILTERED' },
        { k: 'down', t: 'laserH', side: 'high', fail: 'FILTERED' },
        { k: 'right', t: 'laserV', side: 'L', fail: 'CUT' },
        { k: 'left', t: 'laserV', side: 'R', fail: 'CUT' },
        { k: 'up', t: 'laserH', side: 'low', fail: 'FILTERED' }
      ] },
    { id: 'robot-hound', name: 'The Robot Hound', bg: 'kennel', face: 'shout',
      line: 'It\'s tracking my signal. Let it come.',
      beats: [
        { k: 'strike', t: 'hound', side: 'F', fail: 'MAULED' },
        { k: 'right', t: 'hound', side: 'L', fail: 'TACKLED' },
        { k: 'up', t: 'hound', side: 'low', fail: 'TRIPPED' },
        { k: 'left', t: 'hound', side: 'R', fail: 'TACKLED' },
        { k: 'strike', t: 'hound', side: 'F', fail: 'MAULED' }
      ] },
    { id: 'the-machine', name: 'The Machine', bg: 'boss', face: 'shout',
      line: 'No face. No name. No mercy. Let\'s change that.',
      beats: [
        { k: 'left', t: 'fist', side: 'R', fail: 'POUNDED' },
        { k: 'down', t: 'laserH', side: 'eye', fail: 'REJECTED' },
        { k: 'right', t: 'fist', side: 'L', fail: 'POUNDED' },
        { k: 'strike', t: 'arm', side: 'T', fail: 'CAUGHT' },
        { k: 'strike', t: 'core', side: 'F', fail: 'REJECTED' }
      ] },
    { id: 'final-rescue', name: 'The Final Rescue', bg: 'escape', face: 'smile',
      line: 'Everybody out. You are people, not data.',
      beats: [
        { k: 'right', t: 'debris', side: 'T', fail: 'FLATTENED' },
        { k: 'strike', t: 'captive', side: 'L', fail: 'SWEPT BACK' },
        { k: 'up', t: 'gap', side: 'F', fail: 'FELL' },
        { k: 'strike', t: 'bot', side: 'F', fail: 'CLUBBED' }
      ], ending: true }
  ];
  // Seconds the player has to react once the cue flashes: 1.6s in scene 1 down to about 0.75s at the boss.
  function windowFor(sceneIndex) { return Math.max(0.72, +(1.6 - sceneIndex * 0.095).toFixed(3)); }
  // Seconds of animation before each cue appears.
  function approachFor(sceneIndex, retry) { return (retry ? 0.75 : 1.25) - sceneIndex * 0.04; }
  var api = { SCENES: SCENES, windowFor: windowFor, approachFor: approachFor };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SCOUT_LAIR = api;
})(this);

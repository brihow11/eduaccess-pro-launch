/* Karate Champ tribute: the 12-bout tournament ladder, stages, CPU styles and bonus rounds. Written by: Howie */
(function (root) {
  "use strict";
  // Each bout: a stage (background), an opponent with a CPU style, and an optional bonus round after a win.
  // CPU style: speed (move/animation rate), react (seconds before it responds), aggr (how often it attacks),
  // block (chance to defend a read attack), smart (chance to pick the right counter for the incoming height),
  // range (how well it spaces itself at the tip of its reach), moves (weights).
  var LEVELS = [
    { name: "FIRST BOUT", stage: "dojo", opp: "Daichi", belt: "#e8c33a", beltName: "yellow belt",
      cpu: { speed: 0.82, react: 0.78, aggr: 0.30, block: 0.12, smart: 0.10, range: 0.35 }, moves: { punch: 3, front: 3, sweep: 1 }, bonus: null },
    { name: "THE ZEN GARDEN", stage: "garden", opp: "Haruki", belt: "#e07a2a", beltName: "orange belt",
      cpu: { speed: 0.86, react: 0.68, aggr: 0.34, block: 0.18, smart: 0.18, range: 0.42 }, moves: { punch: 2, front: 3, sweep: 2, round: 1 }, bonus: "boards" },
    { name: "RIVER BRIDGE", stage: "bridge", opp: "Kenji", belt: "#3f9a46", beltName: "green belt",
      cpu: { speed: 0.90, react: 0.60, aggr: 0.38, block: 0.24, smart: 0.26, range: 0.48 }, moves: { punch: 2, front: 2, sweep: 2, round: 2, jump: 1 }, bonus: null },
    { name: "MOUNTAIN TEMPLE", stage: "temple", opp: "Ryota", belt: "#2f6fc0", beltName: "blue belt",
      cpu: { speed: 0.94, react: 0.53, aggr: 0.42, block: 0.30, smart: 0.34, range: 0.54 }, moves: { punch: 2, front: 2, sweep: 2, round: 2, jump: 2, back: 1 }, bonus: "objects" },
    { name: "HARBOR AT DUSK", stage: "harbor", opp: "Takeshi", belt: "#7a4bb0", beltName: "purple belt",
      cpu: { speed: 0.98, react: 0.47, aggr: 0.46, block: 0.35, smart: 0.42, range: 0.60 }, moves: { punch: 2, front: 2, sweep: 2, round: 2, jump: 2, back: 2 }, bonus: null },
    { name: "BAMBOO FOREST", stage: "bamboo", opp: "Sora", belt: "#8a5a2c", beltName: "brown belt",
      cpu: { speed: 1.02, react: 0.41, aggr: 0.50, block: 0.40, smart: 0.50, range: 0.66 }, moves: { punch: 2, front: 2, sweep: 3, round: 2, jump: 2, back: 2, lowpunch: 1 }, bonus: "bull" },
    { name: "SNOWY PASS", stage: "snow", opp: "Isamu", belt: "#5d3a1c", beltName: "brown belt, 1st kyu",
      cpu: { speed: 1.05, react: 0.36, aggr: 0.54, block: 0.45, smart: 0.57, range: 0.71 }, moves: { punch: 2, front: 2, sweep: 3, round: 3, jump: 2, back: 2, lowpunch: 1 }, bonus: null },
    { name: "CASTLE WALLS", stage: "castle", opp: "Masaru", belt: "#161616", beltName: "black belt, 1st dan",
      cpu: { speed: 1.08, react: 0.32, aggr: 0.58, block: 0.50, smart: 0.63, range: 0.76 }, moves: { punch: 2, front: 2, sweep: 3, round: 3, jump: 3, back: 3, lowpunch: 1 }, bonus: "boards" },
    { name: "SACRED FALLS", stage: "falls", opp: "Hideo", belt: "#161616", beltName: "black belt, 2nd dan",
      cpu: { speed: 1.11, react: 0.28, aggr: 0.62, block: 0.54, smart: 0.69, range: 0.80 }, moves: { punch: 2, front: 2, sweep: 3, round: 3, jump: 3, back: 3, lowpunch: 2 }, bonus: null },
    { name: "MOONLIT SHRINE", stage: "shrine", opp: "Goro", belt: "#161616", beltName: "black belt, 3rd dan",
      cpu: { speed: 1.14, react: 0.24, aggr: 0.66, block: 0.58, smart: 0.75, range: 0.85 }, moves: { punch: 2, front: 3, sweep: 3, round: 3, jump: 3, back: 3, lowpunch: 2 }, bonus: "objects" },
    { name: "IMPERIAL HALL", stage: "palace", opp: "Shiro", belt: "#161616", beltName: "black belt, 4th dan",
      cpu: { speed: 1.17, react: 0.20, aggr: 0.70, block: 0.62, smart: 0.81, range: 0.89 }, moves: { punch: 2, front: 3, sweep: 3, round: 3, jump: 3, back: 3, lowpunch: 2 }, bonus: "bull" },
    { name: "GRAND CHAMPIONSHIP", stage: "arena", opp: "Master Oyama", belt: "#b8202a", beltName: "red-and-white belt, master",
      cpu: { speed: 1.21, react: 0.16, aggr: 0.74, block: 0.66, smart: 0.87, range: 0.93 }, moves: { punch: 2, front: 3, sweep: 3, round: 3, jump: 3, back: 3, lowpunch: 2 }, bonus: null }
  ];
  var STAGES = ["dojo", "garden", "bridge", "temple", "harbor", "bamboo", "snow", "castle", "falls", "shrine", "palace", "arena"];
  // bonus difficulty grows with the level it follows
  function bonusSpec(kind, level) {
    if (kind === "boards") return { kind: kind, boards: level < 6 ? 8 : 12, meterSpeed: level < 6 ? 1.6 : 2.3 };
    if (kind === "objects") return { kind: kind, time: 18, rate: level < 6 ? 1.1 : 0.72, speed: level < 6 ? 470 : 640 };
    if (kind === "bull") return { kind: kind, hits: level < 8 ? 3 : 4, speed: level < 8 ? 360 : 450, time: 25 };
    return null;
  }
  var api = { LEVELS: LEVELS, STAGES: STAGES, bonusSpec: bonusSpec, MAX_LEVEL: LEVELS.length };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KarateLevels = api;
})(typeof window !== "undefined" ? window : this);

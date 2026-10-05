// Written by: Howie
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("defender loads art.js before defender.js", () => {
  const html = read("games/defender/index.html");
  const a = html.indexOf("art.js"), d = html.indexOf("defender.js");
  assert.ok(a > 0 && d > a, "art.js must load before defender.js");
  assert.ok(fs.existsSync(path.join(root, "games/defender/art.js")));
});

test("defender art exposes sprites and themes", () => {
  const src = read("games/defender/art.js");
  assert.match(src, /DefenderArt/);
  assert.match(src, /SPRITES/);
  assert.match(src, /THEMES/);
});

test("joust uses cached multi-frame rider sprites", () => {
  const src = read("games/joust/game.js");
  assert.match(src, /function riderSprite/);
  assert.match(src, /function wingShape/);
  assert.match(src, /function rebuildBg/);
});

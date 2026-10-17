// Rampart: Space Edition (orbital tower defense rebuild). Written by: Howie
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("rampart-space tower defense ships its own files and shared arcade pieces", () => {
  const html = read("games/rampart-space/index.html");
  for (const s of ["art.js", "audio.js", "game.js", "style.css", "/games/shared/banner.js", "/games/shared/scout-splash.js", "/games/shared/game-menu.js"]) assert.ok(html.includes(s), s);
  const game = read("games/rampart-space/game.js");
  assert.match(game, /ScoutSplash\.show/);
  assert.match(game, /ArcadeOverlay/);
  assert.match(game, /rampart-space/);
  assert.ok(!game.includes("RSEGame"), "old game code removed");
  const levels = game.match(/LEVELS\s*=\s*\[/);
  assert.ok(levels, "level table");
  for (const b of ["dread", "hive", "eclipse"]) assert.ok(game.includes(b + ":"), "boss " + b);
  assert.match(read("games/rampart-space/audio.js"), /rstd\.muted/);
});

test("rampart-space keeps the arcade flash-safety rule written down", () => {
  const game = read("games/rampart-space/game.js");
  assert.match(game, /flash/i);
  assert.ok(fs.existsSync(path.join(root, "docs/rampart-space-td-design.md")));
});

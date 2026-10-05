// Gauntlet (games/gauntlet) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "gauntlet");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");

function get(port, reqPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: reqPath }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    }).on("error", reject);
  });
}
async function withServer(t) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return server.address().port;
}

test("Gauntlet page: banner, splash, shared music, Main menu, mute, touch controls and menu controls line", async (t) => {
  const port = await withServer(t);
  for (const route of ["/games/gauntlet/", "/games/gauntlet"]) {
    const page = await get(port, route);
    assert.equal(page.statusCode, 200, route);
  }
  const html = (await get(port, "/games/gauntlet/")).body;
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css",
    "/games/shared/game-menu.js", "/games/shared/game-menu.css", "/games/shared/arcade-music.js", "kit.js", "levels.js", "art.js", "music.js", "game.js", "Written by: Howie", "Not affiliated with or endorsed by"]) assert.ok(html.includes(needle), needle);
  assert.match(html, /<meta name="arcade-controls" content="[^"]+">/);
  assert.match(html, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, "top-bar main menu");
  assert.match(html, /id="btn-mute"/);
  assert.match(html, /id="stick"/, "on-screen stick");
  for (const a of ["fire", "magic"]) assert.match(html, new RegExp('data-act="' + a + '"'), a);
  assert.match(html, /user-scalable=no/);
  for (const f of ["game.js", "kit.js", "levels.js", "art.js", "music.js", "style.css"]) assert.equal((await get(port, "/games/gauntlet/" + f)).statusCode, 200, f);
});

test("Gauntlet has 12 distinct, solvable levels that get harder, then a victory screen", () => {
  const { LEVELS, solvable } = require(path.join(dir, "levels.js"));
  assert.equal(LEVELS.length, 12);
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, 12, "distinct level names");
  assert.equal(new Set(LEVELS.map((l) => l.rows.join("\n"))).size, 12, "distinct maps");
  LEVELS.forEach((l, i) => {
    const map = l.rows.join("");
    assert.ok(solvable(l.rows), "level " + (i + 1) + " can be finished");
    assert.equal((map.match(/S/g) || []).length, 1, "one start on level " + (i + 1));
    assert.ok((map.match(/E/g) || []).length >= 1, "an exit on level " + (i + 1));
    assert.ok(/[GRMLO]/.test(map), "generators on level " + (i + 1));
    assert.ok(/F|J/.test(map), "food on level " + (i + 1));
    assert.ok(l.rows.every((r) => r.length === l.rows[0].length), "rectangular map " + (i + 1));
  });
  const threat = (l) => l.gens.length * (l.rank[0] + l.rank[1]) + l.death * 6 + l.doors * 2 + l.w * l.h / 200;
  assert.ok(threat(LEVELS[11]) > threat(LEVELS[5]) && threat(LEVELS[5]) > threat(LEVELS[0]), "difficulty rises");
  assert.equal(LEVELS[0].death, 0, "no Death on the first level");
  assert.ok(LEVELS[11].death >= 2, "the last level sends Death after you");
  for (const t of ["G", "R", "M", "L", "O"]) assert.ok(LEVELS.some((l) => l.gens.includes(t)), "generator type " + t);
  assert.ok(LEVELS.some((l) => l.rows.join("").includes("D")) && LEVELS.some((l) => l.rows.join("").includes("K")), "doors and keys");
  assert.ok(LEVELS.some((l) => l.rows.join("").includes("X")), "poison");
  assert.ok(LEVELS.some((l) => l.rows.join("").includes("P")), "potions");
  const js = read("game.js");
  assert.match(js, /G\.level >= LEVELS\.length - 1/);
  assert.match(js, /G\.state = 'victory'/);
  assert.match(js, /'VICTORY'/);
  assert.match(js, /Mus\.sting\(Songs\.victory/);
});

test("Gauntlet heroes, monsters, generators, Death, food, potions and voice callouts", () => {
  const js = read("game.js"), art = read("art.js");
  for (const h of ["warrior", "valkyrie", "wizard", "elf"]) { assert.match(js, new RegExp("id: '" + h + "'")); assert.match(art, new RegExp(h + ": hero\\('" + h + "'\\)")); }
  const stats = [...js.matchAll(/spd: (\d+), armor: ([\d.]+), shot: ([\d.]+), shotSpd: (\d+), rate: ([\d.]+), magic: ([\d.]+)/g)].map((m) => m.slice(1).join(","));
  assert.equal(stats.length, 4); assert.equal(new Set(stats).size, 4, "distinct hero stats");
  for (const m of ["ghost", "grunt", "demon", "lobber", "sorcerer", "death"]) assert.match(art, new RegExp("function " + m + "\\("), m + " art");
  for (const gname of ["gen_ghost", "gen_grunt", "gen_demon", "gen_lobber", "gen_sorcerer"]) assert.ok(art.includes(gname + ":"), gname);
  assert.match(js, /function updateGens/); assert.match(js, /spawnMonster\(gn\.type/);
  assert.match(js, /G\.drainAcc/, "health drains over time");
  assert.match(js, /m\.drained >= 200/, "Death drains health on touch, then leaves");
  assert.match(js, /m\.type === 'death' \|\|/, "shots pass through Death");
  assert.match(js, /function useMagic/); assert.match(js, /killMonster\(m, true\)/, "potions clear the screen");
  assert.match(js, /function openDoor/); assert.match(js, /G\.keys--/);
  assert.match(js, /kind === 'poison'/);
  assert.match(js, /speechSynthesis/);
  assert.match(js, /if \(!S \|\| A\.muted/, "no speech while muted");
  for (const line of ["needs food, badly!", "is about to die!", "shot the food!", "your life force is running out."]) assert.ok(js.includes(line), line);
  assert.match(js, /if \(m\) Voice\.cancel\(\)/, "muting cuts off speech");
});

test("Gauntlet uses the shared splash after every level, shared music, remappable keys, gamepad and a remembered mute", () => {
  const js = read("game.js"), kit = read("kit.js"), music = read("music.js");
  assert.match(js, /ScoutSplash\.show/);
  assert.match(js, /campaign: 'gauntlet'/);
  assert.match(js, /'wave' \+ \(G\.level \+ 1\)/);
  assert.match(js, /'gameover'/);
  assert.match(js, /showSplash\('clear'\)/); assert.match(js, /showSplash\('over'\)/);
  assert.match(js, /ArcadeOverlay\.mount/);
  assert.match(js, /Resume/); assert.match(js, /Play again/); assert.match(js, /Retry level/);
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyX", "KeyP", "KeyM"]) assert.ok(js.includes("'" + key + "'"), key);
  assert.match(js, /storeKey: 'gauntlet\.keys'/);
  assert.match(kit, /getGamepads/);
  assert.match(kit, /function listen\(/, "key capture for remapping");
  assert.match(js, /K\.audio\('gauntlet\.muted'/);
  assert.match(kit, /K\.store\.set\(storeKey, A\.muted\)/, "mute is saved");
  assert.match(js, /window\.ArcadeMusic/); assert.match(js, /Mus\.setMuted\(/); assert.match(js, /Mus\.setEnabled\(/);
  for (const song of ["title:", "game:", "victory:", "over:", "clear:"]) assert.ok(music.includes(song), song);
  assert.match(kit, /AudioContext/);
  assert.match(js, /if \(DEBUG\) \{\s*window\.GauntletGame\.debug = \{/, "cheats only behind ?debug=1");
  for (const f of ["index.html", "game.js", "kit.js", "levels.js", "art.js", "music.js", "style.css"]) {
    const urls = (read(f).match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u));
    assert.deepEqual(urls, [], f);
    assert.doesNotMatch(read(f), /@import|fonts\.googleapis|\.mp3|\.wav|\.ogg/, f);
  }
});

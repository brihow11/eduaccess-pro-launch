// Karate Champ (games/karate-champ) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "karate-champ");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const LV = require("../games/karate-champ/levels.js");
const C = require("../games/karate-champ/core.js");

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

test("Karate Champ page: banner, splash, Main menu, mute, shared music, touch controls and menu controls line", async (t) => {
  const port = await withServer(t);
  const page = await get(port, "/games/karate-champ/");
  assert.equal(page.statusCode, 200);
  const html = page.body;
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css",
    "/games/shared/game-menu.js", "/games/shared/game-menu.css", "/games/shared/arcade-music.js", "kit.js", "core.js", "levels.js", "render.js", "audio.js", "game.js",
    "Written by: Howie", "user-scalable=no", "Not affiliated with or endorsed by"]) assert.ok(html.includes(needle), needle);
  assert.match(html, /<meta name="arcade-controls" content="[^"]+">/);
  assert.match(html, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, "top-bar main menu");
  assert.match(html, /id="btn-mute"/);
  assert.match(html, /id="settings"/);
  for (const a of ["up", "down", "left", "right", "kick", "punch", "block"]) assert.match(html, new RegExp('data-act="' + a + '"'), a);
  assert.ok(html.indexOf("arcade-music.js") < html.indexOf("audio.js"), "shared music loads before the game audio");
  assert.ok(html.indexOf("core.js") < html.indexOf("game.js") && html.indexOf("levels.js") < html.indexOf("game.js") && html.indexOf("kit.js") < html.indexOf("game.js"), "modules load before game.js");
  for (const f of ["game.js", "kit.js", "core.js", "levels.js", "render.js", "audio.js", "style.css"]) {
    const r = await get(port, "/games/karate-champ/" + f);
    assert.equal(r.statusCode, 200, f);
  }
});

test("the /games menu card for Karate Champ points at this folder", () => {
  const hub = fs.readFileSync(path.join(root, "games", "index.html"), "utf8");
  assert.match(hub, /href="\/games\/karate-champ\/" data-slug="karate-champ"/);
  assert.ok(fs.existsSync(path.join(dir, "index.html")));
});

test("Karate Champ has 12 distinct bouts on varied stages with opponents that get faster and smarter", () => {
  assert.equal(LV.LEVELS.length, 12);
  assert.equal(LV.MAX_LEVEL, 12);
  assert.equal(new Set(LV.LEVELS.map((l) => l.name)).size, 12, "distinct names");
  assert.equal(new Set(LV.LEVELS.map((l) => l.opp)).size, 12, "distinct opponents");
  assert.equal(new Set(LV.LEVELS.map((l) => l.stage)).size, 12, "a stage per bout");
  for (const s of ["dojo", "garden", "bridge", "temple"]) assert.ok(LV.STAGES.includes(s), s);
  const render = read("render.js");
  for (const s of LV.STAGES) assert.match(render, new RegExp("\\b" + s + ": function \\(x, r\\)"), "stage painter " + s);
  for (let i = 1; i < 12; i++) {
    const a = LV.LEVELS[i - 1].cpu, b = LV.LEVELS[i].cpu;
    assert.ok(b.speed > a.speed, "faster at " + (i + 1));
    assert.ok(b.react < a.react, "reacts sooner at " + (i + 1));
    assert.ok(b.smart > a.smart && b.block > a.block && b.aggr > a.aggr, "smarter at " + (i + 1));
  }
  assert.ok(Object.keys(LV.LEVELS[11].moves).length > Object.keys(LV.LEVELS[0].moves).length, "bigger move set later");
  const bonuses = LV.LEVELS.map((l) => l.bonus).filter(Boolean);
  for (const k of ["boards", "objects", "bull"]) { assert.ok(bonuses.includes(k), k); assert.equal(LV.bonusSpec(k, 3).kind, k); }
  assert.equal(LV.LEVELS[11].bonus, null, "the final bout goes straight to the victory screen");
});

test("Karate Champ rules: full and half points, first to two full points, 30-second bouts", () => {
  assert.equal(C.BOUT_TIME, 30);
  assert.equal(C.WIN_HALVES, 4);
  assert.equal(C.boutOver(4, 1), "player");
  assert.equal(C.boutOver(2, 4), "cpu");
  assert.equal(C.boutOver(3, 3), null);
  assert.equal(C.timeDecision(2, 1), "player");
  assert.equal(C.timeDecision(1, 3), "cpu");
  assert.equal(C.timeDecision(2, 2), "draw");
  assert.equal(C.judge("front", 180, false), 2, "front kick from the tip of its reach is a full point");
  assert.equal(C.judge("front", 120, false), 1, "jammed front kick is a half point");
  assert.equal(C.judge("punch", 160, false), 1, "a punch is a half point");
  assert.equal(C.judge("punch", 160, true), 2, "a counter-punch is a full point");
  assert.equal(C.judge("sweep", 100, true), 2);
  assert.ok(C.pointsFor(2, 5) > C.pointsFor(1, 5));
  assert.ok(C.blocks("block", "high") && C.blocks("block", "mid") && !C.blocks("block", "low"));
  assert.ok(C.blocks("lowblock", "low") && !C.blocks("lowblock", "high"));
});

test("Karate Champ moves: every move is a button plus a direction, and the skeleton lands real hits", () => {
  const d = (o) => Object.assign({ up: false, down: false, toward: false, away: false }, o);
  assert.equal(C.command("kick", d({})), "front");
  assert.equal(C.command("kick", d({ up: true })), "jump");
  assert.equal(C.command("kick", d({ down: true })), "sweep");
  assert.equal(C.command("kick", d({ away: true })), "back");
  assert.equal(C.command("punch", d({})), "punch");
  assert.equal(C.command("punch", d({ toward: true })), "round");
  assert.equal(C.command("punch", d({ down: true })), "lowpunch");
  assert.equal(C.command("round", d({})), "round");
  assert.equal(C.command("block", d({})), "block");
  assert.equal(C.command("block", d({ down: true })), "lowblock");
  assert.equal(C.command("block", d({ up: true })), "flip");
  assert.equal(C.command("block", d({ up: true, away: true })), "backflip");
  for (const p of ["stance", "crouch", "jump", "block", "lowblock", "hit", "down", "win", "bow"]) assert.ok(C.POSES[p], p);
  const stand = (x, facing) => { const p = C.POSES.stance; return C.toWorld({ x, y: 0, facing }, p, C.skeleton(p), 600); };
  const crouch = (x) => { const p = C.POSES.crouch; return C.toWorld({ x, y: 0, facing: -1 }, p, C.skeleton(p), 600); };
  const strike = (id, x) => { const m = C.MOVES[id], u = (m.active[0] + m.active[1]) / 2, p = C.movePose(id, u); return C.strikePoint(id, C.toWorld({ x, y: m.air ? -110 : 0, facing: 1 }, p, C.skeleton(p), 600)); };
  for (const id of ["punch", "front", "round", "back", "sweep", "jump", "lowpunch"]) {
    assert.ok(C.hitTest(strike(id, 0), stand(140, -1)), id + " hits a standing opponent in range");
    assert.equal(C.hitTest(strike(id, 0), stand(400, -1)), null, id + " misses from across the mat");
  }
  assert.equal(C.hitTest(strike("round", 0), crouch(120)), null, "crouching ducks the roundhouse");
  const jumper = (() => { const p = C.POSES.jump; return C.toWorld({ x: 140, y: -120, facing: -1 }, p, C.skeleton(p), 600); })();
  assert.equal(C.hitTest(strike("sweep", 0), jumper), null, "jumping clears the sweep");
  // a pose never sinks below the floor
  for (const id in C.MOVES) for (let u = 0; u <= 1; u += 0.1) { const p = C.movePose(id, u), w = C.toWorld({ x: 0, y: 0, facing: 1 }, p, C.skeleton(p), 600); for (const k of ["fA", "bA", "fT", "bT", "H"]) assert.ok(w[k].y <= 600.5, id + " " + k); }
});

test("Karate Champ flow: referee calls, bonus rounds, splash after every bout win or loss, victory after bout 12", () => {
  const js = read("game.js");
  assert.match(js, /MAX_LEVEL = 12\b/);
  for (const fn of ["function startBout", "function endBout", "function awardPoint", "function resolveHits", "function timeUp", "function cpuControl", "function startBonus", "function victory", "function playerControl"]) assert.ok(js.includes(fn), fn);
  assert.match(js, /FULL POINT!/); assert.match(js, /HALF POINT!/); assert.match(js, /BEGIN!/);
  assert.match(js, /ScoutSplash\.show/);
  assert.match(js, /campaign: "karate-champ"/);
  assert.match(js, /tag: "level" \+ G\.level/);
  assert.match(js, /tag: "lost-l" \+ G\.level/);
  assert.match(js, /tag: "gameover"/);
  assert.match(js, /tag: "victory"/);
  assert.match(js, /if \(G\.level >= MAX_LEVEL\) \{/);
  assert.match(js, /GRAND CHAMPION/);
  assert.match(js, /ArcadeOverlay\.mount/);
  assert.match(js, /Resume/); assert.match(js, /Play again/);
  assert.match(js, /AU\.music\("victory"\)/);
  for (const k of ['kind === "boards"', 'kind === "objects"', 'kind === "bull"']) assert.ok(js.includes(k), k);
});

test("Karate Champ controls and sound: arrows + Space defaults, remappable keys, gamepad, touch, shared soundtrack and remembered mute", () => {
  const js = read("game.js"), kit = read("kit.js"), au = read("audio.js");
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyZ", "KeyX", "KeyC", "KeyP", "KeyM"]) assert.ok(js.includes('"' + key + '"'), key);
  assert.match(js, /storeKey: "karate-champ\.keys"/);
  assert.match(js, /K\.settings\(/);
  assert.match(js, /pad: function \(gp\)/);
  assert.match(kit, /getGamepads/);
  assert.match(kit, /function listen\(/, "key capture for remapping");
  assert.match(js, /K\.bindTouch\(/);
  assert.match(js, /wantPortrait\(\)/, "phone portrait layout");
  assert.match(au, /K\.audio\("karate-champ\.muted"/, "mute is saved");
  assert.match(au, /window\.ArcadeMusic/, "music runs on the shared sequencer");
  assert.match(au, /Mus\.setMuted\(m\)/, "mute covers music");
  for (const song of ["title:", "fight:", "bonus:", "victory:", "over:"]) assert.ok(au.includes(song), song);
  for (const fx of ["hit:", "hitBig:", "block:", "whoosh:", "kiai:", "fall:", "gong:", "crack:", "shatter:", "moo:"]) assert.ok(au.includes(fx), fx);
  for (const f of ["index.html", "game.js", "kit.js", "core.js", "levels.js", "render.js", "audio.js", "style.css"]) {
    const src = read(f);
    const urls = (src.match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u));
    assert.deepEqual(urls, [], f);
    assert.doesNotMatch(src, /@import|fonts\.googleapis|\.(mp3|wav|ogg|m4a)\b/, f);
  }
});

test("Karate Champ debug helpers only exist behind ?debug=1", () => {
  const js = read("game.js");
  assert.match(js, /if \(DEBUG\) \{\s*window\.KarateGame\.debug = \{/);
  assert.doesNotMatch(js, /window\.KarateGame = \{[^}]*debug:/);
});

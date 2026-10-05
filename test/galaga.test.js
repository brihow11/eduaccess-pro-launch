// Galaga (games/galaga) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "galaga");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const LV = require("../games/galaga/levels.js");

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
const FILES = ["index.html", "game.js", "kit.js", "levels.js", "art.js", "music.js", "audio.js", "style.css"];

test("Galaga page: banner, splash, shared music, Main menu, mute, touch controls and menu controls line", async (t) => {
  const port = await withServer(t);
  const page = await get(port, "/games/galaga/");
  assert.equal(page.statusCode, 200);
  const html = page.body;
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css",
    "/games/shared/game-menu.js", "/games/shared/game-menu.css", "/games/shared/arcade-music.js", "kit.js", "levels.js", "art.js", "music.js", "audio.js", "game.js",
    "Written by: Howie", "user-scalable=no"]) assert.ok(html.includes(needle), needle);
  assert.match(html, /<meta name="arcade-controls" content="[^"]+">/);
  assert.match(html, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, "top-bar main menu");
  assert.match(html, /id="btn-mute"/);
  assert.match(html, /id="settings"/);
  for (const a of ["left", "right", "fire"]) assert.match(html, new RegExp('data-act="' + a + '"'), a);
  assert.ok(html.indexOf("arcade-music.js") < html.indexOf("game.js") && html.indexOf("levels.js") < html.indexOf("game.js"), "modules load before game.js");
  for (const f of FILES) assert.equal((await get(port, "/games/galaga/" + f)).statusCode, 200, f);
});

test("Galaga has 12 distinct stages that get harder, with Challenging Stages at 3, 7 and 11", () => {
  assert.equal(LV.LEVELS.length, 12);
  assert.deepEqual(LV.LEVELS.map((l, i) => (l.challenge ? i + 1 : 0)).filter(Boolean), [3, 7, 11]);
  const normal = LV.LEVELS.filter((l) => !l.challenge);
  assert.equal(new Set(normal.map((l) => l.name)).size, normal.length, "distinct stage names");
  assert.ok(new Set(LV.LEVELS.map((l) => l.theme.planet)).size === 12, "every stage has its own backdrop");
  for (let i = 1; i < normal.length; i++) {
    const a = normal[i - 1], b = normal[i];
    assert.ok(b.dive <= a.dive && b.maxDivers >= a.maxDivers && b.shot >= a.shot && b.diveSpd >= a.diveSpd, b.name + " is at least as hard as " + a.name);
  }
  assert.ok(normal[normal.length - 1].final, "the last stage is marked final");
  const pathSets = new Set(normal.map((l) => l.waves.map((w) => w[0]).join()));
  assert.ok(pathSets.size >= 7, "entry patterns vary between stages");
  const usedPaths = new Set(normal.flatMap((l) => l.waves.map((w) => w[0])));
  for (const p of usedPaths) assert.ok(LV.PATHS[p], p);
  for (const l of LV.LEVELS.filter((x) => x.challenge)) { assert.equal(l.cwaves.length, 5); for (const w of l.cwaves) assert.ok(LV.CPATHS[w[0]], w[0]); }
  assert.ok(new Set(LV.LEVELS.filter((x) => x.challenge).flatMap((l) => l.cwaves.map((w) => w[2]))).size >= 5, "challenging stages bring new visitors");
});

test("Galaga formation: 40 slots in 5 entry waves (4 bosses, 16 butterflies, 20 bees) and every flight path is sane", () => {
  const slots = LV.WAVES.flat();
  assert.equal(slots.length, 40); assert.equal(new Set(slots).size, 40);
  const kinds = slots.map((s) => LV.slotKind(Math.floor(s / 10)));
  assert.equal(kinds.filter((k) => k === "boss").length, 4);
  assert.equal(kinds.filter((k) => k === "butterfly").length, 16);
  assert.equal(kinds.filter((k) => k === "bee").length, 20);
  for (const s of slots) { const p = LV.slotPos(Math.floor(s / 10), s % 10, 1, 0); assert.ok(p.x > 20 && p.x < LV.W - 20 && p.y > 50 && p.y < 320, "slot on screen"); }
  for (const name of Object.keys(LV.PATHS)) for (const m of [false, true]) {
    const p = LV.entryPath(name, m), end = LV.at(p, 1e9);
    assert.ok(p.total > 300, name + " long enough to loop");
    assert.ok(end.x > 0 && end.x < LV.W && end.y > 0 && end.y < LV.H, name + " ends on screen so the ship can fly home");
  }
  for (const name of Object.keys(LV.CPATHS)) for (const m of [false, true]) {
    const p = LV.challengePath(name, m), end = LV.at(p, 1e9);
    assert.ok(end.x < 0 || end.x > LV.W || end.y > LV.H, name + " leaves the screen");
    const low = p.pts.filter((q) => q[0] > 0 && q[0] < LV.W).reduce((a, q) => Math.max(a, q[1]), 0);
    assert.ok(low < LV.H - 100, name + " stays above the fighter");
  }
  const mid = LV.at(LV.entryPath("topLoop", false), 100);
  assert.ok(Math.abs(mid.x - LV.at(LV.entryPath("topLoop", true), 100).x - (2 * mid.x - LV.W)) < 0.01, "mirrored paths mirror");
});

test("Galaga rules: tractor beam capture, rescue into a dual fighter, Boss takes two hits, hit-ratio results", () => {
  const js = read("game.js");
  for (const fn of ["function launchDive", "function tryDive", "function updateEnemy", "function updateCaptive", "function hitEnemy", "function beamLen", "function drawBeam", "function drawResults", "function killPlayer"]) assert.ok(js.includes(fn), fn);
  assert.match(js, /P\.state = "captured"/);
  assert.match(js, /c\.st = "rescue"/);
  assert.match(js, /P\.dual = true/);
  assert.match(js, /hp: q\.kind === "boss" \? 2 : 1/);
  assert.match(js, /\[400, 800, 1600\]/, "boss + escort bonus");
  assert.match(js, /HIT-MISS RATIO/); assert.match(js, /SHOTS FIRED/); assert.match(js, /NUMBER OF HITS/);
  assert.match(js, /PERFECT/);
  assert.match(js, /if \(!G\.P\.alive \|\| G\.def\.challenge/, "no enemy fire on Challenging Stages");
  assert.match(js, /ART\.badge\(/, "stage badges");
});

test("Galaga flow: splash after every stage win or loss, victory screen after stage 12, pause/game-over/victory menus", () => {
  const js = read("game.js");
  assert.match(js, /MAX_LEVEL = 12\b/);
  assert.match(js, /ScoutSplash\.show/);
  assert.match(js, /campaign: "galaga"/);
  assert.match(js, /tag: "stage" \+ G\.level/);
  assert.match(js, /tag: "gameover"/);
  assert.match(js, /tag: "victory"/);
  assert.match(js, /if \(G\.level >= MAX_LEVEL\) \{ victory\(\); return; \}/);
  assert.match(js, /ArcadeOverlay\.mount/);
  assert.match(js, /Resume/); assert.match(js, /Play again/);
  assert.match(js, /VICTORY/);
});

test("Galaga controls and sound: arrows + Space defaults, remappable keys, gamepad, touch, shared music and remembered mute", () => {
  const js = read("game.js"), kit = read("kit.js"), au = read("audio.js"), mu = read("music.js");
  for (const key of ["ArrowLeft", "ArrowRight", "Space", "KeyP", "KeyM"]) assert.ok(js.includes('"' + key + '"'), key);
  assert.match(js, /storeKey: "galaga\.keys"/);
  assert.match(js, /K\.settings\(/);
  assert.match(js, /pad: function \(gp\)/);
  assert.match(kit, /getGamepads/);
  assert.match(kit, /function listen\(/, "key capture for remapping");
  assert.match(js, /K\.bindTouch\(/);
  assert.match(js, /pointerdown/);
  assert.match(js, /wantPortrait\(\)/);
  assert.match(js, /window\.ArcadeMusic/);
  assert.match(js, /Mus\.play\(Songs\.title\)/); assert.match(js, /Mus\.sting\(Songs\.victory/); assert.match(js, /Mus\.play\(Songs\.play\[/);
  for (const song of ["title:", "play:", "challenge:", "victory:", "over:"]) assert.ok(mu.includes(song), song);
  assert.match(au, /AudioContext/);
  assert.match(au, /localStorage\.setItem\('galaga\.muted'/, "mute is saved");
  assert.match(au, /ArcadeMusic\.setMuted\(muted\)/, "mute silences the shared music too");
  for (const fx of ["shot:", "hit:", "bossHit:", "boom:", "die:", "dive:", "beam:", "capture:", "rescue:", "life:", "perfect:", "start:"]) assert.ok(au.includes(fx), fx);
  for (const f of FILES) {
    const src = read(f);
    const urls = (src.match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u));
    assert.deepEqual(urls, [], f);
    assert.doesNotMatch(src, /@import|fonts\.googleapis|\.(mp3|wav|ogg|m4a)\b/, f);
  }
});

test("Galaga debug helpers only exist behind ?debug=1", () => {
  const js = read("game.js");
  assert.match(js, /if \(DEBUG\) \{\s*window\.GalagaGame\.debug = \{/);
  assert.doesNotMatch(js, /window\.GalagaGame = \{[^}]*debug:/);
});

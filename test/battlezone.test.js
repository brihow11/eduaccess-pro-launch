// Battlezone (games/battlezone) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "battlezone");
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

test("Battlezone page: banner, splash, Main menu, mute, touch controls and menu controls line", async (t) => {
  const port = await withServer(t);
  const page = await get(port, "/games/battlezone/");
  assert.equal(page.statusCode, 200);
  const html = page.body;
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css",
    "/games/shared/game-menu.js", "/games/shared/game-menu.css", "kit.js", "game.js", "Written by: Howie"]) assert.ok(html.includes(needle), needle);
  assert.match(html, /<meta name="arcade-controls" content="[^"]+">/);
  assert.match(html, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, "top-bar main menu");
  assert.match(html, /id="btn-mute"/);
  for (const a of ["fwd", "back", "left", "right", "fire"]) assert.match(html, new RegExp('data-act="' + a + '"'), a);
  for (const f of ["game.js", "kit.js", "style.css"]) assert.equal((await get(port, "/games/battlezone/" + f)).statusCode, 200, f);
});

test("Battlezone has 12 distinct levels that get harder and more varied, and a victory screen", () => {
  const js = read("game.js");
  const lv = [...js.matchAll(/\{ name: '([A-Z' ]+)', quota: (\d+), tanks: (\d+), superP: ([\d.]+), missile: (\d+), saucer: ([\d.]+), fire: ([\d.]+), aim: ([\d.]+), spd: ([\d.]+), obst: (\d+), layout: '(\w+)' \}/g)];
  assert.equal(lv.length, 12);
  assert.equal(new Set(lv.map((m) => m[1])).size, 12, "distinct level names");
  assert.ok(new Set(lv.map((m) => m[11])).size >= 5, "obstacle layouts vary");
  const threat = (m) => +m[2] + 3 * +m[3] + 6 * +m[4] + (+m[5] ? 30 / +m[5] : 0) + 10 * +m[8] + 10 * +m[9] - +m[7];
  assert.ok(threat(lv[11]) > threat(lv[5]) && threat(lv[5]) > threat(lv[0]), "difficulty rises");
  assert.ok(+lv[11][7] < +lv[0][7], "enemies fire faster late in the game");
  assert.equal(+lv[0][5], 0, "no missiles on level 1");
  assert.match(js, /G\.level >= LEVELS\.length\) \{ G\.state = 'victory'/);
  assert.match(js, /VICTORY/);
  assert.match(js, /Music\.play\('victory'/);
});

test("Battlezone is real 3D: perspective projection, near-plane clipping, wireframe models and the classic cast", () => {
  const js = read("game.js");
  assert.match(js, /CX \+ p\[0\] \/ p\[2\] \* F/, "perspective divide");
  assert.match(js, /NEAR - p\[2\]/, "near-plane clipping");
  for (const m of ["tank", "super", "missile", "saucer", "cube", "pyramid"]) assert.match(js, new RegExp("MODELS\\." + m + " = m"), m);
  assert.match(js, /function drawRadar/); assert.match(js, /G\.sweep/);
  assert.match(js, /VOLC/); assert.match(js, /MOUNT/); assert.match(js, /moon/);
  assert.match(js, /function drawFrame/, "periscope frame");
  assert.match(js, /function makeCracks/, "cracked-glass death");
  assert.match(js, /ENEMY IN RANGE/); assert.match(js, /MOTION BLOCKED BY OBJECT/);
});

test("Battlezone uses the shared splash after every level, remappable keys, gamepad, soundtrack and a remembered mute", () => {
  const js = read("game.js"), kit = read("kit.js");
  assert.match(js, /ScoutSplash\.show/);
  assert.match(js, /campaign: 'battlezone'/);
  assert.match(js, /'wave' \+ G\.level/);
  assert.match(js, /'gameover'/);
  assert.match(js, /ArcadeOverlay\.mount/);
  assert.match(js, /Resume/); assert.match(js, /Play again/);
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyP", "KeyM"]) assert.ok(js.includes("'" + key + "'"), key);
  assert.match(js, /storeKey: 'bz\.keys'/);
  assert.match(kit, /getGamepads/);
  assert.match(js, /pad: function \(gp\)/);
  assert.match(js, /K\.audio\('bz\.muted'/);
  assert.match(kit, /K\.store\.set\(storeKey, A\.muted\)/, "mute is saved");
  for (const song of ["title:", "game:", "victory:", "over:"]) assert.ok(js.includes(song), song);
  for (const f of ["index.html", "game.js", "kit.js", "style.css"]) {
    const urls = (read(f).match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u));
    assert.deepEqual(urls, [], f);
    assert.doesNotMatch(read(f), /@import|fonts\.googleapis|\.mp3|\.wav|\.ogg/, f);
  }
});

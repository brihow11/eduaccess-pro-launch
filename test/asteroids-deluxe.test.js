// Asteroids Deluxe (games/asteroids-deluxe) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "asteroids-deluxe");
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

test("Asteroids Deluxe page: banner, splash, Main menu, mute, touch controls and menu controls line", async (t) => {
  const port = await withServer(t);
  const page = await get(port, "/games/asteroids-deluxe/");
  assert.equal(page.statusCode, 200);
  const html = page.body;
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css",
    "/games/shared/game-menu.js", "/games/shared/game-menu.css", "kit.js", "game.js", "Written by: Howie"]) assert.ok(html.includes(needle), needle);
  assert.match(html, /<meta name="arcade-controls" content="[^"]+">/);
  assert.match(html, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, "top-bar main menu");
  assert.match(html, /id="btn-mute"/);
  for (const a of ["left", "right", "thrust", "shield", "fire"]) assert.match(html, new RegExp('data-act="' + a + '"'), a);
  for (const f of ["game.js", "kit.js", "style.css"]) assert.equal((await get(port, "/games/asteroids-deluxe/" + f)).statusCode, 200, f);
});

test("Asteroids Deluxe has 12 distinct sectors that get harder, and a victory screen", () => {
  const js = read("game.js");
  const lv = [...js.matchAll(/\{ name: '([A-Z' ]+)', big: (\d+)(?:, med: (\d+))?(?:, sml: (\d+))?, spd: ([\d.]+), stars: (\d+)/g)];
  assert.equal(lv.length, 12);
  assert.equal(new Set(lv.map((m) => m[1])).size, 12, "distinct sector names");
  const threat = (m) => 4 * +m[2] + 2 * +(m[3] || 0) + +(m[4] || 0) + 8 * +m[6] + 20 * +m[5];
  assert.ok(threat(lv[11]) > threat(lv[5]) && threat(lv[5]) > threat(lv[0]), "difficulty rises");
  assert.equal(+lv[0][6], 0, "sector 1 has no wedge cluster");
  assert.ok(+lv[11][6] >= 3, "the last sector sends several wedge clusters");
  assert.match(js, /G\.level >= LEVELS\.length\) \{ G\.state = 'victory'/);
  assert.match(js, /VICTORY/);
  assert.match(js, /Music\.play\('victory'/);
});

test("Asteroids Deluxe gameplay pieces: shield drains, wedge cluster splits and homes, two saucer sizes, splitting rocks", () => {
  const js = read("game.js");
  assert.match(js, /sh\.energy = Math\.max\(0, sh\.energy - dt \* 0\.3\)/, "shield drains with use");
  assert.match(js, /k: 'star'/); assert.match(js, /k: 'pair'/); assert.match(js, /k: 'wedge'/);
  assert.match(js, /function splitFoe/);
  assert.match(js, /target && f\.wake <= 0/, "wedges home on the ship");
  assert.match(js, /big \? 22 : 12/, "big and small saucers");
  assert.match(js, /addRock\(r\.size - 1/, "rocks split");
});

test("Asteroids Deluxe uses the shared splash after every sector, remappable keys, gamepad, soundtrack and a remembered mute", () => {
  const js = read("game.js"), kit = read("kit.js");
  assert.match(js, /ScoutSplash\.show/);
  assert.match(js, /campaign: 'asteroids-deluxe'/);
  assert.match(js, /'wave' \+ G\.level/);
  assert.match(js, /'gameover'/);
  assert.match(js, /ArcadeOverlay\.mount/);
  assert.match(js, /Resume/); assert.match(js, /Play again/);
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyP", "KeyM"]) assert.ok(js.includes("'" + key + "'"), key);
  assert.match(js, /storeKey: 'ad\.keys'/);
  assert.match(kit, /getGamepads/);
  assert.match(kit, /function listen\(/, "key capture for remapping");
  assert.match(js, /K\.audio\('ad\.muted'/);
  assert.match(kit, /K\.store\.set\(storeKey, A\.muted\)/, "mute is saved");
  for (const song of ["title:", "game:", "victory:", "over:"]) assert.ok(js.includes(song), song);
  assert.match(kit, /AudioContext/);
  for (const f of ["index.html", "game.js", "kit.js", "style.css"]) {
    const urls = (read(f).match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u));
    assert.deepEqual(urls, [], f);
    assert.doesNotMatch(read(f), /@import|fonts\.googleapis|\.mp3|\.wav|\.ogg/, f);
  }
});

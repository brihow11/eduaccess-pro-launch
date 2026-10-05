// Scout's Lair (games/scout-lair) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "scout-lair");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");

function get(port, reqPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: reqPath }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}
async function withServer(t) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  return server.address().port;
}

test("Scout's Lair page loads its scripts, shared banner, shared splash and a Main menu link", async (t) => {
  const port = await withServer(t);
  const page = await get(port, "/games/scout-lair/");
  assert.equal(page.statusCode, 200);
  const html = page.body.toString("utf8");
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css", "scenes.js", "anim.js", "audio.js", "game.js", "img/poster-1.webp", 'href="/games/"', "Main menu", "Written by: Howie"]) {
    assert.ok(html.includes(needle), needle);
  }
  assert.match(html, /id="btn-mute"/);
  assert.match(html, /data-act="strike"/);
  for (const a of ["up", "down", "left", "right"]) assert.match(html, new RegExp('data-act="' + a + '"'));
  for (const f of ["game.js", "scenes.js", "anim.js", "audio.js", "style.css"]) {
    const r = await get(port, "/games/scout-lair/" + f);
    assert.equal(r.statusCode, 200, f);
  }
});

test("Scout's Lair has 10 scenes of 3-5 timed prompts with rising difficulty", () => {
  const { SCENES, windowFor, approachFor } = require("../games/scout-lair/scenes.js");
  const game = read("game.js");
  assert.equal(SCENES.length, 10);
  const keys = new Set(["up", "down", "left", "right", "strike"]);
  const bgs = new Set();
  SCENES.forEach((s, i) => {
    assert.ok(s.beats.length >= 3 && s.beats.length <= 5, s.id);
    assert.ok(s.name && s.line && ["talk", "shout", "smile"].includes(s.face), s.id);
    bgs.add(s.bg);
    assert.match(game, new RegExp("\\n    " + s.bg + ": function"), "background " + s.bg);
    for (const b of s.beats) {
      assert.ok(keys.has(b.k), s.id + " key " + b.k);
      assert.match(game, new RegExp("\\n    " + b.t + ": \\{"), "threat " + b.t);
      assert.ok(b.fail, s.id + " fail word");
    }
    if (i > 0) assert.ok(windowFor(i) < windowFor(i - 1), "window shrinks at scene " + (i + 1));
    assert.ok(approachFor(i, false) > 0.5);
  });
  assert.equal(bgs.size, 10, "each scene has its own setting");
  assert.ok(SCENES[9].ending, "last scene is the final rescue");
  assert.ok(windowFor(0) >= 1.4 && windowFor(9) >= 0.7);
});

test("Scout's Lair uses the shared splash with its own campaign, remappable keys, gamepad, pause and mute", () => {
  const game = read("game.js");
  const audio = read("audio.js");
  assert.match(game, /ScoutSplash\.show/);
  assert.match(game, /campaign: 'scout-lair'/);
  assert.match(game, /tag: 'gameover'/);
  assert.match(game, /'scene' \+ n/);
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyP", "Escape"]) assert.ok(game.includes("'" + key + "'"), key);
  assert.match(game, /scoutLair\.keys/);
  assert.match(game, /scoutLair\.hi/);
  assert.match(audio, /scoutLair\.muted/);
  assert.match(game, /getGamepads/);
  assert.match(game, /visibilitychange/);
  assert.match(game, /scout-hero-rescued/);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /victory/);
  // debug hooks only behind ?debug=1
  assert.match(game, /var DEBUG = \/\[\?&\]debug=1/);
  assert.match(game, /if \(DEBUG\) \{\s*window\.scoutDebug/);
  assert.equal((game.match(/window\.scoutDebug/g) || []).length, 1);
});

test("Scout's Lair art is optimized WebP and nothing loads from a CDN or audio file", async (t) => {
  const port = await withServer(t);
  for (const n of ["poster-1", "poster-2-armsout", "scout-hero-rescued", "scout-closeup-talk", "scout-closeup-shout", "scout-closeup-smile"]) {
    const f = path.join(dir, "img", n + ".webp");
    assert.ok(fs.existsSync(f), n);
    assert.ok(fs.statSync(f).size < 160 * 1024, n + " under 160 KB");
    const r = await get(port, "/games/scout-lair/img/" + n + ".webp");
    assert.equal(r.statusCode, 200);
    assert.match(r.headers["content-type"], /image\/webp/);
    assert.equal(r.body.subarray(8, 12).toString("ascii"), "WEBP");
  }
  for (const f of ["index.html", "game.js", "audio.js", "scenes.js", "anim.js", "style.css"]) {
    const src = read(f);
    const urls = src.match(/https?:\/\/[^\s"')]+/g) || [];
    assert.deepEqual(urls.filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u)), [], f);
    assert.doesNotMatch(src, /@import|fonts\.googleapis|\.mp3|\.wav|\.ogg/, f);
  }
});


test("Scout's Lair animation helpers: walk cycle, jump squash, fist clears The Machine eye", () => {
  const AN = require("../games/scout-lair/anim.js");
  const game = read("game.js");
  assert.equal(typeof AN.walkCycle, "function");
  assert.equal(typeof AN.jumpProfile, "function");
  assert.equal(typeof AN.swipeCurve, "function");
  assert.equal(typeof AN.fistParkX, "function");

  const w0 = AN.walkCycle(Math.PI / 2);
  const w1 = AN.walkCycle(Math.PI * 1.5);
  for (const k of ["lh", "lk", "rh", "rk", "ls", "le", "rs", "re", "lean", "bob", "plant"]) {
    assert.ok(k in w0, k);
  }
  // Opposite legs: left hip sign flips across a half-cycle.
  assert.ok(Math.sign(w0.lh) !== Math.sign(w1.lh), "left hip flips");
  assert.ok(Math.abs(w0.lh - w1.lh) > 0.8);

  const crouch = AN.jumpProfile(0.02, 0.22, 0.1, 0.3, 170);
  const rise = AN.jumpProfile(0.16, 0.22, 0.1, 0.3, 170);
  const apex = AN.jumpProfile(0.25, 0.22, 0.1, 0.3, 170);
  const fall = AN.jumpProfile(0.45, 0.22, 0.1, 0.3, 170);
  assert.equal(crouch.phase, "rise");
  assert.ok(crouch.sx >= crouch.sy, "anticipation squash at takeoff");
  assert.equal(rise.phase, "rise");
  assert.ok(rise.sy > rise.sx, "stretch mid-rise");
  assert.equal(apex.phase, "hang");
  assert.ok(apex.jy >= 169);
  assert.equal(fall.phase, "fall");
  const land = AN.landSquash(0.05);
  assert.ok(land.sx > 1 && land.sy < 1, "squash on land");

  // Wind-up goes negative before the slam.
  assert.ok(AN.swipeCurve(0.1) < 0);
  assert.ok(AN.swipeCurve(1) > 0.9);

  // Fist parks beside the eye, never covering it at approach peak.
  const eye = AN.EYE;
  for (const s of [-1, 1]) {
    const x = AN.fistParkX(s, 270);
    const bot = AN.fistApproachBot(1);
    assert.equal(AN.fistCoversEye(x, bot, eye), false, "side " + s + " at rest");
    assert.equal(AN.fistCoversEye(x, AN.fistApproachBot(0.5), eye), false, "side " + s + " mid");
  }
  // Old centered fist WOULD cover the eye — helper still detects that.
  assert.equal(AN.fistCoversEye(270, 320, eye), true);

  // Game wires the helpers (walk cycle, jump profile, fist park, swipe curve).
  assert.match(game, /ScoutAnim/);
  assert.match(game, /AN\.walkCycle/);
  assert.match(game, /AN\.jumpProfile/);
  assert.match(game, /AN\.fistParkX/);
  assert.match(game, /AN\.swipeCurve/);
  assert.match(game, /windR/);
  assert.match(game, /landSquash/);
});

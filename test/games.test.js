// Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

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

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("/games hub lists Defender and Joust and carries the Job Seeker Pro banner", async (t) => {
  const port = await withServer(t);
  const hub = await get(port, "/games/");
  assert.equal(hub.statusCode, 200);
  assert.match(hub.body, /href="\/games\/defender\/"/);
  assert.match(hub.body, /href="\/games\/joust\/"/);
  assert.match(hub.body, /\/games\/shared\/banner\.css/);
  assert.match(hub.body, /\/games\/shared\/banner\.js/);
  assert.match(hub.body, /data-jsp-banner/);
});

test("shared banner links to www.jspro.ai with UTM tags and is served with the right types", async (t) => {
  const port = await withServer(t);
  const js = await get(port, "/games/shared/banner.js");
  assert.equal(js.statusCode, 200);
  assert.match(js.headers["content-type"], /text\/javascript/);
  assert.match(js.body, /https:\/\/www\.jspro\.ai\/\?utm_source=eduaccess&utm_medium=game&utm_campaign=games-banner&utm_content=/);
  assert.doesNotMatch(js.body, /"https:\/\/jspro\.ai/);
  assert.match(js.body, /Job Seeker Pro/);
  const css = await get(port, "/games/shared/banner.css");
  assert.equal(css.statusCode, 200);
  assert.match(css.headers["content-type"], /text\/css/);
  assert.ok(fs.existsSync(path.join(root, "games", "shared", "README.md")));
});

test("Defender page loads its game, banner, tribute note and controls", async (t) => {
  const port = await withServer(t);
  for (const route of ["/games/defender/", "/games/defender"]) {
    const page = await get(port, route);
    assert.equal(page.statusCode, 200, route);
    assert.match(page.body, /\/games\/defender\/defender\.js/);
    assert.match(page.body, /\/games\/defender\/defender\.css/);
    assert.match(page.body, /\/games\/shared\/banner\.js/);
    assert.match(page.body, /Not affiliated with or endorsed by/);
    assert.match(page.body, /id="settings"/);
    assert.match(page.body, /data-act="fire"/);
    assert.match(page.body, /user-scalable=no/);
  }
  const js = await get(port, "/games/defender/defender.js");
  assert.equal(js.statusCode, 200);
  assert.match(js.headers["content-type"], /text\/javascript/);
});

test("games are self-contained: no CDN scripts, styles, fonts or audio files", () => {
  const files = ["games/index.html", "games/defender/index.html", "games/defender/defender.js", "games/defender/defender.css", "games/shared/banner.js", "games/shared/banner.css",
    "games/shared/scout-splash.js", "games/shared/scout-splash.css", "games/joust/index.html", "games/joust/game.js", "games/joust/audio.js", "games/joust/style.css"];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /<script[^>]+src=["']https?:/i, f);
    assert.doesNotMatch(src, /<link[^>]+href=["']https?:/i, f);
    assert.doesNotMatch(src, /@import|fonts\.googleapis|cdn\./i, f);
    assert.doesNotMatch(src, /\.(mp3|wav|ogg|m4a)\b/i, f);
  }
});

test("Defender keeps the agreed default controls and synthesizes its sound", () => {
  const js = read("games/defender/defender.js");
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyP", "Escape"]) assert.match(js, new RegExp('"' + key + '"'));
  assert.match(js, /AudioContext/);
  assert.match(js, /requestAnimationFrame/);
  assert.match(js, /devicePixelRatio/);
  assert.match(js, /localStorage/);
});

test("Scout AI splash is shared, uses published feature names and tags every CTA", async (t) => {
  const port = await withServer(t);
  const js = await get(port, "/games/shared/scout-splash.js");
  assert.equal(js.statusCode, 200);
  assert.match(js.headers["content-type"], /text\/javascript/);
  const css = await get(port, "/games/shared/scout-splash.css");
  assert.equal(css.statusCode, 200);
  assert.match(css.headers["content-type"], /text\/css/);
  assert.match(js.body, /https:\/\/www\.jspro\.ai\/\?utm_source=eduaccess&utm_medium=game&utm_campaign=/);
  assert.match(js.body, /target="_blank"/);
  assert.match(js.body, /Try Scout free/);
  const names = [...js.body.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 6, "at least two full rotations of three features");
  for (const n of ["Pick Jobs", "Job Follow-Ups", "Live AI Practice Interview", "Interview Prep Packet"]) assert.ok(names.includes(n), n);
  for (const [route, campaign] of [["/games/defender/", "defender"], ["/games/joust/", "joust"]]) {
    const page = await get(port, route);
    assert.match(page.body, /\/games\/shared\/scout-splash\.js/, route);
    assert.match(page.body, /\/games\/shared\/scout-splash\.css/, route);
  }
  assert.match(read("games/defender/defender.js"), /campaign: "defender"/);
  assert.match(read("games/joust/game.js"), /campaign: "joust"/);
});

test("Defender cheats only exist behind ?debug=1, and wave 1 is the gentle on-ramp", () => {
  const js = read("games/defender/defender.js");
  assert.match(js, /const DEBUG = \/\(\?:\^\|\[\?&\]\)debug=1/);
  assert.match(js, /if \(DEBUG\) \{\s*window\.DefenderGame\.debug = \{/);
  assert.doesNotMatch(js, /window\.DefenderGame = \{[^}]*debug:/s);
  assert.match(js, /G\.toSpawn = n === 1 \? 10 :/);
  assert.match(js, /HUMANOID HIT/, "laser can hit humanoids");
  assert.match(js, /VIEW_W_PORTRAIT = 520/, "narrower logical view in phone portrait");
});

test("Joust has the phone hold-to-flap option, bigger phone riders and the detailed troll hand", () => {
  const html = read("games/joust/index.html");
  const js = read("games/joust/game.js");
  assert.match(html, /id="holdflap-check"/);
  assert.match(js, /joust\.holdFlap/);
  assert.match(js, /RSCALE = \(isTouch && Math\.min\(window\.innerWidth, window\.innerHeight\) <= 600\) \? 1\.15 : 1/);
  assert.match(js, /function drawFinger\(/);
test("hub Joust card only advertises what Joust supports", () => {
  const hub = read("games/index.html");
  const card = hub.slice(hub.indexOf('class="card joust"'), hub.indexOf("Play Joust"));
  const js = read("games/joust/game.js");
  assert.match(card, /1&ndash;2 players/);
  assert.match(js, /2 FOR TWO PLAYERS/);
  assert.doesNotMatch(card, /Gamepad/i);
  assert.doesNotMatch(js, /getGamepads/);
  for (const feature of ["egg", "hand", "ptero"]) assert.match(js, new RegExp(feature));
});

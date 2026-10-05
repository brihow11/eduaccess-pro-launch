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

test("shared banner links to jspro.ai and is served with the right types", async (t) => {
  const port = await withServer(t);
  const js = await get(port, "/games/shared/banner.js");
  assert.equal(js.statusCode, 200);
  assert.match(js.headers["content-type"], /text\/javascript/);
  assert.match(js.body, /https:\/\/jspro\.ai/);
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
  const files = ["games/index.html", "games/defender/index.html", "games/defender/defender.js", "games/defender/defender.css", "games/shared/banner.js", "games/shared/banner.css"];
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

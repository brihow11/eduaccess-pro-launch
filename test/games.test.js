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
  assert.match(js, /name: "FIRST CONTACT", landers: 10, mut: 0, bombers: 1, pods: 0, baiter: 70/);
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
});

test("hub Joust card only advertises what Joust supports", () => {
  const hub = read("games/index.html");
  const start = hub.indexOf('data-slug="joust"');
  const card = hub.slice(start, hub.indexOf("</a>", start));
  const js = read("games/joust/game.js");
  assert.match(card, /1&ndash;2 players/);
  assert.match(js, /2 FOR TWO PLAYERS/);
  assert.doesNotMatch(card, /Gamepad/i);
  assert.doesNotMatch(js, /getGamepads/);
  for (const feature of ["egg", "hand", "ptero"]) assert.match(js, new RegExp(feature));
});

test("Joust phone portrait uses a following camera instead of an empty band", () => {
  const js = read("games/joust/game.js");
  const css = read("games/joust/style.css");
  assert.match(js, /VW_MIN = 520/);
  assert.match(js, /function worldPass\(ox, sx, sy\)/);
  assert.match(js, /function drawEdgeMarkers\(/);
  assert.match(js, /K = canvas\.width \/ VW/);
  assert.match(css, /body\.is-touch\.is-portrait #touch \{[^}]*align-items: flex-end/);
});

test("polish: first-play tips and level-matched audio", () => {
  const d = read("games/defender/defender.js"), j = read("games/joust/game.js"), a = read("games/joust/audio.js");
  assert.match(d, /defender\.tipSeen/);
  assert.match(j, /joust\.tipSeen/);
  assert.match(a, /var MASTER = 0\.7;/);
  assert.match(d, /sfx: Sfx/);
  assert.match(d, /if \(DEBUG\) \{[\s\S]*sfx: Sfx/, "Sfx only exposed in debug mode");
});

test("/games menu shows nine poster cards with runtime live detection, Scout ad and music mute", async (t) => {
  const port = await withServer(t);
  const hub = await get(port, "/games/");
  assert.equal(hub.statusCode, 200);
  const slugs = ["defender", "joust", "asteroids-deluxe", "battlezone", "rampart", "gauntlet", "galaga", "karate-champ", "scout-lair"];
  for (const s of slugs) assert.match(hub.body, new RegExp(`data-slug="${s}"`), s);
  assert.equal((hub.body.match(/class="card /g) || []).length, 9);
  assert.match(hub.body, /utm_source=eduaccess&amp;utm_medium=game&amp;utm_campaign=games-menu/);
  assert.match(hub.body, /target="_blank" rel="noopener"/);
  assert.match(hub.body, /id="menu-mute"/);
  for (const src of ["/games/shared/scout-splash.js", "/games/shared/arcade-music.js", "/games/menu-assets/posters.js", "/games/menu-assets/menu.js", "/games/menu-assets/menu.css"]) {
    assert.ok(hub.body.includes(src), src);
    const r = await get(port, src);
    assert.equal(r.statusCode, 200, src);
  }
  const menu = read("games/menu-assets/menu.js");
  assert.match(menu, /\/games\/" \+ slug \+ "\/index\.html/);
  assert.match(menu, /r\.status !== 200/);
  assert.match(menu, /SCOUT_FEATURES/);
  assert.match(menu, /localStorage/);
  const posters = read("games/menu-assets/posters.js");
  for (const s of slugs.filter((s) => s !== "scout-lair")) assert.ok(posters.includes(`P.${s} =`) || posters.includes(`P["${s}"] =`), s);
  const webp = await get(port, "/games/menu-assets/scout-lair.webp");
  assert.equal(webp.statusCode, 200);
  assert.match(webp.headers["content-type"], /image\/webp/);
  assert.ok(fs.statSync(path.join(root, "games/menu-assets/scout-lair.webp")).size < 120000);
  const missing = await get(port, "/games/not-a-real-game/index.html");
  assert.equal(missing.statusCode, 404);
});

test("shared arcade music exposes the sequencer API", () => {
  const src = read("games/shared/arcade-music.js");
  for (const fn of ["play:", "sting:", "stop:", "setMuted:", "setEnabled:", "duck:"]) assert.ok(src.includes(fn), fn);
  assert.match(src, /Written by: Howie/);
});

test("Defender and Joust: Main menu buttons, remembered mute for music + SFX, synthesized soundtrack", async (t) => {
  const port = await withServer(t);
  for (const [route, songs] of [["/games/defender/", "/games/defender/music.js"], ["/games/joust/", "music.js"]]) {
    const page = await get(port, route);
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, route + " top-bar main menu");
    assert.ok(page.body.includes("/games/shared/arcade-music.js"), route);
    assert.ok(page.body.includes("/games/shared/game-menu.js"), route);
    assert.ok(page.body.includes("/games/shared/game-menu.css"), route);
    assert.ok(page.body.includes(`src="${songs}"`), route);
  }
  const ov = read("games/shared/game-menu.js");
  assert.match(ov, /a\.href = "\/games\/"/);
  assert.match(ov, /Main menu/);
  for (const [file, songsVar] of [["games/defender/defender.js", "DefenderSongs"], ["games/joust/game.js", "JoustSongs"]]) {
    const js = read(file);
    assert.ok(js.includes(songsVar), file);
    assert.match(js, /Mus\.setMuted\(m\)/, file + " mute covers music");
    assert.match(js, /music\("title"\)/); assert.match(js, /music\("play"\)/); assert.match(js, /music\("over"\)/);
    assert.match(js, /Resume/); assert.match(js, /Play again/);
  }
  for (const f of ["games/defender/music.js", "games/joust/music.js"]) {
    const src = read(f);
    for (const k of ["title:", "play:", "victory:", "over:"]) assert.ok(src.includes(k), f + " " + k);
  }
  assert.match(read("games/defender/defender.js"), /lsSet\(LS\.mute/);
  assert.match(read("games/joust/audio.js"), /localStorage\.setItem\("joust\.muted"/);
});

test("Defender and Joust each have 12 designed levels with rising difficulty and a level-12 victory screen", () => {
  const d = read("games/defender/defender.js"), j = read("games/joust/game.js");
  assert.match(d, /const MAX_LEVEL = 12;/);
  assert.match(j, /var MAX_LEVEL = 12;/);
  const dl = [...d.matchAll(/\{ name: "([A-Z' ]+)", landers: (\d+), mut: (\d+), bombers: (\d+), pods: (\d+), baiter: (\d+), spd: ([\d.]+)/g)];
  assert.equal(dl.length, 12);
  assert.equal(new Set(dl.map((m) => m[1])).size, 12, "distinct Defender level names");
  const threat = (m) => +m[2] + 2 * +m[3] + +m[4] + 2 * +m[5] + 100 * +m[7];
  assert.ok(threat(dl[11]) > threat(dl[5]) && threat(dl[5]) > threat(dl[0]), "Defender difficulty rises");
  assert.ok(+dl[11][6] < +dl[0][6], "baiters come sooner late in the game");
  const jl = [...j.matchAll(/\{ name: "([A-Z' ]+)", kind: "(\w+)"/g)];
  assert.equal(jl.length, 12);
  assert.equal(new Set(jl.map((m) => m[1])).size, 12, "distinct Joust level names");
  assert.ok(new Set(jl.map((m) => m[2])).size >= 4, "Joust levels vary their kind");
  assert.match(d, /if \(G\.wave >= MAX_LEVEL\) victory\(\)/);
  assert.match(d, /PLANET SAVED/);
  assert.match(j, /else if \(G\.wave === MAX_LEVEL\) victory\(\)/);
  assert.match(j, /VICTORY!/);
  assert.match(d, /music\("victory"\)/);
  assert.match(j, /music\("victory"\)/);
});

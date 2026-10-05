// Rampart (games/rampart) checks. Written by: Howie
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer } = require("../server");

const root = path.join(__dirname, "..");
const dir = path.join(root, "games", "rampart");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const LV = require("../games/rampart/levels.js");
const C = require("../games/rampart/core.js");

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

test("Rampart page: banner, splash, Main menu, mute, touch controls and menu controls line", async (t) => {
  const port = await withServer(t);
  const page = await get(port, "/games/rampart/");
  assert.equal(page.statusCode, 200);
  const html = page.body;
  for (const needle of ["/games/shared/banner.css", "/games/shared/banner.js", "data-jsp-banner", "/games/shared/scout-splash.js", "/games/shared/scout-splash.css",
    "/games/shared/game-menu.js", "/games/shared/game-menu.css", "kit.js", "core.js", "levels.js", "render.js", "audio.js", "game.js", "Written by: Howie", "user-scalable=no"]) assert.ok(html.includes(needle), needle);
  assert.match(html, /<meta name="arcade-controls" content="[^"]+">/);
  assert.match(html, /href="\/games\/"[^>]*>(?:<span aria-hidden="true">)?&#9776;/, "top-bar main menu");
  assert.match(html, /id="btn-mute"/);
  assert.match(html, /id="settings"/);
  for (const a of ["up", "down", "left", "right", "rotate", "action"]) assert.match(html, new RegExp('data-act="' + a + '"'), a);
  assert.ok(html.indexOf("levels.js") < html.indexOf("game.js") && html.indexOf("kit.js") < html.indexOf("game.js"), "modules load before game.js");
  for (const f of ["game.js", "kit.js", "core.js", "levels.js", "render.js", "audio.js", "style.css"]) {
    const r = await get(port, "/games/rampart/" + f);
    assert.equal(r.statusCode, 200, f);
  }
});

test("Rampart has 12 distinct levels that get harder and more varied", () => {
  assert.equal(LV.LEVELS.length, 12);
  assert.equal(new Set(LV.LEVELS.map((l) => l.name)).size, 12, "distinct names");
  assert.ok(new Set(LV.LEVELS.map((l) => l.theme)).size >= 8, "varied themes");
  assert.ok(new Set(LV.LEVELS.map((l) => l.weather)).size >= 8, "varied weather");
  const fleet = (l) => l.rounds.flat().reduce((s, t) => s + LV.SHIPS[t].hp * (1 + LV.SHIPS[t].shots) + (LV.SHIPS[t].troops || 0), 0);
  assert.ok(fleet(LV.LEVELS[11]) > fleet(LV.LEVELS[5]) && fleet(LV.LEVELS[5]) > fleet(LV.LEVELS[0]), "fleets grow");
  assert.ok(LV.LEVELS[11].repairT < LV.LEVELS[0].repairT, "less repair time late in the game");
  for (let i = 1; i < 12; i++) assert.ok(LV.LEVELS[i].repairT <= LV.LEVELS[i - 1].repairT, "repair time never grows");
  assert.ok(LV.LEVELS[11].rounds.flat().includes("flagship"), "final level brings the flagship");
  assert.deepEqual(LV.LEVELS[0].rounds.flat().filter((t) => t !== "sloop"), [], "level 1 is sloops only");
  assert.ok(LV.piecePool(12).length > LV.piecePool(1).length, "awkward wall pieces arrive later");
});

test("every Rampart map (landscape and phone portrait) has castles with room for a home ring and a sea lane", () => {
  for (const lv of LV.LEVELS) for (const portrait of [false, true]) {
    const map = LV.buildMap(lv, portrait);
    assert.equal(map.castles.length, lv.castles, lv.name + (portrait ? " portrait" : ""));
    const g = C.makeGrid(map);
    assert.ok(g.sea.reduce((a, b) => a + b, 0) > 100, lv.name + " has open sea");
    for (const c of map.castles) assert.equal(C.homeRing(g, c).length, 28, lv.name + " ring room");
  }
});

test("Rampart rules: a home ring encloses its castle, a breach opens it, cannons need territory", () => {
  const map = LV.buildMap(1, false), g = C.makeGrid(map), c = map.castles[0];
  assert.equal(C.computeTerritory(g), 0);
  C.homeRing(g, c).forEach((i) => { g.wall[i] = 1; });
  assert.equal(C.computeTerritory(g), 36, "6x6 courtyard");
  assert.ok(C.castleEnclosed(g, c));
  assert.ok(C.canPlaceCannon(g, c.x - 2, c.y - 2));
  assert.ok(!C.canPlaceCannon(g, c.x - 8, c.y - 8) || !g.enclosed[(c.y - 8) * g.cols + c.x - 8], "no cannons outside the walls");
  const gap = C.homeRing(g, c)[3]; g.wall[gap] = 0;
  C.computeTerritory(g);
  assert.ok(!C.castleEnclosed(g, c), "breach opens the castle");
  assert.ok(C.canPlacePiece(g, [[0, 0]], gap % g.cols, (gap / g.cols) | 0));
  assert.ok(C.placePiece(g, [[0, 0]], gap % g.cols, (gap / g.cols) | 0));
  C.computeTerritory(g);
  assert.ok(C.castleEnclosed(g, c), "repair closes it again");
  assert.equal(C.cannonAllowance(g, map.castles, 0, true), 3);
  assert.deepEqual(C.rotate(C.rotate(C.rotate(C.rotate([[0, 0], [1, 0], [2, 0], [2, 1]])))), [[0, 0], [1, 0], [2, 0], [2, 1]]);
});

test("Rampart flow: three phases, splash after every level win or loss, victory screen after level 12", () => {
  const js = read("game.js");
  for (const fn of ["function enterCannons", "function startBattle", "function startRepair", "function resolve", "function placePiece", "function rotatePiece", "function fireAt", "function updateGrunts"]) assert.ok(js.includes(fn), fn);
  assert.match(js, /MAX_LEVEL = 12\b/);
  assert.match(js, /ScoutSplash\.show/);
  assert.match(js, /campaign: "rampart"/);
  assert.match(js, /tag: "level" \+ G\.level/);
  assert.match(js, /tag: "lost-l" \+ G\.level/);
  assert.match(js, /tag: "gameover"/);
  assert.match(js, /tag: "victory"/);
  assert.match(js, /if \(G\.level >= MAX_LEVEL\) \{/);
  assert.match(js, /THE COAST IS SECURED/);
  assert.match(js, /ArcadeOverlay\.mount/);
  assert.match(js, /Resume/); assert.match(js, /Play again/);
  assert.match(js, /AU\.music\("victory"\)/);
});

test("Rampart controls and sound: arrows + Space defaults, remappable keys, gamepad, touch, soundtrack and remembered mute", () => {
  const js = read("game.js"), kit = read("kit.js"), au = read("audio.js");
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyZ", "KeyP", "KeyM"]) assert.ok(js.includes('"' + key + '"'), key);
  assert.match(js, /storeKey: "rampart\.keys"/);
  assert.match(js, /K\.settings\(/);
  assert.match(js, /pad: function \(gp\)/);
  assert.match(kit, /getGamepads/);
  assert.match(kit, /function listen\(/, "key capture for remapping");
  assert.match(js, /K\.bindTouch\(/);
  assert.match(js, /pointerdown/);
  assert.match(js, /wantPortrait\(\)/, "phone portrait gets a transposed map");
  assert.match(au, /AudioContext/);
  assert.match(au, /localStorage\.setItem\("rampart\.muted"/, "mute is saved");
  for (const song of ["title:", "build:", "battle:", "victory:", "defeat:"]) assert.ok(au.includes(song), song);
  for (const fx of ["boom:", "splash:", "impact:", "sink:", "place:", "rotate:", "claim:"]) assert.ok(au.includes(fx), fx);
  for (const f of ["index.html", "game.js", "kit.js", "core.js", "levels.js", "render.js", "audio.js", "style.css"]) {
    const src = read(f);
    const urls = (src.match(/https?:\/\/[^\s"')]+/g) || []).filter((u) => !/^https:\/\/www\.jspro\.ai/.test(u) && !/^http:\/\/www\.w3\.org/.test(u));
    assert.deepEqual(urls, [], f);
    assert.doesNotMatch(src, /@import|fonts\.googleapis|\.(mp3|wav|ogg|m4a)\b/, f);
  }
});

test("Rampart debug helpers only exist behind ?debug=1", () => {
  const js = read("game.js");
  assert.match(js, /if \(DEBUG\) \{\s*window\.RampartGame\.debug = \{/);
  assert.doesNotMatch(js, /window\.RampartGame = \{[^}]*debug:/);
});

// ---- stuck-ship fix: ships re-plan toward a reachable firing spot, give up, and levels can't stall
function seaListOf(g) { const out = []; for (let i = 0; i < g.sea.length; i++) if (g.sea[i]) out.push(i); return out; }
function ringed(lv, portrait, home = 0) {
  const map = LV.buildMap(lv, portrait), g = C.makeGrid(map);
  C.homeRing(g, map.castles[home]).forEach((i) => { g.wall[i] = 1; });
  C.computeTerritory(g);
  return { map, g, sea: seaListOf(g), sd: C.structDist(g, home) };
}

test("Rampart ships pick a reachable sea tile that is truly within firing range on every map", () => {
  for (const lv of LV.LEVELS) for (const portrait of [false, true]) {
    let coastal = 0;
    for (let home = 0; home < lv.castles; home++) {
      const { g, sea, sd } = ringed(lv, portrait, home);
      const edge = sea.filter((i) => { const x = i % g.cols, y = (i / g.cols) | 0; return !x || !y || x === g.cols - 1 || y === g.rows - 1; });
      let found = 0;
      for (const st of edge.filter((_, k) => k % 9 === 0)) for (const t of ["sloop", "frigate", "ketch"]) {
        const b = C.seaBfs(g, st), range = LV.SHIPS[t].range;
        const spot = C.firingSpot(g, sea, sd, b.dist, range);
        if (spot < 0) continue; // inland castle out of reach: covered by the stuck-ship test below
        found++;
        assert.ok(b.dist[spot] >= 0, lv.name + ": spot is reachable by sea");
        assert.ok(g.sea[spot], lv.name + ": spot is open sea");
        assert.ok(C.hasTargetInRange(g, spot, range), lv.name + ": a wall is within real (Euclidean) range of the spot");
      }
      if (found) coastal++;
    }
    assert.ok(coastal > 0, lv.name + (portrait ? " portrait" : "") + ": ships can reach a firing spot on at least one coastal castle");
  }
});

test("Rampart ship cut off from every target gets no firing spot, re-plans, then sails off within one battle", () => {
  const { g, sd } = ringed(LV.LEVELS[0], false);
  // shrink the sea to a 3x3 pocket in the far corner from the castle: nothing can be hit from there
  const cs = new Set();
  for (let y = 0; y < 3; y++) for (let x = g.cols - 3; x < g.cols; x++) cs.add(y * g.cols + x);
  let far = 0; for (const i of cs) far = Math.max(far, sd[i]);
  for (let i = 0; i < g.sea.length; i++) g.sea[i] = cs.has(i) ? 1 : 0;
  const st = [...cs][0], b = C.seaBfs(g, st);
  assert.ok(far > 10, "pocket is far from the walls");
  assert.equal(C.firingSpot(g, [...cs], sd, b.dist, LV.SHIPS.frigate.range), -1, "no reachable firing spot");

  // simulate the per-frame stuck policy for an idle ship that never lands a volley
  let quiet = 0, replans = 0, leftAt = null; const replanAt = [];
  for (let t = 0; t < 60 && leftAt === null; t += 0.05) {
    quiet += 0.05;
    const act = C.stuckAction(quiet, replans);
    if (act === "replan") { replans++; replanAt.push(+quiet.toFixed(2)); }
    else if (act === "leave") leftAt = quiet;
  }
  assert.equal(replanAt.length, C.STUCK.MAX_REPLANS, "re-plans before giving up");
  assert.ok(replanAt[0] >= C.STUCK.REPLAN_T - 0.1 && replanAt[0] < C.STUCK.LEAVE_T);
  assert.ok(leftAt !== null && leftAt <= C.STUCK.LEAVE_T + 0.1, "ship withdraws");
  assert.ok(leftAt < Math.min(...LV.LEVELS.map((l) => l.battleT)), "a stuck ship is gone before the shortest battle timer runs out");
  assert.equal(C.stuckAction(C.STUCK.REPLAN_T + 1, 0), "replan");
  assert.equal(C.stuckAction(1, 0), null, "a ship that just fired is left alone");
});

test("Rampart level can never stall: surviving ships withdraw after the overtime cap", () => {
  for (const lv of LV.LEVELS) {
    const n = lv.rounds.length;
    assert.equal(C.levelCleared(n - 1, n, 0, 0), false, "scripted rounds first");
    assert.equal(C.levelCleared(n, n, 0, 0), true, "fleet gone after last round");
    assert.equal(C.levelCleared(n, n, 2, 0), false, "survivors get an overtime round");
    let round = 0; while (!C.levelCleared(round, n, 1, 0)) { round++; assert.ok(round < 50, "stall"); }
    assert.equal(round, n + C.OVERTIME, lv.name + " clears after at most " + C.OVERTIME + " overtime rounds");
  }
  const js = read("game.js");
  assert.match(js, /C\.stuckAction\(/, "game uses the stuck-ship policy");
  assert.match(js, /C\.levelCleared\(/, "game uses the overtime cap");
  assert.match(js, /C\.firingSpot\(/, "ships plan with the reachable firing-spot search");
  assert.match(js, /THE FLEET WITHDRAWS/);
  assert.match(js, /if \(G\.timer <= 0\) ceaseFire\(\);/, "every battle phase ends on its timer");
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");

const { createServer, resolveFile } = require("../server");

function request(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        path: reqPath,
        port
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

test("malformed URL encoding is rejected without crashing the server", async (t) => {
  assert.equal(resolveFile("/%ZZ"), null);

  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const { port } = server.address();
  assert.equal((await request(port, "/%ZZ")).statusCode, 400);
  assert.equal((await request(port, "/")).statusCode, 200);
});

test("layoff rumor room route is live and linked from indexes", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();

  const app = await request(port, "/apps/layoff-rumor-room/");
  assert.equal(app.statusCode, 200);
  assert.match(app.body, /Layoff Rumor Room/);
  assert.match(app.body, /Signal Discipline/);
  assert.match(app.body, /72-hour action plan/i);
  assert.match(app.body, /Scenario 1 of 4/);

  const appsIndex = await request(port, "/apps/");
  assert.equal(appsIndex.statusCode, 200);
  assert.match(appsIndex.body, /\/apps\/layoff-rumor-room\//);

  const home = await request(port, "/");
  assert.equal(home.statusCode, 200);
  assert.match(home.body, /\/apps\/layoff-rumor-room\//);
});

test("layoff rumor room stays no-capture and offline-first", () => {
  const file = path.join(__dirname, "..", "apps", "layoff-rumor-room", "index.html");
  const html = fs.readFileSync(file, "utf8");

  const banned = [
    /localStorage/i,
    /sessionStorage/i,
    /document\.cookie/i,
    /\bfetch\s*\(/i,
    /XMLHttpRequest/i,
    /navigator\.sendBeacon/i,
    /gtag\s*\(/i,
    /google-analytics/i,
    /googletagmanager/i,
    /<form\b/i,
    /type=["']password["']/i,
    /type=["']email["']/i,
    /action=["']https?:\/\//i
  ];

  for (const pattern of banned) {
    assert.equal(pattern.test(html), false, `banned pattern present: ${pattern}`);
  }

  assert.match(html, /No-capture proof/);
  assert.match(html, /aria-live/);
  assert.match(html, /focus-visible/);
  assert.match(html, /390px/);
});

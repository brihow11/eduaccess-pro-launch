// Written by: Howie
const test = require("node:test");
const assert = require("node:assert");
const { createServer, withTracker } = require("../server.js");

test("injects SocialSplash tracker once before </head>", () => {
  const out = withTracker("<html><head><title>x</title></head><body></body></html>");
  assert.match(out, /<script defer src="[^"]+\/conversions\/snippet\.js"><\/script>\n<\/head>/);
  assert.strictEqual(withTracker(out), out);
});

test("served HTML pages carry the tracker", async () => {
  const server = createServer().listen(0);
  const { port } = server.address();
  for (const p of ["/", "/games/", "/quizzes/readiness-score/"]) {
    const res = await fetch(`http://127.0.0.1:${port}${p}`);
    const body = await res.text();
    assert.ok(body.includes("/conversions/snippet.js"), p);
    assert.strictEqual(Number(res.headers.get("content-length")), Buffer.byteLength(body));
  }
  server.close();
});

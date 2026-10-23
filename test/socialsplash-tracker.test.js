const test = require("node:test");
const assert = require("node:assert");
const { createServer, withTracker, SOCIALSPLASH_TRACKER } = require("../server");

test("tracker is inserted once before </head>", () => {
  const out = withTracker("<html><head><title>x</title></head><body></body></html>");
  assert.ok(out.includes(SOCIALSPLASH_TRACKER + "\n</head>"));
  assert.strictEqual(withTracker(out), out);
  assert.strictEqual(withTracker("<p>no head</p>"), "<p>no head</p>");
});

test("served home page carries the SocialSplash tracker", async () => {
  const server = createServer().listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body = await res.text();
    assert.strictEqual(res.status, 200);
    assert.ok(body.includes("/conversions/snippet.js"));
    assert.strictEqual(Number(res.headers.get("content-length")), Buffer.byteLength(body));
  } finally {
    server.close();
  }
});

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createServer, resolveFile } = require("../server");

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        path,
        port
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
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
  assert.equal(await request(port, "/%ZZ"), 400);
  assert.equal(await request(port, "/"), 200);
});

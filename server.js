const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

function resolveFile(urlPath) {
  let decoded;

  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch (error) {
    if (error instanceof URIError) {
      return null;
    }
    throw error;
  }

  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(root, normalized);

  if (!filePath.startsWith(root)) {
    return path.join(root, "404.html");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(root, "404.html");
  }

  return filePath;
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = resolveFile(req.url || "/");

    if (!filePath) {
      res.writeHead(400, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end("Bad Request");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const status = path.basename(filePath) === "404.html" && !(req.url || "/").includes("404.html") ? 404 : 200;

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (status === 200 && range && (ext === ".mp4" || ext === ".webm")) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;

      if (start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Type": types[ext]
      });

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(status, {
      ...(status === 200 && (ext === ".mp4" || ext === ".webm") ? { "Accept-Ranges": "bytes" } : {}),
      "Cache-Control": "public, max-age=300",
      "Content-Length": stat.size,
      "Content-Type": types[ext] || "application/octet-stream"
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
}

if (require.main === module) {
  const server = createServer();

  server.listen(port, "0.0.0.0", () => {
    console.log(`EduAccess launch home listening on ${port}`);
  });
}

module.exports = { createServer, resolveFile };

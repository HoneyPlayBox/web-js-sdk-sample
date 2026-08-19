const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname);
const port = Number(process.env.PORT || 5184);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const requestedPath = decodeURIComponent(
    url.pathname === "/" || url.pathname === "/sdk-demo.html" ? "/sdk-demo.html" : url.pathname
  );
  // Keep the sample self-contained while loading the built local WASM artifact.
  const filePath = requestedPath === "/protocol.wasm"
    ? path.resolve(root, "../dist/protocol.wasm")
    : path.normalize(path.join(root, requestedPath));

  const distWasmPath = path.resolve(root, "../dist/protocol.wasm");
  if (!filePath.startsWith(root) && filePath !== distWasmPath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`HoneyPlayBox SDK sample: http://localhost:${port}/sdk-demo.html`);
});

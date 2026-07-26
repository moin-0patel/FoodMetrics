// Production static server for the built SPA.
//
// Only needed when the app is deployed as a Node WEB SERVICE (Render, Railway,
// Fly, a container, …). If you deploy as a STATIC SITE — which render.yaml
// declares and which is cheaper and faster — the platform serves ./dist directly
// and this file is never executed.
//
// Deliberately zero-dependency: Node's own http/fs are enough for serving a
// built Vite bundle, and a deploy path shouldn't pull in a web framework.
//
// Run: npm run build && npm start

import { createServer } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0"; // must not be localhost on a PaaS

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/** Anything that looks like a file request — so a missing asset 404s instead of
 *  being answered with index.html, which would mask broken build output. */
const looksLikeAsset = (p) => path.extname(p) !== "";

async function resolveFile(urlPath) {
  // Strip the query, decode, and normalise away any ".." before joining, so a
  // crafted URL cannot escape ./dist.
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = path.normalize(clean).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null; // traversal attempt
  try {
    const st = await fs.stat(abs);
    if (st.isFile()) return abs;
    if (st.isDirectory()) {
      const idx = path.join(abs, "index.html");
      await fs.access(idx);
      return idx;
    }
  } catch {
    /* fall through */
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end("Method Not Allowed");
      return;
    }

    let file = await resolveFile(req.url || "/");

    // SPA fallback: unknown non-asset routes are client-side routes.
    if (!file && !looksLikeAsset(req.url || "/")) {
      file = path.join(ROOT, "index.html");
    }
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const isHashed = file.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      // Hashed bundles are immutable; index.html and the service worker must not
      // be cached, or clients pin to a stale build after a deploy.
      "Cache-Control": isHashed
        ? "public, max-age=31536000, immutable"
        : "no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  } catch (err) {
    console.error("server error:", err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// Fail loudly and early if the build is missing — otherwise every request 404s
// and the cause is invisible in the logs.
try {
  await fs.access(path.join(ROOT, "index.html"));
} catch {
  console.error(`No build found at ${ROOT}. Run "npm run build" first.`);
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`Serving ./dist on http://${HOST}:${PORT}`);
});

// PaaS platforms stop containers with SIGTERM; exit cleanly so deploys are quick.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => server.close(() => process.exit(0)));
}

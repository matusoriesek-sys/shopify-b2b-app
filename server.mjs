import { createServer } from "http";
import { execSync } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const STATIC_DIR = join(__dirname, "build", "client");

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message, err.stack);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err);
});

console.log("=== server.mjs starting ===");
console.log("PORT:", PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL);
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("STATIC_DIR:", STATIC_DIR);

// Run prisma migrate synchronously
try {
  console.log("Running prisma migrate...");
  const output = execSync("npx prisma migrate deploy", { 
    encoding: "utf8", 
    timeout: 30000,
    stdio: "pipe" 
  });
  console.log("Prisma migrate output:", output);
} catch (err) {
  console.error("Prisma migrate error:", err.message);
}

const MIME_TYPES = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function tryServeStatic(req, res) {
  try {
    const urlPath = new URL(req.url, "http://localhost").pathname;
    const filePath = join(STATIC_DIR, urlPath);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(STATIC_DIR)) return false;
    
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = readFileSync(filePath);
      
      // Assets with hashes get immutable caching
      const isHashed = /\.[a-f0-9]{8,}\./i.test(filePath);
      const cacheControl = isHashed 
        ? "public, max-age=31536000, immutable" 
        : "public, max-age=3600";
      
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": content.length,
        "Cache-Control": cacheControl,
      });
      res.end(content);
      return true;
    }
  } catch (err) {
    console.error("Static file error:", err.message);
  }
  return false;
}

let handler = null;
let startupError = null;

const server = createServer(async (req, res) => {
  // Serve static files from build/client first
  if (tryServeStatic(req, res)) return;
  
  if (!handler) {
    res.writeHead(startupError ? 500 : 200, { "Content-Type": "text/plain" });
    res.end(startupError ? `Error: ${startupError.message}` : "Loading...");
    return;
  }
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    
    const body = req.method !== "GET" && req.method !== "HEAD" 
      ? await new Promise((resolve) => {
          const chunks = [];
          req.on("data", (c) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks)));
        })
      : undefined;
    
    const request = new Request(url.toString(), { method: req.method, headers, body });
    const response = await handler(request);
    
    const resHeaders = {};
    response.headers.forEach((value, key) => { resHeaders[key] = value; });
    res.writeHead(response.status, resHeaders);
    
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end(await response.text());
    }
  } catch (err) {
    console.error("Request error:", err.message);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server listening on 0.0.0.0:${PORT}`);
  
  // Load Remix app asynchronously
  import("./build/server/index.js")
    .then(build => {
      console.log("Build loaded, keys:", Object.keys(build));
      return import("@remix-run/node").then(({ createRequestHandler }) => {
        handler = createRequestHandler(build, "production");
        console.log("✅ Remix app ready!");
      });
    })
    .catch(err => {
      startupError = err;
      console.error("❌ Failed to load app:", err.message);
      console.error(err.stack);
    });
});

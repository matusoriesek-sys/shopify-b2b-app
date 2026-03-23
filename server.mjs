import { createServer } from "http";
import { execSync } from "child_process";

const PORT = process.env.PORT || 3000;

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
  // Continue anyway - might already be migrated
}

let handler = null;
let startupError = null;

// Start HTTP server immediately
const server = createServer(async (req, res) => {
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

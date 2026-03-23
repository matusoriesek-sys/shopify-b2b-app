import { createServer } from "http";

const PORT = process.env.PORT || 3000;

// Catch everything
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message, err.stack);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err);
});

console.log("server.mjs starting...");
console.log("PORT:", PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("SHOPIFY_APP_URL:", process.env.SHOPIFY_APP_URL);

let handler = null;
let startupError = null;

async function loadApp() {
  try {
    console.log("Loading remix build...");
    const build = await import("./build/server/index.js");
    console.log("Build loaded! Keys:", Object.keys(build));
    
    const { createRequestHandler } = await import("@remix-run/node");
    handler = createRequestHandler(build, "production");
    console.log("Request handler created successfully");
  } catch (err) {
    startupError = err;
    console.error("STARTUP ERROR:", err.message);
    console.error(err.stack);
  }
}

// Start HTTP server immediately so healthcheck passes
const server = createServer(async (req, res) => {
  if (!handler) {
    if (startupError) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Startup Error: ${startupError.message}\n${startupError.stack}`);
    } else {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Loading...");
    }
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
    
    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });
    
    const response = await handler(request);
    
    const resHeaders = {};
    response.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });
    res.writeHead(response.status, resHeaders);
    
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      const text = await response.text();
      res.end(text);
    }
  } catch (err) {
    console.error("Request error:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server listening on 0.0.0.0:${PORT}`);
  // Load app after server is listening (so healthcheck passes)
  loadApp();
});

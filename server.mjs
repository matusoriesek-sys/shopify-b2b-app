import { createRequestHandler } from "@remix-run/node";
import { createServer } from "http";

const PORT = process.env.PORT || 3000;

async function start() {
  console.log("Loading build...");
  
  let build;
  try {
    build = await import("./build/server/index.js");
    console.log("Build loaded successfully");
  } catch (err) {
    console.error("Failed to load build:", err.message);
    console.error(err.stack);
    
    // Start a simple HTTP server that shows the error
    const server = createServer((req, res) => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`App failed to start: ${err.message}`);
    });
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Error server listening on port ${PORT}`);
    });
    return;
  }
  
  const handler = createRequestHandler(build, "production");
  
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      
      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
        duplex: "half",
      });
      
      const response = await handler(request);
      
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
          await pump();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });
  
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

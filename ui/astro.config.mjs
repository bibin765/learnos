import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import fs from "node:fs/promises";
import path from "node:path";

// Dev-mode plugin: serve content from the parent learnos directory at /_local/*.
// Mimics the GitHub API shape (raw bytes for files, array of entries for dirs)
// so the client-side github.ts loader can swap transparently in dev.
function localContentPlugin() {
  return {
    name: "learnos-local-content",
    configureServer(server) {
      const root = path.resolve(process.cwd(), "..");

      server.middlewares.use("/_local", async (req, res, next) => {
        if (!req.url) return next();

        const rel = decodeURIComponent(req.url.replace(/^\//, "").split("?")[0]);
        const abs = path.resolve(root, rel);

        // path-traversal guard: must stay inside the repo root
        if (!abs.startsWith(root + path.sep) && abs !== root) {
          res.statusCode = 403;
          return res.end("Forbidden");
        }

        // Write endpoint — dev only. Accepts POST /<relative/path> with JSON body.
        // Body shape: { content: string, create_parents?: boolean }
        if (req.method === "POST" || req.method === "PUT") {
          let body = "";
          for await (const chunk of req) body += chunk.toString("utf8");
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            res.statusCode = 400;
            return res.end("Bad JSON");
          }
          if (typeof parsed?.content !== "string") {
            res.statusCode = 400;
            return res.end('Body must be { content: string }');
          }
          try {
            if (parsed.create_parents) {
              await fs.mkdir(path.dirname(abs), { recursive: true });
            }
            await fs.writeFile(abs, parsed.content, "utf8");
            res.setHeader("content-type", "application/json");
            return res.end(JSON.stringify({ ok: true, path: rel }));
          } catch (e) {
            res.statusCode = 500;
            return res.end(`Write failed: ${e}`);
          }
        }

        try {
          const stat = await fs.stat(abs);
          if (stat.isDirectory()) {
            const entries = await fs.readdir(abs, { withFileTypes: true });
            const data = entries.map((e) => ({
              name: e.name,
              path: path.posix.join(rel, e.name),
              type: e.isDirectory() ? "dir" : "file",
            }));
            res.setHeader("content-type", "application/json");
            return res.end(JSON.stringify(data));
          }
          const content = await fs.readFile(abs);
          res.setHeader("content-type", "text/plain; charset=utf-8");
          return res.end(content);
        } catch {
          res.statusCode = 404;
          return res.end(`Not found: ${rel}`);
        }
      });
    },
  };
}

export default defineConfig({
  integrations: [react(), tailwind()],
  server: { port: 4321 },
  vite: {
    plugins: [localContentPlugin()],
  },
});

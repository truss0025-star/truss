#!/usr/bin/env node
/**
 * Local API bridge — lets the React app's onRun(url) hit a real endpoint
 * instead of returning sample data. This is dev/demo infrastructure, not
 * a cloud queue (explicitly out of scope for v0 lean).
 *
 *   npm run serve
 *   POST http://localhost:8787/api/run   body: { "url": "...", "config": "hero-site" }
 *   -> 200 { timeline: Timeline }
 *   -> 500 { error: string }   (a real failed run — the UI's "failed" state, not "no violations")
 *
 * "config" is optional and refers to a filename (without .json) in
 * /config/sites/ — omit it to run full-page checks with no task-completion
 * attempt, same as the CLI's --config flag being absent.
 */
import http from "node:http";
import path from "node:path";
import { runAudit } from "./runAudit";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const CONFIG_DIR = path.join(process.cwd(), "..", "config", "sites");

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // local dev only — the app runs on a different port (vite)
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "POST" && req.url === "/api/run") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { url, config } = JSON.parse(body || "{}") as { url?: string; config?: string };
        if (!url) {
          sendJson(res, 400, { error: "Missing required field: url" });
          return;
        }

        const configPath = config ? path.join(CONFIG_DIR, `${config}.json`) : undefined;
        console.log(`[server] run requested: ${url}${configPath ? ` (config: ${config})` : ""}`);

        const timeline = await runAudit({
          url,
          configPath,
          onLog: (l) => console.log(`[server] ${l}`),
        });

        sendJson(res, 200, { timeline });
      } catch (err) {
        // A real failure — network error, hydration timeout, bad URL, crashed
        // browser. This is exactly what the app's "run-failed" state exists
        // for. Never silently degrade this into "no violations found."
        console.error("[server] run failed:", err);
        sendJson(res, 500, { error: err instanceof Error ? err.message : "Unknown error during run" });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] POST /api/run { "url": "...", "config"?: "hero-site" }`);
});

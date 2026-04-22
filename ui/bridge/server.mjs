#!/usr/bin/env node
// Local bridge: browser UI → claude CLI.
// Uses the user's existing Claude Code auth — no API key needed.
// Listens on 127.0.0.1 only. Not meant to be exposed.

import { spawn } from "node:child_process";
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.LEARNOS_BRIDGE_PORT || 4322);
const ORIGIN = process.env.LEARNOS_UI_ORIGIN || "http://localhost:4321";

const server = http.createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", ORIGIN);
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ ok: true, version: 1 }));
  }

  if (req.method === "POST" && req.url === "/run") {
    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      res.statusCode = 400;
      return res.end(String(e));
    }

    const { system, user, sessionId, firstTurn = true, model } = body || {};
    if (!user || typeof user !== "string") {
      res.statusCode = 400;
      return res.end('Missing "user" string in body');
    }

    const sid = sessionId || randomUUID();
    const args = [
      "-p",
      user,
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
    ];

    if (firstTurn) {
      args.push("--session-id", sid);
      if (system) args.push("--system-prompt", system);
    } else {
      args.push("--resume", sid);
    }

    if (model) args.push("--model", model);

    // Useful: turn off tool use for these pure-prompt runs. Empty string disables all tools.
    args.push("--tools", "");

    console.log(`[bridge] spawn claude ${JSON.stringify(args.slice(0, 2))} sid=${sid} first=${firstTurn}`);

    const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });

    res.setHeader("content-type", "text/event-stream");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders?.();

    // Surface the session id so the client can keep using it for follow-ups
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId: sid })}\n\n`);

    let buf = "";
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const evt = JSON.parse(trimmed);

          const delta = extractTextDelta(evt);
          if (delta) {
            res.write(`event: text\ndata: ${JSON.stringify(delta)}\n\n`);
          }

          const usage = extractUsage(evt);
          if (usage) {
            res.write(`event: usage\ndata: ${JSON.stringify(usage)}\n\n`);
          }
        } catch {
          // ignore non-JSON lines
        }
      }
    });

    let stderrBuf = "";
    child.stderr.on("data", (chunk) => {
      const s = chunk.toString("utf8");
      stderrBuf += s;
      console.error("[bridge] claude stderr:", s);
    });

    child.on("error", (err) => {
      res.write(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`);
      res.end();
    });

    child.on("close", (code) => {
      if (code !== 0 && stderrBuf) {
        res.write(`event: error\ndata: ${JSON.stringify({ code, message: stderrBuf.slice(0, 4000) })}\n\n`);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ code })}\n\n`);
      res.end();
    });

    req.on("close", () => {
      if (!child.killed) child.kill("SIGTERM");
    });
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[bridge] listening on http://127.0.0.1:${PORT}`);
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Pull a text delta out of claude's stream-json events. The event shape varies
 * by event type; we handle the common ones and ignore the rest.
 */
function extractTextDelta(evt) {
  if (!evt || typeof evt !== "object") return null;

  // Partial message streaming: { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "..." } } }
  if (evt.type === "stream_event" && evt.event) {
    const e = evt.event;
    if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
      return e.delta.text ?? null;
    }
  }

  // Assistant turn completion: { type: "assistant", message: { content: [{ type: "text", text: "..." }] } }
  // We don't emit these as deltas (we stream via stream_event above) to avoid doubling.

  return null;
}

/**
 * Emit usage once per claude invocation, from the terminal `result` event.
 * Shape (best-effort across Claude Code versions):
 *   { type: "result", usage: { input_tokens, output_tokens,
 *     cache_creation_input_tokens, cache_read_input_tokens },
 *     total_cost_usd: N }
 */
function extractUsage(evt) {
  if (!evt || typeof evt !== "object") return null;
  if (evt.type !== "result") return null;
  const u = evt.usage ?? {};
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    cost_usd: typeof evt.total_cost_usd === "number" ? evt.total_cost_usd : 0,
  };
}

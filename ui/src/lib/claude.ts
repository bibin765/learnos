import Anthropic from "@anthropic-ai/sdk";
import type { ModelId, Usage } from "./storage";
import { addUsage, getBackend } from "./storage";

export interface StreamOptions {
  apiKey?: string;
  model: ModelId;
  system: string;
  messages: Anthropic.MessageParam[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
  /**
   * For CLI multi-turn: reuse the session ID returned by the first run.
   * First turn: omit (bridge generates one and emits it back).
   */
  sessionId?: string;
  /**
   * For CLI multi-turn: true on the first turn only (sets system prompt
   * and starts a new session). False to `--resume` an existing session.
   */
  firstTurn?: boolean;
}

export interface StreamResult {
  sessionId?: string;
}

export async function streamMessage(opts: StreamOptions): Promise<StreamResult> {
  const backend = getBackend();
  if (backend === "cli") return streamViaCli(opts);
  return streamViaApi(opts);
}

// -----------------------------------------------------------------------------
// CLI backend — POSTs to the local bridge, which shells out to `claude -p`
// -----------------------------------------------------------------------------

const BRIDGE_URL = "http://127.0.0.1:4322";

export async function bridgeHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function streamViaCli(opts: StreamOptions): Promise<StreamResult> {
  // For the CLI backend, we only ever send the *latest* user message. On
  // first turn we also send the system prompt and a session id; on resume
  // we just send the new message and the session id.
  const lastUser = [...opts.messages].reverse().find((m) => m.role === "user");
  if (!lastUser) throw new Error("No user message to send");
  const userText = typeof lastUser.content === "string"
    ? lastUser.content
    : lastUser.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");

  const body = {
    system: opts.system,
    user: userText,
    sessionId: opts.sessionId,
    firstTurn: opts.firstTurn ?? true,
    model: shortModelAlias(opts.model),
  };

  const res = await fetch(`${BRIDGE_URL}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Bridge error ${res.status}: ${errText || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let sessionId: string | undefined;
  let errMsg: string | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // Parse SSE frames — separated by blank lines
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      let eventName = "message";
      let dataLine = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;

      if (eventName === "text") {
        try {
          const delta = JSON.parse(dataLine) as string;
          opts.onText(delta);
        } catch {
          /* skip */
        }
      } else if (eventName === "session") {
        try {
          sessionId = (JSON.parse(dataLine) as { sessionId: string }).sessionId;
        } catch {
          /* skip */
        }
      } else if (eventName === "usage") {
        try {
          const u = JSON.parse(dataLine) as Partial<Usage>;
          addUsage(u);
        } catch {
          /* skip */
        }
      } else if (eventName === "error") {
        try {
          errMsg = (JSON.parse(dataLine) as { message?: string }).message ?? dataLine;
        } catch {
          errMsg = dataLine;
        }
      } else if (eventName === "done") {
        // fallthrough — loop ends when reader is done
      }
    }
  }

  if (errMsg) throw new Error(errMsg);
  return { sessionId };
}

function shortModelAlias(model: ModelId): string {
  // claude CLI accepts both full IDs and short aliases
  if (model === "claude-opus-4-7") return "opus";
  if (model === "claude-sonnet-4-6") return "sonnet";
  return model;
}

// -----------------------------------------------------------------------------
// API backend — direct browser → Anthropic with user-supplied key
// -----------------------------------------------------------------------------

async function streamViaApi(opts: StreamOptions): Promise<StreamResult> {
  if (!opts.apiKey) {
    throw new Error("API key required for API backend. Paste one in the top bar, or switch to CLI mode.");
  }

  const client = new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const stream = client.messages.stream(
    {
      model: opts.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: opts.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: opts.messages,
    },
    { signal: opts.signal },
  );

  stream.on("text", opts.onText);
  const final = await stream.finalMessage();
  const u = final.usage;
  addUsage({
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
  });
  return {};
}

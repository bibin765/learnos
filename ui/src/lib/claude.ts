import Anthropic from "@anthropic-ai/sdk";
import type { ModelId } from "./storage";

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export interface StreamOptions {
  apiKey: string;
  model: ModelId;
  system: string;
  messages: Anthropic.MessageParam[];
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream a response from Claude, calling `onText` for each text delta.
 * Uses adaptive thinking (Opus 4.7 / Sonnet 4.6) and sets a cache_control
 * breakpoint on the system prompt — a no-op below the model's minimum
 * cacheable prefix (~4K tokens on Opus 4.7, ~2K on Sonnet 4.6) but harmless.
 */
export async function streamMessage(opts: StreamOptions): Promise<Anthropic.Message> {
  const client = makeClient(opts.apiKey);

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

  return stream.finalMessage();
}

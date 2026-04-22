const KEY_API = "learnos.anthropic_api_key";
const KEY_MODEL = "learnos.model";
const KEY_BACKEND = "learnos.backend";
const KEY_USAGE = "learnos.usage";

export const USAGE_EVENT = "learnos:usage-updated";

export type ModelId = "claude-opus-4-7" | "claude-sonnet-4-6";
export type Backend = "cli" | "api";

export const MODELS: { id: ModelId; label: string; blurb: string }[] = [
  {
    id: "claude-opus-4-7",
    label: "Opus 4.7",
    blurb: "Best quality. Use for hard Socratic sessions and thorough Feynman audits.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    blurb: "Faster + cheaper. Good for rapid roadmap drafts and casual chat.",
  },
];

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_API);
}

export function setApiKey(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_API, key);
}

export function clearApiKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_API);
}

export function getModel(): ModelId {
  if (typeof window === "undefined") return "claude-opus-4-7";
  const m = localStorage.getItem(KEY_MODEL);
  if (m === "claude-sonnet-4-6" || m === "claude-opus-4-7") return m;
  return "claude-opus-4-7";
}

export function setModel(m: ModelId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_MODEL, m);
}

export function getBackend(): Backend {
  if (typeof window === "undefined") return "cli";
  const b = localStorage.getItem(KEY_BACKEND);
  if (b === "api" || b === "cli") return b;
  return "cli"; // default: route through local Claude Code CLI
}

export function setBackend(b: Backend): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_BACKEND, b);
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cost_usd: number;
  runs: number;
}

const ZERO_USAGE: Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  cost_usd: 0,
  runs: 0,
};

export function getUsage(): Usage {
  if (typeof window === "undefined") return { ...ZERO_USAGE };
  try {
    const raw = localStorage.getItem(KEY_USAGE);
    if (!raw) return { ...ZERO_USAGE };
    return { ...ZERO_USAGE, ...(JSON.parse(raw) as Partial<Usage>) };
  } catch {
    return { ...ZERO_USAGE };
  }
}

export function addUsage(delta: Partial<Usage>): Usage {
  if (typeof window === "undefined") return { ...ZERO_USAGE };
  const cur = getUsage();
  const next: Usage = {
    input_tokens: cur.input_tokens + (delta.input_tokens ?? 0),
    output_tokens: cur.output_tokens + (delta.output_tokens ?? 0),
    cache_creation_input_tokens:
      cur.cache_creation_input_tokens + (delta.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      cur.cache_read_input_tokens + (delta.cache_read_input_tokens ?? 0),
    cost_usd: cur.cost_usd + (delta.cost_usd ?? 0),
    runs: cur.runs + 1,
  };
  localStorage.setItem(KEY_USAGE, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: next }));
  return next;
}

export function clearUsage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_USAGE);
  window.dispatchEvent(new CustomEvent(USAGE_EVENT, { detail: { ...ZERO_USAGE } }));
}

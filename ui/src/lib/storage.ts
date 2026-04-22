const KEY_API = "learnos.anthropic_api_key";
const KEY_MODEL = "learnos.model";

export type ModelId = "claude-opus-4-7" | "claude-sonnet-4-6";

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

/**
 * Session persistence — stash active conversations in localStorage so a
 * browser refresh doesn't wipe a Socratic grilling or a half-finished
 * roadmap interview.
 *
 * We store only what the UI needs to rehydrate: turns + the Claude Code
 * session id (for CLI --resume) + whatever small state the component
 * owns. The underlying Claude Code session lives on disk under
 * ~/.claude/projects — we just keep a pointer to it.
 */

const KEY = "learnos.sessions";
export const SESSIONS_EVENT = "learnos:sessions-updated";

export type SessionKind = "socratic" | "roadmap-wizard";

export interface SessionTurn {
  role: "user" | "assistant";
  content: string;
}

export interface SavedSession {
  id: string;
  kind: SessionKind;
  title: string;
  subtitle?: string;
  turns: SessionTurn[];
  /** Claude Code session id — used by the CLI bridge for `--resume`. */
  sessionId?: string;
  /** Free-form component state (wizard stage, concept, etc.). */
  meta?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

type Registry = Record<string, SavedSession>;

function loadAll(): Registry {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Registry) : {};
  } catch {
    return {};
  }
}

function saveAll(reg: Registry): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(reg));
  window.dispatchEvent(new CustomEvent(SESSIONS_EVENT));
}

export function slugKey(kind: SessionKind, concept: string): string {
  const slug = concept
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${kind}:${slug}`;
}

export function saveSession(s: Omit<SavedSession, "createdAt" | "updatedAt"> & {
  createdAt?: number;
}): SavedSession {
  const reg = loadAll();
  const existing = reg[s.id];
  const now = Date.now();
  const next: SavedSession = {
    ...s,
    createdAt: existing?.createdAt ?? s.createdAt ?? now,
    updatedAt: now,
  };
  reg[s.id] = next;
  saveAll(reg);
  return next;
}

export function getSession(id: string): SavedSession | null {
  return loadAll()[id] ?? null;
}

export function listSessions(kind?: SessionKind): SavedSession[] {
  const all = Object.values(loadAll());
  const filtered = kind ? all.filter((s) => s.kind === kind) : all;
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteSession(id: string): void {
  const reg = loadAll();
  delete reg[id];
  saveAll(reg);
}

export function clearAllSessions(): void {
  saveAll({});
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Per-week study progress. Independent from chat sessions — this tracks
 * the learner's own work (primed? read? explained? defended?) rather
 * than a conversation thread.
 */

const KEY = "learnos.study";
export const STUDY_EVENT = "learnos:study-updated";

export type Phase = "prime" | "read" | "explain" | "defend";
export const PHASES: Phase[] = ["prime", "read", "explain", "defend"];

export interface StudyState {
  id: string;
  topicSlug: string;
  /** Unit key — week number (legacy) or node id (graph roadmap). */
  unit: string;
  theme?: string;
  primeQuestions?: string[];
  notes?: string;
  explanation?: string;
  auditReport?: string;
  phases: Record<Phase, boolean>;
  updatedAt: number;
  // Legacy compat — some callers still reference `week`.
  week?: number;
}

type Registry = Record<string, StudyState>;

export function studyKey(topicSlug: string, unit: string | number): string {
  return `${topicSlug}#${unit}`;
}

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
  window.dispatchEvent(new CustomEvent(STUDY_EVENT));
}

export function getStudy(id: string): StudyState | null {
  return loadAll()[id] ?? null;
}

export function upsertStudy(
  id: string,
  patch: Partial<Omit<StudyState, "id" | "updatedAt">>,
): StudyState {
  const reg = loadAll();
  const prev = reg[id];
  const base: StudyState =
    prev ??
    {
      id,
      topicSlug: "",
      unit: "",
      phases: { prime: false, read: false, explain: false, defend: false },
      updatedAt: 0,
    };
  const next: StudyState = {
    ...base,
    ...patch,
    phases: { ...base.phases, ...(patch.phases ?? {}) },
    updatedAt: Date.now(),
  };
  reg[id] = next;
  saveAll(reg);
  return next;
}

export function markPhase(id: string, phase: Phase, done: boolean): StudyState | null {
  const s = getStudy(id);
  if (!s) return null;
  return upsertStudy(id, { phases: { ...s.phases, [phase]: done } });
}

export function listStudyForTopic(topicSlug: string): StudyState[] {
  return Object.values(loadAll())
    .filter((s) => s.topicSlug === topicSlug)
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
}

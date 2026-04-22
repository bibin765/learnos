import { useEffect, useMemo, useRef, useState } from "react";
import { fetchText } from "../lib/github";
import { parseRoadmap, type Week } from "../lib/parseContent";
import { loadNodeRoadmap, type NodeRoadmap, type RoadmapNode } from "../lib/nodes";
import {
  getStudy,
  markPhase,
  studyKey,
  upsertStudy,
  type Phase,
  type StudyState,
} from "../lib/study";
import { streamMessage } from "../lib/claude";
import { getApiKey, getBackend, getModel } from "../lib/storage";
import { renderMarkdown } from "../lib/markdown";

const PHASE_LABELS: Record<Phase, string> = {
  prime: "Prime",
  read: "Read",
  explain: "Explain",
  defend: "Defend",
};

const PHASE_BLURBS: Record<Phase, string> = {
  prime: "Story beats to hold in your head before you read.",
  read: "Engage the primary sources. Capture confusions and excerpts.",
  explain: "Write it plain. The auditor finds the cracks.",
  defend: "Pressure-test the weak spots until they stop breaking.",
};

/**
 * Shared shape that powers the 4 phases regardless of source
 * (graph-node roadmap or legacy week roadmap).
 */
interface UnitContext {
  mode: "node" | "week";
  slug: string;
  unitKey: string;           // studyKey unit — node id or week number as string
  title: string;
  feynmanQ: string;
  sources: SourceEntry[];    // sources for the Read phase
  traps: string[];
  // Node mode provides pre-written story beats — no LLM call for Prime.
  story?: { knot: string; move: string; handle: string };
  // Week mode provides raw concept markdown so Prime can LLM-generate questions.
  weekConceptsMarkdown?: string;
}

interface SourceEntry {
  ref: string;
  kind?: string;
}

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function StudyMode() {
  const [ctx, setCtx] = useState<UnitContext | null>(null);
  const [state, setState] = useState<StudyState | null>(null);
  const [phase, setPhase] = useState<Phase>("prime");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("slug");
    const nodeId = params.get("node");
    const week = params.get("week");

    if (!s || (!nodeId && !week)) {
      setError("Missing ?slug= and ?node= or ?week=");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        if (nodeId) {
          const rm = await loadNodeRoadmap(s);
          if (!rm) throw new Error(`No roadmap.json for ${s}`);
          const node = rm.nodes.find((n) => n.id === nodeId);
          if (!node) throw new Error(`Node ${nodeId} not found`);
          setCtx(buildNodeContext(s, rm, node));
        } else if (week) {
          const w = Number(week);
          const md = await fetchText(`roadmaps/${s}/roadmap.md`);
          const parsed = parseRoadmap(md);
          const found = parsed.weeks.find((x) => x.number === w);
          if (!found) throw new Error(`Week ${w} not found`);
          setCtx(buildWeekContext(s, w, found));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const id = studyKey(ctx.slug, ctx.unitKey);
    setState(
      getStudy(id) ??
        upsertStudy(id, {
          topicSlug: ctx.slug,
          unit: ctx.unitKey,
          theme: ctx.title,
        }),
    );
  }, [ctx]);

  function updateState(patch: Partial<Omit<StudyState, "id" | "updatedAt">>) {
    if (!state) return;
    const next = upsertStudy(state.id, patch);
    setState(next);
  }

  function togglePhase(p: Phase) {
    if (!state) return;
    const next = markPhase(state.id, p, !state.phases[p]);
    if (next) setState(next);
  }

  if (loading) return <div className="text-ink/50 text-sm">loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-4 rounded">
        {error}
      </div>
    );
  if (!ctx || !state) return null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <a
          href={
            ctx.mode === "node"
              ? `/node?topic=${ctx.slug}&id=${ctx.unitKey}`
              : `/topic?slug=${ctx.slug}`
          }
          className="text-xs font-mono text-ink/50 hover:text-ink"
        >
          ← {ctx.mode === "node" ? humanize(ctx.slug) : "back"}
        </a>
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-accent">
            Study — {ctx.mode === "node" ? "Node" : `Week ${ctx.unitKey}`}
          </div>
          <h1 className="font-serif text-3xl tracking-tight leading-snug mt-1">{ctx.title}</h1>
        </div>
      </header>

      <PhaseBar phase={phase} onChange={setPhase} phases={state.phases} />

      <section>
        {phase === "prime" && (
          <PrimePhase ctx={ctx} state={state} onUpdate={updateState} onMarkDone={() => togglePhase("prime")} />
        )}
        {phase === "read" && (
          <ReadPhase ctx={ctx} state={state} onUpdate={updateState} onMarkDone={() => togglePhase("read")} />
        )}
        {phase === "explain" && (
          <ExplainPhase ctx={ctx} state={state} onUpdate={updateState} onMarkDone={() => togglePhase("explain")} />
        )}
        {phase === "defend" && (
          <DefendPhase ctx={ctx} state={state} onMarkDone={() => togglePhase("defend")} />
        )}
      </section>
    </div>
  );
}

// --- Context builders --------------------------------------------------------

function buildNodeContext(slug: string, rm: NodeRoadmap, node: RoadmapNode): UnitContext {
  return {
    mode: "node",
    slug,
    unitKey: node.id,
    title: node.title,
    feynmanQ: node.feynman,
    sources: node.sources,
    traps: node.traps ?? [],
    story: node.story,
  };
}

function buildWeekContext(slug: string, week: number, w: Week): UnitContext {
  const concepts = w.sections.find((s) => s.label.toLowerCase().startsWith("core concept"));
  const feynman = w.sections.find((s) => s.label.toLowerCase().startsWith("feynman"));
  const traps = w.sections.find((s) => s.label.toLowerCase().startsWith("common trap"));
  return {
    mode: "week",
    slug,
    unitKey: String(week),
    title: w.theme,
    feynmanQ: feynman?.body ?? "",
    sources: (concepts ? extractBullets(concepts.body) : []).map((b) => ({ ref: b })),
    traps: traps ? extractBullets(traps.body) : [],
    weekConceptsMarkdown: concepts?.body,
  };
}

// --- PhaseBar --------------------------------------------------------------

function PhaseBar({
  phase,
  onChange,
  phases,
}: {
  phase: Phase;
  onChange: (p: Phase) => void;
  phases: Record<Phase, boolean>;
}) {
  const order: Phase[] = ["prime", "read", "explain", "defend"];
  return (
    <nav className="grid grid-cols-4 gap-2">
      {order.map((p, i) => {
        const active = p === phase;
        const done = phases[p];
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`text-left px-4 py-3 rounded-lg border transition-all ${
              active ? "bg-white border-accent shadow-sm" : "bg-white/50 border-rule hover:border-accent/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[10px] tabular-nums ${active ? "text-accent" : "text-ink/40"}`}>
                0{i + 1}
              </span>
              <span className={`w-2 h-2 rounded-full ${done ? "bg-accent" : "bg-ink/15"}`} />
            </div>
            <div className={`font-serif text-base mt-0.5 ${active ? "text-ink" : "text-ink/70"}`}>
              {PHASE_LABELS[p]}
            </div>
            <div className="text-[11px] text-ink/50 leading-tight mt-0.5 hidden sm:block">
              {PHASE_BLURBS[p]}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

// --- Prime phase -----------------------------------------------------------

function PrimePhase({
  ctx,
  state,
  onUpdate,
  onMarkDone,
}: {
  ctx: UnitContext;
  state: StudyState;
  onUpdate: (patch: Partial<StudyState>) => void;
  onMarkDone: () => void;
}) {
  // In node mode, the story beats are pre-written — no LLM call needed.
  if (ctx.mode === "node" && ctx.story) {
    return (
      <div className="space-y-5">
        <PhaseHeader title="Prime" body="The story that earns the concept. Read these before you touch the sources." />
        <div className="bg-white border border-rule rounded-lg p-5 space-y-5">
          <StoryBeatBlock index="01" label="The knot" body={ctx.story.knot} />
          <StoryBeatBlock index="02" label="The move" body={ctx.story.move} accent />
          <StoryBeatBlock index="03" label="The handle" body={ctx.story.handle} compact />
          <div className="pt-2 border-t border-rule">
            <DoneToggle
              done={state.phases.prime}
              onToggle={onMarkDone}
              label="I've internalized the story arc"
            />
          </div>
        </div>
      </div>
    );
  }

  // Week mode — generate framing questions on demand.
  return <WeekPrime ctx={ctx} state={state} onUpdate={onUpdate} onMarkDone={onMarkDone} />;
}

function StoryBeatBlock({
  label,
  index,
  body,
  accent,
  compact,
}: {
  label: string;
  index: string;
  body: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={accent ? "border-l-2 border-accent/60 pl-4" : "border-l-2 border-rule pl-4"}>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-[10px] text-accent tabular-nums">{index}</span>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink/60">{label}</h3>
      </div>
      <p className={`font-serif ${compact ? "text-lg italic" : "text-[15px]"} leading-relaxed`}>{body}</p>
    </div>
  );
}

function WeekPrime({
  ctx,
  state,
  onUpdate,
  onMarkDone,
}: {
  ctx: UnitContext;
  state: StudyState;
  onUpdate: (patch: Partial<StudyState>) => void;
  onMarkDone: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [buf, setBuf] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    const backend = getBackend();
    const apiKey = getApiKey() ?? undefined;
    if (backend === "api" && !apiKey) {
      setError("Paste an Anthropic API key or switch to CLI mode.");
      return;
    }
    setError(null);
    setGenerating(true);
    setBuf("");
    abortRef.current = new AbortController();

    const system = `You are a pedagogy expert. Given a learning unit, produce exactly 3 crisp framing questions the learner should hold in their head *while* reading the primary sources. Rules:
- Numbered list, one question per line, nothing else.
- Each question should make the reader notice a specific mechanism, distinction, or tradeoff.
- Do not answer the questions. Do not summarize. Do not include preamble.
- Return exactly 3 questions and stop.`;

    const userPrompt = `Week theme: ${ctx.title}\n\nCore concepts:\n${ctx.weekConceptsMarkdown ?? ""}\n\n${
      ctx.feynmanQ ? `Feynman checkpoint:\n${ctx.feynmanQ}\n\n` : ""
    }Generate 3 framing questions.`;

    let acc = "";
    try {
      await streamMessage({
        apiKey,
        model: getModel(),
        system,
        messages: [{ role: "user", content: userPrompt }],
        onText: (d) => {
          acc += d;
          setBuf(acc);
        },
        signal: abortRef.current.signal,
        firstTurn: true,
      });
      const parsed = parseNumbered(acc);
      onUpdate({ primeQuestions: parsed.length > 0 ? parsed : [acc.trim()] });
      setBuf("");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const questions = state.primeQuestions ?? [];

  return (
    <div className="space-y-5">
      <PhaseHeader title="Prime" body="Questions to hold in your head before you read." />

      {questions.length === 0 && !generating && (
        <div className="bg-white border border-rule rounded-lg p-5 space-y-3">
          <p className="text-[15px] text-ink-soft">
            Before you touch the sources, generate three framing questions to anchor your reading.
          </p>
          <button
            onClick={generate}
            className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90"
          >
            Generate framing questions →
          </button>
        </div>
      )}

      {(generating || buf) && (
        <div className="bg-white border border-accent/30 rounded-lg p-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent mb-2">streaming…</div>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(buf) }} />
        </div>
      )}

      {questions.length > 0 && !generating && (
        <div className="bg-white border border-rule rounded-lg p-5 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono">Hold these while reading</div>
          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-mono text-accent tabular-nums shrink-0 text-sm pt-0.5">0{i + 1}</span>
                <span className="font-serif text-[15px] leading-relaxed">{q}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={generate} className="text-xs font-mono underline text-ink/50 hover:text-ink">
              regenerate
            </button>
            <DoneToggle done={state.phases.prime} onToggle={onMarkDone} label="I've internalized these" />
          </div>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}

// --- Read phase ------------------------------------------------------------

function ReadPhase({
  ctx,
  state,
  onUpdate,
  onMarkDone,
}: {
  ctx: UnitContext;
  state: StudyState;
  onUpdate: (patch: Partial<StudyState>) => void;
  onMarkDone: () => void;
}) {
  const [notes, setNotes] = useState(state.notes ?? "");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(state.notes ?? "");
  }, [state.id]);

  function onNotesChange(v: string) {
    setNotes(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate({ notes: v }), 400);
  }

  return (
    <div className="space-y-5">
      <PhaseHeader title="Read" body={PHASE_BLURBS.read} />

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="space-y-4">
          <h3 className="text-[11px] uppercase tracking-widest text-ink/50 font-mono">Primary sources</h3>
          <ul className="space-y-3">
            {ctx.sources.map((s, i) => (
              <SourceCard key={i} source={s} />
            ))}
          </ul>
          {ctx.traps.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-[11px] uppercase tracking-widest font-mono text-ink/50 hover:text-ink">
                ⚠ watch for these traps
              </summary>
              <ul className="mt-2 list-disc list-inside text-[14px] leading-relaxed text-ink-soft space-y-1">
                {ctx.traps.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-widest text-ink/50 font-mono">Your reading notes</h3>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Excerpts, questions as they arise, connections you spot. Raw is fine. Autosaves."
            rows={14}
            className="w-full border border-rule rounded p-3 font-serif text-[14px] bg-paper focus:outline-none focus:border-accent leading-relaxed"
          />
          <div className="flex items-center gap-3">
            <DoneToggle done={state.phases.read} onToggle={onMarkDone} label="I've done the reading" />
            <span className="text-xs text-ink/40">autosaves</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: SourceEntry }) {
  const sourceMatch = source.ref.match(/source:\s*([^.]+(?:\.[^.]+)*)/i);
  const query = sourceMatch ? sourceMatch[1].trim() : source.ref.slice(0, 160);
  const scholar = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
  const google = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  return (
    <li className="bg-white border border-rule rounded-lg p-4">
      {source.kind && (
        <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40 mr-2">
          {source.kind}
        </span>
      )}
      <span className="text-[14px]">{source.ref}</span>
      <div className="flex gap-3 mt-2 text-xs font-mono">
        <a href={scholar} target="_blank" rel="noreferrer" className="text-accent underline hover:opacity-80">
          scholar ↗
        </a>
        <a href={google} target="_blank" rel="noreferrer" className="text-accent underline hover:opacity-80">
          google ↗
        </a>
      </div>
    </li>
  );
}

// --- Explain phase ---------------------------------------------------------

function ExplainPhase({
  ctx,
  state,
  onUpdate,
  onMarkDone,
}: {
  ctx: UnitContext;
  state: StudyState;
  onUpdate: (patch: Partial<StudyState>) => void;
  onMarkDone: () => void;
}) {
  const [text, setText] = useState(state.explanation ?? "");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(state.auditReport ?? "");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setText(state.explanation ?? "");
    setReport(state.auditReport ?? "");
  }, [state.id]);

  async function runAudit() {
    if (!text.trim()) return;
    const backend = getBackend();
    const apiKey = getApiKey() ?? undefined;
    if (backend === "api" && !apiKey) {
      setError("Paste an Anthropic API key or switch to CLI mode.");
      return;
    }
    setError(null);
    setRunning(true);
    setReport("");
    abortRef.current = new AbortController();

    const system = `You are a Feynman-technique auditor. The user has written a plain-language explanation. Find the cracks, not praise. Produce:

1. A sentence-by-sentence table classifying each sentence as:
   - ✅ Clear — a bright 14-year-old would understand this directly
   - ⚠️ Jargon-laundering — a technical term was used as if self-evident
   - ❌ Causal gap — a "because/so/therefore" where the mechanism is missing
   - 🕳️ Unspoken assumption — a fact is treated as given that would reasonably be questioned

2. A "## Knowledge Gaps" section with the top 3 gaps — each with: the gap, a diagnostic question, the shortest fix path.

3. A single "## Rewrite prompt" question the user should answer before retrying.

Rules: don't fill gaps. Don't praise. If under 150 words, tell user to extend. Return only the audit — no preamble.`;

    const userPrompt = `Concept: ${ctx.title}${
      ctx.feynmanQ ? `\n\nFeynman checkpoint I'm answering:\n${ctx.feynmanQ}` : ""
    }\n\n---EXPLANATION---\n\n${text.trim()}`;

    let acc = "";
    try {
      await streamMessage({
        apiKey,
        model: getModel(),
        system,
        messages: [{ role: "user", content: userPrompt }],
        onText: (d) => {
          acc += d;
          setReport(acc);
        },
        signal: abortRef.current.signal,
        firstTurn: true,
      });
      onUpdate({ explanation: text, auditReport: acc });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function saveDraft() {
    onUpdate({ explanation: text });
  }

  return (
    <div className="space-y-5">
      <PhaseHeader title="Explain" body={PHASE_BLURBS.explain} />

      {ctx.feynmanQ && (
        <div className="bg-accent/5 border-l-2 border-accent/60 px-4 py-3 rounded-r">
          <div className="text-[11px] uppercase tracking-widest text-accent/80 font-mono mb-1">answer this</div>
          <div className="font-serif text-[15px] italic leading-relaxed">{ctx.feynmanQ}</div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono">
            Your explanation (200–400 words, no jargon)
          </div>
          <span className="text-[11px] font-mono text-ink/40">{wordCount(text)} words</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={saveDraft}
          placeholder="Explain as if to a curious 14-year-old who is good at math but has never heard the term before."
          rows={12}
          className="w-full border border-rule rounded p-3 font-serif text-[15px] bg-paper focus:outline-none focus:border-accent leading-relaxed"
        />
        <div className="flex items-center gap-3">
          {!running ? (
            <button
              onClick={runAudit}
              disabled={!text.trim() || wordCount(text) < 50}
              className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20 disabled:cursor-not-allowed"
            >
              Run audit →
            </button>
          ) : (
            <button
              onClick={() => abortRef.current?.abort()}
              className="bg-ink/60 text-white font-mono px-4 py-2 rounded text-sm"
            >
              stop
            </button>
          )}
          {report && !running && (
            <DoneToggle done={state.phases.explain} onToggle={onMarkDone} label="I've reviewed the gap report" />
          )}
        </div>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {report && (
        <div className="bg-white border border-rule rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono mb-3">
            ◎ gap report {running && "(streaming…)"}
          </div>
          <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }} />
        </div>
      )}
    </div>
  );
}

// --- Defend phase ----------------------------------------------------------

function DefendPhase({
  ctx,
  state,
  onMarkDone,
}: {
  ctx: UnitContext;
  state: StudyState;
  onMarkDone: () => void;
}) {
  const socraticUrl = `/templates/socratic?concept=${encodeURIComponent(ctx.title)}&topic=${ctx.slug}`;
  const gapReport = state.auditReport ?? "";

  return (
    <div className="space-y-5">
      <PhaseHeader title="Defend" body={PHASE_BLURBS.defend} />
      <div className="bg-white border border-rule rounded-lg p-5 space-y-4">
        <p className="text-[15px] text-ink-soft leading-relaxed">
          Pick the weakest spot from your gap report and let the Socratic tutor grill you on it. The session
          refuses to hand over answers — it'll work you through the reasoning until the cracks close.
        </p>
        {gapReport && (
          <details className="bg-paper border border-rule rounded p-3">
            <summary className="cursor-pointer text-[11px] uppercase tracking-widest text-ink/50 font-mono">
              gap report for reference
            </summary>
            <article
              className="prose max-w-none mt-3 text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(gapReport) }}
            />
          </details>
        )}
        <div className="flex flex-wrap gap-3 items-center pt-1">
          <a href={socraticUrl} className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90">
            Start Socratic session →
          </a>
          <DoneToggle done={state.phases.defend} onToggle={onMarkDone} label="I can defend this without notes" />
        </div>
      </div>
    </div>
  );
}

// --- Shared bits -----------------------------------------------------------

function PhaseHeader({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <p className="text-sm text-ink-soft mt-1">{body}</p>
    </div>
  );
}

function DoneToggle({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center ${
          done ? "bg-accent border-accent text-white" : "border-ink/30"
        }`}
        aria-hidden
      >
        {done && "✓"}
      </span>
      <span className={done ? "line-through text-ink/40" : ""}>{label}</span>
    </button>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-3 rounded font-mono">
      {children}
    </div>
  );
}

function extractBullets(body: string): string[] {
  const lines = body.split("\n");
  const out: string[] = [];
  let current = "";
  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (current) out.push(current.trim());
      current = bulletMatch[1];
    } else if (current && line.trim()) {
      current += " " + line.trim();
    } else if (!line.trim() && current) {
      out.push(current.trim());
      current = "";
    }
  }
  if (current) out.push(current.trim());
  return out.filter(Boolean);
}

function parseNumbered(text: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (m) {
      if (current) out.push(current.trim());
      current = m[1];
    } else if (current && line.trim()) {
      current += " " + line.trim();
    }
  }
  if (current) out.push(current.trim());
  return out;
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

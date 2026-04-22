import { useEffect, useMemo, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { fetchText, writeLocal, canWriteLocally } from "../lib/github";
import { streamMessage } from "../lib/claude";
import { extractPromptBody, fillTemplate, renderMarkdown } from "../lib/markdown";
import { getApiKey, getBackend, getModel } from "../lib/storage";
import {
  deleteSession,
  getSession,
  relativeTime,
  saveSession,
  slugKey,
} from "../lib/sessions";
import Md from "./Md";

type Stage = "intake" | "interview" | "answering" | "generating" | "done";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function RoadmapWizard() {
  const [template, setTemplate] = useState<string>("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [topic, setTopic] = useState<string>("");
  const [stage, setStage] = useState<Stage>("intake");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streamBuf, setStreamBuf] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const storageId = topic ? slugKey("roadmap-wizard", topic) : "";

  useEffect(() => {
    fetchText("templates/roadmap-gen.md")
      .then((t) => setTemplate(extractPromptBody(t)))
      .catch((e: Error) => setTemplateError(e.message));

    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resume");
    if (resumeId) {
      const saved = getSession(resumeId);
      if (saved) {
        setTopic((saved.meta?.topic as string) ?? saved.title);
        setTurns(saved.turns);
        setSessionId(saved.sessionId);
        setStage((saved.meta?.stage as Stage) ?? "done");
        setResumedFrom(saved.updatedAt);
        return;
      }
    }
    const t = params.get("topic");
    if (t) {
      const humanized = humanize(t);
      setTopic(humanized);
      const existing = getSession(slugKey("roadmap-wizard", humanized));
      if (existing && existing.turns.length > 0) {
        setTurns(existing.turns);
        setSessionId(existing.sessionId);
        setStage((existing.meta?.stage as Stage) ?? "done");
        setResumedFrom(existing.updatedAt);
      }
    }
  }, []);

  const system = useMemo(
    () => (template ? fillTemplate(template, { TOPIC: topic || "{{TOPIC}}" }) : ""),
    [template, topic],
  );

  const finalRoadmap = useMemo(() => {
    // Last assistant turn in "done" state is the roadmap.
    if (stage !== "done") return "";
    const last = [...turns].reverse().find((t) => t.role === "assistant");
    return last?.content ?? "";
  }, [turns, stage]);

  const slug = useMemo(() => slugify(topic), [topic]);

  async function runTurn(userText: string, firstTurn: boolean) {
    const backend = getBackend();
    const apiKey = getApiKey() ?? undefined;
    if (backend === "api" && !apiKey) {
      setError("Paste an Anthropic API key in the bar at the top, or switch to CLI mode.");
      return;
    }

    const outbound: Turn[] = [...turns, { role: "user", content: userText }];
    setTurns(outbound);
    setStreamBuf("");
    abortRef.current = new AbortController();

    let acc = "";
    try {
      const apiMessages: Anthropic.MessageParam[] = outbound.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await streamMessage({
        apiKey,
        model: getModel(),
        system,
        messages: apiMessages,
        onText: (delta) => {
          acc += delta;
          setStreamBuf(acc);
        },
        signal: abortRef.current.signal,
        sessionId,
        firstTurn,
      });
      if (result.sessionId && !sessionId) setSessionId(result.sessionId);
      const finalTurns = [...outbound, { role: "assistant" as const, content: acc }];
      setTurns(finalTurns);
      setStreamBuf("");
      if (storageId) {
        saveSession({
          id: storageId,
          kind: "roadmap-wizard",
          title: topic,
          subtitle: "Roadmap wizard",
          turns: finalTurns,
          sessionId: result.sessionId ?? sessionId,
          meta: { topic, stage },
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      } else if (acc) {
        setTurns((ts) => [...ts, { role: "assistant", content: acc + "\n\n_(interrupted)_" }]);
        setStreamBuf("");
      }
    } finally {
      abortRef.current = null;
    }
  }

  async function start() {
    if (!topic.trim()) return;
    setError(null);
    // If a saved wizard session exists for this topic, resume it instead of starting over.
    const existing = getSession(slugKey("roadmap-wizard", topic));
    if (existing && existing.turns.length > 0) {
      setTurns(existing.turns);
      setSessionId(existing.sessionId);
      setStage((existing.meta?.stage as Stage) ?? "done");
      setResumedFrom(existing.updatedAt);
      return;
    }
    setStage("interview");
    await runTurn(
      `Topic: ${topic.trim()}\n\nBegin Phase 1: ask your clarifying questions now.`,
      true,
    );
    setStage("answering");
  }

  async function submitAnswers() {
    if (!answer.trim()) return;
    setError(null);
    setStage("generating");
    await runTurn(
      `Here are my answers:\n\n${answer.trim()}\n\nNow begin Phase 2: generate the full roadmap.`,
      false,
    );
    setAnswer("");
    setStage("done");
  }

  function restart() {
    abortRef.current?.abort();
    if (storageId) deleteSession(storageId);
    setTurns([]);
    setStreamBuf("");
    setSessionId(undefined);
    setAnswer("");
    setError(null);
    setSaveMsg(null);
    setResumedFrom(null);
    setStage("intake");
  }

  function copy() {
    navigator.clipboard.writeText(finalRoadmap);
    setSaveMsg("copied to clipboard");
    setTimeout(() => setSaveMsg(null), 2500);
  }

  async function save() {
    if (!slug) {
      setSaveMsg("Need a topic name before saving.");
      return;
    }
    try {
      await writeLocal(`roadmaps/${slug}/roadmap.md`, finalRoadmap);
      // Also seed progress_log.md so the topic page timeline has a home.
      // We only write this if it doesn't look like it already exists — fetch
      // first, fall through to write if it 404s.
      const logPath = `roadmaps/${slug}/progress_log.md`;
      try {
        const res = await fetch(`/_local/${logPath}`);
        if (!res.ok) throw new Error("not found");
      } catch {
        const today = new Date().toISOString().slice(0, 10);
        const logSeed = `# Progress Log — ${topic}

> One dated entry per study session. Keep entries short and causal: what you touched, what clicked, what broke, what's next.

## ${today} — Kickoff

- Generated roadmap via the wizard.
- Next: prime + read Week 1 sources.

---

<!-- Append new sessions below. Format:

## YYYY-MM-DD — <Session title>

- What I studied:
- What clicked:
- What's still fuzzy:
- Next session:

-->
`;
        await writeLocal(logPath, logSeed);
      }
      setSaveMsg(`saved → roadmaps/${slug}/`);
    } catch (e) {
      setSaveMsg((e as Error).message);
    }
  }

  if (templateError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-4 rounded font-mono">
        Couldn't load template: {templateError}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-widest text-accent">
          ▦ roadmap wizard
        </div>
        <h1 className="font-serif text-3xl tracking-tight">
          Generate a 4-week learning roadmap
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed max-w-2xl">
          Two phases. First the tutor asks a few topic-specific clarifying questions. Then it
          produces a dense, primary-sources-only plan tailored to your answers.
        </p>
      </header>

      <StageIndicator stage={stage} />

      {resumedFrom !== null && stage !== "intake" && (
        <div className="text-xs font-mono text-accent/80 bg-accent/5 border border-accent/20 rounded px-3 py-2">
          ↻ Resumed from {relativeTime(resumedFrom)}. Continue where you left off, or click{" "}
          <button onClick={restart} className="underline hover:no-underline">
            start over
          </button>
          .
        </div>
      )}

      {stage === "intake" && (
        <section className="bg-white border border-rule rounded-lg p-6 space-y-4 max-w-xl">
          <label className="block">
            <span className="text-xs font-mono text-ink/60 uppercase tracking-widest">Topic</span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Rust async runtimes"
              className="mt-2 w-full border border-rule rounded px-3 py-2 font-serif text-base bg-paper focus:outline-none focus:border-accent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && topic.trim()) start();
              }}
              autoFocus
            />
          </label>
          <button
            onClick={start}
            disabled={!topic.trim() || !template}
            className="bg-accent text-white font-mono px-5 py-2.5 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20 disabled:cursor-not-allowed"
          >
            Start interview →
          </button>
        </section>
      )}

      {stage !== "intake" && (
        <div className="space-y-5">
          {turns.map((t, i) => (
            <TurnBlock key={i} turn={t} />
          ))}
          {streamBuf && (
            <TurnBlock
              turn={{ role: "assistant", content: streamBuf }}
              streaming
            />
          )}
          {stage === "interview" && !streamBuf && (
            <div className="text-sm text-ink/50 italic">thinking up questions…</div>
          )}
          {stage === "generating" && !streamBuf && (
            <div className="text-sm text-ink/50 italic">drafting the roadmap…</div>
          )}
        </div>
      )}

      {stage === "answering" && (
        <section className="bg-white border border-rule rounded-lg p-5 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-ink/60">
            Your answers
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer the questions above. Short and honest beats long and polished."
            rows={8}
            className="w-full border border-rule rounded p-3 font-serif text-[15px] bg-paper focus:outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submitAnswers}
              disabled={!answer.trim()}
              className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20 disabled:cursor-not-allowed"
            >
              Generate roadmap →
            </button>
            <button onClick={restart} className="text-sm underline text-ink/60 hover:text-ink">
              start over
            </button>
          </div>
        </section>
      )}

      {stage === "done" && (
        <section className="bg-accent/5 border border-accent/30 rounded-lg p-5 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-accent">
            ✓ Roadmap ready
          </div>
          <p className="text-[15px] text-ink-soft">
            Save it to <code className="font-mono text-accent">roadmaps/{slug}/roadmap.md</code>{" "}
            — either copy and paste, or save directly (dev mode only).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={copy}
              className="bg-ink text-paper font-mono px-4 py-2 rounded text-sm hover:bg-ink/80"
            >
              Copy roadmap
            </button>
            {canWriteLocally() && (
              <button
                onClick={save}
                disabled={!slug}
                className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20"
              >
                Save to repo
              </button>
            )}
            {slug && (
              <a
                href={`/topic?slug=${encodeURIComponent(slug)}`}
                className="text-sm underline text-accent hover:opacity-80"
              >
                open topic →
              </a>
            )}
            <button onClick={restart} className="text-sm underline text-ink/60 hover:text-ink">
              start over
            </button>
            {saveMsg && <span className="text-xs font-mono text-ink/60">{saveMsg}</span>}
          </div>
          {!canWriteLocally() && (
            <p className="text-xs text-ink/50 font-mono">
              In production, copy the output and commit manually. First: <code>python scripts/new_topic.py "{slug}"</code>
            </p>
          )}
        </section>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-3 rounded font-mono">
          {error}
        </div>
      )}
    </div>
  );
}

function TurnBlock({ turn, streaming }: { turn: Turn; streaming?: boolean }) {
  if (turn.role === "user") {
    return (
      <div className="border-l-2 border-ink/20 pl-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-ink/40 mb-1">
          you
        </div>
        <div className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">
          {turn.content}
        </div>
      </div>
    );
  }
  return (
    <div className="border-l-2 border-accent pl-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-accent mb-1">
        tutor {streaming && "(streaming…)"}
      </div>
      <article
        className={`prose max-w-none ${streaming ? "opacity-90" : ""}`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(turn.content) }}
      />
    </div>
  );
}

function StageIndicator({ stage }: { stage: Stage }) {
  const steps: { key: Stage | Stage[]; label: string }[] = [
    { key: "intake", label: "1 · topic" },
    { key: ["interview", "answering"], label: "2 · interview" },
    { key: "generating", label: "3 · generate" },
    { key: "done", label: "4 · done" },
  ];
  function isActive(key: Stage | Stage[]): boolean {
    return Array.isArray(key) ? key.includes(stage) : key === stage;
  }
  function isPast(idx: number): boolean {
    const order = ["intake", "interview", "answering", "generating", "done"] as const;
    return order.indexOf(stage) > (idx === 0 ? 0 : idx === 1 ? 2 : idx === 2 ? 3 : 4);
  }
  return (
    <ol className="flex items-center gap-3 text-xs font-mono text-ink/40">
      {steps.map((s, i) => {
        const active = isActive(s.key);
        const past = isPast(i);
        return (
          <li key={String(s.key)} className="flex items-center gap-3">
            <span
              className={
                active
                  ? "text-accent font-semibold"
                  : past
                    ? "text-ink"
                    : "text-ink/40"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-ink/20">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

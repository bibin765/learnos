import { useEffect, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { fetchText } from "../lib/github";
import { streamMessage } from "../lib/claude";
import { extractPromptBody, fillTemplate, renderMarkdown } from "../lib/markdown";
import { getApiKey, getBackend, getModel } from "../lib/storage";
import {
  deleteSession,
  getSession,
  relativeTime,
  saveSession,
  slugKey,
  type SavedSession,
} from "../lib/sessions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function SocraticChat() {
  const [template, setTemplate] = useState<string>("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [concept, setConcept] = useState<string>("");
  const [started, setStarted] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<string>("");
  const [streaming, setStreaming] = useState<boolean>(false);
  const [streamBuf, setStreamBuf] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const storageId = concept ? slugKey("socratic", concept) : "";

  useEffect(() => {
    fetchText("templates/socratic-tutor.md")
      .then((t) => setTemplate(extractPromptBody(t)))
      .catch((e: Error) => setTemplateError(e.message));

    const params = new URLSearchParams(window.location.search);
    const topic = params.get("concept") ?? params.get("topic");
    const resumeId = params.get("resume");
    if (resumeId) {
      const saved = getSession(resumeId);
      if (saved) {
        setConcept((saved.meta?.concept as string) ?? saved.title);
        setMessages(saved.turns);
        setSessionId(saved.sessionId);
        setResumedFrom(saved.updatedAt);
        setStarted(true);
        return;
      }
    }
    if (topic) setConcept(humanize(topic));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamBuf]);

  const systemPrompt = template ? fillTemplate(template, { CONCEPT: concept }) : "";

  async function send(userText: string) {
    const backend = getBackend();
    const apiKey = getApiKey() ?? undefined;
    if (backend === "api" && !apiKey) {
      setError("Paste an Anthropic API key in the bar at the top, or switch to CLI mode.");
      return;
    }
    setError(null);

    const next: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(next);
    setDraft("");
    setStreaming(true);
    setStreamBuf("");
    abortRef.current = new AbortController();

    let acc = "";
    const isFirst = sessionId === undefined;
    try {
      const apiMessages: Anthropic.MessageParam[] = next.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await streamMessage({
        apiKey,
        model: getModel(),
        system: systemPrompt,
        messages: apiMessages,
        onText: (delta) => {
          acc += delta;
          setStreamBuf(acc);
        },
        signal: abortRef.current.signal,
        sessionId,
        firstTurn: isFirst,
      });

      if (result.sessionId && !sessionId) setSessionId(result.sessionId);
      const finalMessages = [...next, { role: "assistant" as const, content: acc }];
      setMessages(finalMessages);
      setStreamBuf("");
      // Persist after each completed turn so a refresh can resume this exact spot.
      if (storageId) {
        saveSession({
          id: storageId,
          kind: "socratic",
          title: concept,
          subtitle: "Socratic session",
          turns: finalMessages,
          sessionId: result.sessionId ?? sessionId,
          meta: { concept },
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      } else if (acc) {
        setMessages((ms) => [...ms, { role: "assistant", content: acc + "\n\n_(interrupted)_" }]);
        setStreamBuf("");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function start() {
    if (!concept.trim()) return;
    // If a saved session for this concept exists, resume it silently.
    const existing = getSession(slugKey("socratic", concept));
    if (existing && existing.turns.length > 0) {
      setMessages(existing.turns);
      setSessionId(existing.sessionId);
      setResumedFrom(existing.updatedAt);
      setStarted(true);
      return;
    }
    setStarted(true);
    void send("Let's begin. Please ask me your opening question about this concept.");
  }

  function restart() {
    abortRef.current?.abort();
    if (storageId) deleteSession(storageId);
    setStarted(false);
    setMessages([]);
    setStreamBuf("");
    setError(null);
    setSessionId(undefined);
    setResumedFrom(null);
  }

  function stop() {
    abortRef.current?.abort();
  }

  if (templateError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-3 rounded font-mono">
        Couldn't load Socratic template: {templateError}
      </div>
    );
  }

  if (!started) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-serif text-3xl tracking-tight">Socratic tutor</h1>
          <p className="text-[15px] text-ink-soft mt-2 leading-relaxed">
            A first-principles guide that refuses to hand over answers. State a concept you want to
            pressure-test, then defend your current belief about it.
          </p>
        </header>
        <div>
          <label className="block text-xs font-mono text-ink/60 mb-1">
            Concept to pressure-test <span className="text-accent">*</span>
          </label>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g. why CAP theorem is often misapplied"
            className="w-full border border-ink/20 rounded px-3 py-2 font-mono text-sm bg-white"
            onKeyDown={(e) => {
              if (e.key === "Enter" && concept.trim()) start();
            }}
          />
        </div>
        <button
          onClick={start}
          disabled={!concept.trim()}
          className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20 disabled:cursor-not-allowed"
        >
          begin session →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">
            <span className="text-ink/50">Socratic —</span> {concept}
          </h1>
          <p className="text-xs text-ink/50 mt-1">
            Escape hatches: type{" "}
            <code className="font-mono text-accent bg-accent/5 px-1 py-0.5 rounded">direct answer please</code>{" "}
            or{" "}
            <code className="font-mono text-accent bg-accent/5 px-1 py-0.5 rounded">check my understanding</code>.
          </p>
        </div>
        <button onClick={restart} className="text-sm underline text-ink/60 hover:text-ink">
          restart
        </button>
      </div>

      {resumedFrom !== null && (
        <div className="text-xs font-mono text-accent/80 bg-accent/5 border border-accent/20 rounded px-3 py-2">
          ↻ Resumed from {relativeTime(resumedFrom)}. Your previous session is restored — keep going, or click restart to start fresh.
        </div>
      )}

      <div
        ref={scrollRef}
        className="border border-ink/10 rounded bg-white p-4 h-[60vh] overflow-y-auto space-y-4"
      >
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming && streamBuf && <Bubble role="assistant" content={streamBuf} streaming />}
        {streaming && !streamBuf && <div className="text-xs font-mono text-ink/40">thinking…</div>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-3 rounded font-mono">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your response…"
          rows={3}
          className="flex-1 border border-ink/20 rounded p-2 font-mono text-sm bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && draft.trim() && !streaming) {
              void send(draft);
            }
          }}
          disabled={streaming}
        />
        <div className="flex flex-col gap-2">
          {!streaming ? (
            <button
              onClick={() => draft.trim() && send(draft)}
              disabled={!draft.trim()}
              className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20 whitespace-nowrap"
            >
              send ⌘↵
            </button>
          ) : (
            <button
              onClick={stop}
              className="bg-ink/60 text-white font-mono px-4 py-2 rounded text-sm hover:bg-ink/80"
            >
              stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content, streaming }: { role: "user" | "assistant"; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser ? "bg-ink text-paper" : "bg-paper border border-ink/10"
        }`}
      >
        <div className="text-[10px] font-mono opacity-60 mb-1">{isUser ? "you" : "socrates"}</div>
        <article
          className={`prose max-w-none text-sm ${isUser ? "[&_*]:!text-paper [&_a]:!text-paper/80 [&_code]:!bg-paper/10 [&_code]:!text-paper" : ""} ${streaming ? "opacity-80" : ""}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      </div>
    </div>
  );
}

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

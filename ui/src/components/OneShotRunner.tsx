import { useEffect, useMemo, useRef, useState } from "react";
import { fetchText } from "../lib/github";
import { streamMessage } from "../lib/claude";
import { extractPromptBody, fillTemplate, renderMarkdown } from "../lib/markdown";
import { getApiKey, getBackend, getModel } from "../lib/storage";

interface FieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "textarea";
  rows?: number;
  required?: boolean;
}

interface Props {
  templatePath: string;
  fields: FieldSpec[];
  title: string;
  description: string;
}

export default function OneShotRunner({ templatePath, fields, title, description }: Props) {
  const [template, setTemplate] = useState<string>("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchText(templatePath)
      .then((t) => setTemplate(extractPromptBody(t)))
      .catch((e: Error) => setTemplateError(e.message));
  }, [templatePath]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topic = params.get("topic");
    const concept = params.get("concept");
    const initial: Record<string, string> = {};
    for (const f of fields) {
      if (f.key === "TOPIC" && topic) initial[f.key] = humanize(topic);
      if (f.key === "CONCEPT" && (concept || topic)) initial[f.key] = concept ?? humanize(topic || "");
    }
    if (Object.keys(initial).length > 0) setValues((v) => ({ ...v, ...initial }));
  }, [fields]);

  const canRun = useMemo(() => {
    if (!template) return false;
    return fields.every((f) => !f.required || (values[f.key] && values[f.key].trim()));
  }, [fields, values, template]);

  function setField(key: string, val: string) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function run() {
    const backend = getBackend();
    const apiKey = getApiKey() ?? undefined;
    if (backend === "api" && !apiKey) {
      setError("Paste an Anthropic API key in the bar at the top, or switch to CLI mode.");
      return;
    }
    setError(null);
    setOutput("");
    setRunning(true);
    abortRef.current = new AbortController();

    try {
      const system =
        "You are an expert writing assistant. Follow the user's prompt exactly and return only the requested output — no preamble, no closing remarks.";
      let userPrompt = fillTemplate(template, values);
      // Feynman template: append the user's explanation under the delimiter the
      // template's protocol expects, since extractPromptBody trims past the delimiter.
      if (values.EXPLANATION && !template.includes("{{EXPLANATION}}")) {
        userPrompt += `\n\n---EXPLANATION---\n\n${values.EXPLANATION.trim()}\n`;
      }
      await streamMessage({
        apiKey,
        model: getModel(),
        system,
        messages: [{ role: "user", content: userPrompt }],
        onText: (delta) => setOutput((o) => o + delta),
        signal: abortRef.current.signal,
        firstTurn: true,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function copy() {
    navigator.clipboard.writeText(output);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-mono">{title}</h1>
        <p className="text-sm text-ink/60 mt-1">{description}</p>
      </div>

      {templateError && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-3 rounded font-mono">
          Couldn't load template: {templateError}
        </div>
      )}

      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-mono text-ink/60 mb-1">
              {f.label} {f.required && <span className="text-accent">*</span>}
            </label>
            {f.type === "textarea" ? (
              <textarea
                value={values[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={f.rows ?? 6}
                className="w-full border border-ink/20 rounded p-2 font-mono text-sm bg-white"
              />
            ) : (
              <input
                type="text"
                value={values[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-ink/20 rounded px-3 py-2 font-mono text-sm bg-white"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {!running ? (
          <button
            onClick={run}
            disabled={!canRun}
            className="bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90 disabled:bg-ink/20 disabled:cursor-not-allowed"
          >
            run →
          </button>
        ) : (
          <button
            onClick={stop}
            className="bg-ink/60 text-white font-mono px-4 py-2 rounded text-sm hover:bg-ink/80"
          >
            stop
          </button>
        )}
        {output && !running && (
          <button onClick={copy} className="text-sm underline text-ink/60 hover:text-ink">
            copy output
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-3 rounded font-mono">
          {error}
        </div>
      )}

      {(running || output) && (
        <div className="border-t border-ink/10 pt-6">
          <div className="text-xs font-mono text-ink/50 mb-2">Output {running && "(streaming…)"}</div>
          <article
            className="prose prose-stone max-w-none prose-headings:font-mono prose-code:font-mono prose-code:text-accent"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(output || "_…_") }}
          />
        </div>
      )}
    </div>
  );
}

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

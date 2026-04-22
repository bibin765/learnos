import { useEffect, useState } from "react";
import MarkdownView from "./MarkdownView";

type Tab = "roadmap" | "log";

export default function TopicDetail() {
  const [slug, setSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roadmap");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlug(params.get("slug"));
  }, []);

  if (!slug) {
    return (
      <div className="font-mono text-sm text-ink/60">
        No topic selected. <a href="/" className="underline text-accent">Back to dashboard</a>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-mono">{humanize(slug)}</h1>
        <a href="/" className="text-sm underline text-ink/60 hover:text-ink">← dashboard</a>
      </div>

      <div className="flex gap-1 border-b border-ink/10">
        <button
          onClick={() => setTab("roadmap")}
          className={`px-4 py-2 text-sm font-mono border-b-2 -mb-px transition-colors ${
            tab === "roadmap" ? "border-accent text-ink" : "border-transparent text-ink/50 hover:text-ink"
          }`}
        >
          roadmap.md
        </button>
        <button
          onClick={() => setTab("log")}
          className={`px-4 py-2 text-sm font-mono border-b-2 -mb-px transition-colors ${
            tab === "log" ? "border-accent text-ink" : "border-transparent text-ink/50 hover:text-ink"
          }`}
        >
          progress_log.md
        </button>
      </div>

      {tab === "roadmap" && <MarkdownView path={`roadmaps/${slug}/roadmap.md`} />}
      {tab === "log" && <MarkdownView path={`roadmaps/${slug}/progress_log.md`} />}

      <div className="pt-6 border-t border-ink/10 mt-6 flex flex-wrap gap-3 text-sm">
        <span className="font-mono text-ink/60">Run a template on this topic:</span>
        <a href={`/templates/socratic?topic=${slug}`} className="underline text-accent">Socratic tutor</a>
        <a href={`/templates/feynman?topic=${slug}`} className="underline text-accent">Feynman check</a>
        <a href={`/templates/roadmap-gen?topic=${slug}`} className="underline text-accent">Roadmap regen</a>
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

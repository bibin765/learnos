import { useEffect, useState } from "react";
import RoadmapWeeks from "./RoadmapWeeks";
import ProgressTimeline from "./ProgressTimeline";

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function TopicDetail() {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlug(params.get("slug"));
  }, []);

  if (!slug) {
    return (
      <div className="text-sm text-ink/60">
        No topic selected.{" "}
        <a href="/" className="underline text-accent">
          Back to dashboard
        </a>
        .
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <a href="/" className="text-xs font-mono text-ink/50 hover:text-ink">
          ← dashboard
        </a>
        <h1 className="font-serif text-4xl tracking-tight">{humanize(slug)}</h1>
        <div className="text-xs font-mono text-ink/50">
          roadmaps/{slug}/
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_300px] gap-10">
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink/60 mb-4">
            Roadmap — 4 weeks, primary sources, built artifacts
          </h2>
          <RoadmapWeeks slug={slug} />
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-2">
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink/60 mb-4">
            Progress log
          </h2>
          <ProgressTimeline slug={slug} />
        </aside>
      </div>
    </div>
  );
}

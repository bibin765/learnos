import { useEffect, useState } from "react";
import RoadmapWeeks from "./RoadmapWeeks";
import NodeList from "./NodeList";
import ProgressTimeline from "./ProgressTimeline";
import { loadNodeRoadmap, type NodeRoadmap } from "../lib/nodes";

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function TopicDetail() {
  const [slug, setSlug] = useState<string | null>(null);
  const [graph, setGraph] = useState<NodeRoadmap | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("slug");
    setSlug(s);
    if (!s) {
      setLoaded(true);
      return;
    }
    loadNodeRoadmap(s)
      .then((g) => setGraph(g))
      .finally(() => setLoaded(true));
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

  const title = graph?.topic ?? humanize(slug);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <a href="/" className="text-xs font-mono text-ink/50 hover:text-ink">
          ← dashboard
        </a>
        <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
        <div className="text-xs font-mono text-ink/50">
          roadmaps/{slug}/
          {graph && (
            <span className="ml-2 text-accent">· story-graph ({graph.nodes.length} nodes)</span>
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_300px] gap-10">
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink/60 mb-5">
            {graph ? "Node graph — each node is a story" : "Roadmap — 4 weeks, primary sources"}
          </h2>
          {!loaded && <div className="text-sm text-ink/50">loading…</div>}
          {loaded && graph && <NodeList slug={slug} roadmap={graph} />}
          {loaded && !graph && <RoadmapWeeks slug={slug} />}
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

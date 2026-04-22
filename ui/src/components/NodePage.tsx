import { useEffect, useState } from "react";
import {
  getNode,
  loadNodeRoadmap,
  prereqTitles,
  type NodeRoadmap,
  type RoadmapNode,
} from "../lib/nodes";
import { getStudy, PHASES, studyKey, STUDY_EVENT, type StudyState } from "../lib/study";

export default function NodePage() {
  const [slug, setSlug] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<NodeRoadmap | null>(null);
  const [study, setStudy] = useState<StudyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("topic");
    const id = params.get("id");
    if (!s || !id) {
      setError("Missing ?topic= or ?id=");
      setLoading(false);
      return;
    }
    setSlug(s);
    setNodeId(id);

    loadNodeRoadmap(s)
      .then((g) => {
        if (!g) {
          setError(`No roadmap.json found for ${s}. This page only works for story-graph roadmaps.`);
          return;
        }
        setRoadmap(g);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!slug || !nodeId) return;
    function refresh() {
      setStudy(getStudy(studyKey(slug!, nodeId!)));
    }
    refresh();
    window.addEventListener(STUDY_EVENT, refresh);
    return () => window.removeEventListener(STUDY_EVENT, refresh);
  }, [slug, nodeId]);

  if (loading) return <div className="text-sm text-ink/50">loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-4 rounded">
        {error}{" "}
        {slug && (
          <a href={`/topic?slug=${slug}`} className="underline">
            back to topic
          </a>
        )}
      </div>
    );
  if (!roadmap || !nodeId || !slug) return null;

  const node = getNode(roadmap, nodeId);
  if (!node) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-900 text-sm p-4 rounded">
        Node <code>{nodeId}</code> not found in roadmap.{" "}
        <a href={`/topic?slug=${slug}`} className="underline">
          back to topic
        </a>
      </div>
    );
  }

  const chapter = roadmap.chapters.find((c) => c.id === node.chapter);
  const prereqs = prereqTitles(roadmap, node);
  const phaseCount = study
    ? PHASES.reduce((n, p) => n + (study.phases[p] ? 1 : 0), 0)
    : 0;

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <nav className="text-xs font-mono text-ink/50 flex items-center gap-2 flex-wrap">
          <a href={`/topic?slug=${slug}`} className="hover:text-ink">
            ← {roadmap.topic}
          </a>
          {chapter && (
            <>
              <span>/</span>
              <span>{chapter.title}</span>
            </>
          )}
        </nav>

        <h1 className="font-serif text-4xl tracking-tight leading-tight">{node.title}</h1>

        {prereqs.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-ink/60 flex-wrap pt-1">
            <span className="font-mono uppercase tracking-widest text-ink/40">Requires</span>
            {node.prerequisites.map((pid) => {
              const title = roadmap.nodes.find((n) => n.id === pid)?.title ?? pid;
              return (
                <a
                  key={pid}
                  href={`/node?topic=${slug}&id=${pid}`}
                  className="bg-white border border-rule rounded px-2 py-1 hover:border-accent hover:text-accent transition-colors font-mono"
                >
                  {title}
                </a>
              );
            })}
          </div>
        )}
      </header>

      {/* The three story beats — the heart of the node */}
      <section className="space-y-5">
        <StoryBeat label="The knot" index="01" body={node.story.knot} />
        <StoryBeat label="The move" index="02" body={node.story.move} accent />
        <StoryBeat label="The handle" index="03" body={node.story.handle} compact />
      </section>

      {/* Action row */}
      <section className="bg-white border border-accent/30 rounded-lg p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/study?slug=${slug}&node=${node.id}`}
            className="bg-accent text-white font-mono px-5 py-2.5 rounded text-sm hover:bg-accent/90"
          >
            {phaseCount > 0 ? `Continue studying (${phaseCount}/4)` : "Start studying this node"} →
          </a>
          <span className="flex items-center gap-1.5" title={`${phaseCount} of 4 phases done`}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${i < phaseCount ? "bg-accent" : "bg-ink/15"}`}
              />
            ))}
          </span>
        </div>
        <p className="text-xs text-ink-soft">
          Study mode walks the 4-phase loop: prime → read → explain → defend.
        </p>
      </section>

      {/* Sources */}
      {node.sources.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink/60">
            ⊚ Primary sources
          </h2>
          <ul className="space-y-2">
            {node.sources.map((s, i) => (
              <SourceRow key={i} source={s} />
            ))}
          </ul>
        </section>
      )}

      {/* Feynman */}
      <section>
        <div className="bg-accent/5 border-l-2 border-accent/60 px-4 py-3 rounded-r">
          <div className="text-[11px] uppercase tracking-widest text-accent/80 font-mono mb-1">
            ? feynman checkpoint
          </div>
          <div className="font-serif text-[15px] italic leading-relaxed">{node.feynman}</div>
        </div>
      </section>

      {node.build && (
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink/60 mb-2">
            ▲ Build
          </h2>
          <p className="text-[15px] leading-relaxed">{node.build}</p>
        </section>
      )}

      {node.traps && node.traps.length > 0 && (
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-ink/60 mb-2">
            ⚠ Common traps
          </h2>
          <ul className="space-y-1 list-disc list-inside text-[15px] text-ink-soft">
            {node.traps.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function StoryBeat({
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
    <div
      className={`bg-white border rounded-lg p-5 ${
        accent ? "border-accent/40" : "border-rule"
      }`}
    >
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-xs text-accent tabular-nums">{index}</span>
        <h3 className="font-mono text-xs uppercase tracking-widest text-ink/60">{label}</h3>
      </div>
      <p
        className={`font-serif ${compact ? "text-lg italic" : "text-[16px]"} leading-relaxed text-ink`}
      >
        {body}
      </p>
    </div>
  );
}

function SourceRow({ source }: { source: { ref: string; kind?: string } }) {
  const scholar = `https://scholar.google.com/scholar?q=${encodeURIComponent(source.ref)}`;
  const google = `https://www.google.com/search?q=${encodeURIComponent(source.ref)}`;
  return (
    <li className="bg-white border border-rule rounded p-3 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        {source.kind && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40 mr-2">
            {source.kind}
          </span>
        )}
        <span className="text-[14px]">{source.ref}</span>
      </div>
      <div className="flex gap-3 shrink-0 text-xs font-mono pt-0.5">
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

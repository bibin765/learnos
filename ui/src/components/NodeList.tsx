import { useEffect, useState } from "react";
import { type NodeRoadmap, type RoadmapNode, nodesByChapter, prereqTitles } from "../lib/nodes";
import { getStudy, studyKey, STUDY_EVENT, PHASES, type StudyState } from "../lib/study";

export default function NodeList({ slug, roadmap }: { slug: string; roadmap: NodeRoadmap }) {
  const byCh = nodesByChapter(roadmap);
  const [studyMap, setStudyMap] = useState<Record<string, StudyState | null>>({});

  useEffect(() => {
    function refresh() {
      const map: Record<string, StudyState | null> = {};
      for (const n of roadmap.nodes) {
        map[n.id] = getStudy(studyKey(slug, n.id));
      }
      setStudyMap(map);
    }
    refresh();
    window.addEventListener(STUDY_EVENT, refresh);
    return () => window.removeEventListener(STUDY_EVENT, refresh);
  }, [slug, roadmap]);

  return (
    <div className="space-y-12">
      {roadmap.preamble && (
        <div className="text-[15px] text-ink-soft italic border-l-2 border-accent/40 pl-4 leading-relaxed">
          {roadmap.preamble}
        </div>
      )}

      {roadmap.chapters.map((ch, chIdx) => {
        const nodes = byCh.get(ch.id) ?? [];
        if (nodes.length === 0) return null;
        return (
          <section key={ch.id} className="space-y-4">
            <header className="flex items-baseline gap-3 flex-wrap">
              <span className="font-mono text-sm text-accent tabular-nums shrink-0">
                Chapter {chIdx + 1}
              </span>
              <h3 className="font-serif text-2xl leading-snug">{ch.title}</h3>
            </header>
            {ch.description && (
              <p className="text-sm text-ink-soft italic max-w-2xl">{ch.description}</p>
            )}
            <ol className="space-y-3">
              {nodes.map((n) => (
                <NodeCard
                  key={n.id}
                  slug={slug}
                  node={n}
                  roadmap={roadmap}
                  study={studyMap[n.id]}
                />
              ))}
            </ol>
          </section>
        );
      })}

      {roadmap.mastery.length > 0 && (
        <section className="mt-8 pt-6 border-t border-rule">
          <h3 className="text-xs font-mono uppercase tracking-widest text-ink/60 mb-3">
            Mastery signals — behaviors that prove you've internalized this topic
          </h3>
          <ol className="space-y-2 list-none pl-0">
            {roadmap.mastery.map((m, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="font-mono text-ink/40 tabular-nums shrink-0">0{i + 1}</span>
                <span>{m}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function NodeCard({
  slug,
  node,
  roadmap,
  study,
}: {
  slug: string;
  node: RoadmapNode;
  roadmap: NodeRoadmap;
  study: StudyState | null | undefined;
}) {
  const prereqs = prereqTitles(roadmap, node);
  const phaseCount = study
    ? PHASES.reduce((n, p) => n + (study.phases[p] ? 1 : 0), 0)
    : 0;

  return (
    <li>
      <a
        href={`/node?topic=${encodeURIComponent(slug)}&id=${encodeURIComponent(node.id)}`}
        className="group block bg-white border border-rule rounded-lg p-5 hover:border-accent hover:shadow-sm transition-all"
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {prereqs.length > 0 && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">
                  after {prereqs.join(" + ")}
                </span>
              )}
            </div>
            <h4 className="font-serif text-lg leading-snug">{node.title}</h4>
            <p className="text-[14px] text-ink-soft mt-2 leading-relaxed line-clamp-2">
              {node.story.handle}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ProgressDots count={phaseCount} />
            <span className="text-xs font-mono text-ink/40 group-hover:text-accent transition-colors">
              {phaseCount > 0 ? `${phaseCount}/4` : "open →"}
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}

function ProgressDots({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1" title={`${count} of 4 phases done`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < count ? "bg-accent" : "bg-ink/15"}`}
        />
      ))}
    </span>
  );
}

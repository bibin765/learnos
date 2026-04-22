import { useEffect, useState } from "react";
import { fetchText } from "../lib/github";
import { parseRoadmap, type Week } from "../lib/parseContent";
import { getStudy, studyKey, STUDY_EVENT, PHASES, type StudyState } from "../lib/study";
import Md from "./Md";

const SECTION_ORDER = ["Outcome", "Core concepts", "Build", "Feynman checkpoint", "Common traps"];

function sectionOrder(label: string): number {
  const idx = SECTION_ORDER.findIndex((s) => label.toLowerCase().startsWith(s.toLowerCase()));
  return idx === -1 ? 99 : idx;
}

function sectionIcon(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith("outcome")) return "◎";
  if (l.startsWith("core concept")) return "⊚";
  if (l.startsWith("build")) return "▲";
  if (l.startsWith("feynman")) return "?";
  if (l.startsWith("common trap")) return "⚠";
  return "•";
}

interface Props {
  slug: string;
}

export default function RoadmapWeeks({ slug }: Props) {
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [mastery, setMastery] = useState<string[]>([]);
  const [preamble, setPreamble] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchText(`roadmaps/${slug}/roadmap.md`)
      .then((md) => {
        const parsed = parseRoadmap(md);
        setWeeks(parsed.weeks);
        setMastery(parsed.masterySignal);
        setPreamble(parsed.preamble ?? "");
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) return <div className="text-sm text-red-700 font-mono">error: {error}</div>;
  if (weeks === null) return <div className="text-sm text-ink/50">loading roadmap…</div>;
  if (weeks.length === 0) {
    return (
      <div className="text-sm text-ink/60 rounded border border-rule bg-white p-6">
        No weeks parsed from this roadmap. <a href={`/_local/roadmaps/${slug}/roadmap.md`} target="_blank" className="text-accent underline">View raw</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {preamble && (
        <div className="text-sm text-ink-soft italic border-l-2 border-accent/40 pl-4">
          <Md text={preamble} />
        </div>
      )}

      <ol className="space-y-4">
        {weeks.map((w, i) => (
          <WeekCard key={w.number} week={w} defaultOpen={i === 0} slug={slug} />
        ))}
      </ol>

      {mastery.length > 0 && (
        <section className="mt-8 pt-6 border-t border-rule">
          <h3 className="text-xs font-mono uppercase tracking-wider text-ink/60 mb-3">
            Mastery signals — behaviors that prove you've internalized the topic
          </h3>
          <ol className="space-y-2 list-none pl-0">
            {mastery.map((m, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                <span className="font-mono text-ink/40 tabular-nums shrink-0">0{i + 1}</span>
                <span><Md text={m} /></span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function WeekCard({ week, defaultOpen, slug }: { week: Week; defaultOpen: boolean; slug: string }) {
  const sorted = [...week.sections].sort(
    (a, b) => sectionOrder(a.label) - sectionOrder(b.label),
  );
  const outcome = sorted.find((s) => s.label.toLowerCase().startsWith("outcome"));
  const rest = sorted.filter((s) => s !== outcome);
  const feynman = rest.find((s) => s.label.toLowerCase().startsWith("feynman"));

  const [study, setStudy] = useState<StudyState | null>(() =>
    getStudy(studyKey(slug, week.number)),
  );

  useEffect(() => {
    function refresh() {
      setStudy(getStudy(studyKey(slug, week.number)));
    }
    refresh();
    window.addEventListener(STUDY_EVENT, refresh);
    return () => window.removeEventListener(STUDY_EVENT, refresh);
  }, [slug, week.number]);

  const phaseCount = study
    ? PHASES.reduce((n, p) => n + (study.phases[p] ? 1 : 0), 0)
    : 0;

  return (
    <li>
      <details open={defaultOpen} className="group bg-white border border-rule rounded-lg open:shadow-sm transition-shadow">
        <summary className="flex items-baseline gap-4 cursor-pointer px-6 py-4 list-none select-none">
          <span className="font-mono text-sm text-accent tabular-nums shrink-0">
            Week {week.number}
          </span>
          <span className="flex-1 font-serif text-lg leading-snug">{week.theme}</span>
          <ProgressDots count={phaseCount} />
          <span className="text-ink/30 text-xs font-mono group-open:rotate-90 transition-transform">▸</span>
        </summary>

        <div className="px-6 pb-6 space-y-5 border-t border-rule/50">
          <div className="pt-4">
            <a
              href={`/study?slug=${slug}&week=${week.number}`}
              className="inline-flex items-center gap-2 bg-accent text-white font-mono px-4 py-2 rounded text-sm hover:bg-accent/90"
            >
              {phaseCount > 0 ? `Continue studying (${phaseCount}/4)` : "Start studying this week"} →
            </a>
          </div>

          {outcome && (
            <div className="pt-4">
              <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono mb-1">
                {sectionIcon(outcome.label)} outcome
              </div>
              <div className="text-ink font-serif text-base leading-relaxed">
                <Md text={outcome.body} />
              </div>
            </div>
          )}

          {rest.filter((s) => s !== feynman).map((s) => (
            <div key={s.label}>
              <div className="text-[11px] uppercase tracking-widest text-ink/50 font-mono mb-2">
                {sectionIcon(s.label)} {s.label.toLowerCase()}
              </div>
              <div className="text-[15px] leading-relaxed"><Md text={s.body} /></div>
            </div>
          ))}

          {feynman && (
            <div className="bg-accent/5 border-l-2 border-accent/60 px-4 py-3 rounded-r">
              <div className="text-[11px] uppercase tracking-widest text-accent/80 font-mono mb-1">
                ? feynman checkpoint
              </div>
              <div className="text-[15px] italic leading-relaxed">
                <Md text={feynman.body} />
              </div>
              <div className="mt-3 flex gap-3 text-xs">
                <a
                  href={`/templates/socratic?concept=${encodeURIComponent(week.theme)}&topic=${slug}`}
                  className="text-accent underline hover:opacity-80"
                >
                  → pressure-test with Socratic tutor
                </a>
                <a
                  href={`/templates/feynman?concept=${encodeURIComponent(week.theme)}&topic=${slug}`}
                  className="text-accent underline hover:opacity-80"
                >
                  → run Feynman audit
                </a>
              </div>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function ProgressDots({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1 shrink-0" title={`${count} of 4 phases done`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < count ? "bg-accent" : "bg-ink/15"}`}
        />
      ))}
    </span>
  );
}

import { useEffect, useState } from "react";
import { listTopics, type Topic, repoConfigured, repoInfo } from "../lib/github";

const TEMPLATES = [
  {
    slug: "roadmap-gen",
    title: "Roadmap",
    tag: "one-shot",
    tagline: "Generate a 4-week plan for any topic",
    when: "When you pick a new topic. Output goes into roadmaps/<topic>/roadmap.md.",
    cta: "Generate a roadmap",
    icon: "▦",
  },
  {
    slug: "socratic",
    title: "Socratic",
    tag: "multi-turn",
    tagline: "Pressure-test a concept by dialogue",
    when: "When something feels vaguely clear but you can't defend it. Refuses to hand over answers.",
    cta: "Start a session",
    icon: "?",
  },
  {
    slug: "feynman",
    title: "Feynman",
    tag: "one-shot",
    tagline: "Audit your own plain-language explanation",
    when: "When you think you get it. Writes a gap report over your explanation.",
    cta: "Run an audit",
    icon: "◎",
  },
] as const;

export default function Dashboard() {
  return (
    <div className="space-y-14">
      <HeroAndTemplates />
      <CurriculumSection />
      <HowItWorks />
    </div>
  );
}

function HeroAndTemplates() {
  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <div className="text-xs font-mono uppercase tracking-widest text-accent">
          Personal Learning OS
        </div>
        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight max-w-2xl">
          Learning-as-code.
        </h1>
        <p className="text-lg text-ink-soft max-w-2xl leading-relaxed">
          Pick a topic. Defend your mental model. Ship an artifact.
          <br />
          Three LLM templates turn vague familiarity into real understanding.
        </p>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => (
          <a
            key={t.slug}
            href={`/templates/${t.slug}`}
            className="group relative bg-white border border-rule rounded-lg p-5 hover:border-accent hover:shadow-md transition-all flex flex-col"
          >
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-serif text-accent">{t.icon}</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">
                {t.tag}
              </span>
            </div>
            <h3 className="font-serif text-xl mb-1">{t.title}</h3>
            <p className="text-sm text-ink-soft mb-3">{t.tagline}</p>
            <p className="text-xs text-ink/55 leading-relaxed mb-4 flex-1">{t.when}</p>
            <div className="text-sm text-accent font-mono group-hover:translate-x-0.5 transition-transform">
              {t.cta} →
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function CurriculumSection() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoConfigured()) {
      setError("Configure PUBLIC_GITHUB_OWNER / PUBLIC_GITHUB_REPO in .env — see .env.example.");
      setTopics([]);
      return;
    }
    listTopics()
      .then(setTopics)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Your curriculum</h2>
        <span className="text-xs font-mono text-ink/40">
          {repoInfo.owner}/{repoInfo.repo}@{repoInfo.branch}
        </span>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 rounded">
          {error}
        </div>
      )}

      {topics === null && !error && (
        <div className="text-sm text-ink/50">loading topics…</div>
      )}

      {topics && topics.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {topics.map((t) => (
            <a
              key={t.slug}
              href={`/topic?slug=${encodeURIComponent(t.slug)}`}
              className="group bg-white border border-rule rounded-lg p-4 hover:border-accent hover:shadow-sm transition-all"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif text-lg">{t.title}</h3>
                <span className="text-xs font-mono text-ink/40 group-hover:text-accent transition-colors">
                  open →
                </span>
              </div>
              <div className="text-xs font-mono text-ink/40 mt-1">roadmaps/{t.slug}/</div>
            </a>
          ))}
        </div>
      )}

      {topics && topics.length === 0 && !error && (
        <div className="bg-white border border-rule border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-ink-soft mb-3">No topics yet.</p>
          <code className="inline-block bg-ink text-paper px-3 py-1.5 rounded font-mono text-xs">
            python scripts/new_topic.py "&lt;topic-name&gt;"
          </code>
        </div>
      )}

      {topics && topics.length > 0 && (
        <div className="text-xs text-ink/50">
          Start a new topic:{" "}
          <code className="font-mono text-ink/70">
            python scripts/new_topic.py "&lt;name&gt;"
          </code>
        </div>
      )}
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-t border-rule pt-10 space-y-6">
      <h2 className="font-serif text-2xl">How to use this</h2>

      <ol className="space-y-4">
        {[
          {
            n: "01",
            title: "Start a topic",
            body: "Run scripts/new_topic.py to scaffold a folder, then use the Roadmap template above to generate a 4-week plan. Save the output to roadmaps/<topic>/roadmap.md.",
          },
          {
            n: "02",
            title: "Read primary sources, not aggregators",
            body: "Each week names 3–5 canonical sources. Work through them in order. Log short entries to progress_log.md as you go — what clicked, what broke, what's next.",
          },
          {
            n: "03",
            title: "Pressure-test with Socratic",
            body: "Pick the concept you feel least solid on. The tutor will refuse to hand over answers — let it grill you until your mental model has fewer cracks.",
          },
          {
            n: "04",
            title: "Audit with Feynman",
            body: "Write 200–400 words explaining the concept to a smart 14-year-old, no jargon. The auditor classifies every sentence and produces a gap report.",
          },
          {
            n: "05",
            title: "Ship an artifact",
            body: "Each week has a build: a repo, a diagram, an essay, a demo. Without a shipped artifact, the week doesn't count. If it's not in git, it didn't happen.",
          },
        ].map((step) => (
          <li key={step.n} className="flex gap-5">
            <div className="font-mono text-accent tabular-nums text-sm pt-0.5 shrink-0 w-8">
              {step.n}
            </div>
            <div>
              <h3 className="font-serif text-lg leading-snug">{step.title}</h3>
              <p className="text-[15px] text-ink-soft leading-relaxed mt-1">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <details className="pt-2">
        <summary className="cursor-pointer text-sm font-mono text-ink/60 hover:text-ink list-none">
          <span className="group-open:rotate-90 inline-block transition-transform">▸</span> The
          learning manifesto
        </summary>
        <div className="mt-4 space-y-3 text-[15px] text-ink-soft leading-relaxed pl-4 border-l border-rule">
          <p>
            <strong className="text-ink font-serif">Learning is shipped, not consumed.</strong> A
            tutorial watched is not a skill owned.
          </p>
          <p>
            <strong className="text-ink font-serif">Depth over surface area.</strong> Four topics
            learned deeply in a year beat forty skimmed.
          </p>
          <p>
            <strong className="text-ink font-serif">First principles or bust.</strong> If your
            explanation bottoms out in jargon, you don't understand it.
          </p>
          <p>
            <strong className="text-ink font-serif">The Feynman test is the only test.</strong>{" "}
            You know a concept when you can teach it to a sharp 14-year-old with no jargon.
          </p>
          <p>
            <strong className="text-ink font-serif">Struggle is the signal.</strong> The
            uncomfortable concept is the high-leverage one.
          </p>
          <p>
            <strong className="text-ink font-serif">Respect the schedule, not the mood.</strong>{" "}
            Motivation is weather; systems are climate.
          </p>
        </div>
      </details>
    </section>
  );
}

# Personal Learning OS

> **Learning-as-Code.** Curricula are not bookmarks — they are versioned, reproducible artifacts you build, review, and refactor like production code.

This repository is the operating system for deliberate technical learning. Every topic is a folder. Every roadmap is a markdown file under version control. Every prompt is a reusable template. Every milestone is a tracked issue.

If it isn't in git, it didn't happen.

---

## Curriculum Status

| Topic | Status | Started | Target End | Week | Feynman Pass? |
| --- | --- | --- | --- | --- | --- |
| _(none yet — run `python scripts/new_topic.py <topic>`)_ | — | — | — | — | — |

**Status legend:** 🟢 Active · ⏸ Paused · ✅ Shipped · 🗄 Archived

Update this table whenever a topic changes state. It is the single source of truth for what you are actively learning.

---

## Repository Layout

```
.
├── templates/              # Reusable LLM prompt markdown — do not modify per-topic
│   ├── roadmap-gen.md      # C.R.E.A.T.E.-framework 4-week roadmap generator
│   ├── socratic-tutor.md   # First-principles Socratic guide
│   └── feynman-check.md    # Explanation auditor — exposes knowledge gaps
├── roadmaps/               # One folder per topic, created by scripts/new_topic.py
│   └── <topic>/
│       ├── roadmap.md           # Generated from templates/roadmap-gen.md
│       ├── progress_log.md      # Dated entries, one per study session
│       └── roadmap-gen.md       # Working copy of the generator for iteration
├── scripts/
│   └── new_topic.py        # Bootstraps a new topic folder
└── .github/ISSUE_TEMPLATE/
    └── learning-milestone.md   # Definition-of-Done checklist per module
```

---

## How to use the templates

### 1. Generate a roadmap

```bash
python scripts/new_topic.py "rust-async-runtimes"
```

This creates `roadmaps/rust-async-runtimes/` with three starter files. Open `roadmap-gen.md`, replace `{{TOPIC}}` with your topic, paste the prompt into your LLM, and save the output to `roadmap.md`.

### 2. Learn by dialogue, not by reading

For each week's concepts, open `templates/socratic-tutor.md`, fill in `{{CONCEPT}}`, and start a session. The tutor will refuse to hand over answers — that is the point. Log insights in `progress_log.md`.

### 3. Audit your own understanding

Before marking a concept "done," write a plain-language explanation and run it through `templates/feynman-check.md`. The output will give you a gap table. If the Gap Report surfaces fewer than 2 real gaps, you probably wrote too little — extend and re-run.

### 4. Track milestones in GitHub

Every learning module closes with an issue filed from `.github/ISSUE_TEMPLATE/learning-milestone.md`. The Definition of Done is non-negotiable: no milestone is complete until every box is ticked.

---

## Learning Manifesto

1. **Learning is shipped, not consumed.** A tutorial watched is not a skill owned. Close every module with a built artifact — a repo, a PR, a demo, a write-up. If there is nothing to link, nothing was learned.

2. **Depth over surface area.** Four topics learned deeply in a year beat forty skimmed. Mastery compounds; familiarity decays.

3. **First principles or bust.** If your explanation bottoms out in jargon, you do not understand it. Every concept must reduce to physics, math, information theory, resource constraints, or human behavior.

4. **The Feynman test is the only test.** You know a concept when you can teach it to a sharp 14-year-old with no jargon. Anything less is recognition, not understanding.

5. **Struggle is the signal.** The uncomfortable concept is the high-leverage one. When a topic feels easy, you are either past it or avoiding its hard center.

6. **Primary sources over aggregators.** Official docs, original papers, the one canonical book. Tutorials are snacks; primary sources are meals.

7. **Version everything.** Roadmaps, notes, dead ends, wrong models. The graveyard of rejected ideas is where the best intuitions are buried.

8. **Teach to close the loop.** A concept is not yours until you have explained it to another human — in a PR review, a blog post, a talk, a whiteboard session. The listener's confusion is your diagnostic.

9. **Respect the schedule, not the mood.** Motivation is weather; systems are climate. Show up on the scheduled day, even for 20 minutes.

10. **Retire ruthlessly.** If a topic no longer serves your trajectory, archive it without guilt. Learning debt is real debt.

---

## Quick commands

```bash
# Start a new topic
python scripts/new_topic.py "<kebab-case-topic>"

# Open the curriculum dashboard (this file)
$EDITOR README.md

# List active topics
ls roadmaps/
```

---

_This repository is a personal system. Fork it, strip it, rebuild it to fit your own learning style. The templates are opinions, not commandments._

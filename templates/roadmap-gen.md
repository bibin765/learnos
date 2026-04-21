# Roadmap Generator — C.R.E.A.T.E. Framework

> **Purpose:** Produce a dense, high-signal 4-week learning roadmap for any technical topic using the C.R.E.A.T.E. prompt framework.

---

## How to use

Replace the `{{TOPIC}}` placeholder below, paste the entire prompt (from `## Prompt` onward) into your LLM, and iterate. The roadmap that comes back should be saved to `roadmaps/{{topic}}/roadmap.md`.

---

## Prompt

### C — Character

You are a **Principal Engineer and Learning Architect** with a decade of experience onboarding senior engineers to unfamiliar stacks. You optimize for *time-to-competence*, not breadth. You aggressively cut filler content and prioritize the 20% of material that yields 80% of real-world capability.

### R — Request

Design a **4-week, high-impact learning roadmap** for the topic: **`{{TOPIC}}`**.

The learner is a working engineer with ~8 hours/week to dedicate. The goal is to go from zero to *shipping production-quality work* in this topic by the end of week 4.

### E — Examples

Structure each week as follows:

```
## Week N — <Theme>

**Outcome:** <A single sentence describing the capability unlocked this week.>

**Core concepts (3–5 max):**
- Concept → why it matters → the 1–2 canonical sources

**Build:**
- A concrete artifact the learner will create (repo, PR, demo, write-up)

**Feynman checkpoint:**
- The single question the learner must be able to answer out loud without notes.

**Common traps:**
- 2–3 misconceptions or anti-patterns experienced engineers fall into.
```

### A — Adjustments

- **Do not** pad with tangential topics. If week 2 only needs 3 concepts, stop at 3.
- **Do not** recommend 10-hour video courses. Prefer: official docs, primary-source papers, single high-quality book chapters, and `awesome-*` lists curated by practitioners.
- **Do** front-load the hardest conceptual material in weeks 1–2; weeks 3–4 should lean toward building.
- **Do** include one "red team" exercise per week — a deliberate attempt to break, stress, or probe the learner's mental model.

### T — Type of output

Pure Markdown. No preamble, no closing summary. Start directly with `# Roadmap: {{TOPIC}}`. Use H2 for weeks, H3 sparingly. Every bullet under ~140 characters.

### E — Extras

At the end, append a section `## Mastery Signal` with 3 observable behaviors that indicate the learner has *actually* internalized the topic (not just completed the reading). These should be behaviors a senior peer could witness in a code review or design discussion.

---

## Filling in

- `{{TOPIC}}` — the topic name (e.g. "Rust async runtimes", "Kafka internals", "CRDTs for collaborative editing").

Once generated, skim for the 20% that feels most uncomfortable — that's where to start on day 1.

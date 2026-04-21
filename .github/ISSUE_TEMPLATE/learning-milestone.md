---
name: Learning Milestone
about: Track a single learning module from start to "Done."
title: "[Milestone] <topic> — Week <N>: <theme>"
labels: ["learning", "milestone"]
assignees: []
---

## Module

- **Topic:** `<e.g. rust-async-runtimes>`
- **Week:** `<1–4>`
- **Theme:** `<one-line>`
- **Roadmap link:** `roadmaps/<topic>/roadmap.md#week-<N>`

## Outcome statement

> _In one sentence, what will you be able to do at the end of this module that you cannot do now?_



## Definition of Done

A module is not complete until **every** box below is ticked. No exceptions, no partial credit.

### Understanding

- [ ] **Analogy created** — I have written at least one analogy from a *different domain* that captures the core mechanism of this module. The analogy is in `progress_log.md`.
- [ ] **Socratic session finished** — I ran a full session with `templates/socratic-tutor.md` and reached the point where the tutor acknowledged my explanation without further challenge.
- [ ] **Feynman audit passed** — I wrote a plain-language explanation (200+ words) and ran it through `templates/feynman-check.md`. The Gap Report shows zero ❌ Causal gaps and at most one ⚠️ Jargon-laundering entry.

### Application

- [ ] **Code sample built** — A runnable artifact (repo, notebook, script, PR) exists that demonstrates the concept. Link below.
- [ ] **Red-team exercise done** — I deliberately broke, stressed, or probed the mental model (wrong inputs, boundary conditions, adversarial cases). Notes in `progress_log.md`.

### Transfer

- [ ] **Taught to someone** — I explained this concept to another human (colleague, blog reader, rubber duck with a real name) and they gave me a signal of understanding or pushed back with a question I could answer.
- [ ] **Mastery signal observed** — At least one of the three "Mastery Signal" behaviors from the roadmap has actually happened in the wild (code review, design doc, meeting).

### Hygiene

- [ ] `progress_log.md` has a dated entry for this module.
- [ ] Curriculum Status table in `README.md` is updated.

## Artifacts

- **Code sample:** `<repo link or path>`
- **Write-up / analogy:** `<link to progress_log.md entry or external post>`
- **Socratic transcript (optional):** `<link or gist>`
- **Feynman Gap Report:** `<link or gist>`

## Retrospective

> _Fill this in before closing the issue._

- **What clicked:**
- **What's still fuzzy (and why it's okay for now):**
- **What I'd do differently next module:**
- **Does this change the rest of the roadmap?** (yes/no — if yes, edit `roadmap.md` and note it here)

#!/usr/bin/env python3
"""
new_topic.py — Bootstrap a new learning topic in the Personal Learning OS.

Usage:
    python scripts/new_topic.py <topic-name>

Example:
    python scripts/new_topic.py rust-async-runtimes
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import date
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
ROADMAPS_DIR = REPO_ROOT / "roadmaps"
TEMPLATES_DIR = REPO_ROOT / "templates"
ROADMAP_TEMPLATE = TEMPLATES_DIR / "roadmap-gen.md"


SLUG_RE = re.compile(r"[^a-z0-9-]+")


def slugify(name: str) -> str:
    """Turn 'Rust Async Runtimes' into 'rust-async-runtimes'."""
    lowered = name.strip().lower().replace("_", "-").replace(" ", "-")
    cleaned = SLUG_RE.sub("-", lowered).strip("-")
    collapsed = re.sub(r"-+", "-", cleaned)
    if not collapsed:
        raise ValueError(f"Topic name '{name}' produced an empty slug.")
    return collapsed


def write_if_absent(path: Path, content: str) -> bool:
    """Write content to path only if it does not exist. Returns True if written."""
    if path.exists():
        return False
    path.write_text(content, encoding="utf-8")
    return True


def roadmap_stub(topic: str) -> str:
    return f"""# Roadmap: {topic}

> Generated on {date.today().isoformat()}. Replace this stub with the output of `roadmap-gen.md` run through your LLM.

## Week 1 — <Theme>

**Outcome:**

**Core concepts:**
-

**Build:**
-

**Feynman checkpoint:**
-

**Common traps:**
-

## Week 2 — <Theme>

## Week 3 — <Theme>

## Week 4 — <Theme>

## Mastery Signal

1.
2.
3.
"""


def progress_log_stub(topic: str) -> str:
    return f"""# Progress Log — {topic}

> One dated entry per study session. Keep entries short and causal: what you touched, what clicked, what broke, what's next.

## {date.today().isoformat()} — Kickoff

- Created topic folder and roadmap stub.
- Next: fill in `roadmap.md` by running `roadmap-gen.md` through an LLM.

---

<!-- Append new sessions below. Format:

## YYYY-MM-DD — <Session title>

- What I studied:
- What clicked:
- What's still fuzzy:
- Next session:

-->
"""


def create_topic(raw_name: str) -> Path:
    slug = slugify(raw_name)
    topic_dir = ROADMAPS_DIR / slug

    if topic_dir.exists():
        print(f"✗ Topic already exists: {topic_dir}", file=sys.stderr)
        sys.exit(1)

    if not ROADMAP_TEMPLATE.exists():
        print(
            f"✗ Missing template: {ROADMAP_TEMPLATE}. "
            "Did you run this from inside the learnos repo?",
            file=sys.stderr,
        )
        sys.exit(1)

    topic_dir.mkdir(parents=True)

    roadmap_path = topic_dir / "roadmap.md"
    progress_path = topic_dir / "progress_log.md"
    template_copy_path = topic_dir / "roadmap-gen.md"

    write_if_absent(roadmap_path, roadmap_stub(raw_name))
    write_if_absent(progress_path, progress_log_stub(raw_name))
    shutil.copy2(ROADMAP_TEMPLATE, template_copy_path)

    return topic_dir


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap a new learning topic in the Personal Learning OS."
    )
    parser.add_argument(
        "topic",
        help="Topic name (e.g. 'rust-async-runtimes' or 'Rust Async Runtimes').",
    )
    args = parser.parse_args()

    topic_dir = create_topic(args.topic)
    rel = topic_dir.relative_to(REPO_ROOT)

    print(f"✓ Created {rel}/")
    print(f"  ├── roadmap.md")
    print(f"  ├── progress_log.md")
    print(f"  └── roadmap-gen.md  (working copy — edit {{TOPIC}} and feed to your LLM)")
    print()
    print("Next:")
    print(f"  1. Open {rel}/roadmap-gen.md, replace {{{{TOPIC}}}}, paste into your LLM.")
    print(f"  2. Save the output to {rel}/roadmap.md.")
    print(f"  3. Log your first session in {rel}/progress_log.md.")


if __name__ == "__main__":
    main()

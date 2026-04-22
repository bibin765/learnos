# Learning OS — Web UI

Astro + React dashboard for the Personal Learning OS. Reads curriculum content from GitHub at runtime and runs the three LLM templates against the Claude API directly from the browser using a key the user pastes in.

## Prerequisites

The UI fetches content from a **public** GitHub repo. Push the parent learnos repo to GitHub before launching.

## Setup

```bash
cd ui
npm install
cp .env.example .env
# Edit .env: set PUBLIC_GITHUB_OWNER and PUBLIC_GITHUB_REPO
npm run dev
```

Open <http://localhost:4321>, paste an Anthropic API key into the bar at the top, pick a model.

## Pages

- **`/`** — dashboard. Lists topics under `roadmaps/` and renders `README.md`.
- **`/topic?slug=<topic>`** — per-topic view with `roadmap.md` + `progress_log.md` tabs.
- **`/templates/roadmap-gen`** — one-shot roadmap generator.
- **`/templates/socratic`** — multi-turn Socratic chat.
- **`/templates/feynman`** — one-shot Feynman audit.

## How it works

- **Content:** fetched runtime from `raw.githubusercontent.com` (markdown) + GitHub Contents API (directory listings). Push to `main` → the site reflects the change on the next page load.
- **LLM calls:** direct browser → Anthropic API using `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`. Streaming via `client.messages.stream()`. Adaptive thinking enabled.
- **Prompt caching:** `cache_control` is set on the system prompt, but templates are currently ~1K tokens which is below the minimum cacheable prefix (4K on Opus 4.7, 2K on Sonnet 4.6). It's a no-op today; starts working automatically if templates grow.
- **API key storage:** `localStorage`. Anything running on the page can read it — treat keys as disposable.

## Model choice

Toggle in the top bar.

| Model | When to use |
|---|---|
| **Opus 4.7** (default) | Socratic sessions, Feynman audits, hard roadmaps — quality matters, volume is low. |
| **Sonnet 4.6** | Quick roadmap drafts, low-stakes chat, cost-sensitive runs. |

## Deploy

Build produces a static site in `dist/`. Deploy anywhere that serves static HTML (GitHub Pages, Cloudflare Pages, Vercel). No backend needed.

```bash
npm run build
```

Set `PUBLIC_GITHUB_OWNER` / `PUBLIC_GITHUB_REPO` / `PUBLIC_GITHUB_BRANCH` as build-time env vars on your host.

## GitHub API rate limits

Unauthenticated Contents API calls are limited to 60/hour per IP. For a personal dashboard visited a handful of times a day this is fine. If you hit the limit, wait an hour — the current code has no token plumbing.

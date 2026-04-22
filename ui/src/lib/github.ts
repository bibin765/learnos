const OWNER = import.meta.env.PUBLIC_GITHUB_OWNER;
const REPO = import.meta.env.PUBLIC_GITHUB_REPO;
const BRANCH = import.meta.env.PUBLIC_GITHUB_BRANCH || "main";

// In dev, if the repo env vars aren't set, fall back to a Vite middleware
// that serves content from the parent directory on the filesystem.
const USE_LOCAL = import.meta.env.DEV && (!OWNER || OWNER === "your-username");

export interface RepoEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface Topic {
  slug: string;
  title: string;
}

function rawUrl(path: string): string {
  if (USE_LOCAL) return `/_local/${path}`;
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
}

function contentsUrl(path: string): string {
  if (USE_LOCAL) return `/_local/${path}`;
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
}

export async function fetchText(path: string): Promise<string> {
  const res = await fetch(rawUrl(path));
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function listDir(path: string): Promise<RepoEntry[]> {
  const res = await fetch(contentsUrl(path));
  if (!res.ok) {
    throw new Error(`Failed to list ${path}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as RepoEntry[];
  return Array.isArray(data) ? data : [];
}

export async function listTopics(): Promise<Topic[]> {
  const entries = await listDir("roadmaps");
  return entries
    .filter((e) => e.type === "dir")
    .map((e) => ({
      slug: e.name,
      title: humanize(e.name),
    }));
}

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function repoConfigured(): boolean {
  if (USE_LOCAL) return true; // dev fallback is always available
  return Boolean(OWNER && REPO && OWNER !== "your-username");
}

/** Dev-only: write a file back to the local filesystem via the Vite middleware. */
export async function writeLocal(relPath: string, content: string): Promise<void> {
  if (!USE_LOCAL) {
    throw new Error(
      "Save is only available in local dev mode. Copy the output and commit manually.",
    );
  }
  const res = await fetch(`/_local/${relPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, create_parents: true }),
  });
  if (!res.ok) {
    throw new Error(`Save failed: ${res.status} ${await res.text()}`);
  }
}

export function canWriteLocally(): boolean {
  return USE_LOCAL;
}

export const repoInfo = USE_LOCAL
  ? { owner: "local", repo: "filesystem", branch: "dev" }
  : { owner: OWNER, repo: REPO, branch: BRANCH };

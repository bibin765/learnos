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

export const repoInfo = USE_LOCAL
  ? { owner: "local", repo: "filesystem", branch: "dev" }
  : { owner: OWNER, repo: REPO, branch: BRANCH };

import { useEffect, useState } from "react";
import { listTopics, type Topic, repoConfigured, repoInfo } from "../lib/github";

export default function TopicList() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoConfigured()) {
      setError(
        "Set PUBLIC_GITHUB_OWNER and PUBLIC_GITHUB_REPO in .env before launching. See .env.example.",
      );
      setLoading(false);
      return;
    }
    listTopics()
      .then(setTopics)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="font-mono text-sm text-ink/50">loading topics…</div>;
  if (error) return <div className="font-mono text-sm text-red-700">error: {error}</div>;
  if (topics.length === 0) {
    return (
      <div className="font-mono text-sm text-ink/60">
        No topics yet. Run <code>python scripts/new_topic.py &lt;topic&gt;</code> and push to GitHub.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-mono text-ink/50">
        {repoInfo.owner}/{repoInfo.repo}@{repoInfo.branch}
      </div>
      <ul className="space-y-1">
        {topics.map((t) => (
          <li key={t.slug}>
            <a
              href={`/topic?slug=${encodeURIComponent(t.slug)}`}
              className="block px-3 py-2 border border-ink/10 rounded hover:border-accent hover:bg-white transition-colors"
            >
              <div className="font-mono text-sm">{t.title}</div>
              <div className="font-mono text-xs text-ink/50">roadmaps/{t.slug}/</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

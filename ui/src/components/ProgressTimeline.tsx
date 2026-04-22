import { useEffect, useState } from "react";
import { fetchText } from "../lib/github";
import { parseProgressLog, type LogEntry } from "../lib/parseContent";
import Md from "./Md";

interface Props {
  slug: string;
}

export default function ProgressTimeline({ slug }: Props) {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchText(`roadmaps/${slug}/progress_log.md`)
      .then((md) => setEntries(parseProgressLog(md)))
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) return <div className="text-sm text-red-700 font-mono">error: {error}</div>;
  if (entries === null) return <div className="text-sm text-ink/50">loading log…</div>;
  if (entries.length === 0) {
    return (
      <div className="text-sm text-ink/60 rounded border border-rule bg-white p-4">
        No entries yet. Add dated sessions to <code className="font-mono">progress_log.md</code>.
      </div>
    );
  }

  return (
    <ol className="space-y-0 relative">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-rule" aria-hidden />
      {entries.map((e, i) => (
        <li key={i} className="relative pl-8 pb-5 last:pb-0">
          <span className="absolute left-0 top-[6px] w-[15px] h-[15px] rounded-full bg-paper border-2 border-accent" />
          {e.date && (
            <div className="text-[11px] font-mono text-ink/50 tabular-nums">{e.date}</div>
          )}
          <div className="font-serif text-[15px] font-medium leading-snug">{e.title}</div>
          {e.body && (
            <div className="mt-1.5 text-sm text-ink-soft"><Md text={e.body} /></div>
          )}
        </li>
      ))}
    </ol>
  );
}

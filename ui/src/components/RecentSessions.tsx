import { useEffect, useState } from "react";
import {
  deleteSession,
  listSessions,
  relativeTime,
  SESSIONS_EVENT,
  type SavedSession,
} from "../lib/sessions";

const KIND_META: Record<SavedSession["kind"], { label: string; icon: string; href: (s: SavedSession) => string }> = {
  socratic: {
    label: "Socratic",
    icon: "?",
    href: (s) => `/templates/socratic?resume=${encodeURIComponent(s.id)}`,
  },
  "roadmap-wizard": {
    label: "Roadmap",
    icon: "▦",
    href: (s) => `/templates/roadmap-gen?resume=${encodeURIComponent(s.id)}`,
  },
};

export default function RecentSessions() {
  const [sessions, setSessions] = useState<SavedSession[]>(() => listSessions());

  useEffect(() => {
    setSessions(listSessions());
    function refresh() {
      setSessions(listSessions());
    }
    window.addEventListener(SESSIONS_EVENT, refresh);
    return () => window.removeEventListener(SESSIONS_EVENT, refresh);
  }, []);

  if (sessions.length === 0) return null;

  function remove(id: string, title: string) {
    if (!confirm(`Delete session: ${title}?`)) return;
    deleteSession(id);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Pick up where you left off</h2>
        <span className="text-xs font-mono text-ink/40">
          {sessions.length} saved
        </span>
      </div>

      <ul className="space-y-2">
        {sessions.slice(0, 8).map((s) => {
          const meta = KIND_META[s.kind];
          const lastMsg = s.turns[s.turns.length - 1];
          const preview =
            lastMsg?.content
              .replace(/\s+/g, " ")
              .replace(/[#*`]/g, "")
              .slice(0, 140) ?? "";
          const assistantTurns = s.turns.filter((t) => t.role === "assistant").length;
          return (
            <li key={s.id}>
              <div className="group bg-white border border-rule rounded-lg p-4 hover:border-accent hover:shadow-sm transition-all flex items-start gap-4">
                <a
                  href={meta.href(s)}
                  className="flex-1 min-w-0 flex items-start gap-4"
                >
                  <div className="shrink-0 font-serif text-2xl text-accent w-8 text-center">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono text-ink/40">
                        {assistantTurns} {assistantTurns === 1 ? "reply" : "replies"}
                      </span>
                      <span className="text-[10px] font-mono text-ink/40">
                        {relativeTime(s.updatedAt)}
                      </span>
                    </div>
                    <div className="font-serif text-base leading-snug mt-0.5 truncate">
                      {s.title}
                    </div>
                    {preview && (
                      <div className="text-xs text-ink-soft mt-1 line-clamp-2">
                        {preview}
                      </div>
                    )}
                  </div>
                </a>
                <button
                  onClick={() => remove(s.id, s.title)}
                  className="text-xs font-mono text-ink/30 hover:text-red-700 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  title="Delete session"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

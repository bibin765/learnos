import { useEffect, useState } from "react";
import { renderMarkdown } from "../lib/markdown";
import { fetchText } from "../lib/github";

interface Props {
  path?: string;
  text?: string;
  className?: string;
}

export default function MarkdownView({ path, text, className }: Props) {
  const [content, setContent] = useState<string>(text ?? "");
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text !== undefined) {
      setContent(text);
      return;
    }
    if (!path) return;
    setLoading(true);
    setError(null);
    fetchText(path)
      .then((t) => setContent(t))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path, text]);

  if (loading) return <div className="text-ink/50 font-mono text-sm">loading {path}…</div>;
  if (error) return <div className="text-red-700 font-mono text-sm">error: {error}</div>;

  return (
    <article
      className={`prose prose-stone max-w-none prose-headings:font-mono prose-code:font-mono prose-code:text-accent prose-a:text-accent ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

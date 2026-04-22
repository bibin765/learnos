import { renderMarkdown } from "../lib/markdown";

/**
 * Render a markdown chunk inline. Used for small blocks inside week cards
 * where full <MarkdownView> would be overkill.
 */
export default function Md({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={`prose prose-stone max-w-none ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}

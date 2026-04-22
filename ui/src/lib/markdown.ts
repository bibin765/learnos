import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string;
}

/**
 * Extract the prompt body from a template markdown file.
 * Our templates use `## Prompt` as the delimiter — everything from that
 * heading to the next `##` heading (or end of file) is the prompt.
 * Falls back to the entire file if no delimiter is found.
 */
export function extractPromptBody(templateMd: string): string {
  const marker = /^##\s+Prompt\s*$/m;
  const match = templateMd.match(marker);
  if (!match || match.index === undefined) return templateMd;

  const rest = templateMd.slice(match.index + match[0].length);
  const nextHeading = rest.search(/^---\s*$|^##\s+Filling in/m);
  return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
}

/**
 * Fill `{{PLACEHOLDER}}` tokens in a template.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in values ? values[key] : `{{${key}}}`,
  );
}

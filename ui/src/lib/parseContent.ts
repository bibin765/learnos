/**
 * Small structured parsers over our curriculum markdown. Just enough to
 * render week-cards and a progress timeline — we don't try to parse every
 * markdown construct, we just section things up and let `marked` render
 * each chunk.
 */

export interface Section {
  label: string;
  body: string;
}

export interface Week {
  number: number;
  theme: string;
  sections: Section[];
  raw: string;
}

export interface ParsedRoadmap {
  title?: string;
  preamble?: string;
  weeks: Week[];
  masterySignal: string[];
  raw: string;
}

export interface LogEntry {
  date?: string;
  title: string;
  body: string;
}

export function parseRoadmap(md: string): ParsedRoadmap {
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.replace(/^Roadmap:\s*/i, "").trim();

  // Capture the preamble (between H1 and first H2)
  const preambleMatch = md.match(/^#\s+.+\n([\s\S]*?)(?=^##\s)/m);
  const preamble = preambleMatch?.[1]?.trim();

  const weeks: Week[] = [];
  const weekHeadingRe = /^##\s+Week\s+(\d+)\s*[—–-]\s*(.+)$/gm;
  const weekMatches = Array.from(md.matchAll(weekHeadingRe));

  for (let i = 0; i < weekMatches.length; i++) {
    const m = weekMatches[i];
    const next = weekMatches[i + 1];
    const start = (m.index ?? 0) + m[0].length;
    const masterIdx = md.indexOf("\n## Mastery Signal", start);
    const end = next
      ? (next.index ?? md.length)
      : masterIdx > -1
        ? masterIdx
        : md.length;
    const body = md.slice(start, end).trim();
    weeks.push({
      number: Number(m[1]),
      theme: m[2].trim(),
      sections: parseSections(body),
      raw: body,
    });
  }

  const masteryMatch = md.match(/^##\s+Mastery Signal\s*\n([\s\S]+?)$/m);
  const masterySignal = masteryMatch
    ? parseNumberedList(masteryMatch[1])
    : [];

  return { title, preamble, weeks, masterySignal, raw: md };
}

function parseSections(body: string): Section[] {
  const re = /^\*\*([^*]+?):\*\*\s*/gm;
  const matches = Array.from(body.matchAll(re));
  if (matches.length === 0) return [{ label: "", body }];

  const out: Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = matches[i + 1];
    const start = (m.index ?? 0) + m[0].length;
    const end = next ? (next.index ?? body.length) : body.length;
    out.push({
      label: m[1].trim(),
      body: body.slice(start, end).trim(),
    });
  }
  return out;
}

function parseNumberedList(text: string): string[] {
  const items: string[] = [];
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*\d+\.\s+(.+)/);
    if (m) {
      if (current !== null) items.push(current.trim());
      current = m[1];
    } else if (current !== null && line.trim()) {
      current += " " + line.trim();
    } else if (current !== null && !line.trim()) {
      items.push(current.trim());
      current = null;
    }
  }
  if (current !== null) items.push(current.trim());
  return items.filter(Boolean);
}

export function parseProgressLog(md: string): LogEntry[] {
  // Strip the top-level title and preamble — keep only dated sections.
  const entries: LogEntry[] = [];
  // Match "## YYYY-MM-DD — Title" or "## Title"
  const headingRe = /^##\s+(.+)$/gm;
  const matches = Array.from(md.matchAll(headingRe));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = matches[i + 1];
    const start = (m.index ?? 0) + m[0].length;
    const end = next ? (next.index ?? md.length) : md.length;
    const heading = m[1].trim();
    const body = md
      .slice(start, end)
      .replace(/^---\s*$/gm, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();

    const dateMatch = heading.match(/^(\d{4}-\d{2}-\d{2})\s*[—–-]?\s*(.*)$/);
    entries.push({
      date: dateMatch?.[1],
      title: dateMatch?.[2]?.trim() || heading,
      body,
    });
  }
  return entries;
}

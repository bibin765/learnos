/**
 * Node-graph roadmap format — canonical for new topics.
 * Old topics can still use the week-based `roadmap.md`; see TopicDetail for fallback.
 */

import { fetchText } from "./github";

export interface Source {
  ref: string;
  kind?: "book" | "paper" | "doc" | "post" | "other";
}

export interface NodeStory {
  knot: string;
  move: string;
  handle: string;
}

export interface RoadmapNode {
  id: string;
  title: string;
  chapter: string;
  prerequisites: string[];
  story: NodeStory;
  sources: Source[];
  feynman: string;
  build?: string;
  traps?: string[];
}

export interface Chapter {
  id: string;
  title: string;
  description?: string;
}

export interface NodeRoadmap {
  topic: string;
  slug: string;
  preamble?: string;
  chapters: Chapter[];
  nodes: RoadmapNode[];
  mastery: string[];
  generatedAt?: string;
}

export async function loadNodeRoadmap(slug: string): Promise<NodeRoadmap | null> {
  try {
    const raw = await fetchText(`roadmaps/${slug}/roadmap.json`);
    return JSON.parse(raw) as NodeRoadmap;
  } catch {
    return null;
  }
}

export function nodesByChapter(rm: NodeRoadmap): Map<string, RoadmapNode[]> {
  const byCh = new Map<string, RoadmapNode[]>();
  for (const ch of rm.chapters) byCh.set(ch.id, []);
  for (const n of rm.nodes) {
    if (!byCh.has(n.chapter)) byCh.set(n.chapter, []);
    byCh.get(n.chapter)!.push(n);
  }
  return byCh;
}

export function getNode(rm: NodeRoadmap, id: string): RoadmapNode | undefined {
  return rm.nodes.find((n) => n.id === id);
}

export function prereqTitles(rm: NodeRoadmap, node: RoadmapNode): string[] {
  return node.prerequisites
    .map((id) => rm.nodes.find((n) => n.id === id)?.title)
    .filter((t): t is string => Boolean(t));
}

/**
 * Topological ordering so a node's prerequisites always appear before it.
 * Falls back to the declared order for any unresolved cycles.
 */
export function topoOrder(rm: NodeRoadmap): RoadmapNode[] {
  const visited = new Set<string>();
  const result: RoadmapNode[] = [];
  const byId = new Map(rm.nodes.map((n) => [n.id, n]));

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    const n = byId.get(id);
    if (!n) return;
    for (const p of n.prerequisites) visit(p);
    result.push(n);
  }

  for (const n of rm.nodes) visit(n.id);
  return result;
}

/**
 * Try to extract a fenced JSON block from a streaming/noisy assistant message.
 * Returns the first valid NodeRoadmap found, or null.
 */
export function extractRoadmapJson(text: string): NodeRoadmap | null {
  // 1. Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;

  // 2. Find the first { ... last }
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first < 0 || last < first) return null;
  const slice = candidate.slice(first, last + 1);

  try {
    const parsed = JSON.parse(slice);
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.chapters)) return null;
    return parsed as NodeRoadmap;
  } catch {
    return null;
  }
}

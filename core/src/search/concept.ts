import type {
  AtlasSymbol,
  EntryPoint,
  Landmark,
  Territory,
} from "../types/index.js";
import type { HubNode } from "../graph/hubs.js";

export interface ConceptHit {
  kind: "territory" | "landmark" | "entry" | "symbol" | "hub";
  score: number;
  title: string;
  subtitle: string;
  id: string;
  location?: { file: string; line: number };
}

/**
 * Semantic-ish concept search over territories, landmarks, entry points, hubs, and symbols.
 * Local-first token / fuzzy scoring — no embeddings or API keys.
 */
export function conceptSearch(
  query: string,
  opts: {
    territories: Territory[];
    landmarks: Landmark[];
    entryPoints: EntryPoint[];
    symbols: AtlasSymbol[];
    hubs?: HubNode[];
    limit?: number;
  },
): ConceptHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/[\s./:_-]+/).filter((t) => t.length > 1);
  const limit = opts.limit ?? 20;
  const hits: ConceptHit[] = [];

  for (const t of opts.territories) {
    const hay = `${t.name} ${t.annotations?.join(" ") ?? ""} ${t.evidence.naming_signals?.join(" ") ?? ""} ${t.evidence.directories.join(" ")}`.toLowerCase();
    const score = scoreText(q, tokens, hay) + t.confidence * 2;
    if (score > 0) {
      hits.push({
        kind: "territory",
        score,
        title: t.name,
        subtitle: `${t.evidence.symbols} symbols · confidence ${Math.round(t.confidence * 100)}%`,
        id: t.id,
      });
    }
  }

  for (const l of opts.landmarks) {
    const hay = `${l.name} ${l.description} ${l.location.file}`.toLowerCase();
    const score = scoreText(q, tokens, hay) + 3;
    if (score > 0) {
      hits.push({
        kind: "landmark",
        score,
        title: l.name,
        subtitle: l.description.slice(0, 120),
        id: l.id,
        location: l.location,
      });
    }
  }

  for (const e of opts.entryPoints) {
    const hay = `${e.label} ${e.category} ${e.symbol.qualifiedName} ${e.symbol.location.file}`.toLowerCase();
    const score = scoreText(q, tokens, hay) + 2;
    if (score > 0) {
      hits.push({
        kind: "entry",
        score,
        title: e.label,
        subtitle: `${e.category} · ${e.symbol.location.file}:${e.symbol.location.line}`,
        id: e.symbol.id,
        location: e.symbol.location,
      });
    }
  }

  for (const h of opts.hubs ?? []) {
    const hay = `${h.symbol.name} ${h.role} ${h.territoriesTouched.join(" ")} ${h.symbol.qualifiedName}`.toLowerCase();
    const score = scoreText(q, tokens, hay) + h.score * 0.05;
    if (score > 0) {
      hits.push({
        kind: "hub",
        score,
        title: `${h.role}: ${h.symbol.name}`,
        subtitle: h.territoriesTouched.join(" · ") || h.symbol.location.file,
        id: h.symbol.id,
        location: h.symbol.location,
      });
    }
  }

  // Symbol fallback — prefer important exported ones
  const symbolPool = opts.symbols
    .filter((s) => s.kind !== "file" && s.kind !== "module")
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 2000);

  for (const s of symbolPool) {
    const hay = `${s.name} ${s.qualifiedName} ${s.kind} ${s.location.file}`.toLowerCase();
    let score = scoreText(q, tokens, hay);
    if (score <= 0) continue;
    score += Math.min(5, (s.importance ?? 0) * 0.05);
    hits.push({
      kind: "symbol",
      score,
      title: s.qualifiedName,
      subtitle: `${s.kind} · ${s.location.file}:${s.location.line}`,
      id: s.id,
      location: s.location,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

function scoreText(q: string, tokens: string[], hay: string): number {
  let score = 0;
  if (hay.includes(q)) score += 10;
  for (const t of tokens) {
    if (hay.includes(t)) score += 3;
    // prefix bonus on path segments / words
    for (const part of hay.split(/[\s./:_-]+/)) {
      if (part.startsWith(t)) score += 1.5;
      if (part === t) score += 2;
    }
  }
  return score;
}

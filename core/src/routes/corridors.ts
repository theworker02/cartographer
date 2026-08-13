import type { AtlasSymbol, Corridor, Relationship, Territory } from "../types/index.js";

/**
 * Detect recurring architectural corridors (territory stage sequences)
 * from call/import paths across territories.
 */
export function detectCorridors(
  symbols: AtlasSymbol[],
  relationships: Relationship[],
  territories: Territory[],
): Corridor[] {
  const parentTerritories = territories.filter((t) => !t.parentId);
  const symbolTerritory = new Map<string, string>();
  for (const t of parentTerritories) {
    for (const id of t.symbolIds) symbolTerritory.set(id, t.name);
  }
  for (const s of symbols) {
    if (s.territoryId && !symbolTerritory.has(s.id)) {
      const t = territories.find((x) => x.id === s.territoryId);
      if (t) symbolTerritory.set(s.id, t.name.split("/")[0]!);
    }
  }

  const adj = new Map<string, string[]>();
  for (const r of relationships) {
    if (!["calls", "imports", "references", "constructs"].includes(r.kind)) continue;
    const list = adj.get(r.fromId) ?? [];
    list.push(r.toId);
    adj.set(r.fromId, list);
  }

  const pathCounts = new Map<string, { stages: string[]; examples: string[]; count: number }>();
  const entries = symbols.filter((s) => s.entryPoint || s.kind === "route" || s.kind === "command");

  for (const entry of entries.slice(0, 80)) {
    const paths = walkTerritoryPaths(entry.id, adj, symbolTerritory, 5);
    for (const path of paths) {
      if (path.stages.length < 2) continue;
      const key = path.stages.join("→");
      const existing = pathCounts.get(key) ?? { stages: path.stages, examples: [], count: 0 };
      existing.count++;
      if (existing.examples.length < 5 && path.example) {
        existing.examples.push(path.example);
      }
      pathCounts.set(key, existing);
    }
  }

  const corridors: Corridor[] = [];
  let i = 0;
  for (const [, data] of [...pathCounts.entries()].sort((a, b) => b[1].count - a[1].count)) {
    if (data.count < 1) continue;
    corridors.push({
      id: `corridor:${i++}`,
      name: data.stages.join(" → "),
      stages: data.stages,
      frequency: data.count,
      examples: data.examples,
    });
    if (corridors.length >= 24) break;
  }
  return corridors;
}

function walkTerritoryPaths(
  start: string,
  adj: Map<string, string[]>,
  symbolTerritory: Map<string, string>,
  maxDepth: number,
): Array<{ stages: string[]; example?: string }> {
  const results: Array<{ stages: string[]; example?: string }> = [];
  const stack: Array<{ id: string; stages: string[]; depth: number; trail: string[] }> = [
    {
      id: start,
      stages: symbolTerritory.get(start) ? [symbolTerritory.get(start)!] : [],
      depth: 0,
      trail: [start],
    },
  ];

  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.depth >= maxDepth) {
      if (cur.stages.length >= 2) {
        results.push({ stages: cur.stages, example: cur.trail.join(" → ") });
      }
      continue;
    }
    const nexts = adj.get(cur.id) ?? [];
    if (!nexts.length) {
      if (cur.stages.length >= 2) {
        results.push({ stages: cur.stages, example: cur.trail.join(" → ") });
      }
      continue;
    }
    for (const n of nexts.slice(0, 8)) {
      if (cur.trail.includes(n)) continue;
      const t = symbolTerritory.get(n);
      const stages =
        t && cur.stages[cur.stages.length - 1] !== t ? [...cur.stages, t] : [...cur.stages];
      stack.push({ id: n, stages, depth: cur.depth + 1, trail: [...cur.trail, n] });
    }
  }
  return results.slice(0, 20);
}

/** Score how well a hop sequence matches known corridors (0–1). */
export function corridorAffinity(
  hopTerritoryNames: string[],
  corridors: Corridor[],
): number {
  if (hopTerritoryNames.length < 2 || !corridors.length) return 0;
  let best = 0;
  for (const c of corridors) {
    const score = sequenceOverlap(hopTerritoryNames, c.stages) * Math.min(1, c.frequency / 10);
    if (score > best) best = score;
  }
  return best;
}

function sequenceOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let matches = 0;
  const bset = new Set(b);
  for (const x of a) if (bset.has(x)) matches++;
  // bonus for contiguous subsequence
  const joined = a.join("|");
  const target = b.join("|");
  const contig = joined.includes(target) || target.includes(joined) ? 0.3 : 0;
  return Math.min(1, matches / Math.max(a.length, b.length) + contig);
}

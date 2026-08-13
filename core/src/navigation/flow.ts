import type { AtlasSymbol, Relationship } from "../types/index.js";

export function upstream(
  symbolId: string,
  relationships: Relationship[],
  symbols: AtlasSymbol[],
  depth = 3,
): AtlasSymbol[] {
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const result: AtlasSymbol[] = [];
  const seen = new Set<string>([symbolId]);
  let frontier = [symbolId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const r of relationships) {
        if (r.toId !== id) continue;
        if (r.kind === "contains") continue;
        if (seen.has(r.fromId)) continue;
        seen.add(r.fromId);
        const s = byId.get(r.fromId);
        if (s) {
          result.push(s);
          next.push(s.id);
        }
      }
    }
    frontier = next;
  }
  return result.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
}

export function downstream(
  symbolId: string,
  relationships: Relationship[],
  symbols: AtlasSymbol[],
  depth = 3,
): AtlasSymbol[] {
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const result: AtlasSymbol[] = [];
  const seen = new Set<string>([symbolId]);
  let frontier = [symbolId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const r of relationships) {
        if (r.fromId !== id) continue;
        if (r.kind === "contains") continue;
        if (seen.has(r.toId)) continue;
        seen.add(r.toId);
        const s = byId.get(r.toId);
        if (s) {
          result.push(s);
          next.push(s.id);
        }
      }
    }
    frontier = next;
  }
  return result.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
}

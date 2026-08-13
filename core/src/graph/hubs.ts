import type { AtlasSymbol, Relationship, Territory } from "../types/index.js";

export interface HubNode {
  symbol: AtlasSymbol;
  inDegree: number;
  outDegree: number;
  score: number;
  role: "hub" | "bridge";
  territoriesTouched: string[];
}

/**
 * Hub & bridge detection — first-class navigation primitives.
 * Hubs: high fan-in/fan-out within the graph.
 * Bridges: connect multiple territories (cut vertices by territory span).
 */
export function detectHubsAndBridges(
  symbols: AtlasSymbol[],
  relationships: Relationship[],
  territories: Territory[],
  limit = 20,
): HubNode[] {
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  const neighbors = new Map<string, Set<string>>();

  for (const r of relationships) {
    if (r.kind === "contains") continue;
    inDeg.set(r.toId, (inDeg.get(r.toId) ?? 0) + 1);
    outDeg.set(r.fromId, (outDeg.get(r.fromId) ?? 0) + 1);
    const a = neighbors.get(r.fromId) ?? new Set();
    a.add(r.toId);
    neighbors.set(r.fromId, a);
    const b = neighbors.get(r.toId) ?? new Set();
    b.add(r.fromId);
    neighbors.set(r.toId, b);
  }

  const symbolTerritory = new Map<string, string>();
  for (const t of territories.filter((x) => !x.parentId)) {
    for (const id of t.symbolIds) symbolTerritory.set(id, t.name);
  }

  const byId = new Map(symbols.map((s) => [s.id, s]));
  const hubs: HubNode[] = [];

  for (const s of symbols) {
    if (s.kind === "file" || s.kind === "module") continue;
    const inn = inDeg.get(s.id) ?? 0;
    const out = outDeg.get(s.id) ?? 0;
    if (inn + out < 2) continue;

    const touched = new Set<string>();
    const own = symbolTerritory.get(s.id);
    if (own) touched.add(own);
    for (const n of neighbors.get(s.id) ?? []) {
      const t = symbolTerritory.get(n);
      if (t) touched.add(t);
    }

    const isBridge = touched.size >= 2;
    const score =
      inn * 2 +
      out +
      (s.importance ?? 0) * 0.1 +
      (isBridge ? touched.size * 8 : 0) +
      (s.entryPoint ? 5 : 0);

    hubs.push({
      symbol: s,
      inDegree: inn,
      outDegree: out,
      score,
      role: isBridge ? "bridge" : "hub",
      territoriesTouched: [...touched],
    });
  }

  // Ensure we surface both roles
  const ranked = hubs.sort((a, b) => b.score - a.score);
  const bridges = ranked.filter((h) => h.role === "bridge").slice(0, Math.ceil(limit / 2));
  const pureHubs = ranked.filter((h) => h.role === "hub").slice(0, Math.ceil(limit / 2));
  const merged = [...bridges, ...pureHubs].sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: HubNode[] = [];
  for (const h of merged) {
    if (seen.has(h.symbol.id)) continue;
    seen.add(h.symbol.id);
    out.push(h);
    if (out.length >= limit) break;
  }

  // Fill from ranked if thin
  for (const h of ranked) {
    if (out.length >= limit) break;
    if (seen.has(h.symbol.id)) continue;
    seen.add(h.symbol.id);
    out.push(h);
  }

  void byId;
  return out;
}

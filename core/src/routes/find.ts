import type {
  AtlasSymbol,
  Corridor,
  RelationKind,
  Relationship,
  Route,
  RouteHop,
  Territory,
} from "../types/index.js";
import { corridorAffinity } from "./corridors.js";

export interface RouteOptions {
  maxDepth?: number;
  maxResults?: number;
  explain?: boolean;
}

/**
 * Find ranked routes between two symbols with corridor-aware scoring.
 */
export function findRoutes(
  fromId: string,
  toId: string,
  symbols: AtlasSymbol[],
  relationships: Relationship[],
  territories: Territory[],
  corridors: Corridor[],
  opts: RouteOptions = {},
): Route[] {
  const maxDepth = opts.maxDepth ?? 8;
  const maxResults = opts.maxResults ?? 5;
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const territoryName = new Map<string, string>();
  for (const t of territories) {
    for (const id of t.symbolIds) {
      if (!territoryName.has(id)) territoryName.set(id, t.name.split("/")[0]!);
    }
  }

  const adj = new Map<string, Array<{ to: string; kind: RelationKind; confidence: number }>>();
  for (const r of relationships) {
    if (r.kind === "contains") continue;
    const list = adj.get(r.fromId) ?? [];
    list.push({ to: r.toId, kind: r.kind, confidence: r.confidence });
    adj.set(r.fromId, list);
  }

  type PathState = {
    node: string;
    hops: RouteHop[];
    confProduct: number;
    visited: Set<string>;
  };

  const results: Route[] = [];
  const queue: PathState[] = [
    {
      node: fromId,
      hops: byId.get(fromId) ? [{ symbol: byId.get(fromId)! }] : [],
      confProduct: 1,
      visited: new Set([fromId]),
    },
  ];

  while (queue.length && results.length < maxResults * 4) {
    const cur = queue.shift()!;
    if (cur.hops.length > maxDepth) continue;
    if (cur.node === toId && cur.hops.length > 1) {
      results.push(scoreRoute(cur.hops, cur.confProduct, territoryName, corridors, opts.explain));
      continue;
    }
    for (const edge of adj.get(cur.node) ?? []) {
      if (cur.visited.has(edge.to)) continue;
      const sym = byId.get(edge.to);
      if (!sym) continue;
      const nextVisited = new Set(cur.visited);
      nextVisited.add(edge.to);
      queue.push({
        node: edge.to,
        hops: [...cur.hops, { symbol: sym, via: edge.kind, confidence: edge.confidence }],
        confProduct: cur.confProduct * Math.max(0.2, edge.confidence),
        visited: nextVisited,
      });
    }
  }

  // Bidirectional fallback: also try reverse edges for upstream-ish connectivity
  if (!results.length) {
    const radj = new Map<string, Array<{ to: string; kind: RelationKind; confidence: number }>>();
    for (const r of relationships) {
      if (r.kind === "contains") continue;
      const list = radj.get(r.toId) ?? [];
      list.push({ to: r.fromId, kind: r.kind, confidence: r.confidence });
      radj.set(r.toId, list);
    }
    const q2: PathState[] = [
      {
        node: fromId,
        hops: byId.get(fromId) ? [{ symbol: byId.get(fromId)! }] : [],
        confProduct: 1,
        visited: new Set([fromId]),
      },
    ];
    while (q2.length && results.length < maxResults) {
      const cur = q2.shift()!;
      if (cur.hops.length > maxDepth) continue;
      if (cur.node === toId && cur.hops.length > 1) {
        results.push(scoreRoute(cur.hops, cur.confProduct, territoryName, corridors, opts.explain));
        continue;
      }
      const edges = [...(adj.get(cur.node) ?? []), ...(radj.get(cur.node) ?? [])];
      for (const edge of edges) {
        if (cur.visited.has(edge.to)) continue;
        const sym = byId.get(edge.to);
        if (!sym) continue;
        const nextVisited = new Set(cur.visited);
        nextVisited.add(edge.to);
        q2.push({
          node: edge.to,
          hops: [...cur.hops, { symbol: sym, via: edge.kind, confidence: edge.confidence }],
          confProduct: cur.confProduct * Math.max(0.2, edge.confidence) * 0.9,
          visited: nextVisited,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

function scoreRoute(
  hops: RouteHop[],
  confProduct: number,
  territoryName: Map<string, string>,
  corridors: Corridor[],
  explain?: boolean,
): Route {
  const stages = hops
    .map((h) => territoryName.get(h.symbol.id))
    .filter((x): x is string => !!x);
  const uniqueStages: string[] = [];
  for (const s of stages) {
    if (uniqueStages[uniqueStages.length - 1] !== s) uniqueStages.push(s);
  }
  const transitions = Math.max(0, uniqueStages.length - 1);
  const affinity = corridorAffinity(uniqueStages, corridors);
  const lengthPenalty = hops.length * 0.08;
  const score =
    confProduct * 40 +
    affinity * 25 -
    lengthPenalty * 10 -
    transitions * 2 +
    hops.reduce((acc, h) => acc + (h.symbol.importance ?? 0) * 0.02, 0);

  const route: Route = {
    hops,
    score: Number(score.toFixed(3)),
    length: hops.length,
    territoryTransitions: transitions,
  };

  if (explain) {
    route.explanation = explainRouteInternal(route, uniqueStages, affinity, corridors);
  }
  return route;
}

export function explainRoute(
  route: Route,
  territories: Territory[],
  corridors: Corridor[],
): string {
  const territoryName = new Map<string, string>();
  for (const t of territories) {
    for (const id of t.symbolIds) {
      if (!territoryName.has(id)) territoryName.set(id, t.name.split("/")[0]!);
    }
  }
  const stages = route.hops
    .map((h) => territoryName.get(h.symbol.id))
    .filter((x): x is string => !!x);
  const uniqueStages: string[] = [];
  for (const s of stages) {
    if (uniqueStages[uniqueStages.length - 1] !== s) uniqueStages.push(s);
  }
  const affinity = corridorAffinity(uniqueStages, corridors);
  return explainRouteInternal(route, uniqueStages, affinity, corridors);
}

function explainRouteInternal(
  route: Route,
  stages: string[],
  affinity: number,
  corridors: Corridor[],
): string {
  const hopNames = route.hops
    .map((h, i) => {
      const via = h.via && i > 0 ? ` --${h.via}→ ` : i === 0 ? "" : " → ";
      return `${via}${h.symbol.name}`;
    })
    .join("");
  const corridorHint =
    affinity > 0.3
      ? corridors.find((c) => sequenceSoftMatch(stages, c.stages))
      : undefined;
  const parts = [
    `Path (${route.length} hops, ${route.territoryTransitions} territory transitions, score ${route.score}):`,
    hopNames,
    stages.length ? `Territories: ${stages.join(" → ")}` : "Territories: (unassigned)",
  ];
  if (corridorHint) {
    parts.push(
      `Aligns with corridor "${corridorHint.name}" (seen ${corridorHint.frequency}×) — preferred architectural flow.`,
    );
  } else if (route.territoryTransitions >= 2) {
    parts.push("Crosses multiple territories; treat as an integration path, not a local call chain.");
  } else {
    parts.push("Stays mostly within one architectural neighborhood.");
  }
  return parts.join("\n");
}

function sequenceSoftMatch(a: string[], b: string[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  const as = a.join("→");
  const bs = b.join("→");
  return as.includes(bs) || bs.includes(as) || a.filter((x) => b.includes(x)).length >= 2;
}

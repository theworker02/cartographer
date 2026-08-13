import type {
  AtlasSymbol,
  EntryPoint,
  Landmark,
  Position,
  Territory,
} from "../types/index.js";
import type { HubNode } from "../graph/hubs.js";

export interface MiniAtlas {
  territories: Array<{ name: string; symbols: number; confidence: number }>;
  hubs: Array<{ name: string; role: string; territories: string[] }>;
  entryPoints: Array<{ label: string; category: string }>;
  coverage?: number;
  breadcrumb: string[];
}

export function resolvePosition(opts: {
  symbol: AtlasSymbol | null;
  territories: Territory[];
  landmarks: Landmark[];
  entryPoints: EntryPoint[];
  hubs?: HubNode[];
}): Position {
  const { symbol, territories, landmarks, entryPoints } = opts;
  if (!symbol) {
    return {
      nearestLandmarks: landmarks.slice(0, 3),
      breadcrumb: ["(unknown)"],
    };
  }

  const parents = territories.filter((t) => !t.parentId);
  const territory =
    parents.find((t) => t.symbolIds.includes(symbol.id)) ??
    parents.find((t) => t.filePaths.includes(symbol.location.file.replace(/\\/g, "/")));
  const subterritory = territories.find(
    (t) => t.parentId && t.symbolIds.includes(symbol.id),
  );

  const nearestLandmarks = landmarks
    .map((l) => ({
      l,
      dist:
        (l.location.file === symbol.location.file ? 0 : 100) +
        Math.abs(l.location.line - symbol.location.line),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((x) => x.l);

  const upstreamEntrypoint = entryPoints
    .map((e) => e.symbol)
    .find((e) => e.id === symbol.id) ??
    entryPoints
      .map((e) => e.symbol)
      .filter((e) => e.location.file === symbol.location.file)
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];

  const breadcrumb = buildBreadcrumb(symbol, territory, subterritory);

  return {
    territory,
    subterritory,
    symbol,
    nearestLandmarks,
    upstreamEntrypoint,
    downstreamEffect: undefined,
    breadcrumb,
    distanceFromEntry: upstreamEntrypoint
      ? Math.abs(symbol.location.line - upstreamEntrypoint.location.line)
      : undefined,
  };
}

export function buildBreadcrumb(
  symbol: AtlasSymbol,
  territory?: Territory,
  subterritory?: Territory,
): string[] {
  const parts: string[] = [];
  if (territory) parts.push(territory.name);
  if (subterritory) parts.push(subterritory.name.split("/").pop()!);
  const file = symbol.location.file.replace(/\\/g, "/");
  parts.push(file);
  if (symbol.kind !== "file") {
    parts.push(`${symbol.kind}:${symbol.name}`);
  }
  return parts;
}

export function formatWhereAmI(opts: {
  position: Position;
  miniAtlas: MiniAtlas;
  hubsNearby: HubNode[];
}): string {
  const { position: p, miniAtlas, hubsNearby } = opts;
  const lines: string[] = [];
  lines.push("╔══════════════════════════════════════════╗");
  lines.push("║           CARTOGRAPHER · WHERE           ║");
  lines.push("╚══════════════════════════════════════════╝");
  lines.push("");
  lines.push(`Breadcrumb: ${p.breadcrumb.join(" › ")}`);
  if (p.symbol) {
    lines.push(
      `Symbol:     ${p.symbol.kind} ${p.symbol.qualifiedName}  (${p.symbol.location.file}:${p.symbol.location.line})`,
    );
    if (p.symbol.importance != null) {
      lines.push(`Importance: ${p.symbol.importance.toFixed(1)}`);
    }
  }
  if (p.territory) {
    lines.push(
      `Territory:  ${p.territory.name}  (confidence ${(p.territory.confidence * 100).toFixed(0)}%)`,
    );
  }
  if (p.subterritory) {
    lines.push(`Submap:     ${p.subterritory.name}`);
  }
  if (p.upstreamEntrypoint) {
    lines.push(`Entry:      ${p.upstreamEntrypoint.qualifiedName}`);
  }
  if (p.nearestLandmarks.length) {
    lines.push("Landmarks:");
    for (const l of p.nearestLandmarks) {
      const drift = l.driftStatus && l.driftStatus !== "ok" ? ` [${l.driftStatus}]` : "";
      lines.push(`  • ${l.name}${drift} — ${l.location.file}:${l.location.line}`);
    }
  }
  if (hubsNearby.length) {
    lines.push("Nearby hubs / bridges:");
    for (const h of hubsNearby.slice(0, 4)) {
      lines.push(
        `  • [${h.role}] ${h.symbol.name}  (in ${h.inDegree}/out ${h.outDegree})  ⟨${h.territoriesTouched.join(", ") || "—"}⟩`,
      );
    }
  }
  lines.push("");
  lines.push("── Mini Atlas ─────────────────────────────");
  for (const t of miniAtlas.territories.slice(0, 8)) {
    lines.push(
      `  ${(t.name + " ").padEnd(16, "·")} ${String(t.symbols).padStart(4)} symbols  ${Math.round(t.confidence * 100)}%`,
    );
  }
  if (miniAtlas.coverage != null) {
    lines.push(`  Exploration coverage: ${Math.round(miniAtlas.coverage * 100)}%`);
  }
  if (miniAtlas.entryPoints.length) {
    lines.push(
      `  Entries: ${miniAtlas.entryPoints
        .slice(0, 5)
        .map((e) => `${e.category}:${e.label}`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

export function buildMiniAtlas(opts: {
  territories: Territory[];
  hubs: HubNode[];
  entryPoints: EntryPoint[];
  breadcrumb: string[];
  coverage?: number;
}): MiniAtlas {
  return {
    territories: opts.territories
      .filter((t) => !t.parentId)
      .map((t) => ({
        name: t.name,
        symbols: t.evidence.symbols,
        confidence: t.confidence,
      }))
      .sort((a, b) => b.symbols - a.symbols),
    hubs: opts.hubs.slice(0, 6).map((h) => ({
      name: h.symbol.name,
      role: h.role,
      territories: h.territoriesTouched,
    })),
    entryPoints: opts.entryPoints.slice(0, 8).map((e) => ({
      label: e.label,
      category: e.category,
    })),
    coverage: opts.coverage,
    breadcrumb: opts.breadcrumb,
  };
}

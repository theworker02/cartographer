import { basename } from "node:path";
import type {
  AtlasMeta,
  Corridor,
  EntryPoint,
  Journey,
  Landmark,
  Position,
  Territory,
} from "../types/index.js";
import type { HubNode } from "../graph/hubs.js";
import type { MiniAtlas } from "../navigation/whereami.js";

export interface AtlasBriefing {
  title: string;
  repoName: string;
  generatedAt: string;
  meta: AtlasMeta | null;
  miniAtlas: MiniAtlas;
  youAreHere?: {
    breadcrumb: string[];
    territory?: string;
    confidence?: number;
    symbol?: string;
    file?: string;
  };
  corridors: Array<{ name: string; frequency: number; plain: string }>;
  hubs: Array<{ name: string; role: string; plain: string; territories: string[] }>;
  fog: {
    coverage: number;
    understood: string[];
    frontier: string[];
    beyond: string[];
  };
  startHere?: {
    journeyName: string;
    firstStop: string;
    rationale: string;
  };
  drift: Array<{ name: string; status: string }>;
  stats: {
    files: number;
    symbols: number;
    relationships: number;
    territories: number;
    entries: number;
  };
  text: string;
}

export interface BriefingInput {
  root: string;
  meta: AtlasMeta | null;
  territories: Territory[];
  corridors: Corridor[];
  hubs: HubNode[];
  entryPoints: EntryPoint[];
  landmarks: Landmark[];
  journey?: Journey | null;
  position?: Position | null;
  miniAtlas: MiniAtlas;
  fog: {
    coverage: number;
    understood: string[];
    frontier: string[];
    beyond: string[];
  };
  counts: {
    files: number;
    symbols: number;
    relationships: number;
    territories: number;
  };
}

/**
 * Living Atlas Briefing — the screenshot moment.
 * Opens a foreign codebase like a map: where you are, what flows, what's unexplored.
 */
export function buildAtlasBriefing(input: BriefingInput): AtlasBriefing {
  const repoName = basename(input.root.replace(/\\/g, "/")) || "repository";
  const parents = input.territories.filter((t) => !t.parentId);

  const corridors = input.corridors.slice(0, 5).map((c) => ({
    name: c.name,
    frequency: c.frequency,
    plain: plainCorridor(c),
  }));

  const hubs = input.hubs.slice(0, 6).map((h) => ({
    name: h.symbol.name,
    role: h.role,
    territories: h.territoriesTouched,
    plain: plainHub(h),
  }));

  const youAreHere = input.position?.symbol
    ? {
        breadcrumb: input.position.breadcrumb,
        territory: input.position.territory?.name,
        confidence: input.position.territory?.confidence,
        symbol: input.position.symbol.qualifiedName,
        file: `${input.position.symbol.location.file}:${input.position.symbol.location.line}`,
      }
    : undefined;

  const startHere = suggestStart(
    input.journey,
    input.entryPoints,
    input.hubs,
    parents,
  );

  const drift = input.landmarks
    .filter((l) => l.driftStatus && l.driftStatus !== "ok")
    .map((l) => ({ name: l.name, status: l.driftStatus! }));

  const briefing: AtlasBriefing = {
    title: "Living Atlas Briefing",
    repoName,
    generatedAt: new Date().toISOString(),
    meta: input.meta,
    miniAtlas: input.miniAtlas,
    youAreHere,
    corridors,
    hubs,
    fog: input.fog,
    startHere,
    drift,
    stats: {
      files: input.counts.files,
      symbols: input.counts.symbols,
      relationships: input.counts.relationships,
      territories: parents.length,
      entries: input.entryPoints.length,
    },
    text: "",
  };
  briefing.text = formatBriefing(briefing);
  return briefing;
}

function plainCorridor(c: Corridor): string {
  const stages = c.stages;
  if (stages.length >= 3) {
    return `Requests typically flow ${stages.join(" → ")} (${c.frequency}× observed).`;
  }
  if (stages.length === 2) {
    return `${stages[0]} talks to ${stages[1]} along a recurring path (×${c.frequency}).`;
  }
  return `Corridor ${c.name} (×${c.frequency}).`;
}

function plainHub(h: HubNode): string {
  if (h.role === "bridge") {
    const t = h.territoriesTouched.join(" ↔ ") || "multiple areas";
    return `${h.symbol.name} is a bridge between ${t}.`;
  }
  return `${h.symbol.name} is a hub (${h.inDegree} in / ${h.outDegree} out) — many paths pass through here.`;
}

function suggestStart(
  journey: Journey | null | undefined,
  entries: EntryPoint[],
  hubs: HubNode[],
  territories: Territory[],
): AtlasBriefing["startHere"] {
  if (journey?.stops.length) {
    return {
      journeyName: journey.name,
      firstStop: journey.stops[0]!.name,
      rationale: `Follow the “${journey.name}” journey — ${journey.stops.length} stops from edge to core.`,
    };
  }
  const entry = entries.find((e) => e.category === "http") ?? entries[0];
  if (entry) {
    return {
      journeyName: "Start at the edge",
      firstStop: entry.label,
      rationale: `Begin at ${entry.category} entry “${entry.label}”, then walk downstream into ${territories[0]?.name ?? "the core"}.`,
    };
  }
  const hub = hubs[0];
  if (hub) {
    return {
      journeyName: "Start at a hub",
      firstStop: hub.symbol.name,
      rationale: `${hub.symbol.name} sits at the center of traffic — orient from there.`,
    };
  }
  if (territories[0]) {
    return {
      journeyName: "Survey a territory",
      firstStop: territories[0].name,
      rationale: `Open the ${territories[0].name} territory first — densest charted region.`,
    };
  }
  return undefined;
}

export function formatBriefing(b: AtlasBriefing): string {
  const W = 56;
  const line = (ch = "─") => ch.repeat(W);
  const lines: string[] = [];

  lines.push(`┌${line("─")}┐`);
  lines.push(`│  CARTOGRAPHER · LIVING ATLAS BRIEFING${" ".repeat(Math.max(0, W - 38))}│`);
  lines.push(`│  ${b.repoName}${" ".repeat(Math.max(0, W - b.repoName.length - 1))}│`);
  lines.push(`└${line("─")}┘`);
  lines.push("");

  lines.push(
    `Survey  ${b.stats.files} files · ${b.stats.symbols} symbols · ${b.stats.relationships} edges`,
  );
  lines.push(
    `Map     ${b.stats.territories} territories · ${b.stats.entries} entries · coverage ${Math.round(b.fog.coverage * 100)}%`,
  );
  if (b.meta?.revision) {
    lines.push(`Rev     ${b.meta.revision.slice(0, 12)} · indexed ${b.meta.indexedAt?.slice(0, 19) ?? "—"}`);
  }
  lines.push("");

  // YOU ARE HERE
  lines.push("▸ YOU ARE HERE");
  if (b.youAreHere) {
    lines.push(`  ${b.youAreHere.breadcrumb.join(" › ")}`);
    if (b.youAreHere.territory != null) {
      const conf =
        b.youAreHere.confidence != null
          ? ` (${Math.round(b.youAreHere.confidence * 100)}% confidence)`
          : "";
      lines.push(`  Territory: ${b.youAreHere.territory}${conf}`);
    }
    if (b.youAreHere.symbol) lines.push(`  Symbol:    ${b.youAreHere.symbol}`);
    if (b.youAreHere.file) lines.push(`  At:        ${b.youAreHere.file}`);
  } else {
    lines.push("  (no cursor position — pass a file:line, or open a symbol)");
    lines.push("  Tip: cartographer whereami src/main.ts 42");
  }
  lines.push("");

  // Mini Atlas tree
  lines.push("▸ MINI ATLAS");
  const territories = b.miniAtlas.territories.slice(0, 10);
  if (!territories.length) {
    lines.push("  (empty — run cartographer index)");
  } else {
    const maxSym = Math.max(...territories.map((t) => t.symbols), 1);
    for (const [i, t] of territories.entries()) {
      const branch = i === territories.length - 1 ? "└─" : "├─";
      const barLen = Math.max(1, Math.round((t.symbols / maxSym) * 12));
      const bar = "█".repeat(barLen) + "░".repeat(12 - barLen);
      lines.push(
        `  ${branch} ${t.name.padEnd(14)} ${bar} ${String(t.symbols).padStart(4)}  ${Math.round(t.confidence * 100)}%`,
      );
    }
  }
  lines.push("");

  // Corridors
  lines.push("▸ TOP CORRIDORS");
  if (!b.corridors.length) {
    lines.push("  (no recurring paths yet)");
  } else {
    for (const c of b.corridors) {
      lines.push(`  → ${c.name}  ×${c.frequency}`);
      lines.push(`    ${c.plain}`);
    }
  }
  lines.push("");

  // Hubs & bridges
  lines.push("▸ HUBS & BRIDGES");
  if (!b.hubs.length) {
    lines.push("  (graph too sparse)");
  } else {
    for (const h of b.hubs) {
      const tag = h.role === "bridge" ? "BRIDGE" : "HUB   ";
      lines.push(`  [${tag}] ${h.name}`);
      lines.push(`           ${h.plain}`);
    }
  }
  lines.push("");

  // Fog
  lines.push("▸ FRONTIERS (fog of war)");
  lines.push(`  Understood  ${b.fog.understood.join(", ") || "—"}`);
  lines.push(`  Frontier    ${b.fog.frontier.join(", ") || "—"}`);
  lines.push(`  Beyond      ${b.fog.beyond.join(", ") || "—"}`);
  lines.push("");

  // Start here
  lines.push("▸ START HERE");
  if (b.startHere) {
    lines.push(`  Journey: ${b.startHere.journeyName}`);
    lines.push(`  First:   ${b.startHere.firstStop}`);
    lines.push(`  Why:     ${b.startHere.rationale}`);
  } else {
    lines.push("  Index the repo, then open an entry point.");
  }

  if (b.drift.length) {
    lines.push("");
    lines.push("▸ LANDMARK DRIFT");
    for (const d of b.drift.slice(0, 5)) {
      lines.push(`  ! ${d.name} — ${d.status}`);
    }
  }

  lines.push("");
  lines.push(line("·"));
  lines.push("15-second map · local-first · no telemetry");
  lines.push("Next: cartographer tour | goto <symbol> | unexplored");
  return lines.join("\n");
}

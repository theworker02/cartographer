import type {
  AtlasMeta,
  AtlasSymbol,
  Corridor,
  EntryPoint,
  Landmark,
  Relationship,
  Territory,
} from "../types/index.js";
import type { AtlasStore } from "../storage/atlas-store.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cartographerDir } from "../config/index.js";

export type DoctorSeverity = "ok" | "warn" | "error";

export interface DoctorCheck {
  id: string;
  title: string;
  severity: DoctorSeverity;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  summary: string;
}

/**
 * Atlas integrity / health checks — doctor command.
 */
export function runDoctor(opts: {
  root: string;
  store: AtlasStore | null;
  meta: AtlasMeta | null;
  symbols: AtlasSymbol[];
  relationships: Relationship[];
  territories: Territory[];
  landmarks: Landmark[];
  corridors: Corridor[];
  entryPoints: EntryPoint[];
}): DoctorReport {
  const checks: DoctorCheck[] = [];
  const dir = cartographerDir(opts.root);
  const dbPath = join(dir, "atlas.db");

  checks.push({
    id: "atlas-dir",
    title: "Cartographer directory",
    severity: existsSync(dir) ? "ok" : "error",
    detail: existsSync(dir) ? `.cartographer present at ${dir}` : "Missing .cartographer — run `cartographer index`",
  });

  checks.push({
    id: "atlas-db",
    title: "Atlas database",
    severity: existsSync(dbPath) ? "ok" : "error",
    detail: existsSync(dbPath) ? `SQLite atlas at ${dbPath}` : "atlas.db missing",
  });

  if (!opts.store || !opts.meta) {
    checks.push({
      id: "indexed",
      title: "Index state",
      severity: "error",
      detail: "No atlas metadata — repository has not been indexed",
    });
  } else {
    checks.push({
      id: "indexed",
      title: "Index state",
      severity: "ok",
      detail: `Indexed ${opts.meta.indexedAt} · ${opts.meta.symbolCount} symbols · ${opts.meta.fileCount} files · rev ${opts.meta.revision ?? "n/a"}`,
    });
  }

  const dangling = findDanglingRelationships(opts.symbols, opts.relationships);
  checks.push({
    id: "relationships",
    title: "Relationship integrity",
    severity: dangling === 0 ? "ok" : dangling > 20 ? "error" : "warn",
    detail:
      dangling === 0
        ? `${opts.relationships.length} relationships; no dangling endpoints`
        : `${dangling} relationships reference missing symbols`,
  });

  checks.push({
    id: "territories",
    title: "Territory coverage",
    severity: opts.territories.length ? "ok" : "warn",
    detail: opts.territories.length
      ? `${opts.territories.filter((t) => !t.parentId).length} top-level territories`
      : "No territories inferred",
  });

  const uncovered = opts.symbols.filter(
    (s) =>
      s.kind !== "file" &&
      s.kind !== "module" &&
      !opts.territories.some((t) => t.symbolIds.includes(s.id)),
  ).length;
  checks.push({
    id: "territory-coverage",
    title: "Symbol territory assignment",
    severity: uncovered > opts.symbols.length * 0.5 ? "warn" : "ok",
    detail: `${uncovered} symbols outside territories`,
  });

  const drifted = opts.landmarks.filter((l) => l.driftStatus && l.driftStatus !== "ok");
  checks.push({
    id: "landmark-drift",
    title: "Landmark drift",
    severity: drifted.some((l) => l.driftStatus === "missing")
      ? "error"
      : drifted.length
        ? "warn"
        : "ok",
    detail: drifted.length
      ? `${drifted.length}/${opts.landmarks.length} landmarks need review (${drifted.map((l) => l.name).slice(0, 5).join(", ")})`
      : `${opts.landmarks.length} landmarks stable`,
  });

  checks.push({
    id: "entry-points",
    title: "Entry points",
    severity: opts.entryPoints.length ? "ok" : "warn",
    detail: opts.entryPoints.length
      ? `${opts.entryPoints.length} entry points detected`
      : "No entry points — navigation may be limited",
  });

  checks.push({
    id: "corridors",
    title: "Corridors",
    severity: "ok",
    detail: `${opts.corridors.length} architectural corridors`,
  });

  const orphanFiles = opts.symbols.filter((s) => s.kind === "file").length;
  checks.push({
    id: "files",
    title: "File symbols",
    severity: orphanFiles ? "ok" : "warn",
    detail: `${orphanFiles} file nodes in graph`,
  });

  const errors = checks.filter((c) => c.severity === "error").length;
  const warns = checks.filter((c) => c.severity === "warn").length;
  const ok = errors === 0;
  const summary = ok
    ? `Atlas healthy${warns ? ` with ${warns} warning(s)` : ""}`
    : `Atlas needs attention: ${errors} error(s), ${warns} warning(s)`;

  return { ok, checks, summary };
}

function findDanglingRelationships(
  symbols: AtlasSymbol[],
  relationships: Relationship[],
): number {
  const ids = new Set(symbols.map((s) => s.id));
  let n = 0;
  for (const r of relationships) {
    if (!ids.has(r.fromId) || !ids.has(r.toId)) n++;
  }
  return n;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ["Cartographer Doctor", "───────────────────", report.summary, ""];
  for (const c of report.checks) {
    const mark = c.severity === "ok" ? "✓" : c.severity === "warn" ? "!" : "✗";
    lines.push(`${mark} [${c.severity}] ${c.title}`);
    lines.push(`    ${c.detail}`);
  }
  return lines.join("\n");
}

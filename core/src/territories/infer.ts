import { basename, dirname } from "node:path";
import type { AtlasSymbol, Relationship, Territory, TerritoryEvidence } from "../types/index.js";

const TERRITORY_HINTS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "API", patterns: [/\/api\//i, /\/routes?\//i, /\/handlers?\//i, /\/controllers?\//i, /\/endpoints?\//i] },
  { name: "Auth", patterns: [/\/auth\b/i, /\/identity\//i, /\/session\//i, /\/oauth\//i] },
  { name: "Domain", patterns: [/\/domain\//i, /\/models?\//i, /\/entities?\//i, /\/core\//i] },
  { name: "Data", patterns: [/\/db\//i, /\/data\//i, /\/repos?(itory)?\//i, /\/persistence\//i, /\/prisma\//i, /\/sql\//i] },
  { name: "UI", patterns: [/\/components?\//i, /\/ui\//i, /\/views?\//i, /\/pages?\//i, /\/app\//i] },
  { name: "CLI", patterns: [/\/cli\//i, /\/cmd\//i, /\/commands?\//i] },
  { name: "Workers", patterns: [/\/workers?\//i, /\/jobs?\//i, /\/queues?\//i, /\/cron\//i] },
  { name: "Config", patterns: [/\/config\//i, /\/settings?\//i] },
  { name: "Adapters", patterns: [/\/adapters?\//i, /\/integrations?\//i, /\/clients?\//i, /\/providers?\//i] },
  { name: "MCP", patterns: [/\/mcp\//i] },
  { name: "Tests", patterns: [/\/tests?\//i, /\/__tests__\//i, /\/spec\//i, /_test\./i, /\.test\./i, /\.spec\./i] },
  { name: "Utils", patterns: [/\/utils?\//i, /\/helpers?\//i, /\/lib\//i, /\/shared\//i] },
];

/**
 * Infer territories from directory structure, package boundaries, and connectivity.
 */
export function inferTerritories(
  _root: string,
  symbols: AtlasSymbol[],
  relationships: Relationship[],
): Territory[] {
  const files = [...new Set(symbols.map((s) => s.location.file.replace(/\\/g, "/")))];
  const buckets = new Map<string, { files: Set<string>; symbols: Set<string>; score: number }>();

  for (const file of files) {
    const hint = matchHint(file) ?? directoryBucket(file);
    const bucket = buckets.get(hint) ?? {
      files: new Set<string>(),
      symbols: new Set<string>(),
      score: 0.7,
    };
    bucket.files.add(file);
    buckets.set(hint, bucket);
  }

  for (const s of symbols) {
    if (s.kind === "module") continue;
    const file = s.location.file.replace(/\\/g, "/");
    const hint = matchHint(file) ?? directoryBucket(file);
    const bucket = buckets.get(hint);
    if (bucket) bucket.symbols.add(s.id);
  }

  // Density: internal vs external edges boost confidence
  const fileToTerritory = new Map<string, string>();
  for (const [name, b] of buckets) {
    for (const f of b.files) fileToTerritory.set(f, name);
  }

  const symbolFile = new Map(symbols.map((s) => [s.id, s.location.file.replace(/\\/g, "/")]));
  const territories: Territory[] = [];

  for (const [name, bucket] of buckets) {
    if (bucket.files.size === 0) continue;
    let internal = 0;
    let external = 0;
    for (const r of relationships) {
      if (r.kind === "contains") continue;
      const fromFile = symbolFile.get(r.fromId);
      const toFile = symbolFile.get(r.toId);
      if (!fromFile || !toFile) continue;
      const fromT = fileToTerritory.get(fromFile);
      const toT = fileToTerritory.get(toFile);
      if (fromT !== name && toT !== name) continue;
      if (fromT === name && toT === name) internal++;
      else external++;
    }
    const density =
      internal + external === 0 ? 0.5 : internal / (internal + external);
    const confidence = Math.min(0.98, 0.55 + density * 0.35 + Math.min(bucket.files.size, 20) * 0.01);

    const packages = [...new Set([...bucket.files].map((f) => topPackage(f)))].filter(Boolean);
    const dirs = [...new Set([...bucket.files].map((f) => dirname(f)))].slice(0, 12);
    const evidence: TerritoryEvidence = {
      packages,
      directories: dirs,
      symbols: bucket.symbols.size,
      internal_density: Number(density.toFixed(3)),
      naming_signals: [name.toLowerCase()],
    };

    territories.push({
      id: `territory:${slug(name)}`,
      name,
      confidence: Number(confidence.toFixed(3)),
      evidence,
      symbolIds: [...bucket.symbols],
      filePaths: [...bucket.files].sort(),
    });
  }

  // Sub-territories for large buckets: second path segment
  const expanded: Territory[] = [...territories];
  for (const t of territories) {
    if (t.filePaths.length < 8) continue;
    const children = new Map<string, string[]>();
    for (const f of t.filePaths) {
      const parts = f.split("/").filter(Boolean);
      const key = parts.length >= 2 ? parts[1]! : parts[0] ?? "root";
      const list = children.get(key) ?? [];
      list.push(f);
      children.set(key, list);
    }
    if (children.size < 2) continue;
    for (const [childName, childFiles] of children) {
      if (childFiles.length < 2) continue;
      const childSymbols = symbols
        .filter((s) => childFiles.includes(s.location.file.replace(/\\/g, "/")))
        .map((s) => s.id);
      expanded.push({
        id: `territory:${slug(t.name)}:${slug(childName)}`,
        name: `${t.name}/${childName}`,
        parentId: t.id,
        confidence: Math.max(0.5, t.confidence - 0.1),
        evidence: {
          packages: t.evidence.packages,
          directories: [...new Set(childFiles.map((f) => dirname(f)))].slice(0, 8),
          symbols: childSymbols.length,
          internal_density: t.evidence.internal_density,
          naming_signals: [childName],
        },
        symbolIds: childSymbols,
        filePaths: childFiles,
      });
    }
  }

  return expanded.sort((a, b) => b.evidence.symbols - a.evidence.symbols);
}

function matchHint(file: string): string | null {
  for (const hint of TERRITORY_HINTS) {
    if (hint.patterns.some((p) => p.test(file))) return hint.name;
  }
  return null;
}

function directoryBucket(file: string): string {
  const parts = file.split("/").filter(Boolean);
  if (parts.length === 1) return "Root";
  // Prefer first meaningful segment
  const skip = new Set(["src", "lib", "pkg", "internal", "app", "packages"]);
  for (const p of parts.slice(0, -1)) {
    if (!skip.has(p.toLowerCase())) {
      return titleCase(p);
    }
  }
  return titleCase(parts[0] ?? "Root");
}

function topPackage(file: string): string {
  const parts = file.split("/").filter(Boolean);
  return parts[0] ?? basename(file);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

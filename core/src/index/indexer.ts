import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { relative, join } from "node:path";
import fg from "fast-glob";
import ignore from "ignore";
import { existsSync, readFileSync as read } from "node:fs";
import { getAdapterForFile } from "../../../adapters/src/index.js";
import {
  loadConfig,
  resolveIgnorePatterns,
  ensureCartographerDir,
  writeDefaultConfig,
} from "../config/index.js";
import { AtlasStore } from "../storage/atlas-store.js";
import { inferTerritories } from "../territories/infer.js";
import { detectCorridors } from "../routes/corridors.js";
import { computeImportance } from "../graph/importance.js";
import { detectEntryPoints, detectEffects } from "../graph/entry-points.js";
import { linkCrossFileCalls } from "../graph/cross-file.js";
import type {
  AtlasMeta,
  AtlasSymbol,
  IndexProgress,
  LanguageId,
  Relationship,
} from "../types/index.js";
import { getGitRevision } from "../history/git.js";
import { syncLandmarksFromDisk } from "../landmarks/index.js";
import { ensureExplorationFile } from "../exploration/index.js";

export type ProgressCallback = (p: IndexProgress) => void;

export interface IndexOptions {
  root: string;
  incremental?: boolean;
  onProgress?: ProgressCallback;
}

export interface IndexResult {
  meta: AtlasMeta;
  store: AtlasStore;
}

const SOURCE_GLOBS = [
  "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,py,go,rs}",
];

export async function indexRepository(opts: IndexOptions): Promise<IndexResult> {
  const root = opts.root;
  ensureCartographerDir(root);
  writeDefaultConfig(root);
  const config = loadConfig(root);
  const store = AtlasStore.open(root);

  const ig = ignore().add(resolveIgnorePatterns(root, config));
  const gitignorePath = join(root, ".gitignore");
  if (existsSync(gitignorePath)) {
    ig.add(read(gitignorePath, "utf8"));
  }

  opts.onProgress?.({
    phase: "survey",
    files: 0,
    languages: 0,
    symbols: 0,
    relationships: 0,
    entryPoints: 0,
    message: "Surveying repository...",
  });

  const entries = await fg(SOURCE_GLOBS, {
    cwd: root,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
    onlyFiles: true,
    suppressErrors: true,
  });

  const files = entries
    .map((abs) => ({ abs, rel: relative(root, abs).replace(/\\/g, "/") }))
    .filter(({ rel }) => !ig.ignores(rel))
    .filter(({ abs }) => {
      try {
        const st = statSync(abs);
        return st.isFile() && st.size <= config.index.maxFileBytes;
      } catch {
        return false;
      }
    });

  const languages = new Set<LanguageId>();
  const allSymbols: AtlasSymbol[] = [];
  const allRels: Relationship[] = [];
  const changedFiles: string[] = [];

  let processed = 0;
  for (const { abs, rel } of files) {
    processed++;
    const adapter = getAdapterForFile(rel);
    if (!adapter) continue;

    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    // Skip binary-looking files
    if (source.includes("\u0000")) continue;

    const hash = createHash("sha256").update(source).digest("hex");
    if (opts.incremental) {
      const prev = store.getFileHash(rel);
      if (prev === hash) continue;
      store.deleteSymbolsInFiles([rel]);
    }

    languages.add(adapter.id);
    changedFiles.push(rel);

    const result = adapter.parse(rel, source);
    allSymbols.push(...result.symbols);
    allRels.push(...result.relationships);
    store.setFileHash(rel, hash);

    if (processed % 50 === 0 || processed === files.length) {
      opts.onProgress?.({
        phase: "extract",
        files: files.length,
        languages: languages.size,
        symbols: allSymbols.length + store.counts().symbols,
        relationships: allRels.length + store.counts().relationships,
        entryPoints: 0,
        message: `Parsing ${rel}`,
      });
    }
  }

  if (!opts.incremental) {
    store.clearGraph();
  }

  // Cross-file call linking on the combined symbol set
  const existing = opts.incremental ? store.allSymbols() : [];
  const symbolIndex = [...existing, ...allSymbols];
  const cross = linkCrossFileCalls(symbolIndex, allRels);
  allRels.push(...cross);

  store.upsertSymbols(allSymbols);
  store.upsertRelationships(allRels);

  const symbols = store.allSymbols();
  const relationships = store.allRelationships();

  opts.onProgress?.({
    phase: "importance",
    files: files.length,
    languages: languages.size,
    symbols: symbols.length,
    relationships: relationships.length,
    entryPoints: 0,
    message: "Ranking architectural importance...",
  });

  const withImportance = computeImportance(symbols, relationships);
  store.upsertSymbols(withImportance);

  const entryPoints = detectEntryPoints(withImportance, relationships);
  store.replaceEntryPoints(entryPoints);

  const effects = detectEffects(withImportance, relationships);
  store.replaceEffects(effects);

  opts.onProgress?.({
    phase: "territories",
    files: files.length,
    languages: languages.size,
    symbols: withImportance.length,
    relationships: relationships.length,
    entryPoints: entryPoints.length,
    message: "Building territories...",
  });

  const territories = inferTerritories(root, withImportance, relationships);
  // stamp territory ids onto symbols
  const stamped = withImportance.map((s) => {
    const t = territories.find((tr) => tr.symbolIds.includes(s.id));
    return t ? { ...s, territoryId: t.id } : s;
  });
  store.upsertSymbols(stamped);
  store.replaceTerritories(territories);

  const corridors = detectCorridors(stamped, relationships, territories);
  store.replaceCorridors(corridors);

  opts.onProgress?.({
    phase: "landmarks",
    files: files.length,
    languages: languages.size,
    symbols: stamped.length,
    relationships: relationships.length,
    entryPoints: entryPoints.length,
    message: "Checking landmark drift...",
  });

  syncLandmarksFromDisk(root, store, stamped);
  ensureExplorationFile(root);

  const revision = getGitRevision(root);
  const meta: AtlasMeta = {
    version: 1,
    root,
    revision: revision ?? undefined,
    indexedAt: new Date().toISOString(),
    languages: [...languages],
    fileCount: files.length,
    symbolCount: stamped.length,
    relationshipCount: relationships.length,
  };
  store.setMeta(meta);

  opts.onProgress?.({
    phase: "ready",
    files: files.length,
    languages: languages.size,
    symbols: stamped.length,
    relationships: relationships.length,
    entryPoints: entryPoints.length,
    message: "Atlas ready.",
  });

  void changedFiles;

  return { meta, store };
}

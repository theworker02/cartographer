import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  AtlasMeta,
  AtlasSymbol,
  Relationship,
  Territory,
  Landmark,
  Corridor,
  EntryPoint,
  Effect,
} from "../types/index.js";
import { cartographerDir } from "../config/index.js";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  file TEXT NOT NULL,
  line INTEGER NOT NULL,
  column_n INTEGER,
  end_line INTEGER,
  signature TEXT,
  exported INTEGER DEFAULT 0,
  entry_point INTEGER DEFAULT 0,
  generated INTEGER DEFAULT 0,
  importance REAL DEFAULT 0,
  territory_id TEXT,
  content_hash TEXT,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_qname ON symbols(qualified_name);
CREATE INDEX IF NOT EXISTS idx_symbols_territory ON symbols(territory_id);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_importance ON symbols(importance DESC);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  band TEXT NOT NULL,
  file TEXT,
  line INTEGER,
  evidence TEXT
);

CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships(from_id);
CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships(to_id);
CREATE INDEX IF NOT EXISTS idx_rel_kind ON relationships(kind);

CREATE TABLE IF NOT EXISTS territories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  confidence REAL NOT NULL,
  evidence TEXT NOT NULL,
  symbol_ids TEXT NOT NULL,
  file_paths TEXT NOT NULL,
  annotations TEXT
);

CREATE TABLE IF NOT EXISTS landmarks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  symbol_id TEXT,
  file TEXT NOT NULL,
  line INTEGER NOT NULL,
  commit_sha TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  drift_status TEXT,
  drift_confidence REAL,
  suggested_file TEXT,
  suggested_line INTEGER
);

CREATE TABLE IF NOT EXISTS corridors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stages TEXT NOT NULL,
  frequency INTEGER NOT NULL,
  examples TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_points (
  symbol_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS effects (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  symbol_id TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS file_hashes (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);
`;

function asRows<T>(result: unknown): T[] {
  return result as T[];
}

function asRow<T>(result: unknown): T | undefined {
  return result as T | undefined;
}

export class AtlasStore {
  readonly db: DatabaseSync;
  readonly dbPath: string;
  readonly root: string;

  constructor(root: string, dbPath?: string) {
    this.root = root;
    const dir = cartographerDir(root);
    mkdirSync(dir, { recursive: true });
    this.dbPath = dbPath ?? join(dir, "atlas.db");
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(SCHEMA);
  }

  static open(root: string): AtlasStore {
    return new AtlasStore(root);
  }

  static exists(root: string): boolean {
    return existsSync(join(cartographerDir(root), "atlas.db"));
  }

  close(): void {
    this.db.close();
  }

  clearGraph(): void {
    this.db.exec(`
      DELETE FROM relationships;
      DELETE FROM symbols;
      DELETE FROM territories;
      DELETE FROM corridors;
      DELETE FROM entry_points;
      DELETE FROM effects;
      DELETE FROM file_hashes;
    `);
  }

  setMeta(meta: AtlasMeta): void {
    const stmt = this.db.prepare(
      `INSERT INTO meta(key, value) VALUES(?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    for (const [key, value] of Object.entries(meta)) {
      if (value === undefined) continue;
      stmt.run(key, JSON.stringify(value));
    }
  }

  getMeta(): AtlasMeta | null {
    const metaRows = asRows<{ key: string; value: string }>(
      this.db.prepare(`SELECT key, value FROM meta`).all(),
    );
    if (!metaRows.length) return null;
    const obj: Record<string, unknown> = {};
    for (const r of metaRows) {
      obj[r.key] = JSON.parse(r.value);
    }
    if (!obj.version) return null;
    return obj as unknown as AtlasMeta;
  }

  upsertSymbols(symbols: AtlasSymbol[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO symbols(
        id, name, qualified_name, kind, language, file, line, column_n, end_line,
        signature, exported, entry_point, generated, importance, territory_id, content_hash, metadata
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, qualified_name=excluded.qualified_name, kind=excluded.kind,
        language=excluded.language, file=excluded.file, line=excluded.line, column_n=excluded.column_n,
        end_line=excluded.end_line, signature=excluded.signature, exported=excluded.exported,
        entry_point=excluded.entry_point, generated=excluded.generated, importance=excluded.importance,
        territory_id=excluded.territory_id, content_hash=excluded.content_hash, metadata=excluded.metadata
    `);
    this.db.exec("BEGIN");
    try {
      for (const s of symbols) {
        stmt.run(
          s.id,
          s.name,
          s.qualifiedName,
          s.kind,
          s.language,
          s.location.file,
          s.location.line,
          s.location.column ?? null,
          s.location.endLine ?? null,
          s.signature ?? null,
          s.exported ? 1 : 0,
          s.entryPoint ? 1 : 0,
          s.generated ? 1 : 0,
          s.importance ?? 0,
          s.territoryId ?? null,
          s.contentHash ?? null,
          s.metadata ? JSON.stringify(s.metadata) : null,
        );
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  upsertRelationships(rels: Relationship[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO relationships(id, kind, from_id, to_id, confidence, band, file, line, evidence)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        kind=excluded.kind, from_id=excluded.from_id, to_id=excluded.to_id,
        confidence=excluded.confidence, band=excluded.band, file=excluded.file,
        line=excluded.line, evidence=excluded.evidence
    `);
    this.db.exec("BEGIN");
    try {
      for (const r of rels) {
        stmt.run(
          r.id,
          r.kind,
          r.fromId,
          r.toId,
          r.confidence,
          r.band,
          r.location?.file ?? null,
          r.location?.line ?? null,
          r.evidence ?? null,
        );
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  replaceTerritories(territories: Territory[]): void {
    this.db.exec("DELETE FROM territories");
    const stmt = this.db.prepare(`
      INSERT INTO territories(id, name, parent_id, confidence, evidence, symbol_ids, file_paths, annotations)
      VALUES(?,?,?,?,?,?,?,?)
    `);
    this.db.exec("BEGIN");
    try {
      for (const t of territories) {
        stmt.run(
          t.id,
          t.name,
          t.parentId ?? null,
          t.confidence,
          JSON.stringify(t.evidence),
          JSON.stringify(t.symbolIds),
          JSON.stringify(t.filePaths),
          t.annotations ? JSON.stringify(t.annotations) : null,
        );
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  replaceCorridors(corridors: Corridor[]): void {
    this.db.exec("DELETE FROM corridors");
    const stmt = this.db.prepare(
      `INSERT INTO corridors(id, name, stages, frequency, examples) VALUES(?,?,?,?,?)`,
    );
    for (const c of corridors) {
      stmt.run(
        c.id,
        c.name,
        JSON.stringify(c.stages),
        c.frequency,
        JSON.stringify(c.examples),
      );
    }
  }

  replaceEntryPoints(entries: EntryPoint[]): void {
    this.db.exec("DELETE FROM entry_points");
    const stmt = this.db.prepare(
      `INSERT INTO entry_points(symbol_id, category, label) VALUES(?,?,?)`,
    );
    for (const e of entries) {
      stmt.run(e.symbol.id, e.category, e.label);
    }
  }

  replaceEffects(effects: Effect[]): void {
    this.db.exec("DELETE FROM effects");
    const stmt = this.db.prepare(
      `INSERT INTO effects(id, kind, symbol_id, description, confidence) VALUES(?,?,?,?,?)`,
    );
    effects.forEach((e, i) => {
      stmt.run(`effect:${i}:${e.symbolId}`, e.kind, e.symbolId, e.description, e.confidence);
    });
  }

  getSymbol(id: string): AtlasSymbol | null {
    const found = asRow<SymbolRow>(
      this.db.prepare(`SELECT * FROM symbols WHERE id = ?`).get(id),
    );
    return found ? rowToSymbol(found) : null;
  }

  findSymbolsByName(name: string, limit = 25): AtlasSymbol[] {
    const needle = name.toLowerCase();
    const exact = asRows<SymbolRow>(
      this.db
        .prepare(
          `SELECT * FROM symbols
         WHERE lower(name) = ? OR lower(qualified_name) = ?
         ORDER BY importance DESC LIMIT ?`,
        )
        .all(needle, needle, limit),
    ).map(rowToSymbol);
    if (exact.length) return exact;
    return asRows<SymbolRow>(
      this.db
        .prepare(
          `SELECT * FROM symbols
         WHERE lower(name) LIKE ? OR lower(qualified_name) LIKE ?
         ORDER BY importance DESC LIMIT ?`,
        )
        .all(`%${needle}%`, `%${needle}%`, limit),
    ).map(rowToSymbol);
  }

  findSymbolAt(file: string, line: number): AtlasSymbol | null {
    const normalized = file.replace(/\\/g, "/");
    const found = asRow<SymbolRow>(
      this.db
        .prepare(
          `SELECT * FROM symbols
         WHERE replace(file, '\\', '/') = ?
           AND line <= ?
           AND (end_line IS NULL OR end_line >= ?)
         ORDER BY line DESC LIMIT 1`,
        )
        .get(normalized, line, line),
    );
    if (found) return rowToSymbol(found);
    const near = asRow<SymbolRow>(
      this.db
        .prepare(
          `SELECT * FROM symbols WHERE replace(file, '\\', '/') = ?
         ORDER BY abs(line - ?) ASC LIMIT 1`,
        )
        .get(normalized, line),
    );
    return near ? rowToSymbol(near) : null;
  }

  allSymbols(): AtlasSymbol[] {
    return asRows<SymbolRow>(this.db.prepare(`SELECT * FROM symbols`).all()).map(
      rowToSymbol,
    );
  }

  symbolsInFile(file: string): AtlasSymbol[] {
    const normalized = file.replace(/\\/g, "/");
    return asRows<SymbolRow>(
      this.db
        .prepare(`SELECT * FROM symbols WHERE replace(file, '\\', '/') = ?`)
        .all(normalized),
    ).map(rowToSymbol);
  }

  relationshipsFrom(id: string): Relationship[] {
    return asRows<RelRow>(
      this.db.prepare(`SELECT * FROM relationships WHERE from_id = ?`).all(id),
    ).map(rowToRel);
  }

  relationshipsTo(id: string): Relationship[] {
    return asRows<RelRow>(
      this.db.prepare(`SELECT * FROM relationships WHERE to_id = ?`).all(id),
    ).map(rowToRel);
  }

  allRelationships(): Relationship[] {
    return asRows<RelRow>(this.db.prepare(`SELECT * FROM relationships`).all()).map(
      rowToRel,
    );
  }

  allTerritories(): Territory[] {
    return asRows<TerritoryRow>(
      this.db.prepare(`SELECT * FROM territories`).all(),
    ).map(rowToTerritory);
  }

  getTerritory(id: string): Territory | null {
    const found = asRow<TerritoryRow>(
      this.db.prepare(`SELECT * FROM territories WHERE id = ?`).get(id),
    );
    return found ? rowToTerritory(found) : null;
  }

  findTerritoryByName(name: string): Territory | null {
    const found = asRow<TerritoryRow>(
      this.db
        .prepare(`SELECT * FROM territories WHERE lower(name) = lower(?)`)
        .get(name),
    );
    return found ? rowToTerritory(found) : null;
  }

  setLandmark(landmark: Landmark): void {
    this.db
      .prepare(
        `INSERT INTO landmarks(
          id, name, description, symbol_id, file, line, commit_sha,
          created_at, updated_at, drift_status, drift_confidence, suggested_file, suggested_line
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, description=excluded.description, symbol_id=excluded.symbol_id,
          file=excluded.file, line=excluded.line, commit_sha=excluded.commit_sha,
          updated_at=excluded.updated_at, drift_status=excluded.drift_status,
          drift_confidence=excluded.drift_confidence, suggested_file=excluded.suggested_file,
          suggested_line=excluded.suggested_line`,
      )
      .run(
        landmark.id,
        landmark.name,
        landmark.description,
        landmark.symbolId ?? null,
        landmark.location.file,
        landmark.location.line,
        landmark.commit ?? null,
        landmark.createdAt,
        landmark.updatedAt,
        landmark.driftStatus ?? null,
        landmark.driftConfidence ?? null,
        landmark.suggestedLocation?.file ?? null,
        landmark.suggestedLocation?.line ?? null,
      );
  }

  allLandmarks(): Landmark[] {
    return asRows<LandmarkRow>(this.db.prepare(`SELECT * FROM landmarks`).all()).map(
      rowToLandmark,
    );
  }

  allCorridors(): Corridor[] {
    return asRows<CorridorRow>(this.db.prepare(`SELECT * FROM corridors`).all()).map(
      (r) => ({
        id: r.id,
        name: r.name,
        stages: JSON.parse(r.stages) as string[],
        frequency: r.frequency,
        examples: JSON.parse(r.examples) as string[],
      }),
    );
  }

  allEntryPoints(): EntryPoint[] {
    return asRows<SymbolRow & { category: string; label: string }>(
      this.db
        .prepare(
          `SELECT e.category, e.label, s.* FROM entry_points e
         JOIN symbols s ON s.id = e.symbol_id`,
        )
        .all(),
    ).map((r) => ({
      symbol: rowToSymbol(r),
      category: r.category as EntryPoint["category"],
      label: r.label,
    }));
  }

  allEffects(): Effect[] {
    return asRows<{
      kind: Effect["kind"];
      symbol_id: string;
      description: string;
      confidence: number;
    }>(this.db.prepare(`SELECT * FROM effects`).all()).map((r) => ({
      kind: r.kind,
      symbolId: r.symbol_id,
      description: r.description,
      confidence: r.confidence,
    }));
  }

  setFileHash(path: string, hash: string): void {
    this.db
      .prepare(
        `INSERT INTO file_hashes(path, hash, indexed_at) VALUES(?,?,?)
         ON CONFLICT(path) DO UPDATE SET hash=excluded.hash, indexed_at=excluded.indexed_at`,
      )
      .run(path, hash, new Date().toISOString());
  }

  getFileHash(path: string): string | null {
    const found = asRow<{ hash: string }>(
      this.db.prepare(`SELECT hash FROM file_hashes WHERE path = ?`).get(path),
    );
    return found?.hash ?? null;
  }

  deleteSymbolsInFiles(files: string[]): void {
    if (!files.length) return;
    const symbolIds = asRows<{ id: string }>(
      this.db
        .prepare(
          `SELECT id FROM symbols WHERE file IN (${files.map(() => "?").join(",")})`,
        )
        .all(...files),
    ).map((r) => r.id);
    this.db.exec("BEGIN");
    try {
      for (const file of files) {
        this.db.prepare(`DELETE FROM symbols WHERE file = ?`).run(file);
        this.db.prepare(`DELETE FROM file_hashes WHERE path = ?`).run(file);
      }
      for (const id of symbolIds) {
        this.db.prepare(`DELETE FROM relationships WHERE from_id = ? OR to_id = ?`).run(id, id);
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  counts(): { symbols: number; relationships: number; territories: number; files: number } {
    const symbols = asRow<{ c: number }>(
      this.db.prepare(`SELECT COUNT(*) AS c FROM symbols`).get(),
    )!.c;
    const relationships = asRow<{ c: number }>(
      this.db.prepare(`SELECT COUNT(*) AS c FROM relationships`).get(),
    )!.c;
    const territories = asRow<{ c: number }>(
      this.db.prepare(`SELECT COUNT(*) AS c FROM territories`).get(),
    )!.c;
    const files = asRow<{ c: number }>(
      this.db.prepare(`SELECT COUNT(DISTINCT file) AS c FROM symbols`).get(),
    )!.c;
    return { symbols, relationships, territories, files };
  }
}

interface SymbolRow {
  id: string;
  name: string;
  qualified_name: string;
  kind: string;
  language: string;
  file: string;
  line: number;
  column_n: number | null;
  end_line: number | null;
  signature: string | null;
  exported: number;
  entry_point: number;
  generated: number;
  importance: number;
  territory_id: string | null;
  content_hash: string | null;
  metadata: string | null;
}

interface RelRow {
  id: string;
  kind: string;
  from_id: string;
  to_id: string;
  confidence: number;
  band: string;
  file: string | null;
  line: number | null;
  evidence: string | null;
}

interface TerritoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  confidence: number;
  evidence: string;
  symbol_ids: string;
  file_paths: string;
  annotations: string | null;
}

interface LandmarkRow {
  id: string;
  name: string;
  description: string;
  symbol_id: string | null;
  file: string;
  line: number;
  commit_sha: string | null;
  created_at: string;
  updated_at: string;
  drift_status: string | null;
  drift_confidence: number | null;
  suggested_file: string | null;
  suggested_line: number | null;
}

interface CorridorRow {
  id: string;
  name: string;
  stages: string;
  frequency: number;
  examples: string;
}

function rowToSymbol(r: SymbolRow): AtlasSymbol {
  return {
    id: r.id,
    name: r.name,
    qualifiedName: r.qualified_name,
    kind: r.kind as AtlasSymbol["kind"],
    language: r.language as AtlasSymbol["language"],
    location: {
      file: r.file,
      line: r.line,
      column: r.column_n ?? undefined,
      endLine: r.end_line ?? undefined,
    },
    signature: r.signature ?? undefined,
    exported: !!r.exported,
    entryPoint: !!r.entry_point,
    generated: !!r.generated,
    importance: r.importance,
    territoryId: r.territory_id ?? undefined,
    contentHash: r.content_hash ?? undefined,
    metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : undefined,
  };
}

function rowToRel(r: RelRow): Relationship {
  return {
    id: r.id,
    kind: r.kind as Relationship["kind"],
    fromId: r.from_id,
    toId: r.to_id,
    confidence: r.confidence,
    band: r.band as Relationship["band"],
    location:
      r.file != null
        ? { file: r.file, line: r.line ?? 1 }
        : undefined,
    evidence: r.evidence ?? undefined,
  };
}

function rowToTerritory(r: TerritoryRow): Territory {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parent_id ?? undefined,
    confidence: r.confidence,
    evidence: JSON.parse(r.evidence),
    symbolIds: JSON.parse(r.symbol_ids),
    filePaths: JSON.parse(r.file_paths),
    annotations: r.annotations ? JSON.parse(r.annotations) : undefined,
  };
}

function rowToLandmark(r: LandmarkRow): Landmark {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    symbolId: r.symbol_id ?? undefined,
    location: { file: r.file, line: r.line },
    commit: r.commit_sha ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    driftStatus: (r.drift_status as Landmark["driftStatus"]) ?? undefined,
    driftConfidence: r.drift_confidence ?? undefined,
    suggestedLocation:
      r.suggested_file != null
        ? { file: r.suggested_file, line: r.suggested_line ?? 1 }
        : undefined,
  };
}

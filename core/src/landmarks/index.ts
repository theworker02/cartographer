import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AtlasSymbol, Landmark, SourceLocation } from "../types/index.js";
import { cartographerDir, ensureCartographerDir } from "../config/index.js";
import type { AtlasStore } from "../storage/atlas-store.js";

export function landmarksPath(root: string): string {
  return join(cartographerDir(root), "landmarks.json");
}

export function loadLandmarksFile(root: string): Landmark[] {
  const path = landmarksPath(root);
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Landmark[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveLandmarksFile(root: string, landmarks: Landmark[]): void {
  ensureCartographerDir(root);
  writeFileSync(landmarksPath(root), JSON.stringify(landmarks, null, 2) + "\n", "utf8");
}

export function upsertLandmark(root: string, store: AtlasStore, landmark: Landmark): Landmark {
  store.setLandmark(landmark);
  const all = loadLandmarksFile(root);
  const idx = all.findIndex((l) => l.id === landmark.id);
  if (idx >= 0) all[idx] = landmark;
  else all.push(landmark);
  saveLandmarksFile(root, all);
  return landmark;
}

export function createLandmark(
  root: string,
  store: AtlasStore,
  opts: {
    name: string;
    description: string;
    location: SourceLocation;
    symbolId?: string;
    commit?: string;
  },
): Landmark {
  const now = new Date().toISOString();
  const id = `landmark:${slug(opts.name)}:${opts.location.file}:${opts.location.line}`;
  const landmark: Landmark = {
    id,
    name: opts.name,
    description: opts.description,
    symbolId: opts.symbolId,
    location: opts.location,
    commit: opts.commit,
    createdAt: now,
    updatedAt: now,
    driftStatus: "ok",
    driftConfidence: 1,
  };
  return upsertLandmark(root, store, landmark);
}

/**
 * Landmark drift detection — run on index.
 * Reconciles pinned landmarks against current symbol graph.
 */
export function detectLandmarkDrift(
  landmarks: Landmark[],
  symbols: AtlasSymbol[],
): Landmark[] {
  return landmarks.map((lm) => {
    const byId = lm.symbolId ? symbols.find((s) => s.id === lm.symbolId) : undefined;
    if (byId) {
      const moved =
        byId.location.file !== lm.location.file ||
        Math.abs(byId.location.line - lm.location.line) > 5;
      if (!moved) {
        return { ...lm, driftStatus: "ok" as const, driftConfidence: 1, suggestedLocation: undefined };
      }
      return {
        ...lm,
        driftStatus: "needs_review" as const,
        driftConfidence: 0.85,
        suggestedLocation: byId.location,
        updatedAt: new Date().toISOString(),
      };
    }

    // Name match in same file
    const sameFile = symbols.filter(
      (s) =>
        s.location.file.replace(/\\/g, "/") === lm.location.file.replace(/\\/g, "/") &&
        (s.name === lm.name || s.qualifiedName.endsWith(lm.name)),
    );
    if (sameFile.length === 1) {
      const s = sameFile[0]!;
      return {
        ...lm,
        symbolId: s.id,
        driftStatus: Math.abs(s.location.line - lm.location.line) > 3 ? "needs_review" : "ok",
        driftConfidence: 0.75,
        suggestedLocation: s.location,
        updatedAt: new Date().toISOString(),
      } as Landmark;
    }

    // Global unique name
    const byName = symbols.filter((s) => s.name === lm.name && s.kind !== "file");
    if (byName.length === 1) {
      return {
        ...lm,
        symbolId: byName[0]!.id,
        driftStatus: "needs_review",
        driftConfidence: 0.6,
        suggestedLocation: byName[0]!.location,
        updatedAt: new Date().toISOString(),
      };
    }

    // File still exists with something nearby?
    const near = symbols
      .filter((s) => s.location.file.replace(/\\/g, "/") === lm.location.file.replace(/\\/g, "/"))
      .sort((a, b) => Math.abs(a.location.line - lm.location.line) - Math.abs(b.location.line - lm.location.line))[0];
    if (near) {
      return {
        ...lm,
        driftStatus: "needs_review",
        driftConfidence: 0.4,
        suggestedLocation: near.location,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      ...lm,
      driftStatus: "missing",
      driftConfidence: 0.1,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function syncLandmarksFromDisk(root: string, store: AtlasStore, symbols: AtlasSymbol[]): Landmark[] {
  const fileMarks = loadLandmarksFile(root);
  const dbMarks = store.allLandmarks();
  const byId = new Map<string, Landmark>();
  for (const l of dbMarks) byId.set(l.id, l);
  for (const l of fileMarks) byId.set(l.id, l);
  const merged = detectLandmarkDrift([...byId.values()], symbols);
  for (const l of merged) store.setLandmark(l);
  saveLandmarksFile(root, merged);
  return merged;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

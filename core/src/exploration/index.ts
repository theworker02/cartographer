import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  ExplorationState,
  Frontier,
  Landmark,
  Territory,
} from "../types/index.js";
import { cartographerDir, ensureCartographerDir } from "../config/index.js";

const DEFAULT_STATE = (): ExplorationState => ({
  enabled: true,
  symbolsOpened: [],
  territoriesVisited: [],
  journeysCompleted: [],
  landmarksVisited: [],
  updatedAt: new Date().toISOString(),
});

export function loadExploration(root: string): ExplorationState {
  const path = join(cartographerDir(root), "exploration.json");
  if (!existsSync(path)) return DEFAULT_STATE();
  try {
    return { ...DEFAULT_STATE(), ...JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return DEFAULT_STATE();
  }
}

export function saveExploration(root: string, state: ExplorationState): void {
  ensureCartographerDir(root);
  const path = join(cartographerDir(root), "exploration.json");
  writeFileSync(path, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2) + "\n");
}

export function markVisited(
  root: string,
  opts: {
    symbolId?: string;
    territoryId?: string;
    landmarkId?: string;
    journeyId?: string;
  },
): ExplorationState {
  const state = loadExploration(root);
  if (!state.enabled) return state;
  if (opts.symbolId && !state.symbolsOpened.includes(opts.symbolId)) {
    state.symbolsOpened.push(opts.symbolId);
  }
  if (opts.territoryId && !state.territoriesVisited.includes(opts.territoryId)) {
    state.territoriesVisited.push(opts.territoryId);
  }
  if (opts.landmarkId && !state.landmarksVisited.includes(opts.landmarkId)) {
    state.landmarksVisited.push(opts.landmarkId);
  }
  if (opts.journeyId && !state.journeysCompleted.includes(opts.journeyId)) {
    state.journeysCompleted.push(opts.journeyId);
  }
  saveExploration(root, state);
  return state;
}

/**
 * Fog-of-war frontiers: understood / frontier / beyond for a territory or whole atlas.
 */
export function computeFrontier(
  territories: Territory[],
  state: ExplorationState,
  landmarkIds: string[],
  territoryId?: string,
): Frontier {
  const focus = territoryId
    ? territories.filter((t) => t.id === territoryId || t.parentId === territoryId)
    : territories.filter((t) => !t.parentId);

  const understood: string[] = [];
  const frontier: string[] = [];
  const beyond: string[] = [];

  const visited = new Set(state.territoriesVisited);
  const opened = new Set(state.symbolsOpened);

  for (const t of focus) {
    const visitedHere = visited.has(t.id);
    const openedCount = t.symbolIds.filter((id) => opened.has(id)).length;
    const ratio = t.symbolIds.length ? openedCount / t.symbolIds.length : 0;
    if (visitedHere && ratio >= 0.25) {
      understood.push(t.name);
    } else if (visitedHere || ratio > 0 || neighborsVisited(t, territories, visited)) {
      frontier.push(t.name);
    } else {
      beyond.push(t.name);
    }
  }

  // Landmark fog
  const lmVisited = new Set(state.landmarksVisited);
  const unseenLandmarks = landmarkIds.filter((id) => !lmVisited.has(id));
  if (unseenLandmarks.length && !frontier.includes("(landmarks)")) {
    // encoded as synthetic frontier hint via beyond naming
    void unseenLandmarks;
  }

  return { understood, frontier, beyond, territoryId };
}

function neighborsVisited(
  t: Territory,
  all: Territory[],
  visited: Set<string>,
): boolean {
  // Parent/sibling proximity
  if (t.parentId && visited.has(t.parentId)) return true;
  return all.some(
    (o) =>
      o.id !== t.id &&
      visited.has(o.id) &&
      (o.parentId === t.parentId || o.parentId === t.id || t.parentId === o.id),
  );
}

export function unexploredSummary(
  territories: Territory[],
  state: ExplorationState,
  landmarks: Landmark[],
): {
  fog: Frontier;
  unvisitedTerritories: Territory[];
  unvisitedLandmarks: Landmark[];
  coverage: number;
} {
  const fog = computeFrontier(
    territories,
    state,
    landmarks.map((l) => l.id),
  );
  const visited = new Set(state.territoriesVisited);
  const unvisitedTerritories = territories.filter((t) => !t.parentId && !visited.has(t.id));
  const lmVisited = new Set(state.landmarksVisited);
  const unvisitedLandmarks = landmarks.filter((l) => !lmVisited.has(l.id));
  const parents = territories.filter((t) => !t.parentId);
  const coverage = parents.length
    ? visited.size / Math.max(1, parents.length)
    : state.symbolsOpened.length > 0
      ? 0.1
      : 0;
  return {
    fog,
    unvisitedTerritories,
    unvisitedLandmarks,
    coverage: Number(coverage.toFixed(3)),
  };
}

export function ensureExplorationFile(root: string): void {
  mkdirSync(cartographerDir(root), { recursive: true });
  const path = join(cartographerDir(root), "exploration.json");
  if (!existsSync(path)) saveExploration(root, DEFAULT_STATE());
}

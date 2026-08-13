import { relative, resolve } from "node:path";
import { AtlasStore } from "./storage/atlas-store.js";
import { loadConfig } from "./config/index.js";
import { indexRepository, type IndexOptions, type IndexResult } from "./index/indexer.js";
import { detectHubsAndBridges, type HubNode } from "./graph/hubs.js";
import { findRoutes, explainRoute } from "./routes/find.js";
import {
  buildMiniAtlas,
  formatWhereAmI,
  resolvePosition,
  type MiniAtlas,
} from "./navigation/whereami.js";
import { upstream, downstream } from "./navigation/flow.js";
import {
  createLandmark,
  syncLandmarksFromDisk,
  loadLandmarksFile,
} from "./landmarks/index.js";
import { listJourneys, getJourney, saveJourney } from "./journeys/index.js";
import {
  loadExploration,
  markVisited,
  unexploredSummary,
  ensureExplorationFile,
} from "./exploration/index.js";
import { runDoctor, formatDoctorReport, type DoctorReport } from "./doctor/index.js";
import { conceptSearch, type ConceptHit } from "./search/concept.js";
import { buildAtlasBriefing, type AtlasBriefing } from "./briefing/index.js";
import {
  fileHistory,
  territoryHistory,
  architectureDiffSince,
  getGitBranch,
  getGitRevision,
  blameLine,
} from "./history/git.js";
import type {
  AtlasMeta,
  AtlasSymbol,
  Corridor,
  EntryPoint,
  Journey,
  Landmark,
  Position,
  Relationship,
  Route,
  SourceLocation,
  Territory,
} from "./types/index.js";

/**
 * Atlas — the primary facade for Cartographer navigation.
 * All CLI / MCP / plugin surfaces should go through this API.
 */
export class Atlas {
  readonly root: string;
  readonly store: AtlasStore;

  private constructor(root: string, store: AtlasStore) {
    this.root = root;
    this.store = store;
  }

  static open(root: string): Atlas {
    const resolved = resolve(root);
    if (!AtlasStore.exists(resolved)) {
      throw new Error(
        `No atlas found in ${resolved}. Run \`cartographer index\` first.`,
      );
    }
    return new Atlas(resolved, AtlasStore.open(resolved));
  }

  static tryOpen(root: string): Atlas | null {
    try {
      return Atlas.open(root);
    } catch {
      return null;
    }
  }

  static async index(opts: IndexOptions): Promise<IndexResult> {
    const result = await indexRepository(opts);
    // Landmark drift + exploration bootstrap are part of indexing
    const symbols = result.store.allSymbols();
    syncLandmarksFromDisk(opts.root, result.store, symbols);
    ensureExplorationFile(opts.root);
    return result;
  }

  close(): void {
    this.store.close();
  }

  meta(): AtlasMeta | null {
    return this.store.getMeta();
  }

  status(): {
    meta: AtlasMeta | null;
    counts: ReturnType<AtlasStore["counts"]>;
    branch: string | null;
    exploration: ReturnType<typeof unexploredSummary>;
    hubs: HubNode[];
    drift: Landmark[];
  } {
    const meta = this.meta();
    const territories = this.territories();
    const landmarks = this.landmarks();
    const exploration = unexploredSummary(
      territories,
      loadExploration(this.root),
      landmarks,
    );
    const hubs = this.hubs(8);
    return {
      meta,
      counts: this.store.counts(),
      branch: getGitBranch(this.root),
      exploration,
      hubs,
      drift: landmarks.filter((l) => l.driftStatus && l.driftStatus !== "ok"),
    };
  }

  symbols(): AtlasSymbol[] {
    return this.store.allSymbols();
  }

  relationships(): Relationship[] {
    return this.store.allRelationships();
  }

  territories(): Territory[] {
    return this.store.allTerritories();
  }

  corridors(): Corridor[] {
    return this.store.allCorridors();
  }

  entryPoints(): EntryPoint[] {
    return this.store.allEntryPoints();
  }

  landmarks(): Landmark[] {
    const fromDb = this.store.allLandmarks();
    if (fromDb.length) return fromDb;
    return loadLandmarksFile(this.root);
  }

  hubs(limit = 20): HubNode[] {
    return detectHubsAndBridges(
      this.symbols(),
      this.relationships(),
      this.territories(),
      limit,
    );
  }

  findSymbol(query: string): AtlasSymbol | null {
    if (query.includes(":")) {
      const [file, lineStr] = query.split(":");
      const line = Number(lineStr);
      if (file && Number.isFinite(line)) {
        return this.store.findSymbolAt(normalizeFile(this.root, file), line);
      }
    }
    const byId = this.store.getSymbol(query);
    if (byId) return byId;
    const matches = this.store.findSymbolsByName(query, 5);
    return matches[0] ?? null;
  }

  goto(query: string): AtlasSymbol | null {
    const sym = this.findSymbol(query);
    if (sym) {
      markVisited(this.root, {
        symbolId: sym.id,
        territoryId: sym.territoryId,
      });
    }
    return sym;
  }

  whereami(file?: string, line?: number): {
    position: Position;
    miniAtlas: MiniAtlas;
    text: string;
    briefing: AtlasBriefing;
  } {
    let symbol: AtlasSymbol | null = null;
    if (file) {
      const rel = normalizeFile(this.root, file);
      symbol = this.store.findSymbolAt(rel, line ?? 1);
    }
    const territories = this.territories();
    const landmarks = this.landmarks();
    const entryPoints = this.entryPoints();
    const hubs = this.hubs(12);
    const position = resolvePosition({
      symbol,
      territories,
      landmarks,
      entryPoints,
      hubs,
    });
    if (symbol) {
      markVisited(this.root, {
        symbolId: symbol.id,
        territoryId: position.territory?.id,
      });
    }
    const exploration = unexploredSummary(
      territories,
      loadExploration(this.root),
      landmarks,
    );
    const miniAtlas = buildMiniAtlas({
      territories,
      hubs,
      entryPoints,
      breadcrumb: position.breadcrumb,
      coverage: exploration.coverage,
    });
    const hubsNearby = hubs.filter((h) => {
      if (!symbol) return true;
      if (h.symbol.location.file === symbol.location.file) return true;
      if (
        position.territory &&
        h.territoriesTouched.includes(position.territory.name)
      ) {
        return true;
      }
      return false;
    });
    const briefing = this.brief({ file, line, position, miniAtlas });
    // Compact whereami still available; briefing is the flagship view
    const text = formatWhereAmI({ position, miniAtlas, hubsNearby });
    return { position, miniAtlas, text, briefing };
  }

  /**
   * Living Atlas Briefing — flagship 15-second architectural map.
   */
  brief(opts?: {
    file?: string;
    line?: number;
    position?: Position;
    miniAtlas?: MiniAtlas;
  }): AtlasBriefing {
    const territories = this.territories();
    const landmarks = this.landmarks();
    const entryPoints = this.entryPoints();
    const hubs = this.hubs(12);
    const exploration = unexploredSummary(
      territories,
      loadExploration(this.root),
      landmarks,
    );

    let position = opts?.position;
    if (!position) {
      let symbol: AtlasSymbol | null = null;
      if (opts?.file) {
        symbol = this.store.findSymbolAt(
          normalizeFile(this.root, opts.file),
          opts.line ?? 1,
        );
      }
      position = resolvePosition({
        symbol,
        territories,
        landmarks,
        entryPoints,
        hubs,
      });
    }

    const miniAtlas =
      opts?.miniAtlas ??
      buildMiniAtlas({
        territories,
        hubs,
        entryPoints,
        breadcrumb: position.breadcrumb,
        coverage: exploration.coverage,
      });

    const journey = this.journeys()[0] ?? null;

    return buildAtlasBriefing({
      root: this.root,
      meta: this.meta(),
      territories,
      corridors: this.corridors(),
      hubs,
      entryPoints,
      landmarks,
      journey,
      position,
      miniAtlas,
      fog: {
        coverage: exploration.coverage,
        understood: exploration.fog.understood,
        frontier: exploration.fog.frontier,
        beyond: exploration.fog.beyond,
      },
      counts: this.store.counts(),
    });
  }

  route(from: string, to: string, explain = true): Route[] {
    const a = this.findSymbol(from);
    const b = this.findSymbol(to);
    if (!a || !b) return [];
    return findRoutes(
      a.id,
      b.id,
      this.symbols(),
      this.relationships(),
      this.territories(),
      this.corridors(),
      { explain },
    );
  }

  explainRoute(route: Route): string {
    return explainRoute(route, this.territories(), this.corridors());
  }

  upstream(query: string, depth = 3): AtlasSymbol[] {
    const s = this.findSymbol(query);
    if (!s) return [];
    return upstream(s.id, this.relationships(), this.symbols(), depth);
  }

  downstream(query: string, depth = 3): AtlasSymbol[] {
    const s = this.findSymbol(query);
    if (!s) return [];
    return downstream(s.id, this.relationships(), this.symbols(), depth);
  }

  search(query: string, limit = 20): ConceptHit[] {
    return conceptSearch(query, {
      territories: this.territories(),
      landmarks: this.landmarks(),
      entryPoints: this.entryPoints(),
      symbols: this.symbols(),
      hubs: this.hubs(30),
      limit,
    });
  }

  unexplored() {
    return unexploredSummary(
      this.territories(),
      loadExploration(this.root),
      this.landmarks(),
    );
  }

  addLandmark(opts: {
    name: string;
    description: string;
    location: SourceLocation;
    symbolId?: string;
  }): Landmark {
    return createLandmark(this.root, this.store, opts);
  }

  journeys(): Journey[] {
    return listJourneys(this.root);
  }

  journey(name: string): Journey | null {
    return getJourney(this.root, name);
  }

  saveJourney(journey: Journey): Journey {
    return saveJourney(this.root, journey);
  }

  tour(name?: string): Journey | null {
    if (name) return this.journey(name);
    const all = this.journeys();
    if (all.length) return all[0]!;
    // Auto-tour from top entry → hubs
    const entries = this.entryPoints();
    const hubs = this.hubs(5);
    if (!entries.length && !hubs.length) return null;
    const stops = [
      ...entries.slice(0, 3).map((e, i) => ({
        order: i + 1,
        name: e.label,
        symbolId: e.symbol.id,
        purpose: `Entry point (${e.category})`,
        location: e.symbol.location,
      })),
      ...hubs.slice(0, 4).map((h, i) => ({
        order: i + 4,
        name: h.symbol.name,
        symbolId: h.symbol.id,
        purpose: `${h.role} connecting ${h.territoriesTouched.join(", ") || "neighborhood"}`,
        location: h.symbol.location,
      })),
    ];
    const journey: Journey = {
      id: "journey:auto-tour",
      name: "Architecture tour",
      description: "Generated overview of entries and hubs",
      generated: true,
      reviewed: false,
      stops,
    };
    return saveJourney(this.root, journey);
  }

  history(target?: string) {
    if (!target) {
      return {
        revision: getGitRevision(this.root),
        branch: getGitBranch(this.root),
        events: [] as ReturnType<typeof fileHistory>,
      };
    }
    const territory = this.store.findTerritoryByName(target);
    if (territory) {
      return {
        revision: getGitRevision(this.root),
        branch: getGitBranch(this.root),
        events: territoryHistory(this.root, territory.filePaths),
      };
    }
    const sym = this.findSymbol(target);
    const file = sym?.location.file ?? normalizeFile(this.root, target);
    return {
      revision: getGitRevision(this.root),
      branch: getGitBranch(this.root),
      events: fileHistory(this.root, file),
      blame: sym ? blameLine(this.root, file, sym.location.line) : null,
    };
  }

  diff(since: string) {
    return architectureDiffSince(this.root, since);
  }

  doctor(): DoctorReport {
    const atlas = this;
    return runDoctor({
      root: atlas.root,
      store: atlas.store,
      meta: atlas.meta(),
      symbols: atlas.symbols(),
      relationships: atlas.relationships(),
      territories: atlas.territories(),
      landmarks: atlas.landmarks(),
      corridors: atlas.corridors(),
      entryPoints: atlas.entryPoints(),
    });
  }

  formatDoctor(): string {
    return formatDoctorReport(this.doctor());
  }

  config() {
    return loadConfig(this.root);
  }
}

function normalizeFile(root: string, file: string): string {
  const abs = resolve(root, file);
  return relative(root, abs).replace(/\\/g, "/") || file.replace(/\\/g, "/");
}

export type { MiniAtlas, HubNode, ConceptHit, DoctorReport, IndexResult, AtlasBriefing };

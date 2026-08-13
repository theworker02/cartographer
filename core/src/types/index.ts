/** Core Cartographer domain types — the Atlas coordinate system. */

export type ConfidenceBand = "STATIC" | "HIGH" | "MEDIUM" | "LOW";

export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "struct"
  | "trait"
  | "interface"
  | "module"
  | "package"
  | "constant"
  | "type"
  | "route"
  | "command"
  | "component"
  | "variable"
  | "file";

export type RelationKind =
  | "calls"
  | "imports"
  | "exports"
  | "implements"
  | "inherits"
  | "constructs"
  | "references"
  | "registers"
  | "contains"
  | "tests"
  | "configures"
  | "reads_env"
  | "writes"
  | "emits";

export type LanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "ruby"
  | "dart"
  | "csharp"
  | "java"
  | "unknown";

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface AtlasSymbol {
  id: string;
  name: string;
  qualifiedName: string;
  kind: SymbolKind;
  language: LanguageId;
  location: SourceLocation;
  signature?: string;
  exported?: boolean;
  entryPoint?: boolean;
  generated?: boolean;
  importance?: number;
  territoryId?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface Relationship {
  id: string;
  kind: RelationKind;
  fromId: string;
  toId: string;
  confidence: number;
  band: ConfidenceBand;
  location?: SourceLocation;
  evidence?: string;
}

export interface TerritoryEvidence {
  packages: string[];
  directories: string[];
  symbols: number;
  internal_density: number;
  entry_points?: string[];
  naming_signals?: string[];
}

export interface Territory {
  id: string;
  name: string;
  parentId?: string;
  confidence: number;
  evidence: TerritoryEvidence;
  symbolIds: string[];
  filePaths: string[];
  annotations?: string[];
}

export interface Landmark {
  id: string;
  name: string;
  description: string;
  symbolId?: string;
  location: SourceLocation;
  commit?: string;
  createdAt: string;
  updatedAt: string;
  driftStatus?: "ok" | "needs_review" | "missing";
  driftConfidence?: number;
  suggestedLocation?: SourceLocation;
}

export interface JourneyStop {
  order: number;
  name: string;
  symbolId?: string;
  location?: SourceLocation;
  purpose: string;
  relationshipToNext?: RelationKind;
  explanation?: string;
}

export interface Journey {
  id: string;
  name: string;
  description?: string;
  generated: boolean;
  reviewed: boolean;
  stops: JourneyStop[];
  path?: string;
}

export interface Position {
  territory?: Territory;
  subterritory?: Territory;
  symbol?: AtlasSymbol;
  nearestLandmarks: Landmark[];
  upstreamEntrypoint?: AtlasSymbol;
  downstreamEffect?: string;
  breadcrumb: string[];
  distanceFromEntry?: number;
}

export interface RouteHop {
  symbol: AtlasSymbol;
  via?: RelationKind;
  confidence?: number;
}

export interface Route {
  hops: RouteHop[];
  score: number;
  length: number;
  territoryTransitions: number;
  explanation?: string;
}

export interface Corridor {
  id: string;
  name: string;
  stages: string[];
  frequency: number;
  examples: string[];
}

export interface EntryPoint {
  symbol: AtlasSymbol;
  category: "cli" | "http" | "library" | "job" | "ui" | "other";
  label: string;
}

export interface Effect {
  kind:
    | "database"
    | "filesystem"
    | "network"
    | "process"
    | "ui"
    | "event"
    | "logging"
    | "unknown";
  symbolId: string;
  description: string;
  confidence: number;
}

export interface ExplorationState {
  enabled: boolean;
  symbolsOpened: string[];
  territoriesVisited: string[];
  journeysCompleted: string[];
  landmarksVisited: string[];
  updatedAt: string;
}

export interface Frontier {
  understood: string[];
  frontier: string[];
  beyond: string[];
  territoryId?: string;
}

export interface HistoryEvent {
  date: string;
  summary: string;
  commit?: string;
  files?: string[];
}

export interface ArchitectureDiff {
  addedTerritories: string[];
  removedTerritories: string[];
  moved: Array<{ name: string; from: string; to: string }>;
  newCorridors: string[];
  changedEntryPoints: string[];
  changedLandmarks: string[];
}

export interface IndexProgress {
  phase: string;
  files: number;
  languages: number;
  symbols: number;
  relationships: number;
  entryPoints: number;
  message?: string;
}

export interface AtlasMeta {
  version: number;
  root: string;
  revision?: string;
  indexedAt: string;
  languages: LanguageId[];
  fileCount: number;
  symbolCount: number;
  relationshipCount: number;
}

export interface CartographerConfig {
  version: number;
  index: {
    exclude: string[];
    includeVendored: boolean;
    maxFileBytes: number;
  };
  exploration: {
    enabled: boolean;
  };
  git: {
    history: boolean;
  };
  languages?: {
    enable?: LanguageId[];
  };
}

export const DEFAULT_CONFIG: CartographerConfig = {
  version: 1,
  index: {
    exclude: [
      "node_modules",
      "target",
      "dist",
      "vendor",
      "build",
      ".git",
      "coverage",
      "__pycache__",
      ".venv",
      "venv",
      "Pods",
      ".cartographer/cache",
    ],
    includeVendored: false,
    maxFileBytes: 1_500_000,
  },
  exploration: {
    enabled: true,
  },
  git: {
    history: true,
  },
};

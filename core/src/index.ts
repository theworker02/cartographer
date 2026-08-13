/** Cartographer core — public API. */

export * from "./types/index.js";
export * from "./config/index.js";
export { AtlasStore } from "./storage/atlas-store.js";
export { indexRepository } from "./index/indexer.js";
export type { IndexOptions, IndexResult, ProgressCallback } from "./index/indexer.js";
export { Atlas } from "./atlas.js";
export { detectHubsAndBridges } from "./graph/hubs.js";
export type { HubNode } from "./graph/hubs.js";
export { findRoutes, explainRoute } from "./routes/find.js";
export { detectCorridors, corridorAffinity } from "./routes/corridors.js";
export { inferTerritories } from "./territories/infer.js";
export { conceptSearch } from "./search/concept.js";
export type { ConceptHit } from "./search/concept.js";
export { runDoctor, formatDoctorReport } from "./doctor/index.js";
export type { DoctorReport, DoctorCheck } from "./doctor/index.js";
export {
  buildMiniAtlas,
  formatWhereAmI,
  resolvePosition,
  buildBreadcrumb,
} from "./navigation/whereami.js";
export type { MiniAtlas } from "./navigation/whereami.js";
export { upstream, downstream } from "./navigation/flow.js";
export * from "./landmarks/index.js";
export * from "./journeys/index.js";
export * from "./exploration/index.js";
export * from "./history/git.js";
export { buildAtlasBriefing, formatBriefing } from "./briefing/index.js";
export type { AtlasBriefing, BriefingInput } from "./briefing/index.js";

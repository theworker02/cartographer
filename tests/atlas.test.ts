import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Atlas } from "../core/src/atlas.js";
import { typescriptAdapter } from "../adapters/src/typescript/index.js";
import { inferTerritories } from "../core/src/territories/infer.js";
import { buildAtlasBriefing } from "../core/src/briefing/index.js";
import { buildMiniAtlas } from "../core/src/navigation/whereami.js";
import { detectHubsAndBridges } from "../core/src/graph/hubs.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const demoSrc = join(rootDir, "examples/demo-checkout");

describe("typescript adapter", () => {
  it("extracts functions, classes, and routes", () => {
    const source = `
export class OrderService {
  createOrder(total: number) { return total; }
}
export const router = { post() {} };
router.post("/orders", () => {});
`;
    const result = typescriptAdapter.parse("api/handlers.ts", source);
    expect(result.symbols.some((s) => s.name === "OrderService")).toBe(true);
    expect(result.symbols.some((s) => s.name === "createOrder")).toBe(true);
    expect(result.symbols.some((s) => s.kind === "route")).toBe(true);
  });
});

describe("territory inference", () => {
  it("groups api and domain paths", () => {
    const symbols = [
      {
        id: "1",
        name: "handlers.ts",
        qualifiedName: "handlers.ts",
        kind: "file" as const,
        language: "typescript" as const,
        location: { file: "src/api/handlers.ts", line: 1 },
      },
      {
        id: "2",
        name: "createOrder",
        qualifiedName: "createOrder",
        kind: "function" as const,
        language: "typescript" as const,
        location: { file: "src/domain/orders.ts", line: 10 },
        exported: true,
      },
    ];
    const territories = inferTerritories("/tmp", symbols, []);
    const names = territories.map((t) => t.name);
    expect(names.some((n) => /api/i.test(n))).toBe(true);
    expect(names.some((n) => /domain/i.test(n))).toBe(true);
  });
});

describe("demo-checkout atlas", () => {
  let work: string;
  let atlas: Atlas;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), "cartographer-demo-"));
    mkdirSync(join(work, "src"), { recursive: true });
    cpSync(join(demoSrc, "src"), join(work, "src"), { recursive: true });
    writeFileSync(join(work, "package.json"), JSON.stringify({ name: "demo", type: "module" }));
    await Atlas.index({ root: work });
    atlas = Atlas.open(work);
  }, 60_000);

  afterAll(() => {
    atlas?.close();
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {
      /* windows locks */
    }
  });

  it("indexes symbols and relationships", () => {
    const counts = atlas.store.counts();
    expect(counts.symbols).toBeGreaterThan(5);
    expect(counts.relationships).toBeGreaterThan(0);
    expect(counts.files).toBeGreaterThan(2);
  });

  it("infers multiple territories", () => {
    const parents = atlas.territories().filter((t) => !t.parentId);
    expect(parents.length).toBeGreaterThanOrEqual(2);
  });

  it("finds createOrder and OrderService", () => {
    expect(atlas.findSymbol("createOrder")).toBeTruthy();
    expect(atlas.findSymbol("OrderService")).toBeTruthy();
  });

  it("produces a Living Atlas Briefing", () => {
    const briefing = atlas.brief();
    expect(briefing.text).toContain("LIVING ATLAS BRIEFING");
    expect(briefing.text).toContain("MINI ATLAS");
    expect(briefing.stats.symbols).toBeGreaterThan(0);
  });

  it("whereami returns briefing", () => {
    const result = atlas.whereami("src/api/handlers.ts", 8);
    expect(result.briefing.text).toContain("YOU ARE HERE");
    expect(result.position.breadcrumb.length).toBeGreaterThan(0);
  });

  it("detects hubs or entry points", () => {
    const hubs = detectHubsAndBridges(
      atlas.symbols(),
      atlas.relationships(),
      atlas.territories(),
    );
    const entries = atlas.entryPoints();
    expect(hubs.length + entries.length).toBeGreaterThan(0);
  });

  it("doctor runs clean enough", () => {
    const report = atlas.doctor();
    expect(report.checks.length).toBeGreaterThan(3);
    expect(report.checks.some((c) => c.id === "atlas-db" && c.severity === "ok")).toBe(true);
  });

  it("concept search finds orders", () => {
    const hits = atlas.search("order");
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("briefing formatter", () => {
  it("renders required sections", () => {
    const text = buildAtlasBriefing({
      root: "/repo/checkout-service",
      meta: {
        version: 1,
        root: "/repo/checkout-service",
        indexedAt: new Date().toISOString(),
        languages: ["typescript"],
        fileCount: 10,
        symbolCount: 100,
        relationshipCount: 50,
      },
      territories: [
        {
          id: "t1",
          name: "API",
          confidence: 0.8,
          evidence: {
            packages: ["src"],
            directories: ["src/api"],
            symbols: 40,
            internal_density: 0.5,
          },
          symbolIds: [],
          filePaths: ["src/api/a.ts"],
        },
      ],
      corridors: [
        {
          id: "c1",
          name: "API → Domain → Data",
          stages: ["API", "Domain", "Data"],
          frequency: 9,
          examples: [],
        },
      ],
      hubs: [],
      entryPoints: [],
      landmarks: [],
      journey: null,
      position: null,
      miniAtlas: buildMiniAtlas({
        territories: [
          {
            id: "t1",
            name: "API",
            confidence: 0.8,
            evidence: {
              packages: [],
              directories: [],
              symbols: 40,
              internal_density: 0.5,
            },
            symbolIds: [],
            filePaths: [],
          },
        ],
        hubs: [],
        entryPoints: [],
        breadcrumb: ["API"],
        coverage: 0.1,
      }),
      fog: { coverage: 0.1, understood: [], frontier: ["API"], beyond: ["Workers"] },
      counts: { files: 10, symbols: 100, relationships: 50, territories: 1 },
    }).text;
    expect(text).toContain("TOP CORRIDORS");
    expect(text).toContain("FRONTIERS");
    expect(text).toContain("START HERE");
  });
});

#!/usr/bin/env node
/**
 * Cartographer MCP server — exposes Atlas navigation to Cursor / MCP clients.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "node:path";
import { Atlas } from "../core/src/atlas.js";

function root(): string {
  return resolve(process.env.CARTOGRAPHER_ROOT || process.cwd());
}

function withAtlas<T>(fn: (atlas: Atlas) => T): T {
  const atlas = Atlas.open(root());
  try {
    return fn(atlas);
  } finally {
    atlas.close();
  }
}

const server = new Server(
  { name: "cartographer", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "cartographer_brief",
      description:
        "Living Atlas Briefing — 15-second architectural map of the repository (mini atlas, you-are-here, corridors, hubs, fog-of-war, start-here).",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Optional file for YOU ARE HERE" },
          line: { type: "number", description: "Line number" },
        },
      },
    },
    {
      name: "cartographer_whereami",
      description: "Architecture breadcrumb and position for a file:line",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "number" },
        },
        required: ["file"],
      },
    },
    {
      name: "cartographer_goto",
      description: "Resolve a symbol name or file:line to Atlas coordinates",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "cartographer_route",
      description: "Corridor-aware route between two symbols",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["from", "to"],
      },
    },
    {
      name: "cartographer_upstream",
      description: "Symbols that reach the given symbol",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          depth: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "cartographer_downstream",
      description: "Symbols reachable from the given symbol",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          depth: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "cartographer_territories",
      description: "List architectural territories",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cartographer_hubs",
      description: "Architectural hubs and bridges",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cartographer_search",
      description: "Concept search over territories, landmarks, entries, hubs, symbols",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "cartographer_unexplored",
      description: "Fog-of-war frontiers and exploration coverage",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cartographer_tour",
      description: "Architecture tour journey stops",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
      },
    },
    {
      name: "cartographer_doctor",
      description: "Atlas integrity health checks",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cartographer_status",
      description: "Atlas index status summary",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "cartographer_index",
      description: "Index or re-index the repository Atlas",
      inputSchema: {
        type: "object",
        properties: {
          incremental: { type: "boolean" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    if (name === "cartographer_index") {
      const result = await Atlas.index({
        root: root(),
        incremental: !!args.incremental,
      });
      const counts = result.store.counts();
      result.store.close();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ meta: result.meta, counts }, null, 2),
          },
        ],
      };
    }

    const text = withAtlas((atlas) => {
      switch (name) {
        case "cartographer_brief": {
          const b = atlas.brief({
            file: args.file as string | undefined,
            line: args.line as number | undefined,
          });
          return b.text;
        }
        case "cartographer_whereami": {
          const r = atlas.whereami(args.file as string, (args.line as number) ?? 1);
          return r.briefing.text;
        }
        case "cartographer_goto":
          return JSON.stringify(atlas.goto(String(args.query)), null, 2);
        case "cartographer_route":
          return JSON.stringify(
            atlas.route(String(args.from), String(args.to), true),
            null,
            2,
          );
        case "cartographer_upstream":
          return JSON.stringify(
            atlas.upstream(String(args.query), (args.depth as number) ?? 3),
            null,
            2,
          );
        case "cartographer_downstream":
          return JSON.stringify(
            atlas.downstream(String(args.query), (args.depth as number) ?? 3),
            null,
            2,
          );
        case "cartographer_territories":
          return JSON.stringify(
            atlas.territories().filter((t) => !t.parentId),
            null,
            2,
          );
        case "cartographer_hubs":
          return JSON.stringify(atlas.hubs(), null, 2);
        case "cartographer_search":
          return JSON.stringify(atlas.search(String(args.query)), null, 2);
        case "cartographer_unexplored":
          return JSON.stringify(atlas.unexplored(), null, 2);
        case "cartographer_tour":
          return JSON.stringify(atlas.tour(args.name as string | undefined), null, 2);
        case "cartographer_doctor":
          return atlas.formatDoctor();
        case "cartographer_status":
          return JSON.stringify(atlas.status(), null, 2);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    return { content: [{ type: "text", text: text ?? "" }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

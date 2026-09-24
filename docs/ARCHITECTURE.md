# Cartographer — architecture

Cartographer is a **local-first navigation system** for software architecture. One Atlas core backs the CLI, MCP server, and Cursor plugin so orientation stays consistent across surfaces.

## Surfaces and core

```text
Cursor plugin (commands · skill · MCP)
CLI (cartographer)
MCP tools
        │
        ▼
   core/src/atlas.ts  — Atlas facade
        │
        ├── index/          repository indexer
        ├── territories/    structural regions
        ├── graph/          hubs, corridors, entry points, cross-file edges
        ├── navigation/     where-am-i, flow, journeys
        ├── landmarks/      durable anchors
        ├── briefing/       human-readable orientation
        ├── doctor/         config and environment health
        └── storage/        local atlas store
        │
        ▼
adapters/ (typescript · python · go · rust)
```

## Design principles

- **No required cloud** — core navigation works offline with local indexes.
- **Cartographic vocabulary** — territories, corridors, hubs, bridges, landmarks, fog-of-war.
- **Shared semantics** — plugin prompts and MCP tools call the same Atlas APIs as the CLI.

## Testing

```powershell
pnpm install
pnpm test
```

## Diligence pack

See `docs/acquisition/` and [acquisition/REPRODUCTION_COST.md](./acquisition/REPRODUCTION_COST.md).

# Cartographer

<p align="center">
  <img src="assets/banner.svg" alt="Cartographer" width="520" />
</p>

<p align="center">
  <strong>Know where you are in the code.</strong><br />
  A local-first navigation system for software architecture.
</p>

<p align="center">
  <a href="https://github.com/theworker02/cartographer/actions/workflows/ci.yml"><img src="https://github.com/theworker02/cartographer/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f5c4c" alt="MIT" /></a>
  <a href="https://theworker02.github.io/cartographer/"><img src="https://img.shields.io/badge/docs-GitHub%20Pages-1a3a2f" alt="Docs" /></a>
  <a href="https://github.com/sponsors/theworker02"><img src="https://img.shields.io/badge/sponsor-GitHub-ea4aaa" alt="Sponsor" /></a>
</p>

---

## Cursor plugin status

Cartographer ships as a **Cursor plugin** (commands, skill, agent, rules, MCP) plus a **local CLI**.

**Cursor Marketplace listing is pending Cursor approval.** Until it appears in Marketplace, install from this repository (local plugin + CLI from source). GitHub Releases may also be used when published.

This project is **not** an npm registry package — there is no `npm install -g cartographer`. Use clone → build for the CLI.

## Living Atlas Briefing

Open a foreign repository. Run one command. See the map in ~15 seconds.

```text
$ cartographer whereami src/api/handlers.ts 12

┌────────────────────────────────────────────────────────┐
│  CARTOGRAPHER · LIVING ATLAS BRIEFING                  │
│  checkout-service                                      │
└────────────────────────────────────────────────────────┘

Survey  142 files · 1,840 symbols · 3,102 edges
Map     8 territories · 12 entries · coverage 12%

▸ YOU ARE HERE
  API › handlers › checkout.ts › function:createOrder
  Territory: API (82% confidence)

▸ MINI ATLAS
  ├─ API          ████████░░░░  420  82%
  ├─ Domain       ██████░░░░░░  310  77%
  └─ Data         █████░░░░░░░  280  74%

▸ TOP CORRIDORS
  → API → Domain → Data  ×18

▸ HUBS & BRIDGES
  [BRIDGE] OrderService
           OrderService is a bridge between API ↔ Domain ↔ Data.

▸ START HERE
  First: POST /orders
```

`cartographer brief`, `whereami`, `tour`, and a fresh `index` all share this briefing — the same hubs, corridors, territories, and fog-of-war that power navigation.

## Install

### Local CLI (from source)

```bash
git clone https://github.com/theworker02/cartographer.git
cd cartographer
npm install
npm run build
npm link   # optional — PATH entry for local use
```

Requires **Node.js 20+** (22/24 recommended). Uses built-in `node:sqlite`. No API keys.

```bash
cd /path/to/your/project
cartographer index
cartographer brief
```

### Cursor plugin

Use this repository as a local Cursor plugin (manifest: `.cursor-plugin/plugin.json`). Build `dist/` first so MCP and CLI entrypoints resolve.

- Commands under `commands/`
- Skill `skills/cartographer`
- Agent `agents/cartographer-navigator`
- Rules `rules/cartographer.mdc`
- MCP server via `mcp.json` → `dist/mcp/index.js`

## CLI

| Command | Purpose |
|--------|---------|
| `index` | Build / refresh the Atlas (+ briefing) |
| `brief` | **Living Atlas Briefing** (flagship) |
| `whereami` / `where` | Breadcrumb + briefing for file:line |
| `goto` | Resolve symbol / file:line |
| `route` / `explain-route` | Corridor-aware paths |
| `upstream` / `downstream` | Graph neighborhoods |
| `territories` / `hubs` / `corridors` | Map layers |
| `landmarks` / `journeys` / `tour` | Annotations & guided walks |
| `unexplored` | Fog-of-war frontiers |
| `search` | Concept search |
| `history` | Git-aware history |
| `status` / `doctor` | Health & coverage |

## How it works

1. **Adapters** extract symbols & relationships (TS/JS, Python, Go, Rust).
2. **Indexer** builds a persistent SQLite Atlas in `.cartographer/atlas.db`.
3. **Core** infers territories, corridors, hubs/bridges, entry points; checks landmark drift.
4. **Atlas facade** powers CLI, MCP, and Cursor commands — one API.

Local-first: no telemetry, no cloud, no required accounts.

## Languages

TypeScript, JavaScript, Python, Go, Rust — deterministic extractors (no native tree-sitter binary required for v0.2).

## Docs site

- Live: https://theworker02.github.io/cartographer/
- Preview locally: `npm run docs:build` then `npm run docs:preview` (serves `docs-site/dist`)

Routes: `/`, `/docs`, `/install`, `/languages`, `/architecture`, `/privacy`.

## Sponsor

Cartographer is independent open source.

- GitHub Sponsors: https://github.com/sponsors/theworker02
- thanks.dev: https://thanks.dev/u/gh/theworker02

## More

- Privacy: https://theworker02.github.io/cartographer/privacy/
- Security: [SECURITY.md](SECURITY.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## License

MIT © [theworker02](https://github.com/theworker02)

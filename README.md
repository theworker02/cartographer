# Cartographer

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-light.svg" />
    <img src="assets/banner.svg" alt="Cartographer" width="680" height="124" />
  </picture>
</p>

<p align="center">
  <strong>Know where you are in the code.</strong><br />
  A local-first navigation system for software architecture.
</p>

<p align="center">
  <a href="https://github.com/theworker02/cartographer/actions/workflows/ci.yml"><img src="https://github.com/theworker02/cartographer/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f5c4c" alt="MIT" /></a>
  <a href="https://github.com/theworker02/cartographer/releases/latest"><img src="https://img.shields.io/github/v/release/theworker02/cartographer?color=1a3a2f&label=release" alt="Release" /></a>
  <a href="https://theworker02.github.io/cartographer/"><img src="https://img.shields.io/badge/docs-GitHub%20Pages-1a3a2f" alt="Docs" /></a>
  <a href="https://cursor.directory/c/magnexis"><img src="https://img.shields.io/badge/Cursor-plugin-1a3a2f" alt="Cursor plugin" /></a>
</p>

<p align="center">
  <a href="https://cursor.directory/c/magnexis">Cursor plugin</a>
  ·
  <a href="https://theworker02.github.io/cartographer/">Product site</a>
  ·
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="#cursor-installation">Cursor</a>
  ·
  <a href="#cli">CLI</a>
  ·
  <a href="https://github.com/sponsors/theworker02">Sponsor</a>
</p>

---

## Cursor plugin

Cartographer ships as a **Cursor plugin** (slash commands, skill, agent, rules, MCP) plus a **local CLI** built from this repository.

**See the plugin listing, screenshots, and install details here:**  
[https://cursor.directory/c/magnexis](https://cursor.directory/c/magnexis)

That page is the best place to discover Cartographer in the Cursor ecosystem. This repository is the source of truth for the Atlas engine, CLI, docs, and releases ([GitHub Releases](https://github.com/theworker02/cartographer/releases)).

This project is **not an npm registry package**. There is no `npm install -g cartographer`. `package.json` exists for local Node scripts, dependencies, and bins — clone → build → use.

---

## Living Atlas Briefing

Open a foreign repository. Run one command. See the map in about fifteen seconds.

The Living Atlas Briefing is Cartographer’s flagship moment: a single high-signal orientation that answers *where am I*, *what kind of system is this*, *how do the pieces usually flow*, and *where should I start*. It is not a chat summary. It is a structured map assembled from the same Atlas that powers every other command.

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
  ├─ Data         █████░░░░░░░  280  74%
  └─ Workers      ███░░░░░░░░░  120  68%

▸ TOP CORRIDORS
  → API → Domain → Data  ×18
    Requests typically flow API → Domain → Data.

▸ HUBS & BRIDGES
  [BRIDGE] OrderService
           OrderService is a bridge between API ↔ Domain ↔ Data.

▸ START HERE
  Journey: Start at the edge
  First:   POST /orders
  Why:     Begin at http entry, then walk downstream.
```

`cartographer brief`, `whereami`, `tour`, and a fresh `index` all share this briefing — the same hubs, corridors, territories, and fog-of-war that power navigation.

```bash
cartographer brief
cartographer brief src/api/handlers.ts 12
cartographer whereami src/api/handlers.ts 12
```

---

## What & Why

Modern codebases are large graphs pretending to be folders. You open a file and lose the architecture: which territory you are in, what usually flows where, which symbols are hubs, and what remains unexplored.

Cartographer builds a persistent **Atlas** for a repository — a local SQLite map of symbols, relationships, territories, corridors, hubs, landmarks, journeys, and exploration state — then exposes that map through CLI, MCP, and Cursor surfaces.

| Without Cartographer | With Cartographer |
|----------------------|-------------------|
| “Where should I start?” | Living Atlas Briefing + start-here journey |
| “What is this file for?” | `whereami` breadcrumb + territory confidence |
| “How does A reach B?” | Corridor-aware `route` / `explain-route` |
| “What depends on this?” | `upstream` / `downstream` neighborhoods |
| “What have we not charted?” | Fog-of-war via `unexplored` |

**Design principles**

- **Orientation before change** — know where you are before you edit.
- **One Atlas facade** — CLI, MCP, and Cursor commands share the same core.
- **Local-first** — no telemetry, no required cloud, no API keys for core navigation.
- **Cartographic language** — territories, corridors, hubs, bridges, landmarks, journeys, fog.

---

## Quick Start

Requires **Node.js 20+** (22/24 recommended). Uses built-in `node:sqlite`. No API keys.

```bash
git clone https://github.com/theworker02/cartographer.git
cd cartographer
npm install
npm run build
npm link   # optional — adds `cartographer` to your PATH for local use
```

Then, in any project you want to map:

```bash
cd /path/to/your/project
cartographer index
cartographer brief
```

`index` surveys the repository, writes `.cartographer/atlas.db`, and prints a Living Atlas Briefing by default. After that, navigate with `whereami`, `route`, `hubs`, `unexplored`, and the rest of the CLI.

Docs site (live): [theworker02.github.io/cartographer](https://theworker02.github.io/cartographer/)  
Install guide: [Install](https://theworker02.github.io/cartographer/install/)

---

## Cursor Installation

Cartographer is a Cursor plugin. **Start here for the public listing and install path:**  
[https://cursor.directory/c/magnexis](https://cursor.directory/c/magnexis)

Manifest in this repo: [`.cursor-plugin/plugin.json`](.cursor-plugin/plugin.json). For local development from source, build `dist/` first so MCP and CLI entrypoints resolve (`npm install && npm run build` at the repo root).

What the plugin includes:

| Surface | Location | Role |
|---------|----------|------|
| Slash commands | `commands/` | `brief`, `whereami`, `route`, `goto`, `tour`, `unexplored`, `index`, `doctor`, … |
| Skill | `skills/cartographer` | Teaches the agent Atlas-first orientation |
| Agent | `agents/cartographer-navigator` | Navigator persona for unfamiliar repos |
| Rules | `rules/cartographer.mdc` | Persistent cartographic guidance |
| Hooks | `hooks/hooks.json` | Plugin hooks |
| MCP | `mcp.json` → `dist/mcp/index.js` | Same Atlas tools for agent tooling |

Point Cursor at this checkout as a local plugin, open a project, run `cartographer index` (CLI or MCP), then ask for a briefing or use `/whereami`-style commands.

---

## Atlas

The **Atlas** is Cartographer’s source of truth: a durable map under `.cartographer/` in the target repository.

- **`atlas.db`** — SQLite store of files, symbols, relationships, territories, and derived map layers
- **`config.toml`** — optional per-repo configuration (created on demand)
- **Landmarks / journeys / exploration** — JSON alongside the database for annotations and fog-of-war

Indexing is deterministic and incremental-friendly. Re-running `cartographer index` refreshes the map; landmark drift is checked so named places stay honest as code moves.

Everything else — briefing, routes, hubs, MCP tools — reads this Atlas through a single `Atlas` facade. Surfaces do not invent a second graph.

---

## Territories

**Territories** are inferred architectural regions (API, Domain, Data, Workers, Config, and similar), scored with confidence and internal density.

```bash
cartographer territories
```

They appear in the Mini Atlas tree inside every Living Atlas Briefing, and they constrain how routes and corridors are explained: moving API → Domain → Data is a corridor, not a random hop list.

---

## Where Am I / Briefing

**`whereami`** (alias `where`) answers the human question first: *where am I in the architecture?*

```bash
cartographer whereami path/to/file.ts 42
cartographer whereami path/to/file.ts 42 --compact   # breadcrumb only
cartographer brief                                   # repo-level briefing
cartographer brief path/to/file.ts 42                # briefing pinned to a location
```

Full mode returns the Living Atlas Briefing with a **YOU ARE HERE** breadcrumb (territory + confidence). Compact mode prints the breadcrumb alone when you already know the map.

---

## Routes

**Routes** find paths between symbols (or `file:line` coordinates) with corridor awareness — preferring paths that follow how the system usually flows.

```bash
cartographer route OrderController OrderRepository
cartographer explain-route OrderController OrderRepository
```

Each route reports score, hops, territory transitions, and a plain-language explanation. Prefer `explain-route` when you want the best path narrated without the full candidate set.

---

## Upstream / Downstream

Neighborhood queries over the relationship graph:

```bash
cartographer upstream createOrder -d 3
cartographer downstream OrderService -d 3
```

- **Upstream** — who reaches this symbol?
- **Downstream** — what does this symbol reach?

Useful for blast-radius checks, onboarding (“what does this service touch?”), and validating that a change stays inside the expected territory.

---

## Landmarks

**Landmarks** are human-named places on the map — “checkout entry”, “payment gateway”, “legacy invoice path” — pinned to a file:line with a description.

```bash
cartographer landmarks
cartographer landmarks --add "Checkout entry" --file src/api/orders.ts --line 12 \
  --description "HTTP entry for create order"
```

On re-index, Cartographer checks **landmark drift** so annotations do not silently point at the wrong code. Drifted landmarks show up in `status` and `doctor`.

---

## Journeys

**Journeys** are ordered stops for guided walks through the architecture — onboarding paths, “start at the edge”, or custom tours of a subsystem.

```bash
cartographer journeys
```

Generated journeys (for example from entry points) are marked so you can tell Atlas-suggested walks from hand-authored ones. The Living Atlas Briefing’s **START HERE** suggestion is typically the first stop of a journey worth taking.

---

## Tours

**`tour`** combines a Living Atlas Briefing with a walkable journey:

```bash
cartographer tour
cartographer tour "Start at the edge"
```

You get orientation first, then numbered stops with purpose — ideal for pairing, agent handoffs, or your first hour in an unfamiliar service.

---

## Exploration / Fog

Cartographer tracks what you have charted versus what remains in the fog:

```bash
cartographer unexplored
cartographer status
```

Fog layers:

- **Understood** — territories / areas you have engaged
- **Frontier** — adjacent, high-value next places to chart
- **Beyond** — still unmapped relative to current exploration

Coverage appears in the briefing and in `status`. Exploration can be disabled in config if you want a pure static map without fog tracking.

---

## Archaeology / Git

When Git history is available locally, Cartographer can surface recent archaeology for a file, symbol, or territory:

```bash
cartographer history
cartographer history src/api/orders.ts
cartographer history OrderService
```

Branch and revision are recorded at index time and shown in `status`. History is read from the local repo only — nothing is uploaded. Toggle with `[git] history` in `.cartographer/config.toml`.

---

## Languages

v0.2 ships deterministic language adapters (no native tree-sitter binary required):

| Language | Notes |
|----------|--------|
| TypeScript / JavaScript | Incl. TSX; route and entry heuristics |
| Python | Flask / FastAPI, Click |
| Go | Handlers, Cobra |
| Rust | Axum / Actix, Clap / Tauri |

Adapters extract symbols, imports, calls, and entry points. Cross-file linking, territory inference, hubs, and corridors run in core. See [Languages](https://theworker02.github.io/cartographer/languages/).

---

## CLI

Global option: `-C, --cwd <path>` to target a repository root.

| Command | Purpose |
|---------|---------|
| `index` | Survey the repo and build / refresh the Atlas (+ briefing by default) |
| `brief` | **Living Atlas Briefing** (flagship) |
| `whereami` / `where` | Breadcrumb + briefing for file:line |
| `goto` | Resolve symbol / file:line to Atlas coordinates |
| `route` / `explain-route` | Corridor-aware paths between symbols |
| `upstream` / `downstream` | Graph neighborhoods |
| `territories` / `hubs` / `corridors` | Map layers |
| `landmarks` / `journeys` / `tour` | Annotations & guided walks |
| `unexplored` | Fog-of-war frontiers |
| `search` | Concept search across territories, landmarks, entries, hubs, symbols |
| `history` | Git-aware history for file / symbol / territory |
| `status` / `doctor` | Health, coverage, landmark drift, integrity |

Most commands accept `--json` for machine-readable output (agents, scripts, CI).

```bash
cartographer index --incremental
cartographer index --no-brief
cartographer status --brief
cartographer doctor
```

---

## MCP

The MCP server exposes the same Atlas facade to agents:

```text
cartographer_brief
cartographer_whereami
cartographer_goto
cartographer_route
cartographer_upstream
cartographer_downstream
cartographer_territories
cartographer_hubs
cartographer_search
cartographer_unexplored
cartographer_tour
cartographer_doctor
cartographer_status
cartographer_index
```

Configured via `mcp.json` (plugin) to run `node ${PLUGIN_ROOT}/dist/mcp/index.js` with `CARTOGRAPHER_ROOT` set to the workspace folder. Build `dist/` before expecting MCP tools to resolve.

Standalone:

```bash
npm run mcp
# or
cartographer-mcp
```

---

## Configuration

Optional file: `.cartographer/config.toml` in the target repository.

```toml
# Cartographer repository configuration
version = 1

[index]
exclude = [
  "node_modules",
  "target",
  "dist",
  "vendor",
  "build",
  ".git",
  "coverage",
  "__pycache__",
  ".venv",
  "venv"
]
include_vendored = false
max_file_bytes = 1500000

[exploration]
enabled = true

[git]
history = true
```

Additional ignore patterns: `.cartographerignore` (gitignore-style lines). Defaults skip common build and dependency trees; raise `max_file_bytes` only if you intentionally index very large generated sources.

---

## Architecture

One consolidated TypeScript project — not a constellation of micro-packages, and not an npm library product.

```text
core/       Atlas facade, indexer, territories, routes, briefing, doctor
adapters/   Language extractors (TS/JS, Python, Go, Rust)
cli/        cartographer binary
mcp/        MCP server
commands/   Cursor slash commands
skills/     Cursor skill
agents/     Cursor agent
rules/      Cursor rules
docs-site/  GitHub Pages product + docs
assets/     Banner, logos, mark
```

**Pipeline**

1. **Adapters** extract symbols and relationships per language.
2. **Indexer** builds / refreshes the SQLite Atlas in `.cartographer/`.
3. **Core** infers territories, corridors, hubs/bridges, entry points; tracks exploration; checks landmark drift.
4. **Atlas facade** powers CLI, MCP, and Cursor — one API, one map.

More detail: [Architecture](https://theworker02.github.io/cartographer/architecture/).

---

## Performance

Cartographer is designed for interactive orientation, not overnight whole-company crawls.

- Incremental indexing (`cartographer index --incremental`) limits work to changed files when possible.
- Large / vendored trees are excluded by default; `.cartographerignore` keeps noise out of the Atlas.
- File size caps avoid swallowing huge generated blobs into the graph.
- Briefing, hubs, and corridors are derived from the indexed graph — cheap relative to a full re-survey.

For rough timing on your machine: `npm run bench` (runs `cartographer index --bench` after build). Prefer Node 22/24 for `node:sqlite` ergonomics.

---

## Privacy

Cartographer is local-first by design.

- No telemetry, analytics, or phone-home
- No required API keys or cloud account for core navigation
- Atlas data lives in `.cartographer/` on your machine
- Git history is read locally when enabled
- The [docs site](https://theworker02.github.io/cartographer/) is static GitHub Pages — it does not process your code

Treat `.cartographer/` like any other project cache: it may mirror paths and symbol names from your codebase. Full statement: [Privacy](https://theworker02.github.io/cartographer/privacy/).

---

## Security

Supported releases and reporting process: [SECURITY.md](SECURITY.md).

Report vulnerabilities privately via GitHub Security Advisories on [theworker02/cartographer](https://github.com/theworker02/cartographer). Do not open public issues for problems that could expose repository contents or local Atlas data.

---

## Roadmap

Directions under active consideration (not a schedule):

- Richer multi-language depth and entry-point heuristics
- Deeper incremental / watch-mode indexing for large monorepos
- Stronger corridor explanations and journey authoring UX
- Optional tree-sitter-backed parsers where deterministic adapters hit limits
- Packaging refinements via GitHub Releases (still not an npm registry product)

Ideas and PRs that strengthen navigation UX over unrelated tooling are especially welcome.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm install
npm run build
npm test
npm run validate:plugin
```

Guidelines in short: keep features behind the `Atlas` facade; prefer navigation upgrades; match the cartographic aesthetic; add tests for indexer / briefing / graph behavior; use conventional commits (`feat`, `fix`, `docs`, `test`, `chore`).

Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Funding

Cartographer is independent open source. If the Atlas saves you time in foreign codebases, consider supporting development:

- **GitHub Sponsors:** [github.com/sponsors/theworker02](https://github.com/sponsors/theworker02)
- **thanks.dev:** [thanks.dev/u/gh/theworker02](https://thanks.dev/u/gh/theworker02)

Sponsors and thanks.dev are external platforms with their own privacy policies; Cartographer itself never sees payment data.

---

## License

[MIT](LICENSE) © [theworker02](https://github.com/theworker02)

---

### More

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Releases: [github.com/theworker02/cartographer/releases](https://github.com/theworker02/cartographer/releases)
- Docs: [theworker02.github.io/cartographer](https://theworker02.github.io/cartographer/)

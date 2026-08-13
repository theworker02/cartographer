# Changelog

All notable changes to Cartographer are documented here.

## [0.2.0] — Living Atlas Briefing

Cartographer is no longer “just an indexer with commands.” This release centers the **Living Atlas Briefing**: one high-signal architectural map that `index`, `brief`, `whereami`, and `tour` all share — delivered as a Cursor plugin and local CLI, not an npm registry product.

### Wow
- **Living Atlas Briefing** — Mini Atlas tree, YOU ARE HERE breadcrumb with territory confidence, top corridors in plain language, hubs & bridges, fog-of-war frontiers, and a start-here journey suggestion. Designed so a developer can orient in a foreign repo in ~15 seconds.

### Navigation (merged into Atlas facade)
- Hub & bridge detection as first-class map layer (`hubs`, briefing, routes)
- Corridor-aware route ranking + `explain-route`
- Exploration fog integrated into `unexplored`, `status`, and briefing
- Landmark drift detection on re-index
- `doctor` integrity checks
- Concept search across territories, landmarks, entries, hubs, symbols
- MCP tools mirror the same facade (`cartographer_brief`, …)

### Distribution & product surface
- **Cursor plugin + local CLI from source / GitHub Releases** — `package.json` is a private local Node project (scripts, deps, bins). Not published to the npm registry.
- Polished GitHub Pages site (`docs-site/`) with brand mark on every page, favicon, typography, and routes `/`, `/docs`, `/install`, `/languages`, `/architecture`, `/privacy`
- Footer Sponsors + [thanks.dev](https://thanks.dev/u/gh/theworker02); `.github/FUNDING.yml` for GitHub Sponsors + thanks.dev
- Cursor commands / skill / agent / rules
- Branding assets (banner, logo, mark, light/dark)
- Demo checkout fixture + automated Atlas tests

## [0.1.0] — Foundation

- Single-package architecture: `core/`, `adapters/`, `cli/`, `mcp/`
- SQLite Atlas (`node:sqlite`) under `.cartographer/`
- Language adapters: TypeScript/JavaScript, Python, Go, Rust
- Territory inference, importance ranking, entry points, cross-file linking
- Baseline CLI navigation: index, where, goto, upstream, downstream, territories, landmarks, journeys, history

[0.2.0]: https://github.com/theworker02/cartographer/releases/tag/v0.2.0
[0.1.0]: https://github.com/theworker02/cartographer/releases/tag/v0.1.0

# Contributing

Thanks for helping chart the map.

## Development

```bash
npm install
npm run build
npm test
npm run validate:plugin
```

## Guidelines

- Keep features behind the `Atlas` facade — CLI/MCP/commands should not fork logic.
- Prefer navigation UX upgrades over unrelated tooling.
- Match the cartographic aesthetic (restrained greens / parchment accents — not purple AI gloss).
- Add or update tests for indexer / briefing / graph behavior.
- Use conventional commits: `feat`, `fix`, `docs`, `test`, `chore`.

## Docs site

```bash
npm run docs:build
npm run docs:preview   # optional local static server on :4173
```

Output lands in `docs-site/dist` (deployed by GitHub Actions to Pages). This repo is a private local Node project — do not publish to the npm registry.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---
name: cartographer
description: Navigate software architecture with the Cartographer Atlas — briefing, whereami, routes, territories, hubs, and exploration frontiers.
---

# Cartographer Skill

You help developers **know where they are in the code** using Cartographer — a local-first Atlas, not a chat/codegen tool.

## When to use

- User opens an unfamiliar repo or asks “where am I?”
- User wants architectural orientation, routes, upstream/downstream, or unexplored areas
- User asks for a map / briefing / tour of the codebase

## Workflow

1. If no Atlas: run `cartographer index` (prints Living Atlas Briefing).
2. Prefer `cartographer brief` or MCP `cartographer_brief` for orientation.
3. Use `whereami`, `goto`, `route`, `hubs`, `unexplored`, `search` as needed.
4. Speak in map language: territories, corridors, hubs, bridges, frontiers.

## Rules

- Do not invent symbols that are not in the Atlas.
- Prefer briefing + navigation over rewriting code.
- Respect local-first: no uploading repo contents.

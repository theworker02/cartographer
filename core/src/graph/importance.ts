import type { AtlasSymbol, Relationship } from "../types/index.js";

export function computeImportance(
  symbols: AtlasSymbol[],
  relationships: Relationship[],
): AtlasSymbol[] {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const r of relationships) {
    if (r.kind === "contains") continue;
    incoming.set(r.toId, (incoming.get(r.toId) ?? 0) + 1);
    outgoing.set(r.fromId, (outgoing.get(r.fromId) ?? 0) + 1);
  }

  return symbols.map((s) => {
    const inn = incoming.get(s.id) ?? 0;
    const out = outgoing.get(s.id) ?? 0;
    let score = inn * 2 + out;
    if (s.entryPoint) score += 25;
    if (s.exported) score += 8;
    if (s.kind === "route" || s.kind === "command") score += 15;
    if (s.generated) score *= 0.2;
    if (s.kind === "file" || s.kind === "module") score *= 0.3;
    return { ...s, importance: score };
  });
}

import type { AtlasSymbol, Relationship } from "../types/index.js";
import { makeRel } from "../../../adapters/src/shared/utils.js";

/**
 * Link calls across files when a symbol references another by exact name
 * and the callee is exported / entry-like.
 */
export function linkCrossFileCalls(
  symbols: AtlasSymbol[],
  existing: Relationship[],
): Relationship[] {
  const byName = new Map<string, AtlasSymbol[]>();
  for (const s of symbols) {
    if (s.kind === "file" || s.kind === "module") continue;
    const list = byName.get(s.name) ?? [];
    list.push(s);
    byName.set(s.name, list);
  }

  const seen = new Set(existing.map((r) => r.id));
  const out: Relationship[] = [];

  // Prefer unique exported names for cross-file resolution
  for (const s of symbols) {
    if (!s.exported && !s.entryPoint) continue;
    if (["function", "method", "class", "struct", "route", "command"].includes(s.kind)) {
      // already indexed
    }
  }

  // From import edges: if file A imports module path matching file B basename,
  // connect exported symbols referenced in A to definitions in B heuristically.
  const files = symbols.filter((s) => s.kind === "file");
  const exportsByFile = new Map<string, AtlasSymbol[]>();
  for (const s of symbols) {
    if (!s.exported || s.kind === "file" || s.kind === "module") continue;
    const list = exportsByFile.get(s.location.file) ?? [];
    list.push(s);
    exportsByFile.set(s.location.file, list);
  }

  for (const file of files) {
    const imports = existing.filter(
      (r) => r.fromId === file.id && r.kind === "imports",
    );
    for (const imp of imports) {
      const mod = symbols.find((s) => s.id === imp.toId);
      if (!mod) continue;
      const modName = mod.name.replace(/^[\.\/]+/, "");
      // find files that look like the import target
      const candidates = [...exportsByFile.keys()].filter((f) => {
        const base = f.replace(/\.[^.]+$/, "");
        return (
          base.endsWith(modName) ||
          f.includes(modName) ||
          base.split("/").pop() === modName.split("/").pop()
        );
      });
      for (const targetFile of candidates.slice(0, 3)) {
        const exports = exportsByFile.get(targetFile) ?? [];
        for (const exp of exports.slice(0, 20)) {
          // Only create a references edge file→symbol if name appears unique-ish
          const sameName = byName.get(exp.name) ?? [];
          if (sameName.length > 4) continue;
          const rel = makeRel({
            kind: "references",
            fromId: file.id,
            toId: exp.id,
            confidence: 0.55,
            location: file.location,
            evidence: `import ${mod.name} → ${exp.qualifiedName}`,
          });
          if (!seen.has(rel.id)) {
            seen.add(rel.id);
            out.push(rel);
          }
        }
      }
    }
  }

  // Exact unique name call edges across files (already partially done in-file)
  const unique = [...byName.entries()].filter(
    ([, list]) => list.length === 1 && (list[0]!.exported || list[0]!.entryPoint),
  );
  for (const [name, list] of unique) {
    const callee = list[0]!;
    for (const caller of symbols) {
      if (caller.location.file === callee.location.file) continue;
      if (!["function", "method", "class", "route", "command"].includes(caller.kind)) {
        continue;
      }
      // cheap: only if names are distinctive
      if (name.length < 4) continue;
      // Don't invent calls without source evidence — skip speculative mass edges
      void caller;
      void callee;
    }
  }

  return out;
}

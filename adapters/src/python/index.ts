import type { LanguageAdapter, ParseResult } from "../shared/utils.js";
import {
  hashContent,
  isGeneratedFile,
  lineNumberAt,
  makeRel,
  makeSymbol,
} from "../shared/utils.js";
import type { AtlasSymbol } from "../../../core/src/types/index.js";

export const pythonAdapter: LanguageAdapter = {
  id: "python",
  extensions: [".py"],
  parse(filePath, source): ParseResult {
    const generated = isGeneratedFile(filePath, source);
    const contentHash = hashContent(source);
    const symbols: AtlasSymbol[] = [];
    const relationships: ReturnType<typeof makeRel>[] = [];

    const fileSym = makeSymbol({
      file: filePath,
      name: filePath.split(/[/\\]/).pop() ?? filePath,
      kind: "file",
      language: "python",
      line: 1,
      generated,
      contentHash,
    });
    symbols.push(fileSym);

    let m: RegExpExecArray | null;

    const importRe = /^(?:from\s+([\w.]+)\s+import\s+(.+)|import\s+([\w.]+(?:\s+as\s+\w+)?(?:,\s*[\w.]+(?:\s+as\s+\w+)?)*))/gm;
    while ((m = importRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const mod = (m[1] ?? m[3] ?? "").split(",")[0]!.trim().split(/\s+/)[0]!;
      const modSym = {
        ...makeSymbol({
          file: filePath,
          name: mod,
          kind: "module",
          language: "python",
          line,
          qualifiedName: `import:${mod}`,
          generated,
        }),
        id: `mod:${mod}`,
      };
      symbols.push(modSym);
      relationships.push(
        makeRel({
          kind: "imports",
          fromId: fileSym.id,
          toId: modSym.id,
          confidence: 0.98,
          location: { file: filePath, line },
        }),
      );
    }

    const classRe = /^class\s+([A-Za-z_][\w]*)\s*(?:\([^)]*\))?:/gm;
    while ((m = classRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: "class",
          language: "python",
          line,
          exported: true,
          generated,
          contentHash,
        }),
      );
    }

    const fnRe = /^([ \t]*)(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/gm;
    while ((m = fnRe.exec(source))) {
      const indent = m[1]!.length;
      const name = m[2]!;
      const line = lineNumberAt(source, m.index);
      const kind = indent > 0 ? "method" : "function";
      symbols.push(
        makeSymbol({
          file: filePath,
          name,
          kind,
          language: "python",
          line,
          entryPoint: name === "main" || name === "__main__",
          exported: indent === 0 && !name.startsWith("_"),
          generated,
          contentHash,
        }),
      );
    }

    // Flask / FastAPI routes
    const routeRe =
      /@(?:app|router)\.(get|post|put|patch|delete|options|head|route)\(\s*['"]([^'"]+)['"]/g;
    while ((m = routeRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const method = (m[1] === "route" ? "ROUTE" : m[1]!.toUpperCase());
      const path = m[2]!;
      symbols.push(
        makeSymbol({
          file: filePath,
          name: `${method} ${path}`,
          kind: "route",
          language: "python",
          line,
          entryPoint: true,
          exported: true,
          generated,
          contentHash,
          metadata: { httpMethod: method, path },
        }),
      );
    }

    // Click / argparse CLI
    if (/@click\.command|argparse|typer\.Typer/.test(source)) {
      for (const s of symbols) {
        if (s.kind === "function" && (s.name === "main" || s.name.includes("cli"))) {
          s.entryPoint = true;
          s.kind = s.kind;
          s.metadata = { ...(s.metadata ?? {}), cli: true };
        }
      }
    }

    for (const s of symbols) {
      if (s.id !== fileSym.id && s.kind !== "module") {
        relationships.push(
          makeRel({
            kind: "contains",
            fromId: fileSym.id,
            toId: s.id,
            confidence: 1,
            location: s.location,
          }),
        );
      }
    }

    // Simple call graph within file
    const callables = symbols.filter((s) =>
      ["function", "method", "class", "route"].includes(s.kind),
    );
    for (const caller of callables) {
      const start = offsetForLine(source, caller.location.line);
      const window = source.slice(start, start + 2000);
      for (const callee of callables) {
        if (callee.id === caller.id) continue;
        if (new RegExp(`\\b${escape(callee.name)}\\s*\\(`).test(window)) {
          relationships.push(
            makeRel({
              kind: "calls",
              fromId: caller.id,
              toId: callee.id,
              confidence: 0.7,
              location: caller.location,
              evidence: `${caller.name} → ${callee.name}`,
            }),
          );
        }
      }
    }

    return { symbols, relationships, language: "python" };
  },
};

function offsetForLine(source: string, line: number): number {
  if (line <= 1) return 0;
  let cur = 1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      cur++;
      if (cur === line) return i + 1;
    }
  }
  return 0;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

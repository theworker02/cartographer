import type { LanguageAdapter, ParseResult } from "../shared/utils.js";
import {
  hashContent,
  isGeneratedFile,
  lineNumberAt,
  makeRel,
  makeSymbol,
} from "../shared/utils.js";
import type { AtlasSymbol } from "../../../core/src/types/index.js";

export const goAdapter: LanguageAdapter = {
  id: "go",
  extensions: [".go"],
  parse(filePath, source): ParseResult {
    const generated = isGeneratedFile(filePath, source);
    const contentHash = hashContent(source);
    const symbols: AtlasSymbol[] = [];
    const relationships: ReturnType<typeof makeRel>[] = [];

    const fileSym = makeSymbol({
      file: filePath,
      name: filePath.split(/[/\\]/).pop() ?? filePath,
      kind: "file",
      language: "go",
      line: 1,
      generated,
      contentHash,
    });
    symbols.push(fileSym);

    let m: RegExpExecArray | null;

    const pkg = source.match(/^package\s+(\w+)/m);
    if (pkg) {
      symbols.push(
        makeSymbol({
          file: filePath,
          name: pkg[1]!,
          kind: "package",
          language: "go",
          line: lineNumberAt(source, pkg.index ?? 0),
          exported: true,
          generated,
          contentHash,
        }),
      );
    }

    const importBlock = /import\s+(?:\(\s*([\s\S]*?)\)|"([^"]+)")/g;
    while ((m = importBlock.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const body = m[1] ?? m[2] ?? "";
      const paths = body.match(/"([^"]+)"/g) ?? [];
      for (const p of paths) {
        const mod = p.slice(1, -1);
        const modSym = {
          ...makeSymbol({
            file: filePath,
            name: mod,
            kind: "module",
            language: "go",
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
    }

    const typeRe = /type\s+([A-Za-z_]\w*)\s+(struct|interface)/g;
    while ((m = typeRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: m[2] === "interface" ? "interface" : "struct",
          language: "go",
          line,
          exported: /^[A-Z]/.test(m[1]!),
          generated,
          contentHash,
        }),
      );
    }

    const fnRe =
      /func\s+(?:\(([^)]+)\)\s+)?([A-Za-z_]\w*)\s*\([^)]*\)/g;
    while ((m = fnRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const recv = m[1];
      const name = m[2]!;
      symbols.push(
        makeSymbol({
          file: filePath,
          name,
          kind: recv ? "method" : "function",
          language: "go",
          line,
          qualifiedName: recv
            ? `${recv.replace(/^\*/, "").split(" ").pop()}.${name}`
            : name,
          entryPoint: name === "main" || name === "New" || /Handler$/.test(name),
          exported: /^[A-Z]/.test(name),
          generated,
          contentHash,
        }),
      );
    }

    // HTTP handlers: mux.HandleFunc, http.Handle, chi, gin, echo
    const httpRe =
      /\.(?:HandleFunc|GET|POST|PUT|PATCH|DELETE|Handle)\(\s*"([^"]+)"/g;
    while ((m = httpRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: "route",
          language: "go",
          line,
          entryPoint: true,
          exported: true,
          generated,
          contentHash,
          metadata: { path: m[1]! },
        }),
      );
    }

    // Cobra commands
    if (/cobra\.Command/.test(source)) {
      const cobraRe = /Use:\s*"([^"]+)"/g;
      while ((m = cobraRe.exec(source))) {
        const line = lineNumberAt(source, m.index);
        symbols.push(
          makeSymbol({
            file: filePath,
            name: m[1]!,
            kind: "command",
            language: "go",
            line,
            entryPoint: true,
            generated,
            contentHash,
          }),
        );
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

    const callables = symbols.filter((s) =>
      ["function", "method", "struct", "route", "command"].includes(s.kind),
    );
    for (const caller of callables) {
      const start = offsetForLine(source, caller.location.line);
      const window = source.slice(start, start + 2500);
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

    return { symbols, relationships, language: "go" };
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

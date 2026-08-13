import type { LanguageAdapter, ParseResult } from "../shared/utils.js";
import {
  hashContent,
  isGeneratedFile,
  lineNumberAt,
  makeRel,
  makeSymbol,
} from "../shared/utils.js";
import type { AtlasSymbol } from "../../../core/src/types/index.js";

/**
 * TypeScript / TSX adapter using deterministic regex/structural extraction.
 * Preferable for v0.1: no native tree-sitter dependency; stable & fast.
 */
export const typescriptAdapter: LanguageAdapter = {
  id: "typescript",
  extensions: [".ts", ".tsx", ".mts", ".cts"],
  parse(filePath, source): ParseResult {
    return parseTsLike(filePath, source, "typescript");
  },
};

export const javascriptAdapter: LanguageAdapter = {
  id: "javascript",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  parse(filePath, source): ParseResult {
    return parseTsLike(filePath, source, "javascript");
  },
};

function parseTsLike(
  filePath: string,
  source: string,
  language: "typescript" | "javascript",
): ParseResult {
  const generated = isGeneratedFile(filePath, source);
  const contentHash = hashContent(source);
  const symbols: AtlasSymbol[] = [];
  const fileSym = makeSymbol({
    file: filePath,
    name: filePath.split(/[/\\]/).pop() ?? filePath,
    kind: "file",
    language,
    line: 1,
    generated,
    contentHash,
  });
  symbols.push(fileSym);

  // imports
  const importRe =
    /import\s+(?:type\s+)?(?:(\*\s+as\s+(\w+))|(\{[^}]+\})|(\w+))?(?:\s*,\s*(\{[^}]+\}))?\s*from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  const importNames: string[] = [];
  while ((m = importRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const mod = m[6]!;
    const ns = m[2];
    const named = m[3] ?? m[5];
    const defaultImport = m[4];
    if (ns) importNames.push(ns);
    if (defaultImport) importNames.push(defaultImport);
    if (named) {
      for (const part of named.replace(/[{}]/g, "").split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) importNames.push(name);
      }
    }
    const target = makeSymbol({
      file: filePath,
      name: mod,
      kind: "module",
      language,
      line,
      qualifiedName: `import:${mod}`,
      generated,
    });
    // lightweight module placeholder keyed by import path
    symbols.push(target);
    symbols[symbols.length - 1] = {
      ...target,
      id: `mod:${mod}`,
    };
    makeContains(fileSym, symbols[symbols.length - 1]!);
  }

  // require()
  const reqRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const mod = m[1]!;
    symbols.push({
      ...makeSymbol({
        file: filePath,
        name: mod,
        kind: "module",
        language,
        line,
        qualifiedName: `import:${mod}`,
        generated,
      }),
      id: `mod:${mod}`,
    });
  }

  // export function / async function
  const fnRe =
    /(?:export\s+)?(?:async\s+)?function\s+(\*?)\s*([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const name = m[2]!;
    const exported = /^\s*export/.test(m[0]!);
    symbols.push(
      makeSymbol({
        file: filePath,
        name,
        kind: "function",
        language,
        line,
        exported,
        entryPoint: name === "main" || isRouteHandler(name, source, m.index),
        signature: m[0]!.trim().slice(0, 120),
        generated,
        contentHash,
      }),
    );
  }

  // const/let/var arrow or function expressions (exported)
  const arrowRe =
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = arrowRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const name = m[1]!;
    symbols.push(
      makeSymbol({
        file: filePath,
        name,
        kind: "function",
        language,
        line,
        exported: /^\s*export/.test(m[0]!),
        signature: m[0]!.trim().slice(0, 120),
        generated,
        contentHash,
      }),
    );
  }

  // class
  const classRe = /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = classRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const name = m[1]!;
    symbols.push(
      makeSymbol({
        file: filePath,
        name,
        kind: "class",
        language,
        line,
        exported: /^\s*export/.test(m[0]!),
        generated,
        contentHash,
      }),
    );
  }

  // interface / type / enum
  const ifaceRe = /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g;
  while ((m = ifaceRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    symbols.push(
      makeSymbol({
        file: filePath,
        name: m[1]!,
        kind: "interface",
        language,
        line,
        exported: /^\s*export/.test(m[0]!),
        generated,
        contentHash,
      }),
    );
  }
  const typeRe = /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = typeRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    symbols.push(
      makeSymbol({
        file: filePath,
        name: m[1]!,
        kind: "type",
        language,
        line,
        exported: /^\s*export/.test(m[0]!),
        generated,
        contentHash,
      }),
    );
  }

  // methods inside classes (approximate)
  const methodRe =
    /^[ \t]+(?:(?:public|private|protected|async|static|readonly|override)\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{;]+)?\s*\{/gm;
  while ((m = methodRe.exec(source))) {
    const name = m[1]!;
    if (
      ["if", "for", "while", "switch", "catch", "function", "class", "return", "constructor"].includes(
        name,
      )
    ) {
      continue;
    }
    const line = lineNumberAt(source, m.index);
    if (symbols.some((s) => s.name === name && s.location.line === line)) continue;
    symbols.push(
      makeSymbol({
        file: filePath,
        name,
        kind: "method",
        language,
        line,
        generated,
        contentHash,
      }),
    );
  }

  // Express / Next / Nest route heuristics
  const routeRe =
    /\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((m = routeRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const method = m[1]!.toUpperCase();
    const path = m[2]!;
    symbols.push(
      makeSymbol({
        file: filePath,
        name: `${method} ${path}`,
        kind: "route",
        language,
        line,
        entryPoint: true,
        exported: true,
        generated,
        contentHash,
        metadata: { httpMethod: method, path },
      }),
    );
  }

  // Next.js app router: export async function GET/POST
  const nextRe =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;
  while ((m = nextRe.exec(source))) {
    const line = lineNumberAt(source, m.index);
    symbols.push(
      makeSymbol({
        file: filePath,
        name: m[1]!,
        kind: "route",
        language,
        line,
        entryPoint: true,
        exported: true,
        generated,
        contentHash,
      }),
    );
  }

  // Call relationships within file
  const relationships = extractCalls(filePath, source, symbols);

  // import relationships from file to modules
  for (const s of symbols) {
    if (s.kind === "module" && s.id.startsWith("mod:")) {
      relationships.push(
        makeRel({
          kind: "imports",
          fromId: fileSym.id,
          toId: s.id,
          confidence: 0.98,
          location: s.location,
          evidence: `import ${s.name}`,
        }),
      );
    }
  }

  // contains: file contains symbols
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

  return { symbols, relationships, language };
}

function makeContains(_file: AtlasSymbol, _mod: AtlasSymbol): void {
  // no-op placeholder for import side effects in earlier loop
}

function isRouteHandler(name: string, _source: string, _index: number): boolean {
  return /Handler$|Controller$|Resolver$/.test(name);
}

function extractCalls(
  filePath: string,
  source: string,
  symbols: AtlasSymbol[],
): ReturnType<typeof makeRel>[] {
  const rels: ReturnType<typeof makeRel>[] = [];
  const callables = symbols.filter((s) =>
    ["function", "method", "class", "route"].includes(s.kind),
  );
  // For each callable, look at a window of source after its declaration for calls
  for (const caller of callables) {
    const start = findOffsetForLine(source, caller.location.line);
    const window = source.slice(start, start + 2500);
    for (const callee of callables) {
      if (callee.id === caller.id) continue;
      const re = new RegExp(`\\b${escapeReg(callee.name)}\\s*(?:\\.\\w+)?\\s*\\(`);
      if (re.test(window) && callee.name.length > 1) {
        rels.push(
          makeRel({
            kind: callee.kind === "class" ? "constructs" : "calls",
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

  // Cross-reference: Identifier.method patterns against known symbols
  const memberCall = /\b([A-Z][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = memberCall.exec(source))) {
    const line = lineNumberAt(source, m.index);
    const recv = m[1]!;
    const method = m[2]!;
    const receiver = symbols.find((s) => s.name === recv);
    const methodSym = symbols.find(
      (s) => s.name === method || s.qualifiedName.endsWith(`.${method}`),
    );
    const enclosing = nearestSymbol(symbols, line);
    if (enclosing && methodSym) {
      rels.push(
        makeRel({
          kind: "calls",
          fromId: enclosing.id,
          toId: methodSym.id,
          confidence: 0.75,
          location: { file: filePath, line },
          evidence: `${recv}.${method}`,
        }),
      );
    } else if (enclosing && receiver) {
      rels.push(
        makeRel({
          kind: "references",
          fromId: enclosing.id,
          toId: receiver.id,
          confidence: 0.6,
          location: { file: filePath, line },
          evidence: `${recv}.${method}`,
        }),
      );
    }
  }

  return rels;
}

function nearestSymbol(symbols: AtlasSymbol[], line: number): AtlasSymbol | undefined {
  return symbols
    .filter((s) => s.kind !== "file" && s.kind !== "module" && s.location.line <= line)
    .sort((a, b) => b.location.line - a.location.line)[0];
}

function findOffsetForLine(source: string, line: number): number {
  if (line <= 1) return 0;
  let current = 1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      current++;
      if (current === line) return i + 1;
    }
  }
  return 0;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

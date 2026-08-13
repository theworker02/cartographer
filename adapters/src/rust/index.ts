import type { LanguageAdapter, ParseResult } from "../shared/utils.js";
import {
  hashContent,
  isGeneratedFile,
  lineNumberAt,
  makeRel,
  makeSymbol,
} from "../shared/utils.js";
import type { AtlasSymbol } from "../../../core/src/types/index.js";

export const rustAdapter: LanguageAdapter = {
  id: "rust",
  extensions: [".rs"],
  parse(filePath, source): ParseResult {
    const generated = isGeneratedFile(filePath, source);
    const contentHash = hashContent(source);
    const symbols: AtlasSymbol[] = [];
    const relationships: ReturnType<typeof makeRel>[] = [];

    const fileSym = makeSymbol({
      file: filePath,
      name: filePath.split(/[/\\]/).pop() ?? filePath,
      kind: "file",
      language: "rust",
      line: 1,
      generated,
      contentHash,
    });
    symbols.push(fileSym);

    let m: RegExpExecArray | null;

    const useRe = /^use\s+([^;]+);/gm;
    while ((m = useRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const path = m[1]!.trim();
      const mod = path.split("::")[0]!;
      const modSym = {
        ...makeSymbol({
          file: filePath,
          name: path,
          kind: "module",
          language: "rust",
          line,
          qualifiedName: `import:${path}`,
          generated,
        }),
        id: `mod:${path}`,
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
      void mod;
    }

    const modRe = /^(?:pub\s+)?mod\s+([A-Za-z_]\w*)/gm;
    while ((m = modRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: "module",
          language: "rust",
          line,
          exported: /^pub\b/.test(m[0]!),
          generated,
          contentHash,
        }),
      );
    }

    const structRe =
      /^(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum)\s+([A-Za-z_]\w*)/gm;
    while ((m = structRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: "struct",
          language: "rust",
          line,
          exported: /^pub\b/.test(m[0]!),
          generated,
          contentHash,
        }),
      );
    }

    const traitRe = /^(?:pub(?:\([^)]*\))?\s+)?trait\s+([A-Za-z_]\w*)/gm;
    while ((m = traitRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: "trait",
          language: "rust",
          line,
          exported: /^pub\b/.test(m[0]!),
          generated,
          contentHash,
        }),
      );
    }

    const fnRe =
      /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:const\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm;
    while ((m = fnRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const name = m[1]!;
      symbols.push(
        makeSymbol({
          file: filePath,
          name,
          kind: "function",
          language: "rust",
          line,
          entryPoint: name === "main" || name === "run" || name === "start",
          exported: /^pub\b/.test(m[0]!),
          generated,
          contentHash,
        }),
      );
    }

    // impl methods
    const implMethodRe =
      /^\s+(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:const\s+)?fn\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(/gm;
    while ((m = implMethodRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      const name = m[1]!;
      if (symbols.some((s) => s.name === name && s.location.line === line)) continue;
      symbols.push(
        makeSymbol({
          file: filePath,
          name,
          kind: "method",
          language: "rust",
          line,
          exported: /\bpub\b/.test(m[0]!),
          generated,
          contentHash,
        }),
      );
    }

    // Axum / Actix routes
    const axumRe =
      /\.(?:route|get|post|put|patch|delete)\(\s*"([^"]+)"/g;
    while ((m = axumRe.exec(source))) {
      const line = lineNumberAt(source, m.index);
      symbols.push(
        makeSymbol({
          file: filePath,
          name: m[1]!,
          kind: "route",
          language: "rust",
          line,
          entryPoint: true,
          exported: true,
          generated,
          contentHash,
          metadata: { path: m[1]! },
        }),
      );
    }

    // Clap commands / Tauri commands
    if (/#\[(clap|tauri::command|command)/.test(source)) {
      for (const s of symbols) {
        if (s.kind === "function" || s.kind === "method") {
          const around = source.slice(
            Math.max(0, offsetForLine(source, s.location.line) - 120),
            offsetForLine(source, s.location.line),
          );
          if (/#\[(clap|tauri::command|command)/.test(around)) {
            s.entryPoint = true;
            s.kind = /clap/.test(around) ? "command" : s.kind;
          }
        }
      }
    }

    for (const s of symbols) {
      if (s.id !== fileSym.id && !(s.kind === "module" && s.id.startsWith("mod:"))) {
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
        if (new RegExp(`\\b${escape(callee.name)}\\s*(?:!)?\\s*\\(`).test(window)) {
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

    return { symbols, relationships, language: "rust" };
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

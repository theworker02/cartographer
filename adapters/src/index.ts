import type { LanguageAdapter } from "./shared/utils.js";
import { detectLanguage } from "./shared/utils.js";
import { typescriptAdapter, javascriptAdapter } from "./typescript/index.js";
import { pythonAdapter } from "./python/index.js";
import { goAdapter } from "./go/index.js";
import { rustAdapter } from "./rust/index.js";

export * from "./shared/utils.js";

const adapters: LanguageAdapter[] = [
  typescriptAdapter,
  javascriptAdapter,
  pythonAdapter,
  goAdapter,
  rustAdapter,
];

const byExt = new Map<string, LanguageAdapter>();
for (const a of adapters) {
  for (const ext of a.extensions) {
    byExt.set(ext, a);
  }
}

export function getAdapterForFile(filePath: string): LanguageAdapter | null {
  const base = filePath.replace(/\\/g, "/");
  const dot = base.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = base.slice(dot).toLowerCase();
  return byExt.get(ext) ?? null;
}

export function supportedLanguages(): string[] {
  return adapters.map((a) => a.id);
}

export function listAdapters(): LanguageAdapter[] {
  return [...adapters];
}

export { detectLanguage };

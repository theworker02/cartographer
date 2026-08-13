import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseTomlLite } from "./toml-lite.js";
import { DEFAULT_CONFIG, type CartographerConfig } from "../types/index.js";

export function cartographerDir(root: string): string {
  return join(root, ".cartographer");
}

export function ensureCartographerDir(root: string): string {
  const dir = cartographerDir(root);
  mkdirSync(join(dir, "cache"), { recursive: true });
  mkdirSync(join(dir, "journeys"), { recursive: true });
  return dir;
}

export function loadConfig(root: string): CartographerConfig {
  const path = join(cartographerDir(root), "config.toml");
  if (!existsSync(path)) {
    return structuredClone(DEFAULT_CONFIG);
  }
  const text = readFileSync(path, "utf8");
  const raw = parseTomlLite(text) as Partial<CartographerConfig>;
  return mergeConfig(DEFAULT_CONFIG, raw);
}

export function writeDefaultConfig(root: string): string {
  ensureCartographerDir(root);
  const path = join(cartographerDir(root), "config.toml");
  if (!existsSync(path)) {
    writeFileSync(
      path,
      `# Cartographer repository configuration
version = 1

[index]
exclude = [
  "node_modules",
  "target",
  "dist",
  "vendor",
  "build",
  ".git",
  "coverage",
  "__pycache__",
  ".venv",
  "venv"
]
include_vendored = false
max_file_bytes = 1500000

[exploration]
enabled = true

[git]
history = true
`,
      "utf8",
    );
  }
  return path;
}

function mergeConfig(
  base: CartographerConfig,
  raw: Partial<CartographerConfig> & Record<string, unknown>,
): CartographerConfig {
  const index = (raw.index ?? {}) as Record<string, unknown>;
  const exploration = (raw.exploration ?? {}) as Record<string, unknown>;
  const git = (raw.git ?? {}) as Record<string, unknown>;
  return {
    version: typeof raw.version === "number" ? raw.version : base.version,
    index: {
      exclude: Array.isArray(index.exclude)
        ? (index.exclude as string[])
        : base.index.exclude,
      includeVendored:
        typeof index.include_vendored === "boolean"
          ? index.include_vendored
          : typeof index.includeVendored === "boolean"
            ? (index.includeVendored as boolean)
            : base.index.includeVendored,
      maxFileBytes:
        typeof index.max_file_bytes === "number"
          ? index.max_file_bytes
          : typeof index.maxFileBytes === "number"
            ? (index.maxFileBytes as number)
            : base.index.maxFileBytes,
    },
    exploration: {
      enabled:
        typeof exploration.enabled === "boolean"
          ? exploration.enabled
          : base.exploration.enabled,
    },
    git: {
      history:
        typeof git.history === "boolean" ? git.history : base.git.history,
    },
    languages: base.languages,
  };
}

export function resolveIgnorePatterns(
  root: string,
  config: CartographerConfig,
): string[] {
  const patterns = [...config.index.exclude];
  const cartoIgnore = join(root, ".cartographerignore");
  if (existsSync(cartoIgnore)) {
    const lines = readFileSync(cartoIgnore, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    patterns.push(...lines);
  }
  return patterns;
}

export function writeJsonAtomic(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}`;
  const payload = JSON.stringify(data, null, 2) + "\n";
  writeFileSync(tmp, payload, "utf8");
  try {
    renameSync(tmp, path);
  } catch {
    writeFileSync(path, payload, "utf8");
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

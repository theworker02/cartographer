import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ArchitectureDiff, HistoryEvent } from "../types/index.js";

function runGit(root: string, args: string[]): string | null {
  if (!existsSync(join(root, ".git"))) return null;
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 15_000,
    }).trim();
  } catch {
    return null;
  }
}

export function getGitRevision(root: string): string | null {
  return runGit(root, ["rev-parse", "HEAD"]);
}

export function getGitBranch(root: string): string | null {
  return runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function fileHistory(root: string, file: string, limit = 20): HistoryEvent[] {
  const out = runGit(root, [
    "log",
    `-n${limit}`,
    "--pretty=format:%H|%ad|%s",
    "--date=short",
    "--",
    file,
  ]);
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    const [commit, date, ...rest] = line.split("|");
    return {
      date: date ?? "",
      summary: rest.join("|"),
      commit,
      files: [file],
    };
  });
}

export function territoryHistory(
  root: string,
  filePaths: string[],
  limit = 25,
): HistoryEvent[] {
  if (!filePaths.length) return [];
  const out = runGit(root, [
    "log",
    `-n${limit}`,
    "--pretty=format:%H|%ad|%s",
    "--date=short",
    "--",
    ...filePaths.slice(0, 40),
  ]);
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    const [commit, date, ...rest] = line.split("|");
    return {
      date: date ?? "",
      summary: rest.join("|"),
      commit,
      files: filePaths.slice(0, 5),
    };
  });
}

export function blameLine(
  root: string,
  file: string,
  line: number,
): { commit?: string; author?: string; summary?: string } | null {
  const out = runGit(root, ["blame", "-L", `${line},${line}`, "--porcelain", "--", file]);
  if (!out) return null;
  const lines = out.split(/\r?\n/);
  const commit = lines[0]?.split(" ")[0];
  const author = lines.find((l) => l.startsWith("author "))?.slice(7);
  const summary = lines.find((l) => l.startsWith("summary "))?.slice(8);
  return { commit, author, summary };
}

export function architectureDiffSince(
  root: string,
  since: string,
): ArchitectureDiff | null {
  const out = runGit(root, ["diff", "--name-status", since, "HEAD"]);
  if (out == null) return null;
  const added: string[] = [];
  const removed: string[] = [];
  const moved: ArchitectureDiff["moved"] = [];
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const [status, a, b] = line.split(/\t/);
    if (!status || !a) continue;
    if (status.startsWith("A")) added.push(dirnameish(a));
    else if (status.startsWith("D")) removed.push(dirnameish(a));
    else if (status.startsWith("R") && b) {
      moved.push({ name: basenameish(a), from: dirnameish(a), to: dirnameish(b) });
    }
  }
  return {
    addedTerritories: [...new Set(added)].slice(0, 20),
    removedTerritories: [...new Set(removed)].slice(0, 20),
    moved: moved.slice(0, 20),
    newCorridors: [],
    changedEntryPoints: [],
    changedLandmarks: [],
  };
}

function dirnameish(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.length > 1 ? parts.slice(0, -1).join("/") : parts[0]!;
}

function basenameish(p: string): string {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

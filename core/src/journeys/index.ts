import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Journey, JourneyStop } from "../types/index.js";
import { cartographerDir, ensureCartographerDir } from "../config/index.js";

export function journeysDir(root: string): string {
  return join(cartographerDir(root), "journeys");
}

export function listJourneys(root: string): Journey[] {
  const dir = journeysDir(root);
  if (!existsSync(dir)) return [];
  const out: Journey[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") && !file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    const path = join(dir, file);
    try {
      const text = readFileSync(path, "utf8");
      if (file.endsWith(".json")) {
        const j = JSON.parse(text) as Journey;
        out.push({ ...j, path });
      } else {
        out.push(parseJourneyYaml(text, path));
      }
    } catch {
      // skip invalid
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveJourney(root: string, journey: Journey): Journey {
  ensureCartographerDir(root);
  const dir = journeysDir(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${slug(journey.id || journey.name)}.json`);
  const toSave = { ...journey, path };
  writeFileSync(path, JSON.stringify(toSave, null, 2) + "\n");
  return toSave;
}

export function getJourney(root: string, nameOrId: string): Journey | null {
  const all = listJourneys(root);
  return (
    all.find(
      (j) =>
        j.id === nameOrId ||
        j.name.toLowerCase() === nameOrId.toLowerCase() ||
        j.id.endsWith(nameOrId),
    ) ?? null
  );
}

/** Lightweight YAML subset for journey files. */
function parseJourneyYaml(text: string, path: string): Journey {
  const lines = text.split(/\r?\n/);
  let name = "Untitled";
  let description = "";
  let generated = false;
  let reviewed = false;
  let id = "";
  const stops: JourneyStop[] = [];
  let inStops = false;
  let current: Partial<JourneyStop> | null = null;

  const flush = () => {
    if (current && current.name) {
      stops.push({
        order: current.order ?? stops.length + 1,
        name: current.name,
        purpose: current.purpose ?? "",
        symbolId: current.symbolId,
        explanation: current.explanation,
        location: current.location,
      });
    }
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "");
    if (!line.trim()) continue;
    if (/^stops\s*:/.test(line)) {
      inStops = true;
      continue;
    }
    if (!inStops) {
      const m = line.match(/^(\w+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key === "name") name = val;
      if (key === "description") description = val;
      if (key === "id") id = val;
      if (key === "generated") generated = val === "true";
      if (key === "reviewed") reviewed = val === "true";
      continue;
    }
    if (/^\s*-\s+name\s*:/.test(line)) {
      flush();
      current = {
        order: stops.length + 1,
        name: line.replace(/^\s*-\s+name\s*:\s*/, "").replace(/['"]/g, "").trim(),
      };
      continue;
    }
    if (current) {
      const m = line.match(/^\s+(\w+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!.trim().replace(/^["']|["']$/g, "");
      if (key === "purpose") current.purpose = val;
      if (key === "symbolId" || key === "symbol_id") current.symbolId = val;
      if (key === "explanation") current.explanation = val;
      if (key === "order") current.order = Number(val);
    }
  }
  flush();

  return {
    id: id || `journey:${slug(name)}`,
    name,
    description,
    generated,
    reviewed,
    stops,
    path,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

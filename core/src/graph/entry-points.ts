import type {
  AtlasSymbol,
  Effect,
  EntryPoint,
  Relationship,
} from "../types/index.js";

export function detectEntryPoints(
  symbols: AtlasSymbol[],
  _relationships: Relationship[],
): EntryPoint[] {
  const out: EntryPoint[] = [];
  for (const s of symbols) {
    if (!s.entryPoint && s.name !== "main" && s.kind !== "route" && s.kind !== "command") {
      continue;
    }
    let category: EntryPoint["category"] = "other";
    let label = s.qualifiedName;

    if (s.kind === "route" || s.metadata?.httpMethod || s.metadata?.path) {
      category = "http";
      label = s.name;
    } else if (s.kind === "command" || s.metadata?.cli) {
      category = "cli";
      label = s.name;
    } else if (s.name === "main" || /\/main\.(ts|js|go|rs|py)$/.test(s.location.file)) {
      category = "library";
      label = s.qualifiedName;
    } else if (/job|worker|cron/i.test(s.name) || /\/jobs\//i.test(s.location.file)) {
      category = "job";
      label = s.qualifiedName;
    } else if (s.exported && (s.kind === "function" || s.kind === "class")) {
      category = "library";
      label = s.qualifiedName;
    } else if (!s.entryPoint) {
      continue;
    }

    out.push({ symbol: { ...s, entryPoint: true }, category, label });
  }

  // de-dupe by symbol id
  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.symbol.id)) return false;
    seen.add(e.symbol.id);
    return true;
  });
}

export function detectEffects(
  symbols: AtlasSymbol[],
  _relationships: Relationship[],
): Effect[] {
  const effects: Effect[] = [];
  for (const s of symbols) {
    const n = `${s.name} ${s.qualifiedName} ${s.location.file}`.toLowerCase();
    const add = (kind: Effect["kind"], description: string, confidence: number) => {
      effects.push({ kind, symbolId: s.id, description, confidence });
    };
    if (/writefile|mkdir|createwritestream|fs\.write|filesystem::write|std::fs/.test(n)) {
      add("filesystem", "Filesystem write", 0.7);
    }
    if (/query|execute|insert|update|delete|repository|sql|prisma|database/.test(n) &&
        /save|insert|update|delete|write|persist|commit|exec/.test(n)) {
      add("database", "Database mutation", 0.65);
    }
    if (/fetch\(|axios|http\.client|reqwest|ureq|websocket/.test(n)) {
      add("network", "Network call", 0.6);
    }
    if (/spawn|exec\(|child_process|command::new|process::Command/.test(n)) {
      add("process", "Process spawn", 0.7);
    }
    if (/emit\(|publish\(|eventemitter|bus\.|dispatch\(/.test(n)) {
      add("event", "Event publication", 0.55);
    }
    if (/console\.(log|info|warn|error)|logger\.|tracing::|log::/.test(n)) {
      add("logging", "Logging", 0.5);
    }
    if (/render\(|setstate|widget|jsx|tsx/.test(n) && /component|page|view|widget/.test(n)) {
      add("ui", "UI rendering", 0.55);
    }
  }
  return effects;
}

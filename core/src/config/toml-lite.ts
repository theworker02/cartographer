/**
 * Minimal TOML subset parser for Cartographer config.
 * Supports: strings, numbers, booleans, arrays of strings, [tables], # comments.
 */
export function parse(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let current: Record<string, unknown> = root;
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const table = line.match(/^\[([a-zA-Z0-9_.-]+)\]$/);
    if (table) {
      const key = table[1]!;
      if (!root[key] || typeof root[key] !== "object") {
        root[key] = {};
      }
      current = root[key] as Record<string, unknown>;
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const valueRaw = line.slice(eq + 1).trim();
    current[key] = parseValue(valueRaw, lines, lines.indexOf(rawLine));
  }

  return root;
}

function parseValue(
  valueRaw: string,
  allLines: string[],
  startIdx: number,
): unknown {
  if (valueRaw === "true") return true;
  if (valueRaw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(valueRaw)) return Number(valueRaw);
  if (valueRaw.startsWith('"') && valueRaw.endsWith('"')) {
    return JSON.parse(valueRaw);
  }
  if (valueRaw.startsWith("[")) {
    if (valueRaw.endsWith("]")) {
      return parseArray(valueRaw);
    }
    // multiline array
    let buf = valueRaw;
    for (let i = startIdx + 1; i < allLines.length; i++) {
      const part = allLines[i]!.replace(/#.*$/, "").trim();
      buf += " " + part;
      if (part.includes("]")) break;
    }
    return parseArray(buf);
  }
  return valueRaw;
}

function parseArray(raw: string): string[] {
  const inner = raw.replace(/^\[/, "").replace(/\]$/, "");
  if (!inner.trim()) return [];
  const items: string[] = [];
  const re = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|[^,\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    let v = m[0]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v) items.push(v);
  }
  return items;
}

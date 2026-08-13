import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = JSON.parse(readFileSync(join(root, ".cursor-plugin/plugin.json"), "utf8"));

const allowed = new Set([
  "name",
  "description",
  "version",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "logo",
  "rules",
  "agents",
  "skills",
  "commands",
  "hooks",
  "mcpServers",
  "variables",
]);

const unknown = Object.keys(plugin).filter((k) => !allowed.has(k));
if (unknown.length) {
  console.error("Unknown plugin.json fields:", unknown.join(", "));
  process.exit(1);
}

if (!plugin.name || !plugin.version || !plugin.logo) {
  console.error("plugin.json missing required name/version/logo");
  process.exit(1);
}

if (!existsSync(join(root, plugin.logo))) {
  console.error("Logo missing:", plugin.logo);
  process.exit(1);
}

for (const dir of ["commands", "skills", "agents", "rules"]) {
  if (!existsSync(join(root, dir))) {
    console.error("Missing plugin surface:", dir);
    process.exit(1);
  }
}

if (!existsSync(join(root, "mcp.json"))) {
  console.error("Missing mcp.json");
  process.exit(1);
}

console.log("Plugin manifest OK:", plugin.name, plugin.version);

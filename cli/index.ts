#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Atlas } from "../core/src/atlas.js";
import { formatDoctorReport, runDoctor } from "../core/src/doctor/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
let version = "0.2.0";
try {
  // dist/cli → repo root (two levels up). Source path also works via catch fallback.
  version = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8")).version;
} catch {
  /* ignore */
}

const program = new Command();
program
  .name("cartographer")
  .description("A navigation system for software architecture. Know where you are in the code.")
  .version(version)
  .option("-C, --cwd <path>", "repository root", process.cwd());

function rootOf(cmd: Command): string {
  const opts = cmd.optsWithGlobals() as { cwd?: string };
  return resolve(opts.cwd ?? process.cwd());
}

function openAtlas(cmd: Command): Atlas {
  return Atlas.open(rootOf(cmd));
}

program
  .command("index")
  .description("Survey the repository and build / refresh the Atlas")
  .option("--incremental", "only re-index changed files", false)
  .option("--brief", "print Living Atlas Briefing after index", true)
  .option("--no-brief", "skip briefing output")
  .option("--json", "machine-readable output", false)
  .action(async (opts, cmd) => {
    const root = rootOf(cmd);
    const result = await Atlas.index({
      root,
      incremental: !!opts.incremental,
      onProgress: opts.json
        ? undefined
        : (p) => {
            process.stderr.write(
              `\r[${p.phase}] files=${p.files} symbols≈${p.symbols}  ${p.message ?? ""}   `,
            );
          },
    });
    if (!opts.json) process.stderr.write("\n");
    const counts = result.store.counts();
    result.store.close();

    if (opts.json) {
      console.log(JSON.stringify({ meta: result.meta, counts }, null, 2));
      return;
    }

    console.log(
      `Atlas ready · ${counts.files} files · ${counts.symbols} symbols · ${counts.relationships} relationships · ${counts.territories} territories`,
    );

    if (opts.brief) {
      const atlas = Atlas.open(root);
      console.log("");
      console.log(atlas.brief().text);
      atlas.close();
    }
  });

program
  .command("brief")
  .description("Living Atlas Briefing — understand a repo in ~15 seconds")
  .argument("[file]", "optional file for YOU ARE HERE")
  .argument("[line]", "line number", "1")
  .option("--json", "machine-readable output", false)
  .action((file, line, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const briefing = atlas.brief({
      file,
      line: file ? Number(line) || 1 : undefined,
    });
    if (opts.json) {
      const { text: _t, ...rest } = briefing;
      console.log(JSON.stringify(rest, null, 2));
    } else {
      console.log(briefing.text);
    }
    atlas.close();
  });

program
  .command("status")
  .description("Atlas status, exploration coverage, hubs, and landmark drift")
  .option("--brief", "include Living Atlas Briefing", false)
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    const status = atlas.status();
    if (opts.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      const m = status.meta;
      console.log("Cartographer Status");
      console.log("───────────────────");
      if (m) {
        console.log(`Root:        ${m.root}`);
        console.log(`Indexed:     ${m.indexedAt}`);
        console.log(`Revision:    ${m.revision ?? "n/a"} (${status.branch ?? "n/a"})`);
        console.log(`Languages:   ${m.languages.join(", ") || "—"}`);
      }
      console.log(
        `Graph:       ${status.counts.files} files · ${status.counts.symbols} symbols · ${status.counts.relationships} edges · ${status.counts.territories} territories`,
      );
      console.log(
        `Exploration: ${Math.round(status.exploration.coverage * 100)}% coverage · frontier [${status.exploration.fog.frontier.slice(0, 5).join(", ") || "—"}]`,
      );
      if (status.hubs.length) {
        console.log("Hubs/bridges:");
        for (const h of status.hubs.slice(0, 6)) {
          console.log(`  [${h.role}] ${h.symbol.name} · ${h.territoriesTouched.join(" → ") || "—"}`);
        }
      }
      if (status.drift.length) {
        console.log(`Landmark drift: ${status.drift.length} need review`);
      }
      if (opts.brief) {
        console.log("");
        console.log(atlas.brief().text);
      }
    }
    atlas.close();
  });

program
  .command("whereami")
  .alias("where")
  .description("Architecture breadcrumb + Living Atlas Briefing for a file location")
  .argument("[file]", "source file")
  .argument("[line]", "line number", "1")
  .option("--compact", "short whereami without full briefing", false)
  .option("--json", "machine-readable output", false)
  .action((file, line, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const result = atlas.whereami(file, Number(line) || 1);
    if (opts.json) {
      console.log(
        JSON.stringify(
          { position: result.position, miniAtlas: result.miniAtlas, briefing: result.briefing },
          null,
          2,
        ),
      );
    } else if (opts.compact) {
      console.log(result.text);
    } else {
      console.log(result.briefing.text);
    }
    atlas.close();
  });

program
  .command("goto")
  .description("Resolve a symbol / file:line and print its coordinates")
  .argument("<query>", "symbol name or file:line")
  .option("--json", "machine-readable output", false)
  .action((query, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const sym = atlas.goto(query);
    if (!sym) {
      console.error(`Not found: ${query}`);
      atlas.close();
      process.exitCode = 1;
      return;
    }
    if (opts.json) console.log(JSON.stringify(sym, null, 2));
    else {
      console.log(`${sym.kind} ${sym.qualifiedName}`);
      console.log(`  ${sym.location.file}:${sym.location.line}`);
      if (sym.territoryId) console.log(`  territory: ${sym.territoryId}`);
    }
    atlas.close();
  });

program
  .command("route")
  .description("Find corridor-aware routes between two symbols")
  .argument("<from>", "from symbol / file:line")
  .argument("<to>", "to symbol / file:line")
  .option("--json", "machine-readable output", false)
  .action((from, to, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const routes = atlas.route(from, to, true);
    if (!routes.length) {
      console.error(`No route from ${from} to ${to}`);
      atlas.close();
      process.exitCode = 1;
      return;
    }
    if (opts.json) console.log(JSON.stringify(routes, null, 2));
    else {
      for (const [i, r] of routes.entries()) {
        console.log(
          `Route #${i + 1}  score=${r.score}  hops=${r.length}  transitions=${r.territoryTransitions}`,
        );
        console.log(r.explanation ?? atlas.explainRoute(r));
        console.log("");
      }
    }
    atlas.close();
  });

program
  .command("explain-route")
  .description("Explain the best route between two symbols")
  .argument("<from>", "from symbol")
  .argument("<to>", "to symbol")
  .action((from, to, _opts, cmd) => {
    const atlas = openAtlas(cmd);
    const routes = atlas.route(from, to, true);
    if (!routes.length) {
      console.error(`No route from ${from} to ${to}`);
      process.exitCode = 1;
    } else {
      console.log(routes[0]!.explanation ?? atlas.explainRoute(routes[0]!));
    }
    atlas.close();
  });

program
  .command("upstream")
  .description("Who reaches this symbol?")
  .argument("<query>", "symbol name or file:line")
  .option("-d, --depth <n>", "traversal depth", "3")
  .option("--json", "machine-readable output", false)
  .action((query, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const items = atlas.upstream(query, Number(opts.depth) || 3);
    if (opts.json) console.log(JSON.stringify(items, null, 2));
    else {
      for (const s of items.slice(0, 40)) {
        console.log(
          `${s.kind.padEnd(10)} ${s.qualifiedName}  (${s.location.file}:${s.location.line})`,
        );
      }
      console.log(`(${items.length} upstream)`);
    }
    atlas.close();
  });

program
  .command("downstream")
  .description("What does this symbol reach?")
  .argument("<query>", "symbol name or file:line")
  .option("-d, --depth <n>", "traversal depth", "3")
  .option("--json", "machine-readable output", false)
  .action((query, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const items = atlas.downstream(query, Number(opts.depth) || 3);
    if (opts.json) console.log(JSON.stringify(items, null, 2));
    else {
      for (const s of items.slice(0, 40)) {
        console.log(
          `${s.kind.padEnd(10)} ${s.qualifiedName}  (${s.location.file}:${s.location.line})`,
        );
      }
      console.log(`(${items.length} downstream)`);
    }
    atlas.close();
  });

program
  .command("territories")
  .description("List inferred architectural territories")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    const items = atlas.territories().filter((t) => !t.parentId);
    if (opts.json) console.log(JSON.stringify(items, null, 2));
    else {
      for (const t of items) {
        console.log(
          `${t.name.padEnd(16)} ${String(t.evidence.symbols).padStart(5)} symbols  conf=${(t.confidence * 100).toFixed(0)}%  density=${t.evidence.internal_density}`,
        );
      }
    }
    atlas.close();
  });

program
  .command("hubs")
  .description("Show architectural hubs and bridges")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    const hubs = atlas.hubs();
    if (opts.json) console.log(JSON.stringify(hubs, null, 2));
    else {
      for (const h of hubs) {
        console.log(
          `[${h.role.padEnd(6)}] ${h.symbol.name.padEnd(24)} in=${h.inDegree} out=${h.outDegree}  ⟨${h.territoriesTouched.join(", ")}⟩`,
        );
      }
    }
    atlas.close();
  });

program
  .command("landmarks")
  .description("List landmarks (with drift status)")
  .option("--add <name>", "create a landmark")
  .option("--file <path>", "file for new landmark")
  .option("--line <n>", "line for new landmark", "1")
  .option("--description <text>", "landmark description", "")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    if (opts.add) {
      if (!opts.file) {
        console.error("--file is required with --add");
        process.exitCode = 1;
        atlas.close();
        return;
      }
      const lm = atlas.addLandmark({
        name: opts.add,
        description: opts.description || opts.add,
        location: {
          file: opts.file.replace(/\\/g, "/"),
          line: Number(opts.line) || 1,
        },
      });
      console.log(`Landmark created: ${lm.name} (${lm.id})`);
      atlas.close();
      return;
    }
    const items = atlas.landmarks();
    if (opts.json) console.log(JSON.stringify(items, null, 2));
    else {
      for (const l of items) {
        const drift =
          l.driftStatus && l.driftStatus !== "ok" ? ` [${l.driftStatus}]` : "";
        console.log(`${l.name}${drift}`);
        console.log(`  ${l.location.file}:${l.location.line} — ${l.description}`);
      }
      if (!items.length) console.log("(no landmarks yet)");
    }
    atlas.close();
  });

program
  .command("journeys")
  .description("List guided journeys")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    const items = atlas.journeys();
    if (opts.json) console.log(JSON.stringify(items, null, 2));
    else {
      for (const j of items) {
        console.log(
          `${j.name}  (${j.stops.length} stops)${j.generated ? " [generated]" : ""}`,
        );
      }
      if (!items.length) console.log("(no journeys — try `cartographer tour`)");
    }
    atlas.close();
  });

program
  .command("tour")
  .description("Architecture tour + Living Atlas Briefing")
  .argument("[name]", "journey name")
  .option("--json", "machine-readable output", false)
  .action((name, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const briefing = atlas.brief();
    const journey = atlas.tour(name);
    if (opts.json) {
      console.log(JSON.stringify({ briefing, journey }, null, 2));
      atlas.close();
      return;
    }
    console.log(briefing.text);
    console.log("");
    if (!journey) {
      console.error("No tour stops available — ensure entry points exist");
      process.exitCode = 1;
    } else {
      console.log(`── Tour: ${journey.name} ──`);
      if (journey.description) console.log(journey.description);
      console.log("");
      for (const s of journey.stops) {
        const loc = s.location ? `  ${s.location.file}:${s.location.line}` : "";
        console.log(`${s.order}. ${s.name}${loc}`);
        console.log(`   ${s.purpose}`);
      }
    }
    atlas.close();
  });

program
  .command("unexplored")
  .description("Fog-of-war frontiers — what you have not yet charted")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    const u = atlas.unexplored();
    if (opts.json) console.log(JSON.stringify(u, null, 2));
    else {
      console.log(`Coverage: ${Math.round(u.coverage * 100)}%`);
      console.log(`Understood: ${u.fog.understood.join(", ") || "—"}`);
      console.log(`Frontier:   ${u.fog.frontier.join(", ") || "—"}`);
      console.log(`Beyond:     ${u.fog.beyond.join(", ") || "—"}`);
      if (u.unvisitedLandmarks.length) {
        console.log("Unvisited landmarks:");
        for (const l of u.unvisitedLandmarks.slice(0, 10)) {
          console.log(`  • ${l.name}`);
        }
      }
    }
    atlas.close();
  });

program
  .command("history")
  .description("Git history for a file, symbol, or territory")
  .argument("[target]", "file, symbol, or territory name")
  .option("--json", "machine-readable output", false)
  .action((target, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const hist = atlas.history(target);
    if (opts.json) console.log(JSON.stringify(hist, null, 2));
    else {
      console.log(`Branch: ${hist.branch ?? "n/a"}  Rev: ${hist.revision ?? "n/a"}`);
      for (const e of hist.events.slice(0, 20)) {
        console.log(`${e.date}  ${(e.commit ?? "").slice(0, 8)}  ${e.summary}`);
      }
      if ("blame" in hist && hist.blame) {
        console.log(`Blame: ${hist.blame.author ?? "?"} — ${hist.blame.summary ?? ""}`);
      }
    }
    atlas.close();
  });

program
  .command("search")
  .description("Concept search across territories, landmarks, entries, hubs, symbols")
  .argument("<query>", "search query")
  .option("--json", "machine-readable output", false)
  .action((query, opts, cmd) => {
    const atlas = openAtlas(cmd);
    const hits = atlas.search(query);
    if (opts.json) console.log(JSON.stringify(hits, null, 2));
    else {
      for (const h of hits) {
        const loc = h.location ? `  ${h.location.file}:${h.location.line}` : "";
        console.log(`[${h.kind}] ${h.title}${loc}`);
        console.log(`         ${h.subtitle}`);
      }
      if (!hits.length) console.log("No matches");
    }
    atlas.close();
  });

program
  .command("doctor")
  .description("Health checks for Atlas integrity")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const root = rootOf(cmd);
    const atlas = Atlas.tryOpen(root);
    if (!atlas) {
      const report = runDoctor({
        root,
        store: null,
        meta: null,
        symbols: [],
        relationships: [],
        territories: [],
        landmarks: [],
        corridors: [],
        entryPoints: [],
      });
      if (opts.json) console.log(JSON.stringify(report, null, 2));
      else console.log(formatDoctorReport(report));
      process.exitCode = 1;
      return;
    }
    const report = atlas.doctor();
    if (opts.json) console.log(JSON.stringify(report, null, 2));
    else console.log(atlas.formatDoctor());
    if (!report.ok) process.exitCode = 1;
    atlas.close();
  });

program
  .command("corridors")
  .description("List detected architectural corridors")
  .option("--json", "machine-readable output", false)
  .action((opts, cmd) => {
    const atlas = openAtlas(cmd);
    const items = atlas.corridors();
    if (opts.json) console.log(JSON.stringify(items, null, 2));
    else {
      for (const c of items) {
        console.log(`${c.name}  (×${c.frequency})`);
      }
    }
    atlas.close();
  });

await program.parseAsync(process.argv);

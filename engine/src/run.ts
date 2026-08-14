#!/usr/bin/env node
/**
 * Local run orchestration (CLI entry point).
 *
 *   npm run run -- --url https://example.com [--config ../config/sites/hero-site.json]
 *
 * Produces /runs/<id>/timeline.json.
 * Paste an unfamiliar URL with no --config and a real report still lands —
 * only the scripted task flow needs a config, and its absence means the
 * UI's "no task configured" state, not an error.
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { runAudit } from "./runAudit";
import { writeTimeline } from "./emitter";

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  if (!url) {
    console.error("Usage: npm run run -- --url <https://...> [--config <path>]");
    process.exit(1);
  }

  console.log(`[run] starting against ${url}`);
  const timeline = await runAudit({ url, configPath: args.config, onLog: (l) => console.log(`[run] ${l}`) });

  const runDir = path.join(process.cwd(), "..", "runs", `run-${Date.now()}`);
  await mkdir(runDir, { recursive: true });
  const outPath = await writeTimeline(runDir, timeline);

  console.log(`[run] wrote ${outPath}`);
  console.log(`[run] total findings: ${timeline.events.filter((e) => e.type === "violation").length}`);
}

main().catch((err) => {
  console.error("[run] fatal error:", err);
  process.exit(1);
});

/**
 * Writes the completed Timeline to /runs/<id>/timeline.json.
 * Storage is local filesystem only in v0 — no database.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Timeline, TimelineEvent, TimelineMeta } from "../../schema/timeline";

export function assembleTimeline(
  metaPartial: Omit<TimelineMeta, "durationMs">,
  events: TimelineEvent[]
): Timeline {
  // Events accumulate out of strict order across async check phases — sort
  // once, at emission time, so the player never has to reason about it.
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const durationMs = sorted.at(-1)?.t ?? 0;

  return {
    meta: { ...metaPartial, durationMs },
    events: sorted,
  };
}

export async function writeTimeline(runDir: string, timeline: Timeline): Promise<string> {
  const outPath = path.join(runDir, "timeline.json");
  await writeFile(outPath, JSON.stringify(timeline, null, 2), "utf-8");
  return outPath;
}

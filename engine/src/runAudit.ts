/**
 * The reusable core of a run — extracted from run.ts so both the CLI and
 * the local API server (server.ts) call the exact same code path. No
 * behavior differs between "npm run run" and "hit the API" — same engine,
 * two entry points.
 */
import { readFile } from "node:fs/promises";
import { startSession, endSession } from "./harness";
import { runAxeScan } from "../checks/axeScan";
import { walkTabOrder, reachabilityDiff } from "../checks/keyboardEngine";
import { buildAnnouncementIndex } from "../checks/axTree";
import { attemptTaskStep, type TaskConfig } from "../checks/taskCompletion";
import { assembleTimeline } from "./emitter";
import type { Timeline, TimelineEvent } from "../../schema/timeline";

const VIEWPORT = { width: 1280, height: 900 };

export interface RunAuditOptions {
  url: string;
  configPath?: string;
  onLog?: (line: string) => void;
}

export async function runAudit(opts: RunAuditOptions): Promise<Timeline> {
  const log = opts.onLog ?? console.log;
  const runId = `run-${Date.now()}`;
  const session = await startSession({ url: opts.url, runId });
  const events: TimelineEvent[] = [];
  const startedAt = new Date().toISOString();
  let t = 0;

  try {
    const axeEvents = await runAxeScan(session.page, t);
    events.push(...axeEvents);
    log(`axe-core: ${axeEvents.length} findings`);

    t += 500;
    const walk = await walkTabOrder(session.page, t);
    events.push(...walk.keypresses, ...walk.focuses, ...walk.announcements, ...walk.violations);
    t = walk.focuses.at(-1)?.t ?? t;

    const reachability = await reachabilityDiff(session.page, walk.reachableSelectors);
    events.push(...reachability);
    log(`keyboard engine: ${walk.reachableSelectors.length} reached, trap=${walk.trapDetected}, ${reachability.length} unreachable`);

    try {
      const announcementIndex = await buildAnnouncementIndex(session.page);
      log(`CDP tree: ${announcementIndex.size} named nodes`);
    } catch (err) {
      log(`CDP tree read failed, continuing: ${err}`);
    }

    if (opts.configPath) {
      const config = JSON.parse(await readFile(opts.configPath, "utf-8")) as TaskConfig;
      log(`task config: "${config.task}" (${config.steps.length} steps)`);

      let failed = false;
      for (let i = 0; i < config.steps.length; i++) {
        if (failed) {
          events.push({ t: t + (i + 1) * 10, type: "task-step", label: config.steps[i].label, status: "skip" });
          continue;
        }
        const result = await attemptTaskStep(session.page, config.steps[i], t);
        t = result.nextT;
        events.push(result.event);
        if (result.violation) {
          events.push(result.violation);
          log(`task step "${config.steps[i].label}" FAILED: ${result.violation.plainEnglish}`);
          failed = true;
        } else {
          log(`task step "${config.steps[i].label}" passed`);
        }
      }
    } else {
      log("no task config — full-page checks only");
    }

    return assembleTimeline(
      {
        url: opts.url,
        startedAt,
        viewportWidth: VIEWPORT.width,
        viewportHeight: VIEWPORT.height,
        screenReaderNote:
          "Screen reader (simulated announcement) — computed from the accessibility tree, not a real JAWS/NVDA/VoiceOver run.",
      },
      events
    );
  } finally {
    await endSession(session);
  }
}

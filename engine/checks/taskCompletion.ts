/**
 * Task completion by keyboard — THE SIGNATURE CHECK.
 * Reads the per-site config steps, attempts to reach each target by
 * Tab + Enter only, and reports the deterministic reason it broke.
 * Emits TaskStepEvent (label/status: pass|fail|skip) per schema v0.2 —
 * a step is "skip" when a prior step already failed, since the flow
 * cannot meaningfully continue past the failure point.
 */
import type { Page } from "playwright";
import type { TaskStepEvent, ViolationEvent, BBox } from "../../schema/timeline";

export interface TaskStep {
  goto?: string;
  target?: string;
  label: string; // human-readable, e.g. "Fill card details" — shown verbatim in the task status panel
}

export interface TaskConfig {
  site: string;
  task: string;
  steps: TaskStep[];
}

const MAX_TABS_PER_STEP = 40;

export async function diagnoseUnreachable(page: Page, selector: string): Promise<string> {
  const info = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const e = el as HTMLElement;
      const style = getComputedStyle(e);
      return {
        tag: e.tagName.toLowerCase(),
        tabindex: e.getAttribute("tabindex"),
        role: e.getAttribute("role"),
        display: style.display,
        visibility: style.visibility,
        disabled: (e as any).disabled ?? false,
      };
    })
    .catch(() => null);

  if (!info) return "The target element could not be found on the page at all.";
  if (info.display === "none" || info.visibility === "hidden")
    return "The element is present in the DOM but hidden (display:none or visibility:hidden), so it's never in the tab order.";
  if (info.disabled) return "The element is disabled, so it's skipped by the tab order entirely.";
  if (info.tag === "div" || info.tag === "span") {
    if (info.tabindex === null && info.role !== "button" && info.role !== "link") {
      return `The control is rendered as a <${info.tag}> with no tabindex and no button/link role, so the keyboard skips over it — only its onClick (mouse) handler works.`;
    }
  }
  if (info.tabindex === "-1") return `The element has tabindex="-1", which explicitly removes it from the tab order.`;
  return "The element is technically focusable but was not reached within the step budget — likely an ordering or timing issue.";
}

export interface StepResult {
  event: TaskStepEvent;
  violation: ViolationEvent | null;
  nextT: number;
}

export async function attemptTaskStep(page: Page, step: TaskStep, startT: number): Promise<StepResult> {
  let t = startT;

  if (step.goto) {
    await page.goto(new URL(step.goto, page.url()).toString(), { waitUntil: "domcontentloaded" });
    t += 500;
  }

  if (!step.target) {
    return { event: { t, type: "task-step", label: step.label, status: "pass" }, violation: null, nextT: t };
  }

  const locator = page.locator(step.target).first();
  const exists = (await locator.count()) > 0;
  if (!exists) {
    return {
      event: { t, type: "task-step", label: step.label, status: "fail" },
      violation: {
        t,
        type: "violation",
        checkId: "task-completion",
        selector: step.target,
        wcag: "2.1.1",
        severity: "critical",
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        plainEnglish: `The task target (${step.target}) does not exist on the page — the task cannot be attempted.`,
        fix: "Verify the task config selector matches the current page markup.",
        provenance: "rule",
      },
      nextT: t,
    };
  }

  for (let i = 0; i < MAX_TABS_PER_STEP; i++) {
    const activeHandle = await page.evaluateHandle(() => document.activeElement);
    const isFocused = await locator.evaluate((el, active) => el === active, activeHandle).catch(() => false);
    if (isFocused) {
      await page.keyboard.press("Enter");
      t += 150;
      return { event: { t, type: "task-step", label: step.label, status: "pass" }, violation: null, nextT: t };
    }
    await page.keyboard.press("Tab");
    t += 90;
  }

  const reason = await diagnoseUnreachable(page, step.target);
  const box: BBox = (await locator.boundingBox().catch(() => null)) ?? { x: 0, y: 0, width: 0, height: 0 };

  return {
    event: { t, type: "task-step", label: step.label, status: "fail" },
    violation: {
      t,
      type: "violation",
      checkId: "task-completion",
      selector: step.target,
      wcag: "2.1.1",
      severity: "critical",
      bbox: box,
      plainEnglish: `Could not reach ${step.target} by keyboard within ${MAX_TABS_PER_STEP} tab presses. ${reason}`,
      fix: "Use a native focusable element (button/a) for this control, or add tabindex=\"0\" plus a keydown handler for Enter/Space.",
      provenance: "rule",
    },
    nextT: t,
  };
}

/** Marks every step after a failed one as "skip" — the flow cannot meaningfully continue. */
export function markRemainingAsSkipped(steps: TaskStepEvent[], failedIndex: number, remainingLabels: string[], t: number): TaskStepEvent[] {
  return remainingLabels.map((label, i) => ({ t: t + (i + 1) * 10, type: "task-step" as const, label, status: "skip" as const }));
}

/**
 * LAYER 3 — EXPERIENTIAL ENGINE (our IP)
 * Drives real key events, tracks focus, detects traps. Reachability +
 * trap detection ("keyboard-reachability" / "focus-trap" checkIds).
 */
import type { Page } from "playwright";
import type { KeypressEvent, FocusEvent, AnnouncementEvent, ViolationEvent } from "../../schema/timeline";

export interface FocusSnapshot {
  selector: string;
  bbox: { x: number; y: number; width: number; height: number } | null;
  tagName: string;
}

async function readActiveElement(page: Page): Promise<FocusSnapshot | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;

    // Inlined rather than pulled into a named helper: Playwright serializes
    // this whole callback via toString() to run it in the browser, and
    // tsx/esbuild's name-preservation wraps any named function/arrow
    // binding (`function selectorFor` or `const selectorFor = () => {}`)
    // in a `__name(...)` call that only exists in the Node-side bundle —
    // throws "__name is not defined" once it lands in the browser. Plain
    // data bindings (strings, numbers) aren't instrumented, so this stays
    // safe as long as nothing here is a named function value.
    let selector: string;
    if (el.id) {
      selector = `#${el.id}`;
    } else if (el.className && typeof el.className === "string" && el.className.trim().split(/\s+/).join(".")) {
      selector = `${el.tagName.toLowerCase()}.${el.className.trim().split(/\s+/).join(".")}`;
    } else {
      const parent = el.parentElement;
      const idx = parent ? Array.from(parent.children).indexOf(el) : 0;
      selector = `${el.tagName.toLowerCase()}:nth-child(${idx + 1})`;
    }

    const rect = el.getBoundingClientRect();
    return {
      selector,
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      tagName: el.tagName.toLowerCase(),
    };
  });
}

/** Viewport-only (not full-page) JPEG, base64-encoded — matches the
 * viewport-relative coordinates getBoundingClientRect() already gives us,
 * so the focus ring the app overlays on top always lines up with the frame
 * underneath it regardless of scroll position. Embedded directly as a data
 * URI in the timeline JSON — no static file route needed on the API side. */
async function captureViewportFrame(page: Page): Promise<string | undefined> {
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 55 });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    // A failed screenshot (closing page, navigation mid-flight) shouldn't
    // fail the run — the player falls back to wireframe mode per-event.
    return undefined;
  }
}

export interface TabWalkResult {
  keypresses: KeypressEvent[];
  focuses: FocusEvent[];
  announcements: AnnouncementEvent[];
  violations: ViolationEvent[];
  reachableSelectors: string[];
  trapDetected: boolean;
}

export async function walkTabOrder(page: Page, startT: number, maxTabs = 60): Promise<TabWalkResult> {
  const keypresses: KeypressEvent[] = [];
  const focuses: FocusEvent[] = [];
  const announcements: AnnouncementEvent[] = [];
  const violations: ViolationEvent[] = [];
  const reachableSelectors: string[] = [];

  let t = startT;
  let lastSelector: string | null = null;
  let repeatCount = 0;
  let trapDetected = false;

  for (let i = 0; i < maxTabs; i++) {
    t += 100 + Math.round(Math.random() * 60);
    keypresses.push({ t, type: "keypress", key: "Tab" });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(20);

    const snap = await readActiveElement(page);
    t += 20;
    if (!snap) continue;

    const screenshot = await captureViewportFrame(page);

    focuses.push({
      t,
      type: "focus",
      selector: snap.selector,
      bbox: snap.bbox ?? { x: 0, y: 0, width: 0, height: 0 },
      screenshot,
    });
    // Cheap fallback announcement; buildAnnouncementIndex (axTree.ts) supplies
    // the richer CDP-based version, wired in run.ts as a separate pass.
    announcements.push({ t: t + 5, type: "announcement", text: snap.tagName });

    reachableSelectors.push(snap.selector);

    if (snap.selector === lastSelector) {
      repeatCount++;
      if (repeatCount >= 3 && !trapDetected) {
        trapDetected = true;
        violations.push({
          t,
          type: "violation",
          checkId: "focus-trap",
          selector: snap.selector,
          wcag: "2.1.2",
          severity: "critical",
          bbox: snap.bbox ?? { x: 0, y: 0, width: 0, height: 0 },
          screenshot,
          plainEnglish: `Keyboard focus is stuck cycling on ${snap.selector} and never advances to the rest of the page.`,
          fix: "Ensure the focus trap has an escape path (Escape key, close button reachable by Tab) or remove the trap if unintended.",
          provenance: "rule",
        });
      }
    } else {
      repeatCount = 0;
      lastSelector = snap.selector;
    }
  }

  return { keypresses, focuses, announcements, violations, reachableSelectors, trapDetected };
}

export async function reachabilityDiff(page: Page, reached: string[]): Promise<ViolationEvent[]> {
  const interactiveSelectors = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
      )
    );
    return nodes.map((el, i) => (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}:nth-of-type(${i + 1})`));
  });

  const reachedSet = new Set(reached);
  const unreached = interactiveSelectors.filter((sel) => !reachedSet.has(sel));

  return unreached.map((sel) => ({
    t: 0,
    type: "violation" as const,
    checkId: "keyboard-reachability",
    selector: sel,
    wcag: "2.1.1",
    severity: "serious" as const,
    bbox: { x: 0, y: 0, width: 0, height: 0 },
    plainEnglish: `${sel} looks interactive but the Tab key never reaches it.`,
    fix: "Ensure the element is a natively focusable control, or has a valid tabindex and is not hidden/disabled unexpectedly.",
    provenance: "rule" as const,
  }));
}

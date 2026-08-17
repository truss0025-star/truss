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

/**
 * SINGLE SOURCE OF TRUTH for "what is this element's selector", used by
 * both the tab-walk (what WAS reached, below) and the reachability diff
 * (what SHOULD be reached, in reachabilityDiff()). These two used to be
 * built by separate hand-written implementations — tag.class1.class2 here,
 * tag:nth-of-type(N) there — which almost never agreed with each other on
 * a utility-CSS site with no id attributes, producing mass false
 * "unreachable" reports. Now there is exactly one function; both call
 * sites use it, so they can't drift apart again.
 *
 * Falls back to a full DOM-path (nth-child index at every ancestor level)
 * rather than tag+class. Class concatenation is NOT guaranteed unique —
 * utility-CSS frameworks routinely give many distinct elements the exact
 * same class string (e.g. five card buttons all sharing
 * "w-full text-left"). That non-uniqueness was also the cause of a false
 * "critical" focus-trap report: three different elements sharing one
 * class-based selector string looked, to the trap detector, like focus
 * stuck on a single element three times in a row. A DOM-path selector
 * pins down the exact sibling index at every level, so two distinct
 * elements can never produce the same string.
 *
 * NOTE: this is only ever called *inside* a page.evaluate() browser
 * context, never from Node. It must stay a plain, self-contained function
 * (only `el` as input, only DOM globals referenced) because it is reused
 * across evaluate() call sites by splicing its own `.toString()` source
 * — see DOM_PATH_SELECTOR_SRC below — not by a live JS reference, since
 * Playwright ships only a callback's own source into the browser.
 */
function domPathSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const path: string[] = [];
  let node: HTMLElement | null = el;
  while (node && node.parentElement) {
    const parent: HTMLElement = node.parentElement;
    const idx = Array.from(parent.children).indexOf(node);
    path.unshift(`${node.tagName.toLowerCase()}:nth-child(${idx + 1})`);
    node = parent;
  }
  return path.join(">") || el.tagName.toLowerCase();
}

// domPathSelector.toString() (called directly on the function itself, not
// on some outer closure) yields just its own clean body — none of
// tsx/esbuild's `__name(...)` name-preservation wrapper calls leak in,
// since those are sibling statements in the *enclosing* scope, not part of
// the function's own source text. Safe to drop verbatim into evaluate()
// strings built below.
const DOM_PATH_SELECTOR_SRC = `const domPathSelector = ${domPathSelector.toString()};`;

async function readActiveElement(page: Page): Promise<FocusSnapshot | null> {
  return page.evaluate<FocusSnapshot | null>(`(() => {
    ${DOM_PATH_SELECTOR_SRC}
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const rect = el.getBoundingClientRect();
    return {
      selector: domPathSelector(el),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      tagName: el.tagName.toLowerCase(),
    };
  })()`);
}

/**
 * Every element the reachability check considers "should be tabbable",
 * queried exactly once per run and reused by both walkTabOrder (to know
 * how many Tab presses to budget, and when it's covered everything) and
 * reachabilityDiff (to know what SHOULD have been reached). Previously
 * this query ran a second time, independently, inside reachabilityDiff —
 * harmless for selector agreement (same domPathSelector either way) but
 * a needless second DOM read that could disagree with the first if the
 * page mutated in between. One query, one list, passed through.
 *
 * Filters out elements a real Tab key would never stop on: `disabled`
 * controls, and anything CSS-hidden (`display:none`/`visibility:hidden`
 * or zero-sized). Without this, a common pattern like rendering both a
 * desktop and a mobile nav in the DOM and hiding one with CSS makes the
 * hidden copy's links count as "should be reachable" — a real page with
 * zero reachability bugs then reports dozens of false ones. This does
 * NOT filter on scroll position: an element merely off-screen but
 * scrollable into view is legitimately Tab-reachable (the walk below
 * auto-scrolls to whatever gets focus, same as a real keyboard user).
 */
async function getInteractiveSelectors(page: Page): Promise<string[]> {
  return page.evaluate<string[]>(`(() => {
    ${DOM_PATH_SELECTOR_SRC}
    const isVisible = (el) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    };
    const nodes = Array.from(
      document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
      )
    );
    return nodes.filter(isVisible).map((el) => domPathSelector(el));
  })()`);
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
  /** The full expected set (queried once, up front) — reachabilityDiff
   * diffs against this instead of re-querying the DOM itself. */
  interactiveSelectors: string[];
  trapDetected: boolean;
}

// Hard ceiling regardless of page size, purely to bound worst-case run
// time on a pathological page (thousands of tabbable nodes) — not the
// thing that decides "unreachable" for any normal page anymore.
const MAX_TABS_CEILING = 500;
// Extra tab presses budgeted beyond the known element count, to absorb
// presses that land on nothing countable (e.g. focus briefly parked on
// document.body between elements) without falsely running out of budget.
const TAB_BUDGET_SLACK = 10;

export async function walkTabOrder(page: Page, startT: number): Promise<TabWalkResult> {
  const interactiveSelectors = await getInteractiveSelectors(page);
  // Budget enough Tab presses to reach every interactive element actually
  // on the page, instead of a flat constant. The previous fixed
  // `maxTabs = 60` falsely reported every element past position 60 as
  // "unreachable" on any real page with more tabbable elements than that
  // (e.g. gov.uk's ~129) — the walk simply hadn't gotten there yet, which
  // looks identical to a real reachability bug in the report. Sizing the
  // budget off the actual page removes that false signal.
  const maxTabs = Math.min(interactiveSelectors.length + TAB_BUDGET_SLACK, MAX_TABS_CEILING);

  const keypresses: KeypressEvent[] = [];
  const focuses: FocusEvent[] = [];
  const announcements: AnnouncementEvent[] = [];
  const violations: ViolationEvent[] = [];
  const reachableSelectors: string[] = [];
  const reachedSet = new Set<string>();

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
    reachedSet.add(snap.selector);

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
        // A real trap means nothing past this point is reachable either —
        // no point spending the rest of the tab budget confirming that.
        break;
      }
    } else {
      repeatCount = 0;
      lastSelector = snap.selector;
    }

    // Every known interactive element has been visited at least once —
    // stop early instead of burning the rest of the budget (and screenshots)
    // confirming nothing new is left to find.
    if (reachedSet.size >= interactiveSelectors.length) break;
  }

  return { keypresses, focuses, announcements, violations, reachableSelectors, interactiveSelectors, trapDetected };
}

export function reachabilityDiff(interactiveSelectors: string[], reached: string[]): ViolationEvent[] {
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

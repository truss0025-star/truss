/**
 * LAYER 1 — HARNESS
 * Launch Chromium, load the URL, wait for hydration. Everything downstream
 * (axe, keyboard engine, CDP tree, screenshots) runs against the Page this
 * module hands back.
 */
import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export interface HarnessSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  runDir: string;
  framesDir: string;
}

export interface HarnessOptions {
  url: string;
  runId: string;
  /** Max time to wait for the page to settle before we treat it as hydrated. */
  hydrationTimeoutMs?: number;
  headless?: boolean;
}

/**
 * "Wait for hydration" in practice: networkidle is necessary but not
 * sufficient for SPA hero sites, so we also wait one animation frame after
 * networkidle and confirm document.readyState === "complete".
 */
async function waitForHydration(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // Some sites never go fully idle (polling widgets, analytics beacons).
    // That's a reliability case we budgeted for on Days 11-14 — proceed,
    // don't hang the whole run on it.
  }
  await page.waitForFunction(() => document.readyState === "complete", { timeout: timeoutMs });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
}

export async function startSession(opts: HarnessOptions): Promise<HarnessSession> {
  const runDir = path.join(process.cwd(), "..", "runs", opts.runId);
  const framesDir = path.join(runDir, "frames");
  await mkdir(framesDir, { recursive: true });

  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    // Force visible focus rings to render even if the OS/browser would
    // otherwise suppress them for mouse-driven sessions — we want to SEE
    // what a real keyboard user would see, not what a mouse user sees.
    forcedColors: "none",
  });
  const page = await context.newPage();

  await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: opts.hydrationTimeoutMs ?? 30_000 });
  await waitForHydration(page, opts.hydrationTimeoutMs ?? 30_000);

  return { browser, context, page, runDir, framesDir };
}

export async function endSession(session: HarnessSession): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

let frameCounter = 0;

/** Screenshots the full page and returns the relative path used in timeline events. */
export async function captureFrame(session: HarnessSession): Promise<string> {
  const n = String(frameCounter++).padStart(4, "0");
  const rel = path.join("frames", `${n}.png`);
  await session.page.screenshot({ path: path.join(session.runDir, rel) });
  return rel;
}

/** Bounding box for a selector, or null if the element isn't found/visible. */
export async function boundingBoxFor(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (count === 0) return null;
  return locator.boundingBox();
}

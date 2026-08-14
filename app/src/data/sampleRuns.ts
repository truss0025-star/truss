import type { Timeline } from "../schema/timeline";

/**
 * noViolationsRun — https://gov.uk, ~8s, 0 violations.
 * Demonstrates the legitimate pass state: skip link, labelled nav, labelled
 * search, correctly-headinged page. Nothing here is a placeholder — every
 * focus/announcement event reflects a real, well-built control.
 */
export const noViolationsRun: Timeline = {
  meta: {
    url: "https://gov.uk",
    startedAt: "2026-08-13T09:15:00.000Z",
    durationMs: 8000,
    screenReaderNote:
      "Screen reader (simulated announcement) — computed from the accessibility tree, not a real JAWS/NVDA/VoiceOver run.",
    viewportWidth: 1280,
    viewportHeight: 900,
  },
  events: [
    { type: "keypress", t: 300, key: "Tab" },
    { type: "focus", t: 340, selector: "a.skip-link", bbox: { x: 0, y: 0, width: 160, height: 32 } },
    { type: "announcement", t: 360, text: "Skip to main content, link" },

    { type: "keypress", t: 900, key: "Tab" },
    { type: "focus", t: 940, selector: "a.gov-logo", bbox: { x: 24, y: 16, width: 120, height: 32 } },
    { type: "announcement", t: 960, text: "GOV.UK, home page, link" },

    { type: "keypress", t: 1500, key: "Tab" },
    { type: "focus", t: 1540, selector: "nav a.benefits", bbox: { x: 180, y: 20, width: 80, height: 24 } },
    { type: "announcement", t: 1560, text: "Benefits, link" },

    { type: "keypress", t: 2100, key: "Tab" },
    { type: "focus", t: 2140, selector: "nav a.births-deaths", bbox: { x: 270, y: 20, width: 140, height: 24 } },
    { type: "announcement", t: 2160, text: "Births, deaths, marriages and care, link" },

    { type: "keypress", t: 2700, key: "Tab" },
    { type: "focus", t: 2740, selector: "input#site-search", bbox: { x: 900, y: 16, width: 240, height: 36 } },
    { type: "announcement", t: 2760, text: "Search GOV.UK, edit text" },

    { type: "keypress", t: 3300, key: "Tab" },
    { type: "focus", t: 3340, selector: "button.search-submit", bbox: { x: 1148, y: 16, width: 40, height: 36 } },
    { type: "announcement", t: 3360, text: "Search, button" },

    { type: "keypress", t: 3900, key: "Tab" },
    { type: "focus", t: 3940, selector: "a.card-title-1", bbox: { x: 24, y: 120, width: 380, height: 28 } },
    { type: "announcement", t: 3960, text: "Check a benefit claim, link" },

    { type: "keypress", t: 4500, key: "Tab" },
    { type: "focus", t: 4540, selector: "a.card-title-2", bbox: { x: 24, y: 200, width: 340, height: 28 } },
    { type: "announcement", t: 4560, text: "Register a birth, link" },

    { type: "keypress", t: 5100, key: "Tab" },
    { type: "focus", t: 5140, selector: "a.footer-privacy", bbox: { x: 24, y: 840, width: 100, height: 24 } },
    { type: "announcement", t: 5160, text: "Privacy notice, link" },

    { type: "keypress", t: 5700, key: "Tab" },
    { type: "focus", t: 5740, selector: "a.footer-cookies", bbox: { x: 140, y: 840, width: 100, height: 24 } },
    { type: "announcement", t: 5760, text: "Cookies, link" },
  ],
};

/**
 * taskRun — https://checkout.example.com, ~14s, 1 violation (expiry input
 * missing a label). Demonstrates the task status panel: 3 steps pass, the
 * 4th fails, and — per the engine's markRemainingAsSkipped convention —
 * anything after a failure is marked "skip", not silently omitted.
 */
export const taskRun: Timeline = {
  meta: {
    url: "https://checkout.example.com",
    startedAt: "2026-08-13T09:30:00.000Z",
    durationMs: 14000,
    screenReaderNote:
      "Screen reader (simulated announcement) — computed from the accessibility tree, not a real JAWS/NVDA/VoiceOver run.",
    viewportWidth: 1280,
    viewportHeight: 900,
  },
  events: [
    { type: "keypress", t: 300, key: "Tab" },
    { type: "focus", t: 340, selector: "a.logo", bbox: { x: 24, y: 20, width: 96, height: 32 } },
    { type: "announcement", t: 360, text: "Checkout Example, link" },

    { type: "task-step", t: 800, label: "Navigate to checkout", status: "pass" },

    { type: "keypress", t: 1200, key: "Tab" },
    { type: "focus", t: 1240, selector: "input#billing-name", bbox: { x: 24, y: 140, width: 320, height: 40 } },
    { type: "announcement", t: 1260, text: "Full name on card, edit text" },
    { type: "keypress", t: 1600, key: "Tab" },

    { type: "task-step", t: 2000, label: "Fill billing name", status: "pass" },

    { type: "keypress", t: 2400, key: "Tab" },
    { type: "focus", t: 2440, selector: "input#card-number", bbox: { x: 24, y: 220, width: 320, height: 40 } },
    { type: "announcement", t: 2460, text: "Card number, edit text" },

    { type: "keypress", t: 3000, key: "Tab" },
    { type: "focus", t: 3040, selector: "input#card-expiry", bbox: { x: 24, y: 300, width: 140, height: 40 } },
    { type: "announcement", t: 3060, text: "edit text" },
    {
      type: "violation",
      t: 3120,
      selector: "input#card-expiry",
      bbox: { x: 24, y: 300, width: 140, height: 40 },
      checkId: "label",
      severity: "critical",
      wcag: "1.3.1",
      plainEnglish: "The expiry date field has no associated label, so a screen-reader user hears only \"edit text\" with no idea which field they're on.",
      fix: "Associate a <label for=\"card-expiry\">Expiry date</label> with the input.",
      provenance: "rule",
    },

    { type: "task-step", t: 4200, label: "Fill card details", status: "fail" },
    { type: "task-step", t: 4210, label: "Submit order", status: "skip" },
  ],
};

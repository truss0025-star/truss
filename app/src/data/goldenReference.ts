import type { Timeline } from "../schema/timeline";

/**
 * goldenReference — https://example.com, ~12s, 6 violations.
 * Deliberately spread across rule + llm provenance so the UI's provenance
 * badge distinction is visible in the default demo. No screenshots — this
 * exercises the wireframe fallback path.
 */
export const goldenReference: Timeline = {
  meta: {
    url: "https://example.com",
    startedAt: "2026-08-13T09:00:00.000Z",
    durationMs: 12000,
    screenReaderNote:
      "Screen reader (simulated announcement) — computed from the accessibility tree, not a real JAWS/NVDA/VoiceOver run.",
    viewportWidth: 1280,
    viewportHeight: 900,
  },
  events: [
    // --- opening tab order ---
    { type: "keypress", t: 300, key: "Tab" },
    { type: "focus", t: 340, selector: "a.skip-link", bbox: { x: 0, y: 0, width: 140, height: 32 } },
    { type: "announcement", t: 360, text: "Skip to main content, link" },

    { type: "keypress", t: 800, key: "Tab" },
    { type: "focus", t: 840, selector: "a.logo", bbox: { x: 24, y: 20, width: 96, height: 32 } },
    { type: "announcement", t: 860, text: "Example, link" },

    // --- hero image, missing alt (rule, critical) ---
    { type: "keypress", t: 1300, key: "Tab" },
    { type: "focus", t: 1340, selector: "img.hero-image", bbox: { x: 24, y: 100, width: 600, height: 280 } },
    { type: "announcement", t: 1360, text: "image" },
    {
      type: "violation",
      t: 1400,
      selector: "img.hero-image",
      bbox: { x: 24, y: 100, width: 600, height: 280 },
      checkId: "image-alt",
      severity: "critical",
      wcag: "1.1.1",
      plainEnglish: "The hero image has no alt text, so a screen-reader user has no idea what it shows.",
      fix: "Add a concise, descriptive alt attribute conveying the image's purpose on the page.",
      provenance: "rule",
    },

    // --- signup email input, unlabelled (rule, critical) ---
    { type: "keypress", t: 1900, key: "Tab" },
    { type: "focus", t: 1940, selector: "input.signup-email", bbox: { x: 24, y: 420, width: 260, height: 40 } },
    { type: "announcement", t: 1960, text: "edit text" },
    {
      type: "violation",
      t: 2000,
      selector: "input.signup-email",
      bbox: { x: 24, y: 420, width: 260, height: 40 },
      checkId: "label",
      severity: "critical",
      wcag: "1.3.1",
      plainEnglish: "This email input has no associated label, so a screen-reader user hears only \"edit text\" with no idea what to enter.",
      fix: "Associate a <label for=\"...\"> with the input, or add aria-label=\"Email address\".",
      provenance: "rule",
    },

    // --- submit button, no accessible name (rule, critical) ---
    { type: "keypress", t: 2500, key: "Tab" },
    { type: "focus", t: 2540, selector: "button.signup-submit", bbox: { x: 296, y: 420, width: 44, height: 40 } },
    { type: "announcement", t: 2560, text: "button" },
    {
      type: "violation",
      t: 2600,
      selector: "button.signup-submit",
      bbox: { x: 296, y: 420, width: 44, height: 40 },
      checkId: "button-name",
      severity: "critical",
      wcag: "4.1.2",
      plainEnglish: "This submit button is icon-only with no accessible name, so a screen-reader user hears only \"button\" with no idea what it does.",
      fix: "Add aria-label=\"Submit signup form\" or visually-hidden text inside the button.",
      provenance: "rule",
    },

    // --- color contrast failure (rule, serious) ---
    { type: "keypress", t: 3100, key: "Tab" },
    { type: "focus", t: 3140, selector: "a.pricing-link", bbox: { x: 24, y: 500, width: 90, height: 28 } },
    { type: "announcement", t: 3160, text: "See pricing, link" },
    {
      type: "violation",
      t: 3200,
      selector: "a.pricing-link",
      bbox: { x: 24, y: 500, width: 90, height: 28 },
      checkId: "color-contrast",
      severity: "serious",
      wcag: "1.4.3",
      plainEnglish: "This link's text color against its background falls below the minimum contrast ratio, making it hard to read for low-vision users.",
      fix: "Darken the text color or lighten the background until the contrast ratio is at least 4.5:1.",
      provenance: "rule",
    },

    // --- icon-only social link, judged unclear (llm, serious) ---
    { type: "keypress", t: 3700, key: "Tab" },
    { type: "focus", t: 3740, selector: "a.social-icon", bbox: { x: 24, y: 560, width: 32, height: 32 } },
    { type: "announcement", t: 3760, text: "icon, link" },
    {
      type: "violation",
      t: 3800,
      selector: "a.social-icon",
      bbox: { x: 24, y: 560, width: 32, height: 32 },
      checkId: "link-name",
      severity: "serious",
      wcag: "2.4.4",
      plainEnglish: "This icon-only social link has no descriptive accessible name — a screen-reader user hears \"icon, link\" with no idea which platform it opens.",
      fix: "Add aria-label naming the destination, e.g. aria-label=\"Follow us on Instagram\".",
      provenance: "llm",
      llmConfidence: 0.91,
    },

    // --- cookie banner before skip link, bypass concern (llm, moderate) ---
    { type: "keypress", t: 4300, key: "Tab" },
    { type: "focus", t: 4340, selector: "div.cookie-banner button", bbox: { x: 400, y: 850, width: 120, height: 36 } },
    { type: "announcement", t: 4360, text: "Accept cookies, button" },
    {
      type: "violation",
      t: 4400,
      selector: "div.cookie-banner",
      bbox: { x: 0, y: 820, width: 1280, height: 80 },
      checkId: "bypass",
      severity: "moderate",
      wcag: "2.4.1",
      plainEnglish: "The cookie consent banner sits ahead of the skip link in the tab order, forcing keyboard users through an extra step before they can bypass repeated navigation.",
      fix: "Move the cookie banner's dismiss control after the skip link in the DOM/tab order, or ensure the skip link remains the very first focusable element.",
      provenance: "llm",
      llmConfidence: 0.78,
    },

    // --- rest of the page, no further findings ---
    { type: "keypress", t: 5000, key: "Tab" },
    { type: "focus", t: 5040, selector: "nav a.shop", bbox: { x: 140, y: 24, width: 60, height: 24 } },
    { type: "announcement", t: 5060, text: "Shop, link" },

    { type: "keypress", t: 5600, key: "Tab" },
    { type: "focus", t: 5640, selector: "a.cart-icon", bbox: { x: 620, y: 20, width: 32, height: 32 } },
    { type: "announcement", t: 5660, text: "Cart, link" },
  ],
};

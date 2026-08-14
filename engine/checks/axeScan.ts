/**
 * LAYER 2 — STATIC SCAN
 * axe-core is the free machine floor: contrast, missing alt, ARIA, roles,
 * valid markup. Near-zero false positives — every axe finding is emitted
 * as provenance: "rule", no llmConfidence attached.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "playwright";
import type { ViolationEvent, Severity } from "../../schema/timeline";

const IMPACT_TO_SEVERITY: Record<string, Severity> = {
  critical: "critical",
  serious: "serious",
  moderate: "moderate",
  minor: "minor",
};

export async function runAxeScan(page: Page, t: number): Promise<ViolationEvent[]> {
  const results = await new AxeBuilder({ page }).analyze();
  const events: ViolationEvent[] = [];

  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const selector = (node.target?.[0] as string) ?? "unknown";
      const box = node.target?.[0]
        ? await page
            .locator(selector)
            .first()
            .boundingBox()
            .catch(() => null)
        : null;

      events.push({
        t,
        type: "violation",
        checkId: violation.id, // e.g. "color-contrast", "image-alt" — matches the UI's expected checkId vocabulary
        selector,
        wcag: wcagFromTags(violation.tags),
        severity: IMPACT_TO_SEVERITY[violation.impact ?? "moderate"] ?? "moderate",
        bbox: box ?? { x: 0, y: 0, width: 0, height: 0 },
        plainEnglish: violation.description,
        fix: violation.help,
        provenance: "rule",
      });
    }
  }
  return events;
}

/** axe tags include things like "wcag143" (WCAG 1.4.3) — extract and format, or fall back. */
export function wcagFromTags(tags: string[]): string {
  const wcagTag = tags.find((t) => /^wcag\d{3,4}$/.test(t));
  if (!wcagTag) return "n/a";
  const digits = wcagTag.replace("wcag", "");
  return digits.split("").reduce((acc, d, i) => (i === 0 ? d : acc + "." + d), "");
}

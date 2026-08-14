/**
 * Visible focus indicator check (WCAG 2.4.7), checkId "visible-focus".
 * Screenshot the element bbox unfocused vs focused, pixel-diff against a
 * tuned threshold. Emits provenance: "rule" — this is deterministic.
 */
import type { Page } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import sharp from "sharp";
import type { ViolationEvent, BBox } from "../../schema/timeline";

// Tuned conservative per the sprint's false-positive rule: small anti-aliasing
// shifts should not fire a finding. Re-tune per deployment, not universal.
const DIFF_RATIO_THRESHOLD = 0.02; // 2% of pixels in the bbox must differ

async function cropToPng(buffer: Buffer, box: BBox): Promise<PNG> {
  const cropped = await sharp(buffer)
    .extract({
      left: Math.max(0, Math.round(box.x)),
      top: Math.max(0, Math.round(box.y)),
      width: Math.max(1, Math.round(box.width)),
      height: Math.max(1, Math.round(box.height)),
    })
    .png()
    .toBuffer();
  return PNG.sync.read(cropped);
}

export async function checkVisibleFocus(
  page: Page,
  selector: string,
  box: BBox,
  t: number
): Promise<ViolationEvent | null> {
  const locator = page.locator(selector).first();

  await locator.evaluate((el) => (el as HTMLElement).blur());
  const unfocusedBuf = await page.screenshot();

  await locator.focus();
  const focusedBuf = await page.screenshot();

  const [unfocusedPng, focusedPng] = await Promise.all([
    cropToPng(unfocusedBuf, box),
    cropToPng(focusedBuf, box),
  ]);

  if (unfocusedPng.width !== focusedPng.width || unfocusedPng.height !== focusedPng.height) {
    return null; // layout shifted between captures; skip rather than false-positive
  }

  const diff = new PNG({ width: unfocusedPng.width, height: unfocusedPng.height });
  const diffPixels = pixelmatch(
    unfocusedPng.data,
    focusedPng.data,
    diff.data,
    unfocusedPng.width,
    unfocusedPng.height,
    { threshold: 0.1 }
  );

  const totalPixels = unfocusedPng.width * unfocusedPng.height;
  const ratio = totalPixels > 0 ? diffPixels / totalPixels : 0;

  if (ratio >= DIFF_RATIO_THRESHOLD) return null; // visibly changed — no finding

  return {
    t,
    type: "violation",
    checkId: "visible-focus",
    selector,
    wcag: "2.4.7",
    severity: "moderate",
    bbox: box,
    plainEnglish: `${selector} receives keyboard focus but its appearance barely changes (${(ratio * 100).toFixed(1)}% pixel diff), so a keyboard user can't tell it's focused.`,
    fix: "Add a visible :focus-visible outline or background change with sufficient contrast against the surrounding page.",
    provenance: "rule",
  };
}

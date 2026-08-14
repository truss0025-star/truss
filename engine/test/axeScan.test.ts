import { describe, it, expect } from "vitest";
import { wcagFromTags } from "../checks/axeScan";

describe("wcagFromTags", () => {
  it("parses a standard 3-digit wcag tag into dotted form", () => {
    expect(wcagFromTags(["cat.color", "wcag143", "wcag2aa"])).toBe("1.4.3");
  });

  it("parses a different 3-digit tag correctly", () => {
    expect(wcagFromTags(["wcag111"])).toBe("1.1.1");
  });

  it("parses a 4-digit tag (rare but valid axe format)", () => {
    expect(wcagFromTags(["wcag1412"])).toBe("1.4.1.2");
  });

  it("falls back to 'n/a' when no wcag tag is present", () => {
    expect(wcagFromTags(["cat.aria", "best-practice"])).toBe("n/a");
  });

  it("falls back to 'n/a' for an empty tag list", () => {
    expect(wcagFromTags([])).toBe("n/a");
  });

  it("ignores non-matching tags shaped like wcag but wrong digit count", () => {
    // 2-digit "wcagXX" tags (e.g. "wcag2a" conformance level tags) should not match
    expect(wcagFromTags(["wcag2a", "wcag2aa"])).toBe("n/a");
  });
});

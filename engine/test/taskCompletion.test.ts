import { describe, it, expect, vi } from "vitest";
import { diagnoseUnreachable } from "../checks/taskCompletion";
import type { Page } from "playwright";

/**
 * Builds a fake Page whose page.locator(selector).first().evaluate(fn)
 * returns whatever `elementInfo` supplies, mimicking what the real
 * getComputedStyle-based evaluate() in diagnoseUnreachable would see.
 * This tests the actual diagnostic logic without needing Chromium.
 */
function fakePage(elementInfo: Record<string, unknown> | null): Page {
  const locator = {
    first: () => locator,
    evaluate: vi.fn().mockImplementation(() => {
      if (elementInfo === null) return Promise.reject(new Error("element not found"));
      return Promise.resolve(elementInfo);
    }),
  };
  return { locator: () => locator } as unknown as Page;
}

describe("diagnoseUnreachable", () => {
  it("reports the element as not found when the locator throws", async () => {
    const page = fakePage(null);
    const reason = await diagnoseUnreachable(page, ".checkout-button");
    expect(reason).toMatch(/could not be found/i);
  });

  it("identifies the signature case: a <div> masquerading as a button", async () => {
    const page = fakePage({
      tag: "div",
      tabindex: null,
      role: null,
      display: "block",
      visibility: "visible",
      disabled: false,
    });
    const reason = await diagnoseUnreachable(page, ".checkout-button");
    expect(reason).toMatch(/<div>/);
    expect(reason).toMatch(/tabindex/);
    expect(reason).toMatch(/onClick.*mouse/i);
  });

  it("does NOT flag a div that has role=button and is properly focusable", async () => {
    const page = fakePage({
      tag: "div",
      tabindex: "0",
      role: "button",
      display: "block",
      visibility: "visible",
      disabled: false,
    });
    const reason = await diagnoseUnreachable(page, ".checkout-button");
    expect(reason).not.toMatch(/no tabindex and no button\/link role/);
  });

  it("identifies display:none as the cause", async () => {
    const page = fakePage({
      tag: "button",
      tabindex: null,
      role: null,
      display: "none",
      visibility: "visible",
      disabled: false,
    });
    const reason = await diagnoseUnreachable(page, ".hidden-button");
    expect(reason).toMatch(/hidden.*display:none/i);
  });

  it("identifies a disabled element as the cause", async () => {
    const page = fakePage({
      tag: "button",
      tabindex: null,
      role: null,
      display: "block",
      visibility: "visible",
      disabled: true,
    });
    const reason = await diagnoseUnreachable(page, ".disabled-button");
    expect(reason).toMatch(/disabled/i);
  });

  it("identifies tabindex=-1 as the cause", async () => {
    const page = fakePage({
      tag: "a",
      tabindex: "-1",
      role: null,
      display: "block",
      visibility: "visible",
      disabled: false,
    });
    const reason = await diagnoseUnreachable(page, "a.removed-from-order");
    expect(reason).toMatch(/tabindex="-1"/);
  });
});

import { describe, it, expect } from "vitest";
import { assembleTimeline } from "../src/emitter";
import type { TimelineEvent } from "../../schema/timeline";

describe("assembleTimeline", () => {
  const baseMeta = {
    url: "https://example.com",
    startedAt: "2026-08-14T00:00:00.000Z",
    viewportWidth: 1280,
    viewportHeight: 900,
    screenReaderNote: "simulated",
  };

  it("sorts events ascending by t, even when supplied out of order", () => {
    const events: TimelineEvent[] = [
      { type: "keypress", t: 500, key: "Enter" },
      { type: "keypress", t: 100, key: "Tab" },
      { type: "keypress", t: 300, key: "Tab" },
    ];
    const timeline = assembleTimeline(baseMeta, events);
    expect(timeline.events.map((e) => e.t)).toEqual([100, 300, 500]);
  });

  it("computes durationMs as the last event's t after sorting", () => {
    const events: TimelineEvent[] = [
      { type: "keypress", t: 900, key: "Enter" },
      { type: "keypress", t: 200, key: "Tab" },
    ];
    const timeline = assembleTimeline(baseMeta, events);
    expect(timeline.meta.durationMs).toBe(900);
  });

  it("handles an empty event list without throwing, durationMs 0", () => {
    const timeline = assembleTimeline(baseMeta, []);
    expect(timeline.events).toEqual([]);
    expect(timeline.meta.durationMs).toBe(0);
  });

  it("preserves all other meta fields untouched", () => {
    const timeline = assembleTimeline(baseMeta, []);
    expect(timeline.meta.url).toBe(baseMeta.url);
    expect(timeline.meta.screenReaderNote).toBe(baseMeta.screenReaderNote);
    expect(timeline.meta.viewportWidth).toBe(1280);
  });

  it("does not mutate the input events array (sorts a copy)", () => {
    const events: TimelineEvent[] = [
      { type: "keypress", t: 500, key: "Enter" },
      { type: "keypress", t: 100, key: "Tab" },
    ];
    const original = [...events];
    assembleTimeline(baseMeta, events);
    expect(events).toEqual(original); // input order untouched
  });
});

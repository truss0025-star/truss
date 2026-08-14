/**
 * TIMELINE SCHEMA v0.2 — the contract between /engine and /app.
 *
 * Superseded v0.1 on the UI side (App Build Context v0.2, contributed by
 * Kalyan via Figma Make). This is now the frozen version — the engine
 * conforms to this file, not the other way around. Frozen except
 * `screenshot?`, which was added deliberately as optional so the wireframe
 * fallback keeps working with zero screenshots.
 *
 * Rule: neither half edits this file alone. If the engine changes a field,
 * the player breaks silently unless both sides agree here first.
 *
 * Everything the player renders comes from a TimelineEvent. No coordinate,
 * no site name, no copy string is ever hardcoded in the app layer.
 */

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Severity = "critical" | "serious" | "moderate" | "minor";

/** 'rule' = deterministic (axe-core or the keyboard engine). 'llm' = a Claude judgment call. */
export type Provenance = "rule" | "llm";

/** The agent's focus landed on an element. Drives the synthetic cursor + focus ring. */
export interface FocusEvent {
  type: "focus";
  t: number; // milliseconds from run start
  selector: string;
  bbox: BBox;
  /** URL/path to a captured frame. Optional — absent means the player falls back to wireframe mode. */
  screenshot?: string;
}

/** A finding. This is the unit the report and the violation card are built from. */
export interface ViolationEvent {
  type: "violation";
  t: number;
  selector: string;
  bbox: BBox;
  screenshot?: string;
  checkId: string; // e.g. "color-contrast", "image-alt", "task-completion" — free string, humanized in UI
  severity: Severity;
  wcag: string; // e.g. "1.4.3"
  plainEnglish: string; // human-readable problem statement
  fix: string; // actionable fix in plain language
  provenance: Provenance;
  /** 0–1, present only when provenance === 'llm'. Tuned conservative per Rule 3. */
  llmConfidence?: number;
}

/** A single simulated key press driving the agent through the page. */
export interface KeypressEvent {
  type: "keypress";
  t: number;
  key: string;
}

/** Simulated screen-reader output. A distinct event, not folded into FocusEvent. */
export interface AnnouncementEvent {
  type: "announcement";
  t: number;
  text: string;
}

/** One step of the scripted task attempt (e.g. reach checkout). Absent entirely = no task configured. */
export interface TaskStepEvent {
  type: "task-step";
  t: number;
  label: string;
  status: "pass" | "fail" | "skip";
}

export type TimelineEvent =
  | FocusEvent
  | ViolationEvent
  | KeypressEvent
  | AnnouncementEvent
  | TaskStepEvent;

export interface TimelineMeta {
  url: string;
  startedAt: string; // ISO 8601
  durationMs: number;
  /** Shown verbatim, labelled "simulated" — the known constraint (no real JAWS/NVDA/VoiceOver in a Linux container). */
  screenReaderNote?: string;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Timeline {
  meta: TimelineMeta;
  events: TimelineEvent[]; // must be sorted ascending by t
}

/**
 * THE RULE THAT PROTECTS THIS FILE:
 * If any animation in /app hardcodes a coordinate or a site name, we have
 * built a one-site demo instead of a product. Every value comes from here.
 * Swapping the timeline source must produce a correct render with zero
 * component changes.
 */

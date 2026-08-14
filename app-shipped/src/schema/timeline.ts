export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export interface FocusEvent {
  type: 'focus'
  t: number
  selector: string
  bbox: BBox
  screenshot?: string
}

export interface ViolationEvent {
  type: 'violation'
  t: number
  selector: string
  bbox: BBox
  screenshot?: string
  checkId: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  wcag: string
  plainEnglish: string
  fix: string
  provenance: 'rule' | 'llm'
  llmConfidence?: number
}

export interface KeypressEvent {
  type: 'keypress'
  t: number
  key: string
}

export interface AnnouncementEvent {
  type: 'announcement'
  t: number
  text: string
}

export interface TaskStepEvent {
  type: 'task-step'
  t: number
  label: string
  status: 'pass' | 'fail' | 'skip'
}

export type TimelineEvent =
  | FocusEvent
  | ViolationEvent
  | KeypressEvent
  | AnnouncementEvent
  | TaskStepEvent

export interface TimelineMeta {
  url: string
  startedAt: string
  durationMs: number
  screenReaderNote?: string
  viewportWidth: number
  viewportHeight: number
}

export interface Timeline {
  meta: TimelineMeta
  events: TimelineEvent[]
}

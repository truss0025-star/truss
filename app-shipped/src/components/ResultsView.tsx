import { useState, useEffect, useRef } from 'react'
import type { Timeline, ViolationEvent, TaskStepEvent, AnnouncementEvent, KeypressEvent } from '../schema/timeline'
import ReplayStage from './ReplayStage'
import ViolationCard, { SEVERITY_ORDER } from './ViolationCard'

interface Props {
  timeline: Timeline
  onReset: () => void
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'var(--color-critical)',
  serious:  'var(--color-serious)',
  moderate: 'var(--color-moderate)',
  minor:    'var(--color-minor-col)',
}

function formatTime(ms: number) {
  const s = (ms / 1000).toFixed(1)
  return `${s}s`
}

function TaskStepIcon({ status }: { status: string }) {
  if (status === 'pass') return <span aria-label="passed" style={{ color: 'var(--color-accent)' }}>✓</span>
  if (status === 'fail') return <span aria-label="failed" style={{ color: 'var(--color-critical)' }}>✗</span>
  return <span aria-label="skipped" style={{ color: 'var(--color-fg-muted)' }}>–</span>
}

export default function ResultsView({ timeline, onReset }: Props) {
  // Land on the finished report, not the start of the run — every event
  // (violations, task steps, announcements) is already "happened" as soon
  // as the results screen appears. No play button required.
  const [playhead, setPlayhead] = useState(timeline.meta.durationMs)
  const [activeViolationId, setActiveViolationId] = useState<string | null>(null)
  const activeCardRef = useRef<HTMLDivElement>(null)

  // Derived data
  const violations = (timeline.events.filter(e => e.type === 'violation') as ViolationEvent[])
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])

  const taskSteps = timeline.events.filter(e => e.type === 'task-step') as TaskStepEvent[]
  const hasTask = taskSteps.length > 0

  const keypresses = timeline.events.filter(e => e.type === 'keypress') as KeypressEvent[]

  // Current announcement at or before playhead
  const currentAnnouncement = (() => {
    let result: AnnouncementEvent | null = null
    for (const e of timeline.events) {
      if (e.t > playhead) break
      if (e.type === 'announcement') result = e as AnnouncementEvent
    }
    return result
  })()

  // Recent keypresses (last 6 at or before playhead)
  const recentKeys = keypresses.filter(k => k.t <= playhead).slice(-6)

  // Sync active violation from playhead
  useEffect(() => {
    let latest: ViolationEvent | null = null
    for (const e of timeline.events) {
      if (e.t > playhead) break
      if (e.type === 'violation') latest = e as ViolationEvent
    }
    if (latest) {
      const id = `${latest.checkId}-${latest.t}`
      setActiveViolationId(id)
    }
  }, [playhead, timeline.events])

  // Scroll active card into view
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeViolationId])

  // Manual scrub only — no autoplay loop. Lets you rewind to inspect what
  // led up to a violation, but nothing is gated behind pressing play.
  const seek = (t: number) => setPlayhead(t)

  const seekFromCard = (v: ViolationEvent) => {
    seek(v.t)
    setActiveViolationId(`${v.checkId}-${v.t}`)
  }

  // Severity summary
  const severityCounts = violations.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div
      style={{ background: 'var(--color-bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}
    >
      {/* Top bar */}
      <header
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 20px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <button
          onClick={onReset}
          aria-label="New audit"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-fg-muted)',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '3px',
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          ← new audit
        </button>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--color-fg)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {timeline.meta.url}
        </span>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-fg-muted)',
          }}
        >
          {new Date(timeline.meta.startedAt).toLocaleString()}
        </span>
      </header>

      {/* Layout: stage left, sidebar right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 0,
          minHeight: 'calc(100vh - 48px)',
        }}
      >
        {/* Left: stage + transport + status */}
        <div style={{ borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
          {/* Replay stage */}
          <div style={{ borderBottom: '1px solid var(--color-border)' }}>
            <ReplayStage
              timeline={timeline}
              playhead={playhead}
              activeViolationId={activeViolationId}
              onSeek={seek}
            />
          </div>

          {/* Transport: scrub only, no play button — the report is already
              showing its finished state; this is for optionally rewinding. */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-fg-muted)', width: 36, textAlign: 'right' }}>
                {formatTime(playhead)}
              </span>
              <input
                type="range"
                min={0}
                max={timeline.meta.durationMs}
                value={playhead}
                step={50}
                aria-label="Playhead scrubber"
                onChange={e => seek(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--color-accent)', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-fg-muted)', width: 36 }}>
                {formatTime(timeline.meta.durationMs)}
              </span>
            </div>
          </div>

          {/* Keypress ticker */}
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: 40,
            }}
            aria-label="Recent keypresses"
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-fg-dim)', marginRight: 4 }}>
              KEYS
            </span>
            {recentKeys.map((k, i) => (
              <kbd
                key={i}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--color-fg)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border-bright)',
                  borderBottom: '2px solid var(--color-border-bright)',
                  borderRadius: '3px',
                  padding: '2px 7px',
                  opacity: 0.4 + (i / recentKeys.length) * 0.6,
                }}
              >
                {k.key}
              </kbd>
            ))}
          </div>

          {/* Announcement widget */}
          {timeline.meta.screenReaderNote && (
            <div
              aria-live="polite"
              aria-label="Simulated screen reader announcements"
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-fg-dim)', marginBottom: 6, letterSpacing: '0.06em' }}>
                SIMULATED SCREEN READER
              </div>
              {currentAnnouncement ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-accent)', margin: 0 }}>
                  "{currentAnnouncement.text}"
                </p>
              ) : (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-fg-dim)', margin: 0 }}>
                  —
                </p>
              )}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-fg-dim)', margin: '6px 0 0', lineHeight: 1.5 }}>
                {timeline.meta.screenReaderNote}
              </p>
            </div>
          )}

          {/* Task status — absent unless task-step events exist */}
          {hasTask ? (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-fg-dim)', marginBottom: 8, letterSpacing: '0.06em' }}>
                TASK STEPS
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {taskSteps
                  .filter(ts => ts.t <= playhead)
                  .map((ts, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TaskStepIcon status={ts.status} />
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-fg)' }}>
                        {ts.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-fg-dim)', marginLeft: 'auto' }}>
                        {formatTime(ts.t)}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
          ) : (
            <div style={{ padding: '10px 14px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-fg-dim)', margin: 0 }}>
                No task configured — audit is complete as it stands.
              </p>
            </div>
          )}
        </div>

        {/* Right: violations sidebar */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Severity summary */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {violations.length === 0 ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)' }}>
                0 violations — no issues detected
              </span>
            ) : (
              <>
                {(['critical','serious','moderate','minor'] as const).map(sev => {
                  const count = severityCounts[sev] || 0
                  if (!count) return null
                  return (
                    <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 600, color: SEVERITY_LABEL[sev] }}>
                        {count}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-fg-muted)', textTransform: 'uppercase' }}>
                        {sev}
                      </span>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Violation cards or pass state */}
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {violations.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '40px 20px',
                  textAlign: 'center',
                }}
                role="status"
                aria-label="No violations found"
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', color: 'var(--color-accent)' }}>✓</div>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-fg)', margin: 0, fontWeight: 500 }}>
                  No violations found
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-fg-muted)', margin: 0, lineHeight: 1.6 }}>
                  This is a legitimate pass. The audit completed {keypresses.length} keypress{keypresses.length !== 1 ? 'es' : ''} without encountering any accessibility failures.
                </p>
              </div>
            ) : (
              violations.map((v, i) => {
                const id = `${v.checkId}-${v.t}`
                const isActive = id === activeViolationId
                return (
                  <div key={id} ref={isActive ? activeCardRef : null}>
                    <ViolationCard
                      violation={v}
                      index={i}
                      isActive={isActive}
                      onClick={() => seekFromCard(v)}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

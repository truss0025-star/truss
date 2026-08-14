import { useRef, useEffect, useState, type MouseEvent } from 'react'
import type { Timeline, TimelineEvent, FocusEvent, ViolationEvent } from '../schema/timeline'

type FocusOrViolation = FocusEvent | ViolationEvent

function isFocusOrViolation(e: TimelineEvent): e is FocusOrViolation {
  return e.type === 'focus' || e.type === 'violation'
}

function severityColor(sev: string) {
  if (sev === 'critical') return 'var(--color-critical)'
  if (sev === 'serious')  return 'var(--color-serious)'
  if (sev === 'moderate') return 'var(--color-moderate)'
  return 'var(--color-minor-col)'
}

interface Props {
  timeline: Timeline
  playhead: number
  activeViolationId: string | null
  onSeek: (t: number) => void
}

export default function ReplayStage({ timeline, playhead, activeViolationId, onSeek }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { viewportWidth, viewportHeight } = timeline.meta
  const scale = containerWidth ? containerWidth / viewportWidth : 1
  const stageHeight = containerWidth ? containerWidth * (viewportHeight / viewportWidth) : 0

  // Most recent focus/violation event at or before playhead
  const currentEvent: FocusOrViolation | null = (() => {
    let result: FocusOrViolation | null = null
    for (const e of timeline.events) {
      if (e.t > playhead) break
      if (isFocusOrViolation(e)) result = e
    }
    return result
  })()

  // Most recent screenshot at or before playhead
  const currentScreenshot: string | null = (() => {
    let result: string | null = null
    for (const e of timeline.events) {
      if (e.t > playhead) break
      if (isFocusOrViolation(e) && e.screenshot) result = e.screenshot
    }
    return result
  })()

  // All past focus/violation events for wireframe ghosts
  const pastEvents: FocusOrViolation[] = timeline.events
    .filter(e => e.t <= playhead && isFocusOrViolation(e)) as FocusOrViolation[]

  const isViolation = currentEvent?.type === 'violation'
  const cursorX = currentEvent ? (currentEvent.bbox.x + currentEvent.bbox.width / 2) * scale : 0
  const cursorY = currentEvent ? (currentEvent.bbox.y + currentEvent.bbox.height / 2) * scale : 0

  // Scrubber click on stage area
  const handleStageClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const relY = e.clientY - rect.top
    // Find nearest event by proximity to click point
    let best: FocusOrViolation | null = null
    let bestDist = Infinity
    for (const ev of timeline.events) {
      if (!isFocusOrViolation(ev)) continue
      const ex = (ev.bbox.x + ev.bbox.width / 2) * scale
      const ey = (ev.bbox.y + ev.bbox.height / 2) * scale
      const dist = Math.hypot(ex - relX, ey - relY)
      if (dist < bestDist) { bestDist = dist; best = ev }
    }
    if (best && bestDist < 80) onSeek(best.t)
  }

  return (
    <div>
      {/* Stage chrome */}
      <div
        style={{
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 12px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '5px' }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: 'var(--color-surface)',
            borderRadius: '3px',
            height: '18px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-fg-muted)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {timeline.meta.url}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--color-fg-dim)',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '2px 6px',
          }}
        >
          REPLAY
        </span>
      </div>

      {/* Viewport */}
      <div
        ref={containerRef}
        onClick={handleStageClick}
        aria-label="Replay stage — keyboard navigation replay"
        role="img"
        style={{
          position: 'relative',
          width: '100%',
          height: stageHeight || 'auto',
          background: currentScreenshot ? '#000' : 'var(--color-surface)',
          overflow: 'hidden',
          cursor: 'crosshair',
          minHeight: 180,
        }}
      >
        {currentScreenshot ? (
          // Screenshot mode: real captured frame
          <img
            src={currentScreenshot}
            alt={`Captured frame at ${(playhead / 1000).toFixed(1)}s — ${currentEvent?.selector ?? ''}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          // Wireframe mode: ghost boxes from past focus targets
          <>
            {/* Grid lines for orientation */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
              backgroundSize: `${80 * scale}px ${60 * scale}px`,
              opacity: 0.3,
            }} />
            {/* Ghost boxes for past events */}
            {pastEvents.map((ev, i) => {
              const isCurrent = ev === currentEvent
              const isVio = ev.type === 'violation'
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: ev.bbox.x * scale,
                    top: ev.bbox.y * scale,
                    width: ev.bbox.width * scale,
                    height: ev.bbox.height * scale,
                    border: isCurrent
                      ? `2px solid ${isVio ? severityColor((ev as ViolationEvent).severity) : 'var(--color-accent)'}`
                      : '1px solid var(--color-border-bright)',
                    background: isCurrent && isVio
                      ? `${severityColor((ev as ViolationEvent).severity)}18`
                      : isCurrent
                      ? 'var(--color-accent-glow)'
                      : 'transparent',
                    borderRadius: '2px',
                    transition: prefersReducedMotion ? 'none' : 'all 0.15s ease',
                    pointerEvents: 'none',
                  }}
                />
              )
            })}
          </>
        )}

        {/* Screenshot mode overlay: focus ring on top of image */}
        {currentScreenshot && currentEvent && (
          <div
            style={{
              position: 'absolute',
              left: currentEvent.bbox.x * scale,
              top: currentEvent.bbox.y * scale,
              width: currentEvent.bbox.width * scale,
              height: currentEvent.bbox.height * scale,
              border: `2px solid ${isViolation ? severityColor((currentEvent as ViolationEvent).severity) : 'var(--color-accent)'}`,
              background: isViolation
                ? `${severityColor((currentEvent as ViolationEvent).severity)}20`
                : 'var(--color-accent-glow)',
              borderRadius: '2px',
              transition: prefersReducedMotion ? 'none' : 'all 0.2s ease-out',
              pointerEvents: 'none',
              boxShadow: isViolation
                ? `0 0 0 1px ${severityColor((currentEvent as ViolationEvent).severity)}40 inset`
                : `0 0 0 1px var(--color-accent)40 inset`,
            }}
          />
        )}

        {/* Synthetic cursor */}
        {currentEvent && containerWidth > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`,
              transition: prefersReducedMotion ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {/* Pulse ring */}
            {!prefersReducedMotion && (
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 32, height: 32,
                borderRadius: '50%',
                border: `1.5px solid ${isViolation ? severityColor((currentEvent as ViolationEvent).severity) : 'var(--color-accent)'}`,
                opacity: 0.5,
                animation: 'cursorPulse 1.2s ease-out infinite',
              }} />
            )}
            {/* Cursor dot */}
            <div style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: isViolation
                ? severityColor((currentEvent as ViolationEvent).severity)
                : 'var(--color-accent)',
              boxShadow: `0 0 8px ${isViolation ? severityColor((currentEvent as ViolationEvent).severity) : 'var(--color-accent)'}88`,
            }} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes cursorPulse {
          0%   { transform: translate(-50%,-50%) scale(0.8); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

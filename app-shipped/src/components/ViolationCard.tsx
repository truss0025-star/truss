import type { ViolationEvent } from '../schema/timeline'

const SEVERITY_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 }
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-critical)',
  serious:  'var(--color-serious)',
  moderate: 'var(--color-moderate)',
  minor:    'var(--color-minor-col)',
}
const SEVERITY_DIM: Record<string, string> = {
  critical: 'var(--color-critical-dim)',
  serious:  'var(--color-serious-dim)',
  moderate: 'var(--color-moderate-dim)',
  minor:    'rgba(103,112,105,0.10)',
}

export { SEVERITY_ORDER }

interface Props {
  violation: ViolationEvent
  index: number
  isActive: boolean
  onClick: () => void
}

export default function ViolationCard({ violation, index, isActive, onClick }: Props) {
  const col = SEVERITY_COLOR[violation.severity]
  const dim = SEVERITY_DIM[violation.severity]

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Violation ${index + 1}: ${violation.checkId} — ${violation.severity}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        background: isActive ? dim : 'var(--color-surface)',
        border: `1px solid ${isActive ? col : 'var(--color-border)'}`,
        borderLeft: `3px solid ${col}`,
        borderRadius: '4px',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        outline: 'none',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            color: col,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {violation.severity}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-fg-muted)',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '2px',
            padding: '1px 6px',
          }}
        >
          WCAG {violation.wcag}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-fg-muted)',
            marginLeft: 'auto',
          }}
        >
          {(violation.t / 1000).toFixed(2)}s
        </span>
      </div>

      {/* Check ID */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--color-fg-muted)',
          marginBottom: '6px',
        }}
      >
        {violation.checkId}
      </div>

      {/* Plain English */}
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: 'var(--color-fg)',
          lineHeight: '1.5',
          margin: '0 0 10px',
        }}
      >
        {violation.plainEnglish}
      </p>

      {/* Fix block */}
      <div
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          padding: '8px 10px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--color-fg-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '4px',
          }}
        >
          Fix
        </div>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--color-fg-muted)',
            lineHeight: '1.5',
            margin: 0,
          }}
        >
          {violation.fix}
        </p>
      </div>

      {/* Provenance badge */}
      <div className="flex items-center gap-2">
        {violation.provenance === 'rule' ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--color-fg-muted)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '2px',
              padding: '2px 6px',
              letterSpacing: '0.04em',
            }}
          >
            DETERMINISTIC RULE
          </span>
        ) : (
          <>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--color-accent)',
                background: 'var(--color-accent-glow)',
                border: '1px solid rgba(6,122,74,0.25)',
                borderRadius: '2px',
                padding: '2px 6px',
                letterSpacing: '0.04em',
              }}
            >
              LLM
            </span>
            {violation.llmConfidence != null && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--color-fg-muted)',
                }}
              >
                confidence {Math.round(violation.llmConfidence * 100)}%
              </span>
            )}
          </>
        )}

        {/* Selector */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--color-fg-dim)',
            marginLeft: 'auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '160px',
          }}
          title={violation.selector}
        >
          {violation.selector}
        </span>
      </div>
    </div>
  )
}

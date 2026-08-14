import { useState, useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'

const EXAMPLE_URLS = [
  'https://example.com',
  'https://gov.uk',
  'https://checkout.example.com',
  'https://webapp.example.io',
]

// Loose "does this look like a URL/domain" check — good enough to decide
// whether a paste should auto-trigger a run, not a strict validator.
const LOOKS_LIKE_URL = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i

interface Props {
  onRun: (url: string) => void
}

export default function EntryScreen({ onRun }: Props) {
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const runUrl = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    onRun(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    runUrl(url)
  }

  // Paste a link → start the audit immediately, no click required.
  // Only takes over when the pasted text looks like a whole URL/domain;
  // otherwise falls through to the browser's normal paste-at-cursor behavior.
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (!pasted || !LOOKS_LIKE_URL.test(pasted)) return
    e.preventDefault()
    setUrl(pasted)
    runUrl(pasted)
  }

  const handleChip = (chip: string) => {
    setUrl(chip)
    inputRef.current?.focus()
    runUrl(chip)
  }

  const handleChipKey = (e: KeyboardEvent, chip: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleChip(chip)
    }
  }

  return (
    <main
      style={{ background: 'var(--color-bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}
      className="flex flex-col items-center justify-center px-6"
    >
      {/* Wordmark */}
      <div className="mb-10 text-center">
        <div
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', letterSpacing: '0.04em' }}
          className="text-xs font-medium uppercase mb-2"
        >
          Accessibility Agent
        </div>
        <h1
          style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-sans)' }}
          className="text-2xl font-semibold tracking-tight"
        >
          Keyboard audit instrument
        </h1>
        <p style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }} className="text-xs mt-2">
          v0.2 — rule + LLM provenance
        </p>
      </div>

      {/* Entry form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl"
        aria-label="Run accessibility audit"
      >
        <div
          style={{ border: '1px solid var(--color-border-bright)', background: 'var(--color-surface)' }}
          className="flex items-center rounded overflow-hidden"
        >
          <label htmlFor="target-url" className="sr-only">Target URL</label>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-fg-muted)',
              background: 'var(--color-surface-2)',
              borderRight: '1px solid var(--color-border)',
              padding: '0 14px',
              lineHeight: '48px',
              fontSize: '12px',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
            aria-hidden="true"
          >
            URL
          </span>
          <input
            ref={inputRef}
            id="target-url"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onPaste={handlePaste}
            placeholder="https://your-site.com"
            autoComplete="url"
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-fg)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              padding: '0 14px',
              height: '48px',
            }}
          />
          <button
            type="submit"
            disabled={!url.trim()}
            style={{
              background: url.trim() ? 'var(--color-accent)' : 'var(--color-border)',
              color: url.trim() ? 'var(--color-accent-ink)' : 'var(--color-fg-dim)',
              border: 'none',
              cursor: url.trim() ? 'pointer' : 'default',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '13px',
              padding: '0 24px',
              height: '48px',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            Run audit
          </button>
        </div>

        {/* Example chips */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <span
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)', fontSize: '11px' }}
          >
            try:
          </span>
          {EXAMPLE_URLS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChip(chip)}
              onKeyDown={e => handleChipKey(e, chip)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-accent)',
                background: 'var(--color-accent-glow)',
                border: '1px solid rgba(6,122,74,0.25)',
                borderRadius: '3px',
                padding: '3px 10px',
                cursor: 'pointer',
                transition: 'background 0.1s, border-color 0.1s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,122,74,0.16)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-glow)'
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </form>

      {/* Footer note */}
      <p
        style={{ color: 'var(--color-fg-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
        className="mt-12 text-center max-w-sm"
      >
        Drives a real browser keyboard-only. Reports focus order, WCAG violations, and screen reader announcements.
      </p>
    </main>
  )
}

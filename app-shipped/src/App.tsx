import { useState } from 'react'
import type { Timeline } from './schema/timeline'
import EntryScreen from './components/EntryScreen'
import ResultsView from './components/ResultsView'

type AppView = 'entry' | 'loading' | 'failed' | 'results'

// Real audit — hits the engine's local API bridge (`npm run serve` in
// /engine, http://localhost:8787 by default). It drives an actual browser
// against the pasted URL and returns the real timeline; no sample data.
const ENGINE_API = import.meta.env.VITE_ENGINE_API ?? 'http://localhost:8787'

async function defaultOnRun(url: string): Promise<Timeline> {
  const res = await fetch(`${ENGINE_API}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Omit `config` to run full-page checks only (no task-completion
    // attempt) — same as the CLI's --config flag being absent.
    body: JSON.stringify({ url, config: url.includes('hero-site') ? 'hero-site' : undefined }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(body.error ?? `Audit failed with status ${res.status}`)
  }

  const { timeline } = (await res.json()) as { timeline: Timeline }
  return timeline
}

export default function App() {
  const [view, setView] = useState<AppView>('entry')
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [auditUrl, setAuditUrl] = useState('')

  const handleRun = async (url: string) => {
    setAuditUrl(url)
    setError(null)
    setView('loading')
    try {
      const result = await defaultOnRun(url)
      setTimeline(result)
      setView('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed — unknown error.')
      setView('failed')
    }
  }

  if (view === 'entry') {
    return <EntryScreen onRun={handleRun} />
  }

  if (view === 'loading') {
    return (
      <main
        style={{ background: 'var(--color-bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}
        className="flex flex-col items-center justify-center gap-6"
        aria-live="polite"
        aria-label="Running audit"
      >
        {/* Spinner */}
        <div
          style={{
            width: 40, height: 40,
            border: '2px solid var(--color-border-bright)',
            borderTopColor: 'var(--color-accent)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
          aria-hidden="true"
        />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-fg-muted)', margin: '0 0 4px' }}>
            Running keyboard audit…
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-fg-dim)', margin: 0 }}>
            {auditUrl}
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  if (view === 'failed') {
    return (
      <main
        style={{ background: 'var(--color-bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}
        className="flex flex-col items-center justify-center gap-6 px-6"
        role="alert"
        aria-label="Audit failed"
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--color-critical)',
            background: 'var(--color-critical-dim)',
            border: '1px solid var(--color-critical)',
            borderRadius: '3px',
            padding: '4px 12px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Run failed — not a pass
        </div>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-fg)', margin: '0 0 8px', fontWeight: 500 }}>
            The audit could not complete.
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-fg-muted)', margin: '0 0 6px' }}>
            {auditUrl}
          </p>
          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-critical)', margin: 0, lineHeight: 1.6 }}>
              {error}
            </p>
          )}
        </div>
        <button
          onClick={() => setView('entry')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-fg)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-bright)',
            borderRadius: '3px',
            padding: '8px 20px',
            cursor: 'pointer',
          }}
        >
          ← try again
        </button>
      </main>
    )
  }

  if (view === 'results' && timeline) {
    return (
      <ResultsView
        timeline={timeline}
        onReset={() => { setTimeline(null); setView('entry') }}
      />
    )
  }

  return null
}

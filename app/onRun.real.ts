// Drop-in replacement for defaultOnRun in src/App.tsx.
// Everything else in App.tsx — the state machine, the four views — is
// untouched. This is the only function body that changes to go from
// sample data to a real engine run.
//
// Requires the engine's local API bridge running: `npm run serve` in
// /engine (defaults to http://localhost:8787).

import type { Timeline } from './schema/timeline'

const ENGINE_API = import.meta.env.VITE_ENGINE_API ?? 'http://localhost:8787'

async function defaultOnRun(url: string): Promise<Timeline> {
  const res = await fetch(`${ENGINE_API}/api/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Omit `config` to run full-page checks only (no task-completion
    // attempt) — same behavior as the CLI's --config flag being absent,
    // which the UI already handles as the "no task configured" state.
    body: JSON.stringify({ url, config: url.includes('hero-site') ? 'hero-site' : undefined }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(body.error ?? `Audit failed with status ${res.status}`)
  }

  const { timeline } = (await res.json()) as { timeline: Timeline }
  return timeline
}

export default defaultOnRun

# The Accessibility Agent — v0 lean

## Schema version

**v0.2** — contributed by Kalyan via Figma Make, now the frozen contract.
Superseded the original engine-authored v0.1. Key differences: `provenance:
'rule'|'llm'` (was `deterministic: boolean`), numeric `llmConfidence` 0–1
(was a high/medium/low enum), a separate `AnnouncementEvent` type (was
folded into `FocusEvent.announcement`), optional `screenshot?` on focus and
violation events, and `TaskStepEvent` using `label` + `status:
pass|fail|skip` (was `stepIndex`/`target`/`reached|unreachable|in-progress`).
The engine has been fully updated to emit this shape — see
`schema/timeline.ts`.

## What's in this repo right now

- `/schema/timeline.ts` — the contract. Type-checked, frozen at v0.2.
- `/engine/` — real, type-checked TypeScript, emitting schema v0.2. Harness
  (Playwright), axe-core scan, keyboard engine (tab walk + trap +
  reachability), CDP accessibility tree reader, focus-ring pixel-diff,
  Claude judgment calls (alt text + label clarity), task-completion (the
  signature check), and `run.ts` that orchestrates all of it into one
  command.
- `/app/src/schema/timeline.ts` — same contract, copied into the UI
  project's own source tree (per the UI build context's file structure).
- `/app/src/data/goldenReference.ts` — the rich 6-violation sample timeline
  (mixed rule + llm provenance), matching schema v0.2 exactly. Type-checked.
- `/app/src/data/sampleRuns.ts` — `noViolationsRun` (legitimate pass state,
  gov.uk) and `taskRun` (task status panel demo, 3 pass + 1 fail + 1 skip).
  Type-checked.
- `/config/sites/hero-site.json` — the one per-site task config, now
  carrying a `label` per step for the UI's task status panel.
- `accessibility-agent-demo.html` (delivered separately, in chat) — a
  reference implementation of the replay/report interaction logic against
  the *original* v0.1 shape. Useful for the interaction model, but the UI
  build context you're implementing against supersedes its data shape and
  visual design — don't port its markup or styling, only the logic pattern
  (playhead, seek, at-or-before lookup, two-way sync).

## Why the engine hasn't run against a live site yet

It was built and type-checked against the real `playwright`, `@axe-core/playwright`,
and `@anthropic-ai/sdk` type definitions — that part is done and verified.
But it hasn't executed against a real browser yet, because this build
environment's network egress is locked to package registries only (npm,
PyPI, GitHub) — it can't download the Chromium binary or navigate to an
arbitrary website. That step needs to happen on your machine or CI.

## Running it locally

```bash
cd engine
npm install
npx playwright install chromium   # only needs to happen once
export ANTHROPIC_API_KEY=sk-ant-...

# Full-page checks only, no task-completion attempt:
npm run run -- --url https://example.com

# With the hero-site task config (attempts the scripted checkout):
npm run run -- --url https://your-hero-site.com --config ../config/sites/hero-site.json
```

Output lands in `/runs/run-<timestamp>/timeline.json` + `/runs/run-<timestamp>/frames/*.png`.

## Definition of done — Week 1 (per the sprint doc)

- [x] Schema frozen at v0.2 (`/schema/timeline.ts`, mirrored in `/app/src/schema/`)
- [x] Engine type-checks clean against real dependency types, emitting v0.2
- [x] Sample data type-checks clean: `goldenReference.ts`, `sampleRuns.ts`
- [x] 17 unit tests, actually executed (`npm test` in `/engine`) — covering
      timeline sorting/duration math, axe WCAG-tag parsing, and the
      deterministic-cause diagnosis behind the signature check, via mocked
      Playwright objects (no browser required for this layer)
- [x] Real UI shipped (Figma Make export) — installs, type-checks, and `vite build`s clean
- [x] Local API bridge (`engine/src/server.ts`) built and type-checked — connects `onRun` to a real engine run
- [ ] `npm run run` (or the API server) executed against a real hero site — needs your machine, this build environment can't download Chromium or reach arbitrary sites
- [ ] Engine's real timeline reproduces every violation a hand audit finds

## Running it locally — the full integrated loop

Two terminals:

```bash
# Terminal 1 — the engine's local API bridge
cd engine
npm install
npx playwright install chromium   # once
export ANTHROPIC_API_KEY=sk-ant-...
npm run serve                     # listens on http://localhost:8787

# Terminal 2 — the app
cd app
npm install
npm run dev
```

Then in `app/src/App.tsx`, replace the body of `defaultOnRun` with the
contents of `app/onRun.real.ts` (delivered alongside this README) — it's
the only function that changes. Everything downstream (state machine, the
four views, `ResultsView`, `ViolationCard`) is untouched, because both
sides already speak the same frozen schema.

Type a URL into the running app. If it contains `hero-site`, the request
includes `config: "hero-site"` and the task-completion check runs against
`/config/sites/hero-site.json`; any other URL runs full-page checks only —
which the UI already renders correctly as "no task configured," not an error.

## Next steps, in order

1. **Pick the real hero site** (a real, reproducible keyboard failure at
   checkout, no bot-blocking, loads reliably — per Days 1–2) if not done yet.
   If it's not literally named `hero-site.example`, either rename
   `config/sites/hero-site.json` or update the `config` param logic in
   `onRun.real.ts` to match your real domain.
2. Run the integrated loop above against it. Compare the real output
   against a hand audit of the same site.
3. Tune the LLM judgment prompts (`engine/checks/judgment.ts`) and the
   focus-ring diff threshold (`engine/checks/focusRing.ts`) — Rule 3: a
   false alarm costs more credibility than a miss.
4. Reliability pass: hydration retries, timeout budgets, determinism —
   run the same site three times, confirm identical findings.
5. Delete `app/src/imports/pasted_text/` — a stray file, not imported
   anywhere, but worth cleaning before a CI type-check runs across all of `src`.
6. Two dry runs on a machine that isn't the dev machine, per the sprint's
   own definition of done.

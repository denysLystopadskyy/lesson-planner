# Batch 1.5 — Feature specs II

Phase 1 · [Plan home](README.md) · Prev: [1.4](p1-04-feature-specs-1.md) · Next: [1.6](p1-06-eslint.md)

## Goal

Adopt the remaining four feature specs and prove the whole suite is stable.

## Tasks

- [x] Build clock control in the fixture, Node side and browser side.
- [x] Commit and green: `schedule-editing.spec.ts`,
      `monthly-overrides.spec.ts`, `payment-messages.spec.ts`,
      `csv-import-export.spec.ts`.
- [x] ~~Remove the empty `visual.spec.ts-snapshots/` folder~~ — it was never
      adopted, so there is nothing to remove. It stays in the prior-art
      checkout. Visual testing returns in batch [2b.8](p2b-08-visual-regression.md).
- [x] Stability run: three repeats of the full suite.
- [x] Seed a template in `payment-messages.spec.ts` so the real payment
      identifiers cannot reach CI artifacts.

## Clock control: two clocks, one instant

The centrepiece of this batch. `e2e/ui/support/clock.ts` holds a single
`FIXED_NOW` — 2026-06-15, mid-month and mid-year so that neither
`updateDefaultPrice`'s current-month guard nor `changeMonth`'s year rollover
becomes an edge case by accident. Both clocks are pinned to it.

**Browser.** `context.clock.setFixedTime(now)` in the `context` fixture. Three
choices there are deliberate:

- **On the context, not the page.** The clock is context-scoped, so installing
  it before the first `newPage()` means the init script is already registered
  when the page loads. That matters because the app reads the date while its
  inline script parses — `App.state.calMonth` and `calYear` are set then. A
  page-level pin applied after `page.goto()` would be too late.
- **`setFixedTime`, not `install` or `pauseAt`.** It freezes what `Date.now()`
  and `new Date()` report while leaving timers running. The app has five
  `setTimeout` calls, two of them focus calls in the template and review
  dialogs, and `pauseAt` would strand them.
- **Overridable.** `configureTest({ now })` lets a spec ask for a different
  instant, which is how a future boundary test should get one.

Verified rather than assumed: with the pin in place the page reports
`2026-06-15T12:00:00.000Z`, and `#monthSelect` and `#yearInput` — populated by
`App.init()` from the parse-time reads — hold `5` and `2026`. So the pin reaches
load time, which was the thing that could quietly have failed.

**Node.** `faker.setDefaultRefDate(FIXED_NOW)` at module scope in
`test-data.ts`. This is the half no browser API can reach: `pickMonthContext()`
calls `faker.date.soon()`, which defaults its reference date to the Node
process's `new Date()`, and four specs call it while they are being collected —
before any fixture or browser exists. Module scope in `test-data.ts` is early
enough because every spec imports from that file, and an imported module's body
runs first.

Measured, so the rule is not folklore: seed 7707 yields `2027-02` against a
reference date of 2026-06-15 and `2027-04` against 2026-09-05. Pinned, the same
seed yields the same month on every run.

**One real bug found by the pin.** `payment-messages.spec.ts` derived the
"current" month key from `new Date()` in Node while the browser ran pinned. The
app renders a row for its own current month, so the spec looked for a row that
was never rendered. It now derives that key from `FIXED_NOW`. This was the only
visible symptom of the whole class of drift — worth remembering, because a
browser-only pin would have looked like it worked.

## Also fixed: test data was not reproducible

The fixture seeded faker from the test title **plus the worker index**, so the
same test generated different data on different workers. A failure could not be
reproduced locally, and a retry that landed on another worker was not re-running
the same case — which undercuts "zero flaky retries" as a gate. Seeding is now
from the title alone. Specs are isolated by their own storage state, so two
workers holding identical data costs nothing.

## BDD structure

Like batch 1.4, these arrived as flat `test()` calls. Each is now in a
`describe` naming its ISTQB technique:

| Spec                        | Technique                                                                |
| --------------------------- | ------------------------------------------------------------------------ |
| `schedule-editing.spec.ts`  | State transition testing — closed → open → selected → saved or cancelled |
| `monthly-overrides.spec.ts` | State transition testing — default price → override → persisted          |
| `payment-messages.spec.ts`  | Equivalence partitioning — a month has lessons or it has none            |
| `csv-import-export.spec.ts` | Decision table — export and import, each against a good and a bad input  |

## What these specs still do not cover

Recorded rather than left implied, because a green suite invites the assumption
that the area is covered:

- The CSV export test checks only the **filename**. The file's contents are
  never read, so the export could be wrong in every field and this would pass.
- **[DEF-006](def-registry.md)** — a stray balanced quote is accepted silently
  and destroys existing data with no dialog — is not exercised by any case here.
- **[DEF-011](def-registry.md)** — the copy button reports success without
  awaiting the clipboard write — is dodged rather than tested: the copy test
  stubs the clipboard, so it asserts the message content, not the app's failure
  handling.

All three are batch [1.12](p1-12-coverage-csv.md) and
[1.11](p1-11-coverage-message-template.md) work.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0. **90 passed, 3 skipped, zero
      flaky retries.** The three skips are the same DEF-013 `fixme` repeated.
- [x] Full suite: 30 passed, 1 skipped.

## Merge order and dependencies

Depends on 1.4. Merges before 1.6. Deployable: yes — `index.html` is unchanged.

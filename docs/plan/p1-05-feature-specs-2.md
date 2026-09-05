# Batch 1.5 — Feature specs II

Phase 1 · [Plan home](README.md) · Prev: [1.4](p1-04-feature-specs-1.md) · Next: [1.6](p1-06-eslint.md)

## Goal

Adopt the remaining four feature specs and prove the whole suite is stable.

## Before starting

Two things found in earlier batches land here, not before. Both are recorded in
[Lessons learned](lessons-learned.md).

**Clock control must be built in this batch.** All four of these specs are
date-dependent, unlike the three in 1.4, which have none. The hard part is not
the browser: `pickMonthContext()` runs at **module scope** and reads the **Node**
clock through `faker.date.soon()`, so `page.clock` cannot reach it. It needs
`faker.setDefaultRefDate()` at module scope, or the calls moved inside the test
bodies. For the browser side prefer `clock.setFixedTime()` over `install()`,
install it on the **context** beside `stubClipboard`, and do not use `pauseAt()`
— it stalls the app's 100 ms focus timers in the template and review modals.

**`payment-messages.spec.ts` must seed its own template.** It renders a message
generated from the default template, which carries the real payment identifiers.
Traces, video and screenshots are all kept on failure, so an unseeded run
publishes those values into CI artifacts. See the rule in
[security-auth.md](../../.claude/context/security-auth.md).

## Tasks

- [ ] Build clock control in the fixture, Node side and browser side. See above.
- [ ] Commit and green: `schedule-editing.spec.ts`,
      `monthly-overrides.spec.ts`, `payment-messages.spec.ts`,
      `csv-import-export.spec.ts`.
- [ ] Remove the empty `visual.spec.ts-snapshots/` folder; visual testing
      returns in batch 2b.8.
- [ ] Stability run: three repeats of the full suite.

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0. Zero flaky retries.

## Merge order and dependencies

Depends on 1.4. Merges before 1.6. Deployable: yes.

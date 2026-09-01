# Batch 1.5 — Feature specs II

Phase 1 · [Plan home](README.md) · Prev: [1.4](p1-04-feature-specs-1.md) · Next: [1.6](p1-06-eslint.md)

## Goal

Adopt the remaining four feature specs and prove the whole suite is stable.

## Tasks

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

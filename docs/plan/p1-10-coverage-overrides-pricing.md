# Batch 1.10 — Coverage: monthly overrides and pricing

Phase 1 · [Plan home](README.md) · Prev: [1.9](p1-09-coverage-schedule-calendar.md) · Next: [1.11](p1-11-coverage-message-template.md)

## Goal

Cover the money math and pin the known pricing defects.

## Test design (technique named per group)

- **Decision table — effective price:** default price vs month override vs
  bulk "set price for selected dates", across current and future months.
- **Boundary value analysis — price input:** 0, 0.01, large, empty.
- **Pinned defects:** cross-month price bleed (DEF-010, desired behavior:
  a price applies only to the visible month); price cascade after a default
  price change (DEF-008 / DEF-009 interactions).
- **Aria snapshot:** the month-override rows.

## Tasks

- [ ] BDD specs per group; totals asserted against computed values.
- [ ] `test.fixme` pins for DEF-008, DEF-009, DEF-010 (desired behavior).

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.

## Merge order and dependencies

Depends on 1.7. Parallel development, sequential merge. Deployable: yes.

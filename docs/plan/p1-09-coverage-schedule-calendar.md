# Batch 1.9 — Coverage: schedule and calendar

Phase 1 · [Plan home](README.md) · Prev: [1.8](p1-08-coverage-groups.md) · Next: [1.10](p1-10-coverage-overrides-pricing.md)

## Goal

Cover calendar editing with state-transition and boundary techniques, and pin
the calendar structure with an aria snapshot.

## Test design (technique named per group)

- **State transition testing:** overview → edit mode → Done / Cancel / Escape;
  month navigation inside edit mode; the Escape-discards-silently path is
  pinned as DEF-012 (desired: confirm before discard).
- **Boundary value analysis — month and year:** December → January, January →
  December, year input minimum and a malformed year (pins DEF-002).
- **Equivalence partitioning — weekday header select:** all days on, all off,
  mixed month.
- **Aria snapshot:** the calendar grid structure (`toMatchAriaSnapshot`).

## Tasks

- [ ] BDD specs per technique group, clock controlled (fixed date).
- [ ] Aria snapshot stored and reviewed.

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.

## Merge order and dependencies

Depends on 1.7. Parallel development with 1.8–1.13, sequential merge.
Deployable: yes.

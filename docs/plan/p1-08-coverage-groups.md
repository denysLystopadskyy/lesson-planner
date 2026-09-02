# Batch 1.8 — Coverage: group management

Phase 1 · [Plan home](README.md) · Prev: [1.7](p1-07-ci-advisory.md) · Next: [1.9](p1-09-coverage-schedule-calendar.md)

## Goal

Deepen group-management coverage using named ISTQB techniques.

## Test design (technique named per group)

- **Equivalence partitioning — group name:** normal text, empty (falls back to
  a default name), duplicate name, name with HTML characters (pins current
  behavior; see DEF-014 in the [DEF registry](def-registry.md)).
- **Boundary value analysis — default price:** 0, 0.01, a large value,
  negative, empty.
- **Decision table — closing the group form:** Save / Cancel / Escape /
  overlay click, each against "with changes" and "without changes".

## Tasks

- [ ] One BDD spec file per technique group; the `describe` name carries the
      technique.
- [ ] Pin known wrong behavior with `test.fixme(true, 'DEF-xxx: ...')` specs
      that describe the desired behavior (see the registry).

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0; fixme-marked specs are the
  only skips.

## Merge order and dependencies

Depends on 1.7. Batches 1.8–1.13 can be developed in parallel but merge one by
one (they share Screenplay files). Deployable: yes.

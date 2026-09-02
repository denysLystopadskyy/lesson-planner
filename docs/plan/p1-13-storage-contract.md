# Batch 1.13 — Storage contract specs

Phase 1 · [Plan home](README.md) · Prev: [1.12](p1-12-coverage-csv.md) · Next: [2a.1](p2a-01-vite-scaffold.md)

## Goal

Prove how the app reads and writes the three storage keys, with reusable
fixtures the React port will run against unchanged.

## Test design (technique named per group)

- **Equivalence partitioning — stored shapes:** empty storage (first run);
  a realistic dataset (three groups, two months, overrides); a legacy-shaped
  dataset written by the original app version.
- **Desired-behavior pin:** corrupt JSON in one key must show an error and
  offer recovery instead of a dead page —
  `test.fixme(true, 'DEF-001: corrupt storage kills the page; fix in 3.1')`.
- **Write-back check:** after each mutation, the three keys deep-equal the
  expected golden shapes (see
  [storage-data-contract.md](../../.claude/context/storage-data-contract.md)).

## Tasks

- [ ] Fixture files: `empty.json`, `realistic.json`, `legacy.json`,
      `corrupt.txt` under `e2e/fixtures/storage/`. No personal data.
- [ ] Seeding helper accepts an optional key prefix (used by staging in 2a).
- [ ] BDD specs for read, write-back, and the DEF-001 pin.

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.
- The seeding helper works with and without a prefix (both exercised).

## Merge order and dependencies

Depends on 1.7. Last Phase 1 merge. Batch 2a.3a consumes these fixtures.
Deployable: yes.

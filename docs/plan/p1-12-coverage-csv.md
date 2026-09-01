# Batch 1.12 — Coverage: CSV export and import

Phase 1 · [Plan home](README.md) · Prev: [1.11](p1-11-coverage-message-template.md) · Next: [1.13](p1-13-storage-contract.md)

## Goal

Cover the CSV round trip and pin its known data-loss defects.

## Test design (technique named per group)

- **Equivalence partitioning — import files:** valid export, empty file,
  wrong header, non-CSV text.
- **Boundary value analysis — field content:** quotes, commas, newlines,
  Cyrillic text.
- **Error guessing (from the defect list):** re-import of the app's own export
  with a malformed month key aborts the restore (DEF-002); a stray balanced
  quote destroys data (DEF-006); import replaces everything without a
  confirmation (DEF-004); export omits the template (DEF-005); no UTF-8 BOM
  (DEF-007).
- **Round trip:** export → clear → import → state deep-equals the original.

## Tasks

- [ ] BDD specs per group; `test.fixme` pins describe the desired behavior
      for each DEF above.

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.

## Merge order and dependencies

Depends on 1.7. Parallel development, sequential merge. Deployable: yes.

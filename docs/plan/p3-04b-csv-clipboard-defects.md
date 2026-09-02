# Batch 3.4b — CSV and data-reset defects (fixes DEF-004, DEF-006, DEF-007, DEF-013)

Phase 3 · [Plan home](README.md) · Prev: [3.4a](p3-04a-interaction-defects.md) · Next: [3.5](p3-05-pii-template-cleanup.md)

## Goal

The CSV path stops being able to destroy data, and "Clear all" clears all.

## Tasks (TDD)

- [ ] Import asks for confirmation and snapshots before replacing (DEF-004).
- [ ] Quote and separator handling survives the round trip (DEF-006).
- [ ] Export starts with a UTF-8 BOM so Excel reads Cyrillic (DEF-007).
- [ ] "Clear all data" also clears the template key, and says so (DEF-013).

## Acceptance criteria

- DEF-004, DEF-006, DEF-007, DEF-013 specs pass without fixme flags.

## Merge order and dependencies

Depends on 3.2. Deployable: yes.

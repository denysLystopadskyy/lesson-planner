# Batch 3.2 — Input and import sanitation (fixes DEF-002, DEF-003)

Phase 3 · [Plan home](README.md) · Prev: [3.1](p3-01-storage-guards.md) · Next: [3.3](p3-03-json-backup.md)

## Goal

No user input or imported file can put the data model into a broken state.

## Tasks (TDD)

- [ ] Year input constrained (sane range); month keys always `YYYY-MM`
      (DEF-002 green).
- [ ] Currency values validated against the supported list on import; an
      unknown value falls back with a warning instead of breaking a group
      (DEF-003 green).
- [ ] Confirm React escaping covers the old innerHTML sink (DEF-014 spec
      green by construction — assert no `dangerouslySetInnerHTML` in `app/`).

## Acceptance criteria

- DEF-002, DEF-003, DEF-014 specs pass without fixme flags.
- `grep -r dangerouslySetInnerHTML app/src` returns nothing.

## Merge order and dependencies

Depends on 2b.10. Parallel-safe with 3.4a/3.5. Deployable: yes.

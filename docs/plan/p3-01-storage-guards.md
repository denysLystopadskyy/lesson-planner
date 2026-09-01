# Batch 3.1 — Storage guards (fixes DEF-001)

Phase 3 · [Plan home](README.md) · Prev: [2b.10](p2b-10-redux-toolkit.md) · Next: [3.2](p3-02-input-import-sanitation.md)

## Goal

Corrupt storage never produces a dead page again.

## Tasks (TDD: the pinned spec goes green in this PR)

- [ ] Guard every read: parse errors are caught; the bad value is copied to
      `<key>.corrupt.backup`; the app starts with a visible error message and
      an empty state instead of a blank page.
- [ ] Guard every write; a failed write shows a message.
- [ ] Shape check after parse (array of groups; object with
      `defaultCurrency`).
- [ ] Remove `test.fixme` from the DEF-001 spec; it must now pass.
- [ ] Call `navigator.storage.persist()` once at startup.

## Acceptance criteria

- Seeding `corrupt.txt` into any key → the app loads, shows the error, and a
  `.corrupt.backup` key exists.
- DEF-001 removed from the [registry's](def-registry.md) open list.

## Merge order and dependencies

Depends on 2b.10. Blocks 3.3. Deployable: yes.

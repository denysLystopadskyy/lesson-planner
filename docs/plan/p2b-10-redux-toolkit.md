# Batch 2b.10 — Redux Toolkit

Phase 2b · [Plan home](README.md) · Prev: [2b.9](p2b-09-hash-routing.md) · Next: [3.1](p3-01-storage-guards.md)

## Goal

Application state moves into a Redux Toolkit store; persistence stays byte-
compatible with the three keys.

## Tasks

- [ ] Store with slices `groups`, `settings`, `template` (see
      [state-management.md](../../.claude/context/state-management.md)).
- [ ] Persistence subscriber writes the three keys through the storage
      adapter. Calendar draft state stays component-local.
- [ ] Persistence contract test: a UI mutation leads to storage that
      deep-equals the golden shape (extends batch 1.13 specs).
- [ ] Decide the open TBD: template as its own slice or a `settings` field.

## Acceptance criteria

- Full e2e suite + unit tests exit 0.
- Storage-contract specs pass unchanged (same keys, same shapes).

## Merge order and dependencies

Depends on 2b.9. Closes Phase 2b. Deployable: yes.

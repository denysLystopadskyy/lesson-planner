# Batch 2b.10 — State store (built-in reducer + context)

Phase 2b · [Plan home](README.md) · Prev: [2b.9](p2b-09-hash-routing.md) · Next: [3.1](p3-01-storage-guards.md)

## Goal

Application state moves into one store module built on `useReducer` and React
Context; persistence stays byte-compatible with the three keys. No state
library is added — see the migration triggers in
[state-management.md](../../.claude/context/state-management.md).

## Tasks

- [ ] Store module with typed actions and per-domain reducers: `groups`,
      `settings`, `template`.
- [ ] One provider at the app root; components read through selector hooks.
- [ ] Persistence subscriber writes the three keys through the storage
      adapter. Calendar draft state stays component-local.
- [ ] Persistence contract test: a UI mutation leads to storage that
      deep-equals the golden shape (extends batch 1.13 specs).
- [ ] Decide the open TBD: template in the main reducer or its own context.
- [ ] Confirm the Redux Toolkit migration triggers are recorded in
      [state-management.md](../../.claude/context/state-management.md).

## Acceptance criteria

- Full e2e suite + unit tests exit 0.
- Storage-contract specs pass unchanged (same keys, same shapes).
- `package.json` gains no new runtime dependency in this batch.

## Merge order and dependencies

Depends on 2b.9. Closes Phase 2b. Deployable: yes.

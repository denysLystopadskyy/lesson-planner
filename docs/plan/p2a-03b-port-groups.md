# Batch 2a.3b — Port slice 2: groups

Phase 2a · [Plan home](README.md) · Prev: [2a.3a](p2a-03a-port-shell-storage.md) · Next: [2a.3c](p2a-03c-port-calendar-overrides.md)

## Goal

Group CRUD works in the React app: add, open, edit info, delete.

## Tasks

- [ ] Port the group modal with its info display and edit form, the add and
      delete flows, and their confirmations. Logic largely as-is; one `<App>`.
- [ ] Reproduce the frozen testids on the new markup.
- [ ] Tag the group-management specs `@ported` and green them against `/next/`.

## Acceptance criteria

- `npx playwright test --grep @ported` exit 0 (now includes group specs).
- Testid-contract spec passes against `/next/`.

## Merge order and dependencies

Depends on 2a.3a. Deployable: yes.

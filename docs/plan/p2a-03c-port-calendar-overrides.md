# Batch 2a.3c — Port slice 3: calendar and overrides

Phase 2a · [Plan home](README.md) · Prev: [2a.3b](p2a-03b-port-groups.md) · Next: [2a.3d](p2a-03d-port-template-message-csv.md)

## Goal

Schedule editing and monthly overrides work in the React app.

## Tasks

- [ ] Port the calendar editor (date toggling, weekday select, month
      navigation, bulk price, Done/Cancel) and the override rows with their
      totals. Keep the draft-vs-committed behavior exactly as today.
- [ ] Tag schedule and override specs `@ported`; green against `/next/`.
- [ ] Keep the pinned defects pinned: the port reproduces current behavior;
      fixes wait for Phase 3.

## Acceptance criteria

- `npx playwright test --grep @ported` exit 0 (now includes calendar and
  override specs, including aria snapshots).

## Merge order and dependencies

Depends on 2a.3b. Deployable: yes.

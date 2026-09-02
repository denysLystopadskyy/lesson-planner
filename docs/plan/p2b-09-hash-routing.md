# Batch 2b.9 — Hash routing

Phase 2b · [Plan home](README.md) · Prev: [2b.8](p2b-08-visual-regression.md) · Next: [2b.10](p2b-10-state-store.md)

## Goal

Views get URLs: the main screen and an open group become addressable, with
hash routes that work on GitHub Pages without a 404 fallback.

## Tasks

- [ ] Hash-based routes: `#/` (main), `#/group/<index>` (group modal open),
      `#/template` (template modal). Back button closes modals.
- [ ] Document the limitation: the group id is an array index today; a link
      can point at a different group after a CSV import reorders data. A
      stable id needs the Phase 4 schema change.
- [ ] Specs: deep-link opens the right view; back/forward behave.

## Acceptance criteria

- Full e2e suite exit 0, including the new routing specs.

## Merge order and dependencies

Depends on 2b.8. Deployable: yes.

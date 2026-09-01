# Batch 2b.6 — Replace emoji icons with SVG components

Phase 2b · [Plan home](README.md) · Prev: [2b.5](p2b-05-template-review-modals.md) · Next: [2b.7](p2b-07-styles-extraction.md)

## Goal

Remove OS-rendered emoji so every machine draws the same pixels — this
unblocks visual regression testing (user decision, 2026-08-20).

## Tasks

- [ ] Inline SVG icon components (per ADR 2 in
      [2b.1](p2b-01-logic-modules-adrs.md)) replace: calendar, receipt,
      pencil, clipboard, and the arrow glyphs.
- [ ] Every icon-only button gets an accessible name.
- [ ] No external requests; SVGs inline in the bundle.

## Acceptance criteria

- `grep` for the emoji code points over `app/src` returns nothing.
- Full e2e suite exit 0; aria snapshots updated where names changed.

## Merge order and dependencies

Depends on 2b.5. Blocks 2b.8 (visual baselines need stable icons).
Deployable: yes.

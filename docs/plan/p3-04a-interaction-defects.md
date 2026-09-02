# Batch 3.4a — Interaction defects (fixes DEF-008, DEF-009, DEF-011, DEF-012)

Phase 3 · [Plan home](README.md) · Prev: [3.3](p3-03-json-backup.md) · Next: [3.4b](p3-04b-csv-clipboard-defects.md)

## Goal

Editing behaves honestly: Cancel cancels, Escape asks, "Copied!" is true.

## Tasks (TDD: each fix removes its fixme flag)

- [ ] Cancel reverts the default-price change (DEF-008) and no longer loses
      an unsaved name edit (DEF-009).
- [ ] Escape during calendar editing asks before discarding changes
      (DEF-012).
- [ ] The copy button reports success only after the clipboard write resolves;
      failure shows a readable error (DEF-011).
- [ ] Decide DEF-010 (cross-month price bleed) with the product owner: fix or
      declare intended; record the decision in the registry.

## Acceptance criteria

- DEF-008, DEF-009, DEF-011, DEF-012 specs pass without fixme flags.
- Visual and aria baselines refreshed where dialogs changed.

## Merge order and dependencies

Depends on 2b.10. Parallel-safe with 3.2/3.5. Deployable: yes.

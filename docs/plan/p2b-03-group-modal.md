# Batch 2b.3 — Components: group modal with dialog semantics

Phase 2b · [Plan home](README.md) · Prev: [2b.2](p2b-02-toolbar-group-list.md) · Next: [2b.4](p2b-04-calendar-editor.md)

## Inherited defect

**DEF-023** — an open dialog neither takes focus nor keeps it. Measured in batch
[2b.2](p2b-02-toolbar-group-list.md): opening a group from the keyboard leaves
focus on the card behind the overlay; three tabs walk the dialog's controls and
the fourth leaves for the toolbar, while `aria-modal="true"` tells a screen
reader that everything behind is unavailable. Pinned in
`group-card-keyboard.spec.ts`; this batch removes the flag in the same PR as the
fix. It needs focus moved into the dialog on open, a Tab cycle that stays
inside, and focus returned to the control that opened it — the last part already
works, by accident, because nothing takes focus away in the first place.

## Goal

The group modal becomes a real dialog: focus is trapped, Escape closes,
focus returns to the trigger.

## Tasks

- [ ] `GroupModal` on the native `<dialog>` element (or equivalent with
      `role="dialog"`, `aria-modal`, labelled title).
- [ ] Focus management: initial focus, trap, restore on close.
- [ ] Aria snapshot of the open dialog.

## Acceptance criteria

- Full e2e suite exit 0.
- Keyboard-only spec: open, edit name, save, close — all without a mouse.

## Merge order and dependencies

Depends on 2b.2. Deployable: yes.

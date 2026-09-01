# Batch 2b.3 — Components: group modal with dialog semantics

Phase 2b · [Plan home](README.md) · Prev: [2b.2](p2b-02-toolbar-group-list.md) · Next: [2b.4](p2b-04-calendar-editor.md)

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

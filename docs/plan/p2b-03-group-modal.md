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

- [x] `GroupModal` on the native `<dialog>` element — and the other two
      dialogs with it, see below.
- [x] Focus management: initial focus, trap, restore on close.
- [x] Aria snapshot of the open dialog — already asserted by
      `visual-layout.spec.ts` and `group-management.spec.ts`, both still green
      against the new element.

## Native `<dialog>`, and all three at once

The batch names the group modal; the fix went to all three, because DEF-023 is
one defect and half-fixing it would leave a pin nobody could honestly remove.
`Dialog.tsx` is the shared shell — 30 lines around `showModal()` — and
[2b.5](p2b-05-template-review-modals.md) inherits the template and review
dialogs already sitting on it.

`showModal()` buys three things a hand-rolled trap has to earn:

- focus moves into the dialog, and Tab cycles inside it;
- **everything behind becomes inert** — not merely covered. That is what
  `aria-modal="true"` had been claiming while three tabs walked the dialog and
  the fourth landed on the toolbar;
- Escape arrives as the platform's `cancel` event.

Two things it does not buy, both found by running the tests rather than by
reading the spec:

1. **The browser's focus restore never runs**, because React unmounts the
   dialog instead of closing it — by the time any cleanup fires the element is
   leaving the document. `Dialog.tsx` remembers the opener and puts focus back
   itself.
2. **The card was replaced on rename**, so there was nothing to restore focus
   to. `GroupList` keyed each card by `${name}-${index}`, which changes exactly
   when the name does. Keyed by position now, which is what a group's identity
   is today anyway.

## What the tab cycle really does

Worth writing down, because the first version of the test asserted something
false. Chromium's cycle inside a modal dialog is: the dialog's controls, then
**one stop on `<body>`**, then back to the first control. The test allows that
stop rather than asserting it away — it is not focusable content, nothing is
announced there, and the next Tab returns. What it asserts is that no control
_behind the overlay_ is ever reached, which is what DEF-023 was.

## One baseline moved, on purpose

`group-dialog.png`, by 126 pixels: the dialog now takes focus, so its first
control wears a focus ring. Reviewed before regenerating — the diff is a ring
around the pencil and nothing else. The other six screens are unchanged.

## Acceptance criteria

- [x] Full e2e suite exit 0: 330 passed with `--repeat-each=3`, 27 skipped.
- [x] Keyboard-only spec: open, edit name, save, close — all without a mouse.
      It asserts the form's tab order as a list rather than counting stops,
      after a first draft counted three tabs and pressed Enter on the currency
      select, which discards the edit rather than saving it.

## Merge order and dependencies

Depends on 2b.2. Deployable: yes.

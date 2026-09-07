# Batch 2b.5 — Components: template and review modals

Phase 2b · [Plan home](README.md) · Prev: [2b.4](p2b-04-calendar-editor.md) · Next: [2b.6](p2b-06-svg-icons.md)

## Goal

The remaining two modals become dialog components with the same semantics as
the group modal.

## Most of this arrived early

Batch [2b.3](p2b-03-group-modal.md) put **all three** dialogs on the native
`<dialog>` element in one go, not just the group one, because DEF-023 was a
single defect and fixing a third of it would have left a pin nobody could
honestly remove. So `Dialog.tsx` already gives these two the focus trap, the
Escape key, the backdrop click and the focus restore.

That left the half nobody had done: **asserting** that the behaviour really is
the same in all three, and driving the copy flow without a mouse.

## Tasks

- [x] ~~`TemplateModal` and `ReviewModal` components; dialog semantics; focus
      management; consistent close behavior (including overlay click, which
      today works only on the group modal)~~ — landed in
      [2b.3](p2b-03-group-modal.md); asserted here.
- [x] ~~Aria snapshots for both~~ — `template-editing.spec.ts` and
      `payment-messages.spec.ts` have had them since batches 1.4 and 1.5, and
      both were re-anchored on the dialog panel in
      [2a.3d](p2a-03d-port-template-message-csv.md).

## What this batch actually added

`template-review-dialogs.spec.ts`, six tests, every one passing first time —
which is the evidence that 2b.3's shared shell did what it claimed rather than
what it said:

- **A backdrop click closes the template editor** and leaves the stored template
  alone. The batch page said this "today works only on the group modal", which
  was true when the page was written.
- **A backdrop click closes the review dialog and leaves the group dialog
  open.** Closing the top dialog must not close the one that opened it — the
  case that hand-rolled Escape handling got wrong before 2b.3 (DEF-018).
- **The template editor opens with the caret in the text.**
- **The whole copy flow, keyboard only:** Enter on a month row's copy control,
  read the message, Tab past Cancel to Copy & Close, Enter — then the clipboard
  holds the message and focus is back on the row's copy button, so the next
  month is one Tab away. This is the app's purpose, and it is the first spec to
  drive it without a mouse.
- **Editing and saving the template, keyboard only.**

## Acceptance criteria

- [x] Full e2e suite exit 0: 375 passed with `--repeat-each=3`, 27 skipped.
- [x] Keyboard-only copy flow spec passes.
- [x] No screenshot baseline changed.

## Merge order and dependencies

Depends on 2b.4. Deployable: yes.

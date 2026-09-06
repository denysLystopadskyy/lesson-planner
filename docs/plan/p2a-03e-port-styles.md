# Batch 2a.3e — Port slice 5: the stylesheet, verbatim

Phase 2a · [Plan home](README.md) · Prev: [2a.3d](p2a-03d-port-template-message-csv.md) · Next: [2a.4](p2a-04-cutover.md)

## Why this batch exists

It was not in the plan. The plan put styles in
[2b.7](p2b-07-styles-extraction.md), seven batches **after** the cutover, which
means the cutover would have replaced the teacher's app with an unstyled page
and left it that way for the whole of Phase 2b. Screenshots of both apps made
that concrete, and the owner chose to bring the styles forward rather than ship
the regression (decision, 2026-09-06).

The port had no stylesheet at all. Every slice from 2a.3a to 2a.3d was judged on
behaviour, and the suite is behavioural, so nothing failed and nothing said so.

## Goal

The React build looks like the app it replaces, so the cutover is a change of
implementation and not a change the teacher can see.

## Tasks

- [x] Copy the `<style>` block from `index.html` into `app/src/styles.css`
      **verbatim**, and import it from `main.tsx`.
- [x] Give the ported markup the class names and wrappers those rules expect.
- [x] Compare both apps side by side and record what still differs.

## Verbatim, and why that is the whole point

The file is a copy. It is excluded from Prettier for the same reason
`index.html` is: formatting it would make it impossible to diff against its
source, and that diff is the only check that it is still a copy.

[2b.7](p2b-07-styles-extraction.md) does the real work — split the rules per
component under the 2b.1 ADR, introduce colour tokens, fix the contrast failures
the research catalogued, delete the dead rules. Doing any of that here would put
a visual change inside the batch that moves the app, which is what every port
slice has avoided.

## What the markup needed

The rules are selector-based, so the port had to offer the same selectors:

- `primary` and `danger` on the buttons that carry them (+ Add Group, Save,
  Done, Clear All Data, Clear Month, Delete Group);
- the group dialog's `group-info-container` / `group-info-wrapper` /
  `icon-button` shape, the form's `field`, `price-details-container` and
  `form-actions` wrappers, and the `group-modal-footer`;
- the calendar's `#calendar-container` and `#price-setter-container` blocks,
  which the legacy page styles inline rather than by rule.

Inline styles were copied as inline styles. They are ugly and they are what the
source does; 2b.7 replaces them with rules.

## One difference left on purpose

**The toolbar sits below the title instead of beside it.** The legacy page puts
the five buttons _inside_ the `<h1>` and lays them out with
`h1 { display: flex; justify-content: space-between }`. The port keeps them in a
sibling `<div class="toolbar">`, so the heading's accessible name is the heading
and not five button labels. Restoring the single row belongs to
[2b.2](p2b-02-toolbar-group-list.md), which gives the header its own rule.
Putting buttons back inside a heading to satisfy a stylesheet would undo an
improvement to satisfy a copy.

## A test came back

`group-form-exits.spec.ts` — "clicking the overlay discards the edit" was
legacy-only in [2a.3d](p2a-03d-port-template-message-csv.md), because without
CSS the overlay wrapped the panel tightly and had no backdrop to click. With the
stylesheet it is a full-screen backdrop, the test is tagged `@ported`, and it
passes against both apps.

## A second focus-stealing timer, found by the repeat run

`--repeat-each=3` failed once in the **legacy** project: raising the default
price did not cascade into the current and future months. It passed twelve times
in isolation and only ever failed under four workers.

`enterGroupInfoEdit` ends with `setTimeout(() => groupNameInput.focus(), 0)`.
Under load that tick lands inside `fill()` of the price field: the value is set,
but the field never ends up focused, so it never blurs, so its `change` never
fires — and `updateDefaultPrice` is bound to that event. The save then stores
the new default with none of the months following it.

`GroupModal.enterEditMode()` now waits for the name field to take focus, the
same fix and the same reasoning as `openAddGroupModal` in batch 1.10. Two full
`--repeat-each=3` runs clean afterwards. This is the second timer of this shape;
the first cost half a day in 1.10.

## Acceptance criteria

- [x] `npx playwright test` exit 0 across both projects with `--repeat-each=3`.
- [x] Side-by-side screenshots of the group dialog with the same data show no
      difference beyond the toolbar row noted above.
- [x] `app/src/styles.css` differs from the `<style>` block in `index.html` only
      by the header comment and the removed indentation.

## Merge order and dependencies

Depends on 2a.3d. Blocks 2a.4 — the cutover should not ship a visible
regression. Deployable: yes.

# Batch 2b.4 — Components: calendar editor, keyboard-operable

Phase 2b · [Plan home](README.md) · Prev: [2b.3](p2b-03-group-modal.md) · Next: [2b.5](p2b-05-template-review-modals.md)

## Goal

The calendar becomes usable without a mouse — the largest accessibility gap
in the app.

## Tasks

- [ ] `CalendarEditor` component: grid semantics, day cells focusable, arrow
      keys move, Space/Enter toggles, weekday headers operable.
- [ ] Visible focus indicator that meets contrast requirements.
- [ ] Update the calendar aria snapshot.

## Acceptance criteria

- Full e2e suite exit 0.
- Keyboard-only spec: enter edit mode, select two dates, set a price, Done.

## Merge order and dependencies

Depends on 2b.3. Deployable: yes.

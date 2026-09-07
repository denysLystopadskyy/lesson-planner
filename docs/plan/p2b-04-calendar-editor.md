# Batch 2b.4 — Components: calendar editor, keyboard-operable

Phase 2b · [Plan home](README.md) · Prev: [2b.3](p2b-03-group-modal.md) · Next: [2b.5](p2b-05-template-review-modals.md)

## Goal

The calendar becomes usable without a mouse — the largest accessibility gap
in the app.

## Tasks

- [x] `CalendarEditor` component: grid semantics, day cells focusable, arrow
      keys move, Space/Enter toggles, weekday headers operable.
- [x] Visible focus indicator that meets contrast requirements.
- [x] Update the calendar aria snapshot.

## The shape, and the two it is not

Three designs were written and judged before anything was built. The chosen one
is the WAI-ARIA date-grid pattern: `#calendar-grid` is a `role="grid"`, the
weekday row is a `row` of seven named `columnheader`s, `#calendar` is a
`rowgroup` whose week rows are real `row` nodes, and every day cell is a
`gridcell` carrying `aria-selected`, its full date as an accessible name, and
`aria-current="date"` on today.

| Rejected                                 | Why                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Each day cell a `<button aria-pressed>`  | the stylesheet's element-level `button` rule bit two previous batches, and here it also loses the hover background: `button.day { all: unset }` ties `button:hover` on specificity and the cascade order decides it. An undeclared regression for a keyboard win that the grid gets anyway |
| A real `<table>` with `<th scope="col">` | the honest AX-tree shape, and it moves both screenshot baselines. It also puts the `<th>`s inside `.calendar`, where `.calendar .weekend` would start painting the Saturday and Sunday headings, which it does not today                                                                   |

**No rendered pixel moved.** The week rows are `display: contents`, so they are
nodes in the accessibility tree and no boxes in the layout — the cells keep
their place in the seven-column grid. That was the design's declared risk and a
judge measured it away with a scratch probe in this repo's own Chromium before
implementation, which is what
[testing.md](../../.claude/context/testing.md) asks for: verify a control at
runtime rather than reading the source.

The wrapper takes an `id` and deliberately no class, for the `.calendar
.weekend` reason above.

## The keyboard model

One tab stop for the whole grid — thirty to thirty-seven cells cannot each be
one — with a roving tabindex that the arrows move.

| Key                  | Does                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Left / Right         | ±1 day, **clamped inside the month**                                                               |
| Up / Down            | ±7 days, clamped; Up from the top row reaches that column's heading                                |
| Home / End           | the ends of the focused week                                                                       |
| Ctrl+Home / Ctrl+End | the ends of the month                                                                              |
| Page Up / Page Down  | the previous or next month, keeping the day number and clamping it — 31 March, Page Down, 30 April |
| Space / Enter        | toggles the focused date, or on a heading selects every date of that weekday                       |

**Arrows clamp rather than spilling into the next month, on purpose.** A spill
re-renders the grid under the key press, and focus then has to be restored to a
cell that did not exist a moment earlier — the class of timing bug that cost
batch 1.10 half a day. Page Up and Page Down change the month explicitly, and
they set the roving stop before calling the same `step()` the arrow buttons use.

The roving stop also follows focus arriving any other way. Without that, a user
who clicked the 20th and then pressed an arrow would jump back to wherever the
stop began — which is exactly what three of this batch's own tests caught.

Opening the editor moves focus to the entry cell: the first selected date in the
month, else today, else the 1st. Without it focus falls to `<body>`, because the
pencil that had focus unmounts and `#monthlySection` is hidden. It costs no
baseline, because Chromium does not paint a `:focus-visible` ring when the last
interaction was a mouse click.

## Bulk selection is reachable, and the trade-off is real

The seven headings are in the grid's roving scope, reached by arrowing up off
the top row, and each is named "Select all Mondays in this month" so the action
is announced when focus lands. A visually hidden hint on the focused cell says
the keys.

The alternative was seven plain tab stops before the grid — reachable in every
assistive-technology mode with nothing to discover, at the cost of seven extra
stops every time anyone tabs to the calendar. Selecting individual dates is the
primary task and bulk weekday selection is a convenience, so the stops went to
the primary task. Whether the ArrowUp route is discoverable enough in a real
screen reader is a question this suite cannot answer — Playwright reads its own
DOM-derived tree, not a browse-mode cursor — and it is routed to
[3.6](p3-06-a11y-verification.md) rather than claimed here.

## A live contrast failure, found and not fixed here

**DEF-024** — a selected day is `#fff` on `#4caf50` at 16px/600: **2.78:1**,
where WCAG 2.2 AA 1.4.3 asks 4.5:1. Every selected date in the calendar is below
the standard, and selecting dates is what the calendar is for. All three design
proposals noticed the accent fails 3:1 as a _ring_ colour; none noticed it fails
4.5:1 as _text_.

Deliberately not fixed in this batch: [2b.7](p2b-07-styles-extraction.md) owns
colour tokens, and a colour change here would have ridden a baseline
regeneration for a reason unrelated to the keyboard work. Registered with the
measured ratio and listed as a task on 2b.7.

The focus ring is `#0f172a` — 17.06:1 on the container and 6.42:1 on a selected
day's green, so it clears 1.4.11 on either fill.

## Acceptance criteria

- [x] Full e2e suite exit 0: 360 passed with `--repeat-each=3`, 27 skipped.
- [x] Keyboard-only spec: enter edit mode, select two dates, set a price, Done —
      in `calendar-keyboard.spec.ts`, which also covers the tab stop, every
      arrow boundary, Home/End, paging with day clamping, the headings, and the
      focus ring's computed colour.
- [x] No screenshot baseline changed.

## Two things the tests had to be told

- **Seed a group with no dates.** `pendingDates` starts from every date the
  group holds in _every_ month, and the bulk price input is disabled only while
  that set is empty — so a group with dates opens the editor with one extra tab
  stop and the tab-order assertion is wrong by one.
- **June 2026 has no leading spacers.** The clock is pinned to 2026-06-15 and
  that month starts on a Monday, so nothing in the suite rendered a `.spacer`
  until this batch paged to March 2026 to cover it.

## Merge order and dependencies

Depends on 2b.3. Deployable: yes.

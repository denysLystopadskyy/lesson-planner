# Batch 1.9 — Coverage: schedule and calendar

Phase 1 · [Plan home](README.md) · Prev: [1.8](p1-08-coverage-groups.md) · Next: [1.10](p1-10-coverage-overrides-pricing.md)

## Goal

Cover calendar editing with state-transition and boundary techniques, and pin
the calendar structure with an aria snapshot.

## Test design (technique named per group)

- **State transition testing:** overview → edit mode → Done / Cancel / Escape;
  month navigation inside edit mode; the Escape-discards-silently path is
  pinned as DEF-012 (desired: confirm before discard).
- **Boundary value analysis — month and year:** December → January, January →
  December, year input minimum and a malformed year (pins DEF-002).
- **Equivalence partitioning — weekday header select:** all days on, all off,
  mixed month.
- **Aria snapshot:** the calendar grid structure (`toMatchAriaSnapshot`).

## Tasks

- [x] BDD specs per technique group, clock controlled (fixed date).
- [x] Aria snapshot stored and reviewed.

## What landed

| File                                     | Technique                                | Tests         |
| ---------------------------------------- | ---------------------------------------- | ------------- |
| `calendar-edit-transitions.spec.ts`      | State transition testing                 | 4, one pinned |
| `calendar-navigation-boundaries.spec.ts` | Boundary value analysis                  | 4, one pinned |
| `calendar-weekday-partitions.spec.ts`    | Equivalence partitioning + grid snapshot | 4             |

The page object gained the three navigation controls it was missing —
`prevMonthButton`, `nextMonthButton` and `todayButton`.

Every one of these tests depends on the clock pin from batch
[1.5](p1-05-feature-specs-2.md). The editor opens on whatever month the app
thinks it is, so `monthSelect` is asserted as `5` and the year as `2026`, and
`Today` is asserted to return there. Without the pin none of that could be
written down.

## The two pins, both verified by removing the flag

- **DEF-012** — Escape during editing. Unpinned, the test reports that no
  confirmation appeared at all: the whole group dialog closes and the pending
  selection is gone silently.
- **DEF-002** — the malformed year, and it is worse than the registry said.
  Typing `5` into the year is accepted as-is; the day cells then carry dates
  like `5-06-01`, and saving writes **that whole date in as the month key**.
  The registry described it as "month keys like `5-08-10`", which is right about
  the shape but easy to read as a short year. It is a complete ISO date sitting
  where a `YYYY-MM` key belongs, which is why the app's own CSV export cannot be
  re-imported afterwards. The entry now says so.

## What the weekday header actually does

Worth writing down, because it is not a toggle. With **none** of a weekday
selected it selects all of them; with **all** selected it clears them; with
**some** selected it completes the set. So a user who deselects one Monday and
clicks "Mon" expecting to clear the rest gets the opposite. That is current
behaviour, tested as such, and not filed as a defect — but it is the kind of
thing worth a second look during the React port.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0 — only fixme specs skip.

## Merge order and dependencies

Depends on 1.7. Parallel development with 1.8–1.13, sequential merge.
Deployable: yes.

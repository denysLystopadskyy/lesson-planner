# Batch 1.10 — Coverage: monthly overrides and pricing

Phase 1 · [Plan home](README.md) · Prev: [1.9](p1-09-coverage-schedule-calendar.md) · Next: [1.11](p1-11-coverage-message-template.md)

## Goal

Cover the money math and pin the known pricing defects.

## Test design (technique named per group)

- **Decision table — effective price:** default price vs month override vs
  bulk "set price for selected dates", across current and future months.
- **Boundary value analysis — price input:** 0, 0.01, large, empty.
- **Pinned defects:** cross-month price bleed (DEF-010, desired behavior:
  a price applies only to the visible month); price cascade after a default
  price change (DEF-008 / DEF-009 interactions).
- **Aria snapshot:** the month-override rows.

## Tasks

- [x] BDD specs per group; totals asserted against computed values.
- [x] `test.fixme` pin for DEF-010. **DEF-008 and DEF-009 are pinned in batch
      [1.8](p1-08-coverage-groups.md)**, not repeated here — a defect wants one
      pin, not two that can drift apart. Their interaction with the cascade is
      covered by the decision table below.

## What landed

| File                             | Technique                       | Tests         |
| -------------------------------- | ------------------------------- | ------------- |
| `pricing-decision-table.spec.ts` | Decision table + row snapshot   | 4             |
| `pricing-bulk-scope.spec.ts`     | Scope + boundary value analysis | 7, one pinned |

## The cascade rule, written down

`updateDefaultPrice` rewrites a month override only when **both** hold: the
month is not in the past, and its price still equals the **old** default. The
decision table asserts all four combinations against one fixture:

| Month             | Override price | Cascades? |
| ----------------- | -------------- | --------- |
| 2026-05 (past)    | old default    | no        |
| 2026-06 (current) | old default    | yes       |
| 2026-07 (future)  | old default    | yes       |
| 2026-08 (future)  | custom         | no        |

That last row is the important one: a month the teacher has deliberately priced
is never overwritten by a later default change.

## DEF-010, verified

Pick a date in June, move to July, pick another, set a bulk price. Only July is
on screen, but both months are repriced — unpinned, the test reports June
jumping from 100 to 777. `setBulkPrice` collects every month holding a selected
date and writes the price into all of them.

The registry marks this **decision needed** rather than simply "fix". The
desired behaviour in the pin is "only the visible month", which is the reading
that matches what a user can see; if the owner decides the bleed is intended,
the pin changes rather than the app.

## A dead guard found on the way

`setBulkPrice` opens with `if (isNaN(newPrice)) return`, which reads like
protection against an empty box. It is not: `Number("")` is `0`, so clearing the
field prices the month at **zero** and the guard never fires. It only catches
text that a `number` input would not accept anyway.

Tested as current behaviour and not filed as a defect, because whether an empty
box should mean "free" or "leave it alone" is a product question. It belongs
with the other two open pricing questions from batch
[1.8](p1-08-coverage-groups.md) — negative prices, and the blank-name fallback.

## A flake, and its real cause

The first full-suite stability run after these specs landed failed about half
the time, in a different test each run and never in isolation. The instinct —
"tests got slower, raise a timeout" — would have been wrong.

Instrumenting the assertion to dump storage on failure gave it away in one run:

```
stored groups were [{"name":"Price the smallest fraction0.01","price":0,...}]
```

The price text had landed in the **name** field. `openGroupModal` ends with
`setTimeout(() => groupNameInput.focus(), 100)`, so the app pulls focus back to
the name box a tenth of a second after the dialog appears. A test that opens the
dialog and fills two fields quickly can be part-way through the second when that
fires. Under load the timing shifted enough to hit it; alone, it never did.

`PlannerPage.openAddGroupModal` now waits for the name field to take focus
before returning — the app's own signal that the timeout has run, so no sleep
and no race. Verified with eight high-pressure runs of the spec that failed most
often, then five consecutive full-suite `--repeat-each=3` runs, all clean.

Worth noting for the React port: a dialog that grabs focus 100 ms after opening
is awkward for a fast typist too, not only for a test.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.

## Merge order and dependencies

Depends on 1.7. Parallel development, sequential merge. Deployable: yes.

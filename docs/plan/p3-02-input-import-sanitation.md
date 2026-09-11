# Batch 3.2 — Input and import sanitation (fixes DEF-002, DEF-020)

Phase 3 · [Plan home](README.md) · Prev: [3.1](p3-01-storage-guards.md) · Next: [3.3](p3-03-json-backup.md)

## Goal

No user input and no imported file can put a number into the data model that
the app cannot read back.

## Why this page was rewritten

It was titled "fixes DEF-002, DEF-003" and its criteria named DEF-003 and
DEF-014. Both closed with the cutover in [2a.4](p2a-04-cutover.md): the React
port falls back to a default currency, and React escapes by construction. Their
half of the old gate was already green. Meanwhile the
[registry](def-registry.md) routes **DEF-020** here and the old page never
mentioned it — the one piece of real work carried no gate at all.

## Tasks (TDD: each test fails for its stated reason first)

- [x] **DEF-002** — the year input cannot commit a year the calendar cannot
      use. `MIN_YEAR`/`MAX_YEAR` and `isSupportedYear` live in `schedule.ts`
      beside the rest of the calendar arithmetic.
- [x] **DEF-020** — a price cell that is not a number refuses the file and names
      the cell, instead of importing as `0`.
- [x] Remove the `test.fixme` from the DEF-002 spec.
- [x] DEF-014 stays a standing guard, not new work: `grep -r
dangerouslySetInnerHTML app/src` returns nothing and there is no sink to
      close. Recorded so a later reader does not mistake a green check for work.

## Two decisions worth recording

**The year input keeps a draft.** A controlled `value={String(year)}` cannot be
made safe by clamping, because every keystroke would have to commit and typing
"2026" passes through "2", "20" and "202" — committing a partial year _is_ the
defect. So the field holds its own text while it is being edited, commits only
a usable year, and returns to the last good one when focus leaves.

**An unreadable price refuses the whole file, not the row.** The unit test
written in 2b.1 anticipated "rejects the row". Refusing one row is worse here:
import replaces everything, so a partial import is silent data loss wearing a
different hat. Refusing outright is also what `deserializeCsv` already does for
a month it cannot read, so the file gains no second convention. `null` still
means the cell was **empty**, which is a real value meaning "no override for
this month" — blank and unreadable were the same answer before, and separating
them is most of the fix.

## One visual change, on purpose

`min` and `max` on an `<input type="number">` tell Chromium how many digits the
field can hold, so the year input is now sized to its four digits instead of the
browser default. It was about 155px and is now about 60px, and the row of month
controls closes up around it. The screenshot below is the whole difference.

It is kept rather than avoided. The attributes are not decoration: they give the
native spinner correct bounds and let assistive technology announce the range,
which is work [3.6](p3-06-a11y-verification.md) would otherwise have to do. A
field sized to its content is also the more honest rendering. Baselines are
refreshed in this PR — the macOS set locally, the Linux set through
`baselines.yml`, since this machine has no container runtime.

## Acceptance criteria

- [x] Typing a one-digit year and saving leaves every stored month key matching
      `^\d{4}-\d{2}$`. Fails on the pre-batch code with the key `"5-06-01"` — a
      whole ISO date where a `YYYY-MM` key belongs.
- [x] `isSupportedYear` rejects both bounds' neighbours, a non-integer year, and
      what an empty input parses to (`0`), and accepts the current year.
- [x] Importing `250,50` or `1 200` in either price column refuses the file
      **and leaves the existing groups in place**. Before this batch both were
      accepted and replaced every group with a price of `0`.
- [x] The refusal message names the row, the column, and what a price should
      look like. "Unable to load CSV" alone leaves the teacher hunting.
- [x] A file the app itself wrote still imports: dot decimals, integers, and an
      empty month price meaning "use the group default".
- [x] DEF-002 and DEF-020 marked closed in the [registry](def-registry.md).
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0.

## Merge order and dependencies

Depends on 2b.10. Parallel-safe with 3.4a and 3.5. Blocks 3.4b. Deployable: yes.

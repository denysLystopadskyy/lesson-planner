# Batch 3.4b — CSV and data-reset defects (fixes DEF-004, DEF-006, DEF-007, DEF-013)

Phase 3 · [Plan home](README.md) · Prev: [3.4a](p3-04a-interaction-defects.md) · Next: [3.5](p3-05-pii-template-cleanup.md)

## Goal

The CSV path stops being able to destroy data, and "Clear all" clears all.

This page needed no rewriting: it is the one Phase 3 batch whose title, tasks
and registry rows already agreed.

## Tasks

- [x] **DEF-004** — import asks before replacing, and snapshots first.
- [x] **DEF-006** — a mis-quoted field is refused instead of silently glued
      together.
- [x] **DEF-007** — the export starts with a UTF-8 byte order mark.
- [x] **DEF-013** — "Clear all data" removes the payment template too, and the
      warning says so.
- [x] Remove the four `test.fixme` pins. **The suite now has none left.**

## DEF-006 was the worst row in the registry

`"a"b"c"` has every quote balanced, so the parser's only check — that no quote
is left open at end of file — was satisfied, and the three parts were glued
into `abc`. Import replaces everything, so a file of nonsense replaced every
group with one named `abc`, silently, and the only copy of the data was the one
it had just overwritten.

RFC 4180 says a closing quote must be followed by a delimiter, a line break, or
the end of the file. The parser now says so too, and it rejects the mirror case
as well: a quote part-way through an _unquoted_ field, which turned `Ab"cd"`
into `Abcd` by the same mechanism from the other side.

## DEF-004 reuses what 3.3 built

Import replacing everything without asking is the same danger the JSON backup
import had, so it gets the same three steps: preview both sides, ask, snapshot
to `<key>.pre-import.<epoch>` with an Undo. Nothing new was written for it
beyond the wording.

The preview says one extra thing: **a CSV never carries the payment template,
so yours is kept.** Without that line a restore looks complete when it is not,
which is DEF-005's shape reappearing at the moment the user is least able to
check.

## DEF-013, and the one key that is deliberately not cleared

The template survived a wipe the user had been told could not be undone. That
is wrong in both directions: someone clearing their data to hand the browser on
left their bank details behind, and someone clearing it to start fresh found the
old message still there with no way to explain it.

The reducer changed with the adapter, because state and storage have to agree —
keeping the template in state would show the old message in the editor until the
next reload, after the app had said it was gone.

`groupLessonPlannerLastBackup` is **not** cleared. It records when this browser
last saved a file; the file itself is elsewhere and still exists, so forgetting
it was made would be a lie in the other direction.

## What one confirmation cost

Adding the DEF-004 prompt broke five specs that were passing, in four files that
have nothing to do with this batch. They were not wrong — they encoded "import
just happens", which was the defect. Each needed a decision about whether it
tests the _question_ or the _outcome_; the round trips and the valid-file cases
now answer yes, and the one spec whose subject is the question keeps both
branches.

The BOM had the same shape. `parseCsv(serializeCsv(x))` broke because the first
header cell became `﻿Name`. A `bodyOf()` helper strips it, so the BOM is
asserted **once, in its own test**, instead of three invisible bytes appearing in
front of every expected string.

## CI caught a race this machine could not

The DEF-004 test passed here and failed on its first CI run. `setInputFiles`
resolves as soon as the file is attached, but the confirm comes later, out of
`FileReader.onload` — so an assertion straight after the import races the
reader, and only a slower machine loses that race.

The fix is the one [testing.md](../../.claude/context/testing.md) requires:
_waits must key on a signal the app emits, never on elapsed time._ The test now
waits on the dialog **event**. The shared `importText` helper had the same shape
— a `waitForTimeout(300)` covering "a rejected import shows a dialog; an
accepted one shows none" — and that premise stopped being true in this batch,
because after DEF-004 every import shows one. It waits on the event too, and the
two assertions that relied on the sleep to see a completed write are now polled.

`grep -rn waitForTimeout e2e/` returns nothing, and the four affected specs pass
`--repeat-each=3`.

## Acceptance criteria

- [x] Importing over existing data asks first, and declining keeps every group.
- [x] `"a"b"c"` is refused and the existing data survives. So is `Ab"cd"`.
- [x] A properly quoted field containing a comma and a doubled quote still
      parses — the refusals must not overreach.
- [x] The export starts with `﻿`, and the app reads its own export back
      with the mark present.
- [x] "Clear all data" removes all three keys, leaves the backup key, and its
      warning names the template.
- [x] DEF-004, DEF-006, DEF-007 and DEF-013 marked closed in the
      [registry](def-registry.md).
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0 — **165 passed, 0 skipped**.
- [x] No elapsed-time waits remain in `e2e/`, and the specs this batch touched
      pass `--repeat-each=3`.

## Merge order and dependencies

Depends on [3.2](p3-02-input-import-sanitation.md). Deployable: yes.

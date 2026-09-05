# Batch 1.2 — Land the test-hook version of index.html

Phase 1 · [Plan home](README.md) · Prev: [1.1](p1-01-toolchain-bootstrap.md) · Next: [1.3](p1-03-scaffold-core.md)

## Goal

Commit the diverged working copy of `index.html` (1,491 lines), which adds the
test hooks the test suite needs and one modal fix.

## Tasks

- [x] Commit the working-copy `index.html`: 8 `data-testid` attributes,
      6 dataset attributes, and the `hidden`-based modal visibility fix.
- [x] Name the behavior change in the PR: closed modals leave the tab order
      and the accessibility tree. This is a fix, and it lands untested — the
      smoke spec that covers it arrives in batch 1.3.
- [x] Run the manual smoke checklist below on the live page after merge.
- [x] Note: line numbers in the research reports refer to the old 1,473-line
      file. The research index already warns about this drift.
- [x] Register the side effect the ticket did not name: the modal fade is gone
      (DEF-016, see below).

## Manual smoke checklist

1. Open the live page. Add a group. The card appears.
2. Open the group. Edit the schedule. Select two dates. Press Done.
3. Copy the payment message. The review window opens; Copy works.
4. Press Escape. The modal closes. Tab does not reach hidden dialogs.
5. Save CSV downloads a file. Load CSV restores it.

### Result — run twice, both green

The checklist was driven in a real browser, not read through by eye. Once
against `http://localhost:4173` serving this commit, and again against the
deployed page once the merge had published it. Pages built commit `5f91510` in
48 s, after which the live page served the 1,491-line file with the `[hidden]`
rule present. Both runs were green.

| #   | Step                   | Result                                                                                                          |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Add a group            | pass — card appears, `groupName` / `groupIndex` set on it                                                       |
| 2   | Select two dates, Done | pass — month row shows 2 lessons, correct total and per-lesson price, `monthKey` set                            |
| 3   | Copy payment message   | pass — review modal opens, 449-char message, month and total substituted, closes after its deliberate 1 s delay |
| 4   | Escape, then Tab       | pass — see the measurement below                                                                                |
| 5   | Save CSV / Load CSV    | pass — export, wipe, re-import restores name, price, currency and both dates                                    |

Step 4 is the one this batch exists for, so it was measured rather than eyeballed.
With every modal closed, of the 30 focusable controls in the document only **5**
are reachable by Tab — the five toolbar buttons — and **0** of them sit inside a
modal. The deployed page gave the identical 30 / 5 / 0 result. Before this
change all three dialogs stayed in the tab order and the accessibility tree
while invisible.

Step 3 could not verify the clipboard _contents_: the browser blocks
`navigator.clipboard.readText()` without a user gesture. The button path and the
modal lifecycle were verified; the clipboard write itself is already covered by
DEF-011.

## Side effect: the modal fade is gone (DEF-016)

`.modal-overlay` carries `transition: opacity 0.2s ease-in-out`. The fix sets
`hidden` in the same synchronous block that toggles the `show` class, so the
browser never gets an intermediate style recalculation and the transition never
runs. Measured: on open, opacity is already `1` three milliseconds in; on close
it is already `0` with `display: none` two milliseconds in. Modals now snap
instead of fading, in both directions.

This is cosmetic and it is **not** a reason to hold the batch. It is recorded as
[DEF-016](def-registry.md), pinned by a spec in batch 1.3 and fixed in batch
3.4a, per the "known defects are pinned, not blessed" rule in
[testing.md](../../.claude/context/testing.md). The file is committed byte for
byte as the acceptance criteria require, so the fix belongs in its own batch.

One mitigating note for later: no transition makes the batch-2b.8 pixel
regression suite _more_ stable, not less.

## Acceptance criteria

- [x] The committed file equals the working copy byte for byte (`cmp` clean,
      59,604 bytes, 1,491 lines).
- [x] The diff against the old file stays within the known +30/−12 hunks
      (exactly +30/−12).
- [x] All five checklist steps pass on the deployed page.

The frozen contract from [testing.md](../../.claude/context/testing.md) was also
checked against the committed file: exactly the 8 named `data-testid` values and
exactly the 6 named dataset hooks, no more and no fewer. All 30 calendar day
cells carry `date`, `day` and `weekday` at runtime.

## Merge order and dependencies

Depends on 1.1. Merges before 1.3. Deployable: yes — this batch IS a deploy
(publishing is branch-based from `main`).

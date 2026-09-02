# Batch 1.2 — Land the test-hook version of index.html

Phase 1 · [Plan home](README.md) · Prev: [1.1](p1-01-toolchain-bootstrap.md) · Next: [1.3](p1-03-scaffold-core.md)

## Goal

Commit the diverged working copy of `index.html` (1,491 lines), which adds the
test hooks the test suite needs and one modal fix.

## Tasks

- [ ] Commit the working-copy `index.html`: 8 `data-testid` attributes,
      6 dataset attributes, and the `hidden`-based modal visibility fix.
- [ ] Name the behavior change in the PR: closed modals leave the tab order
      and the accessibility tree. This is a fix, and it lands untested — the
      smoke spec that covers it arrives in batch 1.3.
- [ ] Run the manual smoke checklist below on the live page after merge.
- [ ] Note: line numbers in the research reports refer to the old 1,473-line
      file. The research index already warns about this drift.

## Manual smoke checklist

1. Open the live page. Add a group. The card appears.
2. Open the group. Edit the schedule. Select two dates. Press Done.
3. Copy the payment message. The review window opens; Copy works.
4. Press Escape. The modal closes. Tab does not reach hidden dialogs.
5. Save CSV downloads a file. Load CSV restores it.

## Acceptance criteria

- The committed file equals the working copy byte for byte.
- The diff against the old file stays within the known +30/−12 hunks.
- All five checklist steps pass on the deployed page.

## Merge order and dependencies

Depends on 1.1. Merges before 1.3. Deployable: yes — this batch IS a deploy
(publishing is branch-based from `main`).

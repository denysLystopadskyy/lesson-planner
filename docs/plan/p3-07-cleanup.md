# Batch 3.7 — Cleanup

Phase 3 · [Plan home](README.md) · Prev: [3.6](p3-06-a11y-verification.md) · Next: [4.1](p4-01-database-options-doc.md)

## Goal

Remove what is dead, complete what is half-done, and document the app.

## Tasks

- [ ] Delete dead code and dead CSS listed in the research inventory (what
      the port did not already drop).
- [ ] Settle DEF-017: the inline month price input is rendered into
      `#monthlySection` by the same handler that hides that section, so no user
      can reach it. Either show the section during calendar editing, as the code
      comment intends, or delete the branch and keep the calendar's bulk price
      input as the only way to set a price. The contract spec asserts the hook as
      attached and hidden, so it will fail either way and force the choice.
- [ ] Fill the LICENSE copyright holder.
- [ ] Write a short `README.md` for the app: what it is, how to run, how to
      test, links to `docs/plan/` and `docs/research/`.
- [ ] Close every remaining TBD in the context files or convert it into a
      Phase 4 question.

## Acceptance criteria

- Full suite exit 0. No TBD left in `.claude/context/` that is not
  explicitly assigned to Phase 4.

## Merge order and dependencies

Last Phase 3 batch. Deployable: yes.

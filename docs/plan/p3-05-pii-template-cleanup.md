# Batch 3.5 — Personal data cleanup in the default template (DEF-015)

Phase 3 · [Plan home](README.md) · Prev: [3.4b](p3-04b-csv-clipboard-defects.md) · Next: [3.6](p3-06-a11y-verification.md)

## Goal

The shipped app no longer contains the owner's bank and tax identifiers.

Priority: **low** (user decision, 2026-08-20). The values are treated as
already public; see
[security-auth.md](../../.claude/context/security-auth.md).

## What is already done

The cutover in [2a.4](p2a-04-cutover.md) deleted `index.html`, which is where
the values were, and the React app's default template has carried neutral
placeholders since [2a.3d](p2a-03d-port-template-message-csv.md). The values
remain in git history.

## Tasks

- [x] ~~Replace the personal payment block in the default template with neutral
      placeholders~~ — done in 2a.3d.
- [ ] First-run help explaining how to fill the placeholders once in the
      template editor.
- [ ] Add a build check that fails when an IBAN-shaped string or a long digit
      run appears in `app/src` (same idea as the research gate).
- [ ] Golden-message fixtures already use a neutral template; confirm nothing
      else embeds the values.
- [ ] Record separately: cleaning git history is optional, needs a rewrite
      and a force push, and is the owner's decision. Not part of this batch.

## Acceptance criteria

- `grep` for the known value shapes over the repository working tree returns
  matches only in git history, not in tracked files.
- The generated message for a fresh user contains no personal identifiers.

## Merge order and dependencies

Depends on 2b.10. Parallel-safe with 3.2/3.4a. Deployable: yes.

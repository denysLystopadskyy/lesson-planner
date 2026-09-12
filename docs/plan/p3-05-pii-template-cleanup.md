# Batch 3.5 — Personal-data cleanup in the default template (closes DEF-015)

Phase 3 · [Plan home](README.md) · Prev: [3.4b](p3-04b-csv-clipboard-defects.md) · Next: [3.6](p3-06-a11y-verification.md)

## Goal

The shipped app contains none of the owner's bank or tax identifiers, a build
step keeps it that way, and the teacher is told how to supply her own.

Priority: **low** (user decision, 2026-08-20). The values are treated as already
public; see [security-auth.md](../../.claude/context/security-auth.md).

## Why this page was rewritten

Both of its acceptance criteria were **already satisfied before the batch
started**. The cutover in [2a.4](p2a-04-cutover.md) deleted the file holding the
values, and the React default template has carried neutral placeholders since
[2a.3d](p2a-03d-port-template-message-csv.md). Meanwhile the two pieces of real
work — first-run help and a build check — had no gate at all.

## What the placeholders cost, and what this batch does about it

Shipping `<recipient>` and `<account>` blank is the right trade: the alternative
was shipping somebody's real IBAN in public source. It leaves a quieter problem
behind. `generateMonthlyPaymentMessage` substitutes `{{month}}`, `{{lessons}}`
and `{{total}}` and **does not touch the two angle-bracket placeholders**, so a
message still carrying `<account>` looks finished, copies cleanly, and reaches a
parent who cannot pay it. Nothing said so.

Two places can see it, and both now do:

- **The template editor**, where it is fixed once. The hint names the
  placeholders still present and follows the text as she types, so it goes away
  when it is answered rather than after a save.
- **The review dialog**, which is the last screen before the text leaves the
  app. This covers the case the editor cannot: she never opened the editor.

Neither appears for a teacher who wrote her own template — a warning that shows
on every message is one she stops reading before the day it matters.

## The build check, and why it matches shapes

`npm run check:pii` runs `scripts/check-no-personal-data.mjs` over every tracked
file in `app/src`, `e2e` and `scripts`. It fails on an IBAN-shaped string
(`XX00` plus 11–30 alphanumerics) or a run of ten or more digits.

**It never contains the values it guards.** The obvious script greps for the
owner's actual IBAN, and that script cannot be committed: it would put the value
back into the repository it exists to keep it out of, in the one file whose
purpose advertises what it holds.

**It self-tests on every run.** This check passes on a clean tree by design, so
on its own it says nothing about whether it still works — one bad regex edit and
it would pass forever while catching nothing. `--self-test` asserts four shapes
it must catch (published IBAN test vectors and invented digits) and six it must
not (a date, a price, a hex colour, nine digits, the pinned image tag, a
formatted amount). It also ran against a planted probe during the batch and
failed as intended.

## Two additions beyond the page, recorded

**The review-dialog warning** is not on the original task list. It serves the
same goal from the other end — the placeholders never reaching a parent — and it
is four lines.

**`npm run typecheck:app` and `npm run check:pii` were added to CI.** Blocked at
first on a token scope, landed on 2026-09-12. See the section below.

## The two CI steps, blocked and then landed

The original push was rejected:

```
refusing to allow an OAuth App to create or update workflow
`.github/workflows/ci.yml` without `workflow` scope
```

That is a permission boundary, not a problem to route around, so the rest of the
batch shipped without it and the change was recorded here instead. The owner
granted the scope on 2026-09-12 and the two steps landed in a follow-up PR.

Both now run in CI, after `npm run typecheck`:

- **`npm run check:pii`** — this batch's own gate.
- **`npm run typecheck:app`** — a separate hole, and the one that mattered more.
  The root `tsconfig.json` includes only `e2e/**` and `playwright.config.ts`, so
  CI's `typecheck` step never looked at `app/src` — where nearly every change in
  Phase 3 landed. **A type error in the app could not turn a PR red**, and
  `deploy.yml` was the only thing that would have caught it, after merge. Phase
  3 was carried by running it by hand on every batch, which is compensating for
  a hole rather than closing it.

## What CI found that this machine could not

The first run of `check:pii` in CI failed, and not on personal data:

```
fatal: detected dubious ownership in repository at '/__w/lesson-planner/lesson-planner'
```

The script asked `git ls-files` for the set of tracked files. The job runs in
the pinned Playwright container, where the checkout is owned by a different user
than the one running the step, so git refuses — and the check died on a
condition with nothing to do with what it exists to catch. It had passed here
every time, because this machine's git is ordinary.

**The fix is not `safe.directory` in the workflow.** A check that keeps bank
details out of a public repository should not stop working because git config is
unusual; it should run from a fresh clone, a container, a pre-commit hook, or a
copied directory. It now walks the filesystem itself and depends on nothing —
verified by running it with `git` removed from `PATH`.

The cost is that an untracked file under the scanned directories is scanned too.
That is the right direction to err: a local scratch file holding an IBAN is worth
a warning, and the alternative is a check that goes quiet in exactly the
environment it most needs to work in. The file count is unchanged at 119, so the
walk and `git ls-files` agree on this tree.

## Git history stays open, on purpose

Cleaning it needs a history rewrite and a force push, which invalidates every
existing clone and every commit SHA cited in `docs/research/`. Nothing in the
plan depends on it, and the build check deliberately reads the working tree
only. Recorded in
[security-auth.md](../../.claude/context/security-auth.md) as the owner's
separate, optional decision.

## Acceptance criteria

- [x] `npm run check:pii` exits 0 on the tree, exits 1 on a planted probe, and
      passes its own self-test.
- [x] The check runs in CI (landed 2026-09-12, once the token had `workflow`
      scope — see above).
- [x] A fresh planner shows the placeholder hint in the template editor, naming
      only the placeholders still present.
- [x] A message generated from the shipped default warns in the review dialog.
- [x] A teacher with her own template sees neither.
- [x] The generated message for a fresh user contains no personal identifiers —
      it contains the placeholders, which is what the warnings are about.
- [x] DEF-015 stays closed, with its registry note updated to name the check.
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0 — 170 passed, 0 skipped.

Visual baselines unchanged: the visual fixtures use a custom template, so the
hint correctly does not render in them.

## Merge order and dependencies

Depends on 2b.10. Parallel-safe with 3.2 and 3.4a. Deployable: yes.

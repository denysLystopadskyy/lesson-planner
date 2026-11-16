# Batch DEF-031 — The TDD evidence check skips merged batch pages

Phase T (follow-up) · [Plan home](README.md) · Prev: [T.3](pt-03-tdd-evidence-check.md) · Next: none

## Goal

A pull request can edit the page of an already-merged batch without the
`tdd-evidence` job failing. The job runs only the Red rows that belong to the
pull request's own commits, and it reports the Red rows of merged batches as
skipped. It still fails a pull request that changes production code and brings
no Red row of its own.

## Test basis

- [DEF-031](def-registry.md) — the defect: the job runs the Red rows of every
  batch page the pull request changes, and a merged batch's Red commits are not
  on the new branch. Found in batch [6.2](p6-02-remote-store.md).
- **Owner decision, 2026-11-16: the fix skips merged pages.** Only Red rows
  whose commit is among the branch's own commits are run and judged. A Red row
  that is already on the base is skipped and reported, not failed. A page with
  no Red row of its own follows the existing rules.
- [testing.md §1.5](../../.claude/context/testing.md#15-how-we-develop-tdd-and-bdd)
  — the red commit rule and how the job works.
- [T.3](pt-03-tdd-evidence-check.md) — how the check was built. The code is in
  `scripts/check-tdd-evidence.mjs`, its tests in
  `scripts/check-tdd-evidence.test.mjs`.
- The repository's merge style: every pull request is squash-merged, so
  `main` has no merge commits. This decides what "already on the base" means
  (see "Decided here" below).

## Product risks

This batch changes a CI check, not the app. No product risk R1–R8 in
[testing.md §1.8](../../.claude/context/testing.md#18-product-risks) is touched.
These are the risks of the change itself:

| Risk                                                                                                               | Likelihood | Impact | Risk level | Effect on testing                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| The new skip rule passes a branch that has no Red evidence (a false pass), for example by reusing a merged Red row | 2          | 3      | 6 (high)   | A decision table on every placement; the "no Red row of its own" rule has its own cases; fault seeding table  |
| The check still fails a good pull request that edits a merged page (the defect stays)                              | 2          | 1      | 2          | A seeded scratch repository for the git layer, and this pull request's own run (it edits the merged T.3 page) |
| The page-name rule lets a file be taken for a batch page that is not one (`def-registry.md`)                       | 1          | 2      | 2          | Equivalence partitioning on page names, one invalid value per case                                            |

The first risk is rated high because the check exists to stop a false pass.
A false failure is cheap; a false pass is the harm. So the fault seeding table
below is required, as for a high product risk.

## Entry criteria

- [x] [T.3](pt-03-tdd-evidence-check.md) is merged. This batch changes its
      script and tests.
- [x] The test basis is written down above, and the owner decision is dated.
- [x] The batch can meet its exit criteria with what it ships: the job runs on
      this pull request, and the pull request edits a merged page (T.3's) on
      purpose, so the live run is the confirmation test.
- [ ] DEF-031 is on `main`. **It is not yet.** It is in pull request #91
      (batch 6.2). Closing the row waits for that merge (see Results).

## Test conditions

| ID  | Test condition                                                              | Test level / type                         | Technique                             | Coverage items                                                                                                                                                                                                    | File                                         |
| --- | --------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| C1  | Which changed files are batch pages (the defect pages are new)              | component testing, functional             | equivalence partitioning              | 3 partitions: `def-<number>-<name>.md` is a page; `def-registry.md` is not; `def-<letters>-<name>.md` is not                                                                                                      | `scripts/check-tdd-evidence.test.mjs`        |
| C2  | Where one Red commit stands: the branch, the base, or neither               | component testing, functional             | decision table testing                | 8 rules: every combination of "the page on the base records the row", "the commit is on the base", "the commit is on the branch"                                                                                  | same                                         |
| C3  | How a Red row is matched with the page on the base                          | component testing, functional             | equivalence partitioning              | 6 partitions: no page on the base; a page with an exception; a page with other Red rows; the same row, same length; the page's short SHA and a full SHA; the page's full SHA and a short SHA                      | same                                         |
| C4  | What the check decides when Red rows have a place                           | component testing, functional             | decision table testing                | 6 rules: R7 run the branch rows; R8 fail on a row on neither; R9a, R9b and R9c: only base rows follow the old rules (fail, review, fail on "docs only"); R10 a mix runs the branch rows and reports the base rows | same                                         |
| C5  | The git layer finds the place, runs only the branch rows, and reports skips | component integration testing, functional | fault seeding on scratch repositories | 6 seeded repositories W1–W6 (table below)                                                                                                                                                                         | `main()` in `scripts/check-tdd-evidence.mjs` |
| C6  | The `tdd-evidence` job passes this pull request, which edits a merged page  | system integration testing, functional    | —                                     | 1: this pull request. Before the fix, the same job fails any such pull request (DEF-031). The run after the fix is the confirmation test                                                                          | `.github/workflows/ci.yml`                   |

The existing conditions C3–C6 of T.3 (`parseTddLog`, `parseCommand`, the old
rules R1–R6, `judgeRedRun`, `judgeGreenRun`) are not changed. Their 80 tests
are the regression suite; one assertion in the old R7 tests changes because the
result gains a `skipped` list.

### The cases, as a decision table

One Red row is placed by `placeRedRow`. The rows of the TDD log of every
changed batch page are placed before `decide` runs.

| Rule | The page on the base records this Red row | The commit is on the base | The commit is on the branch | Place   | What the job does                         |
| ---- | ----------------------------------------- | ------------------------- | --------------------------- | ------- | ----------------------------------------- |
| P1   | no                                        | no                        | yes                         | branch  | runs it: red at its commit, green at head |
| P2   | no                                        | yes                       | yes or no                   | base    | skips it and says so                      |
| P3   | yes                                       | yes or no                 | yes or no                   | base    | skips it and says so                      |
| P4   | no                                        | no                        | no (or no such commit)      | neither | fails, as before                          |

Then `decide` reads the places. R1–R6 are the rules of T.3 and stay as they are.

| Rule | Production code changed | Red rows, by place                   | Other pages                         | Result                                               |
| ---- | ----------------------- | ------------------------------------ | ----------------------------------- | ---------------------------------------------------- |
| R7   | yes                     | all on the branch                    | –                                   | run them                                             |
| R8   | yes                     | at least one on neither              | –                                   | fail, and name the row                               |
| R9a  | yes                     | all on the base (the page is merged) | none have a Red row of their own    | fail: no Red row of its own (the same as R2 and R3)  |
| R9b  | yes                     | all on the base                      | one names a reviewed exception (R6) | review                                               |
| R9c  | yes                     | all on the base                      | one names "docs only" (R5)          | fail                                                 |
| R10  | yes                     | some on the branch, some on the base | –                                   | run the branch rows; report the base rows as skipped |

## What changed

- `scripts/check-tdd-evidence.mjs`:
  - `findBatchPages` also accepts `docs/plan/def-<number>-<name>.md`, the form of
    a defect follow-up batch. `def-registry.md` is still not a page.
  - New pure function `placeRedRow`: the place of one Red row (P1–P4).
  - `decide` reads the place of each Red row (R7–R10) and returns the skipped
    rows in a `skipped` list on every result.
  - `main()` reads each changed page at the base commit and at the head, places
    each Red row with git, and prints `–` lines for skipped rows. `verify` no
    longer checks where the commit is: `decide` already did.
- `scripts/check-tdd-evidence.test.mjs`: the new component tests, and the
  changed R7 assertions.
- [testing.md §1.5](../../.claude/context/testing.md#15-how-we-develop-tdd-and-bdd):
  the rule for the job.
- [T.3](pt-03-tdd-evidence-check.md): a note that this batch changes the rule
  "the red commit must be on the branch and not on the base".
- [def-registry.md](def-registry.md): DEF-031 closed (waits for pull request
  #91, see Results).

**Decided here: "already on the base" includes "the page on the base records it".**
The owner's words are that a Red row whose commit is already on the base is
skipped. The repository squash-merges every pull request, so the Red commit of a
merged batch is never on the base: the base holds one new squash commit, and the
Red commit exists only under `refs/pull/<n>/head`. Checked on 2026-11-16: the
Red commits of batch 6.1 are not ancestors of `main`, and the Red commits of
T.3 are not in a clone at all. A rule that looked only at commit ancestry would
fail those rows as "on neither", and DEF-031 would stay open.

So a Red row also counts as "on the base" when the same page at the base commit
already lists the same SHA in a Red row of its TDD log. That is the evidence
that the batch was merged with this row. A branch cannot fake it, because the
base page is read from the base commit. A Red row on neither place still
fails. The rule keeps the owner's intent: merged pages are skipped, and a Red
row nobody can account for still fails. **The owner may reject this
reading;** then only ancestry counts, and the second condition in `placeRedRow`
is the one line to remove (and DEF-031 reopens).

**Also decided here: a defect batch page is a batch page.** The page name the
plan gives this batch, `def-031-tdd-evidence-merged-pages.md`, did not match
the `p<phase>-<n>-…` form, so the job would have treated this pull request as
one with production code and no batch page. The pattern now also accepts
`def-<number>-…`.

## Tasks

- [x] Write this page and the hub row first.
- [x] Red: the new tests in `scripts/check-tdd-evidence.test.mjs`. The
      function `placeRedRow` is added as a stub that throws `not implemented`.
      Run them and see them fail for the stated reason.
- [x] Green: `findBatchPages`, `placeRedRow`, `decide`, `main()`.
- [x] Fault seeding: the table below, at component level and on scratch
      repositories.
- [x] Update testing.md §1.5 and the T.3 page.
- [ ] Close DEF-031 after pull request #91 is on `main`.
- [x] Run the checks and open one pull request into `main`.

## TDD log

| Step  | Commit    | Command                                                    | Result                               |
| ----- | --------- | ---------------------------------------------------------- | ------------------------------------ |
| Red   | `3a6ab0e` | `npm run test:unit -- scripts/check-tdd-evidence.test.mjs` | fails with: `Error: not implemented` |
| Green | `0d3a822` | `npm run test:unit -- scripts/check-tdd-evidence.test.mjs` | passes, 108 tests                    |

At the red commit, 25 of 108 tests fail and 83 pass. Seven fail on the stub's
`Error: not implemented`; the other 18 fail on an assertion, for example
`expected { status: 'run', runs: [ { …(5) } ] } to match object { status: 'fail', …(1) }`.
The 83 that pass are 79 of the 80 old tests and 4 new guards for names that must
not count as batch pages (`def-registry.md` and three more). They pass before
the fix on purpose: they stop the new pattern from being too wide. The one old
test that fails is the old R7 assertion, which now also expects the `skipped`
list. The red commit also adds the stub `placeRedRow`, as §1.5 asks for new
code; it changes no other production line.

The Red row is on this branch and not on the base, so the job runs it. The
Green row is the commit that makes it pass.

## Acceptance criteria

- [x] **Given** a pull request that edits the page of a merged batch and changes
      production code with a Red commit of its own, **when** the job runs,
      **then** it runs the new Red row, lists the merged page's Red rows as
      skipped, and passes. (W2, and this pull request.)
- [x] **Given** a pull request that changes production code and edits only a
      merged batch's page, **when** the job runs, **then** it fails and says the
      pages have no Red row of their own. (W1.)
- [x] **Given** a Red row whose commit is not on the branch, not on the base,
      and not recorded on the page at the base, **when** the job runs, **then**
      it fails and names the row. (W3.)

## Exit criteria

- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit` exit 0 locally (2026-11-16). `test:e2e` is not
      run for this batch: only `scripts/`, tests and Markdown change. CI is
      advisory; its result is in Results.
- [x] Coverage: covered coverage items ÷ identified coverage items = 30 / 30
      (C1 3, C2 8, C3 6, C4 6, C5 6, C6 1).
- [x] The TDD log is complete.
- [ ] Every new anomaly has a DEF row or an explanation on this page. (DEF-031
      is closed after pull request #91 is on `main`.)
- [x] Counts: `test:unit` 571 (543 before this batch; 28 new tests, all in
      `scripts/check-tdd-evidence.test.mjs`, which now has 108). `test:e2e`
      not run.

## Confirmation and regression testing

**Confirmation testing (DEF-031).** DEF-031 has no `test.fixme` pin: the
registry says the desired rule was not decided, so no test could describe it.
The owner decided it on 2026-11-16, and the Red tests of this batch describe it.
They fail before the fix and pass after it. The second confirmation is the live
run: this pull request edits T.3's page, whose Red commits are not in the
clone, and the job must pass.

**Regression testing.** The 80 existing component tests of the check run
unchanged, except the R7 assertions named above. Impact analysis: the change
touches `decide`, `findBatchPages` and `main()`. R1–R6 and the parsing and
judging functions are not changed, so their tests are the regression suite. The
app, the API and the database are not touched, so `test:e2e` has nothing new to
catch.

## Fault seeding

The risk of a false pass is high, so the table is required. Part 1 breaks the
pure code and runs `npm run test:unit -- scripts/check-tdd-evidence.test.mjs`
(108 tests). Part 2 breaks nothing: it runs the real script, old and new, on
scratch git repositories that have the shape of a squash-merged base. Each seed
was applied alone, and the file was restored after each.

**Part 1: component level.**

| Seed | Defect put in on purpose                                                     | Tests that failed                                                                       |
| ---- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| S1   | A commit on the base counts as a branch commit (the owner's example)         | 2: `placeRedRow` rules "commit on the base: true", with and without "on the branch"     |
| S2   | The page on the base is ignored                                              | 5: the two P3 rules and the three "page records the row" partitions                     |
| S3   | A commit name must match exactly                                             | 2: the short-SHA and the full-SHA partitions                                            |
| S4   | Two commit names match when their first characters match                     | 1: "a page with other Red rows records nothing of this one"                             |
| S5   | A Red row that was not placed counts as on the branch (the check fails open) | 1: "R8: a red row that was not placed counts as on neither"                             |
| S6   | A row on neither is ignored instead of failing                               | 2: the two R8 failure tests                                                             |
| S7   | A page with only base rows passes                                            | 3: the three R9 tests                                                                   |
| S8   | Skipped rows are not reported                                                | 5: both R10 tests and the three R9 tests                                                |
| S9   | The base rows are run too (a merged batch is not skipped)                    | 5: both R10 tests and the three R9 tests                                                |
| S10  | `def-registry.md` counts as a batch page                                     | 5: the four "is not a batch page" tests and the old "drops the hub, the registers" test |
| S11  | A defect page does not count as a batch page                                 | 1: "keeps a defect batch page: def-<number>-<name>.md"                                  |

All 11 seeds were caught. S3, S4 and S5 are each caught by one or two tests, so
those partitions have no spare cover.

**Part 2: the git layer on scratch repositories (C5).** Each repository has a
merged page `p9-01-merged.md` on the base, whose Red SHA is in no commit, as
after a squash merge. The old script is `bec9b2d:scripts/check-tdd-evidence.mjs`,
run as a control.

| Seed | Branch                                                                                 | New script                                                               | Old script (control)                               |
| ---- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| W1   | Production code and an edited merged page; no Red row of its own                       | exit 1: "has no Red row of its own", merged row reported as skipped      | exit 1: "no such commit in this clone"             |
| W2   | The same, plus a `def-032-own.md` page with a real Red and Green commit (the defect)   | **exit 0**: merged row skipped; own row red at its commit, green at head | exit 1: "no such commit in this clone"             |
| W3   | The merged page gets a new Red row with a SHA that exists nowhere; an own page is fine | exit 1: names `1234567` as on neither the branch nor the base            | exit 1: "no such commit" for both rows             |
| W4   | An own page whose first Red row is a commit that is on the base                        | **exit 0**: that row skipped; the branch row runs                        | exit 1: "the commit is already on the base branch" |
| W5   | A docs-only edit of the merged page                                                    | exit 0: no production code changed                                       | exit 0                                             |
| W6   | An own page whose Red commit does not fail                                             | exit 1: "The command passed at the red commit"                           | exit 1: the same                                   |

W6 is the control for the old rules that stay: a Red commit that passes still
fails the job. In W3 the new script stops at the row on neither and does not run
the branch's own row; the old script ran it. The result is the same exit code and
a shorter log.

## Results

- **Commits** (2026-11-16): plan `fd01cec`, Red `3a6ab0e`, Green `0d3a822`.
- **Local checks:** `format:check`, `lint`, `typecheck`, `typecheck:app`,
  `typecheck:api` and `check:pii` exit 0. `test:unit`: 18 files, 571 tests
  passed.
- **The check on this branch, run by hand.** `BASE_SHA=<main> HEAD_SHA=<head>
node scripts/check-tdd-evidence.mjs`. This pull request edits the merged T.3
  page, so it is the live case of DEF-031. The output is in the section
  "The live run" below.
- **Confirmation testing:** the tests that describe DEF-031 (R7 to R10,
  `placeRedRow`) failed at `3a6ab0e` and pass at `0d3a822`. Wiring seed W2
  shows the old script failing the case and the new script passing it.
- **DEF-031 is not on `main` yet.** The row is in pull request #91 (batch 6.2).
  This page and the registry row are closed after that merge.

### What the fix does not do

- It does not run a merged batch's evidence again. If a merged batch's Red
  commit was wrong, this check will not find out. That was the owner's choice:
  the merge review owns it.
- The squash-merge reading of "on the base" is mine, not the owner's wording.
  It is under "Decided here" above, with the one line to remove.

## Merge order and dependencies

Depends on [T.3](pt-03-tdd-evidence-check.md). It runs in parallel with Phase 6
and needs nothing from it. DEF-031 reaches `main` with pull request #91
(batch 6.2); the row is closed after that merge.

Deployable: yes. Only a CI script, its tests and documents change. Nothing the
teacher uses is touched, and the app on GitHub Pages and on Vercel is the same
as before.

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

| ID  | Test condition                                                              | Test level / type                         | Technique                             | Coverage items                                                                                                                                                                                              | File                                         |
| --- | --------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| C1  | Which changed files are batch pages (the defect pages are new)              | component testing, functional             | equivalence partitioning              | 3 partitions: `def-<number>-<name>.md` is a page; `def-registry.md` is not; `def-<letters>-<name>.md` is not                                                                                                | `scripts/check-tdd-evidence.test.mjs`        |
| C2  | Where one Red commit stands: the branch, the base, or neither               | component testing, functional             | decision table testing                | 8 rules: every combination of "the page on the base records the row", "the commit is on the base", "the commit is on the branch"                                                                            | same                                         |
| C3  | How a Red row is matched with the page on the base                          | component testing, functional             | equivalence partitioning              | 6 partitions: no page on the base; a page with an exception; a page with other Red rows; the same row, same length; the page's short SHA and a full SHA; the page's full SHA and a short SHA                | same                                         |
| C4  | What the check decides when Red rows have a place                           | component testing, functional             | decision table testing                | 5 rules: R7 run the branch rows; R8 fail on a row on neither; R9 only base rows follow the old rules (3 cases: fail, review, fail on "docs only"); R10 a mix runs the branch rows and reports the base rows | same                                         |
| C5  | The git layer finds the place, runs only the branch rows, and reports skips | component integration testing, functional | fault seeding on scratch repositories | 5 seeded repositories (table below)                                                                                                                                                                         | `main()` in `scripts/check-tdd-evidence.mjs` |
| C6  | The `tdd-evidence` job passes this pull request, which edits a merged page  | system integration testing, functional    | —                                     | 1: this pull request. Before the fix, the same job fails any such pull request (DEF-031). The run after the fix is the confirmation test                                                                    | `.github/workflows/ci.yml`                   |

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
- [ ] Red: the new tests in `scripts/check-tdd-evidence.test.mjs`. The
      function `placeRedRow` is added as a stub that throws `not implemented`.
      Run them and see them fail for the stated reason.
- [ ] Green: `findBatchPages`, `placeRedRow`, `decide`, `main()`.
- [ ] Fault seeding: the table below, at component level and on scratch
      repositories.
- [ ] Update testing.md §1.5 and the T.3 page.
- [ ] Close DEF-031 after pull request #91 is on `main`.
- [ ] Run the checks and open one pull request into `main`.

## TDD log

_Filled after the red and green commits, below._

| Step  | Commit | Command | Result |
| ----- | ------ | ------- | ------ |
| Red   |        |         |        |
| Green |        |         |        |

## Acceptance criteria

- [ ] **Given** a pull request that edits the page of a merged batch and changes
      production code with a Red commit of its own, **when** the job runs,
      **then** it runs the new Red row, lists the merged page's Red rows as
      skipped, and passes.
- [ ] **Given** a pull request that changes production code and edits only a
      merged batch's page, **when** the job runs, **then** it fails and says the
      pages have no Red row of their own.
- [ ] **Given** a Red row whose commit is not on the branch, not on the base,
      and not recorded on the page at the base, **when** the job runs, **then**
      it fails and names the row.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit` exit 0 in CI. `test:e2e` is not run for this
      batch: only `scripts/`, tests and Markdown change.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _filled
      after Green_.
- [ ] The TDD log is complete.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _filled after Green_.

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

_Filled after Green._

| Defect put in on purpose | Result |
| ------------------------ | ------ |
|                          |        |

## Results

_Filled after Green._

## Merge order and dependencies

Depends on [T.3](pt-03-tdd-evidence-check.md). It runs in parallel with Phase 6
and needs nothing from it. DEF-031 reaches `main` with pull request #91
(batch 6.2); the row is closed after that merge.

Deployable: yes. Only a CI script, its tests and documents change. Nothing the
teacher uses is touched, and the app on GitHub Pages and on Vercel is the same
as before.

# Batch T.3 — A CI check for TDD evidence

Phase T · [Plan home](README.md) · Prev: [T.2](pt-02-project-settings-hook.md) · Next: [T.4](pt-04-rewrite-phase-1.md)

## Goal

CI checks that a code batch has a red commit that really fails for the stated
reason, or names an exception. This is the first batch that follows the red
commit rule itself, and the check runs on its own red commits.

## Test basis

- [testing.md §1.5](../../.claude/context/testing.md#15-how-we-develop-tdd-and-bdd)
  — the red commit rule, the new-module stub rule and the four exceptions.
- [RP-11 TDD verdict](../research/rp11-docs-process-review/tdd-verdict.md) —
  feature batches could not show their test order, and a check that only looks
  for a heading would be a fake check.
- The plan for this batch, written in [T.1](pt-01-test-strategy.md): the tasks
  and the three acceptance criteria below.

## Product risks

| Risk                                                                       | Likelihood | Impact | Risk level | Effect on testing                                                                    |
| -------------------------------------------------------------------------- | ---------- | ------ | ---------- | ------------------------------------------------------------------------------------ |
| The check passes a branch whose red commit does not fail (a false pass)    | 2          | 3      | 6          | Decision tables for the pure part; fault seeding for the git part                    |
| A command written on a page runs something harmful in CI                   | 1          | 3      | 3          | No shell, an allowlist of four prefixes, and a seeded injection (see the note below) |
| The check fails good branches, so people learn to ignore it (false alarms) | 2          | 2      | 4          | A control case in the fault seeding, and this pull request's own run                 |
| The red run makes CI slow (`npm ci` twice)                                 | 2          | 1      | 2          | A separate job with its own time limit; the time is measured below                   |

**What the allowlist does and does not stop.** It stops a command injected
through the page text: no shell runs it, and a word with a quote or a shell
character is refused. It does not limit the branch's own code. At the red
commit, `npm run test:unit` runs that commit's `package.json` scripts and
tests. That is no new exposure: the `checks` job already runs the branch's
code, and both jobs have only `contents: read`.

## Entry criteria

- [x] [T.2](pt-02-project-settings-hook.md) is written (this branch is stacked
      on it).
- [x] The test basis is written down above.
- [x] The batch can meet its exit criteria with what it ships: the check runs
      on this pull request, against this batch's own red commits.

## Test conditions

| ID  | Test condition                                                             | Test level / type                         | Technique                                        | Coverage items                                                                                                                      | File                                         |
| --- | -------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| C1  | Which changed files are production code                                    | component testing, functional             | equivalence partitioning                         | 11 partitions: 5 production (app/src, other app, api, db, scripts), 6 not (tests, config, JSON or Markdown, migrations, e2e, other) | `scripts/check-tdd-evidence.test.mjs`        |
| C2  | Which changed files are batch pages                                        | component testing, functional             | equivalence partitioning                         | 6 partitions: 2 batch page forms, the hub, the registers, the template, outside `docs/plan/`                                        | same                                         |
| C3  | How the TDD log section is read                                            | component testing, functional             | decision table testing                           | 7: the 6 rules in `parseTddLog`'s table, and "no section"                                                                           | same                                         |
| C4  | Which commands may run                                                     | component testing, functional             | equivalence partitioning, error guessing         | 7 partitions: 4 allowed prefixes; a wrong prefix, an unsafe word, an empty command. 8 guessed shell forms                           | same                                         |
| C5  | What the check decides                                                     | component testing, functional             | decision table testing                           | 7 rules, R1–R7                                                                                                                      | same                                         |
| C6  | How a red run and a green run are judged                                   | component testing, functional             | decision table testing, equivalence partitioning | 4 red rules, 2 green partitions                                                                                                     | same                                         |
| C7  | The git and process layer finds, runs and judges a red commit              | component integration testing, functional | fault seeding                                    | 9 seeded branches (table below)                                                                                                     | `main()` in `scripts/check-tdd-evidence.mjs` |
| C8  | The `tdd-evidence` job runs in the pinned container on a real pull request | system integration testing, functional    | —                                                | 1: this pull request                                                                                                                | `.github/workflows/ci.yml`                   |

## What changed

- `scripts/check-tdd-evidence.mjs` (new). Pure functions: `isProductionPath`,
  `findBatchPages`, `parseTddLog`, `parseCommand`, `decide`, `judgeRedRun`,
  `judgeGreenRun`. A thin `main()` does the git and process work.
- `scripts/check-tdd-evidence.test.mjs` (new): 80 component tests. Each
  `describe` title names its technique.
- `scripts/vitest.config.mjs` (new) and one line in the root
  `vitest.config.ts`: the scripts are the third project of `npm run test:unit`.
- `.github/workflows/ci.yml`: a `tdd-evidence` job, on pull requests only. It
  uses the same pinned container as `checks`, checks out the branch head (not
  the merge commit) with full history, and is advisory.
- [testing.md](../../.claude/context/testing.md) §1.5 describes the job and the
  log format it reads; §2 says there are three Vitest projects.
- [batch-template.md](batch-template.md): the TDD log note says to write the
  commit, the command and the message in backticks, and shows the exception
  form.
- CLAUDE.md: rule 3, the `scripts/` and workflow lines, and the `test:unit`
  row.

**Changed from the plan.** The plan said production code is `app/src/`, `api/`,
`db/` and `scripts/serve.mjs`. The check uses all of `app/` and all of
`scripts/`, without tests, configuration, JSON, Markdown and the generated
`db/migrations/`. `app/index.html` is served to the teacher, and the scripts
under `scripts/` are checks that CI trusts, this one included. A narrower rule
would have let this batch's own code change without a red commit.

**Decided here: the fact check stays out of CI.** [T.1](pt-01-test-strategy.md)
left this question to T.3. The fact check compares an old and a new version of
one page, so it means something only while a finished page is rewritten
(T.4–T.10). In CI it would fail every correct edit that removes a fact. Each
rewrite batch runs it and records the result on its page.

**A consequence for T.10.** No exception covers a comment-only change to
production code, so the job would fail T.10's two comment fixes in
`app/src/route.ts` and `app/src/types.ts`. They move to 6.1, which changes both
files with a red commit anyway. testing.md §1.5 marks the gap **TBD for the
owner**.

## TDD log

| Step  | Commit    | Command                                                    | Result                                                                                       |
| ----- | --------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Red   | `6fcb167` | `npm run test:unit -- scripts/check-tdd-evidence.test.mjs` | fails with: `Error: not implemented`                                                         |
| Green | `3769a3e` | `npm run test:unit -- scripts/check-tdd-evidence.test.mjs` | passes, 79 tests                                                                             |
| Red   | `adff1ad` | `npm run test:unit -- scripts/check-tdd-evidence.test.mjs` | fails with: `expected { kind: 'invalid', …(1) } to deeply equal { kind: 'exception', …(1) }` |
| Green | `e33cb3e` | `npm run test:unit -- scripts/check-tdd-evidence.test.mjs` | passes, 80 tests                                                                             |

The first red commit adds the module as a stub whose exports throw
`not implemented`, as §1.5 asks for a new module.

**The verify-red step found a weak test.** At the first red run, 68 tests failed
and 11 passed. The 11 were the refusal tests for `parseCommand`: they expected
`toThrow()`, and the stub throws for every input. They now expect the refusal
message, `command refused`, and all 79 failed before the red commit was made.

**The second cycle.** Writing the exception form into the template's note made
a defect possible: the parser took the first `**Exception: …**` in the section,
so the note's `<name>` would win over a real exception below it. The second red
commit adds that test case; the green commit reads an exception only at the
start of a line.

## Acceptance criteria

- [x] **Given** a pull request that changes production code and whose batch page
      has no TDD log, **when** the check runs, **then** it fails and names the
      missing log. (Fault seeding FS2.)
- [x] **Given** a TDD log whose red commit passes its own command, **when** the
      check runs, **then** it fails: the test did not fail first. (FS3.)
- [x] **Given** a docs-only pull request, **when** the check runs, **then** it
      passes and says no production code changed. (FS9.)
- [x] **Given** this pull request, **when** CI runs, **then** `tdd-evidence`
      runs both red commits and passes. (Run 39029747786.)

## Exit criteria

- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` and `test:unit` exit 0 locally.
- [x] Coverage: C1 11 / 11, C2 6 / 6, C3 7 / 7, C4 7 / 7, C5 7 / 7, C6 6 / 6,
      C7 9 / 9.
- [x] The TDD log is complete.
- [x] No new anomaly is left without an explanation on this page.
- [x] Counts: `test:unit` 454 (80 new); `test:e2e` unchanged.
- [ ] CI green, with the `tdd-evidence` job passing on this pull request.

## Confirmation and regression testing

Impact analysis: the batch adds a script, a Vitest project and a CI job. It
changes no file the app or the API loads. The full `test:unit` run covers the
other two Vitest projects, and the `checks` job runs the end-to-end suite
unchanged. The new job is separate, so a failure in it cannot hide a failure in
`checks`.

## Fault seeding

Each case is a branch made on purpose in a temporary worktree, with the base
`4783c1d` (T.2 before its rebase), the first red commit `c0eef01` and the first
green commit `c566a11`. These are the same commits before the rebase onto
`main`; they were local and were not pushed. The
script is `node scripts/check-tdd-evidence.mjs`, as CI runs it.

| ID  | Defect put in on purpose                                     | Result                                                                                |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| FS1 | Production code changed, no batch page changed               | exit 1: "No batch page changed, so there is no TDD log to check"                      |
| FS2 | The batch page has no `## TDD log` section                   | exit 1: `docs/plan/pt-03-tdd-evidence-check.md has no "## TDD log" section.`          |
| FS3 | The Red row names the green commit, where the command passes | exit 1: "The command passed at the red commit. A red commit must fail."               |
| FS4 | The Red row states a message the run does not print          | exit 1: "its output does not contain the stated message"                              |
| FS5 | The Red row names a commit on the base branch                | exit 1: "the commit is already on the base branch, not new here"                      |
| FS6 | The command ends with `; touch /tmp/tdd-pwned`               | exit 1: `command refused: "…test.mjs;" is not a plain word`; the file was not created |
| FS7 | The stated message is "Cannot find module"                   | exit 1: "is not an accepted red failure"                                              |
| FS8 | None: the true log (control case)                            | exit 0: the red commit fails with the stated message, and the command passes at head  |
| FS9 | None, on a branch that changes only the batch page           | exit 0: "No production code changed."                                                 |

## Results

- Local run, 2026-10-17: the nine fault seeding cases above, each with the
  expected exit code. FS8 ran `npm ci` in a temporary worktree at the red
  commit.
- The check reports a named exception and passes when the exception allows
  production code to change ("dead-code deletion", "tests for existing
  behaviour"). It does not claim to verify those; the owner reviews them.
- Local run of the whole branch, 2026-10-17, before the rebase onto `main`:
  `BASE_SHA=2a1d2bd HEAD_SHA=HEAD node scripts/check-tdd-evidence.mjs` ran
  both red commits and passed, exit 0, in 57 seconds. Most of the time is two
  `npm ci` runs, one for each red commit.
- **The first CI run of the job failed** (system integration testing, C8). It
  stopped before it read anything, with this message:
  `fatal: detected dubious ownership in repository at '/__w/lesson-planner/lesson-planner'`. In the Playwright
  container the workspace belongs to another user, and `actions/checkout` does
  not leave it marked safe for later steps. The `checks` job runs no git after
  checkout, so it never met this, and the local runs could not show it. Fixed
  in `a0224a7`: a step runs
  `git config --global --add safe.directory "$GITHUB_WORKSPACE"` before the
  script.
- **The CI run after the fix passed** (GitHub Actions run 39029747786, on
  `a0224a7`). The `tdd-evidence` job took 1 min 30 s. It ran both red commits
  in the pinned container: each failed with its stated message, and the same
  command passed at the head.

## Merge order and dependencies

Depends on [T.2](pt-02-project-settings-hook.md). Deployable: yes — nothing in
the app or the API changes.

# RP-11 — TDD and test style

[RP-11 home](rp11-docs-process-review.md) · Next: [AI setup](ai-setup.md)

## What the rules say

[testing.md](../../../.claude/context/testing.md) says, at `main` `a003ce0`:

- "New code and refactors follow TDD. Write the failing test first, then the
  code, then refactor." (lines 16–17). This is the only TDD rule. It does not
  say how a batch shows that the test failed first.
- "Spec style is BDD. Specs read as Given / When / Then." (lines 14–15).
- "ISTQB techniques are named in every coverage group … Write the technique
  name in the `describe` block." (lines 38–40).

## Verdict

**TDD is proven for defect fixes. For feature work it cannot be proven from the
repository. Nothing checks it.**

### Evidence for

- **Defect fixes were test-first.** The [DEF registry](../../plan/def-registry.md)
  has 26 closed rows. For 20 of them, a test that showed the defect landed in
  an earlier batch than the fix. Example: the DEF-002 test was added, marked
  `fixme`, in `7ddcad9` (2026-09-06), and the flag was removed with the fix in
  batch 3.2, `4fd40cc` (2026-09-11).
- **Phase 1 wrote tests before the rewrite.** Batches such as `341dbe6`,
  `6f20081` and `7cba001` change only `e2e/` and docs.
- **Tests are checked against seeded defects.** Several pages break the code on
  purpose and record which tests fail. In ISTQB terms this is **fault seeding**.
  Examples: [p5-06](../../plan/p5-06-allowlist-webhook.md) ("verification always
  true: 7 of 16 fail") and [p5-08](../../plan/p5-08-a-session-for-specs.md)
  ("stub removed: 6 specs fail").
- **Batch 5.8 made the suite ready before 5.7 changed the client**, so the
  test harness came first at the level of batches.

### Evidence against, or missing

- **One commit per batch.** Every `claude/p4-*` and `claude/p5-*` branch holds
  exactly one commit, and it is squash-merged. No commit is called "red",
  "failing test" or "test:". So the order of test and code inside a feature
  batch is **not recorded**. That makes it unknown, not proven wrong.
- **Two pages say the tests came after the code:**
  [p2b-01](../../plan/p2b-01-logic-modules-adrs.md) line 153 ("written against the
  module, then mutation-verified") and [p2b-03](../../plan/p2b-03-group-modal.md)
  line 83 (an issue found "not from a failing test, but from a person looking").
  For p2b-01 this is normal: those were tests of code that already existed.
- **A test was changed to match the code**:
  [p5-06](../../plan/p5-06-allowlist-webhook.md) lines 94–96. The spec expected
  401 and got 500; the code was right, so the spec changed. That is a correct
  decision, but it is test-after for that test case.
- **Pages 5.5–5.8 have no TDD section** and no record of a failing run. The
  "Tasks (TDD)" headings exist on early pages (3.1, 3.2) and on pages that have
  not run yet (6.1–6.3). Even 3.1 and 3.2 do not record the failing run.
- **No enforcement.** There is no pull request template, no hook and no CI step
  that checks test-first. `ci.yml` says "ADVISORY UNTIL MADE REQUIRED", and
  `main` has no branch protection, so even a red suite can merge (batch 5.4
  found this too).
- **One code batch had no test change:** 4.1 (`0a33da3`), which changed only
  `vercel.json` and `package.json`. As configuration, it needs a recorded
  exception rather than a test.

## BDD and the Screenplay layer

- **Given / When / Then exists only as `//` comments.** There are no `.feature`
  files and no `test.step` calls. **14 of the 38 specs have no Given / When /
  Then comment**, including `schedule-editing.spec.ts`, the example that
  testing.md itself names.
- **The Screenplay layer is used in 31 of 38 specs.** Five Phase 4/5 specs do
  not use it: `api-health`, `auth-webhook`, `moved-banner`, `response-headers`
  and `sign-in`. The first three call HTTP and have no user to act; `sign-in` is
  a UI spec and could use it.

## ISTQB techniques and terms

- **Techniques are named well in the tests.** In `e2e/`, 82 of 117 `describe`
  titles name a technique, and specs carry a header such as
  `ISTQB technique: boundary value analysis`. In `app/src`, nearly every
  `describe` names one (for example `schedule.test.ts`: 18 of 19).
- **The API tests mostly do not.** 4 of the 5 `api/*.test.ts` files name no
  technique: `db-seam`, `deployed-entry`, `health` and `one-function`. Only
  `webhook.test.ts` does ("equivalence partitioning and boundary values").
- **The process words are missing.** Across CLAUDE.md, `.claude/context/` and
  `docs/plan/`, these ISTQB terms appear **zero** times: test level, test basis,
  test condition, coverage item, entry criteria, exit criteria, confirmation
  testing, test oracle, definition of done. The pages use their own words
  instead:

  | Word used here                        | Count | ISTQB term                                              |
  | ------------------------------------- | ----- | ------------------------------------------------------- |
  | pin / pinned                          | 175   | a test case for a known defect, marked `test.fixme`     |
  | gate                                  | 94    | exit criteria; at a phase end, a **quality gate**       |
  | prove / proof / proven                | 92    | test result, evidence                                   |
  | Depends on (on 70 pages)              | —     | entry criteria                                          |
  | Deployable: yes                       | 69    | an exit criterion                                       |
  | "Break → Result" table                | —     | fault seeding                                           |
  | "removing the flag" after a fix       | —     | confirmation testing                                    |
  | "Layout is checked at three levels"   | —     | three kinds of check; not the ISTQB term _test level_  |

- **Batch "Acceptance criteria" mix two things.** Observed behaviour ("a refused
  file leaves the planner untouched") is acceptance criteria. Commands that must
  exit 0 and test counts are **exit criteria**.
- **There is no current test strategy.** [RP-03](../rp03-test-architecture/rp03-test-architecture.md)
  is the closest document, but it is dated 2026-08-20 and out of date: it
  rejected pixel checks, which the project later adopted, and its component
  test layer with React Testing Library was never built.
- **The DEF registry is not a full defect report.** Its columns are id, defect,
  pinned in, fixed in, status. ISTQB defect reports also hold severity,
  priority, the test object and environment, and expected and actual results.

## What would make TDD provable

The owner chose all three of these on 2026-10-17. They are built in phase T.

1. **A red commit on the branch.** A code batch branch holds a `Red:` commit
   (tests only, failing for the stated reason) before the `Green:` commit.
   GitHub keeps a pull request's own commits after a squash merge, under
   `refs/pull/<n>/head`, so the red commit can be run again later.
2. **A TDD log on the batch page**: the red commit, the command, the failure
   message, and the green commit — or a named exception (docs only,
   configuration only, deleting dead code, tests for existing behaviour before
   a refactor).
3. **A CI check** that checks out the red commit, runs the stated command, and
   expects it to fail with the stated message. A check that only looks for a
   "TDD" heading would be a fake check, which CLAUDE.md forbids.

# Testing — test strategy and test automation rules

Decisions about how this project tests. Referenced from
[CLAUDE.md](../../CLAUDE.md). Background:
[RP-03 test architecture](../../docs/research/rp03-test-architecture/rp03-test-architecture.md)
(2026-08-20; partly out of date) and the
[RP-11 review](../../docs/research/rp11-docs-process-review/tdd-verdict.md)
(2026-10-17), which led to Part 1.

**Two parts.** [Part 1](#part-1--test-strategy) is the test strategy: what we
test, at which test level, with which test technique, and when a batch is done.
[Part 2](#part-2--test-automation-rules) holds the rules for building and
running the tests. Many files point to rules in Part 2, so a rule stays in this
file when it is reworded.

**Terms.** Part 1 uses the terms of the ISTQB (International Software Testing
Qualifications Board): the Certified Tester Foundation Level (CTFL) v4.0.1, the
Advanced Level Test Analyst (CTAL-TA) v4.0, and the ISTQB Glossary 4.8.1. A
term is written as the glossary writes it, with one meaning only.

**Which skills to load, and when:** CLAUDE.md, "How we test and build", and
[agentic-setup.md](agentic-setup.md).

## Part 1 — Test strategy

Decided on 2026-10-17 (batch [T.1](../../docs/plan/pt-01-test-strategy.md)),
with the owner's choices recorded in
[RP-11](../../docs/research/rp11-docs-process-review/rp11-docs-process-review.md#what-happens-next).
The owner is the maintainer; the teacher is the app's one user.

### 1.1 Test objectives

1. **Find defects before the teacher meets them.** Her data lives in one
   browser. A defect that loses data or shows a wrong amount of money is the
   worst failure this app can have.
2. **Verify** that each batch meets its acceptance criteria. The owner and the
   teacher **validate** that the app still does what she needs.
3. **Keep regression risk low.** Every merge to `main` deploys to her.
4. **Leave evidence a reader can check**: commands, commit SHAs and counts on
   the batch page, never "it works".

### 1.2 Test levels

Name the test level and the test type of each test condition separately, in the
batch page's test conditions table (for example "system testing,
non-functional: accessibility").

| Test level                    | Test object here                                                       | Tool and files                                      |
| ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| Component testing             | One pure module (`schedule.ts`, `csv.ts`, `message.ts`, …)             | Vitest, `app/src/*.test.ts`                         |
| Component testing             | The compiled API entry, built the way Vercel builds it                 | Vitest, `api/deployed-entry.test.ts` (first block)  |
| Component integration testing | The Hono app with its handlers and an in-process database              | Vitest, `api/*.test.ts`, on PGlite                  |
| System testing                | The built app and the local API, in a browser and over HTTP            | Playwright, `e2e/features/*.spec.ts`                |
| System integration testing    | Our deployed function with Neon Auth, Neon Postgres, Google and Vercel | A person, on production; recorded on the batch page |
| Acceptance testing            | The owner's checklists, and the teacher's own use                      | A person; recorded on the batch page                |

- **`api/deployed-entry.test.ts` has two blocks.** The first compiles the entry
  and runs the build output, so its test object is one component: component
  testing. The second reads the entry's source and resolves each import, which
  is static analysis.
- There are **no component tests of React components** (no React Testing
  Library). RP-03 proposed them and they were never built. The behaviour of the
  user interface is tested at system level.
- **System integration testing is manual and small.**
  - A spec cannot sign in with Google
    ([Part 2 §2.9](#29-the-api-and-sign-in-in-tests)), so a person checks real
    Google sign-in on production.
  - Running the full suite against production triggers Vercel's DDoS
    protection ([deployment.md](deployment.md)).
  - Examples: batch [5.6](../../docs/plan/p5-06-allowlist-webhook.md) "Proven
    against a real Neon call", and the probe from batch
    [4.3b](../../docs/plan/p4-03b-deployment-probe.md).

### 1.3 Test types, change-related testing and static testing

**The four test types** (CTFL §2.2.2). Each one can be used at every test level.

- **Functional testing** — what the app does. At every level.
- **Non-functional testing** — how well it does it:
  - accessibility: axe scans in specs tagged `@a11y`, and the manual WCAG 2.2 AA
    checklist of batch [3.6](../../docs/plan/p3-06-a11y-verification.md);
  - visual layout: three kinds of check ([§2.6](#26-snapshots-and-layout-checks));
  - security: `response-headers.spec.ts` (the headers, and the
    Content-Security-Policy blocking an injected script), and the batch
    [5.4](../../docs/plan/p5-04-security-review.md) review checklist;
  - colour contrast: `contrast.test.ts` checks every colour token pair in
    `styles.css`. A token in no checked pair fails the suite, unless it has a
    written exemption.
  - There is **no performance testing** of the app. The suite has a runtime
    budget ([§2.11](#211-budgets-and-pointers)), and batch 5.7 recorded the
    bundle size.
- **Black-box testing** — tests derived from the specification, not the code.
  Most tests here are black-box; the techniques are in
  [§1.4](#14-test-techniques).
- **White-box testing** — tests derived from the code. No code coverage is
  measured. In this project "coverage" means the coverage items of a black-box
  or experience-based technique (§1.4), and the batch page names them.

**Change-related testing** (CTFL §2.2.3) is not a test type. It is testing after
a change:

- **confirmation testing** — after a defect fix, run the test for the known
  defect without its `test.fixme` flag; it passes ([§1.7](#17-defect-management));
- **regression testing** — the full unit and Playwright suites run in CI on
  every pull request, with `failOnFlakyTests` on. Impact analysis on the batch
  page says what else the change could break.

**Static testing** (CTFL chapter 3) finds defects without running the code:

- static analysis: ESLint, the three typechecks, Prettier, `npm run check:pii`,
  and the import check in `api/deployed-entry.test.ts`;
- reviews: the pull request review, and the owner's review of plan pages. A
  review can find a defect in the test basis before any code exists. Record it
  on the page that will fix it.

### 1.4 Test techniques

Choose the technique from the test basis. When one technique leaves gaps,
combine two. Use stronger coverage when the product risk is high
([§1.8](#18-product-risks)).

| When the test basis shows…                                    | Technique                | Coverage items                                   | Example here                                                 |
| ------------------------------------------------------------- | ------------------------ | ------------------------------------------------ | ------------------------------------------------------------ |
| Groups of values that behave the same (names, routes, files)  | Equivalence partitioning | Valid and invalid partitions                     | `group-name-partitions.spec.ts`, `route.test.ts`             |
| Ordered values with limits (price, year, day, month length)   | Boundary value analysis  | Boundary values (2-value; 3-value for high risk) | `group-price-boundaries.spec.ts`, `schedule.test.ts`         |
| An outcome that depends on a combination of conditions        | Decision table testing   | Feasible decision rules (columns)                | `pricing-decision-table.spec.ts`, `group-form-exits.spec.ts` |
| Behaviour that depends on earlier events                      | State transition testing | Valid transitions (0-switch); more for high risk | `calendar-edit-transitions.spec.ts`, `sign-in.spec.ts`       |
| A user journey with a main path and other paths               | Scenario-based testing   | Main scenario, extensions, exceptions            | `backup-round-trip.spec.ts`                                  |
| Stored entities that are created, read, changed and deleted   | CRUD testing             | Cells of the CRUD matrix                         | `group-regressions.spec.ts`                                  |
| Rules that repeat across the app (accessibility, contracts)   | Checklist-based testing  | Checklist items                                  | `a11y.spec.ts`                                               |
| Weak spots known from experience (CSV quotes, locale numbers) | Error guessing           | Listed failures                                  | `message.test.ts`, `csv-import-safety.spec.ts`               |

The first six are black-box techniques. The last two are experience-based
techniques. Short meanings:

- **Boundary value analysis (BVA):** test the smallest and largest value of
  each ordered partition. 2-value BVA tests the boundary and its neighbour
  outside; 3-value BVA also tests the neighbour inside.
- **Decision rule:** one column of a decision table — one combination of
  conditions and its outcome.
- **0-switch coverage:** every valid transition between two states is tested at
  least once. "All transitions" adds the invalid ones.
- **CRUD:** create, read, update, delete.
- **Defect masking:** one defect hides another, so a test passes or fails for
  the wrong reason.

Rules:

- **Write the technique name in the `describe` title** of every coverage group.
  This applies to API tests too; on 2026-10-17 `db-seam`, `deployed-entry` and
  `one-function` named none (RP-11).
  - A guard spec that checks a frozen contract is not a coverage group.
    `testid-contract.spec.ts` says so in its header and names no technique.
- **Put one invalid value in a test case**, to avoid defect masking.
- **The batch page lists the coverage items** before the tests are written.
  Coverage = covered coverage items ÷ identified coverage items. Report it as a
  number, such as "12 / 12".

### 1.5 How we develop: TDD and BDD

**New code and refactors follow test-driven development (TDD).** Write the test
first and see it fail for the stated reason (red). Write the smallest code that
makes it pass (green). Then improve the code while the tests stay green
(refactor).

**The red commit rule** (from 2026-10-17). A code batch branch keeps at least
two commits:

1. `Red: <test condition>` — the new or changed tests only. Run them; they fail
   for the reason the test states.
2. `Green: <what changed>` — the code that makes them pass. An optional
   `Refactor:` commit may follow.

This replaces the earlier habit of one commit per batch branch. The pull request
is still squash-merged. GitHub keeps the pull request's own commits under
`refs/pull/<n>/head`, so anyone can run the red commit again later.

**A new module in the red commit.** "Cannot find module" is not a failure for
the stated reason. So the red commit may add the new module as a stub: its
exported names and types, each function throwing `new Error("not implemented")`.
The test then fails on its own assertion or on that error, and the TDD log
records it.

**The TDD log on the batch page** records:

- the red commit SHA;
- the command that was run;
- the failure message, one to three lines;
- the green commit SHA.

**From batch T.3 (TBD), a CI check will** run the red commit again and expect
it to fail with that message. Until then, the owner checks the log in the pull
request.

**Named exceptions.** When no test can fail first, the TDD log names one of the
exceptions below. They are the owner's answer given in advance, so where
`superpowers:test-driven-development` says "ask your human partner", this list
decides. The owner reviews the named exception in the pull request. When a pull
request merges without the owner, the exception stays on the page and in the
pull request for a later review.

- **docs only** — no code changed;
- **configuration only** — for example `vercel.json` or a workflow; the batch
  page says how the change was checked instead;
- **dead-code deletion** — the code is read by nothing; the evidence is the
  search that shows it, and the full suites as regression testing;
- **tests for existing behaviour** — tests written for code that already exists,
  before a refactor. They must be shown to detect a defect: put a defect in on
  purpose and record which tests fail (fault seeding, [§1.7](#17-defect-management)).

**A fake check is forbidden** (CLAUDE.md). A fake check only asserts that a
string is present or absent — in a source file or on a batch page — with no
parsing, resolving or running. The import check in `api/deployed-entry.test.ts`
parses and resolves each import, so it is not a fake check.

**BDD.** We write acceptance criteria before the code — acceptance test-driven
development (ATDD) — in the Given / When / Then form of behavior-driven
development (BDD).

- The spec repeats them as `// Given`, `// When`, `// Then` comments.
- The spec file is named after a user scenario (for example
  `schedule-editing.spec.ts`).
- On 2026-10-17, 14 of 38 specs had no such comments (RP-11). Add them when a
  spec is changed for another reason.

**A spec that drives the user interface uses the Screenplay layer**
(`actor.attemptsTo(…)`). A spec that only calls HTTP, such as
`api-health.spec.ts`, does not need it.

### 1.6 Entry criteria and exit criteria

The batch page template is [batch-template.md](../../docs/plan/batch-template.md).

**Entry criteria for a batch:**

- every batch it depends on is merged;
- its test basis is written down on the page;
- it can meet its own exit criteria with only what it ships (the CLAUDE.md
  rule). If it cannot, move the file or move the criterion, and record which.

**Exit criteria for a batch** (all must hold before merge):

- `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
  `check:pii`, `test:unit` and `test:e2e` exit 0, in CI;
- every coverage item on the page is covered by a passing test;
- the TDD log is complete: a red commit, or a named exception;
- every new anomaly has a DEF row or a written explanation on the page;
- the acceptance criteria hold.

**Acceptance criteria and exit criteria are different things.** Acceptance
criteria describe behaviour a user can observe, in Given / When / Then.
Commands that must exit 0 and test counts are exit criteria. Older pages mix
them under one heading.

**A phase gate on the [plan hub](../../docs/plan/README.md) is a quality gate**:
the milestone where the phase's exit criteria decide whether the next phase
starts.

**Stopping with a known risk** is allowed only when the owner accepts it on the
batch page.

### 1.7 Defect management

**Words.** A person makes an **error**. The error leaves a **defect** in code or
in a document. When the code runs, the defect can cause a **failure**. An
**anomaly** is anything unexpected whose cause is not known yet. Analysis turns
it into a defect, a false-positive result, or a change request.

**The [DEF registry](../../docs/plan/def-registry.md) holds the defect reports.**
From batch T.1 each row also has:

- **Severity** — how much the defect affects the app:
  - **high**: data is lost or changed, a wrong amount of money is shown, or a
    person who is not allowed can sign in;
  - **medium**: a feature does not work, or a WCAG 2.2 AA criterion fails, but
    data is safe;
  - **low**: a cosmetic problem, or a wrong record in the documentation.
- **Priority** — how soon to fix it: **high** = the next batch; **medium** =
  within the current phase; **low** = when convenient.

Rows from before T.1 say "not recorded" in both columns. Never invent a value.

**A known defect gets a test that describes the desired behaviour**, marked
`test.fixme(true, 'DEF-xxx: <short reason>')`. Such a test never asserts the
defect as the expected result. Two cases differ:

- **When no test can describe the defect** (a record, a missing control, a
  colour that is only measured), the DEF row says why.
- **A component test under an e2e pin** asserts what the function does today,
  with a comment that names the DEF and the batch that fixes it
  ([§2.8](#28-known-defects-and-guard-specs)). The e2e spec holds the desired
  behaviour; the component test shows the fixing batch which assertion must
  change.

**Confirmation testing:** the batch that fixes the defect removes the
`test.fixme` flag in the same pull request as the fix, runs the test, and it
passes.

**Fault seeding:** put a defect into the code on purpose and record which tests
fail. The ISTQB Glossary also uses fault seeding to estimate how many defects
remain; here it is used only to show that a test can find a defect. Older pages
call this a "Break → Result" table. Use it for high-risk test conditions and for
tests written after the code.

### 1.8 Product risks

A risk level decides how strong the tests must be. Risk level = likelihood ×
impact, each rated 1 (low) to 3 (high).

| ID  | Product risk                                                                  | Likelihood | Impact | Risk level | What testing does                                                      |
| --- | ----------------------------------------------------------------------------- | ---------- | ------ | ---------- | ---------------------------------------------------------------------- |
| R1  | The payment message shows a wrong total, price or month                       | TBD        | TBD    | TBD        | Decision table testing on the price; BVA on totals; a golden message   |
| R2  | A month has the wrong lesson dates or count (month ends, leap years, weekday) | TBD        | TBD    | TBD        | BVA on dates; EP on weekdays; component tests in `schedule.test.ts`    |
| R3  | An import, a restore or a CSV file loses or corrupts her data                 | TBD        | TBD    | TBD        | Error guessing; scenario-based round trips; nothing applied partly     |
| R4  | A refused or broken storage write is not reported, so an edit is lost         | TBD        | TBD    | TBD        | EP on storage states; state transition testing on recovery             |
| R5  | A person who is not on the allowlist signs in                                 | TBD        | TBD    | TBD        | Decision table testing on the webhook; fault seeding; a real Neon call |
| R6  | From Phase 6: another account can read her data on the server                 | TBD        | TBD    | TBD        | Planned in batch 6.2; RP-09 acceptance criterion 21                    |
| R7  | A layout change hides or moves a control                                      | TBD        | TBD    | TBD        | Accessibility snapshots, geometry and pixel checks (§2.6)              |

EP is equivalence partitioning; BVA is boundary value analysis.

**TBD — the owner rates likelihood and impact.** Until then, treat every risk
as medium. R5's measures were already applied as for a high risk, in batch
5.6.

**How the risk level sets the coverage:**

- **6–9 (high):**
  - 3-value BVA;
  - all transitions in state transition testing;
  - a fault seeding table on the batch page;
  - for a deployed system, a person also checks the result on production.
- **3–4 (medium):** 2-value BVA; valid transitions (0-switch); one test case
  per partition and per decision rule.
- **1–2 (low):** one test case per valid partition.

### 1.9 Test data, test environment and test oracle

- **Test data** is synthetic test data from `@faker-js/faker`, seeded from the
  test title ([§2.3](#23-test-data-and-state)). A spec that renders a payment
  message seeds its own template, because the real payment identifiers are in
  git history (CLAUDE.md, the personal data rule).
- **Test environments:**
  - local: `npm run serve` on `http://localhost:4173`, the API on PGlite;
  - CI: the Playwright container pinned by digest, with the Linux pixel
    baselines;
  - production: Vercel (`fra1`) and Neon (Frankfurt), used only by a person for
    system integration testing and acceptance testing.
- **Test oracles** — where the expected result comes from:
  - the acceptance criteria on the batch page;
  - the frozen contracts: the testid list, the storage contract, accessibility
    snapshots and pixel baselines;
  - for pure functions, values worked out by hand and written in the test;
  - when there is no oracle (a new layout), a person looks once, and that result
    becomes the baseline.

### 1.10 House words and ISTQB terms

Older pages use house words. Read them as the ISTQB terms below. New pages use
the ISTQB term.

| House word                                | ISTQB term                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| pin, pinned                               | a test case for a known defect, marked `test.fixme`            |
| unpin, "remove the flag"                  | confirmation testing: remove the flag, then run the test       |
| gate (on a batch page), acceptance gate   | exit criteria                                                  |
| phase gate                                | quality gate                                                   |
| prove, proof, proven                      | test result, evidence                                          |
| Depends on                                | entry criteria                                                 |
| Deployable: yes                           | an exit criterion: the live site still serves correctly        |
| "Break → Result" table, mutation-verified | fault seeding                                                  |
| "Layout is checked at three levels"       | three kinds of layout check (not the ISTQB term _test level_)  |
| unit test                                 | component testing (or component integration testing in `api/`) |
| e2e spec                                  | system testing                                                 |
| bug                                       | defect (in the code), or failure (seen when it runs)           |
| flaky                                     | an anomaly: a test result that changes without a code change   |

## Part 2 — Test automation rules

How the tests are built and run. Each rule names the batch that decided it.

### 2.1 Tools and suite structure

- **Playwright with TypeScript for system testing; Vitest for component
  testing** of the pure modules (batch 2b.1) and component integration testing
  of the API (batch 4.2).
- **We adopted the existing scaffold** from the developer's working copy:
  `playwright.config.ts`, `e2e/features/` specs, `e2e/ui/` page objects,
  fixtures, and the Screenplay layer. **The Screenplay layer stays** (user
  decision, 2026-08-20).
- **Why Vitest for the pure modules** (batch 2b.1): the TDD rule. `csv.ts`,
  `schedule.ts`, `message.ts`, `format.ts` and `storage.ts` are pure functions.
  Checking in a browser that a leap-year February has 29 days is so slow that
  nobody would write the hundredth case. `npm run test:unit` runs them in the
  `node` environment. `app/vite.config.ts` collects only `app/src/**/*.test.ts`,
  so the wrong runner can never pick up a Playwright spec.
- **Unit tests are two Vitest projects under one command** (batch 4.2). The root
  `vitest.config.ts` names both: `app/vite.config.ts` for the pure modules, and
  `api/vitest.config.ts` for the backend. `npm run test:unit` runs `vitest run`
  with no `--config`, so a third project later is one line there, not a new
  command.
  - **Why two projects, not one root `include`:** the app's config is rooted at
    `app/` and pins `pool: "forks"`, so that `message.test.ts` can change the
    process time zone. One shared config would have to repeat that setting,
    and a repeated setting can get out of step with its reason.
- **Spec files are named after user scenarios**, and specs carry Given / When /
  Then comments ([§1.5](#15-how-we-develop-tdd-and-bdd)).

### 2.2 Locators and the frozen testid contract

- **Prefer `getByTestId` and user-facing locators** (role, text). Never use CSS
  structure or XPath chains.
- **The `data-testid` names below are a frozen contract.** There were 8 at
  first and 7 since batch 3.7. New testids may be added when a test case needs
  one.
- **Frozen testids:** `copy-payment-message`, `group-card-lesson-count`,
  `group-card-name`, `month-lesson-count`, `month-name`, `month-total`,
  `price-per-lesson`. **Frozen dataset hooks:** `groupName`, `groupIndex`,
  `monthKey`, `weekday`, `date`, `day`.
- **`e2e/features/testid-contract.spec.ts` enforces the list** (from batch 1.3).
  It fails if a name is missing, renamed or — since batch 3.7 — removed. Change
  that spec and this list in the same commit. This list is the only copy; there
  is no second list.
- **`month-price-input` left the contract in batch 3.7** (owner decision,
  2026-09-11). It marked an inline price input that the app placed in a section
  the same handler hid, so no user could reach it
  ([DEF-017](../../docs/plan/def-registry.md)). The code was deleted, not
  revived: the calendar's bulk price input already sets a month's price, and it
  is the control the user looks at while choosing that month's dates. The
  contract spec now asserts that the hook is **absent**, because a frozen hook
  that disappears without notice is exactly the failure the contract must
  catch.
- **`groupIndex` is replaced by `groupId` in batch
  [6.1](../../docs/plan/p6-01-schema-version-group-ids.md).** The contract spec
  and the list above change in the same commit.

### 2.3 Test data and state

- **Use `@faker-js/faker`.** Seed and reset `localStorage` between tests through
  fixtures. Tests are atomic: no state is shared between specs.
- **Seed test data from the test title only**, not from the worker index.
  Otherwise the same test makes different data on different workers, so a
  failure cannot be reproduced locally, and a retry on another worker is not the
  same test case.
- **One origin.** Locally, always `http://localhost:4173`. For a run against a
  deployment, the URL comes from `PW_BASE_URL`. Never mix `localhost` and
  `127.0.0.1`: they have separate `localStorage`. Never hard-code an origin in a
  spec.
- **A spec that reads storage directly takes the `storagePrefix` fixture**, so
  the configuration supplies the key prefix. It must not import a constant such
  as `PORTED_STORAGE_PREFIX`: a constant hard-codes one build, and reading the
  wrong key can let a spec pass for the wrong reason.

### 2.4 Clock control

**Two clocks, one instant** (batch 1.5). The app reads `new Date()` in ten
places, so time is pinned to `FIXED_NOW` in `e2e/ui/support/clock.ts`:
2026-06-15, mid-month and mid-year, so no month-end or year-end edge case fires
by accident.

- **Browser:** `context.clock.setFixedTime(now)` in the `context` fixture.
  - On the context, not the page, and before the first `newPage()`. The app reads
    the date while its script runs, so a page-level setting after `goto()` is too
    late.
  - `setFixedTime`, not `install` or `pauseAt`. It freezes what `Date.now()`
    reports but leaves timers running. The app has focus `setTimeout`s that
    `pauseAt` would stop.
- **Node:** `faker.setDefaultRefDate(FIXED_NOW)` at module scope in
  `test-data.ts`. `pickMonthContext()` runs while specs are collected and reads
  the Node clock through `faker.date.soon()`, which `page.clock` cannot reach.
  Measured: seed 7707 gives `2027-02` with one reference date and `2027-04` with
  another.
- A spec that needs a different date passes `now` to `configureTest`.
- **`timezoneId: 'UTC'` is required.** `utils.formatDate` adds
  `getTimezoneOffset()` back, which changes nothing only at offset zero.

### 2.5 Waiting and intermittent failures

- **Never fix an intermittent failure with a longer timeout before you print
  the state the test saw.** In batch 1.10 a failure that happened half the time
  looked like slowness. It was the app taking focus 100 ms after a dialog
  opened, so one field's text landed in another.
- **Waits key on a signal the app emits** — a value appears, focus arrives —
  never on elapsed time.
- **`failOnFlakyTests` is on.** CI retries a failed test. Without this setting,
  a test that fails and then passes would be reported as flaky and the run
  would stay green.
- **Network-dependent assertions must pass without a retry.** With `retries: 2`
  in CI, a check that passes on the second attempt would still exit 0. Phase 6
  specs that talk to the local API treat a retry as a failure, not a rescue
  ([lessons learned](../../docs/plan/lessons-learned.md), 21).

### 2.6 Snapshots and layout checks

- **Accessibility snapshots** (`toMatchAriaSnapshot`) are the standard assertion
  for components with complex structure: the calendar grid, month-override
  rows, and dialogs.
- **Structure snapshots anchor on the dialog panel, not the overlay.** The React
  port gives the overlay `role="dialog"`, which the legacy markup did not have.
  At the panel (`#groupModal .modal`) the accessibility tree was the same for
  both. The page objects expose `panel` for this.
- **Layout is checked in three kinds of check** (owner decision, 2026-09-06,
  batch [2a.3f](../../docs/plan/p2a-03f-layout-fix-visual-checks.md)). The port
  had shipped a broken header that a fully green behavioural suite could not
  see. Older pages call these "three levels"; they are not test levels.
  1. **Accessibility snapshots** — roles and names, in order. Everywhere.
  2. **Geometry** — relationships between bounding boxes: same row,
     right-aligned, stacked, centred, the backdrop covers the window. Everywhere,
     CI included, because it does not depend on screen size or platform. This is
     the check that catches a layout regression.
  3. **Pixels** — `toHaveScreenshot` against committed baselines, in
     `e2e/features/visual-layout.spec.ts`.

**Pixel baselines exist for both platforms, and CI runs in a pinned container**
(owner decision, 2026-09-06, batch
[2b.8](../../docs/plan/p2b-08-visual-regression.md), brought forward). The
earlier rule ran the pixel checks only when `process.platform === "darwin"`,
because this machine has no container runtime. It was replaced, because a rule that skips seven assertions
is not coverage. GitHub Actions is the container runtime.

- **Every job that runs the suite uses the same image, pinned by digest**:
  `mcr.microsoft.com/playwright@sha256:eff16c…` (`v1.63.0-noble`).
  - Not only the same Ubuntu: `ubuntu-latest` is a moving label, and its OS and
    font packages change. The font version is part of what a baseline records.
  - The tag can change too, so the digest is used.
- **Re-pin when the Playwright version moves.** Each job checks that
  `package.json` and the recorded tag agree, and fails with the fix in the
  message. Find the new digest with:
  `curl -sI -H 'Accept: application/vnd.oci.image.index.v1+json' https://mcr.microsoft.com/v2/playwright/manifests/v<version>-noble | grep -i docker-content-digest`
- **Making baselines:** `.github/workflows/baselines.yml`, started against a
  branch, renders the baselines in that image, checks them in a second pass, and
  uploads them.
  - **It does not commit.** `--update-snapshots` accepts whatever the code
    renders now, so a person must look at the difference first.
  - A push with `GITHUB_TOKEN` would start no workflows. The owner's own push
    starts CI, which compares the committed files again. That second
    comparison is the check.
  - The loop:
    ```bash
    gh workflow run baselines.yml --ref "$(git branch --show-current)"
    gh run watch "$(gh run list --workflow=baselines.yml --limit 1 --json databaseId -q '.[0].databaseId')"
    gh run download "$(gh run list --workflow=baselines.yml --limit 1 --json databaseId -q '.[0].databaseId')" \
      -n linux-baselines -D e2e/features/visual-layout.spec.ts-snapshots/
    ```
- **The macOS baselines stay**, so the local loop keeps its pixel feedback.
  Playwright's platform name is `process.platform`, with no architecture and no
  OS version in it, so a second Mac would overwrite these baselines rather than
  add its own. One machine makes them. On a second machine, or after an OS
  update changes font rendering, regenerate them rather than trust them. Batch
  [5.10](../../docs/plan/p5-10-dead-test-door.md) recorded this anomaly on
  macOS 27.0.1.
- Emoji icons were a source of pixel changes. Batch
  [2b.6](../../docs/plan/p2b-06-svg-icons.md) replaced them with SVG, and the
  baselines were regenerated through the loop above.

### 2.7 Focus

- **Focus must arrive by Tab in a focus test, never by `locator.focus()`.**
  Chromium does not match `:focus-visible` on programmatic focus, so a ring
  assertion after `.focus()` fails against a correct implementation.
- Any key press makes Chromium re-evaluate `:focus-visible`. So a "no ring after
  a mouse click" check must happen before the first key press. After an Escape
  the ring is there, correctly.

### 2.8 Known defects and guard specs

- **Verify that a control is reachable before you write a test for it.** Use it
  in a browser; reading the source is not enough. Two `P0`-rated scenarios in
  the prior art were written against code no user can reach (LP-010, and
  [DEF-017](../../docs/plan/def-registry.md)). A test against unreachable code
  passes, proves nothing, and blocks the cleanup that would delete the code.
- **A guard spec needs a completeness check.** Asserting each item where it
  belongs only catches a rename of an item someone remembered to assert. Add a
  check that walks the states, collects what it finds, and fails on anything
  missing from the frozen list. That catches the item asserted nowhere.
  `e2e/features/testid-contract.spec.ts` is the worked example.
- **Known defects are pinned, not blessed.** A spec for a known defect describes
  the _desired_ behaviour and carries
  `test.fixme(true, 'DEF-xxx: <short reason>')`. The fixing batch removes the
  flag in the same pull request as the fix. The registry is
  [docs/plan/def-registry.md](../../docs/plan/def-registry.md).
- **Verify a pin by removing the flag and watching the test fail for the stated
  reason.**
- **Unit tests do not repeat the e2e pins.** For a defect pinned with
  `test.fixme(true, 'DEF-xxx')` in `e2e/`, the unit test asserts what the
  function _actually does today_, with a comment that names the DEF and the
  batch that fixes it. One defect should not need unpinning in two places, and
  the fixing batch must see which unit assertion has to change.

### 2.9 The API and sign-in in tests

The first rules here were decided on 2026-09-09 for Phases 4–6.

- **`npm run serve` serves the API too** (batch
  [4.2](../../docs/plan/p4-02-api-skeleton-local-server.md)). A Node script
  serves `app/dist` and mounts the same Hono app under `/api` on port 4173. The
  `webServer` in `playwright.config.ts` is unchanged, so every spec runs against
  the real API code. Details in [backend.md](backend.md).
- **API tests run on PGlite**, an in-process Postgres, with the real migrations
  applied. No Docker and no secret in CI. `api/vitest.config.ts` collects them.
  `api/db-seam.test.ts` and `api/health.test.ts` use PGlite.
  - **They are slow on purpose.** The first database in a process takes about
    3.8 seconds and each one after about 1.5, so `api/vitest.config.ts` allows
    30 seconds a test. Share one database unless the test is about isolation.
- **An API route gets three tests, and they check different things:**
  1. A Vitest test calls the Hono application object directly. It is fast and
     can stub the environment, but it would stay green with the server
     unmounted or the path wrong.
  2. A Playwright test goes over HTTP, through the `request` fixture, to the
     port the suite started. It shows that something is listening, but it
     cannot easily vary the environment. `api/health.test.ts` and
     `e2e/features/api-health.spec.ts` are the pair to copy.
  3. `api/deployed-entry.test.ts` compiles the entry the way Vercel does and
     runs the output. The other two run the TypeScript **source**, because
     Node 24 strips types; Vercel compiles it. Without this test, the deployed
     code is the only code no test runs — which is how batch 4.2 shipped a
     function that could not start (lesson 26). Any future runtime that
     compiles what the tests interpret needs the same kind of test.
- **The `signedIn` fixture stubs the session at the network boundary** (batch
  5.8, replacing 5.3a's real sign-in). Neon runs the sign-in server on an origin
  that cannot run offline, and `neon neon-auth user create` creates no session.
  So Playwright answers the client's `get-session` request instead, matched on
  the **path**, so it works whichever host the client points at. The sign-out
  route changes the answer, because a stub that never ends a session would let
  the sign-out spec pass with sign-out broken.
  - **This removes the test-only door from deployed code completely**: no
    `AUTH_TEST_MODE`, no password provider, no allowlisted test address.
  - The cost is real: no spec runs a real sign-in. A person on production does
    that half.
- **A spec never performs a real Google sign-in.** Google allows no wildcard
  redirect URIs, and a real flow would need a real account in CI. A person
  checks real Google sign-in on production and records it on the batch page.
- **The suite against a preview URL is optional**, not an exit criterion. If it
  is added, it listens for Vercel's `repository_dispatch` event and sends the
  protection-bypass header. That secret is named in
  [security-auth.md](security-auth.md) (batch
  [4.3b](../../docs/plan/p4-03b-deployment-probe.md)) and is **not** a GitHub
  Actions secret: its only reader is `scripts/probe-deployment.mjs`, run by hand
  and never in CI. A workflow that needs it adds it to GitHub and to that list
  in the same pull request.

### 2.10 Running a subset

- **`--grep` on the command line does not override a project's `grep` in
  `playwright.config.ts`.** The two must both match, so a spec outside the
  project's own filter cannot be selected with the flag. The run reports no
  tests and looks like a passing subset. To run such a subset, write a temporary
  config in the scratchpad and point `--config` at it.

### 2.11 Budgets and pointers

Closed in batch 3.7; neither was an open question.

- **Suite runtime is a budget, and it is met.** The CI job took about **58 s** on
  a cold cache when first measured (batch 1.7), and about **2 min** at the end of
  Phase 3, which added about 35 tests, an axe dependency and seven
  accessibility scans. Locally the suite takes about 25 s. Investigate if a CI
  job takes more than **5 minutes**.
- **The list of testids is the frozen contract in §2.2**, not a second list.

## History — rules that no longer apply

Kept so older pages still read correctly.

- **Superseded at the cutover (batch 2a.4): two Playwright projects and the
  `@ported` tag.** `@ported` meant "also run this against the React build at
  `/next/`"; `@portedonly` added "and not against the legacy page". A pin tagged
  `@ported` claimed the React app had the defect too; if it passed there, the
  port had fixed it by accident, and the spec belonged in a `ported-*.spec.ts`
  counterpart. `playwright.config.ts`
  lines 10–15 record why both went. The `storagePrefix` rule in §2.3 survives.
- **Superseded in batch 5.8: the `signedIn` fixture signed in over HTTP before
  the browser context existed** (batch 5.3a), through a test-only e-mail and
  password path enabled by `AUTH_TEST_MODE=1`, and put the cookie on the
  context. Two details it had to learn: Better Auth answered 403
  `MISSING_OR_NULL_ORIGIN` to a POST with no `Origin` header, which a browser
  always sends and Node's `fetch` does not; and the fixture reported both the
  sign-in and the sign-up attempt when it failed, because reporting only the
  second once hid a 429.

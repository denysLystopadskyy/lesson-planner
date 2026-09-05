# Testing

Decisions about test tools and test style. Referenced from [CLAUDE.md](../../CLAUDE.md).
Background: [RP-03 test architecture](../../docs/research/rp03-test-architecture/rp03-test-architecture.md).

## Decided

- **Tools:** Playwright with TypeScript for end-to-end tests. Vitest for unit
  tests of pure functions (arrives in plan batch 2b.1).
- **We adopt the existing scaffold** from the developer's working copy:
  `playwright.config.ts`, `e2e/features/` specs, `e2e/ui/` page objects,
  fixtures, and the Screenplay layer. **The Screenplay layer stays** (user
  decision, 2026-08-20).
- **Spec style is BDD.** Specs read as Given / When / Then. Name specs after
  user scenarios (for example `schedule-editing.spec.ts`).
- **New code and refactors follow TDD.** Write the failing test first, then the
  code, then refactor.
- **Locators:** prefer `getByTestId` and user-facing locators (role, text).
  Never use CSS structure or XPath chains. The 8 existing `data-testid` names
  are a frozen contract (list below). A contract spec enumerates them and fails
  if one is renamed. New testids may be added while writing test cases when
  critical. A full testid review happens during the React refactor (Phase 2b).
- **Frozen testid contract:** `copy-payment-message`, `group-card-lesson-count`,
  `group-card-name`, `month-lesson-count`, `month-name`, `month-price-input`,
  `month-total`, `price-per-lesson`. Plus dataset hooks: `groupName`,
  `groupIndex`, `monthKey`, `weekday`, `date`, `day`. Enforced from plan batch
  1.3 by `e2e/features/testid-contract.spec.ts`, which fails if any name is
  missing or renamed. Change that spec and this list together.
  - `month-price-input` and `price-per-lesson` are mutually exclusive: the app
    renders one or the other, never both. `month-price-input` is asserted as
    _attached and hidden_, not visible — see
    [DEF-017](../../docs/plan/def-registry.md).
- **ISTQB techniques** are named in every coverage group: equivalence
  partitioning (EP), boundary value analysis (BVA), decision tables, state
  transition testing. Write the technique name in the `describe` block.
- **Aria snapshots** (`toMatchAriaSnapshot`) are the standard assertion for
  components with complex structure: the calendar grid, month-override rows,
  and modals.
- **Pixel visual regression** is enabled only after the emoji icons are
  replaced with SVG components (plan batch 2b.6; suite in 2b.8). Until then,
  aria snapshots only. Reason: the OS renders emoji, so pixels differ per
  machine. Baselines are generated and compared in CI Linux only.
- **Clock control: two clocks, one instant.** The app reads `new Date()` in ten
  places, so time is pinned to `FIXED_NOW` in `e2e/ui/support/clock.ts`
  (2026-06-15, mid-month and mid-year so no month-end or year-end edge case
  fires by accident). Built in plan batch 1.5.
  - **Browser:** `context.clock.setFixedTime(now)` in the `context` fixture. On
    the context, not the page, and before the first `newPage()` — the app reads
    the date while its inline script parses, so a page-level pin set after
    `goto()` is too late. `setFixedTime`, not `install` or `pauseAt`: it freezes
    what `Date.now()` reports while leaving timers running, and the app has
    focus `setTimeout`s that `pauseAt` would strand.
  - **Node:** `faker.setDefaultRefDate(FIXED_NOW)` at module scope in
    `test-data.ts`. `pickMonthContext()` runs while specs are being collected
    and reads the Node clock through `faker.date.soon()`, which `page.clock`
    cannot reach. Measured: seed 7707 yields `2027-02` against one reference
    date and `2027-04` against another.
  - A spec that needs a different date passes `now` to `configureTest`.
  - `timezoneId: 'UTC'` still applies and is load-bearing: `utils.formatDate`
    adds `getTimezoneOffset()` back, which is a no-op only at offset zero.
- **Test data is seeded from the test title alone**, not the worker index.
  Otherwise the same test generates different data on different workers, so a
  failure cannot be reproduced locally and a retry elsewhere is not re-running
  the same case.
- **Origin consistency:** always `http://localhost:4173`. Never mix
  `localhost` and `127.0.0.1` — they have separate `localStorage`.
- **Test data:** use `@faker-js/faker`. Seed and reset `localStorage` between
  tests through fixtures. Tests are atomic; no shared state between specs.
- **Verify a control is reachable before writing a test for it.** Exercise it in
  a browser; reading the source is not enough. Two `P0`-rated scenarios in the
  prior art were written against code no user can reach (LP-010, and
  [DEF-017](../../docs/plan/def-registry.md)). A test against unreachable code
  passes, proves nothing, and blocks the cleanup that would delete the code.
- **A guard spec needs a completeness check.** Asserting each item where it
  belongs only catches a rename of an item someone remembered to assert. Add a
  check that walks the states, collects what it finds, and fails on anything
  missing from the frozen list — that is what catches the item asserted nowhere.
  `e2e/features/testid-contract.spec.ts` is the worked example.
- **Known defects are pinned, not blessed.** A spec for a known bug describes
  the _desired_ behavior and carries
  `test.fixme(true, 'DEF-xxx: <short reason>')`. The fixing batch removes the
  flag in the same PR as the fix. The registry is
  [docs/plan/def-registry.md](../../docs/plan/def-registry.md).

## TBD

- **Suite runtime.** Locally the full suite is about 8 seconds and
  `--repeat-each=3` about 19 seconds, on 5 workers. The CI figure is recorded
  once the first run on a pull request completes; the budget is set from that,
  not from the local number.
- List of testids added during test-case creation (append as they appear).

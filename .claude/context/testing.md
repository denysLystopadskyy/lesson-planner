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
- **Clock control:** the app reads `new Date()` in many places. Tests must
  control time (Playwright clock API, `timezoneId: 'UTC'`). **Not built yet** —
  the adopted scaffold sets `timezoneId` only, with no use of the clock API.
  See the TBD below.
- **Origin consistency:** always `http://localhost:4173`. Never mix
  `localhost` and `127.0.0.1` — they have separate `localStorage`.
- **Test data:** use `@faker-js/faker`. Seed and reset `localStorage` between
  tests through fixtures. Tests are atomic; no shared state between specs.
- **Known defects are pinned, not blessed.** A spec for a known bug describes
  the _desired_ behavior and carries
  `test.fixme(true, 'DEF-xxx: <short reason>')`. The fixing batch removes the
  flag in the same PR as the fix. The registry is
  [docs/plan/def-registry.md](../../docs/plan/def-registry.md).

## TBD

- **Clock control.** Decide where it belongs: a fixture that calls
  `page.clock.setFixedTime` for every test, or per-spec opt-in. Needed before
  the feature specs in plan batches 1.4 and 1.5, several of which assert on
  month names and "today". The batch-1.3 specs avoid it by being
  date-independent, which does not scale to the rest of the suite.
- Suite runtime budget in CI. Measure after plan batch 1.7, then record here.
- List of testids added during test-case creation (append as they appear).

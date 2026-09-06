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
- **Layout is checked at three levels** (owner decision, 2026-09-06, plan batch
  [2a.3f](../../docs/plan/p2a-03f-layout-fix-visual-checks.md), after the port
  shipped a broken header that a fully green behavioural suite could not see):
  1. **Accessibility snapshots** — roles and names, in order. Everywhere.
  2. **Geometry** — relationships between bounding boxes: same row,
     right-aligned, stacked, centred, backdrop covers the window. Everywhere,
     CI included, because it is resolution- and platform-independent. This is
     the level that catches a layout regression.
  3. **Pixels** — `toHaveScreenshot` against committed baselines, in
     `e2e/features/visual-layout.spec.ts`.
- **Pixel baselines exist for both platforms, and CI runs in a pinned
  container** (owner decision, 2026-09-06, plan batch
  [2b.8](../../docs/plan/p2b-08-visual-regression.md), brought forward). The
  earlier rule — baselines gated on `process.platform === "darwin"` because this
  machine has no container runtime — was replaced rather than kept, because a
  gate that skips seven assertions is not coverage. GitHub Actions is the
  container runtime the machine lacks.
  - Every job that runs the suite uses **the same image, pinned by digest**:
    `mcr.microsoft.com/playwright@sha256:eff16c…` (`v1.63.0-noble`). Not merely
    the same Ubuntu: `ubuntu-latest` is a rolling label whose OS and font
    packages move under it, and the icons are emoji, so the font version is part
    of what a baseline records. The tag is mutable too, hence the digest.
  - **Re-pin when the Playwright version moves.** Each job guards that
    `package.json` and the recorded tag agree and fails with the fix in the
    message. Resolve the new digest with:
    `curl -sI -H 'Accept: application/vnd.oci.image.index.v1+json' https://mcr.microsoft.com/v2/playwright/manifests/v<version>-noble | grep -i docker-content-digest`
  - **Making baselines:** `.github/workflows/baselines.yml`, dispatched against
    a branch, renders them in that image, proves them in a second pass, and
    uploads them. It **does not commit**: `--update-snapshots` blesses whatever
    the code renders now, so a person has to look at the diff, and a
    `GITHUB_TOKEN` push would trigger no workflows while the owner's own push
    triggers CI and re-compares the committed bytes. That re-check is the
    verification. The loop:
    ```bash
    gh workflow run baselines.yml --ref "$(git branch --show-current)"
    gh run watch "$(gh run list --workflow=baselines.yml --limit 1 --json databaseId -q '.[0].databaseId')"
    gh run download "$(gh run list --workflow=baselines.yml --limit 1 --json databaseId -q '.[0].databaseId')" \
      -n linux-baselines -D e2e/features/visual-layout.spec.ts-snapshots/
    ```
  - **The macOS set stays**, so the local loop keeps its pixel feedback.
    Playwright's platform token is `process.platform`, with no architecture and
    no OS version in it, so a second Mac would overwrite these baselines rather
    than add its own. One machine makes them today; on a second, regenerate
    rather than trust them.
  - **`failOnFlakyTests` is on.** With retries in CI, a screenshot that fails
    and passes on the second attempt would otherwise be reported flaky and the
    run would still be green — which is exactly the comparison telling you the
    two renders differ.
  - Emoji icons remain a real source of pixel churn, but the churn is pinned
    inside the image. Batch [2b.6](../../docs/plan/p2b-06-svg-icons.md) replaces
    them with SVG; the baselines are regenerated then, through the loop above.
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
- **Never fix an intermittent failure with a longer timeout before printing the
  state the test saw.** In plan batch 1.10 a half-the-time failure looked like
  slowness and was actually the app stealing focus 100 ms after a dialog opens,
  landing one field's text in another. Waits must key on a signal the app
  itself emits — a value appearing, focus arriving — never on elapsed time.
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
- **A pin is verified by removing the flag and watching it fail for the stated
  reason** — in every project the spec is tagged for. A pin tagged `@ported`
  claims the React app has the defect too; if it passes there, the port fixed it
  by accident and the spec belongs in a `ported-*.spec.ts` counterpart instead.
- **One suite, two projects.** `@ported` means "also run this against the React
  build at `/next/`"; `@portedonly` adds "and not against the legacy page". A
  spec covering both apps carries `@ported` alone. A spec that reads storage
  directly must take the **`storagePrefix` fixture** rather than importing
  `PORTED_STORAGE_PREFIX`, so the project supplies the value — the constant
  hard-codes one app, and reading the wrong key can leave a spec passing for the
  wrong reason.
- **Structure snapshots anchor on the dialog panel, not the overlay.** The React
  port gives the overlay `role="dialog"`, which the legacy markup lacks; at the
  panel (`#groupModal .modal`) the accessibility tree is the same for both. The
  page objects expose `panel` for this.

## TBD

- **Suite runtime.** The whole CI job — install, browser download, four checks —
  is about **58 s** on a cold cache (measured on the first run, plan batch 1.7).
  Locally the suite alone is about 8 s, and `--repeat-each=3` about 19 s, on
  5 workers. Budget: investigate if a CI job passes 5 minutes.
- List of testids added during test-case creation (append as they appear).

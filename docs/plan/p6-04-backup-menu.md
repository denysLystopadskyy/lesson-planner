# Batch 6.4 — The Backup menu

Phase 6 · [Plan home](README.md) · Prev: [6.0](p6-00-record-server-first.md) · Next: [6.2](p6-02-remote-store.md) (runs in parallel with [6.1](p6-01-documents-api.md))

**Planned in batch 6.0 on 2026-11-16. Built on 2026-11-16.** The pixel
baselines wait for the owner's review (see Results).

## Goal

The four backup buttons (Save CSV, Load CSV, Save Backup, Load Backup) sit under
one **Backup** menu on the toolbar. Their ids and labels do not change, so the
teacher's steps and the specs keep working.

## Test basis

- The plan section "Batch 6.4" in
  [the Phase 6 plan](../superpowers/plans/2026-11-15-phase-6-server-first.md).
- The owner's answer of 2026-11-15: keep both CSV and JSON, hidden under a
  **Backup** dropdown.
- [storage-data-contract.md](../../.claude/context/storage-data-contract.md),
  "Backups".
- The button labels the teacher's steps quote: **Save Backup**, **Load Backup**.
- [testing.md §2.2](../../.claude/context/testing.md#22-locators-and-the-frozen-testid-contract)
  (frozen testids) and §2.6 (pixel checks).

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                                              |
| ---- | ---------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| R7   | TBD        | TBD    | TBD        | A layout change could hide a control. Accessibility snapshot, keyboard checks and re-rendered pixel baselines. |
| R3   | 2–3        | 3      | 6–9 high   | The menu must still reach Save Backup and Load Backup: the regression run goes through the page objects.       |

## Entry criteria

- [ ] Batch [6.0](p6-00-record-server-first.md) is merged.
- [ ] The test basis above is written down (it is).
- [ ] This batch can pass its own exit criteria with only what it ships. It
      touches only the toolbar and the page objects, so it needs nothing from
      6.1. If 6.1 merges first, rebase on `main`.

## Test conditions

| ID  | Test condition | Test level | Test type                      | Technique                         | Coverage items                                                                                   | File                                               |
| --- | -------------- | ---------- | ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| C1  | Menu states    | system     | functional, black-box          | state transition, all transitions | closed→open→closed by click, by Esc, by an outside click, and by choosing an action              | `e2e/features/backup-menu.spec.ts`                 |
| C2  | Accessibility  | system     | non-functional (accessibility) | checklist                         | keyboard open and close; focus returns to the button; `aria-expanded`; axe scan of the open menu | `e2e/features/backup-menu.spec.ts`, `a11y.spec.ts` |
| C3  | Regression     | system     | functional, regression         | regression                        | the CSV and backup specs, through the page objects, which open the menu first                    | the existing CSV and backup specs                  |

Design: a disclosure button **Backup ▾** (`#backupMenuBtn`, `aria-expanded`,
`aria-controls`) reveals the four existing buttons with their ids and labels
unchanged. Esc and an outside click close it, and focus returns to the button.
`#backupMenuBtn` is a new id; add it to the frozen contract in the same commit
if it is used as a test hook (testing.md §2.2).

Files: modify `app/src/Toolbar.tsx` (and its CSS module) and
`e2e/ui/pages/PlannerPage.ts` (`saveCsv`, `loadCsv`, `saveBackup` and
`loadBackup` open the menu first, so the specs stay unchanged). Tests:
`e2e/features/backup-menu.spec.ts`; `a11y.spec.ts` scans the open menu.

## Tasks

- [x] Load the skills named in CLAUDE.md. **None of them was installed in this
      session** (`istqb-foundation:istqb-foundation-level`,
      `istqb-test-design:istqb-advanced-level-test-analyst`,
      `superpowers:test-driven-development`). The session followed testing.md
      Part 1 and §1.5 instead.
- [x] Red: write `backup-menu.spec.ts` and the `a11y.spec.ts` addition. Commit
      `Red: …`.
- [x] Green: build the menu and update the page objects. Commit `Green: …`.
- [ ] Re-render the pixel baselines with the `baselines.yml` workflow (manual
      dispatch), then commit them.
- [x] Open the pull request. The orchestrating session merges it on green CI.

## TDD log

| Step     | Commit    | Command                                                                                                                                              | Result                                                                                                             |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Red      | `e15f049` | `npx playwright test e2e/features/backup-menu.spec.ts`                                                                                               | 9 of 9 fail: `locator.evaluate`/`click` times out (30000ms) waiting for `#backupMenuBtn`, which does not exist yet |
| Green    | `9aafd6d` | `npx playwright test e2e/features/backup-menu.spec.ts e2e/features/a11y.spec.ts e2e/features/smoke.spec.ts e2e/features/group-card-keyboard.spec.ts` | 33 passed                                                                                                          |
| Refactor |           |                                                                                                                                                      | _optional; passes_                                                                                                 |

## Acceptance criteria

- [ ] **Given** the toolbar, **when** the teacher opens **Backup**, **then** she
      sees Save CSV, Load CSV, Save Backup and Load Backup, with the same labels
      as before.
- [ ] **Given** the menu is open, **when** she presses Esc or clicks outside,
      **then** it closes and focus returns to the **Backup** button.
- [ ] **Given** a keyboard user, **when** they open the menu, **then** they can
      reach and use every item.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _N / N_.
- [ ] The TDD log is complete.
- [ ] The pixel baselines are re-rendered and committed.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.

## Confirmation and regression testing

Impact analysis: the toolbar appears in every screen, so the pixel baselines
change and are re-rendered. Every spec that clicks a backup or CSV button goes
through `PlannerPage.ts`, so C3 covers them. The button ids stay, so the
`testid-contract` spec stays green unless a new hook is frozen.

## Fault seeding

Not required: the risk level of this batch's conditions is not high.

## Results

- Local gates: `format:check`, `lint`, `typecheck`, `typecheck:app`,
  `typecheck:api` and `check:pii` exit 0.
- Counts: `test:unit` 454 passed. `test:e2e` 204 passed, 10 failed. The 10 are
  the known local anomalies, the same as on `main`: 7 in `visual-layout.spec.ts`
  (pixel baselines rendered in CI's image) and 3 in `backup-round-trip.spec.ts`
  (lines 159, 185, 221). Nine of the 214 are new (`backup-menu.spec.ts`) and one
  is the new axe scan in `a11y.spec.ts`.
- Coverage: C1 six of six transitions, C2 three of three checklist items
  (keyboard open, Esc from inside, Tab out), plus the axe scan; C3 is the
  existing specs, which pass through the page objects.
- Design notes. The menu is a disclosure, not an ARIA `menu`: the actions are
  rendered only while it is open, so the closed tab order is one stop,
  **Backup ▾**. The ▾ is `aria-hidden`, so the accessible name is "Backup".
  `loadCsv` and `loadBackup` now click the real button and answer the file
  chooser, instead of setting files on the hidden input. Outside click and
  Tab-out close the menu; an outside click returns focus to the button only if
  it landed on nothing focusable, so it never steals focus from a control the
  teacher clicked. `#backupMenuBtn` is an id, not a `data-testid`, so the frozen
  contract (§2.2) is unchanged.
- Existing specs that had to change, because they list the toolbar: the tab
  order in `group-card-keyboard.spec.ts`, `TOOLBAR_BUTTONS` in `smoke.spec.ts`
  and the banner snapshot in `visual-layout.spec.ts`.
- **A layout consequence, found by the first baselines run in CI.** With the
  four buttons under one menu the toolbar is narrower, so "Sign in with Google"
  now fits on the title's row and sits at the right margin, and the main screen
  is one banner row instead of two. The geometry check in `visual-layout.spec.ts`
  said "Clear All Data reaches the right margin", which is no longer true. The
  record was changed, not weakened: the last banner control, the sign-in button,
  must reach the margin, and "Clear All Data" must end before it on the same row.
  This failed in CI and in this container, hidden among the seven pixel failures
  here.
- **Pixel baselines.** All seven Linux baselines were re-rendered by
  `baselines.yml` (run 43829008272, mode `changed`) and committed from the
  owner's copies; this session's network cannot download the artifact. The
  macOS baselines are not updated. **The owner must look at the changed images
  before merge.**

## Merge order and dependencies

Depends on 6.0 only. Runs in parallel with 6.1. Deployable: yes — the buttons
keep their labels, and the new teacher steps in [4.3](p4-03-cutover-to-vercel.md)
already say "Backup → Save Backup". **Owner decision, 2026-11-16:** the Backup
menu ships to both builds, the GitHub Pages one included, so the teacher meets
it on the old site before the cutover.

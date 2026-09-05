# Execution plan — from one HTML file to a tested React app

This is the plan hub. One page per PR batch. Every batch is atomic: one small,
reviewable change. Every batch before Phase 4 keeps the site deployable on
GitHub Pages. Decisions live in the [context files](../../CLAUDE.md), not here.

- Research behind this plan: [docs/research/](../research/README.md)
- Known defects and their pins: [DEF registry](def-registry.md)
- Merge-target rule: every batch is a PR into `main`
  (see [deployment.md](../../.claude/context/deployment.md)).

## Phases

| Phase                        | Goal                                                          | Batches      |
| ---------------------------- | ------------------------------------------------------------- | ------------ |
| 1 — Test infrastructure      | Cover the current app with Playwright tests                   | 1.0 – 1.13   |
| 2a — React, one big App      | Same app inside one `<App>`, deployed the new way             | 2a.1 – 2a.4  |
| 2b — Componentization        | Components, styles, icons, visual tests, routing, state store | 2b.1 – 2b.10 |
| 3 — Stabilization            | Fix the pinned defects, clean up, verify accessibility        | 3.1 – 3.7    |
| 4 — Database (brainstorming) | An options document, not tasks                                | 4.1          |

## Merge order

The list below is the merge sequence. "Parallel dev" means work can happen at
the same time, but merges stay in this order.

| #   | Batch                                         | Title                                           | Depends on      |
| --- | --------------------------------------------- | ----------------------------------------------- | --------------- |
| 1   | [1.0](p1-00-docs-and-memory-bootstrap.md)     | Docs and memory bootstrap                       | —               |
| 2   | [1.1](p1-01-toolchain-bootstrap.md)           | Toolchain bootstrap                             | 1.0             |
| 3   | [1.2](p1-02-land-test-hooks.md)               | Land the test-hook index.html                   | 1.1             |
| 4   | [1.3](p1-03-scaffold-core.md)                 | Scaffold core + smoke + testid contract         | 1.2             |
| 5   | [1.4](p1-04-feature-specs-1.md)               | Feature specs I                                 | 1.3             |
| 6   | [1.5](p1-05-feature-specs-2.md)               | Feature specs II                                | 1.4             |
| 7   | [1.6](p1-06-eslint.md)                        | ESLint                                          | 1.5             |
| 8   | [1.7](p1-07-ci-advisory.md)                   | CI (advisory)                                   | 1.6             |
| 9   | [1.8](p1-08-coverage-groups.md)               | Coverage: groups (parallel dev)                 | 1.7             |
| 10  | [1.9](p1-09-coverage-schedule-calendar.md)    | Coverage: schedule/calendar (parallel dev)      | 1.7             |
| 11  | [1.10](p1-10-coverage-overrides-pricing.md)   | Coverage: overrides/pricing (parallel dev)      | 1.7             |
| 12  | [1.11](p1-11-coverage-message-template.md)    | Coverage: message/template (parallel dev)       | 1.7             |
| 13  | [1.12](p1-12-coverage-csv.md)                 | Coverage: CSV (parallel dev)                    | 1.7             |
| 14  | [1.13](p1-13-storage-contract.md)             | Storage contract specs                          | 1.7             |
| 15  | [2a.1](p2a-01-vite-scaffold.md)               | Vite scaffold in app/ (dev may start after 1.7) | 1.7             |
| 16  | [2a.2](p2a-02-deploy-workflow-runbook.md)     | Deploy workflow + owner runbook                 | 2a.1            |
| 17  | [2a.3a](p2a-03a-port-shell-storage.md)        | Port: shell + storage adapter                   | 2a.2, 1.13      |
| 18  | [2a.3b](p2a-03b-port-groups.md)               | Port: groups                                    | 2a.3a           |
| 19  | [2a.3c](p2a-03c-port-calendar-overrides.md)   | Port: calendar + overrides                      | 2a.3b           |
| 20  | [2a.3d](p2a-03d-port-template-message-csv.md) | Port: template/message/CSV, full suite          | 2a.3c, 1.8–1.12 |
| 21  | [2a.4](p2a-04-cutover.md)                     | Cutover                                         | 2a.3d           |
| 22  | [2b.1](p2b-01-logic-modules-adrs.md)          | Logic modules + ADRs (Vitest, CSS)              | 2a.4            |
| 23  | [2b.2](p2b-02-toolbar-group-list.md)          | Toolbar + group list                            | 2b.1            |
| 24  | [2b.3](p2b-03-group-modal.md)                 | Group modal (dialog)                            | 2b.2            |
| 25  | [2b.4](p2b-04-calendar-editor.md)             | Calendar editor (keyboard)                      | 2b.3            |
| 26  | [2b.5](p2b-05-template-review-modals.md)      | Template + review modals                        | 2b.4            |
| 27  | [2b.6](p2b-06-svg-icons.md)                   | SVG icons replace emoji                         | 2b.5            |
| 28  | [2b.7](p2b-07-styles-extraction.md)           | Styles extraction + tokens                      | 2b.6            |
| 29  | [2b.8](p2b-08-visual-regression.md)           | Visual regression suite                         | 2b.6, 2b.7      |
| 30  | [2b.9](p2b-09-hash-routing.md)                | Hash routing                                    | 2b.8            |
| 31  | [2b.10](p2b-10-state-store.md)                | State store (built-in)                          | 2b.9            |
| 32  | [3.1](p3-01-storage-guards.md)                | Storage guards (DEF-001)                        | 2b.10           |
| 33  | [3.2](p3-02-input-import-sanitation.md)       | Input/import sanitation (parallel-safe)         | 2b.10           |
| 34  | [3.3](p3-03-json-backup.md)                   | Versioned JSON backup                           | 3.1             |
| 35  | [3.4a](p3-04a-interaction-defects.md)         | Interaction defects (parallel-safe)             | 2b.10           |
| 36  | [3.4b](p3-04b-csv-clipboard-defects.md)       | CSV / data-reset defects                        | 3.2             |
| 37  | [3.5](p3-05-pii-template-cleanup.md)          | Personal-data template cleanup (LOW)            | 2b.10           |
| 38  | [3.6](p3-06-a11y-verification.md)             | Accessibility verification                      | 3.1–3.5         |
| 39  | [3.7](p3-07-cleanup.md)                       | Cleanup                                         | 3.6             |
| 40  | [4.1](p4-01-database-options-doc.md)          | Database options document                       | Phase 3 done    |

## Phase gates

- **Phase 1 done:** `format:check`, `lint`, `typecheck` exit 0;
  `npx playwright test --repeat-each=3` exit 0 with only fixme-marked skips.
- **Phase 2a done:** full suite green against the deployed `/`; cutover PR
  contains only the three expected changes (rollback = one revert).
- **Phase 2b done:** suite + unit tests green; visual baselines committed;
  persistence contract test green (same three keys).
- **Phase 3 done:** DEF registry has zero open rows (or a recorded decision);
  corrupt-seed test shows recovery, not a dead page.
- **Phase 4 done:** the options document exists and is discussed; a decision
  is recorded in the context files.

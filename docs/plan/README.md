# Execution plan — from one HTML file to a tested React app

This is the plan hub. One page per PR batch. Every batch is atomic: one small,
reviewable change. Every batch keeps the live site deployable: on GitHub Pages
until the cutover in batch 4.3, on Vercel after it. Decisions live in the
[context files](../../CLAUDE.md), not here.

- Research behind this plan: [docs/research/](../research/README.md). The
  service evaluation of 2026-09-09 that shaped Phases 4–6:
  [RP-10](../research/rp10-service-evaluation/rp10-service-evaluation.md).
- Known defects and their pins: [DEF registry](def-registry.md)
- What executing the plan taught us: [Lessons learned](lessons-learned.md)
- Merge-target rule: every batch is a PR into `main`
  (see [deployment.md](../../.claude/context/deployment.md)).

## Phases

| Phase                    | Goal                                                                                                  | Batches      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------ |
| 1 — Test infrastructure  | Cover the current app with Playwright tests                                                           | 1.0 – 1.13   |
| 2a — React, one big App  | Same app inside one `<App>`, deployed the new way                                                     | 2a.1 – 2a.4  |
| 2b — Componentization    | Components, styles, icons, visual tests, routing, state store                                         | 2b.1 – 2b.10 |
| 3 — Stabilization        | Fix the pinned defects, clean up, verify accessibility                                                | 3.1 – 3.7    |
| 4 — Hosting migration    | A Vercel project with previews, one API function, the origin move, GitHub Pages retired               | 4.1 – 4.4    |
| 5 — Sign-in              | Neon database plumbing, Better Auth with Google and an allowlist, the account view, a security review | 5.1 – 5.4    |
| 6 — Data in the database | Schema version and group ids, the documents API, remote persistence, recovery drills, close-out       | 6.1 – 6.5    |

## What changed on 2026-09-09

The old Phase 4 was one batch, 4.1, that would write an options document about
the database and stop. That document exists now:
[RP-10](../research/rp10-service-evaluation/rp10-service-evaluation.md). It
evaluated Vercel, Neon and Better Auth against their alternatives and
recommended a stack. The plan was reworked from it:

- **Hosting migration is its own phase, Phase 4, and it comes before sign-in
  and data.** The old plan moved hosting implicitly, as part of the database
  work. Now the host is proven, the teacher moves once, and only then does
  anything sign her in or store her data.
- **Batches 4.1 and 4.2 are inert for the live site and may merge as soon as
  3.3 is merged**, in parallel with 3.4a–3.7. They give preview URLs to the
  remaining Phase 3 reviews. **Batch 4.3, the cutover, waits for 3.7**, so she
  moves to a stabilized app. If the architect prefers a simpler order, land
  all of Phase 4 after 3.7; nothing else changes.
- **Sign-in (Phase 5) ends with a security review (5.4)** that covers secret
  management, deployment security and the Google OAuth flow, and gates Phase 6.
- **Data in the database (Phase 6) starts with the schema version and group
  ids (6.1)**, the prerequisite three research reports flagged and none solved.
- Phases 1–3 are unchanged. The old page `p4-01-database-options-doc.md` was
  removed; RP-10 supersedes it.

## Merge order

The list below is the merge sequence. "Parallel dev" means work can happen at
the same time, but merges stay in this order — with one recorded exception:
rows 42 and 43 may merge anywhere after row 36.

Within Phase 3, the parallel-safe set is **3.2, 3.4a and 3.5**, which name each
other on their own pages. **3.1 is deliberately not in it**: it rewrites every
storage read and write, and the defects routed to 3.2 and 3.4a sit on paths it
touches. Run 3.1 on its own.

| #   | Batch                                         | Title                                           | Depends on               |
| --- | --------------------------------------------- | ----------------------------------------------- | ------------------------ |
| 1   | [1.0](p1-00-docs-and-memory-bootstrap.md)     | Docs and memory bootstrap                       | —                        |
| 2   | [1.1](p1-01-toolchain-bootstrap.md)           | Toolchain bootstrap                             | 1.0                      |
| 3   | [1.2](p1-02-land-test-hooks.md)               | Land the test-hook index.html                   | 1.1                      |
| 4   | [1.3](p1-03-scaffold-core.md)                 | Scaffold core + smoke + testid contract         | 1.2                      |
| 5   | [1.4](p1-04-feature-specs-1.md)               | Feature specs I                                 | 1.3                      |
| 6   | [1.5](p1-05-feature-specs-2.md)               | Feature specs II                                | 1.4                      |
| 7   | [1.6](p1-06-eslint.md)                        | ESLint                                          | 1.5                      |
| 8   | [1.7](p1-07-ci-advisory.md)                   | CI (advisory)                                   | 1.6                      |
| 9   | [1.8](p1-08-coverage-groups.md)               | Coverage: groups (parallel dev)                 | 1.7                      |
| 10  | [1.9](p1-09-coverage-schedule-calendar.md)    | Coverage: schedule/calendar (parallel dev)      | 1.7                      |
| 11  | [1.10](p1-10-coverage-overrides-pricing.md)   | Coverage: overrides/pricing (parallel dev)      | 1.7                      |
| 12  | [1.11](p1-11-coverage-message-template.md)    | Coverage: message/template (parallel dev)       | 1.7                      |
| 13  | [1.12](p1-12-coverage-csv.md)                 | Coverage: CSV (parallel dev)                    | 1.7                      |
| 14  | [1.13](p1-13-storage-contract.md)             | Storage contract specs                          | 1.7                      |
| 15  | [2a.1](p2a-01-vite-scaffold.md)               | Vite scaffold in app/ (dev may start after 1.7) | 1.7                      |
| 16  | [2a.2](p2a-02-deploy-workflow-runbook.md)     | Deploy workflow + owner runbook                 | 2a.1                     |
| 17  | [2a.3a](p2a-03a-port-shell-storage.md)        | Port: shell + storage adapter                   | 2a.2, 1.13               |
| 18  | [2a.3b](p2a-03b-port-groups.md)               | Port: groups                                    | 2a.3a                    |
| 19  | [2a.3c](p2a-03c-port-calendar-overrides.md)   | Port: calendar + overrides                      | 2a.3b                    |
| 20  | [2a.3d](p2a-03d-port-template-message-csv.md) | Port: template/message/CSV, full suite          | 2a.3c, 1.8–1.12          |
| 21  | [2a.3e](p2a-03e-port-styles.md)               | Port: the stylesheet, verbatim                  | 2a.3d                    |
| 22  | [2a.3f](p2a-03f-layout-fix-visual-checks.md)  | Layout fix + visual checks                      | 2a.3e                    |
| 23  | [2a.4](p2a-04-cutover.md)                     | Cutover                                         | 2a.3f                    |
| 24  | [2b.1](p2b-01-logic-modules-adrs.md)          | Logic modules + ADRs (Vitest, CSS)              | 2a.4                     |
| 25  | [2b.2](p2b-02-toolbar-group-list.md)          | Toolbar + group list                            | 2b.1                     |
| 26  | [2b.3](p2b-03-group-modal.md)                 | Group modal (dialog)                            | 2b.2                     |
| 27  | [2b.4](p2b-04-calendar-editor.md)             | Calendar editor (keyboard)                      | 2b.3                     |
| 28  | [2b.5](p2b-05-template-review-modals.md)      | Template + review modals                        | 2b.4                     |
| 29  | [2b.6](p2b-06-svg-icons.md)                   | SVG icons replace emoji                         | 2b.5                     |
| 30  | [2b.7](p2b-07-styles-extraction.md)           | Styles extraction + tokens                      | 2b.6                     |
| 31  | [2b.8](p2b-08-visual-regression.md)           | Visual regression suite                         | 2b.6, 2b.7               |
| 32  | [2b.9](p2b-09-hash-routing.md)                | Hash routing                                    | 2b.8                     |
| 33  | [2b.10](p2b-10-state-store.md)                | State store (built-in)                          | 2b.9                     |
| 34  | [3.1](p3-01-storage-guards.md)                | Storage guards (DEF-021, DEF-022)               | 2b.10                    |
| 35  | [3.2](p3-02-input-import-sanitation.md)       | Input/import sanitation (DEF-002, DEF-020)      | 2b.10                    |
| 36  | [3.3](p3-03-json-backup.md)                   | Versioned JSON backup                           | 3.1                      |
| 37  | [3.4a](p3-04a-interaction-defects.md)         | Interaction defects (parallel-safe)             | 2b.10                    |
| 38  | [3.4b](p3-04b-csv-clipboard-defects.md)       | CSV / data-reset defects                        | 3.2                      |
| 39  | [3.5](p3-05-pii-template-cleanup.md)          | Personal-data cleanup (LOW, parallel-safe)      | 2b.10                    |
| 40  | [3.6](p3-06-a11y-verification.md)             | Accessibility verification                      | 3.1–3.5                  |
| 41  | [3.7](p3-07-cleanup.md)                       | Cleanup                                         | 3.6                      |
| 42  | [4.1](p4-01-vercel-project-previews.md)       | Vercel project + previews (inert)               | 3.3 (parallel 3.4a–3.7)  |
| 43  | [4.2](p4-02-api-skeleton-local-server.md)     | API skeleton + local server                     | 4.1 (parallel Phase 3)   |
| 44  | [4.3](p4-03-cutover-to-vercel.md)             | Cutover to the new origin                       | 3.7, 4.2                 |
| 45  | [4.4](p4-04-retire-github-pages.md)           | Retire GitHub Pages                             | 4.3, the window end date |
| 46  | [5.1](p5-01-neon-database-plumbing.md)        | Neon project + database plumbing                | 4.4                      |
| 47  | [5.2](p5-02-better-auth-google-allowlist.md)  | Better Auth server: Google + allowlist          | 5.1                      |
| 48  | [5.3](p5-03-sign-in-ui-account-route.md)      | Sign-in UI + account route                      | 5.2                      |
| 49  | [5.4](p5-04-security-review.md)               | Security review I                               | 5.3                      |
| 50  | [6.1](p6-01-schema-version-group-ids.md)      | Schema version + group ids (local)              | 5.4                      |
| 51  | [6.2](p6-02-documents-api.md)                 | Documents API                                   | 6.1                      |
| 52  | [6.3](p6-03-remote-persistence.md)            | Remote persistence in the store                 | 6.2                      |
| 53  | [6.4](p6-04-recovery-retention-erasure.md)    | Recovery drills, retention, erasure             | 6.3                      |
| 54  | [6.5](p6-05-data-security-check-closeout.md)  | Data-layer security check + close-out           | 6.4                      |

## Phase gates

- **Phase 1 done:** `format:check`, `lint`, `typecheck` exit 0;
  `npx playwright test --repeat-each=3` exit 0 with only fixme-marked skips.
- **Phase 2a done:** full suite green against the deployed `/`; cutover PR
  contains only the three expected changes (rollback = one revert).
- **Phase 2b done:** suite + unit tests green; visual baselines committed;
  persistence contract test green (same three keys).
- **Phase 3 done:** DEF registry has zero open rows (or a recorded decision);
  corrupt-seed test shows recovery, not a dead page.
- **Phase 4 done:** the live URL is the new origin; the teacher confirms her
  data there; the full suite is green against production; Vercel Support's
  answer (or the Pro decision) is recorded; GitHub Pages redirects or is
  retired.
- **Phase 5 done:** the owner signs in with Google on production; a
  non-allowlisted account cannot; the 5.4 checklist has a result per row; no
  app data is stored on the server yet.
- **Phase 6 done:** RP-09's acceptance criteria 18, 19, 21 and 23 hold as
  green specs (a wiped profile restores by signing in; the indicator does not
  advance offline; a second account cannot read the data; a lower-version
  client writes nothing); the recovery drills are recorded; no `TBD` in the
  context files lacks a date and an owner.

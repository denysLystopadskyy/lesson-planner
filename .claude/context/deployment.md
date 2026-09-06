# Deployment

How the site reaches GitHub Pages. Referenced from [CLAUDE.md](../../CLAUDE.md).
Background: [RP-04](../../docs/research/rp04-build-deploy/rp04-build-deploy.md).

## Decided

- **Hosting:** GitHub Pages, project site at
  `https://denyslystopadskyy.github.io/lesson-planner/`.
- **Publishing source: GitHub Actions**, since 2026-09-06. The owner switched
  it and set `PAGES_ACTIONS=true` that day, and the first Actions deploy served
  a root page byte-identical to the branch-published one. Before that it was
  branch `main`, folder `/`.
- **The site is now exactly two paths:** `/` (the legacy `index.html`) and
  `/next/` (the React staging build). `docs/` and the raw `app/` sources
  returned 404 straight after the switch, as intended.
- **Staging isolation is verified live, not merely configured.** With one group
  seeded under `groupLessonPlannerData` and another under
  `next:groupLessonPlannerData`, the `/next/` build rendered only the prefixed
  one and left the unprefixed key untouched.
- **Merge-target rule:** every plan batch is a pull request into `main`.
  "Deployable" means: after the merge, the live site still serves correctly.
- **Never select `main` + `/docs` as the publishing source.** That would
  publish the research folder instead of the app.
- **The Actions switch is done** (2026-09-06). The workflow is no longer inert:
  every push to `main` now publishes. Rollback stays one step — set
  `PAGES_ACTIONS` to `false`, or switch the source back to branch `main` / `/`.
- **Cutover and rollback:** the cutover to the React build is one PR that
  changes the workflow and deletes the legacy file. Rollback is one revert of
  that PR. The origin and the three storage keys never change (see
  [storage-data-contract.md](storage-data-contract.md)).
- While publishing is branch-based, source files in `app/` are published raw
  at `/lesson-planner/app/`. This is harmless and stops after the Actions
  switch.

- **Node is pinned to 24 in CI** (`actions/setup-node` with `node-version: '24'`),
  matching the version the toolchain was installed and verified against
  (v24.10.0). Set in plan batch 1.7. The deploy workflow in batch 2a.2 must use
  the same major.
- **The deploy workflow exists and is inert.** `.github/workflows/deploy.yml`
  builds the site and assembles the artifact on every push to `main`, but its
  deploy job is gated on the repository variable `PAGES_ACTIONS` being `true`.
  Until the owner sets it and switches the publishing source, the workflow
  proves the build and stops. Runbook: plan batch
  [2a.2](../../docs/plan/p2a-02-deploy-workflow-runbook.md).
- **After the Actions switch, only the assembled artifact is published.** Today
  Pages copies the whole branch, so `docs/` and the raw `app/` sources are
  served. The workflow publishes just two things: the legacy `index.html` at
  `/`, copied rather than rebuilt so it stays byte-identical, and the React
  build at `/next/`. That is a deliberate narrowing, not an omission.
- **The `/next/` build sets `VITE_STORAGE_PREFIX=next:`.** Staging shares the
  origin with the real app, so the prefix is the only thing keeping it away
  from the teacher's data. Never remove it before the cutover in batch
  [2a.4](../../docs/plan/p2a-04-cutover.md), which is where the prefix is
  dropped deliberately and the app moves to `/`.
- **CI is advisory until the owner makes it required.** The workflow runs on
  every pull request, but a red run does not block a merge. Turning it into a
  required status check is Settings → Branches → rule for `main` → Require
  status checks → select `checks`. Owner-only, like the Pages switch below.

## TBD

- Nothing. The two owner-only actions this file tracked — the publishing-source
  switch and the CI-required check — are settled or recorded elsewhere: the
  switch happened on 2026-09-06, and making CI a required status check is still
  optional and noted above.

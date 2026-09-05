# Deployment

How the site reaches GitHub Pages. Referenced from [CLAUDE.md](../../CLAUDE.md).
Background: [RP-04](../../docs/research/rp04-build-deploy/rp04-build-deploy.md).

## Decided

- **Hosting:** GitHub Pages, project site at
  `https://denyslystopadskyy.github.io/lesson-planner/`.
- **Publishing source today:** branch `main`, folder `/` (root). Verified
  2026-08-20. There is no `gh-pages` branch and no workflow.
- **Merge-target rule:** every plan batch is a pull request into `main`.
  "Deployable" means: after the merge, the live site still serves correctly.
- **Never select `main` + `/docs` as the publishing source.** That would
  publish the research folder instead of the app.
- **Switch to GitHub Actions publishing** is required before build-based
  deploys. It is a one-time Settings change that only the repository owner can
  make. Plan batch 2a.2 ships the workflow inert (gated on a repository
  variable) plus a runbook for the owner.
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
- **CI is advisory until the owner makes it required.** The workflow runs on
  every pull request, but a red run does not block a merge. Turning it into a
  required status check is Settings → Branches → rule for `main` → Require
  status checks → select `checks`. Owner-only, like the Pages switch below.

## TBD

- Date of the owner's publishing-source switch — record when done (batch 2a.2).

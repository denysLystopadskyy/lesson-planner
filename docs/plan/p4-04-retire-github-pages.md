# Batch 4.4 — Retire GitHub Pages

Phase 4 · [Plan home](README.md) · Prev: [4.3](p4-03-cutover-to-vercel.md) · Next: [5.1](p5-01-neon-database-plumbing.md)

## Goal

The old URL sends visitors to the new one. No workflow builds for Pages any
more. Nothing the retired workflow checked is lost.

## Tasks

- [ ] Wait for the window end date recorded in
      [deployment.md](../../.claude/context/deployment.md).
- [ ] **Owner chooses:** (a) `deploy.yml` publishes one small static page that
      redirects to the new URL, or (b) Pages is disabled in Settings and
      `deploy.yml` is deleted. (a) is kinder to old bookmarks. Record the
      choice.
- [ ] Remove the `PAGES_ACTIONS` variable and every note about
      `--base=/lesson-planner/`. The app is served from `/` now.
- [ ] Confirm that every check the retired `verify` job ran is in `ci.yml`
      (`typecheck:app` moved there in [4.2](p4-02-api-skeleton-local-server.md);
      check the rest line by line).
- [ ] Keep the `VITE_STORAGE_PREFIX` mechanism. A preview deployment has its
      own origin, so it never needs the prefix; the e2e fixtures still do.
      Say so in storage-data-contract.md.
- [ ] Update deployment.md: the Pages section becomes history with dates.
      Update `CLAUDE.md`: the app "runs on GitHub Pages at …" line becomes the
      new URL.
- [ ] If the change touches a `workflow_dispatch` trigger, plan two PRs and say
      which is first ([lessons learned](lessons-learned.md), lesson 22).

## Acceptance criteria

- The old URL returns the redirect page (choice a) or is documented as retired
  (choice b).
- `grep -ril "github pages" .github/` returns only the redirect publisher, or
  nothing.
- Full suite exit 0. `format:check`, `lint`, `typecheck`, `typecheck:app`,
  `typecheck:api` clean.

## Merge order and dependencies

Depends on 4.3 and the window end date. Closes Phase 4. Deployable: yes.

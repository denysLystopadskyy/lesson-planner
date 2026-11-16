# Batch 4.4 — Retire GitHub Pages

Phase 4 · [Plan home](README.md) · Prev: [4.3](p4-03-cutover-to-vercel.md) · Next: [5.1](p5-01-neon-database-plumbing.md)

**Updated in batch [6.0](p6-00-record-server-first.md) on 2026-11-16.** Since
2026-11-15 this batch runs after the teacher has moved her data into her account
([4.3](p4-03-cutover-to-vercel.md), behind Phase 6). It gains the cleanup task
below.

## Goal

The old URL sends visitors to the new one. No workflow builds for Pages any
more. Nothing the retired workflow checked is lost. The teacher's copy of her
data on the old site is removed, by her, before the site is retired.

## Tasks

- [ ] Wait for the window end date recorded in
      [deployment.md](../../.claude/context/deployment.md).
- [ ] **Old-site cleanup (decided 2026-11-15).** The old origin keeps her copy
      of the data as the rollback until this batch. At the end of the window,
      add a **Remove my data from this old site** button to the "moved" banner.
      It removes every planner key on that origin: the three data keys,
      `groupLessonPlannerLastBackup` and every `.pre-import.*`, `.pre-v*.*` and
      `.corrupt.backup` copy. It asks for a confirmation that names what goes. This is a code change in `app/`, so the batch follows Red then Green
      for it, with a test condition and a fault seeding table on its page (R3:
      the button must not remove anything outside the planner keys). Record in
      [deployment.md](../../.claude/context/deployment.md) the date she pressed
      it.
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

- The teacher can remove her planner data from the old site with one button,
  after a confirmation, and nothing outside the planner keys is removed.
- The old URL returns the redirect page (choice a) or is documented as retired
  (choice b).
- `grep -ril "github pages" .github/` returns only the redirect publisher, or
  nothing.
- Full suite exit 0. `format:check`, `lint`, `typecheck`, `typecheck:app`,
  `typecheck:api` clean.

## Merge order and dependencies

Depends on 4.3 and the window end date. Local mode, and with it DEF-029 and
DEF-030, retires with Pages here. Closes Phase 4. Deployable: yes.

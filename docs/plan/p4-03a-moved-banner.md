# Batch 4.3a — The banner that says where the app went

Phase 4 · [Plan home](README.md) · Prev: [4.2c](p4-02c-one-function.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

The old site can tell the teacher the app has moved, and ask her to carry her
data across. Built now, switched on later.

## Why this is its own batch

[4.3](p4-03-cutover-to-vercel.md) is the cutover, and it cannot start: its own
preconditions require Vercel Support's answer on the Hobby non-commercial
clause, which is outstanding. The banner is the one piece of 4.3 that is inert —
absent unless a variable is set — so it can land while that answer is awaited.

Nothing about this batch moves the teacher. The banner does not appear until the
owner sets the `MOVED_TO` repository variable.

## Tasks

- [x] `app/src/MovedBanner.tsx`: the notice, and `movedTo()` reading
      `VITE_MOVED_TO` at build time. A blank or whitespace-only value counts as
      not moved — a workflow that defines the variable and leaves it empty is
      the likely accident, and a banner pointing at nowhere is worse than none.
- [x] Render it above the storage notices in `App.tsx`. If the app has moved,
      that is the most important thing on the page.
- [x] The export button is **in** the banner. The sentence asks her to export;
      the button should be under the sentence, not in a toolbar she has to find.
- [x] `deploy.yml` passes `VITE_MOVED_TO: ${{ vars.MOVED_TO }}`. Gated on a
      repository variable for the same reason `PAGES_ACTIONS` is: the banner
      must not appear before the cutover actually happens. The Vercel build
      never sets it, so the new site cannot tell her to leave the new site.
- [x] e2e specs for both states. This needs two bundles, because a build-time
      value cannot be changed from a running page: `npm run serve` also builds
      `app/dist/moved/` with the variable set, and the spec opens it through the
      existing `basePath` fixture option — the same mechanism the `/next/`
      staging build used before the 2a.4 cutover. Neither `npm run build:app`
      nor the Pages workflow produces that directory, so it never deploys.

## Acceptance criteria

- [x] The banner is absent by default, and the planner still renders — asserted
      together, because a page that failed to render entirely would also have no
      banner and would pass the first check alone.
- [x] With the variable set: the banner names the address, links to it, offers
      the export, and the planner still works underneath.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and
      `check:pii` clean.
- [ ] The banner is live on the Pages site. **Owner action, at cutover time:**
      set the repository variable `MOVED_TO` to the new origin. Recorded in
      [4.3](p4-03-cutover-to-vercel.md)'s results table, not here.

## Merge order and dependencies

Depends on 3.3 (the export must exist for the banner to point at) and 4.2c.
Does **not** depend on the Support answer, because nothing here is switched on.
Deployable: yes — the banner is absent until a variable is set.

# Batch 2b.8 — Visual regression suite

Phase 2b · [Plan home](README.md) · Prev: [2b.7](p2b-07-styles-extraction.md) · Next: [2b.9](p2b-09-hash-routing.md)

## Run out of order, on purpose

This batch was scheduled after [2b.6](p2b-06-svg-icons.md) and
[2b.7](p2b-07-styles-extraction.md), because pixel baselines want deterministic
icons and final styles. It ran first, in two PRs, at the owner's request
(2026-09-06): batch [2a.3f](p2a-03f-layout-fix-visual-checks.md) had shipped
seven screenshot assertions gated on `process.platform === "darwin"`, and a
check that skips in CI is not a check.

The precondition it skipped is real but weaker than it looked. Emoji rendering
is only non-deterministic **across** environments; inside one pinned container
image it is fixed. Pinning the image buys the determinism that 2b.6 was going to
buy by removing the emoji. 2b.6 still lands, and the baselines are regenerated
then — one dispatch, reviewed like any other UI change.

## Goal

Pixel screenshots guard the key views, in CI, on every pull request.

## Tasks

- [x] ~~`visual.spec.ts`: main screen (empty and filled), group modal, calendar
      in edit mode, review modal — `toHaveScreenshot` baselines~~ — done in
      [2a.3f](p2a-03f-layout-fix-visual-checks.md), plus the template editor,
      the group edit form and the empty state: seven screens.
- [x] Every job that runs the suite moves into one Playwright image, pinned by
      **digest** — `checks` in `ci.yml`, `verify` in `deploy.yml`, and the new
      `baselines.yml`.
- [x] `.github/workflows/baselines.yml`: renders the Linux baselines in that
      image, proves them in a second pass, uploads them. It does not commit.
- [x] `failOnFlakyTests` — without it a screenshot that passes on retry keeps
      the run green, which is the failure mode this batch exists to catch.
- [x] Remove the `darwin` gate; both platform sets coexist because Playwright
      puts the platform in the filename.
- [x] Update policy documented in
      [testing.md](../../.claude/context/testing.md), including how to re-pin
      the digest.
- [x] Prove the baselines are sensitive: make a one-pixel style change, watch
      the job fail, revert. Done in PR B — `button { padding: 6px 10px }` to
      `11px` failed **all seven** screenshot tests, through both CI retries
      ([run 34040334054](https://github.com/denysLystopadskyy/lesson-planner/actions/runs/34040334054)),
      while the accessibility and geometry levels stayed green. That is the
      division of labour working: one pixel is below what geometry asserts and
      invisible to an accessibility tree.

## Why the workflow uploads instead of committing

`--update-snapshots` blesses whatever the code renders now — it cannot tell a
redesign from a regression, so a person has to look at the diff. And a push made
with `GITHUB_TOKEN` triggers no workflows: a bot commit would never be
re-checked, while the owner's own push triggers CI and re-compares the committed
bytes in a fresh container. That re-check is the verification; the pass inside
the rendering run is not.

## Two PRs, and the order is forced

`workflow_dispatch` reads its trigger from the **default branch**, so
`baselines.yml` cannot be dispatched from a branch until it has been merged.

1. **PR A** — the container, the workflow file, `failOnFlakyTests`, the records.
   The `darwin` gate stays, so `main` keeps a green `verify` and the site keeps
   publishing.
2. **PR B** — remove the gate, dispatch the workflow against the branch, commit
   the seven `*-linux.png`, and let the branch's own CI re-compare them.

Removing the gate in PR A would put a red `verify` on `main` with no Linux
baselines to compare against, and `verify` gates the deploy.

## Acceptance criteria

- [x] CI job green with committed baselines.
- [x] A deliberate 1px style change fails the job — verified in
      [run 34040334054](https://github.com/denysLystopadskyy/lesson-planner/actions/runs/34040334054),
      then reverted.

## What the first dispatch taught

`--update-snapshots=missing` writes the absent PNGs **and still reports those
tests as failed**, so the upload step never ran and the run came back with seven
failures and no artifact. The write step now tolerates its own failure; the
second pass, which runs with no update flag, is the gate. A baseline that exists
and differs still fails the job — which the 1px check then proved.

Timing, since the container was the open question: the containerised `checks`
job runs in **1m20s**, against 1m45s on a bare runner with a warm browser cache.
The image ships the browsers, so the install and cache steps disappear and pay
for the pull.

## Merge order and dependencies

Depended on 2b.6 and 2b.7 as written; run early instead, with the container
supplying the determinism 2b.6 was meant to. 2b.6 regenerates the baselines when
the emoji become SVG. Deployable: yes.

# Deployment

How the site reaches its host. Referenced from [CLAUDE.md](../../CLAUDE.md).
Background: [RP-04](../../docs/research/rp04-build-deploy/rp04-build-deploy.md)
for the GitHub Pages era; the
[RP-10 hosting page](../../docs/research/rp10-service-evaluation/hosting.md)
for the move to Vercel.

## Decided on 2026-09-09 — the move to Vercel (plan Phase 4)

- **Hosting moves to Vercel** on the Hobby plan: one project linked to this
  repository through Vercel for GitHub. Functions run in region `fra1`
  (Frankfurt) on Node 24. Every pull request gets a preview deployment; `main`
  deploys to production. Why Vercel and not Cloudflare, Netlify or staying on
  Pages: the RP-10 hosting page. The evaluation is dated 2026-09-09; re-check
  the pricing and fair-use pages before batch 4.3.
- **The Hobby plan's non-commercial clause is an open risk until Vercel
  Support answers in writing.** The question is sent in plan batch
  [4.1](../../docs/plan/p4-01-vercel-project-previews.md); the answer is
  recorded here with its date. If the answer is no: Vercel Pro ($20/month on
  2026-09-09) or Cloudflare Workers (RP-10's runner-up). Batch 4.3 does not
  start on Hobby without an answer.
- **The origin changes once, in batch
  [4.3](../../docs/plan/p4-03-cutover-to-vercel.md), and only through a
  rehearsed export/import** (RP-07 §6 Procedure B, with the batch 3.3 export).
  This replaces the older rule that the origin may never change. An origin
  change is still never part of a rollback: after 4.3, rollback is "keep using
  the old URL", because the Pages site keeps serving her untouched data during
  the transition window.
- **Transition window.** After the cutover, GitHub Pages keeps serving the full
  app with a "moved" banner (build variable `VITE_MOVED_TO`) until the date
  recorded below. Then batch
  [4.4](../../docs/plan/p4-04-retire-github-pages.md) retires Pages: a redirect
  page, or Pages disabled — the owner's choice.
- **"A red suite cannot publish" must survive the move.** Vercel's Git
  integration deploys `main` whatever CI says. Two ways to keep the property:
  make the CI `checks` job a **required status check** for `main` (owner
  action, recommended), or deploy from GitHub Actions with `vercel build` and
  `vercel deploy --prebuilt`, gated on the verify job. Batch 4.3 records the
  choice here.
- **Rollback on Vercel:** Instant Rollback to the immediately previous
  deployment (the Hobby limit), plus `git revert` of the offending PR. The
  Pages-era rollback (`PAGES_ACTIONS=false`) ends with batch 4.4.
- **Build settings** (also in the 4.1 runbook): root = repository root; build
  `npm run build:app`; output `app/dist`; install `npm ci`; Node 24;
  `vercel.json` holds `regions` only. The Vite `base` is `/` on Vercel and
  `/lesson-planner/` on Pages — passed by the build flag, never set in
  `vite.config.ts` ([react-migration.md](react-migration.md)).
- **Previews are protected** by Vercel Authentication (the Hobby default);
  automation uses the documented bypass header. Production is public.
- **Every secret on Vercel is created as Sensitive, and MFA is on.** The April
  2026 Vercel incident exposed non-sensitive variables. Details in
  [security-auth.md](security-auth.md).
- **Two batches are inert for the live site and may land during Phase 3.**
  4.1 and 4.2 change `vercel.json`, `package.json`, `api/`, `scripts/` and the
  workflows only. The plan hub records this as the one exception to strict
  merge order.
- **Custom domain: recommended; the owner decides (TBD below).** If yes, it is
  set up before the teacher migrates in 4.3, so the origin she moves to is the
  one that stays for any later host change.

## Decided — the GitHub Pages era (how the site is served until batch 4.3)

- **Hosting:** GitHub Pages, project site at
  `https://denyslystopadskyy.github.io/lesson-planner/`.
- **Publishing source: GitHub Actions**, since 2026-09-06. The owner switched
  it and set `PAGES_ACTIONS=true` that day, and the first Actions deploy served
  a root page byte-identical to the branch-published one. Before that it was
  branch `main`, folder `/`.
- **The site is one path since the cutover (plan batch 2a.4):** `/` serves the
  React build. Between the Actions switch and the cutover it was two — `/` for
  the legacy `index.html` and `/next/` for the staging build. `docs/` and the
  raw `app/` sources return 404, as intended.
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
- **Cutover and rollback:** the cutover happened in plan batch 2a.4. Rollback is
  one revert of that PR, which restores `index.html`, the two-project suite and
  the `/next/` publish together. The origin and the three storage keys never
  changed, which is why the teacher's data survived the move (see
  [storage-data-contract.md](storage-data-contract.md)).
- **The cutover PR is larger than the plan predicted, and the guarantee is
  unaffected.** The plan said three files. Deleting `index.html` also retires
  the project that served it, the specs whose subject was that page, and the
  `@ported` tags that told the two projects apart. The guarantee was never a
  file count — it is that the batch is one squashed commit, so `git revert`
  restores every part of it at once.
- While publishing is branch-based, source files in `app/` are published raw
  at `/lesson-planner/app/`. This is harmless and stops after the Actions
  switch.
- **Node is pinned to 24 in CI** (`actions/setup-node` with `node-version: '24'`),
  matching the version the toolchain was installed and verified against
  (v24.10.0). Set in plan batch 1.7. The deploy workflow in batch 2a.2 must use
  the same major. Batch 4.1 adds `"engines": { "node": "24.x" }` so Vercel
  agrees too.
- **The deploy workflow exists and is inert.** `.github/workflows/deploy.yml`
  builds the site and assembles the artifact on every push to `main`, but its
  deploy job is gated on the repository variable `PAGES_ACTIONS` being `true`.
  Until the owner sets it and switches the publishing source, the workflow
  proves the build and stops. Runbook: plan batch
  [2a.2](../../docs/plan/p2a-02-deploy-workflow-runbook.md).
- **Only the assembled artifact is published.** Branch-based publishing copied
  the whole branch, so `docs/` and the raw `app/` sources were served. The
  workflow publishes one thing: the React build at `/`. That is a deliberate
  narrowing, not an omission. Between the Actions switch and the cutover it
  published two — the legacy page at `/`, copied rather than rebuilt so it
  stayed byte-identical, and the staging build at `/next/`.
- **The `/next/` build sets `VITE_STORAGE_PREFIX=next:`.** Staging shares the
  origin with the real app, so the prefix is the only thing keeping it away
  from the teacher's data. Never remove it before the cutover in batch
  [2a.4](../../docs/plan/p2a-04-cutover.md), which is where the prefix is
  dropped deliberately and the app moves to `/`.
- **CI is advisory until the owner makes it required.** The workflow runs on
  every pull request, but a red run does not block a merge. Turning it into a
  required status check is Settings → Branches → rule for `main` → Require
  status checks → select `checks`. Owner-only, like the Pages switch above.
  Batch 4.3 makes this the recommended way to keep "a red suite cannot
  publish" on Vercel.
- **`deploy.yml` is the only workflow that runs `typecheck:app`.** CI does
  not. Batch [4.2](../../docs/plan/p4-02-api-skeleton-local-server.md) moves
  the step into `ci.yml` before batch 4.4 retires `deploy.yml`, so the check
  is not lost with the workflow.

## TBD (owner decisions, all Phase 4)

- Vercel Support's answer on the Hobby plan — batch 4.1. Date and answer here.
- Custom domain: yes or no; if yes, which — batch 4.3.
- The CI-gate choice: required status check, or CLI deploy from Actions — batch
  4.3.
- Transition window end date — batch 4.3.
- Pages retirement: redirect page or disabled — batch 4.4.

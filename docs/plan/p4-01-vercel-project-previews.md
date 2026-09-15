# Batch 4.1 — Vercel project and preview deployments (inert)

Phase 4 · [Plan home](README.md) · Prev: [3.7](p3-07-cleanup.md) · Next: [4.2](p4-02-api-skeleton-local-server.md)

## Goal

Every push and every pull request builds and deploys on Vercel. GitHub Pages
stays the live site. The teacher notices nothing.

Why first: the host must be proven before anyone moves to it. Preview URLs
also help the remaining Phase 3 reviews. Decisions and figures:
[RP-10 hosting page](../research/rp10-service-evaluation/hosting.md),
[deployment.md](../../.claude/context/deployment.md).

## Tasks

- [x] Add `vercel.json` with `"regions": ["fra1"]` and nothing else. Hash
      routing needs no rewrite rules. Confirmed: `app/src/route.ts` keeps every
      routable thing after the `#`, so it is base-path independent.
- [x] Add `"engines": { "node": "24.x" }` to `package.json`, so Vercel, CI and
      the local machine agree on the Node major. This machine runs v24.10.0; CI
      takes Node from the pinned Playwright container.
- [x] Write the owner runbook below, including the question to Vercel Support.
- [ ] After the owner has created the project: run the full suite against the
      production `*.vercel.app` URL with a temporary deployed config, the way
      batch [2a.4](p2a-04-cutover.md) did (spread the real config, drop the
      `webServer`, set `PW_BASE_URL`). It is a measuring tool, not a fixture:
      keep it in the scratchpad, do not commit it.
- [ ] Record in [deployment.md](../../.claude/context/deployment.md): the
      project settings, the production URL, the date, and the Support answer
      when it arrives.

## Owner runbook

Steps 1–6 are yours. A collaborator cannot do them.

1. Create the Vercel account (Hobby) and **turn on MFA**. Reason: the April 2026
   incident described on the hosting page.
2. Install "Vercel for GitHub" for **this repository only**.
3. New project from the repository. Framework preset: Vite. Root directory:
   the repository root. Build command: `npm run build:app`. Output directory:
   `app/dist`. Install command: `npm ci`. Node.js version: 24.x.
4. Settings → Functions → region `fra1` (Frankfurt). The file `vercel.json`
   says the same; the setting and the file must agree.
5. Deployment Protection: keep "Vercel Authentication" on for preview
   deployments (the default). Production stays public.
6. Do **not** add a custom domain yet. Batch [4.3](p4-03-cutover-to-vercel.md)
   decides that, before the teacher moves.
7. Write to Vercel Support. Suggested text: "I host a small personal tool for
   one self-employed teacher. It helps her plan lesson dates and compute what
   her students owe. It has no ads, sells nothing, requests no payment from
   visitors, and nobody is paid to build or host it. Does this fit the Hobby
   plan's personal, non-commercial use?" Record the answer, with the date, in
   deployment.md. If the answer is no, the fallbacks are Vercel Pro or
   Cloudflare Workers — see the hosting page. Batch 4.3 does not start on
   Hobby without an answer.

### Runbook results

| Step                      | Date       | Result                                                                                                                                                                       |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Account, MFA          | 2026-09-15 | Done by the owner. Account `denys13`.                                                                                                                                        |
| 2 — GitHub app installed  | 2026-09-15 | Done. Vercel now posts a deployment status and a check run on every push and PR.                                                                                             |
| 3 — Project settings      | 2026-09-15 | Project `lesson-planner`. Production: `https://lesson-planner-lac.vercel.app`.                                                                                               |
| 4 — Region `fra1`         | 2026-09-15 | Confirmed **from the running function**, not from the dashboard — see 4.2's table.                                                                                           |
| 5 — Deployment Protection | 2026-09-15 | Previews protected; production public. It covered production at first, which would have blocked the teacher entirely — she cannot sign in to Vercel. Corrected the same day. |
| 7 — Support question sent |            |                                                                                                                                                                              |
| 7 — Support answer        |            | Outstanding. Gates batch [4.3](p4-03-cutover-to-vercel.md).                                                                                                                  |

### What each step unblocks

The code half of this batch is merged. Nothing else in Phase 4 can move until
steps 1–5 are done, because every remaining gate needs a real deployment.

| Owner step                  | Unblocks                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| 1–3 — account, app, project | The preview-URL and production-URL rows above, and the whole of batch 4.2's remote half  |
| 4 — region `fra1`           | 4.2's `region: "fra1"` assertion; a wrong region is a silently passing health check      |
| 5 — Deployment Protection   | Running the suite against a preview URL at all                                           |
| 7 — Support question        | Batch [4.3](p4-03-cutover-to-vercel.md), which does not start on Hobby without an answer |

Step 6 (no custom domain yet) is a deliberate non-action; batch 4.3 decides it.

Once the project exists, the next thing to do is not on this page: batch
[4.2](p4-02-api-skeleton-local-server.md) has five checks waiting on a
deployment, with the steps to run them written out under "How to fill it in".

## Acceptance criteria

The code half of this batch ships on its own. Every other criterion needs a
Vercel project, which only the owner can create, so they are **moved** to the
results table above rather than ticked — the split CLAUDE.md requires when a
gate cannot be met by what the batch ships, and the shape of
[lesson 8](lessons-learned.md).

Met by this pull request:

- [x] `vercel.json` holds `regions` and nothing else; `package.json` pins the
      Node major. `format:check`, `lint`, `typecheck`, `typecheck:app`,
      `check:pii`, `test:unit` and the Playwright suite are all green with them.
- [x] The GitHub Pages site is unchanged. Nothing in this PR is read by
      `deploy.yml`, and `vercel.json` is inert without a Vercel project.
- [x] The Vercel URL is not given to the teacher — there is no URL yet.

Moved to the results table (owner, then a follow-up PR):

- A pull request shows a Vercel preview URL and a green Vercel status.
- The production `*.vercel.app` URL serves the app built from `main`.
- The full suite is green against that URL, pixel baselines included. Same
  bundle, same pixels: this proves the host serves the same bytes.
  **Not achieved yet, and not for want of a green deployment.** Three attempts
  on 2026-09-15 each measured something other than the app — a piped exit code,
  a config deleted by a concurrent job, and a machine running builds during the
  run — and the last of them provoked Vercel's DDoS mitigation against this IP.
  The health route and the app both answer 200 from outside that IP. Do this
  once, with `--workers=1`, on an idle machine: see
  [lesson 29](lessons-learned.md).
- The Support question was sent and is recorded. The answer is recorded when
  it arrives; it gates 4.3, not this batch.

## Merge order and dependencies

Depends on [3.3](p3-03-json-backup.md) (the export/import must exist before
any host work starts). Parallel-safe with 3.4a–3.7: this batch touches
`vercel.json` and `package.json` only. Deployable: yes — GitHub Pages is
untouched.

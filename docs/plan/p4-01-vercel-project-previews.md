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

- [ ] Add `vercel.json` with `"regions": ["fra1"]` and nothing else. Hash
      routing needs no rewrite rules.
- [ ] Add `"engines": { "node": "24.x" }` to `package.json`, so Vercel, CI and
      the local machine agree on the Node major.
- [ ] Write the owner runbook below, including the question to Vercel Support.
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

| Step                      | Date | Result |
| ------------------------- | ---- | ------ |
| 1 — Account, MFA          |      |        |
| 2 — GitHub app installed  |      |        |
| 3 — Project settings      |      |        |
| 4 — Region `fra1`         |      |        |
| 5 — Deployment Protection |      |        |
| 7 — Support question sent |      |        |
| 7 — Support answer        |      |        |

## Acceptance criteria

- A pull request shows a Vercel preview URL and a green Vercel status.
- The production `*.vercel.app` URL serves the app built from `main`.
- The full suite is green against that URL, pixel baselines included. Same
  bundle, same pixels: this proves the host serves the same bytes.
- The Support question was sent and is recorded. The answer is recorded when
  it arrives; it gates 4.3, not this batch.
- The GitHub Pages site is unchanged. The Vercel URL is not given to the
  teacher.
- A follow-up PR fills the results table (a batch that deploys cannot close at
  PR time — [lessons learned](lessons-learned.md)).

## Merge order and dependencies

Depends on [3.3](p3-03-json-backup.md) (the export/import must exist before
any host work starts). Parallel-safe with 3.4a–3.7: this batch touches
`vercel.json` and `package.json` only. Deployable: yes — GitHub Pages is
untouched.

# Batch 5.1 — Neon project and database plumbing

Phase 5 · [Plan home](README.md) · Prev: [4.4](p4-04-retire-github-pages.md) · Next: [5.2](p5-02-better-auth-google-allowlist.md)

## Goal

The function can reach a Postgres database in Frankfurt, migrations are one
command, tests run against Postgres with no infrastructure, and no connection
string can ever reach the browser.

Decisions and figures:
[RP-10 database page](../research/rp10-service-evaluation/database.md),
[backend.md](../../.claude/context/backend.md),
[security-auth.md](../../.claude/context/security-auth.md).

## Tasks

**Batches [5.0](p5-00-neon-project-link.md) and
[5.1a](p5-01a-database-plumbing.md) already did most of this.** 5.1a shipped the
workspace package, the driver seam, PGlite, `db:generate`/`db:migrate` and the
`db` field on `GET /api/health`, all proven on a laptop. What is left here is
what needs a console or a deployment, and one decision:

- The owner's DPA acceptance, the integration shape, the Sensitive flags.
- `db: "ok"` on production **and** on a preview deployment.
- The **function** cold start after five idle minutes. The _database_ wake is
  already measured: 1197 ms cold, 35 ms warm, recorded in backend.md.
- Whether Vercel's file tracing bundles the `@lesson-planner/db` workspace
  package into the function. The fallback if it does not is in backend.md.
- **The build-command conflict.** This page says migrations run in the Vercel
  build command; deployment.md records that command as `npm run build:app`.
  Decide which changes, and write it down.

The "migrations apply" gate moved to **5.2**: 5.1a owns no tables, so
`drizzle-kit generate` emits no SQL and there is nothing to apply yet.

**Batch [5.0](p5-00-neon-project-link.md) already did part of this.** The Neon
project exists in Frankfurt, the repository is linked to it, and `.env.local`
holds `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` — so the fourth
task below is done. The project also carries a `vercel-dev` branch beside
`production`, which suggests the integration is installed and makes its own
branches. **Check that before redoing the second task**, and record what is
actually true rather than assuming either way. The DPA task is untouched: 5.0
stored nothing.

- [ ] **Owner:** create the Neon account (MFA on) and a Free project in
      **Frankfurt** (`aws-eu-central-1`). The region cannot be changed later.
      Re-check the pricing page first; record the figures and the date in
      backend.md if they moved since RP-10.
- [ ] **Owner:** install the Neon ↔ Vercel integration from the Neon side (the
      Neon-managed shape, so the account and billing stay with you). It injects
      `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` into Production and
      Preview. Mark both **Sensitive**. Turn on a database branch per preview
      deployment if the integration offers it; otherwise create one `preview`
      branch by hand and point Preview at it. Record which.
- [ ] **Owner:** read and accept Neon's DPA and Vercel's DPA. Record the dates
      in security-auth.md. Nothing is stored before this is done.
- [x] Copy the connection strings to `.env.local` (gitignored since 4.2). Add
      the names to `.env.example`. **Done in 5.0** — the Neon CLI writes the
      file itself, and the names are in `.env.example`.
- [x] Add `pg`, `drizzle-orm` and `drizzle-kit` (exact pins; peer ranges
      checked). `db/schema.ts` and `db/migrations/`; scripts `db:generate` and
      `db:migrate`. **Done in 5.1a**, plus `@electric-sql/pglite`.
- [ ] Migrations run in the Vercel build command before `vite build`, against
      the deployment's own database (production, or the preview branch).
      Rule: migrations are additive only — never drop or rename a column that
      running code still reads. Record the rule in backend.md.
- [x] `GET /api/health` runs `SELECT 1` and reports `db: "ok"` and the query
      time. The health check must not read or write app data. **Done in 5.1a.**
- [x] Tests without Neon: `@electric-sql/pglite` as a dev dependency; a helper
      creates a PGlite database and applies the migrations. Vitest uses it.
      `scripts/serve.mjs` uses it when `DATABASE_URL` is unset, so
      `npm run serve` and Playwright need no account and no secret.
      **Done in 5.1a.**
- [ ] Unit tests: the migrations apply on PGlite; the health handler reports
      `db: "ok"`.
- [ ] Measure the cold start on production: first request after more than five
      idle minutes. Record the number in backend.md. RP-05 rejected this shape
      on that number; the record should show what it is.

## Acceptance criteria

- `GET /api/health` reports `db: "ok"` on production and on a preview.
- The migration is applied on the production branch; `drizzle-kit` reports
  nothing pending.
- `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are Sensitive on Vercel
  (recorded, with the date).
- After `npm run build:app`, grepping `app/dist` for `neon.tech`, `neon.com`
  and `-pooler` returns nothing.
- `npm run serve` and the full suite work with no `.env.local` present.
- DPA acceptance for Neon and Vercel is recorded.

## Merge order and dependencies

Depends on 4.4. Deployable: yes — nothing user-facing changes.

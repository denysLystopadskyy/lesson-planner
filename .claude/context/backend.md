# Backend: functions, database access, migrations, local serving

Decisions about the server side that arrives with plan Phases 4–6. Referenced
from [CLAUDE.md](../../CLAUDE.md). Background: the
[RP-10 service evaluation](../../docs/research/rp10-service-evaluation/rp10-service-evaluation.md)
(2026-09-09). Nothing in this file exists in the repository yet; the batches
that create each part are named.

## Decided on 2026-09-09

- **One Hono application is the whole backend, mounted as one Vercel
  function.** It hosts the Better Auth handler at `/api/auth/*`, the documents
  API and `GET /api/health`. Why one app: Vercel Hobby caps a deployment at 12
  functions, and one is easy to count; and Hono runs the same code on Vercel,
  on Node (for local work and the e2e suite) and on Cloudflare Workers — the
  hedge for the hosting risk recorded in [deployment.md](deployment.md).
  Handlers use the Web-standard `Request` and `Response` only; nothing imports
  a Vercel-only helper. Arrives in plan batch
  [4.2](../../docs/plan/p4-02-api-skeleton-local-server.md).
- **Layout:** `api/` holds the entry file and the Hono app; `db/` holds the
  Drizzle schema and migrations (batch 5.1); `shared/` holds validation code
  used by both `app/` and `api/` (batch 6.2); `scripts/serve.mjs` is the local
  server. Each has TypeScript coverage and a typecheck script; CI runs
  `typecheck:app` and `typecheck:api`.
- **Local serving:** `npm run serve` builds the app and runs `scripts/serve.mjs`,
  which serves `app/dist` as static files and mounts the same Hono app under
  `/api` on port 4173. Playwright's `webServer` is unchanged. No Vercel CLI is
  needed to run or test the project.
- **Database access:** `pg` over TCP against Neon's **pooled** connection
  string, from one module-scope pool. Not the Neon HTTP driver: its pool must
  be opened and closed per request, which does not suit an auth library that
  holds one pool. This is also Neon's own guidance for Vercel's default compute
  model (RP-10 database page).
- **Schema and migrations: Drizzle with drizzle-kit.** One tool for the Better
  Auth tables (generated with the Better Auth CLI into the Drizzle schema) and
  for the app's tables. Migrations run in the Vercel build command before
  `vite build`, against the deployment's own database — production, or the
  preview branch. **Migrations are additive only:** never drop or rename a
  column that running code still reads. Arrives in batch
  [5.1](../../docs/plan/p5-01-neon-database-plumbing.md).
- **Tests run against Postgres without infrastructure: PGlite.** Vitest and the
  local server use an in-process PGlite database with the same migrations
  applied. No Docker, no service container, no CI secret. If a Postgres feature
  PGlite lacks is ever needed, the fallback is a Postgres service container in
  CI — recorded here when it happens.
- **Region and account:** the Neon project lives in Frankfurt
  (`aws-eu-central-1`) under the maintainer's own Neon account, connected to
  Vercel through the Neon-managed integration (env vars injected; account and
  billing stay with the maintainer). Functions run in `fra1`, the same AWS
  region.
- **Environment variables** (names only; values live in Vercel as Sensitive and
  in `.env.local`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `ALLOWED_EMAILS`, `AUTH_TEST_MODE` (local only). `.env.example` lists them.
  The rules for secrets are in [security-auth.md](security-auth.md).
- **Health check:** `GET /api/health` reports `ok`, the commit, the region and,
  from batch 5.1, `db: "ok"` with the query time. It reads no app data and no
  secret beyond the connection string.
- **Data model on the server:** one row per storage key plus an append-only
  history table — see [storage-data-contract.md](storage-data-contract.md).
  Authorization is one `WHERE user_id = ?` on every query; there is no admin
  route and no user listing.
- **Function budget:** 1 of 12. Adding a second function needs a reason
  recorded here.

## TBD (all assigned to Phases 4–6)

- The exact Vercel entry shape for the catch-all (`api/[...all].ts` or a
  `vercel.json` rewrite) — batch 4.2 records which worked.
- Where API unit tests are collected (a second Vitest config or a root one) —
  batch 4.2, recorded in [testing.md](testing.md).
- The measured cold start on production (first request after five idle
  minutes) — batch 5.1.
- Whether a preview deployment gets its own Neon branch through the
  integration, or a fixed `preview` branch — batch 5.1.
- Neon's 90-day inactivity sentence: whether it applies outside Azure regions,
  and whether a monthly keep-alive cron is added — owner asks Neon, batch 6.4.

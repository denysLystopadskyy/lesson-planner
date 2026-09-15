# Backend: functions, database access, migrations, local serving

Decisions about the server side that arrives with plan Phases 4–6. Referenced
from [CLAUDE.md](../../CLAUDE.md). Background: the
[RP-10 service evaluation](../../docs/research/rp10-service-evaluation/rp10-service-evaluation.md)
(2026-09-09). The batches that create each part are named. `api/` and
`scripts/serve.mjs` arrived with batch
[4.2](../../docs/plan/p4-02-api-skeleton-local-server.md); `db/` and `shared/`
do not exist yet.

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

## Decided on 2026-09-15 — in batch 4.2, while building it

- **The catch-all entry shape is `api/[...all].ts` with `export default
app.fetch`, and it is proven.** No `vercel.json` rewrite is needed. The first
  deployment answered `/api/health` and `/api/nope` with a _function_ error
  rather than the static site's 404, which is only possible if Vercel matched
  the catch-all and invoked it. (That deployment then failed for an unrelated
  reason — see the relative-import rule above.) `hono/vercel`'s `handle()` is
  not used and is not needed: it is exactly `(req) => app.fetch(req)`, and both
  report arity 1, so it is the same thing by a longer name.

- **`api/` declares its own module type**, in a three-line `api/package.json`
  holding `{ "type": "module" }`. Node resolves module type from the nearest
  `package.json`, so this makes Node and TypeScript agree that the backend is
  ESM without touching anything else.
  **Do not move this to the root `package.json` instead.** It was tried, and it
  costs 693 type errors: the root `tsconfig.json` uses `module: nodenext`, where
  ESM forbids extensionless relative imports, and every one of the 34 end-to-end
  specs uses them. The repository already scopes module type this way in the
  other direction — `docs/research/tools/package.json` pins `"type": "commonjs"`.
- **`scripts/serve.mjs` imports `api/[...all].ts` directly.** Node 24 strips
  the types at import time, so the local server has no build step and cannot
  serve a stale compiled copy.
  **This was first written as "no build step between the local server and the
  code that runs in production", and that half was wrong.** Vercel _does_
  compile — per file, transpiling `api/[...all].ts` to `api/[...all].js`, not
  bundling. Production and the local server therefore run the same source
  through two different loaders, which is a difference the suite has to check
  rather than assume: `api/deployed-entry.test.ts` compiles the entry and runs
  the output.
- **Nothing under `api/` may import a sibling by a relative path.** No spelling
  works in both places — `./x.ts` resolves only under type stripping, `./x.js`
  and `./x` only after compilation — so the application and the Vercel entry
  are one file. When `db/` and `shared/` arrive in Phases 5 and 6, give them
  bare specifiers (workspace packages), which resolve identically either way.
  Discovered by a failed deployment; see lesson 26.
- **The local server refuses a busy port** and exits non-zero, which is the
  `--strictPort` behaviour `vite preview` used to provide.
  `playwright.config.ts` waits on a TCP listen at 4173, not on an HTTP
  response, and `reuseExistingServer` is on outside CI; a server that bound
  somewhere else would let the whole suite run green against the wrong bytes.
- **`GET /api/health` reports `null`, not a placeholder,** for the commit and
  the region when it is not running on a deployment. A caller can then tell
  "not deployed" from "deployed and the region is wrong" — and the region is
  the thing batch 4.1 asks this route to prove.

## TBD (all assigned to Phases 4–6)

- The measured cold start on production (first request after five idle
  minutes) — batch 5.1.
- Whether a preview deployment gets its own Neon branch through the
  integration, or a fixed `preview` branch — batch 5.1.
- Neon's 90-day inactivity sentence: whether it applies outside Azure regions,
  and whether a monthly keep-alive cron is added — owner asks Neon, batch 6.4.

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
- **`api/` is Vercel's routing table, not a source folder.** Every `.ts` file in
  it becomes a function at its own public path. Anything there that is not the
  entry must be listed in `.vercelignore`, and `api/one-function.test.ts` fails
  if it is not. The first deployment carried four functions — the entry, both
  test files and the Vitest config — against a budget of one; `/api/health.test`
  was a real route. They failed on invocation because `vitest` is not a
  production dependency, which is luck, not design: `deployed-entry.test.ts`
  spawns a compiler. Lesson 28.

## Decided on 2026-09-15 — in batch 4.2, while building it

- **The Vercel entry exports the application object: `export default app`,
  never `export default app.fetch`.** Vercel's Web-standard export is an
  _object carrying a `fetch` method_; a bare function is read as the other
  supported shape, a Node.js `(request, response)` handler. A Hono app is
  already the first of those.
  Getting this wrong fails **silently**. Vercel calls the bare function with
  Node's `IncomingMessage` and `ServerResponse`, discards the `Response` that
  comes back, and waits for a `response.end()` that a Web-standard handler never
  calls — so every request hangs until the function times out, with no error and
  no log line. `hono/vercel`'s `handle()` is a bare function too and is not the
  fix; it is exactly `(req) => app.fetch(req)`, the same thing by a longer name.
  Found by the second failed deployment; see lesson 27.
- **The catch-all name `api/[...all].ts` is proven**, and no `vercel.json`
  rewrite is needed. The first deployment answered `/api/health` and `/api/nope`
  with a _function_ error rather than the static site's 404, which is only
  possible if Vercel matched the catch-all and invoked it.

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

## Decided on 2026-09-17 — in batch 5.0, while linking the project

- **`neon.ts` is the config-as-code surface, and it is deliberately empty.**
  `neon config init` scaffolds a policy that declares `auth: false` and a branch
  policy with a TTL. That scaffold was replaced with `defineConfig({})`. The two
  are not the same thing: `auth: false` **manages** auth and turns it off, while
  an empty policy leaves every service **unmanaged**. Unmanaged is what this
  project wants today, because the database shape is batch 5.1's decision and
  not this batch's.
- **An empty policy is inert, and that was proven rather than assumed.** Neon's
  own documents disagree on the point: the `neon.ts` announcement describes
  reconciliation as additive, while `@neon/config-runtime` documents a
  `PushConflictError` when a branch has drifted from the policy. `neon config
plan` against `production` answered "No changes — branch production already
  matches the policy", and `neon deploy` then reported the same. **Run `neon
config plan` before every `neon deploy`.** It changes nothing, and it is the
  only honest way to know what the apply will do.
- **`neon.ts` and drizzle-kit do not overlap.** `neon.ts` describes the branch
  and service shape of the Neon project. drizzle-kit owns the schema, and still
  runs in the Vercel build command as decided on 2026-09-09. Neither one reads
  the other.
- **The Neon CLI is local tooling only.** It is installed globally on the
  maintainer's machine, never as a project dependency. No file in
  `.github/workflows/` calls it, `deploy.yml` does not, and the Vercel build
  does not. A machine without the CLI can still run every `npm run` script here.
- **`neon deploy` writes `.env.local`, and it merges rather than replaces.** It
  pulls `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` from the
  linked branch; `neon env pull` writes the same three. Both rewrite those three
  lines and **leave every other line alone.** This was tested, not assumed: a
  hand-written line was added, `neon env pull` was run, and the line was still
  there. So Phase 5's auth variables can be hand-written into the same file,
  and only the three names above are the CLI's to own. `neon link` is still run
  with `--no-env-pull`, because its own default target is `.env` — a second
  local secrets file would split the one location the secrets inventory names.
- **`@neon/config` and `@neon/env` are devDependencies.** `neon config init`
  installs both into `dependencies`; they were moved. Nothing under `api/` or
  `app/` imports either one. The production dependency set stays at exactly
  `hono` and `@hono/node-server`.
- **`neon.ts` is listed in the root `tsconfig.json`.** A root-level TypeScript
  file that belongs to no project fails typed linting **on the file rather than
  on its contents** — the same failure `eslint.config.mjs` already records for
  itself and for `scripts/`. It was confirmed here before the fix: "was not
  found by the project service". Adding the file to the root project's `include`
  keeps it type-checked, which an ESLint `ignores` entry would not.
- **`.neon` and `skills-lock.json` are ignored.** `.neon` pins this checkout's
  org, project and branch. `skills-lock.json` pins the Neon agent skills, whose
  content installs into `.claude/skills/` and is ignored already — 21 markdown
  files and no script, so nothing there can change how this machine builds or
  tests. Tracking
  either would pin one machine's setup for everyone. The Neon CLI appends
  `.neon` to `.gitignore` itself, as a bare line; it was rewritten into the
  commented block that the rest of the file uses.
- **The project has two branches today:** `production` (the default) and
  `vercel-dev`, both created on 2026-09-17. This does **not** settle the preview
  question in the TBD list below — that stays batch 5.1's decision — but it
  records what exists.

## Decided on 2026-09-17 — in batch 5.1a, the database plumbing

- **Superseded on 2026-09-17 by batch 5.1b — the workspace package does not
  work on Vercel.** The deployment returned `ERR_MODULE_NOT_FOUND` for
  `/var/task/node_modules/@lesson-planner/db/index.ts`: the package directory
  was traced and created, and no TypeScript source was shipped into it. **The
  deployed entry may import published npm packages and nothing else** — not a
  sibling, and not a workspace package of this repository. The database seam
  therefore lives inside `api/[...all].ts`, where its imports (`pg`,
  `drizzle-orm`, `hono`) are ordinary dependencies that `npm ci` installs as
  real JavaScript. `db/` still holds the schema, the migrations and the PGlite
  helper; nothing deployed loads any of them. `api/deployed-entry.test.ts`
  resolves every import in the entry and fails on one that lands on a `.ts`
  file. Lesson 31. The original entry is kept below because the reasoning that
  produced it was sound and only its conclusion was wrong.
- ~~**`db/` is an npm workspace package, `@lesson-planner/db`, and that is how
  `api/` reaches it.**~~ Lesson 26 predicted a bare specifier would work "because
  a package name resolves the same either way". It was measured before anything
  was built on it: Node 24 strips types inside `node_modules`, so a symlinked
  workspace package's `.ts` files load; and `tsc` leaves a bare specifier
  untouched in its output, so the file Vercel compiles resolves the same
  specifier the source did. `api/deployed-entry.test.ts` covers it **in both
  directions** — swapped for `../db/index.ts` it fails, restored it passes.
- **That platform question is now answered: tracing does not ship it.** It was
  deliberately asked while the teacher is still on GitHub Pages, so a broken
  `/api/health` cost nothing; after the 4.3 cutover it would have been an
  outage. The recorded fallback — move the pool and `pingDb` into
  `api/[...all].ts` — is what shipped, in batch 5.1b.
- **The production path never names PGlite.** `db/index.ts` holds the `pg` pool
  and nothing else; `db/testing.ts` holds PGlite and is imported only by the
  tests and `scripts/serve.mjs`, which call `setDb()`. `@electric-sql/pglite`
  is a devDependency, so it is absent from a deployment — a module that names
  it, even on a branch that never runs, is a module the function cannot load.
- **`Db` is a narrow structural type, not drizzle's database type.** The
  node-postgres and PGlite instances are different types, and this batch needs
  one operation from either. ESLint confirmed the type is genuinely structural
  by rejecting an `as unknown as Db` cast as unnecessary. Widen it when a batch
  needs more; a cast becoming necessary later is the seam reporting that the
  two drivers have actually diverged.
- **`db/**` and `drizzle.config.ts` are in the root TypeScript project**, for
  the reason batch 5.0 recorded for `neon.ts`: a file in no project fails typed
  linting on the file rather than on its contents. A `db/tsconfig.json` would
  also work and would make a fourth project and a fourth typecheck script for
  two files. There are still three.
- **Migrations are SQL files plus a programmatic apply, never `drizzle-kit
push`.** PGlite has to run the same migrations the deployment does, in Vitest
  and in `scripts/serve.mjs`, and `push` cannot do that.
- **Migrations are additive only.** Never drop or rename a column that running
  code still reads.
- **`drizzle.config.ts` reads `DATABASE_URL_UNPOOLED`.** Neon's pooled host runs
  PgBouncer in transaction mode and cannot run what a migration needs. Pooled
  for the running function, direct for migrations and `pg_dump`.
- **There is no schema yet, and that is a decision.** `db/schema.ts` defines no
  tables: the Better Auth tables are batch 5.2's and are generated from the
  library, and `documents`/`document_versions` are Phase 6's with their shape
  already set in storage-data-contract.md. `drizzle-kit generate` accordingly
  emits no SQL — confirmed, not assumed. So **5.1's "the migrations apply on
  PGlite" gate moves to 5.2**, which brings the first real migration.
- **Production reaches Neon, measured 2026-09-17.** `GET /api/health` on
  `lesson-planner-lac.vercel.app` answers
  `{"ok":true,"commit":"6154f9b…","region":"fra1","db":"ok","dbQueryMs":3}`.
  So `DATABASE_URL` is set in Vercel's production environment — batch 5.0's
  Neon integration injects it — and the function in `fra1` reaches the database
  in Frankfurt in 3 ms. The equivalent check on a **preview** is not available:
  previews are protected by Vercel Authentication and `/api/health` returns 302
  to `vercel.com/sso-api`, so it needs the bypass secret that security-auth.md
  deliberately has not created yet.
- **First request after ten quiet minutes: 426 ms total, of which the database
  query was 30 ms.** A request three seconds later: 302 ms total, 3 ms query.
  Both against production on 2026-09-17.
  **This is not proof of a cold start, and it should not be recorded as one.**
  Two things could not be controlled. Vercel's Fluid Compute reuses function
  instances, so the first request may well have hit a warm one; and production
  is a public URL, so other traffic may have kept the function and the database
  awake. What can be said is narrower and still useful: _no request observed on
  production has cost anything like the 1197 ms that Neon's scale-to-zero wake
  measurably costs_, so nothing here resembles the number RP-05 rejected this
  shape on. The TBD below stays open until someone can hold the deployment
  genuinely idle and watch the first request — which needs a quiet window, not
  a better command.
- **Measured on 2026-09-17.** Neon `vercel-dev`, through the real `pg` path:
  **1197 ms** for the first query after idle (the scale-to-zero wake) and
  **35 ms** warm. RP-10 predicted "about one second in total"; that is met.
  This is the _database_ wake and not the function cold start, which stays TBD
  below. PGlite costs 3794 ms for the first database in a process and ~1500 ms
  for each one after, which is why `api/vitest.config.ts` sets
  `testTimeout: 30000` — a measurement, not a workaround for a flaky test.
- **`pg` 8.23 connects under a stricter SSL mode than the string asks for.** It
  warns that "'prefer', 'require', and 'verify-ca' are treated as aliases for
  'verify-full'". Neon's string says `require`; the connection is made and
  works. Nothing to do. It is here because a future `pg` major changing this
  again would look like an unrelated connection failure.
- **A conflict this batch surfaced and did not resolve.** This file says
  migrations "run in the Vercel build command before `vite build`".
  deployment.md records the project's build command as `npm run build:app`.
  Those do not agree, and the build command is a dashboard setting. Batch 5.1
  decides: either `build:app` grows the migrate step, where it is testable, or
  the owner edits the dashboard.

## TBD (all assigned to Phases 4–6)

- The measured cold start on production (first request after five idle
  minutes) — batch 5.1.
- Whether a preview deployment gets its own Neon branch through the
  integration, or a fixed `preview` branch — batch 5.1.
- Neon's 90-day inactivity sentence: whether it applies outside Azure regions,
  and whether a monthly keep-alive cron is added — owner asks Neon, batch 6.4.

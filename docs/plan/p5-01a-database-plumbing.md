# Batch 5.1a — Database plumbing, proven without an account

Phase 5 · [Plan home](README.md) · Prev: [5.0](p5-00-neon-project-link.md) · Next: [5.1](p5-01-neon-database-plumbing.md)

## Goal

The function can reach a Postgres database, tests run against Postgres with no
infrastructure, and no connection string can reach the browser. Everything here
is provable on a laptop.

## Why this is its own batch

[5.1](p5-01-neon-database-plumbing.md) cannot start. It depends on
[4.4](p4-04-retire-github-pages.md), which waits for the transition window that
[4.3](p4-03-cutover-to-vercel.md) sets — 60 to 90 days after a cutover that has
not happened. Three of 5.1's six acceptance criteria need a live production and
a preview deployment, and two more need the owner to accept data processing
agreements.

This batch is the part of that work which needs none of it. It is the third
recorded exception to the merge order, after rows 42/43 and
[5.0](p5-00-neon-project-link.md), and it follows 5.0's method: split the batch
at the line between what a laptop can prove and what a console must do, land the
first half, and carry the rest forward explicitly.

**Nothing is stored.** No migration is applied to any Neon branch, so the DPA
gate is untouched. The owner still accepts Neon's and Vercel's agreements in
5.1, before any of the teacher's data reaches a server.

## The thing this batch had to get right first

Lesson [26](lessons-learned.md) cost two failed production deployments and left
an instruction for this batch: "Give `db/` and `shared/` bare specifiers in
Phases 5 and 6, because a package name resolves the same either way." That was a
prediction. It is now measured.

`db/` is an npm workspace package, `@lesson-planner/db`. Both halves were tested
before anything was built on them:

| Question                                            | Answer                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Does Node 24 strip types inside `node_modules`?     | Yes — a symlinked workspace package's `.ts` files load fine.                                 |
| Does the specifier survive the compile Vercel does? | Yes — `tsc` leaves a bare specifier untouched in the emitted JS, and the output resolves it. |
| Does `deployed-entry.test.ts` fail if it is broken? | Yes — swapped for `../db/index.ts` it fails 2 of 2; restored, it passes 2 of 2.              |

The third row is the one that matters. Lesson 27 records that the first version
of that test passed under both a working and a broken export, so it could not
see the bug it existed to catch. This shape was checked in both directions.

**One thing is still unproven, and it is a platform question.** Whether Vercel's
file tracing pulls a workspace symlink into the function bundle cannot be known
without a deployment. This is the cheapest possible moment to find out: the
teacher is still on GitHub Pages, so a broken `/api/health` costs nothing. After
the 4.3 cutover the same mistake is an outage. If tracing fails, the fallback is
recorded below and is a small change.

**And the preview deployment cannot answer it.** Measured on this pull request:
`GET /api/health` on the preview returns **302** to `vercel.com/sso-api`. That
is Vercel Authentication, the Hobby default recorded in deployment.md — previews
are protected and production is not. Reaching a protected preview needs the
`x-vercel-protection-bypass` header, whose secret would be this repository's
first GitHub Actions secret and does not exist yet (security-auth.md names it
first, deliberately).

So the deployment gate here is **after the merge, against production**, which is
the shape lesson 8 already describes: a batch that deploys cannot fully close at
PR time. The check is one command, and it must be run rather than assumed —
lesson 27 is the deployment that reported success while every request hung:

```bash
curl -s https://lesson-planner-lac.vercel.app/api/health
```

A body carrying `db` and `dbQueryMs` means tracing worked. A 500, a timeout, or
the old body without those fields means it did not, and the fallback applies.
Production answered `{"ok":true,"commit":"1204469…","region":"fra1"}` immediately
before this merge — the batch 5.0 commit, without the new fields, which is the
baseline the check is read against.

## What shipped

- `db/`, an npm workspace package. `index.ts` is the seam, `testing.ts` is the
  PGlite half, `schema.ts` is empty, `migrations/` is where drizzle-kit writes.
- `pg` 8.23.0 and `drizzle-orm` 0.45.2 as dependencies; `drizzle-kit` 0.31.10,
  `@electric-sql/pglite` 0.5.8 and `@types/pg` 8.23.1 as devDependencies. All
  peer ranges resolved together in one dry run before installing (lesson 3):
  drizzle-orm asks for `pg >=8` and `@electric-sql/pglite >=0.2.0`, and both
  are satisfied.
- `npm run db:generate` and `npm run db:migrate`.
- `GET /api/health` now reports `db` and `dbQueryMs`.
- `scripts/serve.mjs` injects PGlite when `DATABASE_URL` is unset.
- `db/**` and `drizzle.config.ts` joined the **root** TypeScript project, the
  same fix batch 5.0 used for `neon.ts`. A file in no project fails typed
  linting on the file rather than its contents. Giving `db/` its own tsconfig
  would work too and would make a fourth project and a fourth typecheck script
  for two files; this keeps the count at three.

### The seam, and why PGlite is not imported by it

`db/index.ts` holds the production path only: one module-scope `pg` pool against
`DATABASE_URL`. `db/testing.ts` holds PGlite. Nothing under `api/` imports the
second file.

That separation is not tidiness. `@electric-sql/pglite` is a devDependency, so
it does not exist in a deployment's `node_modules` — a module that names it,
even on a branch that never executes, is a module the function cannot load. The
local server and the tests call `setDb()` with a PGlite database instead.

`Db` is deliberately a narrow structural type rather than drizzle's full
database type, because the node-postgres and PGlite instances are different
types and this batch needs one operation from either. ESLint proved the type is
genuinely structural: it rejected an `as unknown as Db` cast in `db/testing.ts`
as unnecessary. Batch 5.2 widens the seam when Better Auth's adapter needs more.

### No migration, and why the gate moved

`db/schema.ts` defines no tables, so `drizzle-kit generate` produces no SQL.
That was confirmed rather than assumed: it prints "0 tables … nothing to
migrate".

This batch owns no tables. The Better Auth tables are 5.2's and are generated
from the library, not hand-written; `documents` and `document_versions` are
Phase 6's and their shape is already decided in storage-data-contract.md.
Inventing either here would be guessing at another batch's decision.

So 5.1's criterion "the migrations apply on PGlite" **cannot honestly be met
here**, and it is not claimed. What is tested is the mechanism around them: the
migrator runs, records its bookkeeping table, and two databases do not share
state. **The gate moves to 5.2**, which brings the first real migration.

## Measurements

Numbers, not impressions. All measured 2026-09-17 on the maintainer's machine.

| What                                      | Result                                            |
| ----------------------------------------- | ------------------------------------------------- |
| PGlite, first database in a process       | 3794 ms — the WebAssembly module is compiled once |
| PGlite, each database after that          | ~1500 ms                                          |
| Neon `vercel-dev`, first query after idle | **1197 ms** — the scale-to-zero wake              |
| Neon `vercel-dev`, second query           | **35 ms**                                         |
| `/api/health` against local PGlite        | `db: "ok"`, `dbQueryMs: 1`                        |

The Neon numbers come from a `SELECT 1` through the real `pg` path against the
non-default `vercel-dev` branch. It read no table and wrote nothing. This is the
**database** wake, not the function cold start that backend.md still lists as
TBD — 5.1 measures that one, on a deployment. RP-10 predicted "about one second
in total"; 1197 ms is that prediction met.

PGlite's cost is why `api/vitest.config.ts` now sets `testTimeout: 30000`. That
is a measurement, not a workaround for a flaky test: the first test failed and
the rest passed, every time, which is a cold start rather than a race.

### An observation worth keeping

`pg` 8.23 prints: "SECURITY WARNING: The SSL modes 'prefer', 'require', and
'verify-ca' are treated as aliases for 'verify-full'." Neon's string asks for
`require`, so the connection is being made under a **stricter** mode than it
requested, and it works. Nothing to do now. It is recorded because a future `pg`
major changing this again would look like an unrelated connection failure.

## npm audit

4 moderate, all from `drizzle-kit` → `@esbuild-kit/esm-loader` → `esbuild
<=0.24.2` (GHSA-67mh-4wv8-2f99).

**Recorded, not fixed, with a reason.** `npm audit --omit=dev` reports **0
vulnerabilities** — the production tree is clean. drizzle-kit is a devDependency
that never runs on a deployment, and the advisory is about esbuild's development
server, which drizzle-kit does not start. The offered fix is `drizzle-kit@0.18.1`,
a downgrade of thirteen minor versions. 0.31.10 is the newest release and still
carries the chain. Re-check when drizzle-kit updates its loader.

## Acceptance criteria

- [x] `GET /api/health` reports `db: "ok"` and a query time, locally, with no
      account and no secret.
- [x] `npm run serve` and the full suite work with no `.env.local` present —
      and that is not a contrived state: this worktree has none.
- [x] After `npm run build:app`, grepping `app/dist` for `neon.tech`,
      `neon.com`, `-pooler`, `DATABASE_URL`, `postgres://` and `postgresql://`
      returns nothing. Nor does a grep for `drizzle`, `node-postgres` or
      `PGlite` — no database code reached the browser at all.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and
      `check:pii` clean. The PII check read 131 files.
- [x] `npm run test:unit` — 346 passed, up from 339.
- [x] `npm run test:e2e` — 189 passed, up from 188. Exit code read directly,
      never through a pipe (lesson 29).
- [x] `api/one-function.test.ts` still sees exactly `["[...all].ts"]`.
- [x] The bare specifier fails `deployed-entry.test.ts` when broken.
- [ ] **After the merge:** production `/api/health` reports `db`. This cannot be
      checked before the merge — the preview is SSO-protected. Recorded in a
      follow-up, as batches 4.1 and 4.2 were.

## Carried forward to 5.1

Everything that needs a console or a deployment:

- **Owner:** accept Neon's and Vercel's DPAs. Nothing is stored until then.
- **Owner:** confirm the integration shape and mark `DATABASE_URL` and
  `DATABASE_URL_UNPOOLED` Sensitive.
- `db: "ok"` on production and on a preview deployment.
- The first migration applied to the production branch, with `drizzle-kit`
  reporting nothing pending — and it needs a table to exist first, so it
  arrives with 5.2.
- The **function** cold start on production, after five idle minutes.
- Whether Vercel's file tracing bundles the workspace package. If it does not,
  the fallback is to move `pingDb` and the pool into `api/[...all].ts`, which
  needs no new resolution mechanism at all.
- **A decision 5.1 must not skip:** backend.md says migrations "run in the
  Vercel build command before `vite build`"; deployment.md records the build
  command as `npm run build:app`. Those disagree. Either `build:app` grows the
  migrate step — in the repository, where it is testable — or the owner edits
  the Vercel dashboard. An undecided build command is how a migration silently
  never runs.

## Merge order and dependencies

Depends on [5.0](p5-00-neon-project-link.md) and on [4.2c](p4-02c-one-function.md)
for the `api/` layout. Does **not** depend on 4.3, 4.4 or the transition window:
nothing here is switched on for the teacher and no data is stored. Deployable:
yes — the app is untouched and the API gains one field.

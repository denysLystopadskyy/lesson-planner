# Batch 5.2b — The catch-all matched one segment, and rate limiting had no table

Phase 5 · [Plan home](README.md) · Prev: [5.2a](p5-02a-better-auth.md) · Next: [5.2](p5-02-better-auth-google-allowlist.md)

## Two faults, both found by requesting real routes after the merge

[5.2a](p5-02a-better-auth.md) merged with a green suite and a green CI, and
sign-in could not have worked. Neither fault was visible locally.

### 1. The catch-all matched exactly one segment below `/api`

backend.md recorded since batch 4.2 that `api/[...all].ts` was "proven, and no
`vercel.json` rewrite is needed". It was proven against `/api/health` and
`/api/nope` — the only two routes that existed. Measured on production:

| Path                    | Result                   | Reached the function? |
| ----------------------- | ------------------------ | --------------------- |
| `/api/health`           | 200                      | yes                   |
| `/api/nope`             | `404 Not Found` — Hono's | yes                   |
| `/api/auth`             | 500                      | yes                   |
| `/api/auth/get-session` | `NOT_FOUND` — Vercel's   | **no**                |
| `/api/a/b/c`            | `NOT_FOUND` — Vercel's   | **no**                |

The two 404s are the same status code and completely different facts. Hono's
means the function answered; Vercel's means it was never called. Only the body
tells them apart.

Every Better Auth route is deeper than one segment — the Google callback is
`/api/auth/callback/google` — so this was fatal to the whole phase.

**Fix:** `vercel.json` gains
`{"source": "/api/:path*", "destination": "/api/[...all]"}`.

**This cannot be verified locally.** `scripts/serve.mjs` routes with Hono and is
green either way, so the suite says nothing about it. It is the fourth member of
the family in lessons 26, 27 and 31, and it is verified the same way: request a
deep path on the deployment and read the body.

### 2. Database rate limiting needs a `rateLimit` table

5.2a set `rateLimit.storage: "database"` — the recorded decision, because
counters in memory do not survive a serverless instance — and did not add the
table. Better Auth refuses to start without it:

```
SchemaMismatchError: Drizzle schema mismatch
  Missing tables
    rateLimit
```

So **every** `/api/auth/*` request returned 500, locally as well as on the
deployment. Migration `0001_rate_limit.sql` adds it: `key` unique, `count`, and
`lastRequest` as a bigint because it holds `Date.now()` in milliseconds.

That the fix is a second migration rather than an edit to the first is the
additive-only rule working as intended.

## The test that should have caught it

5.2a asserted this, and it is the more embarrassing of the two faults:

```ts
expect(mounted.status).not.toBe(404);
```

The route was returning **500**, which satisfies "not 404". The assertion
passed, CI passed, and every auth request failed.

It now asserts what the response **is**, and reads the body:

```ts
expect(response.status).toBe(200);
expect(await response.json()).toBeNull();
```

A test that asserts what a response is _not_ has said almost nothing. Recorded
as part of lesson 33.

## Acceptance criteria

- [x] `/api/auth/get-session` answers 200 with a null session on the local
      server, and the server log carries no Better Auth error.
- [x] The strengthened test asserts status and body, not the absence of one
      status.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean.
- [x] `npm run test:unit` — 360 passed. `npm run test:e2e` — 189 passed.
- [x] `api/one-function.test.ts` still sees exactly `["[...all].ts"]`, and the
      entry still imports only published npm packages.
- [x] **After the merge, on production:** measured, and the routing is fixed.
      See the results below.

### The production result

Re-measured immediately after the merge, at commit `fdab92e`:

| Path                    | Before                     | After                        |
| ----------------------- | -------------------------- | ---------------------------- |
| `/api/health`           | 200                        | 200                          |
| `/api/nope`             | `404 Not Found` — Hono's   | `404 Not Found` — Hono's     |
| `/api/a/b/c`            | `NOT_FOUND` — **Vercel's** | `404 Not Found` — **Hono's** |
| `/api/auth/get-session` | `NOT_FOUND` — Vercel's     | 500                          |

**The routing is fixed.** `/api/a/b/c` changing from Vercel's `NOT_FOUND` to
Hono's `404 Not Found` is the whole claim: a path three segments below `/api`
now reaches the function. The rewrite works.

### `/api/auth/*` still answers 500 on production, and that is correct

It answers 200 locally and 500 on the deployment, and the difference is not a
bug. **The Neon production database has no tables.** Checked directly:

```
select table_name from information_schema.tables where table_schema='public'
→ (none)
```

So Better Auth refuses to start, exactly as it did locally before the
`rateLimit` table was added — the schema it needs is not there. Locally it works
because PGlite applies the migrations on every start; on the deployment nothing
applies them.

**Nothing applies them on purpose.** Batch [5.1a](p5-01a-database-plumbing.md)
recorded the decision: applying a migration to a real Neon branch creates
tables, which is a write, and the first write waits until the owner has accepted
Neon's and Vercel's data processing agreements. That gate is holding. It is
doing so visibly rather than silently, which is the better failure.

So the honest state of sign-in on production is: **the routes are reachable, and
the database behind them is empty and deliberately so.**

### One decision this makes concrete and urgent

backend.md says migrations "run in the Vercel build command before `vite
build`". deployment.md records the build command as `npm run build:app`, which
runs no migration. That conflict has been recorded since 5.1a as something 5.1
must decide; it is now the single thing standing between an accepted DPA and a
working sign-in.

Either `build:app` grows the migrate step — in the repository, where it is
testable and reviewable — or the owner edits the Vercel dashboard. **Whichever
is chosen, it must not run before the DPAs are accepted.**

## What a reader should take from this

Both faults were found in the twenty minutes after a merge, by asking the
deployment for real routes and reading what came back. Neither would have been
found by any test in the repository, and the second would have been found by a
better one.

## Merge order and dependencies

Depends on [5.2a](p5-02a-better-auth.md). Deployable: yes, and it should be —
`/api/auth/*` is broken on production until it lands. Nothing the teacher uses
is affected: she is still on GitHub Pages and nothing links to sign-in.

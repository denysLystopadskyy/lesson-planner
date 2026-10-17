# RP-11 — Records that do not match

[RP-11 home](rp11-docs-process-review.md) · Prev: [AI setup](ai-setup.md) · Next: [Language](language.md)

Batches 5.5 to 5.8 replaced the self-run Better Auth server with Neon's managed
one, and moved the allowlist into a webhook. Batch 5.4 then updated CLAUDE.md's
Phase 5 paragraph and the Phase 5 gate. Many other records still describe the
old design. This page lists them, at `main` `a003ce0`.

A statement is **stale** when it was true once and is not now. It is **false**
when it says something happened that did not happen.

## One false record — DEF-028

[p5-07](../../plan/p5-07-neon-auth-client.md) line 69, under "What was removed",
says: "`AUTH_TEST_MODE` and the e2e address from `scripts/serve.mjs`". The
5.7 commit message says the same.

**They were not removed.** `scripts/serve.mjs` still sets
`process.env.AUTH_TEST_MODE = "1"` (line 75) and appends
`planner-e2e@example.test` to `ALLOWED_EMAILS` (lines 89–93). The 5.7 diff
added 15 lines to that file and removed none.

**Both are dead code.** Checked on 2026-10-17:

- Nothing in `api/`, `app/src/`, `db/` or `scripts/` reads `AUTH_TEST_MODE`.
- No spec needs the e2e address on the allowlist. The only HTTP spec for the
  webhook, `e2e/features/auth-webhook.spec.ts`, sends an **unsigned** request
  from `stranger@example.test`. The local server has no `NEON_AUTH_BASE_URL`, so
  the webhook refuses before it reads the allowlist (the spec's own comment,
  lines 33–37, says so). The e2e address in `e2e/ui/support/sign-in.ts` is a
  separate constant used by the session stub, and does not depend on the server.

Recorded as **DEF-028** in the [DEF registry](../../plan/def-registry.md).
Batch 5.10 deletes the code.

## Stale records, fixed in batch 5.9

Batch [4.3b](../../plan/p4-03b-deployment-probe.md), from another session,
merged on the same day and also corrected the secrets inventory in
security-auth.md and the variable list in backend.md. Batch 5.9 kept those
corrections when it merged.

| File and lines                                     | What it says                                                                                                   | What is true at `a003ce0`                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| CLAUDE.md 7–16                                     | The app "runs on GitHub Pages"; "three keys"; "nothing she uses talks to `api/`"; the backend "is not deployed anywhere yet"; Phases 4–6 add "Google sign-in with Better Auth" | The teacher still uses GitHub Pages. A Vercel production deployment also exists and serves the API. Storage has three data keys and a fourth key for the last backup time. Sign-in is Neon's managed Better Auth |
| CLAUDE.md 46–54                                    | "batch 5.1 cannot start for months"; "Batches 5.0 and 5.1a landed ahead"                                       | Batches 5.0 to 5.8 and 5.4 all merged ahead of 4.3 and 4.4                                                                                      |
| CLAUDE.md table, security-auth.md row              | "Google sign-in with Better Auth"                                                                              | Google sign-in through Neon Auth, and the allowlist webhook                                                                                     |
| CLAUDE.md 124–125                                  | `api/[...all].ts` serves `GET /api/health`                                                                     | It also serves `POST /api/hooks/neon-auth`, the allowlist webhook                                                                               |
| CLAUDE.md 136–137; deployment.md 94               | `vercel.json` holds `regions` only and is inert                                                                | It also holds the `/api` rewrite (5.2b) and the response headers with the Content-Security-Policy (5.4a). The Vercel project exists              |
| CLAUDE.md 142–147                                  | The Better Auth tables are defined in `api/[...all].ts` and re-exported by `db/schema.ts`                      | 5.7 removed them. `db/schema.ts` exports nothing, and `db/migrations/` holds only the journal                                                  |
| CLAUDE.md 161–163                                  | 198 e2e tests in 36 files; 365 unit tests                                                                      | The last recorded run (5.7) is 204 e2e tests in 38 files and 374 unit tests                                                                     |
| security-auth.md 126–138                           | The allowlist runs in `validateUserInfo` on every sign-in; database sessions; rate limiting; the secrets list names `BETTER_AUTH_SECRET` and the Google variables | The allowlist is a `user.before_create` webhook. Neon holds the session. The project holds no Google credential and no session secret. `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL` are new |
| security-auth.md 170–212, 290–306                  | The `validateUserInfo` decisions, `AUTH_TEST_MODE`, the fenced test path, `ipAddressHeaders`, our Google console, `better-auth` patch level | All describe the removed server. 5.8 replaced the test path with a stub at the network boundary                                                 |
| security-auth.md 307–310, TBD 349–352              | CSP "decided in batch 5.4"; consent screen and DPA "accept" TBDs                                               | 5.4a set the CSP; 5.4 found there is nothing to accept for the DPAs; the consent screen is Neon's                                               |
| backend.md 7–9                                     | "`db/` and `shared/` do not exist yet"                                                                         | `db/` exists since 5.1a                                                                                                                         |
| backend.md 13–14, 36–38, 53–56                     | The Better Auth handler at `/api/auth/*`; tables from the Better Auth CLI; the environment variable list      | The route is gone; Neon owns the auth tables; see `.env.example` for the current names                                                          |
| backend.md 111–112                                 | "34 end-to-end specs"                                                                                          | 38 spec files                                                                                                                                   |
| backend.md 176–177                                 | Production dependencies are "exactly `hono` and `@hono/node-server`"                                          | Four: also `pg` and `drizzle-orm`                                                                                                               |
| backend.md 296–346                                 | The 5.2a sign-in server and the "`/api/auth/*` answers 500" measurement                                       | Both describe the removed server                                                                                                                |
| backend.md 350–355                                 | `auth` health is `ready \| no-schema \| no-database \| error`                                                  | `ready \| unconfigured` since 5.7                                                                                                               |
| testing.md 19                                      | "The 8 existing `data-testid` names"                                                                           | The list on the next lines holds 7, since `month-price-input` left in 3.7                                                                       |
| testing.md 164–174                                 | The `@ported` and `@portedonly` tags and two projects                                                          | The cutover (2a.4) removed both tags and the second project (`playwright.config.ts` lines 10–15)                                                |
| testing.md 199–201                                 | API tests "written so far need no database"                                                                    | `api/db-seam.test.ts` and `api/health.test.ts` use PGlite                                                                                       |
| testing.md 237–243                                 | The `signedIn` fixture signs in through the test-only path with `AUTH_TEST_MODE=1`                             | 5.8 replaced it with a stub; lines 216–226 of the same file say so                                                                              |
| Plan hub, Phases table                             | Phase 5 is "Better Auth with Google … 5.1 – 5.4"                                                               | Neon Auth, batches 5.0 to 5.8                                                                                                                   |
| Plan hub, merge order                              | Row 43m (batch 5.5) is missing; the exceptions name only rows 42, 43, 43e and 43f                              | 5.5 merged; rows 43g to 43p also merged ahead of row 44                                                                                         |
| Plan hub, rows 46–49                               | 5.1, 5.2, 5.3 and 5.4 wait behind 4.4                                                                          | 5.4 merged (#79). 5.1 to 5.3 were done as 5.1a to 5.3b and then replaced by 5.5 to 5.8                                                          |
| p5-08 line 7                                       | The link text says 5.7 but points to `p5-05-switch-to-neon-auth.md`                                            | It should point to `p5-07-neon-auth-client.md`                                                                                                  |
| p5-08 line 70                                      | "The nine specs"                                                                                               | Ten, as lines 83 and 91 on the same page say                                                                                                    |
| p5-06 line 3, p5-08 line 3                         | "Next: 5.7" with no link                                                                                       | 5.7 exists                                                                                                                                      |
| p5-07 line 57                                      | "`serve.mjs` builds with `VITE_NEON_AUTH_URL=…`"                                                               | The `serve` script in `package.json` sets it                                                                                                    |
| `.env.example` lines 10–12                         | "No code reads any of these yet"                                                                               | `ALLOWED_EMAILS` and `NEON_AUTH_BASE_URL` are read by the webhook                                                                               |

## Stale records, fixed later

| Where                                                   | Fixed in      |
| ------------------------------------------------------- | ------------- |
| Code comments at `api/[...all].ts` 205–211 and `app/src/App.tsx` 450–459 describe the parked gate and `/api/auth/*` as live. `api/[...all].ts` 222–224 says the allowlist is "also enforced per request by the API"; p5-07 says that check is not built yet | 5.10 |
| p5-02 goal ("first-party cookie on the app's own origin"), and p5-01, p5-02, p5-03 do not mention 5.5 | T.9  |
| p6-02 line 31 ("the session comes from Better Auth"), p6-04 line 24 and p6-05 line 18 (`better-auth` at the latest patch) | T.10 |
| `def-registry.md` lines 11–13 still describe line numbers of the deleted `index.html` | T.1 (registry columns change there) |

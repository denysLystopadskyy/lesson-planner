# Batch 5.2a — Better Auth, the allowlist, and the door the tests use

Phase 5 · [Plan home](README.md) · Prev: [5.1b](p5-01b-inline-the-seam.md) · Next: [5.2](p5-02-better-auth-google-allowlist.md)

## Goal

Everything about sign-in that can be proved on a laptop: the Better Auth server,
the Google provider, the allowlist, the fenced test-only path, and the schema
behind them. No console, no secret, no deployment.

## Why this is its own batch

The same split [5.0](p5-00-neon-project-link.md), [5.1a](p5-01a-database-plumbing.md)
and [5.1b](p5-01b-inline-the-seam.md) made. [5.2](p5-02-better-auth-google-allowlist.md)
needs a Google Cloud project, an OAuth client, five Vercel variables and two
people signing in on production — none of which a pull request can create. What
is left is most of the code.

## The claim everything rests on, checked in the installed library

The allowlist is enforced by `user.validateUserInfo`. RP-10 chose it over three
alternatives because it runs on **every** sign-in and not only the first —
batch [5.4](p5-04-security-review.md) checklist row 13 asks for exactly that.

That was a documentation claim. It is now read out of better-auth 1.7.5 itself.
The gate is invoked from three places:

| File                      | `action`       | When                                              |
| ------------------------- | -------------- | ------------------------------------------------- |
| `db/internal-adapter.mjs` | `create-user`  | a new user is provisioned                         |
| `oauth2/link-account.mjs` | `link-account` | a provider is linked to an existing user          |
| `oauth2/link-account.mjs` | `sign-in`      | **a returning user whose account already exists** |

The third is the one that matters, and it is on the `else` branch of the
account-linking path — the case where there is nothing to link because the
account is already there.

The library also **fails closed**: `assertValidUserInfo` catches a throwing hook
and rejects with a 403 rather than allowing the sign-in. Our gate agrees with
that direction — an empty `ALLOWED_EMAILS` admits nobody.

## An awkward structure, and why it is forced

`api/[...all].ts` now defines the four Better Auth tables, and `db/schema.ts` is
a one-line re-export of them. That is backwards, and it is the only arrangement
that satisfies two constraints pulling in opposite directions.

- **The deployed entry cannot import project TypeScript.** Vercel traces a
  workspace package and then ships no `.ts` into it, so the import resolves and
  the file is absent — lesson 31, one production outage. The entry may import
  published npm packages and nothing else.
- **drizzle-kit cannot read the entry.** Its `schema` option is a glob path, and
  `api/[...all].ts` contains `[...]`, which glob reads as a character class:
  _"No schema files found for path config"_. Tried, not assumed.

So the tables live where the function reaches them with **no import at all**,
and drizzle-kit reads them through a file whose name it can glob. There is still
exactly one definition of every table — `drizzle-kit generate` reported "4
tables … No schema changes, nothing to migrate" after the move, which is the
proof that nothing was duplicated or altered.

**The guard from 5.1b caught this mid-batch.** The first version of this work
imported the schema as `@lesson-planner/db/schema`; `api/deployed-entry.test.ts`
failed because that resolves to a `.ts` file. Without it, the sequence would have
been the same as last time: green suite, green CI, successful deployment, 500.

## The schema is verified, not transcribed

The four tables were written by hand from Better Auth's core schema, so
`api/auth.test.ts` runs the **real adapter** against a real PGlite database with
the real migration applied: it creates a user and reads it back by e-mail. A
wrong column name fails there rather than failing a sign-in on production.

That test also corrected an assumption: the adapter mints its own id and ignores
one passed in, so the test asserts the round-trip rather than a chosen id.

## What shipped

- `better-auth` 1.7.5, pinned. Peers resolved against the existing tree in one
  dry run first (lesson 3): `drizzle-orm ^0.45.2` matches ours exactly,
  `drizzle-kit >=0.31.4`, `pg ^8`, `vitest ^5`, `react ^19` — all satisfied.
- The auth configuration in `api/[...all].ts`: Drizzle adapter, Google provider,
  explicit `baseURL`, `trustedOrigins`, database sessions, and rate limiting
  with `storage: "database"` — counters in memory do not survive a serverless
  instance, so a burst can simply land on a fresh one.
- `parseAllowlist` and `isAllowed` as exported pure functions. They are the
  whole access-control boundary, so they are tested directly; building an auth
  instance to check that a comma is handled would test the wrong thing.
- The first real migration, `0000_*.sql`, creating `user`, `session`, `account`
  and `verification`.
- `scripts/serve.mjs` sets `AUTH_TEST_MODE=1`.
- The root TypeScript project gains `allowImportingTsExtensions`, which
  `api/tsconfig.json` has carried since batch 4.2 for the same reason.

## The gate that moved here from 5.1

5.1a could not honestly test "the migrations apply on PGlite" — it owned no
tables, so `drizzle-kit generate` emitted no SQL, and it said so and moved the
gate. **It is met here.** `api/auth.test.ts` builds a PGlite database with the
real migration applied and drives the real adapter against it.

## Tests

`api/auth.test.ts`, twelve cases. ISTQB technique named in the `describe`:
equivalence partitioning over the kinds of entry a person can type into
`ALLOWED_EMAILS`, with boundary value analysis on the empty and whitespace-only
edges of both the list and each entry.

- listed; listed in a different case; listed with spaces on either side
- not listed; missing altogether; empty, unset, or only separators
- **not a prefix or a substring** — `her@example.test.evil.test` and
  `other-her@example.test` are both refused
- `AUTH_TEST_MODE` is exactly `"1"`: `""`, `"0"`, `"false"`, `"true"`, `"yes"`
  and `" 1"` all leave the door shut, and so does the variable being absent
- the production configuration carries no password provider — asserted on the
  built object, because the flag is what we meant and the object is what runs
- the real adapter round-trips a user through the real schema
- the auth routes answer under `/api/auth`, and `/api/nope` still 404s

## npm audit

**The production-tree answer changed, and the reason is worth recording.** Before
this batch `npm audit --omit=dev` reported 0 vulnerabilities. It now reports the
same 4 moderate findings as the full audit — `drizzle-kit` →
`@esbuild-kit/esm-loader` → `esbuild <=0.24.2`, GHSA-67mh-4wv8-2f99.

Nothing about drizzle-kit changed. `better-auth` is a production dependency and
declares an **optional peer dependency** on `drizzle-kit`, so npm now walks that
edge when computing the production tree.

Recorded, not fixed, and the claim is narrower than last time because the
command's answer is:

- the peer is `"optional": true` — better-auth does not need it to run;
- no file under `better-auth/dist/` or `@better-auth/drizzle-adapter/dist/`
  imports `drizzle-kit`, by grep;
- loading `api/[...all].ts` does not pull it into the module graph, checked by
  reading `process.moduleLoadList` after the import;
- the advisory concerns esbuild's development server, which nothing starts.

The offered fix is `drizzle-kit@0.18.1`, thirteen minor versions back. Re-check
when drizzle-kit updates its loader.

## Acceptance criteria

- [x] Allowlist tests green, techniques named.
- [x] The production-configuration guard is green.
- [x] The real adapter round-trips a user through the migrated schema.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean.
- [x] `npm run test:unit` — 359 passed, up from 347.
- [x] `npm run test:e2e` — 189 passed, exit code read directly.
- [x] `api/one-function.test.ts` still sees exactly `["[...all].ts"]`.
- [x] The entry imports only published npm packages.
- [x] `npm audit` recorded with a reason per finding.
- [x] After `npm run build:app`, grepping `app/dist` for `GOOGLE_CLIENT_SECRET`,
      `GOOGLE_CLIENT_ID`, `BETTER_AUTH_SECRET`, `ALLOWED_EMAILS`,
      `AUTH_TEST_MODE`, `better-auth`, `betterAuth`, `neon.tech`, `-pooler` and
      `DATABASE_URL` returns nothing. No secret name and no auth library
      reached the browser — which is expected, because this batch adds no
      client code at all, and is checked anyway because that is the criterion.

## Carried forward to 5.2

All of it needs a console or a person:

- **Owner, Google Cloud:** project; consent screen (External, scopes `openid`,
  `email`, `profile` only); publishing status Testing with the two accounts as
  test users; a Web application client with the production origin and
  `http://localhost:4173` as JavaScript origins and
  `<origin>/api/auth/callback/google` as redirect URIs. No wildcards — Google
  forbids them.
- **Owner, Vercel:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `BETTER_AUTH_SECRET` (32+ bytes), `BETTER_AUTH_URL`, `ALLOWED_EMAILS`. All
  Sensitive, Production and Preview.
- **Owner, GitHub:** Dependabot security alerts on.
- **Owner, on production:** sign in with both accounts; try a third and confirm
  the rejection is readable. Then `disableSignUp: true` as the second lock, and
  the consent screen to **In production** after the first quiet week — in
  Testing, authorization expires every seven days.
- The two documented-default conflicts RP-10 flagged (the rate-limit window, the
  cookie-cache strategy) are worth observing against the live deployment; the
  configuration here sets the window explicitly rather than trusting either
  page.

## Merge order and dependencies

Depends on [5.1b](p5-01b-inline-the-seam.md). Deployable: yes — the auth routes
exist and nothing links to them, so the app is unchanged for the teacher.

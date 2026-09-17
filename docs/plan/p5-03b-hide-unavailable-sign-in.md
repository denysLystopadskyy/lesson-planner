# Batch 5.3b — A button that could only fail

Phase 5 · [Plan home](README.md) · Prev: [5.3a](p5-03a-sign-in-ui.md) · Next: [5.4](p5-04-security-review.md)

## What was live

Batch [5.3a](p5-03a-sign-in-ui.md) merged and production showed a "Sign in with
Google" button. Clicking it did nothing visible and logged this:

```
POST /api/auth/sign-in/social   500
GET  /api/auth/get-session      500
```

The cause was already known and written down — the Neon production database has
no tables, because the first migration waits on the owner accepting the DPAs, so
Better Auth refuses to start. What was **not** thought through is that 5.3a put
a control on top of that state and called itself "deployable: yes — signed out
the app gains one header button and changes nothing else."

A button that can only fail is a change. That page was wrong, and it is
corrected.

## Two mistakes, and the second is the interesting one

**The app collapsed three states into two.** `useSession()` distinguishes
"nobody is signed in" — a successful `null` — from "the server could not
answer", which is an error. 5.3a read only `data`, so a 500 was indistinguishable
from a signed-out visitor, and the app confidently offered sign-in.

**`db: "ok"` was answering a question nobody was asking.** `SELECT 1` succeeds
against a completely empty database. So the health route reported a healthy
database at the same moment every auth route was failing for want of its tables,
and the two facts never met. A health check that is green while the thing it
exists to describe is broken is worse than no health check, because it is
evidence.

## The fix

- `useSession` exposes `isUnavailable`, from the error the client already
  reports. **No extra request**: the session fetch that happens anyway is the
  signal.
- When auth is unavailable the banner renders **nothing**. The planner works
  from `localStorage` exactly as it did before sign-in existed — signed out _is_
  the app, and that is the honest version of it.
- `GET /api/health` gains `auth`, with four values: `ready`, `no-schema`,
  `no-database`, `error`. It asks the narrow question the app depends on —
  is the schema there — with `to_regclass`, which returns null for a missing
  table rather than throwing. It reads no row and no application data.

`db` and `auth` are deliberately separate fields. A database can answer and
still have none of the tables sign-in needs, which is precisely the state that
produced this batch.

## Tests

- `authHealth` by equivalence partitioning over the three states a deployment
  can be in: no database, a database with no schema, and one ready to sign
  somebody in. The middle case needed a new helper, `createBarePgliteDb`, that
  applies **no** migrations — `createPgliteDb` cannot express it, because
  applying them is its whole job.
- An end-to-end spec that makes every `/api/auth/**` request answer 500 and then
  asserts the banner offers nothing and the planner is untouched. That is the
  production state, reproduced.

## Acceptance criteria

- [x] With auth failing, no sign-in control is rendered and the planner works.
- [x] `/api/health` reports `auth: "no-schema"` against a database with no
      tables, and `ready` once the migrations are applied.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean.
- [x] `npm run test:unit` — 368 passed. `npm run test:e2e` — 199 passed.
- [x] **After the merge:** measured on production — see below.

### The production result

Commit `19ff721`, 2026-09-17:

```json
{
  "ok": true,
  "region": "fra1",
  "db": "ok",
  "dbQueryMs": 3,
  "auth": "no-schema"
}
```

The page carries no account control at all: every button in the banner is a
toolbar button, and the `.account-button` count is 0. One console error remains
— the session request the app has to make to find out — where before there were
four per click.

**A sub-second flash, recorded rather than glossed.** The control renders, then
is removed when the 500 arrives. That is the cost of drawing something before
the round-trip finishes, and it was the better of three options: the
alternatives were no control at all on every load for everyone, or a button that
stays and cannot work. Once the schema exists, the button stays.

## What this changes about judging a batch "deployable"

"Deployable" has meant _the live site still serves correctly_. This batch is the
reminder that a feature can satisfy that and still be wrong to ship: the site
served, every test passed, and the one visible new control could not work in the
one environment that matters.

**A control belongs on a deployment only when the deployment can honour it.**
When it cannot, the app should behave as though the feature is not there —
which, for sign-in, it is not until the owner's console work in
[5.2](p5-02-better-auth-google-allowlist.md) and the DPAs in
[5.1](p5-01-neon-database-plumbing.md) are done.

## Merge order and dependencies

Depends on [5.3a](p5-03a-sign-in-ui.md). Fixes what is live. Deployable: yes,
and this time the word is doing some work.

# Batch 5.7 — The client moves to Neon, and the parked server goes

Phase 5 · [Plan home](README.md) · Prev: [5.8](p5-08-a-session-for-specs.md) · Next: [5.4](p5-04-security-review.md)

## Goal

The app signs in through Neon, and the self-run Better Auth server parked in
[5.5](p5-05-switch-to-neon-auth.md) is removed.

## The client

`app/src/auth-client.ts` now uses `createAuthClient` from `@neondatabase/auth`,
pointed at `VITE_NEON_AUTH_URL`.

**The adapter comes from `@neondatabase/auth/react/adapters`, not from
`@neondatabase/auth/react`.** That distinction is worth the sentence: the
`/react` entry is a whole component library — sign-in forms, account cards,
provider icons, a theme — and this app has its own header button and account
view. The adapters entry carries the React hooks and references the UI package
zero times, which was checked rather than assumed.

`VITE_NEON_AUTH_URL` is public by nature: the browser has to be sent there. That
is why a `VITE_` name is right here and would be wrong for anything else in this
project.

When it is unset — in development, in the suite, on a deployment nobody has
configured — there is no client, and the app renders no account control at all
rather than a button that cannot work. That is [5.3b](p5-03b-hide-unavailable-sign-in.md)'s
rule, and it now also covers "there is nowhere to sign in to".

## The Content-Security-Policy had to change, and that is the interesting part

Batch [5.4a](p5-04a-response-headers.md) set `connect-src 'self'`. It was
**right** for the design it was written against: auth ran on our own origin, so
same-origin was the whole truth.

Batch 5.5 moved auth to a third-party origin and silently invalidated it.
Neither batch is wrong on its own; the interaction is. The browser said so
plainly, once something actually tried:

```
Connecting to 'https://.../get-session' violates the following
Content Security Policy directive: "connect-src 'self'". The action has been blocked.
```

**Nothing would have caught this before a person clicked "Sign in" on
production**, because nothing else in this app makes a cross-origin request.
`connect-src` now allows `https://*.neon.tech`.

It surfaced locally only because the suite points the client at a **real URL**
and stubs the network beneath it, rather than mocking the module above it. A
module-level mock would have sailed past a policy that blocks the fetch before
it is made.

### And the suite runs under the production policy

`serve.mjs` builds with `VITE_NEON_AUTH_URL=http://localhost:4173/__neon-auth`
— same origin, so `connect-src 'self'` is satisfied and the suite exercises the
**strict** policy rather than a relaxed one. The stub from
[5.8](p5-08-a-session-for-specs.md) answers that path.

## What was removed

- `buildAuth`, `getAuth`, `resetAuth`, `isTestMode`, `trustedOrigins`, the
  social-provider configuration, the rate-limit configuration, and the
  `/api/auth/*` route.
- The four Better Auth tables and `rate_limit` from `db/schema.ts`, and the two
  migrations that created them.
- `AUTH_TEST_MODE` and the e2e address from `scripts/serve.mjs`.
- The `better-auth` dependency from the manifest.
- `api/auth.test.ts` — except the allowlist tests, which moved to
  `api/webhook.test.ts`, where the allowlist now lives.

### Removing the migrations did not break the additive-only rule

That rule protects migrations that have been **applied**: never drop a column
running code still reads. These were applied to no Neon branch —
`information_schema` showed zero tables in `public` throughout Phase 5 — so
there was nothing to be additive about.

Leaving them would have been worse than churn. Neon owns `neon_auth.user`; ours
was `public.user`, dead, and identically named. Two user tables, one real and
one not, is exactly what misleads somebody in six months.

## `authHealth` now asks a question this deployment can answer

It used to check whether the auth tables existed here, because auth lived here.
It does not any more, so that question stopped being about us.

What is left is what this deployment controls: **can the allowlist webhook
verify a request came from Neon?** Without `NEON_AUTH_BASE_URL` it cannot, and
refuses every sign-up. `/api/health` reports `ready` or `unconfigured`, with no
network call — reaching Neon on every health check would make our health depend
on theirs.

## The bundle doubled, and here is the number

|                                      |            |
| ------------------------------------ | ---------- |
| Before (self-run Better Auth client) | **258 KB** |
| After (`@neondatabase/auth`)         | **548 KB** |

The weight is `zod`, which appears 908 times in the built file. It is not the UI
library (absent) and not the Supabase adapter (absent) — it is validation code
inside the SDK itself.

**This is a real cost for one teacher who may be opening the app on a phone**,
and it is the price of the delivery speed batch 5.5 chose. It is recorded rather
than shrugged at.

The mitigation, not taken here, is to load the auth client lazily: the planner
works signed out, so the SDK does not have to be in the first chunk. That is a
change to how the header renders and deserves its own batch rather than a
footnote in this one. **Re-measure before deciding** — a beta SDK's bundle is
the kind of thing that improves on its own.

## Acceptance criteria

- [x] The app uses Neon's client; no `better-auth` dependency remains.
- [x] With no auth URL configured, no account control renders and the planner
      works.
- [x] `connect-src` allows Neon, and the suite runs under the production policy.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean. `test:unit` 374. `test:e2e` 204.
- [x] `app/dist` carries no secret value. `BETTER_AUTH_SECRET` still appears as
      a getter name in the SDK's environment shim, reading an object Vite
      replaced with `{}` — the distinction security-auth.md already records.
- [ ] **Owner:** set `VITE_NEON_AUTH_URL` on Vercel to the value from
      `neon neon-auth status`, then redeploy. Until then production renders no
      account control, which is correct but not the destination.

## Still not done, and deliberately

**The per-request allowlist check.** Batch 5.5 said the webhook's
creation-time gate would be backed by a per-request check, because
`user.before_create` does not fire on a returning sign-in.

There is nothing to protect yet: `/api/health` is deliberately public and reads
no user data, and the documents API arrives in Phase 6. Building the gate now
would mean guessing the shape before its consumer exists and testing it against
nothing. It lands with the first authenticated route, and batch 5.4's checklist
row 13 already says so.

## Merge order and dependencies

Depends on [5.8](p5-08-a-session-for-specs.md), which made the suite ready for
this. Deployable: yes — without `VITE_NEON_AUTH_URL` the app is exactly the
planner it was before sign-in existed.

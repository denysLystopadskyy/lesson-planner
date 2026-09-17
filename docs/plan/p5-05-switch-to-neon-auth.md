# Batch 5.5 — Switch to Neon Auth, and park the self-run server

Phase 5 · [Plan home](README.md) · Prev: [5.4a](p5-04a-response-headers.md) · Next: [5.4](p5-04-security-review.md)

## The decision

**Sign-in moves to Neon's Managed Better Auth.** The self-run Better Auth server
built in [5.2a](p5-02a-better-auth.md) and [5.3a](p5-03a-sign-in-ui.md) is
parked, not deleted, at the owner's direction (2026-09-17) and carries the
**lowest priority** of any open work.

The reason is delivery speed, and it is concrete: Neon Auth offers Google
through **Neon's own shared OAuth application**, so the Google Cloud project,
consent screen and OAuth client — the largest owner-blocked item in the phase —
disappear entirely.

This supersedes RP-10's choice. That evaluation rejected Neon Auth on one axis,
"no allowlist is documented", and that axis has moved.

## What changed since RP-10, checked in the tooling rather than the docs

RP-10 is dated 2026-09-09. The Neon CLI installed here says:

| Question                          | Answer                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can new sign-ups be blocked?      | Yes — `neon neon-auth config email-password update --disable-sign-up`. **But it is under `email-password`**, so it does not govern Google.                                                         |
| Can OAuth sign-ups be restricted? | **No.** `oauth-provider update` accepts only the provider id and client credentials.                                                                                                               |
| Is there a server-side gate?      | **Yes, and this is the finding.** `--enabled-events` includes **`user.before_create`**, which Neon documents as a _blocking_ event: the endpoint's response decides whether the sign-up completes. |

So the allowlist is achievable, as a webhook this project hosts — in the API
function it already has.

## What this costs, recorded before it is built

Three things get worse, and none is a reason not to proceed — they are the price
of the delivery speed, and they belong on the record rather than in a surprise.

- **The gate fires on creation, not on every sign-in.** `validateUserInfo` ran
  on creation, on linking **and on every returning sign-in**; that is precisely
  why RP-10 chose it, and what batch [5.4](p5-04-security-review.md)'s checklist
  row 13 asks for. `user.before_create` does not.
  **Mitigation, and it is stronger than what it replaces:** the API function
  stays in the request path for everything that matters, so it checks the
  session's e-mail against the allowlist **on every request**, not only at
  sign-in. Phase 6's documents API needs that gate regardless. Row 13 is
  rewritten to ask for that instead.
- **A blocking webhook can fail open.** If the endpoint times out, sign-ups
  either fail or proceed — and Neon retries with the same `X-Neon-Event-Id`.
  The handler must be idempotent and must **fail closed**: an error is a
  refusal, never an admission.
- **The session stops being a first-party cookie.** Neon Auth answers on
  `https://ep-…​.neonauth.…aws.neon.tech/neondb/auth` with a JWKS URL, so the
  session is a token from a third-party origin rather than a cookie on ours.
  security-auth.md's "first-party cookie on the app's own origin" no longer
  describes the system, and batch 5.4's rows 14, 15 and 17 — cookie flags,
  `trustedOrigins`, sign-out invalidation — are rewritten for a token model.

Two smaller ones: the client SDK is **`@neondatabase/auth@0.5.0-beta`**, and
Neon Auth's configuration lives in Neon's console rather than in `neon.ts`,
which accepts only `auth: boolean`. So the auth configuration leaves the
repository, leaves code review, and leaves the test suite. `neon neon-auth`
commands are the record of what it is set to, and the settings below are written
down here for that reason.

## Immediate: close the open door

Neon Auth is enabled on the production branch **now**, with
`email_and_password: {enabled: true, disableSignUp: false}` — anyone can create
an account. Nothing of ours uses it and the tables are empty, but it is a live
registration surface.

- [x] `--enabled false` on the e-mail/password provider. The app uses Google,
      and that path was a door with nothing behind it.
- [x] `--disable-sign-up true` as well. It is redundant while the provider is
      off, and that is the point: if the provider is ever switched back on by
      accident, registration stays shut.
- [x] Trusted domain set to `https://lesson-planner-lac.vercel.app`, and it was
      the only one — the list was empty before.
- [ ] `allow_localhost` is still **on**. Neon's production checklist says to
      turn it off, and that is right, but the client does not exist yet and
      local development will need it. Batch 5.7 decides how local work signs in,
      and turns this off in the same change or records why not.

### The configuration as it now stands

Written here because `neon.ts` cannot hold it — its `auth` option accepts only
`boolean` or `{ enabled }`, so none of this is in the repository:

| Setting           | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Provider          | `better_auth`, branch `br-polished-term-b1eassui`                                   |
| Base URL          | `https://ep-blue-leaf-b1tc3hq3.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth` |
| Google            | Neon's **shared** OAuth application (`isShared: true`)                              |
| E-mail/password   | **disabled**, sign-ups **disabled**                                                 |
| Trusted domains   | the production origin only                                                          |
| `allow_localhost` | on — see the task above                                                             |

`neon neon-auth status`, `… config email-password get` and `… domain list` are
how to read it back.

## The work, in order

1. **This batch:** the decision, the costs, and closing the open door. No app
   code changes.
2. **5.6 — the allowlist webhook.** A `user.before_create` handler in
   `api/[...all].ts`, failing closed, idempotent on `X-Neon-Event-Id`, with the
   same equivalence-partitioning tests the current allowlist has. Plus the
   per-request session check that replaces the per-sign-in one.
3. **5.7 — the client.** `@neondatabase/auth` in the app, replacing
   `app/src/auth-client.ts`. The header button and `#/account` keep their shape;
   what changes underneath is where the session comes from.
4. **5.8 — the suite.** The `signedIn` fixture cannot use a test-only
   e-mail-and-password provider that no longer exists on our server. How a spec
   holds a session is an open question this batch answers before 5.7 lands.

## Parked, at lowest priority

The self-run Better Auth server stays in the repository, unused, until 5.7
removes it — and the decision to remove rather than keep is 5.7's to record.

It is worth saying what it already bought, because that is not lost: the
allowlist logic, its tests, the migration mechanism, PGlite, the response
headers and the routing fix are all independent of which auth service runs.
What is specific to it is `buildAuth` and the client.

**If Neon Auth does not work out**, the way back is this code, and the reason to
keep it is that it is tested and was proven against a real adapter.

## Merge order and dependencies

Depends on [5.4a](p5-04a-response-headers.md). Supersedes the auth choice in
RP-10's [sign-in page](../research/rp10-service-evaluation/auth.md). Deployable:
yes — no application code changes.

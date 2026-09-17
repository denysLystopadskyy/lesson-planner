# Batch 5.8 — How a spec holds a session

Phase 5 · [Plan home](README.md) · Prev: [5.6](p5-06-allowlist-webhook.md) · Next: 5.7 — the client

## Why this comes before the client

[5.7](p5-05-switch-to-neon-auth.md) removes the self-run Better Auth server, and
the `signedIn` fixture signs in against it. Answering this after 5.7 means
fixing a broken suite while also swapping a client. Answering it first means
5.7 does not touch the suite at all.

## The problem

The fixture used to get a **real** session: it posted to a test-only
e-mail-and-password provider on our own server and put the cookie on the
browser context. Neon runs that server now, and:

- its origin is `*.neon.tech`, so it cannot be run offline;
- `neon neon-auth user create` makes a user and issues **no** session;
- e-mail/password is disabled on the project, and enabling it to let a suite in
  would mean a live registration path that exists only for tests.

There is nothing left to sign in to.

## The decision

**Stub the session at the network boundary.** The client's request for the
current session is intercepted by Playwright and answered.

This works because of what the SDK actually is, which was checked rather than
assumed: `@neondatabase/auth` depends on `better-auth` 1.6.23 and uses its
`createAuthClient`, asking `get-session` over HTTP against a base URL. An
intercepted answer is indistinguishable, to everything above it, from a real
one.

The route is matched on the **path**, not the origin, so it keeps working when
5.7 points the client at Neon's host instead of ours.

### Why this is less machinery, not a workaround

The fixture it replaces needed three things that this does not:

|                                                 | Old                                              | New                |
| ----------------------------------------------- | ------------------------------------------------ | ------------------ |
| `AUTH_TEST_MODE` on the server                  | required                                         | not needed         |
| A password provider fenced off from production  | required, with a unit test asserting its absence | **does not exist** |
| An allowlisted test address in `ALLOWED_EMAILS` | required                                         | not needed         |

**There is no test-only door in the deployed code at all now.** The pretending
happens in the browser the spec controls, which is the right place for it: a
backdoor that ships is a backdoor, however well fenced.

### What it does not prove

That Neon will issue a session, or that the app can hold a real one. A stub
proves the app behaves correctly **given** a session.

The other half is a person signing in on production — which is exactly the
split `testing.md` already describes for Google. The mechanism changed; the
shape did not.

**This is a real reduction in coverage and it is worth naming.** The old fixture
exercised a genuine sign-in against a genuine server. Nothing in the suite does
that any more. What replaces it is the owner's first Google sign-in, and — when
Phase 6 gives the API something worth protecting — verifying a real token
server-side, which will need its own answer.

## Every signed-in spec asserts client-side behaviour

That is why this is sufficient rather than merely convenient. The nine specs
check the header label, the account view, the deep link, sign-out's
confirmation, and that the planner is untouched. **Not one of them calls our
API.** A session that only the browser believes in is enough for all of them.

## Proven, in both directions

The stub is load-bearing, which was checked by breaking it:

| Break                       | Result                                  |
| --------------------------- | --------------------------------------- |
| The stub is never installed | **6 specs fail**                        |
| The stub never signs out    | **exactly 1 fails** — the sign-out spec |
| Restored                    | 10 pass                                 |

The sign-out case is the one worth having. Without a stub whose answer
_changes_, the spec asserting that the header goes back to offering sign-in
would pass against a session that never ended.

## Acceptance criteria

- [x] All ten sign-in specs pass with no account, no secret and no network.
- [x] The stub fails the suite when removed, and the sign-out flip fails exactly
      the sign-out spec when removed.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean. `test:unit` 384. `test:e2e` 204.
- [x] No new `localStorage` key, no cookie on the context, no change to the
      storage contract.

## Left for 5.7

`scripts/serve.mjs` still sets `AUTH_TEST_MODE` and appends the e2e address to
`ALLOWED_EMAILS`, and the parked Better Auth server still reads both. Nothing
needs them any more, but removing them belongs with removing the server rather
than here.

## Merge order and dependencies

Depends on [5.6](p5-06-allowlist-webhook.md). Deployable: yes — test
infrastructure only, no application or API change.

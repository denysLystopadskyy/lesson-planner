# Batch 5.6 — The allowlist, as a webhook

Phase 5 · [Plan home](README.md) · Prev: [5.5](p5-05-switch-to-neon-auth.md) · Next: 5.7 — the client

## Goal

"Only these two people may sign in", enforced server-side, now that Neon runs
the sign-in server.

## Where it lives, and why not under `/api/auth/`

`POST /api/hooks/neon-auth`. Deliberately **not** under `/api/auth/`, which is
still routed to the parked Better Auth handler and would swallow it.

The handler is in `api/[...all].ts`, like everything else the function serves —
the deployed entry may import published npm packages and nothing else
(lesson 31).

## The contract, from Neon's documentation

`user.before_create` is a **blocking** event: the response decides whether the
sign-up completes.

|           |                                                                                  |
| --------- | -------------------------------------------------------------------------------- |
| Allow     | `200` with `{"allowed": true}`                                                   |
| Refuse    | `200` with `{"allowed": false, "error_message": …, "error_code": …}`             |
| Signature | Ed25519, detached JWS, over `base64url(timestamp + "." + base64url(rawBody))`    |
| Keys      | `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`, selected by `X-Neon-Signature-Kid` |
| Retries   | up to three, carrying the **same** `X-Neon-Event-Id`                             |

**The raw body is the signed input.** Re-serialising the parsed JSON produces
different bytes and a signature that never verifies — Neon's own guide warns
about it, and the handler reads `c.req.text()` before anything parses.

## Two properties it had to have, and one it got free

**It fails closed.** Every path that is not "signed by Neon, and on the list"
refuses:

| Situation                                           | Answer                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| Signed, and on the allowlist                        | `200 {allowed: true}`                             |
| Signed, not on the allowlist                        | `200 {allowed: false, error_code: "NOT_ALLOWED"}` |
| Not signed by Neon                                  | `401` — there is no sign-up here to rule on       |
| No `NEON_AUTH_BASE_URL`, or Neon's keys unreachable | `500 {allowed: false}`                            |
| Body is not JSON                                    | `400 {allowed: false}`                            |

The 500s are deliberate rather than lazy. Neon retries a 500 three times, which
is kinder to a real person caught by a transient network failure than an
immediate refusal — and if it never succeeds, the sign-up still fails. A
refusal by timeout is still a refusal.

**It is idempotent**, which Neon requires because a retry carries the same
event id. That is free rather than built: the answer is a pure function of the
address against `ALLOWED_EMAILS`, so the same event always gets the same reply
and nothing has to be remembered. A test asserts it rather than leaving it to
be inferred.

**Replay protection** is a five-minute window on `X-Neon-Timestamp`, checked
_before_ the cryptography — an old signature is a valid signature, and the
cheap check goes first.

## Tests

`api/webhook.test.ts`, sixteen cases, with a real Ed25519 keypair generated in
the test and the JWKS fetch stubbed.

The signing is written from Neon's documented algorithm rather than imported
from the code under test, so one mistake cannot become two. Every case except
the first has to fail: a body changed after signing, a signature from a
different key, an unknown `kid`, a signature older than five minutes, and each
of the three required headers missing in turn.

**The tests were checked against a broken implementation**, which is the only
way to know they check anything:

| Break                              | Result                            |
| ---------------------------------- | --------------------------------- |
| Verification always returns `true` | 7 of 16 fail                      |
| Freshness check removed            | exactly 1 fails — the replay case |
| Restored                           | 16 pass                           |

And the end-to-end half, because a unit test calls the application object and
would stay green with the route unmounted: `e2e/features/auth-webhook.spec.ts`
asserts an unsigned request is refused and that a `GET` is not a way in. It
names the two acceptable refusals rather than asserting "not 404", which is the
assertion lesson 33 records as worthless.

Two mistakes the suite caught in this batch, both mine:

- `check:pii` refused a fixture UUID containing `555555555555` — a twelve-digit
  run. The fixture changed; the check was right.
- The end-to-end spec expected `401` and got `500`. The **code** was right: the
  local server has no `NEON_AUTH_BASE_URL`, so it refuses before it reaches the
  signature. The spec now says so.

## Acceptance criteria

- [x] A signed request for a listed address is allowed; for anyone else it is
      refused with a readable message.
- [x] Unsigned, wrongly signed, stale and malformed requests are all refused.
- [x] A retry of the same event gets the same answer.
- [x] The tests fail when the implementation is broken, verified in both
      directions.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean. `test:unit` 384. `test:e2e` 204.
- [ ] **After the merge, owner:** set `NEON_AUTH_BASE_URL` on Vercel and point
      Neon's webhook at the deployed endpoint — see below. It cannot be done
      first: Neon will not accept a URL that is not answering.

## After the merge

The endpoint has to exist before Neon can be told about it, so this is the one
order that works:

1. Set `NEON_AUTH_BASE_URL` on Vercel (Production and Preview). It is **not a
   secret** — it is the public base URL from `neon neon-auth status` — but it
   is required, because without it the webhook refuses everything.
2. Point Neon at the endpoint:

```bash
neon neon-auth config webhook update \
  --enabled true \
  --url https://lesson-planner-lac.vercel.app/api/hooks/neon-auth \
  --enabled-events user.before_create \
  --timeout 10
```

3. Verify by attempting a sign-up with an address that is **not** on the list
   and confirming it is refused. That check is the whole point of the batch and
   cannot be made from here.

## What this does not do

It does not run on a returning sign-in — `user.before_create` fires on creation
only. The allowlist is therefore also enforced per request by the API, which is
batch 5.7's work and what Phase 6 needs anyway. Batch 5.5 records why that trade
was made, and batch 5.4's checklist row 13 is rewritten to ask for it.

## Merge order and dependencies

Depends on [5.5](p5-05-switch-to-neon-auth.md). Deployable: yes — the endpoint
is inert until Neon is told about it.

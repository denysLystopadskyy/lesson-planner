# Batch 5.3a — Sign-in UI, the account route, and a session for the suite

Phase 5 · [Plan home](README.md) · Prev: [5.2b](p5-02b-api-routing-and-rate-limit.md) · Next: [5.3](p5-03-sign-in-ui-account-route.md)

## Goal

A visible "Sign in with Google" button, an account view at `#/account`, and
sign-out with a confirmation. Signed out, the planner is exactly what it was.

Nearly all of [5.3](p5-03-sign-in-ui-account-route.md) is reachable here,
because the test-only path gives the suite a real session without Google.

## What shipped

- `#/account` in the `Route` union, `parseRoute` and `formatRoute`.
- `app/src/auth-client.ts` — `createAuthClient` with **no `baseURL`**, so the
  client uses the page's own origin. On Vercel the app and the function share
  one, which is why the cookie is first-party and there is no CORS to configure.
- `AccountView` and its CSS module: the signed-in address, what signing out
  does **not** delete, and the way back.
- The banner's account control, beside the toolbar rather than in it.
- Sign-out asks first (RP-07 §4), with the confirm beside every other confirm in
  `App` so the destructive wording lives in one place.
- The `signedIn` e2e fixture, and `e2e/features/sign-in.spec.ts`.
- **No new `localStorage` key.** The session is a cookie, so
  `storage-contract.spec.ts` is untouched.

## Five things the suite found, and none of them was the feature

Each of these was a real defect, and each was found by running something rather
than by reading it.

### 1. Gating the header control on the session left a blank space

The first version rendered nothing while `useSession()` was pending, to avoid
flashing "Sign in" at someone already signed in. Reading the session is a
network round-trip on every load, so that left the banner with **no account
control at all** until it came back — the control appeared late and the header
shifted, for everyone, on every load.

The flicker it avoided affects a signed-in person for the length of one request.
This app has at most two of those. The trade was not close, and
`group-card-keyboard.spec.ts` found it by measuring a tab order that was missing
a stop.

### 2. Signed out, `#/account` was a blank page

The account view rendered only when signed in; the group list rendered only when
the route was **not** `account`. Both conditions could be false at once, and
then nothing rendered — reachable from a stale bookmark.

Now one value, `showAccount`, drives both branches. One value cannot disagree
with itself.

### 3. Better Auth rejects empty Google credentials

`clientId: process.env["GOOGLE_CLIENT_ID"] ?? ""` looks harmless and is not:
Better Auth answers `CLIENT_ID_AND_SECRET_REQUIRED` and logs a SERVER_ERROR on
every request that touches the provider. A laptop and CI have no Google
credentials **and should not have** — the suite signs in through the test-only
path — so the provider is now configured only when both values exist.

It was visible in the Playwright web-server log on every run before this, under
the noise of a passing suite.

### 4. Rate limiting had no client IP, and then throttled the suite

Two findings in one. Better Auth warned it was "falling back to a single shared
per-path bucket" because nothing forwards a client address, so one person's
failed attempts would throttle the other — an availability problem, not an abuse
one. `advanced.ipAddress.ipAddressHeaders` now names the two headers Vercel's
edge sets, and only those: **an IP header is worth exactly as much as whatever
set it.**

Then the suite hit its own limit: nine specs signing in against one shared bucket
answered **429**. Throttling the suite proves nothing about throttling an
attacker, so rate limiting is off when `AUTH_TEST_MODE=1`. That flag now switches
two things, both meaning _this is not a deployment_, and a unit test asserts the
production configuration keeps rate limiting on — a sign-in endpoint with no rate
limit is the one thing here worth brute-forcing.

### 5. The allowlist blocks the test-only path too, which is correct

With `ALLOWED_EMAILS` unset the sign-up endpoint answers **403 `not_allowed`**,
because an empty list admits nobody. That is the designed behaviour meeting the
suite.

`scripts/serve.mjs` therefore appends one unmistakably fake address —
`planner-e2e@example.test`, on a reserved TLD that can never resolve — and
appends rather than assigns, so a developer testing real Google sign-in locally
keeps their own value.

**This is the strongest evidence the allowlist has.** Over real HTTP, against
the real handler: the listed address gets 200 and a session cookie, and
`stranger@example.test` gets 403 `not_allowed`. The unit tests check the
functions; this checks the thing that is actually deployed.

A sixth, smaller one: Better Auth answers 403 `MISSING_OR_NULL_ORIGIN` to a POST
with no `Origin` header. A browser always sends one and Node's `fetch` does not,
so the fixture sends it — and that the check fires at all is what batch 5.4's
checklist row 15 is about.

## Tests

`e2e/features/sign-in.spec.ts`, nine specs, BDD.

Signed out: the header offers Google and **nothing has navigated anywhere** —
asserted by the page still being on its own origin, which is how "never start
sign-in on load" is checkable at all. `#/account` shows the planner.

Signed in: the header names the account; the button opens the view; `#/account`
works as a deep link; an aria snapshot of the view; sign-out asks, and a refusal
changes nothing; sign-out confirmed returns the signed-out header; her groups are
untouched.

Four existing specs changed, all because the banner genuinely gained a control:
the exhaustive tab-order list, the smoke reachability list, the header aria
snapshot, and an a11y spec that counts Tab presses. **That is those specs working
rather than being in the way** — each says so in its own comment.

## Acceptance criteria

- [x] Full suite exit 0 — **198 passed**, up from 189.
- [x] `npm run test:unit` — 365 passed.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean.
- [x] Golden-shape and storage-contract specs untouched: no new storage key.
- [x] darwin pixel baselines regenerated **and proven** with a second run
      carrying no update flag.
- [ ] Linux pixel baselines — rendered by `baselines.yml`, which is the only way
      this machine can make them: it has no container runtime. Reviewed by a
      person, per the loop CLAUDE.md records.

## Carried forward to 5.3

- Real Google sign-in, by a person on production, once 5.2's console work is
  done. No spec can do it: Google forbids wildcard redirect URIs.
- The pixel baselines a person reviews.

## Merge order and dependencies

Depends on [5.2b](p5-02b-api-routing-and-rate-limit.md). Deployable: yes.
Signed out — which is everyone, until the owner's Google work in 5.2 — the app
gains one header button and changes nothing else.

# Batch 5.3 — Sign-in UI and the account route

Phase 5 · [Plan home](README.md) · Prev: [5.2](p5-02-better-auth-google-allowlist.md) · Next: [5.4](p5-04-security-review.md)

## Goal

A visible "Sign in with Google" button, an account view, and sign-out with a
confirmation. Signed out, the app is exactly today's app.

Routes and state: [react-migration.md](../../.claude/context/react-migration.md),
[state-management.md](../../.claude/context/state-management.md).

## Tasks (TDD)

- [ ] Route `#/account`: the `Route` union, `parseRoute`, `formatRoute` and
      one render branch in `App.tsx`. The routing spec gains the new hash and
      keeps the fall-through cases.
- [ ] A header button "Sign in with Google" that calls
      `authClient.signIn.social({ provider: "google" })` from a click. Never
      start sign-in without a user gesture; never on load.
- [ ] `app/src/auth-client.ts` with `createAuthClient` (same origin, no
      `baseURL`). A `useSession` hook wraps the library's.
- [ ] The account view: the signed-in e-mail and a "Sign out" button. Sign-out
      asks first (RP-07 §4: an explicit sign-out needs a confirmation), then
      returns to the signed-out state.
- [ ] Signed out: nothing else changes. The planner works from `localStorage`
      as today.
- [ ] e2e fixture `signedIn`: before the browser context is created, the
      fixture signs in through the test-only path on the local server and puts
      the session cookie on the context. It returns the e-mail it used.
- [ ] Specs (BDD): Given signed out, the planner works as before — the
      existing suite runs unchanged. Given signed in, the header shows the
      account. Sign-out asks, then the header shows the button again.
      `#/account` as a deep link. Aria snapshot of the account view. Pixel
      baselines for the header states, regenerated through `baselines.yml`.
- [ ] No new `localStorage` key in this batch: the session is a cookie. The
      storage-contract specs are untouched.

## Acceptance criteria

- Full existing suite exit 0 with no spec changed except the routing spec.
- Signed-in specs exit 0 at `--repeat-each=3`.
- Golden-shape spec untouched and green.
- Baselines regenerated and reviewed by a person (the `baselines.yml` loop).

## Merge order and dependencies

Depends on 5.2. Deployable: yes.

# Batch 5.2 — Better Auth server: Google sign-in with an allowlist

Phase 5 · [Plan home](README.md) · Prev: [5.1](p5-01-neon-database-plumbing.md) · Next: [5.3](p5-03-sign-in-ui-account-route.md)

## Goal

Two people can sign in with Google. Nobody else can. The session is a
first-party cookie on the app's own origin. No UI yet — this batch is the
server side, proven with unit tests and one manual sign-in.

Decisions and figures:
[RP-10 sign-in page](../research/rp10-service-evaluation/auth.md),
[security-auth.md](../../.claude/context/security-auth.md),
[backend.md](../../.claude/context/backend.md).

## Tasks

- [ ] **Owner, Google Cloud console:** a project; the OAuth consent screen
      (External; app name; support e-mail; scopes `openid`, `email`, `profile`
      only — non-sensitive, so no verification and no warning); publishing
      status **Testing** with the two accounts as test users. An OAuth client
      of type Web application: authorized JavaScript origins = the production
      origin and `http://localhost:4173`; authorized redirect URIs =
      `<origin>/api/auth/callback/google` for both. No wildcards (Google
      forbids them). Record the steps and dates; never record the secret.
- [ ] **Owner, Vercel:** environment variables `GOOGLE_CLIENT_ID`,
      `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET` (generated, 32+ bytes),
      `BETTER_AUTH_URL` (the production origin) and `ALLOWED_EMAILS`
      (comma-separated). All **Sensitive**, Production and Preview. Names into
      `.env.example`; values into `.env.local` only.
- [ ] Add `better-auth` (latest 1.7.x at install time, pinned). Read the
      changelog since RP-10's 1.7.3 before installing.
- [ ] `api/auth.ts`: Drizzle adapter; Google provider; explicit `baseURL`;
      `trustedOrigins` = production origin, the project's preview URL pattern,
      `http://localhost:4173`; database sessions with the library defaults;
      rate limiting with `storage: "database"` (memory does not survive a
      serverless instance); mounted at `/api/auth/*` in the Hono app.
- [ ] The allowlist: `user.validateUserInfo` rejects any identity whose e-mail,
      trimmed and lower-cased, is not in `ALLOWED_EMAILS`. It runs on creation,
      on linking and on every returning sign-in. Once both accounts exist, set
      `disableSignUp: true` on the provider as a second lock (a documented
      switch, not a code change).
- [ ] Generate the Better Auth schema into Drizzle, make the migration, apply
      it (5.1's mechanism).
- [ ] The test-only sign-in path: the e-mail-and-password provider is enabled
      **only** when `AUTH_TEST_MODE=1`. A unit test asserts that the production
      configuration has no such provider. `scripts/serve.mjs` sets the flag;
      Vercel never does. The rule goes in security-auth.md.
- [ ] Unit tests (Vitest + PGlite), techniques named in the `describe`:
      allowlist by equivalence partitioning and boundary values — listed;
      listed with different case; listed with surrounding spaces; not listed;
      empty list rejects everyone. Handler smoke test: the auth routes answer.
- [ ] **Owner:** turn on Dependabot security alerts for the repository
      (Settings → Code security). Record the date in security-auth.md. Reason:
      the advisory history on the sign-in page.
- [ ] **Owner, on production:** sign in with the teacher's account and with the
      maintainer's account (via a temporary test page or `curl` of the sign-in
      URL — the UI arrives in 5.3); try a third account and confirm the
      readable rejection page. Record the dates.
- [ ] **Owner, later:** switch the consent screen to **In production** after
      the first quiet week. In Testing, her authorization expires every seven
      days. Record the date.

## Acceptance criteria

- The two allowlisted accounts sign in on production; a third account is
  rejected with a readable message.
- Unit tests for the allowlist and the production-config guard are green.
- After `npm run build:app`, grepping `app/dist` for `GOOGLE_CLIENT_SECRET`,
  `BETTER_AUTH_SECRET` and the secret values' first characters returns
  nothing.
- `npm audit` is clean, or every finding is recorded with a reason.
- Dependabot security alerts are on (recorded).

## Merge order and dependencies

Depends on 5.1. Deployable: yes — no UI changes; the auth routes exist but
nothing links to them.

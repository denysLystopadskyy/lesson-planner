# RP-10 · Sign-in — Better Auth and its alternatives

Part of [RP-10 — Service evaluation](rp10-service-evaluation.md). Sibling pages:
[hosting](hosting.md), [database](database.md).

Research date: **2026-09-09**. Every figure is quoted as the vendor page stated
it on that day and carries a source id in brackets; the [Sources](#sources)
table gives the URL and access date. Where a page did not state something, this
report says `TBD (not stated)`.

## 1. What was asked

Whether Better Auth is the right way to add Google sign-in to a React app whose
backend will be a few serverless functions on the same origin. The alternatives
compared on the same criteria are Auth.js (NextAuth), Clerk, Auth0, Supabase
Auth, Firebase Auth, Cloudflare Access and Neon's managed auth. Section 4
covers the Google OAuth facts the plan depends on.

Two requirements shape the comparison. **Exactly two people may sign in** — the
teacher and the maintainer — so a one-email allowlist is mandatory, and the
mechanism for it matters more than any feature list. **The session must reach
the API functions** without token plumbing in the React code; a first-party
cookie on one origin is the simplest secure shape.

The earlier research ([RP-06 §1](../rp06-auth-gdpr/rp06-auth-gdpr.md)) compared
six options under a "no server" contract and chose Firebase Auth with
`signInWithPopup`. It never evaluated Better Auth, Auth.js, Clerk, Auth0 or
Supabase Auth, because they need a server. This page states that plainly rather
than implying they were ruled out. RP-06's deciding axis — recovery after a
device wipe, which favours a federated identity over anything device-bound —
still holds and still points at Google.

## 2. Better Auth

### What it is, version, licence, cadence

"A framework-agnostic, universal authentication and authorization framework for
TypeScript" [A1]. A library you run inside your own server code, against your
own database; no vendor-hosted user store is required. Licence MIT [A3].
Newest version "1.7.3, dated Sep 6, 2026"; the last minor "1.7.0, dated Aug 18,
2026" [A12]; several patch releases per week, a minor every few months, with
the previous minor line patched for a while [A2]. 1.7.0 carried breaking
changes ("Accounts now require `Account.issuer`") [A13], so upgrades are not
always drop-in.

### Company, funding, acquisition, hosted offering

Seed round of "$5 million" in June 2025 [A5]. On 2026-07-07: "Better Auth is
joining Vercel. We're joining to accelerate our work on open-source auth and
securing agent workflows." and "Vercel shares our commitment to keeping auth
open source, framework and platform agnostic." [A4]. A hosted "Better Auth
Infrastructure" (Starter $0, Pro $20/month) exists [A6]; whether it continues
after the acquisition is `TBD (not stated)`. This project does not need it.

### Running it in a Vercel function with a Vite + React client

Yes, from documented building blocks; no official "Vite + Vercel Functions"
example was found [A14].

- Web-standard handler: `auth.handler(request)` takes a `Request` and returns a
  `Response` (the Hono integration mounts it at `/api/auth/*`) [A16]. Node
  handler: `toNodeHandler(auth)`; "CommonJS (cjs) isn't supported. Use
  ECMAScript Modules (ESM)"; mount before any body parser [A15].
- Vercel accepts both shapes in `api/` [A17][A18]. Catch-all file naming is
  `TBD (verify)`; a rewrite to one `api/auth.ts` is the fallback. (The plan
  mounts everything in one Hono app anyway — see the
  [hub](rp10-service-evaluation.md).)
- Client: `createAuthClient` from `"better-auth/react"`; "If the auth server is
  running on the same domain as your client, you can skip" `baseURL`;
  `useSession()` returns `data, isPending, error, refetch`; sign-in is
  `authClient.signIn.social({ provider: "google", callbackURL: … })` [A19][A20].

### Database adapters, CLI, schema

Built-in Kysely adapter with a `pg` `Pool`; also Drizzle, Prisma and others
[A24][A25]. CLI: `npx auth@latest generate` (Prisma, Drizzle, Kysely) and
`npx auth@latest migrate` (built-in Kysely only) [A27]. Core tables: `user`,
`session`, `account` (1.7 adds `issuer`), `verification` [A28][A29][A13]. Neon's
HTTP driver `Pool` "must be connected, used and closed within a single request
handler" [A26], while Better Auth holds one pool at module scope — hence the
[database page](database.md)'s decision for `pg` over TCP.

### Google provider

Config: `clientId`, `clientSecret`, optional `hd` (Workspace domain only),
`prompt: "select_account"`, `accessType` [A30]. Redirect URI to register:
`https://your-domain.com/api/auth/callback/google` [A30]. State and PKCE:
Better Auth "stores the OAuth state and PKCE (Proof Key for Code Exchange)
using the configured state storage strategy"; the state is also "persisted in
a signed cookie for validation" [A31]. Default Google scopes: `TBD (not stated
on the page read)`.

### Sessions, cookies, CSRF

Database sessions by default; "The session expires after 7 days by default",
refreshed when `updateAge` (default 1 day) is reached [A33][A34]. Cookies
`${prefix}.session_token` etc.; "All cookies are `httpOnly` and `secure` when
the server is running in production mode"; `sameSite` "lax by default" [A35]
[A31]. Cookie cache is off by default [A34]. `BETTER_AUTH_SECRET` is required;
a default placeholder "throws in production if unset"; `baseURL` should be set
explicitly ("Inferred from incoming request if not set (not recommended for
security)") [A34]. CSRF: Better Auth validates `Origin` against
`trustedOrigins`, uses Fetch Metadata and `SameSite=Lax`; `trustedOrigins`
accepts wildcards such as `"https://*.example.com"` [A31][A34]. Two documented
defaults disagree between pages (cookie-cache strategy; rate-limit window) —
verify against the installed version [A33][A34][A39].

### The allowlist — the requirement that decides the comparison

Documented mechanisms, in order of fit:

1. **`user.validateUserInfo`**, added in 1.7.0: "a gate for rejecting an
   identity before a user is created or linked" [A12]. It fires before a user
   is created, before an account is linked, and "when an existing OAuth or SSO
   user signs in again"; "Return an object with `error` to reject it";
   browser flows go to the configured error URL, API flows get a 403 [A36].
   This is the right hook for a two-address allowlist because it also runs on
   every returning Google sign-in.
2. `databaseHooks.user.create.before` — abort on `false` or throw; creation
   only [A29][A36].
3. `socialProviders.google.disableSignUp: true` — "Prevent new user
   registration via provider" [A34]; a second lock once both accounts exist.
4. `hooks.before` middleware — its documented example targets email sign-up;
   for social sign-in the body has no email (issue #6527) [A37][A38]. Not
   suitable.
5. `hd` restricts to a Workspace domain [A30]; it cannot express "these two
   addresses".

### Rate limiting

Disabled in development; in production the rate-limit page says "Window: 60
seconds, Max Requests: 100 requests" (the options page says a 10-second window
— verify) [A39][A34]. Storage is memory by default, which "may not be suitable
… particularly in serverless environments"; use `storage: "database"` [A39].

### Plugins

Large ecosystem (2fa, passkey, organization, admin, api-key, sso, …) [A40].
None is needed here.

### Pricing and lock-in

Free (MIT). Lock-in low: the four tables live in the project's own Postgres; a
move away keeps `user` (and the stable Google subject in `account.accountId`)
and drops sessions. The real risks are maintenance churn (1.7 breaking changes)
and the new corporate owner; the stated commitment is to stay "open source,
framework and platform agnostic" [A4].

### Security record, September 2025 → September 2026

| Date       | Id                                   | What                                                                                  | Fix                    |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------- |
| 2025-10-08 | GHSA-99h5-pjcv-gr6v / CVE-2025-61928 | API-key plugin: keys for arbitrary users; High 8.6                                     | 1.3.26 [A41]           |
| 2025-12-15 | GHSA-x732-6j76-qmhm                  | Path normalization bypasses `disabledPaths` and rate limits; High 8.6                  | 1.4.6 [A42]            |
| 2026-05-11 | GHSA-wxw3-q3m9-c3jr                  | "OAuth callback accepts mismatched `state` when cookie-backed state storage is used without PKCE"; Moderate | 1.6.2 [A43][A44] |
| 2026-05-31 | five advisories                      | oauth-provider, sso, scim, deprecated oidc-provider plugins                            | [A45]                  |
| 2026-06-02 | "Security update: June 2026"         | 14 advisories incl. core OAuth account linking (High); "a dedicated security-review workstream" | core 1.6.11–1.6.14 [A46] |
| 2026-06-26 | GHSA-qq9h-g4jm-xgf3 and others       | magic-link/email-OTP pre-account hijacking (High); SCIM (Critical); SSO; Stripe        | plugins [A45]          |
| 2026-07-21 | Auth.js security update              | 4 advisories in @auth/core / next-auth                                                | [A47]                  |
| 2026-08-11 | GHSA-8c5h-wx78-2cfg                  | SSO domain-ownership flaws, High                                                       | [A45]                  |

Reading: most advisories are in plugins this app will not install. Three were
on the core Google-OAuth path (state check, account linking, path
normalization) and were fixed with advisories published. **Keeping
`better-auth` current is mandatory**; the plan turns on Dependabot security
alerts and gives the review batch an audit step.

### Relationship with Auth.js and Neon Auth

- Auth.js, 2025-09-22: "Auth.js is now part of Better Auth"; existing users
  "can continue doing so without disruption"; the team will "keep addressing
  security patches and urgent issues" and "strongly recommend new projects to
  start with Better Auth" [A7][A8]. authjs.dev carries the banner [A48].
- Neon, 2025-12-10: "Neon Auth is powered by Better Auth under the hood" [A9];
  today "Managed Better Auth" is "in Beta" on "Better Auth version 1.4.18",
  data in the `neon_auth` schema [A10]; the Stack Auth version is legacy [A11].

### Fit

Good on paper: same-origin cookie sessions (no CORS, no tokens in React), the
schema in the Neon database the plan already has, Google with PKCE and state,
and a documented gate that expresses "exactly these two emails". Costs: the
project owns upgrades and the security feed; rate-limit storage must be the
database on serverless; two documented-default conflicts to verify at install.

## 3. Alternatives

### Auth.js (NextAuth)

Maintenance mode under Better Auth (above). `@auth/core` "Receives a standard
Request and returns a Response", so it can run in a Web handler [A50], but the
install page says users "should never have to interact with `@auth/core`"
[A48] and `@auth/express` is "currently experimental" [A49]. Google provider,
`AUTH_SECRET`, JWE cookie sessions by default, `signIn` callback for an
allowlist ("Returning `false` … will stop the sign-in flow") [A50][A51]. Lock-in
lowest (no database needed). **Fit: works and is free, but its own maintainers
point new projects elsewhere.**

### Clerk

Hosted. "Hobby — Free" with "50,000 MRU (monthly retained user) limit per app";
Pro "$25/mo" [A53][A54]. Google in production "you must provide custom
credentials" [A56]. React SDK with `VITE_CLERK_PUBLISHABLE_KEY` [A57]. Sessions:
60-second JWTs refreshed every 50 seconds, `__session` cookie on same-origin
backends, stateless verification [A58][A59]. **The allowlist is a paid
feature:** "This feature requires a paid plan for production use" [A55]. EU
data residency `TBD (not found)`. Lock-in high. **Fit: the free tier cannot
enforce the one requirement that matters.**

### Auth0

Hosted. Free "Up to 25,000 monthly active users", "Unlimited Social
Connections", Actions "5"; Essentials "$35/month" [A60]. Google with own
credentials (dev keys "should not be used in production") [A61][A62]. Allowlist
via a post-login Action with `api.access.deny(...)` [A63]. The SPA holds
tokens; the API validates a JWT via JWKS [A64][A65]. Tenant region
`TBD (not on the page read)`. Lock-in medium-high. **Fit: works; heavy for two
users.**

### Supabase Auth

Free "50,000 monthly active users" but a Supabase project is required and
"Free projects are paused after 1 week of inactivity" [A66] — a second, pausing
Postgres beside Neon. Google via the Supabase callback; PKCE flow on static
sites [A67][A69]; JWT access token plus refresh token in local storage [A71];
API functions verify via JWKS [A72]. Allowlist via the "Before User Created"
hook or by turning sign-ups off [A73][A74][A75]. Lock-in medium. **Fit:
duplicates the database layer and inherits the pausing problem.**

### Firebase Auth

The earlier plan's choice. Spark: "50K MAUs" free [A76]. Blocking functions
need Identity Platform and the Blaze plan [A77][A78][A79]; an allowlist without
them is an application-level check in the function after
`verifyIdToken`, which checks `exp`, `iat`, `aud`, `iss`, `sub` but "does not
check whether or not the token has been revoked" [A81]. Popup versus redirect,
confirmed: "Starting June 24 2024, implementing one of the options will be
required for redirect sign-in to work on Google Chrome M115+. This is already
required on Firefox 109+ and Safari 16.1+." [A80] — so `signInWithPopup` for a
non-Firebase host. **New fact for the GDPR posture:** "The Firebase
Authentication service is run only from US data centers … processes data
exclusively in the United States." [A82]. Lock-in medium. **Fit: the popup
constraint stays, and the US-only processing is a transfer point the earlier
posture did not have.**

### Cloudflare Access (Zero Trust)

A zero-code gate in front of a whole site. "50 user limit" free, then "$7 per
user/month" [A83]. Google works "without a Google Workspace account" [A84];
policy rule "Emails" for an allowlist [A85]. Identity reaches the app as the
`Cf-Access-Jwt-Assertion` header, to be validated against the team's JWKS
[A86]. Constraint: needs "An active domain on Cloudflare" [A87]; Vercel says
"We do not recommend using a reverse proxy in front of Vercel" [A88], and the
`*.vercel.app` origin would stay reachable, so the functions would have to
validate the JWT anyway. Lock-in low. **Fit: the natural sign-in if hosting
goes to Cloudflare; an architectural mismatch with Vercel.**

### Neon Auth (Managed Better Auth)

Beta; Better Auth 1.4.18; `neon_auth` schema; Free "Up to 60k MAU" [A10][A89].
Google needs own credentials in production; redirect
`{NEON_AUTH_BASE_URL}/callback/google` [A90]; wildcard trusted domains for
previews since May 2026 [A91]. Session cookie lives on the Neon Auth host plus
a JWT in `session.access_token`, validated via JWKS [A92]. **No allowlist is
documented** — the console and API expose providers, domains and users but no
sign-up restriction [A93], and the SDK "restricts the options that can be
passed to the adapter" [A94]; enforcement would move into the API functions.
Auth-service region `TBD`. Lock-in medium. **Fit: attractive later, once GA
and with an allowlist; today the self-run library is the safer choice.**

## 4. Comparison table

| Option           | Hosted or self-run   | Free-tier headline                   | Google sign-in                 | One-email allowlist                                     | Session model                       | Own DB?           | Lock-in  | Fit                                          |
| ---------------- | -------------------- | ------------------------------------ | ------------------------------ | ------------------------------------------------------- | ----------------------------------- | ----------------- | -------- | -------------------------------------------- |
| Better Auth      | self-run in `api/`   | MIT, free                            | own credentials, PKCE + state  | `user.validateUserInfo`, `databaseHooks`, `disableSignUp` | DB session, httpOnly cookie        | yes (Neon)        | low      | **Best match**                               |
| Auth.js          | self-run             | free                                 | yes                            | `signIn` callback                                       | JWE cookie (or DB)                  | no                | low      | Works; maintenance-only                      |
| Clerk            | hosted               | 50,000 MRU                           | own credentials in production  | **Pro only ($25/month)**                                | 60 s JWT, `__session` cookie        | no                | high     | Free tier cannot allowlist                   |
| Auth0            | hosted               | 25,000 MAU                           | own credentials in production  | Action `api.access.deny`                                | JWT bearer to API                   | no                | med-high | Works; heavy                                 |
| Supabase Auth    | hosted               | 50,000 MAU; project pauses after 1 wk | yes                            | Before-User-Created hook / sign-ups off                 | JWT + refresh in localStorage       | second Postgres   | medium   | Duplicates Neon, inherits pausing            |
| Firebase Auth    | hosted (US only)     | 50K MAU                              | popup only off Firebase hosts  | blocking fn (Identity Platform + Blaze) or in-API check | ID token (bearer)                   | no                | medium   | Popup constraint; US-only processing         |
| Cloudflare Access | hosted gate         | 50 users                             | yes (plain Gmail)              | policy "Emails"                                         | Access JWT header                   | no                | low      | Needs a Cloudflare-proxied domain            |
| Neon Auth        | hosted (Beta)        | 60k MAU                              | own credentials in production  | **none documented**                                     | cookie on Neon host + JWT           | Neon              | medium   | Beta; no allowlist                           |

## 5. Google OAuth specifics the plan depends on

- **Publishing status.** "Projects configured with a publishing status of
  Testing are limited to up to 100 test users"; "Authorizations by a test user
  will expire seven days from the time of consent." "In production" apps "are
  available to any user with a Google Account." [A95]
- **Verification.** "If your app utilizes only non-sensitive scopes, it is not
  mandatory for your app to complete the app verification process." [A96] The
  unverified-app warning appears only for sensitive or restricted scopes
  [A95][A97]. `openid`, `email` and `profile` are non-sensitive, so: no
  verification, no warning. Plan: start in Testing with the two test users,
  switch to In production once stable (batch 5.2).
- **Origins and redirect URIs.** A JavaScript origin is scheme plus host; a
  redirect URI includes the path [A99]. "Redirect URIs must use the HTTPS
  scheme, not plain HTTP. Localhost URIs … are exempt"; "Redirect URIs cannot
  contain … Wildcard characters ('*')" [A100]. Vercel preview URLs change per
  commit; branch URLs are stable per branch [A101]. **Consequence: real Google
  sign-in works on production and on localhost. Preview deployments use the
  test-only sign-in path** (batch 5.2), unless a long-lived branch URL is
  registered by hand.
- **Secrets in this design.** `GOOGLE_CLIENT_SECRET` (the client id is public),
  `BETTER_AUTH_SECRET`, `DATABASE_URL`. Vercel: Sensitive environment variables,
  "non-readable once created", production and preview [A104]. GitHub Actions:
  only if a workflow needs them (for example a run against a preview URL);
  repository secrets are redacted in logs and not passed to forks [A105][A106].
  Nothing secret may carry a `VITE_` name.

## 6. Verdict for this project

**Better Auth, self-run inside the project's one API function, Google as the
only provider, the allowlist enforced by `user.validateUserInfo`.** Runner-up:
Neon's Managed Better Auth once it is GA and can restrict sign-ups; Cloudflare
Access if hosting goes to Cloudflare. The [hub page](rp10-service-evaluation.md)
states the deciding factors and what changes against RP-06.

## Sources

All accessed 2026-09-09.

| #    | Title                                             | URL                                                                                           | Accessed   |
| ---- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| A1   | Better Auth introduction                          | https://www.better-auth.com/docs/introduction                                                 | 2026-09-09 |
| A2   | Better Auth releases                              | https://github.com/better-auth/better-auth/releases                                           | 2026-09-09 |
| A3   | Better Auth repository                            | https://github.com/better-auth/better-auth                                                    | 2026-09-09 |
| A4   | Better Auth joins Vercel (blog)                   | https://better-auth.com/blog/better-auth-joins-vercel                                         | 2026-09-09 |
| A5   | Seed round (blog)                                 | https://better-auth.com/blog/seed-round                                                       | 2026-09-09 |
| A6   | Better Auth pricing (infrastructure)              | https://better-auth.com/pricing                                                               | 2026-09-09 |
| A7   | Auth.js joins Better Auth (blog)                  | https://better-auth.com/blog/authjs-joins-better-auth                                         | 2026-09-09 |
| A8   | next-auth discussion #13252                       | https://github.com/nextauthjs/next-auth/discussions/13252                                     | 2026-09-09 |
| A9   | Neon Auth powered by Better Auth (blog)           | https://neon.com/blog/neon-auth-branchable-identity-in-your-database                          | 2026-09-09 |
| A10  | Neon Auth overview                                | https://neon.com/docs/auth/overview                                                           | 2026-09-09 |
| A11  | Neon: migrate from legacy auth                    | https://neon.com/docs/auth/migrate/from-legacy-auth                                           | 2026-09-09 |
| A12  | Better Auth changelog                             | https://better-auth.com/changelog                                                             | 2026-09-09 |
| A13  | Release v1.7.0                                    | https://github.com/better-auth/better-auth/releases/tag/v1.7.0                                | 2026-09-09 |
| A14  | Vercel community: functions with Vite             | https://community.vercel.com/t/serverless-functions-in-react-vite/18776                       | 2026-09-09 |
| A15  | Better Auth: Express integration                  | https://www.better-auth.com/docs/integrations/express                                         | 2026-09-09 |
| A16  | Better Auth: Hono integration                     | https://www.better-auth.com/docs/integrations/hono                                            | 2026-09-09 |
| A17  | Vercel Functions API reference                    | https://vercel.com/docs/functions/functions-api-reference                                     | 2026-09-09 |
| A18  | Vercel Node.js runtime                            | https://vercel.com/docs/functions/runtimes/node-js                                            | 2026-09-09 |
| A19  | Better Auth client                                | https://www.better-auth.com/docs/concepts/client                                              | 2026-09-09 |
| A20  | Better Auth basic usage                           | https://www.better-auth.com/docs/basic-usage                                                  | 2026-09-09 |
| A24  | Better Auth: PostgreSQL adapter                   | https://www.better-auth.com/docs/adapters/postgresql                                          | 2026-09-09 |
| A25  | Better Auth: database concepts                    | https://www.better-auth.com/docs/concepts/database                                            | 2026-09-09 |
| A26  | Neon serverless driver                            | https://neon.com/docs/serverless/serverless-driver                                            | 2026-09-09 |
| A27  | Better Auth CLI                                   | https://www.better-auth.com/docs/concepts/cli                                                 | 2026-09-09 |
| A28  | Better Auth: session management                   | https://www.better-auth.com/docs/concepts/session-management                                  | 2026-09-09 |
| A29  | Better Auth: database hooks and schema            | https://www.better-auth.com/docs/concepts/database                                            | 2026-09-09 |
| A30  | Better Auth: Google provider                      | https://www.better-auth.com/docs/authentication/google                                        | 2026-09-09 |
| A31  | Better Auth: security reference                   | https://www.better-auth.com/docs/reference/security                                           | 2026-09-09 |
| A32  | Better Auth: OAuth concepts                       | https://www.better-auth.com/docs/concepts/oauth                                               | 2026-09-09 |
| A33  | Better Auth: session management (expiry)          | https://www.better-auth.com/docs/concepts/session-management                                  | 2026-09-09 |
| A34  | Better Auth: options reference                    | https://www.better-auth.com/docs/reference/options                                            | 2026-09-09 |
| A35  | Better Auth: cookies                              | https://www.better-auth.com/docs/concepts/cookies                                             | 2026-09-09 |
| A36  | Better Auth: users and accounts                   | https://better-auth.com/docs/concepts/users-accounts                                          | 2026-09-09 |
| A37  | Better Auth: hooks                                | https://www.better-auth.com/docs/concepts/hooks                                               | 2026-09-09 |
| A38  | Better Auth issue #6527                           | https://github.com/better-auth/better-auth/issues/6527                                        | 2026-09-09 |
| A39  | Better Auth: rate limit                           | https://www.better-auth.com/docs/concepts/rate-limit                                          | 2026-09-09 |
| A40  | Better Auth docs index (llms.txt)                 | https://better-auth.com/docs/llms.txt                                                         | 2026-09-09 |
| A41  | GHSA-99h5-pjcv-gr6v                               | https://github.com/better-auth/better-auth/security/advisories/GHSA-99h5-pjcv-gr6v            | 2026-09-09 |
| A42  | GHSA-x732-6j76-qmhm                               | https://github.com/better-auth/better-auth/security/advisories/GHSA-x732-6j76-qmhm            | 2026-09-09 |
| A43  | GHSA-wxw3-q3m9-c3jr                               | https://github.com/advisories/GHSA-wxw3-q3m9-c3jr                                             | 2026-09-09 |
| A44  | VulnCheck: state validation bypass                | https://www.vulncheck.com/advisories/better-auth-before-oauth-state-validation-bypass          | 2026-09-09 |
| A45  | Better Auth security advisories                   | https://github.com/better-auth/better-auth/security/advisories                                | 2026-09-09 |
| A46  | Security update: June 2026 (blog)                 | https://better-auth.com/blog/security-update-june-2026                                        | 2026-09-09 |
| A47  | Security update: July 2026 (blog)                 | https://better-auth.com/blog/security-update-july-2026                                        | 2026-09-09 |
| A48  | Auth.js installation                              | https://authjs.dev/getting-started/installation                                               | 2026-09-09 |
| A49  | Auth.js Express reference                         | https://authjs.dev/reference/express                                                          | 2026-09-09 |
| A50  | Auth.js core reference                            | https://authjs.dev/reference/core                                                             | 2026-09-09 |
| A51  | Auth.js Google provider                           | https://authjs.dev/getting-started/providers/google                                           | 2026-09-09 |
| A52  | NextAuth v4 options                               | https://next-auth.js.org/configuration/options                                                | 2026-09-09 |
| A53  | Clerk pricing                                     | https://clerk.com/pricing                                                                     | 2026-09-09 |
| A54  | Clerk pricing explained                           | https://clerk.com/articles/clerk-pricing-explained                                            | 2026-09-09 |
| A55  | Clerk: restricting access                         | https://clerk.com/docs/guides/secure/restricting-access                                       | 2026-09-09 |
| A56  | Clerk: Google connection                          | https://clerk.com/docs/authentication/social-connections/google                               | 2026-09-09 |
| A57  | Clerk React quickstart                            | https://clerk.com/docs/quickstarts/react                                                      | 2026-09-09 |
| A58  | How Clerk works                                   | https://clerk.com/docs/guides/how-clerk-works/overview                                        | 2026-09-09 |
| A59  | Clerk: manual JWT verification                    | https://clerk.com/docs/backend-requests/handling/manual-jwt                                   | 2026-09-09 |
| A60  | Auth0 pricing                                     | https://auth0.com/pricing                                                                     | 2026-09-09 |
| A61  | Auth0: Google connection                          | https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google       | 2026-09-09 |
| A62  | Auth0: developer keys                             | https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/devkeys      | 2026-09-09 |
| A63  | Auth0: login trigger                              | https://auth0.com/docs/customize/actions/explore-triggers/signup-and-login-triggers/login-trigger | 2026-09-09 |
| A64  | Auth0: access tokens                              | https://auth0.com/docs/secure/tokens/access-tokens                                            | 2026-09-09 |
| A65  | Auth0: validate access tokens                     | https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens                     | 2026-09-09 |
| A66  | Supabase pricing                                  | https://supabase.com/pricing                                                                  | 2026-09-09 |
| A67  | Supabase: Google sign-in                          | https://supabase.com/docs/guides/auth/social-login/auth-google                                | 2026-09-09 |
| A68  | Supabase: implicit flow                           | https://supabase.com/docs/guides/auth/sessions/implicit-flow                                  | 2026-09-09 |
| A69  | Supabase: PKCE flow                               | https://supabase.com/docs/guides/auth/sessions/pkce-flow                                      | 2026-09-09 |
| A70  | Supabase: server-side advanced guide              | https://supabase.com/docs/guides/auth/server-side/advanced-guide                              | 2026-09-09 |
| A71  | Supabase: sessions                                | https://supabase.com/docs/guides/auth/sessions                                                | 2026-09-09 |
| A72  | Supabase: signing keys                            | https://supabase.com/docs/guides/auth/signing-keys                                            | 2026-09-09 |
| A73  | Supabase: auth hooks                              | https://supabase.com/docs/guides/auth/auth-hooks                                              | 2026-09-09 |
| A74  | Supabase: before-user-created hook                | https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook                     | 2026-09-09 |
| A75  | Supabase: general configuration                   | https://supabase.com/docs/guides/auth/general-configuration                                   | 2026-09-09 |
| A76  | Firebase pricing                                  | https://firebase.google.com/pricing                                                           | 2026-09-09 |
| A77  | Firebase: blocking functions                      | https://firebase.google.com/docs/auth/extend-with-blocking-functions                          | 2026-09-09 |
| A78  | Firebase Authentication                           | https://firebase.google.com/docs/auth                                                         | 2026-09-09 |
| A79  | Cloud Functions for Firebase: get started         | https://firebase.google.com/docs/functions/get-started?gen=2nd                                | 2026-09-09 |
| A80  | Firebase: redirect best practices                 | https://firebase.google.com/docs/auth/web/redirect-best-practices                             | 2026-09-09 |
| A81  | Firebase: verify ID tokens                        | https://firebase.google.com/docs/auth/admin/verify-id-tokens                                  | 2026-09-09 |
| A82  | Firebase privacy and security                     | https://firebase.google.com/support/privacy                                                   | 2026-09-09 |
| A83  | Cloudflare Access product page                    | https://www.cloudflare.com/sase/products/access/                                              | 2026-09-09 |
| A84  | Cloudflare One: Google IdP                        | https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/google/             | 2026-09-09 |
| A85  | Cloudflare One: Access policies                   | https://developers.cloudflare.com/cloudflare-one/policies/access/                             | 2026-09-09 |
| A86  | Cloudflare One: validating the JWT                | https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/ | 2026-09-09 |
| A87  | Cloudflare One: self-hosted apps                  | https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/ | 2026-09-09 |
| A88  | Vercel KB: Cloudflare with Vercel                 | https://vercel.com/kb/guide/cloudflare-with-vercel                                            | 2026-09-09 |
| A89  | Neon pricing                                      | https://neon.com/pricing                                                                      | 2026-09-09 |
| A90  | Neon Auth: OAuth setup                            | https://neon.com/docs/auth/guides/setup-oauth                                                 | 2026-09-09 |
| A91  | Neon changelog 2026-05-15                         | https://neon.com/docs/changelog/2026-05-15                                                    | 2026-09-09 |
| A92  | Neon Auth: authentication flow                    | https://neon.com/docs/auth/authentication-flow                                                | 2026-09-09 |
| A93  | Neon Auth API                                     | https://neon.com/docs/neon-auth/api                                                           | 2026-09-09 |
| A94  | neon-js: Neon Auth vs Better Auth                 | https://github.com/neondatabase/neon-js/blob/main/packages/auth/neon-auth_vs_better-auth.md   | 2026-09-09 |
| A95  | Google: publishing status                         | https://support.google.com/cloud/answer/15549945                                              | 2026-09-09 |
| A96  | Google: OAuth app verification                    | https://support.google.com/cloud/answer/9110914                                               | 2026-09-09 |
| A97  | Google: unverified app screen                     | https://support.google.com/cloud/answer/7454865                                               | 2026-09-09 |
| A98  | Google: consent screen and authorized domains     | https://support.google.com/cloud/answer/10311615                                              | 2026-09-09 |
| A99  | Google Identity: client id, origins               | https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid                 | 2026-09-09 |
| A100 | Google OAuth 2.0 for web servers                  | https://developers.google.com/identity/protocols/oauth2/web-server                            | 2026-09-09 |
| A101 | Vercel: generated URLs                            | https://vercel.com/docs/deployments/generated-urls                                            | 2026-09-09 |
| A102 | Vercel: system environment variables              | https://vercel.com/docs/environment-variables/system-environment-variables                    | 2026-09-09 |
| A103 | Vercel: environment variables                     | https://vercel.com/docs/environment-variables                                                 | 2026-09-09 |
| A104 | Vercel: sensitive environment variables           | https://vercel.com/docs/environment-variables/sensitive-environment-variables                 | 2026-09-09 |
| A105 | GitHub Actions: using secrets                     | https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions | 2026-09-09 |
| A106 | GitHub Actions: secrets reference                 | https://docs.github.com/en/actions/reference/security/secrets                                 | 2026-09-09 |
| A108 | Neon Auth production checklist                    | https://neon.com/docs/auth/production-checklist                                               | 2026-09-09 |

Not verified (`TBD`): Better Auth's default cookie-cache strategy and
rate-limit window (two pages disagree); the CLI package name; Vercel catch-all
file naming in `api/`; Better Auth's default Google scopes; Clerk, Auth0 and
Neon Auth data regions; whether Better Auth Infrastructure continues after the
Vercel acquisition.

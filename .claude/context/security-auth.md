# Security and authentication

Referenced from [CLAUDE.md](../../CLAUDE.md). Background:
[RP-06 auth and data protection](../../docs/research/rp06-auth-gdpr/rp06-auth-gdpr.md)
(2026-08-20) and the
[RP-10 sign-in page](../../docs/research/rp10-service-evaluation/auth.md)
(2026-09-09).

## Personal data rule (applies to every document and commit)

No tracked file contains the owner's payment identifiers any more: the cutover
in plan batch 2a.4 deleted `index.html`, which held the full name, bank account
number (IBAN) and tax id at lines **387–392** and a personal first name at line
**400**. **They are still in git history**, and the research reports still cite
those line numbers.

The rule is unchanged in force: refer to the values only by line number in the
history, and never copy them into any file, commit message, ticket, or chat.

### Tests must not render the real template

**Any spec that opens the payment template, or renders a message generated from
it, must seed its own template** through the `template` option of
`plannerState`. The reason has changed but the rule has not: the shipped default
is now the neutral one in `app/src/message.ts`, so an unseeded spec renders
placeholders rather than real values — and a spec that asserts a message must
say which template produced it, or it is asserting a default that batch 3.5 may
still change.

Why this is separate from the cleanup below: `playwright.config.ts` keeps
`trace`, `video` and `screenshot` on failure, so an unseeded spec that fails
copies those values into CI artifacts. DEF-015 is about the values shipping in
the source; this is about them escaping into build output. Fixing one does not
fix the other, and this rule stops mattering only when batch 3.5 removes the
values from the app.

Known affected specs: `template-editing.spec.ts` (seeded in plan batch 1.4) and
`payment-messages.spec.ts` (arrives in batch 1.5).

### The React port ships neutral placeholders

`app/src/message.ts` defines its own `DEFAULT_TEMPLATE` with `<recipient>` and
`<account>` in place of the payment block. It is **not** a copy of
`App.config.defaultTemplate`: copying it would put the identifiers in a second
tracked file, which the rule above forbids, and batch 3.5 would then have two
places to clean instead of one (decision, plan batch 2a.3d).

The seeding rule above still applies unchanged. It protects against the legacy
page, which the suite keeps testing until cutover.

One consequence belongs to the cutover, not here: a browser with no
`paymentTemplate` key falls back to this neutral default, so the owner fills the
block in once in the template editor. Recorded as a task on plan batch 2a.4.

### When the data reaches a server (plan Phase 6)

The teacher's own template — with her own payment block — will be stored in
her own authenticated row on the database. That is her data, stored for her,
under the processors' data-processing agreements; it is not the leak this rule
is about. The rule keeps forbidding the values in any tracked file, fixture,
log, ticket or chat. Batch 3.5 (the grep gate) lands before Phase 6, as the
research required.

## Status of the cleanup

**Done in the working tree, and now enforced.** Plan batch 3.5 closed it. The
user marked it **low priority** (decision, 2026-08-20) and the values are
treated as already public, because they are in git history.

What landed:

- The cutover in plan batch 2a.4 deleted the file that held the values, and the
  React default template has carried neutral placeholders since 2a.3d.
- `npm run check:pii` (`scripts/check-no-personal-data.mjs`) fails the build
  when an IBAN-shaped string or a run of ten or more digits appears in a tracked
  file under `app/src`, `e2e` or `scripts`. It runs in CI.
- It matches **shapes, never values**. A script that grepped for the real IBAN
  would put the value back into the repository it exists to keep it out of, in
  the one file whose purpose advertises what it holds.
- It runs a `--self-test` on every invocation, so a regex edited into
  uselessness fails loudly instead of passing forever. A guard that has never
  failed is indistinguishable from one that cannot.

**Cleaning git history remains open, optional, and the owner's decision.** It
needs a history rewrite and a force push, which invalidates every existing
clone and every commit SHA cited in `docs/research/`. Nothing in the plan
depends on it. The build check deliberately reads the working tree only, and
says so in its own header: a build step is the wrong place to decide something
that rewrites published history.

## Decided on 2026-09-09 — sign-in, secrets and processors (plan Phases 5–6)

- **Sign-in is Better Auth, self-run inside the project's one API function,
  with Google as the only identity provider.** Why this and not Firebase Auth,
  Auth.js, Clerk, Auth0, Supabase Auth, Cloudflare Access or Neon's managed
  auth: the RP-10 sign-in page. The Firebase `signInWithPopup` preference of
  2026-08-20 is **superseded in mechanism, not in identity**. Better Auth uses
  the standard authorization-code redirect to a same-origin callback
  (`/api/auth/callback/google`) and sets a first-party cookie. The 2024
  redirect problem was specific to Firebase's flow, which relied on third-party
  storage on the Firebase auth domain; it does not apply here. What stays:
  Google only (RP-06's deciding axis — recovery after a device wipe), and a
  visible button starts sign-in. Never start sign-in on page load.
- **Exactly two accounts may sign in.** The allowlist is enforced server-side
  in Better Auth's `user.validateUserInfo`, from the `ALLOWED_EMAILS` variable
  (trimmed, lower-cased), on user creation, account linking and every returning
  sign-in. Once both accounts exist, `disableSignUp` on the provider is the
  second lock. Never enforce the allowlist only in the client.
- **Sessions** are database-backed, carried by a first-party cookie with
  `HttpOnly`, `Secure` and `SameSite=Lax`, with the library defaults for
  expiry and refresh. CSRF: `trustedOrigins` lists our origins only. Rate
  limiting stores its counters in the database (memory does not survive a
  serverless instance).
- **Secrets inventory.** Secret: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`. Configuration, not secret but
  server-side: `GOOGLE_CLIENT_ID`, `BETTER_AUTH_URL`, `ALLOWED_EMAILS`. Where
  they live: Vercel environment variables, marked **Sensitive**, for Production
  and Preview; `.env.local` (gitignored from plan batch 4.2) for the developer's
  machine; `.env.example` holds names only. **GitHub Actions holds no secret by
  default.** If a workflow ever needs one (for example the preview-bypass
  header), it is named here first. Values are never written into a document,
  a ticket or a chat.
- **"A static site cannot hold a secret" is re-scoped, not deleted.** The
  client bundle cannot: anything under `app/` that reads a `VITE_` variable
  ships it to the browser, and a secret must never carry a `VITE_` name. Only
  the code under `api/` may read secrets, from the environment. A grep of the
  built `app/dist` for the secret names and the database hosts is an
  acceptance criterion in batches 5.1 and 5.2.
- **A test-only sign-in path exists and is fenced.** The e-mail-and-password
  provider is enabled only when `AUTH_TEST_MODE=1`. A unit test asserts that
  the production configuration has no such provider. The local server sets
  the flag; Vercel never does. Real Google sign-in is exercised on production
  and on `localhost` only, because Google allows no wildcard redirect URIs and
  preview URLs change per commit.
- **Google Cloud console:** consent screen External with the non-sensitive
  scopes `openid`, `email`, `profile` only — no app verification and no
  "unverified" warning; publishing status Testing (two test users) first, then
  In production (in Testing, an authorization expires after seven days).
  Authorized redirect URIs: the production callback and the `localhost`
  callback, nothing else.
- **Security feed.** Better Auth published about ten advisories in the twelve
  months to 2026-09-09; three touched the core OAuth path and were fixed
  in-train. Rules: Dependabot security alerts on for the repository (owner);
  `better-auth` kept at the latest patch; `npm audit` in batches 5.2, 5.4 and
  6.5; no Better Auth plugins installed.
- **Response headers** are set through `vercel.json`: HSTS, `X-Content-Type-
Options: nosniff`, `Referrer-Policy`. Whether a Content-Security-Policy is
  set is decided in batch 5.4 (Vite emits no inline script by default, so a
  strict policy is feasible).
- **The security review (plan batch 5.4) is the gate for storing app data.**
  Its checklist covers secret management, deployment security, the Google
  OAuth flow, sessions, headers, logging and GDPR. No Phase 6 batch starts
  before every row has a result.
- **Processors and regions (GDPR).** RP-06 §5's "nothing contractual to do"
  was Google-specific. Vercel (functions in `fra1`, Frankfurt) and Neon
  (Frankfurt) are new processors: the owner reads and accepts both DPAs before
  any data is stored (batch 5.1) and reviews the subprocessor lists. The
  account data stored is what Google returns for the basic scopes: e-mail,
  name, picture URL. Firebase Authentication's US-only processing was one
  reason not to keep the earlier choice. Erasure is one action in batch 6.4.
  Retention stays `TBD` (below). These remarks are an engineer's reading of
  vendor documentation, not legal advice.
- **Vercel account hygiene:** MFA on; every variable Sensitive; the April 2026
  incident exposed non-sensitive variables of some customers.

## Decided (earlier, still in force)

- **The client bundle cannot hold a secret.** Anything shipped to the browser
  is public. Vite env variables prefixed for the client are embedded in the
  bundle — they are not hidden. Never put a secret in client code or config.
  (Re-scoped on 2026-09-09: the `api/` code may read secrets.)
- Secrets, if ever needed locally, live in `.env.local` (gitignored from plan
  batch 4.2; before that, no secret existed).
- The XSS sink (group name into `innerHTML`, `index.html:1046-1051`) is mostly
  dissolved by React/JSX escaping during the port. Import sanitation (currency
  whitelist, month-key validation) lands in plan batch 3.2.
- Public API keys are not secrets **only if** the server-side authorization
  does the work. In the Google sign-in design the client id is public and the
  client secret, the auth secret and the database URL are not. Details and the
  GDPR posture: RP-06 and the 2026-09-09 section above.
- **Superseded on 2026-09-09:** "Phase 4 sign-in preference: Google account
  (OAuth) via Firebase `signInWithPopup`, never `signInWithRedirect`." Kept
  here so the history reads correctly; see the first bullet of the 2026-09-09
  section for what replaced it and why.

## TBD

- DPA acceptance dates for Neon and Vercel — owner, plan batch 5.1.
- Dependabot security alerts turned on — owner, batch 5.2 (date here).
- Consent screen switched to In production — owner, batch 5.2 (date here).
- Content-Security-Policy: set, or the reason it is not — batch 5.4.
- Retention period for her data — from her accountant, through the owner
  (RP-06 §6, RP-09 D9). Never guessed, never automated. Batch 6.4 records the
  owner and the question.
- Resolved on 2026-09-09: "everything database-related is Phase 4
  brainstorming first". The options document is RP-10; the implementation is
  plan Phases 4–6.

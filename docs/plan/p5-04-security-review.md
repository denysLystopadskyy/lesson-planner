# Batch 5.4 — Security review I: secrets, deployment, the Google OAuth flow

Phase 5 · [Plan home](README.md) · Prev: [5.3](p5-03-sign-in-ui-account-route.md) · Next: [6.1](p6-01-schema-version-group-ids.md)

## Goal

Before any of the teacher's data is stored on a server, a person checks every
row below against the live system and writes down what they saw. Automation
helps; a result per row is the deliverable, as in
[3.6](p3-06-a11y-verification.md).

Rules under review: [security-auth.md](../../.claude/context/security-auth.md),
[deployment.md](../../.claude/context/deployment.md),
[backend.md](../../.claude/context/backend.md).

## Tasks

- [x] Walk the checklist. Every row has a result and evidence.
- [x] Rewrite the rows the architecture invalidated. Five of them
      (10, 12, 14, 16, and part of 21) described a system this project stopped
      running in [5.5](p5-05-switch-to-neon-auth.md), when Neon took over
      sign-in. A row that describes something else is worse than a blank one,
      because it can be ticked.
- [x] Response headers through `vercel.json`, with a spec that reads them —
      done in [5.4a](p5-04a-response-headers.md).
- [x] `npm audit` recorded with a decision.
- [x] Write the rotation procedure (below).
- [x] Update the processor posture in security-auth.md.

**Four rows need the owner and cannot be closed from here**, and three of them
are findings rather than formalities. They are listed under _What the owner
still has to do_.

## Checklist

| #   | Area             | Check                                                                                                                              | Result                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Secrets          | Every secret on Vercel is Sensitive; the list matches `.env.example`; none carries a `VITE_` name                                  | **Partly — owner**                                    | The `VITE_` half passes: the three `VITE_` names are `VITE_MOVED_TO`, `VITE_STORAGE_PREFIX` and `VITE_NEON_AUTH_URL`, and none is a secret — the last is a public URL the browser must be sent to. Whether each Vercel variable is flagged Sensitive cannot be read from here; the owner confirms it in the dashboard. Note the set shrank in batch 5.7: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `AUTH_TEST_MODE` are read by nothing now and should be **deleted**, not merely flagged. |
| 2   | Secrets          | `.env.local` is ignored by git; `git log -p` never contained a secret                                                              | **Pass**                                              | `git check-ignore` reports `.gitignore:19:.env.*`. No `.env`, `.env.local` or `.env.*` has ever appeared in any commit on any branch. A history-wide `-S'postgresql://'` search hits only this plan's own pages, listing the grep patterns.                                                                                                                                                                                                                                                                                              |
| 3   | Secrets          | GitHub Actions holds no secret, or each one is named here with its consumer                                                        | **Fail — one unnamed secret**                         | The repository holds **`NEON_API_KEY`**, created 2026-09-17T11:47:50Z when the Neon project was linked. **No workflow in `.github/workflows/` references it** — the only `secrets.` use anywhere is `GITHUB_TOKEN`. security-auth.md says a secret is named here before it exists; this one never was. **Owner:** confirm whether Neon's GitHub integration needs it, and delete it if not. An unused long-lived API key is pure risk. Variables `NEON_PROJECT_ID` and `PAGES_ACTIONS` are configuration, not secrets.                   |
| 4   | Secrets          | Rotation procedure written                                                                                                         | **Pass**                                              | Written below, under _Rotating a credential_. It changed with the architecture: there is no `BETTER_AUTH_SECRET` or Google client secret to rotate any more.                                                                                                                                                                                                                                                                                                                                                                             |
| 5   | Deployment       | Preview deployments require Vercel Authentication; the bypass secret is stored only where a workflow needs it                      | **Pass**                                              | Vercel reports `ssoProtection: enabled, all_except_custom_domains`, `passwordProtection: disabled`. Observed: a preview's `/api/health` answers **302 to `vercel.com/sso-api`**, production answers 200. No bypass secret exists, because no workflow needs one.                                                                                                                                                                                                                                                                         |
| 6   | Deployment       | The CI gate choice from 4.3 is in force: a red suite cannot publish                                                                | **Fail**                                              | `GET /repos/…/branches/main/protection` returns **404 Branch not protected**. The `checks` job is still advisory, exactly as `ci.yml`'s own header says, so a red suite can merge and Vercel deploys `main` regardless. **Owner:** make `checks` a required status check, which is the choice deployment.md recommends.                                                                                                                                                                                                                  |
| 7   | Deployment       | Node 24 in Vercel settings, `engines`, CI and the pinned Playwright image agree                                                    | **Pass**                                              | Vercel project `nodeVersion: "24.x"`; `package.json` `engines.node: "24.x"`; CI container `v1.63.0-noble` matching the installed `@playwright/test` 1.63.0, which `ci.yml` asserts on every run.                                                                                                                                                                                                                                                                                                                                         |
| 8   | Deployment       | Lockfile committed; `npm audit` clean or recorded; Dependabot security alerts on                                                   | **Partly — Dependabot off**                           | Lockfile committed. `npm audit` reports 4 moderate, all `drizzle-kit` → `esbuild` (GHSA-67mh-4wv8-2f99), recorded with reasons in [5.2a](p5-02a-better-auth.md). **Dependabot alerts are OFF**: `GET /repos/…/vulnerability-alerts` returns 404. **Owner:** Settings → Code security.                                                                                                                                                                                                                                                    |
| 9   | Deployment       | MFA on the Vercel, Neon, Google Cloud and GitHub accounts                                                                          | **Owner**                                             | Not readable from here. Google Cloud no longer applies — the OAuth client is Neon's (row 10), so there is no Google Cloud project of ours to protect.                                                                                                                                                                                                                                                                                                                                                                                    |
| 10  | OAuth flow       | Redirect URIs registered exactly: production and localhost, nothing else                                                           | **Rewritten — not ours any more**                     | Since [5.5](p5-05-switch-to-neon-auth.md) the OAuth client is **Neon's shared application**. Observed on the live authorization request: `client_id` `516759701042-…`, `redirect_uri` `https://neonauth.c-5.eu-central-1.aws.neon.tech/auth/oauth/callback/google`. **This project registers no redirect URI at all.** The consequence the owner should know: the consent screen names **Neon**, not the planner.                                                                                                                        |
| 11  | OAuth flow       | The authorization request carries `state` and PKCE                                                                                 | **Pass**                                              | Observed by starting a real sign-in and reading the redirect to `accounts.google.com/o/oauth2/v2/auth`: `state` present (208 chars), `code_challenge` present (43 chars), **`code_challenge_method=S256`**, `response_type=code`. A replayed `state` is Neon's to reject and cannot be exercised from here.                                                                                                                                                                                                                              |
| 12  | OAuth flow       | Consent screen: scopes `openid`, `email`, `profile` only; publishing status recorded                                               | **Pass**                                              | The live request carries `scope=email profile openid` — exactly the three non-sensitive scopes, so no verification and no "unverified app" warning. Publishing status is Neon's, not ours; their application is long since published, which is why the seven-day Testing expiry the plan worried about no longer applies.                                                                                                                                                                                                                |
| 13  | OAuth flow       | The allowlist is enforced server-side; a third account is rejected **on creation** by the webhook, and on every request by the API | **Partly — creation proven**                          | 2026-09-17: a sign-up for a non-allowlisted address was refused by Neon with our own `NOT_ALLOWED` message, through the real `user.before_create` webhook ([5.6](p5-06-allowlist-webhook.md)). The per-request half lands with Phase 6's first authenticated route — there is nothing to protect until then, and [5.7](p5-07-neon-auth-client.md) records why building it early would mean guessing its shape.                                                                                                                           |
| 14  | Sessions         | Session security: the token's transport, lifetime and storage                                                                      | **Rewritten — Neon's, not ours**                      | There is no cookie of ours to inspect. Since 5.5 the session is issued by Neon on a `*.neon.tech` origin and verified against its JWKS; `HttpOnly`/`Secure`/`SameSite` describe a design this project no longer runs. What this project controls is that nothing sensitive is stored client-side, which the `app/dist` grep covers. **Owner, when convenient:** read Neon's session lifetime and refresh defaults and record them here.                                                                                                  |
| 15  | Sessions         | Trusted origins list only our origins                                                                                              | **Partly — it is growing**                            | All ten entries are Vercel URLs under this project, so an attacker cannot claim one. But the list holds the three stable aliases **plus seven per-deployment URLs**, and something adds one on every deployment — only `https://lesson-planner-lac.vercel.app` was added by hand. Unbounded growth makes the list unauditable over time. **Owner:** prune the per-deployment entries, and find what is adding them. `neon neon-auth domain list` / `delete`.                                                                             |
| 16  | Sessions         | Rate limiting on sign-in attempts                                                                                                  | **Rewritten — Neon's**                                | Ours was removed with the self-run server in 5.7. Neon rate-limits its own auth endpoints and this project cannot configure or observe it. The allowlist webhook is the gate that matters, and it refuses before a user is created.                                                                                                                                                                                                                                                                                                      |
| 17  | Sessions         | Sign-out invalidates the session server-side                                                                                       | **Owner**                                             | Needs a real session. The app calls Neon's `signOut`, and the suite asserts the header returns to offering sign-in — but that is a stubbed session ([5.8](p5-08-a-session-for-specs.md)) and proves the UI, not the invalidation. Check it during the first real sign-in.                                                                                                                                                                                                                                                                |
| 18  | Headers          | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` present on `/` and `/api/health`                 | **Pass**                                              | Read off production at commit `36b27e5` on `/`, `/index.html`, `/nope` and a hashed asset: `max-age=63072000; includeSubDomains`, `nosniff`, `strict-origin-when-cross-origin`. **Read `x-vercel-cache` when repeating this** — the first attempt hit a cached response from the previous deployment and appeared to show them missing. Lesson 34.                                                                                                                                                                                       |
| 19  | Headers          | Content-Security-Policy decided                                                                                                    | **Pass — set**                                        | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.neon.tech; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`. Live on production, asserted by `response-headers.spec.ts`, which proves its own violation collector. `connect-src` gained Neon in [5.7](p5-07-neon-auth-client.md) — lesson 35, two correct batches with a broken seam.                                                                                                        |
| 20  | Logging          | Runtime logs hold no e-mail, no token, no template text                                                                            | **Pass**                                              | Two hours of production logs read 2026-09-17: request lines, a `pg` SSL deprecation warning, and Better Auth errors from before 5.7 removed it. No address, no token, no template text. Vercel keeps them one hour on Hobby, so this is a spot check by nature.                                                                                                                                                                                                                                                                          |
| 21  | GDPR             | Processors, regions and agreements                                                                                                 | **Partly — regions verified, reading is the owner's** | Regions verified: functions report `region: "fra1"`, the Neon project is Frankfurt. **There is nothing to "accept":** RP-10 records that Neon's DPA is _"embedded in our terms of service"_, which is why the owner found no such setting — it applied at signup. The task is to **read** both, and the subprocessor lists, and record the date. The processor list also changed: Google is reached through **Neon's** OAuth application now, so Neon is a processor for the sign-in flow itself.                                        |
| 22  | GDPR             | The account data stored is listed, and nothing more is stored                                                                      | **Pass**                                              | `neon_auth.user` holds: `id, name, email, emailVerified, image, createdAt, updatedAt, role, banned, banReason, banExpires`. The last four are Better Auth's admin plugin, unused here. **No planner data is on any server** — `public` holds no tables at all, and Phase 6 is what changes that.                                                                                                                                                                                                                                         |
| 23  | Incident lessons | Non-sensitive env vars; the account recovery path is written down                                                                  | **Partly**                                            | The April 2026 Vercel incident exposed variables that decrypt to plaintext. Of our three `VITE_` names none is a secret, and the server-side set should now shrink to `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_AUTH_BASE_URL` and `ALLOWED_EMAILS` — of which only the first two are secrets. **Owner:** delete the five dead ones (row 1) and write the recovery path: how to regain the Vercel, Neon and GitHub accounts if the Google account behind them is lost.                                               |

## Rotating a credential

The list is shorter than this page originally assumed, because
[5.7](p5-07-neon-auth-client.md) removed the self-run auth server. There is no
`BETTER_AUTH_SECRET` and no Google client secret of ours to rotate — Neon holds
the OAuth application.

**The database password.** In the Neon console, reset the role's password. The
Neon–Vercel integration rewrites `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in
the Vercel project; **redeploy**, because a running function holds the old value
until something replaces it. Then `curl /api/health` and confirm `db: "ok"`.
Locally, `neon env pull` rewrites the same three lines in `.env.local` and
leaves every other line alone.

**`ALLOWED_EMAILS`.** Not a secret, but it is the whole access-control boundary,
so treat a change like one. Edit it on Vercel and redeploy. **Verify by
attempting a sign-up with an address that is not on the list and confirming the
refusal** — and understand what that proves: a webhook refusing a stranger and
a webhook refusing _everyone_ are indistinguishable from outside. The only
check that separates them is an allowlisted person signing in successfully.

**`NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_URL`.** Not secrets. They change if the
Neon project or branch changes. Read the new value from `neon neon-auth status`,
set both, redeploy, and confirm `/api/health` reports `auth: "ready"` and the
sign-in button reappears.

**`NEON_API_KEY`** (the GitHub secret in row 3). Rotate it in the Neon console
if it is needed at all — and first establish whether it is, because nothing in
this repository uses it.

## What the owner still has to do

Four rows, three of which are findings.

1. **Turn on Dependabot security alerts** (row 8). Off today.
2. **Make `checks` a required status check for `main`** (row 6). The branch has
   no protection at all, so a red suite can merge and deploy.
3. **Decide the fate of `NEON_API_KEY`** (row 3). It exists, nothing here uses
   it, and it was never named in security-auth.md as the rule requires.
4. **Prune the trusted-domain list and find what is growing it** (row 15). Ten
   entries, seven of them per-deployment URLs nobody added by hand.

And the ordinary ones: MFA on the three remaining accounts (row 9), delete the
five dead Vercel variables (rows 1 and 23), write the account-recovery path
(row 23), read both DPAs and the subprocessor lists and record the date
(row 21), and confirm sign-out invalidates the session during the first real
sign-in (row 17).

## Does this gate Phase 6?

The rule is unchanged: **no batch that stores the teacher's data on a server
starts until every row has a result.** Every row now has one.

Two of them are _failures_ rather than gaps — rows 3 and 6 — and neither is
about storing data. They are about who can merge and what credentials exist, and
both are one owner action each. **Phase 6 is not blocked by this page**, but
6.3, the batch where her data first reaches the server, should not merge into a
`main` that a red suite can publish from. That is row 6, and it is the one to do
first.

## Acceptance criteria

- [x] Every row has a result and evidence — a command and its output, a live
      observation, or a dated statement.
- [x] Every failed row is either fixed here or named as an owner action with
      what to do.
- [x] The header spec is green (`response-headers.spec.ts`, batch 5.4a).
- [x] Rows that no longer described the running system are rewritten rather than
      ticked.

## Merge order and dependencies

Depends on 5.3. Closes Phase 5 and gates Phase 6: no batch that stores app
data on the server starts before this page is complete. Deployable: yes.

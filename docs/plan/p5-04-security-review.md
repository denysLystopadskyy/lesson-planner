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

- [ ] Walk the checklist. Fill "Result" and "Evidence" for every row. A row
      that fails becomes a fix in this batch, a task in Phase 6, or a dated TBD
      in the context file that owns it.
- [ ] Add response headers through `vercel.json` where the rows below ask for
      them, and test them with an e2e spec that reads the headers.
- [ ] Run `npm audit` and record every finding with a decision.
- [ ] Update RP-06 §5's posture in security-auth.md: processors now include
      Vercel and Neon; regions; DPAs accepted (5.1).

## Checklist

| #   | Area             | Check                                                                                                                 | Result | Evidence |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| 1   | Secrets          | Every secret on Vercel is marked Sensitive; the list matches `.env.example`; none carries a `VITE_` name              |        |          |
| 2   | Secrets          | `.env.local` is ignored by git; `git log -p` never contained a secret                                                 |        |          |
| 3   | Secrets          | GitHub Actions holds no secret, or each one is named here with its consumer                                           |        |          |
| 4   | Secrets          | Rotation procedure written: how to rotate `BETTER_AUTH_SECRET`, the Google client secret and the database password    |        |          |
| 5   | Deployment       | Preview deployments require Vercel Authentication; the bypass secret is stored only where a workflow needs it         |        |          |
| 6   | Deployment       | The CI gate choice from 4.3 is in force: a red suite cannot publish                                                   |        |          |
| 7   | Deployment       | Node 24 in Vercel settings, `engines`, CI and the pinned Playwright image agree                                       |        |          |
| 8   | Deployment       | Lockfile committed; `npm audit` clean or recorded; Dependabot security alerts on                                      |        |          |
| 9   | Deployment       | MFA on the Vercel, Neon, Google Cloud and GitHub accounts                                                             |        |          |
| 10  | OAuth flow       | Redirect URIs registered exactly: production and localhost, nothing else                                              |        |          |
| 11  | OAuth flow       | The authorization request carries `state` and PKCE; a replayed or mismatched `state` is rejected (observed)           |        |          |
| 12  | OAuth flow       | Consent screen: scopes `openid`, `email`, `profile` only; publishing status recorded                                  |        |          |
| 13  | OAuth flow       | The allowlist is enforced server-side; a third account is rejected on every sign-in, not only the first               |        |          |
| 14  | Sessions         | Cookie flags observed: `HttpOnly`, `Secure`, `SameSite=Lax`; expiry and refresh as configured                         |        |          |
| 15  | Sessions         | `trustedOrigins` lists only our origins; a cross-origin POST is rejected (observed)                                   |        |          |
| 16  | Sessions         | Rate limiting uses the database; a burst of sign-in attempts is throttled (observed on a preview)                     |        |          |
| 17  | Sessions         | Sign-out invalidates the server session; the cookie no longer works afterwards                                        |        |          |
| 18  | Headers          | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` present on `/` and `/api/health`    |        |          |
| 19  | Headers          | Content-Security-Policy decided: either set (Vite emits no inline script by default) or the reason it is not recorded |        |          |
| 20  | Logging          | Runtime logs hold no e-mail, no token, no template text; Vercel keeps them one hour on Hobby                          |        |          |
| 21  | GDPR             | Vercel and Neon DPAs accepted; regions `fra1` and Frankfurt recorded; subprocessor lists read                         |        |          |
| 22  | GDPR             | The Google account data stored (e-mail, name, picture URL) is listed in security-auth.md; nothing more is stored      |        |          |
| 23  | Incident lessons | Non-sensitive env vars: none exist (April 2026 incident); the account recovery path is written down                   |        |          |

## Acceptance criteria

- Every row has a result and evidence (a screenshot path, a command and its
  output, or a dated statement).
- Every failed row is either fixed in this batch or tracked as a Phase 6 task
  or a dated TBD.
- The header spec is green.

## Merge order and dependencies

Depends on 5.3. Closes Phase 5 and gates Phase 6: no batch that stores app
data on the server starts before this page is complete. Deployable: yes.

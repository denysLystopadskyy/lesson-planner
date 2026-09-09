# RP-10 · Hosting — Vercel and its alternatives

Part of [RP-10 — Service evaluation](rp10-service-evaluation.md). Sibling pages:
[database](database.md), [sign-in](auth.md).

Research date: **2026-09-09**. Every figure is quoted as the vendor page stated
it on that day and carries a source id in brackets; the [Sources](#sources)
table gives the URL and access date. Where a page did not state something, this
report says `TBD (not stated)`.

## 1. What was asked

Whether Vercel should replace GitHub Pages as the host, and if so when. The
alternatives compared on the same criteria are Netlify, Cloudflare (Pages and
Workers with static assets), Render, and staying on GitHub Pages with a
backend somewhere else. The criteria: what it is, the problem it solves, key
features for a Vite single-page app plus a small `api/`, pricing and free tier,
limits, lock-in, and fit for this app.

Two facts about this app decide most of the comparison. First, it needs a place
to run a server-side sign-in handler and database queries, which GitHub Pages
cannot provide. Second, moving hosts changes the browser origin, so the
teacher's `localStorage` data must be exported and imported once — see the
[hub page](rp10-service-evaluation.md#4-what-changes-against-the-earlier-research).

## 2. Vercel

### What it is and the problem it solves

Vercel hosts static front-ends on a CDN and runs server code as "Vercel
Functions". It deploys from Git — one deployment per push, a preview URL per
pull request — and sells a Hobby (free), Pro and Enterprise plan. It solves the
same problem GitHub Pages solves today (static hosting from Git) and adds the
piece this project lacks: a private execution context for the auth handler and
the database access.

### Key features for a Vite SPA with `api/` functions

- **Detection and build.** Vite is a framework preset; a Vite SPA deploys with
  zero config [H17]. "Vercel will deploy any file in the `/api` directory as a
  function." Without a framework the project needs `"type": "module"` or
  `.mjs` files [H14]. The `/api` folder is resolved from the project root
  Vercel builds from.
- **Handler shapes.** Web Handler (`export function GET(request: Request)`),
  the `fetch` export, or a Node `(request, response)` handler with Vercel
  helpers. The Web-standard forms are the portable ones [H14].
- **Function cap on Hobby.** "For Hobby, this approach is limited to 12 Vercel
  Functions per deployment." [H8] One catch-all route is one function.
- **Fluid compute** is the default for new projects since 2025-04-23; bytecode
  caching on Node 20+ reduces cold starts in production; default and maximum
  duration on Hobby "300s (5 minutes)" [H9]. Functions not invoked for two weeks
  in production are archived and get a cold start "at least 1 second longer
  than usual" [H9].
- **Node.js.** "Current available versions are: 24.x (default), 22.x, 20.x";
  Node 24 became generally available on 2025-11-25; Node 20 "is being
  deprecated on October 1, 2026" [H12][H13]. Set with `"engines": { "node":
  "24.x" }` or in project settings.
- **Regions.** Default `iad1` (Washington, D.C.). "Hobby | Single region",
  changeable to `fra1` (Frankfurt) in the dashboard or with `"regions":
  ["fra1"]` in `vercel.json` [H15][H16].
- **Previews and GitHub.** "Vercel for GitHub will deploy every push by
  default." Each PR gets a preview URL, a PR comment and a commit status;
  Vercel also emits `repository_dispatch` events such as
  `vercel.deployment.success` with the URL in the payload [H26][H27]. Hobby
  projects cannot connect to repositories owned by a GitHub organization; this
  repository is under a personal account [H26].
- **Instant Rollback.** "Hobby users can roll back to the immediately previous
  deployment." Pro can roll back to any earlier production deployment [H18].
- **Custom domains:** "Domains per Project: Hobby 50" [H4].
- **Environment variables.** "Sensitive environment variables are environment
  variables whose values are non-readable once created", production and
  preview only; build logs redact sensitive values of 32+ characters [H19].
- **Deployment Protection.** "On the Hobby plan, Vercel Authentication with
  Standard Protection is available. This protects your preview deployments and
  deployment URLs, but your production domain remains publicly accessible."
  Password protection is Enterprise or a paid Pro add-on [H20]. Protection
  Bypass for Automation exists on all plans: header
  `x-vercel-protection-bypass` plus `x-vercel-set-bypass-cookie`, secret in
  `VERCEL_AUTOMATION_BYPASS_SECRET` [H21][H22].
- **Firewall.** DDoS mitigation on every plan; Hobby gets "Up to 3" custom
  WAF rules and IP blocks [H23]. Bot Protection managed ruleset plan
  availability: `TBD (not stated)` [H24][H25].
- **Marketplace Neon.** "Paid through Vercel", account "Created automatically
  via Vercel", injects `DATABASE_URL` and friends, a Neon branch "for every
  Vercel Preview Deployment" [H34]. Hobby users land on the Neon Free plan
  [H36]. See the [database page](database.md#vercel-integration).
- **Logs.** Runtime logs: "Hobby | 1 hour of logs", "Pro | 1 day of logs"; Log
  Drains are Pro only [H30].

### Hobby plan limits (exact, 2026-09-09)

"$0/mo." Per month: Edge Requests "1M", Fast Data Transfer "100 GB", Function
Invocations "1M", Fluid Active CPU "4 hours", Fluid Provisioned Memory
"360 GB-hrs", Runtime Logs "1 hour of logs" [H1][H2]. General: Projects "200",
"Deployments Created per Day 100", "Concurrent Deployments 1", "Build Time per
Deployment (Minutes) 45" [H4]. Monthly build-minute cap: `TBD (not stated)`.
Team members: "Collaborating with other members on projects is available on
the Pro and Enterprise plans" — a Hobby team is one person [H29]. Overage: "if
you exceed your usage limits on the Hobby plan, you will have to wait until 30
days have passed before you can use the feature again" [H2].

### The non-commercial rule — the main risk

Terms of Service (2026-06-01): "You shall only use the Services under a Hobby
plan for your personal or non-commercial use." and "We reserve the right to
disable or remove any Project or website deployment on the Hobby plan with or
without notice at our sole discretion." [H6]

Fair Use Guidelines: "Hobby teams are restricted to non-commercial personal use
only… Commercial usage is defined as any Deployment that is used for the
purpose of financial gain of anyone involved in any part of the production of
the project, including a paid employee or consultant writing the code. Examples
of this include, but are not limited to: Any method of requesting or processing
payment from visitors of the site; Advertising the sale of a product or
service; Receiving payment to create, update, or host the site; Affiliate
linking is the primary purpose of the site; The inclusion of advertisements".
"If you are unsure… please contact the Vercel Support team." [H5]

Assessment. None of the five examples applies: the app requests no payment from
visitors, shows no ads, sells nothing, and nobody is paid to build or host it.
The teacher is a user, not part of "the production of the project". So the
letter of the definition is met. The grey zone is the general clause: the
deployment exists so a self-employed person can bill her students, which is
"financial gain" in a loose reading, and Vercel decides alone. Two honest
positions: **(a)** stay on Hobby and ask Vercel Support in writing for a ruling
before any real data is stored on the platform; **(b)** budget Pro at
"$20/month" [H3], which removes the question and also gives 1-day logs and
rollback to any deployment. The plan makes (a) an owner action in batch 4.1
with (b) and Cloudflare as the recorded fallbacks.

### Lock-in

`vercel.json` carries only rewrites, `regions` and function config. Web-standard
handlers port to Netlify or to a Node server with a thin wrapper; the Node
`(req, res)` variant with `@vercel/node` helpers and `@vercel/functions`
utilities are Vercel-only. The Vite output is plain static files. The
Marketplace Neon shape ties billing to Vercel; the Neon-managed shape does not.
**Overall: low to medium.** Note that Better Auth, the recommended sign-in
library, joined Vercel in July 2026 (see the [sign-in page](auth.md)) — a
concentration to be aware of, not a technical lock-in.

### CI: keeping the Playwright suite in GitHub Actions

Today's PR workflow (Prettier, ESLint, tsc, Vitest, Playwright against a local
preview) stays unchanged; Vercel's Git deploy runs in parallel and adds its own
commit status. Two facts matter for the plan:

- Today's deploy workflow has the property "a red suite cannot publish" — the
  deploy job depends on the verify job. With Vercel's Git integration, a push
  to `main` deploys regardless of CI. The property survives only if **CI
  becomes a required status check** (an owner-only repository setting), or if
  deployment moves into GitHub Actions with `vercel build` and
  `vercel deploy --prebuilt` [H27]. Batch 4.3 records the choice.
- To also test the real preview, a workflow can listen for
  `repository_dispatch` with type `vercel.deployment.success` and use
  `client_payload.url` as the base URL, sending the protection-bypass header
  [H27][H21]. Optional; the local suite remains the gate.

### Security notes

April 2026: an attacker compromised "a third-party AI tool used by a Vercel
employee", took over that employee's accounts and reached "a limited subset of
customers whose non-sensitive environment variables stored on Vercel (those
that decrypt to plaintext) were compromised". Sensitive variables were not
affected. Vercel's guidance: rotate non-sensitive variables, use the sensitive
feature, enable MFA [H32]. **For this project: every secret is created as
Sensitive, and MFA is on from day one.** Also a service disruption on
2025-10-20.

### Fit

Technically good: zero-config Vite, `api/` Node 24 functions, `fra1`
selectable on Hobby, Neon Free through the Marketplace, previews per PR. Weak
points: one-hour log retention, rollback only one step, the 12-function cap
(irrelevant here), and the non-commercial wording.

## 3. Alternatives

### Netlify

Accounts created on or after 2025-09-04 are on credit-based plans: Free "$0
forever", "300 credits/month (hard limit, no recharge)"; Personal "$9/month";
Pro "Starts at $20/month" [H38][H39]. Conversion: "Production deploys: 15
credits each", "Bandwidth: 20 credits per GB", "Web requests: 2 credits per
10,000 requests", "Compute: 10 credits per GB-hour", "Deploy Previews/Branch
deploys: Free" [H40]. When credits run out "all web projects are paused and
visitors receive a Site not available page". 300 credits buy at most 20
production deploys a month with nothing else.

Functions: Web-standard handlers, Node 24 available, "Synchronous execution
timeout 60 seconds" [H43][H44][H46]. Region default "cmh US East (Ohio)";
"Pro and Enterprise plans only can change region" [H44]. **On Free, functions
stay in Ohio — an ocean away from a Frankfurt database.**

Commercial use: the Self-Serve Subscription Agreement (2025-10-01) has no
non-commercial clause, but "the Free Usage Tier is offered at Netlify's sole
discretion… Netlify may shut down Free Usage Tier website projects without
notice for any reason or no reason" [H52]. Deploy Previews per PR, instant
rollback by re-publishing an earlier deploy [H48][H49]. Secrets Controller
"scans your repository code and build output files for the existence of secret
values" and fails the build on a hit — the only one of the three that would
catch a `VITE_` leak; its availability on Free is `TBD (not stated)` [H47].
Lock-in low to medium (`netlify.toml`, `netlify/functions`).

**Fit: workable, but US-only functions next to a Frankfurt database and a
20-deploy ceiling are the wrong shape.**

### Cloudflare — Pages and Workers with static assets

Cloudflare's own direction (Pages docs banner, 2026-08-25): "Workers supports
most Pages use cases and offers a broader feature set. It is Cloudflare's
primary platform for building applications. Start new projects with Workers."
[H56][H58]. Workers Free: "100,000 per day" requests, "10 milliseconds of CPU
time per invocation", "Requests to static assets are free and unlimited",
20,000 static files; Paid "$5 USD per month" [H59][H60]. Workers Builds Free:
"3,000 per month" build minutes; PRs get a comment and a preview URL [H61][H62]
[H63]. Rollback to "the 100 most recently published versions" [H64]. Logs Free:
"200,000 per day", "3 Days". D1 Free "5 GB (total)"; Hyperdrive on Free [H70]
[H72]. No region choice; "Smart Placement is available on all Workers plans"
[H66].

Commercial use: the Self-Serve Subscription Agreement (2025-09-12) has no
restriction on commercial use of Free Services; the one relevant prohibition is
to "process or collect personal or business credit card information on any web
property that is receiving Free Services" [H79] — this app does neither.

**Cloudflare Access** (Zero Trust): "$0 forever", "50 user limit" [H78]. Google
works as identity provider for any Google account [H75]. Since the 2026-08-14
changelog, one click on a Worker "protects every domain associated with the
Worker, including its routes, Custom Domains, workers.dev hostname, and
previews"; specific e-mail allow-lists are edited in Zero Trust; the Worker
reads the user via `ctx.access.getIdentity()` [H73][H74]. **So the whole site,
including previews, can be gated with Google sign-in and zero application
code.**

The cost is the runtime. It is not Node: `nodejs_compat` supplies many Node
modules, TLS is partial [H68]. Postgres works through `pg` over TCP (Hyperdrive
recommended) or Neon's HTTP driver [H69]. Better Auth has broken on Workers
before: issue #3945 (telemetry made it "not possible to run without
nodejs_compat" since 1.3.5) and issue #6665 (December 2025, `createRequire`
failure even with the flag) [H80][H81]. Medium risk that a dependency upgrade
breaks the auth handler. Lock-in medium (Wrangler config, bindings on `env`,
non-Node runtime); static assets remain portable.

**Fit: the credible runner-up.** Cheaper, no commercial-use question, and
Access could replace the sign-in library altogether. Chosen against because the
recommended auth library runs on Node first and has a history on Workers. It is
the recorded fallback if Vercel's Hobby clause is refused.

### Render

Free web services "automatically suspend after 15 minutes without traffic" and
take "about one minute" to wake [H82] — far above the one-second budget. Free
Postgres expires after 30 days. New workspace plans (2026-04-23): Hobby $0
with "5 GB" bandwidth and "500" pipeline minutes; Pro "$25/month flat" [H86].
Frankfurt available [H85]. Commercial-use wording: `TBD (not stated)`.
Lock-in low. **Fit: poor for an always-on API on the free tier.**

### Staying on GitHub Pages with a backend elsewhere

GitHub Pages is static only. Its policy: not "intended for or allowed to be
used as a free web-hosting service to run your online business, e-commerce
site, or any other website that is primarily directed at either facilitating
commercial transactions or providing commercial software as a service" [H88].
A function host would still be needed for the sign-in handler and the
database, so: two deploy pipelines; CORS with credentials on every API
response; the OAuth callback lands on the API origin. The hard part is the
session cookie: `github.io` is a different site from the API, so the cookie is
third-party. Safari and Brave block by default; Firefox partitions; Chrome
keeps them after its April 2025 decision but blocks in Incognito [H89][H90].
Better Auth's own docs warn that "Safari treats domainA.com as a third-party
and blocks its cookies" and recommend a shared parent domain [H92]. The
workable version needs a custom domain on both halves — at which point the
simplicity of Pages is gone. **Fit: poor.**

## 4. Comparison table

| Option                          | Static hosting, free                                   | Functions, free                                                        | EU function region on free?           | Previews per PR                    | Commercial use on free                                                                  | Node runtime            | Lock-in  | Fit                                          |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- | ----------------------- | -------- | -------------------------------------------- |
| Vercel Hobby                    | 100 GB transfer, 1M edge requests, 100 deploys/day     | 1M invocations, 4 CPU-hours, 360 GB-hours, 300 s max, 12 functions      | Yes — one region, `fra1` selectable   | Yes, protected by Vercel Auth      | **No** — "personal or non-commercial use"; this app arguably fits; ask Support or take Pro | Full Node 24 (default)  | Low–med  | **Best technical fit; policy wording is the risk** |
| Netlify Free                    | 300 credits/month (20 per GB, 15 per production deploy) | Same credit pool; 60 s sync timeout                                    | No — Ohio only; region change is Pro  | Yes, free of credits               | Yes, "sole discretion"                                                                  | Node 24 on Lambda       | Low–med  | Workable; US-only functions                  |
| Cloudflare Workers + assets     | Unlimited static requests, 20,000 files, 3,000 build min | 100k requests/day, 10 ms CPU                                           | No choice; Smart Placement            | Yes, via Workers Builds            | Yes (no card processing on free)                                                        | Not Node; `nodejs_compat` | Medium | Strong runner-up; auth-library risk          |
| Render free                     | 5 GB bandwidth, 500 pipeline minutes                   | Web service sleeps after 15 min, ~1 min wake; Postgres expires in 30 d | Yes (Frankfurt)                       | Yes                                | TBD                                                                                     | Full Node               | Low      | Poor: ~60 s cold start                       |
| GitHub Pages + external backend | 1 GB, 100 GB/month soft                                | Depends on the backend host                                            | Depends on the backend host           | No built-in per-PR previews        | Borderline ("online business… SaaS" excluded)                                           | Depends on the host     | Low      | Poor: two pipelines, third-party cookies     |

## 5. Brief answers

- **Hash routing needs no rewrite rules.** The fragment is never sent to the
  server, so `/#/…` always requests `/` and gets `index.html` on all three
  hosts. Rewrites are only for path-based deep links [H50][H67].
- **Keeping secrets out of the Vite bundle.** Vite inlines only `VITE_*`
  variables. Vercel adds Sensitive variables and log redaction but states no
  scan of the built output; Netlify's secret scanning fails a build that leaks
  a secret into output; Cloudflare's secrets are runtime bindings that never
  enter the static upload [H19][H47][H65]. The project's own rule stands: a
  secret is never given a `VITE_` name.
- **Policy changes in the last 12 months.** Netlify's credit-based plans for
  new accounts (2025-09-04); Vercel Pro moved to $20 credit-based usage;
  Render's new workspace plans (2026-04-23); Cloudflare's "Start new projects
  with Workers"; Vercel deprecates Node 20 on 2026-10-01.

## 6. Verdict for this project

**Vercel Hobby**, region `fra1`, Node 24, previews per PR, with the
non-commercial question put to Vercel Support in writing before any real data
is stored (batch 4.1). **Cloudflare Workers** is the recorded runner-up and
fallback; **Vercel Pro** is the paid way to remove the question. The hosting
move gets its own phase, before sign-in and data — see the
[hub page](rp10-service-evaluation.md).

## Sources

All accessed 2026-09-09.

| #   | Title                                              | URL                                                                                                                | Accessed   |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| H1  | Vercel pricing                                     | https://vercel.com/pricing                                                                                         | 2026-09-09 |
| H2  | Vercel Hobby plan                                  | https://vercel.com/docs/plans/hobby                                                                                | 2026-09-09 |
| H3  | Vercel Pro plan                                    | https://vercel.com/docs/plans/pro-plan                                                                             | 2026-09-09 |
| H4  | Vercel limits                                      | https://vercel.com/docs/limits                                                                                     | 2026-09-09 |
| H5  | Vercel fair use guidelines                         | https://vercel.com/docs/limits/fair-use-guidelines                                                                 | 2026-09-09 |
| H6  | Vercel terms of service                            | https://vercel.com/legal/terms                                                                                     | 2026-09-09 |
| H7  | Vercel pricing docs                                | https://vercel.com/docs/pricing                                                                                    | 2026-09-09 |
| H8  | Functions usage and pricing                        | https://vercel.com/docs/functions/usage-and-pricing                                                                | 2026-09-09 |
| H9  | Fluid compute                                      | https://vercel.com/docs/fluid-compute                                                                              | 2026-09-09 |
| H10 | Function runtimes                                  | https://vercel.com/docs/functions/runtimes                                                                         | 2026-09-09 |
| H11 | Node.js runtime                                    | https://vercel.com/docs/functions/runtimes/node-js                                                                 | 2026-09-09 |
| H12 | Node.js versions                                   | https://vercel.com/docs/functions/runtimes/node-js/node-js-versions                                                | 2026-09-09 |
| H13 | Changelog: Node 24 GA                              | https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions                    | 2026-09-09 |
| H14 | Functions API reference                            | https://vercel.com/docs/functions/functions-api-reference                                                          | 2026-09-09 |
| H15 | Configuring function regions                       | https://vercel.com/docs/functions/configuring-functions/region                                                     | 2026-09-09 |
| H16 | Vercel regions                                     | https://vercel.com/docs/regions                                                                                    | 2026-09-09 |
| H17 | Vite on Vercel                                     | https://vercel.com/docs/frameworks/frontend/vite                                                                   | 2026-09-09 |
| H18 | Instant Rollback                                   | https://vercel.com/docs/instant-rollback                                                                           | 2026-09-09 |
| H19 | Sensitive environment variables                    | https://vercel.com/docs/environment-variables/sensitive-environment-variables                                      | 2026-09-09 |
| H20 | Deployment Protection                              | https://vercel.com/docs/deployment-protection                                                                      | 2026-09-09 |
| H21 | Protection Bypass for Automation                   | https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation | 2026-09-09 |
| H22 | Changelog: bypass on all plans                     | https://vercel.com/changelog/improved-security-with-automation-testing-now-available-on-all-plans                  | 2026-09-09 |
| H23 | Vercel Firewall                                    | https://vercel.com/docs/vercel-firewall                                                                            | 2026-09-09 |
| H24 | WAF managed rulesets                               | https://vercel.com/docs/vercel-firewall/vercel-waf/managed-rulesets                                                | 2026-09-09 |
| H25 | Bot management                                     | https://vercel.com/docs/bot-management                                                                             | 2026-09-09 |
| H26 | Vercel for GitHub                                  | https://vercel.com/docs/git/vercel-for-github                                                                      | 2026-09-09 |
| H27 | E2E tests after a preview deployment (KB)          | https://vercel.com/kb/guide/how-can-i-run-end-to-end-tests-after-my-vercel-preview-deployment                      | 2026-09-09 |
| H28 | Managing builds                                    | https://vercel.com/docs/builds/managing-builds                                                                     | 2026-09-09 |
| H29 | Accounts                                           | https://vercel.com/docs/accounts                                                                                   | 2026-09-09 |
| H30 | Runtime logs                                       | https://vercel.com/docs/logs/runtime                                                                               | 2026-09-09 |
| H31 | Marketplace: Neon                                  | https://vercel.com/marketplace/neon                                                                                | 2026-09-09 |
| H32 | April 2026 security incident bulletin              | https://vercel.com/kb/bulletin/vercel-april-2026-security-incident                                                 | 2026-09-09 |
| H33 | Neon pricing                                       | https://neon.com/pricing                                                                                           | 2026-09-09 |
| H34 | Neon: Vercel native integration                    | https://neon.com/docs/guides/vercel-native-integration                                                             | 2026-09-09 |
| H35 | Neon: Vercel overview                              | https://neon.com/docs/guides/vercel-overview                                                                       | 2026-09-09 |
| H36 | Neon: Vercel Postgres transition guide             | https://neon.com/docs/guides/vercel-postgres-transition-guide                                                      | 2026-09-09 |
| H37 | Neon regions                                       | https://neon.com/docs/introduction/regions                                                                         | 2026-09-09 |
| H38 | Netlify pricing                                    | https://www.netlify.com/pricing/                                                                                   | 2026-09-09 |
| H39 | Netlify credit-based plans                         | https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ | 2026-09-09 |
| H40 | Netlify: how credits work                          | https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/      | 2026-09-09 |
| H41 | Netlify legacy plans                               | https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/        | 2026-09-09 |
| H42 | Netlify changelog: credit-based plans              | https://www.netlify.com/changelog/netlify-pricing-update-introducing-credit-based-plans/                           | 2026-09-09 |
| H43 | Netlify Functions overview                         | https://docs.netlify.com/build/functions/overview/                                                                 | 2026-09-09 |
| H44 | Netlify Functions configuration                    | https://docs.netlify.com/build/functions/optional-configuration/                                                   | 2026-09-09 |
| H45 | Netlify Functions usage and billing                | https://docs.netlify.com/build/functions/usage-and-billing/                                                        | 2026-09-09 |
| H46 | Netlify build software                             | https://docs.netlify.com/build/configure-builds/available-software-at-build-time/                                  | 2026-09-09 |
| H47 | Netlify Secrets Controller                         | https://docs.netlify.com/build/environment-variables/secrets-controller/                                           | 2026-09-09 |
| H48 | Netlify Deploy Previews                            | https://docs.netlify.com/deploy/deploy-types/deploy-previews/                                                      | 2026-09-09 |
| H49 | Netlify manage deploys                             | https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/                                            | 2026-09-09 |
| H50 | Netlify rewrites                                   | https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/                                                | 2026-09-09 |
| H51 | Netlify terms of use                               | https://www.netlify.com/legal/terms-of-use/                                                                        | 2026-09-09 |
| H52 | Netlify self-serve subscription agreement (PDF)    | https://www.netlify.com/pdf/self-serve-subscription-agreement.pdf                                                  | 2026-09-09 |
| H53 | Netlify acceptable use policy                      | https://www.netlify.com/legal/acceptable-use-policy                                                                | 2026-09-09 |
| H54 | Netlify changelog: React security 2025-12          | https://www.netlify.com/changelog/2025-12-03-react-security-vulnerability-response/                                | 2026-09-09 |
| H55 | Netlify changelog: RSC DoS 2026-01                 | https://www.netlify.com/changelog/2026-01-26-react-nextjs-dos-vulnerability/                                       | 2026-09-09 |
| H56 | Cloudflare Pages                                   | https://developers.cloudflare.com/pages/                                                                           | 2026-09-09 |
| H57 | Cloudflare Pages limits                            | https://developers.cloudflare.com/pages/platform/limits/                                                           | 2026-09-09 |
| H58 | Migrate from Pages to Workers                      | https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/                       | 2026-09-09 |
| H59 | Workers pricing                                    | https://developers.cloudflare.com/workers/platform/pricing/                                                        | 2026-09-09 |
| H60 | Workers limits                                     | https://developers.cloudflare.com/workers/platform/limits/                                                         | 2026-09-09 |
| H61 | Workers Builds limits and pricing                  | https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/                                         | 2026-09-09 |
| H62 | Workers Builds GitHub integration                  | https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/                         | 2026-09-09 |
| H63 | Workers previews                                   | https://developers.cloudflare.com/workers/configuration/previews/                                                  | 2026-09-09 |
| H64 | Workers rollbacks                                  | https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/                        | 2026-09-09 |
| H65 | Workers secrets                                    | https://developers.cloudflare.com/workers/configuration/secrets/                                                   | 2026-09-09 |
| H66 | Smart Placement                                    | https://developers.cloudflare.com/workers/configuration/smart-placement/                                           | 2026-09-09 |
| H67 | Workers SPA routing                                | https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/                           | 2026-09-09 |
| H68 | Workers Node.js compatibility                      | https://developers.cloudflare.com/workers/runtime-apis/nodejs/                                                     | 2026-09-09 |
| H69 | Workers: connecting to databases                   | https://developers.cloudflare.com/workers/databases/connecting-to-databases/                                       | 2026-09-09 |
| H70 | Hyperdrive pricing                                 | https://developers.cloudflare.com/hyperdrive/platform/pricing/                                                     | 2026-09-09 |
| H71 | KV pricing                                         | https://developers.cloudflare.com/kv/platform/pricing/                                                             | 2026-09-09 |
| H72 | D1 pricing                                         | https://developers.cloudflare.com/d1/platform/pricing/                                                             | 2026-09-09 |
| H73 | Cloudflare Access for Workers                      | https://developers.cloudflare.com/workers/configuration/cloudflare-access/                                         | 2026-09-09 |
| H74 | Changelog 2026-08-14: Workers Access               | https://developers.cloudflare.com/changelog/post/2026-08-14-workers-access/                                        | 2026-09-09 |
| H75 | Cloudflare One: Google IdP                         | https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/google/                                  | 2026-09-09 |
| H76 | Cloudflare One: self-hosted apps                   | https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/               | 2026-09-09 |
| H77 | Cloudflare One setup                               | https://developers.cloudflare.com/cloudflare-one/setup/                                                            | 2026-09-09 |
| H78 | Cloudflare Access product page                     | https://www.cloudflare.com/sase/products/access/                                                                   | 2026-09-09 |
| H79 | Cloudflare terms                                   | https://www.cloudflare.com/terms/                                                                                  | 2026-09-09 |
| H80 | Better Auth issue #3945                            | https://github.com/better-auth/better-auth/issues/3945                                                             | 2026-09-09 |
| H81 | Better Auth issue #6665                            | https://github.com/better-auth/better-auth/issues/6665                                                             | 2026-09-09 |
| H82 | Render free tier                                   | https://render.com/docs/free                                                                                       | 2026-09-09 |
| H83 | Render outbound bandwidth                          | https://render.com/docs/outbound-bandwidth                                                                         | 2026-09-09 |
| H84 | Render build pipeline                              | https://render.com/docs/build-pipeline                                                                             | 2026-09-09 |
| H85 | Render regions                                     | https://render.com/docs/regions                                                                                    | 2026-09-09 |
| H86 | Render changelog: updated plans                    | https://render.com/changelog/updated-plans-for-render-workspaces                                                   | 2026-09-09 |
| H87 | Render blog: pricing                               | https://render.com/blog/better-pricing-for-fast-growing-teams                                                      | 2026-09-09 |
| H88 | GitHub Pages limits and policy                     | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits                             | 2026-09-09 |
| H89 | MDN: third-party cookies                           | https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies                                    | 2026-09-09 |
| H90 | Privacy Sandbox: next steps                        | https://privacysandbox.google.com/blog/privacy-sandbox-next-steps                                                  | 2026-09-09 |
| H91 | Better Auth installation                           | https://www.better-auth.com/docs/installation                                                                      | 2026-09-09 |
| H92 | Better Auth cookies                                | https://www.better-auth.com/docs/concepts/cookies                                                                  | 2026-09-09 |

Not verified (`TBD`): Vercel Bot Protection plan availability; the Vercel Hobby
monthly build-minute cap; Neon region choice inside the Vercel Marketplace flow;
Netlify Secrets Controller on the Free plan; Render's free-tier commercial-use
wording; whether a `repository_dispatch` run can block a PR merge without an
extra commit status.

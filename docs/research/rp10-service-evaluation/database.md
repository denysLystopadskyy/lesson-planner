# RP-10 · Database — Neon serverless Postgres and its alternatives

Part of [RP-10 — Service evaluation](rp10-service-evaluation.md). Sibling pages:
[hosting](hosting.md), [sign-in](auth.md).

Research date: **2026-09-09**. Every figure is quoted as the vendor page stated
it on that day and carries a source id in brackets; the [Sources](#sources)
table gives the URL and access date. Pricing and limits change often — treat
every number as current-as-of that date. Where a page did not state something,
this report says `TBD (not stated)` rather than guessing.

## 1. What was asked

The task named Neon and its "AI Gateway" page, and asked two things: what the
AI Gateway actually covers, and whether Neon serverless Postgres is the right
database for a React app that is leaving GitHub Pages. The alternatives
compared on the same criteria are Supabase, Turso, PlanetScale, plain managed
Postgres (Render, Railway, Fly.io, a small VPS), Cloudflare D1 and Firebase
Firestore. Firestore is included because the earlier research
([RP-05 §6](../rp05-durable-storage/rp05-durable-storage.md)) recommended it.

The criteria are the same for every candidate: what it is, the problem it
solves, key features, pricing and free tier, limits, lock-in risk, and fit for
this app. "This app" means: one teacher, one maintainer, about 14 KB of data in
three documents, used a few times a month, users in Europe, zero-to-minimal
budget.

## 2. The Neon "AI Gateway" — out of scope

The page `https://neon.com/docs/ai-gateway/overview` exists and does not
redirect [N1]. It describes a product that is unrelated to database access:

- "Neon AI Gateway is the LLM inference layer built into the Neon backend."
- "It lets you call models from OpenAI, Google, and other providers using your
  Neon credential, without setting up separate provider accounts."
- Status: "AI Gateway is in beta and currently available in AWS US East (Ohio)
  (`aws-us-east-2`) and AWS Europe (Frankfurt) (`aws-eu-central-1`)." The
  changelog of 2026-08-28 still lists it as beta in Ohio only [N4]; the two
  pages differ on Frankfurt.
- Billing: "Inference remains free through the end of the beta. Billing begins
  when AI Gateway reaches GA." [N1] Public pricing "will be announced before
  GA" [N2].

Its only link to the database is branch scoping ("Each branch has its own
gateway endpoint"). It does not touch connection strings, the Postgres
protocol, or query execution. The roadmap calls it "One API for all frontier &
open-source models, powered by Databricks" [N3].

**Conclusion:** the lesson planner has no language-model feature, so the AI
Gateway is out of scope. Nothing in Neon's database offering depends on it.
The rest of this page is about Neon serverless Postgres.

## 3. Neon serverless Postgres

### What it is and the problem it solves

Managed Postgres with storage separated from compute. Compute autoscales and
stops when idle, so an idle database costs nothing. Neon's docs now say: "In
2025, Neon joined Databricks. The serverless Postgres architecture that Neon
pioneered is now the foundation of Lakebase Postgres, a database you can run
in two places: on Neon and on Databricks." [N5] Some pages already call the
product "Lakebase Postgres" [N6].

For this project the problem it solves is the one RP-05 named: the only copy
of the teacher's data lives on one device. A database behind an authenticated
API is a second copy that survives a wiped laptop.

### Key features

- **Branching.** "A branch is a copy-on-write clone of your data." [N7] Free
  plan: 10 branches per project [N11].
- **Scale to zero.** "Neon compute scales to zero after an _inactive_ period of
  5 minutes." "For Neon Free plan users, this setting is fixed." Restart: "Once
  you query the database again, it reactivates automatically within a few
  hundred milliseconds." [N8]
- **Autoscaling** up to "2 CU (8 GB RAM)" on Free [N9][N11]. "Each Compute Unit
  (CU) allocates approximately 4 GB of RAM" [N10].
- **Serverless driver** (`@neondatabase/serverless`): queries "over HTTP or
  WebSockets in place of TCP" for serverless and edge runtimes [N12].
- **Data API**: "exposes your Postgres database as a REST endpoint secured by
  JWT authentication and Row-Level Security", powered by PostgREST [N3][N13].
- **Managed Better Auth** (the product formerly called Neon Auth): "the
  managed authentication service in the Neon backend"; "currently supports
  Better Auth version **1.4.18**"; "in Beta"; "targeting general availability
  this quarter"; Free plan "up to 60,000 MAU"; Google OAuth supported. The
  previous Stack Auth implementation is legacy [N14][N15]. See the
  [sign-in page](auth.md#neon-auth-managed-better-auth) for the allowlist gap.
- **Instant restore** to any point in the history window; Free "6 hours
  (capped at 1 GB of history)"; Launch up to 7 days; Scale up to 30 days
  [N16][N17]. Free also includes "1 manual snapshot" [N11].

### Pricing and free tier (2026-09-09)

| Item          | Free                                 | Launch                 | Scale                                   |
| ------------- | ------------------------------------ | ---------------------- | --------------------------------------- |
| Price         | "$0/month"                           | "Pay for what you use" | "Pay for what you use"                  |
| Compute       | "100 CU-hours/project" per month     | "$0.106/CU-hour"       | "$0.222/CU-hour"                        |
| Storage       | "0.5 GB/project"                     | "$0.35/GB-month"       | "$0.35/GB-month"                        |
| Projects      | "100"                                | TBD (not stated)       | TBD (not stated)                        |
| Branches      | "10/project"                         | TBD (not stated)       | TBD (not stated)                        |
| History       | "6 hours (1 GB limit)"               | "Up to 7 days"         | "Up to 30 days"                         |
| Max compute   | "Up to 2 CU (8 GB RAM)"              | "Up to 16 CU"          | "Up to 16 CU autoscaling" or fixed 56 CU |
| Scale to zero | "After 5 min", cannot be disabled    | configurable           | configurable                            |
| Egress        | "5 GB per project included"          | TBD                    | TBD                                     |
| Auth          | "Up to 60k MAU"                      | up to 1M MAU           | up to 1M MAU                            |

Sources: [N11][N18]. "The Free plan is permanent (not a trial); no credit card
required." [N18]

At the limits: "Computes that are suspended do not accrue CU-hours." If compute
hours run out, "your compute is suspended until the next billing period or
until you upgrade"; if storage runs out, writes fail "until you free space or
upgrade". "None of these limits delete your data" [N10].

### Limits that matter here

- **Inactivity.** Branches "older than 14 days" that "have not been accessed
  for the past 24 hours" are archived automatically and unarchived
  automatically on access; no action is needed [N19]. The plans page, the Free
  plan FAQ and the project-management page state **no** project deletion for
  inactivity [N10][N20][N21]. One sentence exists on the Azure-deprecation page
  only: "Also on October 5, projects on Free plans that have been inactive for
  90 days or more are subject to deletion." [N22] Whether it applies outside
  the deprecated Azure regions is `TBD (not stated)`. A deleted project can be
  recovered "within 7 days" [N21]. This app is opened a few times a month, so
  90 days is far away — but the sentence is recorded as a watch item, and plan
  batch 6.4 decides on a monthly keep-alive.
- **Region is fixed at creation.** EU regions: "AWS Europe (Frankfurt) —
  `aws-eu-central-1`" and "AWS Europe (London) — `aws-eu-west-2`" [N23]. No
  Free-plan region restriction is stated.
- **Azure regions are deprecated** since 2026-04-07 and stop receiving updates
  after 2026-10-05 [N22]. Irrelevant for a new AWS project; relevant as a sign
  of product churn.
- **Ownership.** Neon announced joining Databricks on 2025-05-14 [N24];
  Databricks' Lakebase "is built on Neon technology" [N25]; the legal schedule
  of 2026-08-05 names "Databricks, Inc., the parent company of Neon, LLC" [N26].
  Exact closing date: `TBD (not stated)`.

### Lock-in

The data layer is standard Postgres. `pg_dump` works over the direct (unpooled)
connection string [N6]. Neon-specific parts are branching, the HTTP/WebSocket
driver protocol, the Data API (PostgREST-compatible, so Supabase-shaped) and
Managed Better Auth (open-source library, data in a `neon_auth` schema in your
own database [N3]). **If the app talks plain SQL, lock-in is low.** The more of
the Data API or managed auth it uses, the closer to medium.

### GDPR and DPA

"By becoming a Neon customer, you automatically benefit from a GDPR-compliant
DPA embedded in our terms of service" [N29]; controls "in alignment with SOC2,
ISO27001, ISO27701 standards and GDPR and CCPA regulations" [N28]. Today
`neon.com/dpa` serves the "Product Specific Schedule (Neon)" dated 2026-08-05
[N26]; a separate DPA PDF exists but its text could not be extracted — contents
`TBD`. Plan batch 5.1 has the owner read and accept it before any data is
stored.

### Vercel integration

"Vercel Postgres is no longer available. If you had an existing Vercel
Postgres database, we automatically moved it to Neon in December 2024." [V1]
Two shapes exist today:

- **Vercel-managed** (Marketplace "native integration"): account created and
  billed inside Vercel; injects `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
  `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD` and more; "creates an isolated
  copy-on-write Lakebase Postgres branch for every Vercel Preview Deployment";
  but "the `neon login` CLI command won't work since the account is
  Vercel-managed" [N30][N31].
- **Neon-managed**: your own Neon account, the same env-var injection. Lower
  lock-in, because the database and its billing stay with you.

Whether the Marketplace flow lets you pick Frankfurt is `TBD (not stated)`
[V2]. Creating the project in Neon first, in Frankfurt, avoids the question.

### Connecting from Vercel functions

- Use the **pooled** connection string for functions ("-pooler" host, PgBouncer
  "in transaction mode") and the direct string for migrations and `pg_dump`
  [N32].
- Neon's own Vercel guide: for Fluid compute "We recommend using a standard
  Postgres TCP driver (like node-postgres) and implementing a connection pool";
  the HTTP driver is for classic one-shot serverless queries [N33]. The HTTP
  driver's `Pool` "must be connected, used and closed within a single request
  handler" [N12], which does not suit an auth library that holds one pool at
  module scope. **Decision for the plan:** `pg` over TCP against the pooled
  string.
- Cold start: waking a suspended compute "typically adds a few hundred
  milliseconds of latency" [N34]. Add Vercel's own function cold start; about
  one second in total on the first request after five idle minutes. The project
  accepts one second.
- Region: Neon `aws-eu-central-1` and Vercel `fra1` are the same AWS region
  [V6]. Vercel's Hobby plan allows one function region and it can be set to
  `fra1` [V4].
- Capacity: 14 KB of data against 0.5 GB; a few sessions a month against 100
  CU-hours. "Capacity is not a decision input" (RP-05 §5) still holds.

### Fit

Good. A permanent free plan, a Frankfurt region, standard Postgres, a restore
window, no pause-and-resume rule, and a cold start inside the budget. Watch
items: the 6-hour restore window (short; the plan adds an append-only history
table), managed auth still in beta, the acquisition-driven renaming, and the
ambiguous 90-day sentence.

## 4. Alternatives

### Supabase

Hosted Postgres with PostgREST API, Auth, Storage and Edge Functions [S1];
Google sign-in supported [S2]. Free plan: "Limit of 2 active projects",
"500 MB database size", "50,000 monthly active users"; Pro "from $25/month"
[S3]. EU regions on Free: Frankfurt, Ireland, London, Paris, Zurich, Stockholm
[S4]. DPA with SCCs, "Version 1 — August 1, 2026" [S5].

The decisive point: "Free projects are paused after 1 week of inactivity"
[S3]. "Typically a few user requests to the database each day over the
previous week is enough to keep the project from being paused." Restore is a
manual "Resume project" click, possible for one year; after that only by
downloading a backup into a new project [S6][S7]. "Paid projects cannot be
paused."

**Fit: poor.** This app is opened a few times a month. Without a keep-alive job
or $25/month it would be paused most of the time. This is the same verdict RP-05
§4 reached. Lock-in: medium-low.

### Turso

libSQL (a SQLite fork) as a hosted service, being rewritten in Rust and
"currently in beta" [T1]. In January 2025 the company removed edge replicas for
new users, moved "to AWS exclusively" and announced layoffs [T2]; in July 2026
it launched a Postgres-compatible frontend [T4]. Free: "100" databases, "5GB"
storage, "500 Million" rows read per month, "1 day" PITR; DPA not on Free
[T5]. EU on Free: Ireland (`eu-west-1`) only [T3]. Inactivity: docs say
"Databases get archived after 10 days of inactivity for users on a free plan"
[T6]; a 2025 post says databases "stay responsive at all times" [T7] — which is
current is `TBD`. **Fit: workable but not attractive** — no DPA on Free, product
in flux, no Frankfurt. Lock-in: medium (the SQLite file is portable, the client
protocol is not).

### PlanetScale

"PlanetScale does not offer a free plan" [P1]. Postgres is generally available
since 2025-09-22 [P2]; the cheapest plan is "$5" per month with EU regions
[P3]. **Fit: not free; disproportionate for 14 KB.** Lock-in: low.

### Plain managed Postgres and a VPS

- **Render:** "Free Render Postgres databases expire 30 days after creation",
  then a 14-day grace period, then Render "deletes the database (along with all
  of its data)" [R1]. Unusable for long-lived free storage.
- **Railway:** Free plan with "$1 of free credit per month"; Hobby "$5/month";
  EU region Amsterdam [R3][R4]. Whether $1 keeps a Postgres container alive all
  month is `TBD` [R5].
- **Fly.io:** "no longer offers plans to new customers" for the old free tier
  [R6]; cheapest machine "$2.02" per month, unmanaged Postgres about $2/month
  [R7][R8].
- **Hetzner** CX23: 2 vCPU, 4 GB RAM, Germany; "5.49" EUR/month since
  2026-06-15 [R9][R10]. Lowest lock-in, highest operations burden (patches,
  backups, TLS) for a solo maintainer.

**Fit: the free options are weak; the paid ones cost €2–6 a month and add
operations work.** Lock-in: low.

### Cloudflare D1

"Cloudflare's managed, serverless database with SQLite's SQL semantics" [C1].
Workers Free: D1 "5 million / day" rows read, "100,000 / day" rows written,
"5 GB (total)" storage, "10 (Free)" databases, Time Travel "7 days (Free)"
[C2][C3]. No pause rule: "If you are not running queries against your database,
you are not billed for compute." EU jurisdiction can be set at creation "to
help comply with data locality regulations such as the GDPR" [C5]. Access is
through a Worker binding or the account REST API — not from a browser [C6].
**Fit: strong on price and durability, but it ties the project to Cloudflare
Workers instead of Vercel.** Lock-in: medium. It is the natural database if
the [hosting page](hosting.md)'s runner-up is chosen.

### Firebase Firestore

The earlier plan's choice: a client SDK plus security rules, no functions
needed. Spark (free): "1 GiB total" stored, "50K reads/day", "20K writes/day";
"exactly one free database" per project; Authentication included [F1][F2]. EU
locations include Frankfurt and Warsaw [F3]. No inactivity pause is stated.
Lock-in is high: a proprietary document model and SDK, and "Firebase projects
must be on the Blaze plan to use the managed export and import service" [F4].
The Firebase DPA covers Authentication and Firestore [F5]. **Fit: the least-ops
"no server" path by a wide margin, with the highest lock-in and no restore on
the free plan** (RP-07 §5 built a client-side snapshot layer for exactly that
reason). Two new facts weigh against it since August: Firebase Authentication
"processes data exclusively in the United States" (see the
[sign-in page](auth.md#firebase-auth)), and the popup-only constraint remains.

## 5. Comparison table

| Service                     | Engine       | Free tier headline                                        | Inactivity / pause rule                                                             | EU region on free                | Needs server or functions?             | Lock-in  | Fit                                        |
| --------------------------- | ------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------- | -------- | ------------------------------------------ |
| Neon                        | Postgres     | 0.5 GB, 100 CU-h/project/month, 100 projects, 6 h restore | Compute sleeps after 5 min, auto-wakes; branch archive after 14 d, automatic; 90-day sentence on the Azure page only (TBD) | Frankfurt, London                | Yes (or Data API + managed auth)       | Low–med  | **Best Postgres fit**                      |
| Supabase                    | Postgres     | 2 projects, 500 MB, 50k MAU                               | Paused after 1 week idle; manual resume; restore window 1 year                      | Frankfurt + 5 others             | No (PostgREST + RLS + Auth)            | Low–med  | Blocked by pausing                         |
| Turso                       | libSQL       | 100 DBs, 5 GB, 500M reads, 1 d PITR                       | "archived after 10 days" (docs) vs "stay responsive" (blog) — TBD                   | Ireland only                     | Yes                                    | Medium   | Usable; no DPA on Free; company in flux    |
| PlanetScale                 | Postgres     | None; $5/month                                            | n/a                                                                                 | eu-central-1 (paid)              | Yes                                    | Low      | Not free                                   |
| Plain Postgres (best free)  | Postgres     | Render deleted after 30+14 d; Railway $1 credit           | Render expiry; Railway stops when credit ends                                       | Frankfurt (Render), Amsterdam    | Yes                                    | Low      | Free options weak; paid ≈ €2–6/month       |
| Cloudflare D1               | SQLite       | 5 GB, 5M reads/day, 100k writes/day                       | None stated                                                                         | EU jurisdiction at creation      | Yes (Worker)                           | Medium   | Good, but Cloudflare not Vercel            |
| Firestore                   | Document DB  | 1 GiB, 50k reads/day, 20k writes/day                      | None stated                                                                         | Frankfurt, Warsaw                | No (SDK + rules)                       | High     | Simplest ops, highest lock-in, no restore  |

## 6. Verdict for this project

**Neon Free in Frankfurt**, under the maintainer's own Neon account, connected
from Vercel functions in `fra1` with `pg` over the pooled string. The closest
alternative in kind is Cloudflare D1 (if hosting goes to Cloudflare); the
closest alternative in shape is Firestore (if the owner decides a server is
not worth its moving parts). The [hub page](rp10-service-evaluation.md)
states the deciding factors.

## Sources

All accessed 2026-09-09.

| #    | Title                                            | URL                                                                                      | Accessed   | Supports                                  |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| N1   | Neon AI Gateway overview                         | https://neon.com/docs/ai-gateway/overview                                                | 2026-09-09 | §2 what the AI Gateway is                 |
| N2   | Neon backend is beta (blog)                      | https://neon.com/blog/neon-backend-is-beta                                               | 2026-09-09 | §2 beta billing                           |
| N3   | Neon roadmap                                     | https://neon.com/docs/introduction/roadmap                                               | 2026-09-09 | §2, §3 Data API, auth schema              |
| N4   | Changelog 2026-08-28                             | https://neon.com/docs/changelog/2026-08-28                                               | 2026-09-09 | §2 region status                          |
| N5   | Neon and Lakebase                                | https://neon.com/docs/introduction/neon-and-lakebase                                     | 2026-09-09 | §3 ownership                              |
| N6   | Backup with pg_dump                              | https://neon.com/docs/manage/backup-pg-dump                                              | 2026-09-09 | §3 lock-in, naming                        |
| N7   | Branching                                        | https://neon.com/docs/introduction/branching                                             | 2026-09-09 | §3 features                               |
| N8   | Scale to zero                                    | https://neon.com/docs/introduction/scale-to-zero                                         | 2026-09-09 | §3 features                               |
| N9   | Autoscaling                                      | https://neon.com/docs/introduction/autoscaling                                           | 2026-09-09 | §3 features                               |
| N10  | Usage metrics                                    | https://neon.com/docs/introduction/usage-metrics                                         | 2026-09-09 | §3 limits behaviour                       |
| N11  | Plans                                            | https://neon.com/docs/introduction/plans                                                 | 2026-09-09 | §3 pricing table                          |
| N12  | Serverless driver                                | https://neon.com/docs/serverless/serverless-driver                                       | 2026-09-09 | §3 driver, pool rule                      |
| N13  | Data API get started                             | https://neon.com/docs/data-api/get-started                                               | 2026-09-09 | §3 Data API                               |
| N14  | Auth overview (Managed Better Auth)              | https://neon.com/docs/auth/overview                                                      | 2026-09-09 | §3 managed auth                           |
| N15  | Auth roadmap                                     | https://neon.com/docs/auth/roadmap                                                       | 2026-09-09 | §3 GA target                              |
| N16  | Branch restore                                   | https://neon.com/docs/introduction/branch-restore                                        | 2026-09-09 | §3 restore                                |
| N17  | History window                                   | https://neon.com/docs/postgres/backup-restore/history-window                             | 2026-09-09 | §3 restore                                |
| N18  | Pricing                                          | https://neon.com/pricing                                                                 | 2026-09-09 | §3 pricing table                          |
| N19  | Branch archiving                                 | https://neon.com/docs/guides/branch-archiving                                            | 2026-09-09 | §3 inactivity                             |
| N20  | Free plan limits FAQ                             | https://neon.com/faqs/free-plan-limits-and-quotas                                        | 2026-09-09 | §3 inactivity                             |
| N21  | Manage projects                                  | https://neon.com/docs/manage/projects                                                    | 2026-09-09 | §3 recovery of deleted project            |
| N22  | Azure regions deprecation                        | https://neon.com/docs/import/azure-regions-deprecation                                   | 2026-09-09 | §3 90-day sentence, Azure                 |
| N23  | Regions                                          | https://neon.com/docs/introduction/regions                                               | 2026-09-09 | §3 EU regions                             |
| N24  | Neon and Databricks (blog)                       | https://neon.com/blog/neon-and-databricks                                                | 2026-09-09 | §3 ownership                              |
| N25  | Databricks Lakebase press release                | https://www.databricks.com/company/newsroom/press-releases/databricks-launches-lakebase-new-class-operational-database-ai-apps | 2026-09-09 | §3 ownership |
| N26  | Product Specific Schedule (Neon) / DPA           | https://neon.com/dpa                                                                     | 2026-09-09 | §3 DPA, parent company                    |
| N28  | Security overview                                | https://neon.com/docs/security/security-overview                                         | 2026-09-09 | §3 GDPR                                   |
| N29  | GDPR compliance and Neon (blog)                  | https://neon.com/blog/gdpr-compliance-and-neon                                           | 2026-09-09 | §3 DPA                                    |
| N30  | Vercel native integration                        | https://neon.com/docs/guides/vercel-native-integration                                   | 2026-09-09 | §3 Vercel integration                     |
| N31  | Vercel-managed integration                       | https://neon.com/docs/guides/vercel-managed-integration                                  | 2026-09-09 | §3 Vercel integration                     |
| N32  | Connection pooling                               | https://neon.com/docs/connect/connection-pooling                                         | 2026-09-09 | §3 connecting                             |
| N33  | Vercel connection methods                        | https://neon.com/docs/guides/vercel-connection-methods                                   | 2026-09-09 | §3 driver choice                          |
| N34  | Benchmarking latency                             | https://neon.com/docs/guides/benchmarking-latency                                        | 2026-09-09 | §3 cold start                             |
| V1   | Vercel Postgres (redirects)                      | https://vercel.com/docs/storage/vercel-postgres                                          | 2026-09-09 | §3 Vercel Postgres retired                |
| V2   | Vercel Marketplace: Neon                         | https://vercel.com/marketplace/neon                                                      | 2026-09-09 | §3 Marketplace                            |
| V4   | Vercel function regions                          | https://vercel.com/docs/functions/configuring-functions/region                           | 2026-09-09 | §3 region                                 |
| V6   | Vercel regions                                   | https://vercel.com/docs/regions                                                          | 2026-09-09 | §3 same AWS region                        |
| S1   | Supabase API                                     | https://supabase.com/docs/guides/api                                                     | 2026-09-09 | §4 Supabase                               |
| S2   | Supabase Google sign-in                          | https://supabase.com/docs/guides/auth/social-login/auth-google                           | 2026-09-09 | §4 Supabase                               |
| S3   | Supabase pricing                                 | https://supabase.com/pricing                                                             | 2026-09-09 | §4 Supabase free tier, pausing            |
| S4   | Supabase regions                                 | https://supabase.com/docs/guides/platform/regions                                        | 2026-09-09 | §4 Supabase                               |
| S5   | Supabase DPA                                     | https://supabase.com/legal/dpa                                                           | 2026-09-09 | §4 Supabase                               |
| S6   | Free project pausing                             | https://supabase.com/docs/guides/platform/free-project-pausing                           | 2026-09-09 | §4 Supabase pausing                       |
| S7   | Restore a paused project                         | https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause     | 2026-09-09 | §4 Supabase restore                       |
| T1   | Turso founder statement (via search; not fetched)| https://x.com/penberg/status/2032373944007688226                                         | 2026-09-09 | §4 Turso status                           |
| T2   | Turso platform changes (blog)                    | https://turso.tech/blog/upcoming-changes-to-the-turso-platform-and-roadmap               | 2026-09-09 | §4 Turso                                  |
| T3   | Turso AWS out of beta (blog)                     | https://turso.tech/blog/turso-aws-out-of-beta                                            | 2026-09-09 | §4 Turso regions                          |
| T4   | The Register on Turso's Postgres frontend        | https://www.theregister.com/databases/2026/07/29/after-rewriting-sqlite-in-rust-turso-turns-its-sights-on-postgres/5279835 | 2026-09-09 | §4 Turso |
| T5   | Turso pricing                                    | https://turso.tech/pricing                                                               | 2026-09-09 | §4 Turso free tier                        |
| T6   | Turso API: unarchive                             | https://docs.turso.tech/api-reference/groups/unarchive                                   | 2026-09-09 | §4 Turso archiving                        |
| T7   | Turso developer plan (blog)                      | https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan                        | 2026-09-09 | §4 Turso cold starts                      |
| P1   | PlanetScale plans                                | https://planetscale.com/docs/planetscale-plans                                           | 2026-09-09 | §4 PlanetScale                            |
| P2   | PlanetScale for Postgres GA (blog)               | https://planetscale.com/blog/planetscale-for-postgres-is-generally-available             | 2026-09-09 | §4 PlanetScale                            |
| P3   | PlanetScale pricing                              | https://planetscale.com/pricing                                                          | 2026-09-09 | §4 PlanetScale                            |
| R1   | Render free tier                                 | https://render.com/docs/free                                                             | 2026-09-09 | §4 Render                                 |
| R3   | Railway pricing                                  | https://railway.com/pricing                                                              | 2026-09-09 | §4 Railway                                |
| R4   | Railway regions                                  | https://docs.railway.com/reference/regions                                               | 2026-09-09 | §4 Railway                                |
| R5   | Railway plans                                    | https://docs.railway.com/pricing/plans                                                   | 2026-09-09 | §4 Railway                                |
| R6   | Fly.io discontinued plans                        | https://fly.io/docs/about/discontinued-plans/                                            | 2026-09-09 | §4 Fly.io                                 |
| R7   | Fly.io pricing                                   | https://fly.io/docs/about/pricing/                                                       | 2026-09-09 | §4 Fly.io                                 |
| R8   | Fly.io Managed Postgres                          | https://fly.io/docs/mpg/                                                                 | 2026-09-09 | §4 Fly.io                                 |
| R9   | Hetzner price adjustment                         | https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/       | 2026-09-09 | §4 Hetzner                                |
| R10  | Hetzner cost-optimized servers                   | https://www.hetzner.com/cloud/cost-optimized/                                            | 2026-09-09 | §4 Hetzner specs                          |
| C1   | Cloudflare D1                                    | https://developers.cloudflare.com/d1/                                                    | 2026-09-09 | §4 D1                                     |
| C2   | D1 pricing                                       | https://developers.cloudflare.com/d1/platform/pricing/                                   | 2026-09-09 | §4 D1 free limits                         |
| C3   | D1 limits                                        | https://developers.cloudflare.com/d1/platform/limits/                                    | 2026-09-09 | §4 D1 free limits                         |
| C5   | D1 data location                                 | https://developers.cloudflare.com/d1/configuration/data-location/                        | 2026-09-09 | §4 D1 EU jurisdiction                     |
| C6   | D1 query API                                     | https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/  | 2026-09-09 | §4 D1 access                              |
| F1   | Firebase pricing                                 | https://firebase.google.com/pricing                                                      | 2026-09-09 | §4 Firestore                              |
| F2   | Firestore quotas                                 | https://firebase.google.com/docs/firestore/quotas                                        | 2026-09-09 | §4 Firestore                              |
| F3   | Firestore locations                              | https://firebase.google.com/docs/firestore/locations                                     | 2026-09-09 | §4 Firestore EU                           |
| F4   | Firestore export and import                      | https://firebase.google.com/docs/firestore/manage-data/export-import                     | 2026-09-09 | §4 Firestore lock-in                      |
| F5   | Firebase data processing terms                   | https://firebase.google.com/terms/data-processing-terms                                  | 2026-09-09 | §4 Firestore DPA                          |

Not verified (`TBD`): the exact closing date of the Databricks–Neon
transaction; whether Neon's 90-day inactivity deletion applies outside Azure
regions; the Neon DPA PDF contents; Turso's current free-plan archiving rule;
Firestore per-location free quota rules; Railway Free-plan viability for an
always-on Postgres; Neon's official incident history.

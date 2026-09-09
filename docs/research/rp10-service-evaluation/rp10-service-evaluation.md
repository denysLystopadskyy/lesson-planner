# RP-10 — Service evaluation: hosting, database and sign-in

## Metadata

| Field | Value |
| --- | --- |
| Report id | RP-10 |
| Date | 2026-09-09 |
| Subject | Concrete candidates for the end state the plan only brainstormed: Vercel (hosting), Neon (Postgres), Better Auth (Google sign-in), each against its main alternatives, and the rework of the execution plan that follows |
| Shape | A small wiki, markdown only: this hub plus three pages — [hosting](hosting.md), [database](database.md), [sign-in](auth.md). Each page owns its facts and its sources; this page owns the recommendation and the plan changes |
| Inputs consumed | The task brief; [RP-04](../rp04-build-deploy/rp04-build-deploy.md), [RP-05](../rp05-durable-storage/rp05-durable-storage.md), [RP-06](../rp06-auth-gdpr/rp06-auth-gdpr.md), [RP-07](../rp07-data-migration-recovery/rp07-data-migration-recovery.md), [RP-09](../rp09-roadmap/rp09-roadmap.md); `CLAUDE.md` and the seven context files; a read of `app/src/store.ts`, `StoreProvider.tsx`, `storage.ts`, `route.ts`, the e2e fixtures, `playwright.config.ts`, `package.json` and the three workflows |
| Externally sourced | Every vendor figure comes from an official documentation, pricing, legal or changelog page fetched on 2026-09-09. Each page's Sources table lists URL and access date. Pricing and limits change often: every number is current-as-of that date |
| Statically read | The code hook points named in §3 were read in the working tree at the commit this report was written against; line numbers are given there |
| Personal-data check | The owner's payment identifiers are not reproduced anywhere in these four pages. They are referred to only as "the payment identifiers". Verified by grep over the four pages on 2026-09-09: zero IBAN-shaped strings, zero Cyrillic characters. The only runs of eight or more digits are three identifiers inside source URLs — two Google support article numbers in the sign-in page's Sources table and one social-media post id in the database page's — which are document identifiers, not personal data |
| **Not** verified | No account was created at Vercel, Neon or Google; nothing was deployed; no sign-in flow was exercised. Every behaviour claim is documentation-sourced. Items a page could not settle are marked `TBD` with the action that would resolve them. No lawyer reviewed the GDPR remarks (§6) |

## Executive summary

**The three named services fit together, and they fit this app.** Vercel's
Hobby plan runs Node 24 functions in Frankfurt with a preview deployment per
pull request; Neon's Free plan is a permanent, Frankfurt-hosted Postgres that
sleeps when idle and wakes in a few hundred milliseconds; Better Auth is a
self-run TypeScript library with a documented hook that can restrict sign-in to
exactly two e-mail addresses. Neon's own managed auth is now built on Better
Auth, and Better Auth itself joined Vercel in July 2026 — so the vendors have
already integrated what this report recommends integrating.

**Recommended stack:** Vercel Hobby (`fra1`, Node 24) · Neon Free (Frankfurt,
own account) · Better Auth self-run, Google only, e-mail allowlist · one Hono
app as the single function · Drizzle for schema and migrations · PGlite for
tests · a custom domain, recommended, owner's decision. §2 gives the deciding
factor for each row so the architect can override any of them.

**Two choices are close, and are presented as trade-offs, not settled:**

1. **Vercel vs Cloudflare Workers.** Vercel wins on Node compatibility for the
   auth library and zero-config previews; it loses on its Hobby plan's
   "personal or non-commercial use" clause, which this app arguably satisfies
   but Vercel interprets alone. The plan asks Vercel Support in writing before
   real data is stored; Cloudflare (with Cloudflare Access replacing the auth
   library) is the recorded fallback, Vercel Pro at $20/month the paid one.
2. **A backend at all vs Firestore.** The earlier research chose Firestore on
   the ground that "the operational surface exceeds the application" for 14 KB
   of data. That reasoning is sound and is answered, not dismissed, in §4: a
   private execution context, standard-Postgres portability, a real restore
   window, and one row per storage key. The cost is three moving parts where
   zero exist today. If maintainer capacity is the binding constraint,
   Firestore remains the least-ops path — with two new marks against it:
   Firebase Authentication processes data only in the United States, and the
   popup-only constraint stays.

**The "AI Gateway" in the task brief is out of scope.** It is Neon's beta
inference proxy for language models and has nothing to do with database
access ([database page §2](database.md#2-the-neon-ai-gateway--out-of-scope)).

**The plan changes in three ways.** Hosting migration becomes its own Phase 4,
before sign-in and data; its first two batches are inert for the live site and
may land during Phase 3. Sign-in is Phase 5 with a security review as its gate.
Data in the database is Phase 6, with the schema-version and group-id work as
its first batch. The old batch 4.1 (an options document) is superseded by this
report. Details: [docs/plan/README.md](../../plan/README.md).

## 1. Scope and method

The brief asked for three things per service — what it is, the problem it
solves, key features, pricing and free tier, limits, lock-in, and fit for a
React app leaving GitHub Pages — and for two or three alternatives on the same
criteria. The alternatives compared:

| Category | Named candidate | Alternatives compared                                                                  |
| -------- | --------------- | -------------------------------------------------------------------------------------- |
| Hosting  | Vercel          | Netlify, Cloudflare (Pages, Workers + static assets), Render, GitHub Pages + external backend |
| Database | Neon            | Supabase, Turso, PlanetScale, plain managed Postgres (Render, Railway, Fly.io, Hetzner), Cloudflare D1, Firestore |
| Sign-in  | Better Auth     | Auth.js, Clerk, Auth0, Supabase Auth, Firebase Auth, Cloudflare Access, Neon managed auth |

Method: official pages fetched on 2026-09-09; figures quoted as stated; `TBD`
where a page was silent; search used only to find pages and changes of the
last twelve months (acquisitions, pricing changes, deprecations, incidents).
The constraints that weigh every criterion come from the project itself: one
teacher, one solo maintainer in personal time, zero-to-minimal budget, about
14 KB of data in three documents, a few sessions a month, users in Europe.

## 2. Recommended stack and deciding factors

| Layer    | Recommendation                                                          | Runner-up                                                          | Deciding factor (the architect can override)                                                                                                                                 |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting  | **Vercel Hobby**, `fra1`, Node 24, a preview per PR                     | Cloudflare Workers + static assets (+ Cloudflare Access)           | Node compatibility for the auth library and zero-config previews, against the Hobby non-commercial clause. Support says no or the owner is uneasy → Cloudflare, or Pro ($20/month) |
| Database | **Neon Free**, Frankfurt, own Neon account, Vercel integration for env vars | Firestore (no-server path); Cloudflare D1 if hosting is Cloudflare | No pause rule, standard Postgres, a restore window, same AWS region as the functions — against "three moving parts where zero exist"                                          |
| Sign-in  | **Better Auth**, self-run in the one function, Google only, e-mail allowlist | Neon managed auth (beta, no allowlist); Cloudflare Access          | A documented allowlist hook, a first-party cookie on one origin, the schema in our own database — against owning upgrades and the security feed                              |
| Backend  | **Hono** app as one Vercel function, Web-standard handlers only          | Plain per-file `api/*.ts` handlers                                 | The same app runs on Vercel, on Node for local and e2e, and on Cloudflare — the hedge for the hosting risk — against one small dependency                                    |
| Data     | **Drizzle + drizzle-kit**, `pg` over TCP on the pooled string, migrations in the build step | Better Auth's built-in Kysely + hand-written SQL         | One migration tool for auth tables and app tables — against no ORM                                                                                                          |
| Tests    | **PGlite** (Postgres in WebAssembly) for unit tests and the local e2e server | Postgres service container in CI; a Neon branch per PR            | Zero infrastructure and no CI secrets — against fidelity to the real engine (a smoke run against the Vercel preview stays optional)                                          |
| Domain   | **Custom domain, recommended; owner's decision** before the cutover     | Stay on `*.vercel.app`                                             | About €10 a year buys origin stability for any future host move and a stable OAuth redirect URI — against zero budget                                                        |

Reading order for the evidence: [hosting](hosting.md) → [database](database.md)
→ [sign-in](auth.md). Each page ends with a comparison table and a verdict.

## 3. How the three fit together

**Does the hosting choice constrain the database or the auth choice?** Yes, in
both directions, and Vercel constrains the least:

- Vercel's functions are Node, run in `fra1`, and accept Web-standard
  handlers. Better Auth's handler is exactly that; Neon's Frankfurt region is
  the same AWS region. Nothing else is needed.
- Cloudflare would push the database toward D1 (or Neon over HTTP through
  Hyperdrive) and the sign-in toward Cloudflare Access, because its runtime is
  not Node and Better Auth has broken there twice.
- Netlify's free functions run only in Ohio, which puts an ocean between the
  API and a Frankfurt database.

**Do the host's functions cover the backend the database and auth need?**
Yes, with room to spare. One Hono app mounted as one function hosts the Better
Auth handler at `/api/auth/*`, the documents API and a health check — one
function against Vercel Hobby's cap of twelve. Duration limit 300 s, 1M
invocations a month, 4 active-CPU hours: this app needs a few hundred
invocations a month. Better Auth's tables live in Neon through Drizzle; the
app's data is one JSONB row per storage key plus an append-only history table.

**Two places where the pieces rub, and what the plan does about them:**

- **Google OAuth on preview deployments.** Google allows no wildcard redirect
  URIs, and Vercel's preview URL changes per commit. So real Google sign-in
  works on production and on `localhost` only; previews and the e2e suite use a
  test-only sign-in path that is asserted absent from production builds.
- **Connection pooling.** Neon's HTTP driver expects a pool per request; Better
  Auth holds one pool at module scope. The plan uses `pg` over TCP against
  Neon's pooled connection string, which is also Neon's own guidance for
  Vercel's default compute model.

**Where the new work hooks into the code** (read in the working tree on
2026-09-09):

- `app/src/store.ts` — `Pending = "none" | "write" | "clear"` and a
  four-member `Action` union; `pendingReducer` and `formatRoute` are exhaustive
  `switch` statements with no `default`, so a new member makes the compiler
  list the work.
- `app/src/StoreProvider.tsx:68-80` — the persistence subscriber flushes and
  dispatches `storage/flushed` synchronously. A remote save needs its own
  directive; async hydration needs a `remote/hydrated` action so the "no write
  on mount" rule holds.
- `app/src/route.ts` — a new route touches `Route`, `parseRoute`,
  `formatRoute` and one render branch in `App.tsx`. Missing the `parseRoute`
  arm fails silently as "shows the planner".
- `e2e/features/storage-contract.spec.ts` — the "golden shape" and "no write on
  mount" describes are the two specs any persistence change must keep green.
  Sync metadata therefore lives in its own key, never inside the three.
- `package.json` has no runtime dependencies and no `engines`; `.gitignore`
  has no `.env*` entry; `ci.yml` does not run `typecheck:app` while
  `deploy.yml` does — retiring `deploy.yml` must move that step into CI.

## 4. What changes against the earlier research

The nine reports of 2026-08-20 were written under a "no backend" programme
contract (RP-02 §38). Five of their conclusions are superseded, five keep their
decision but lose their stated reason, and five prerequisites are inherited
unchanged. Naming them here is what keeps the record honest.

### Superseded

1. **The origin invariant.** `storage-data-contract.md` says every deploy must
   keep the origin `https://denyslystopadskyy.github.io`; RP-04 §5 rejected
   Vercel, Netlify and Cloudflare on exactly that ground, and RP-04 §6 forbids
   an origin change inside a rollback. The mitigation already exists in the
   corpus: RP-07 §2's export envelope carries `source.origin`, and plan batch
   3.3 ships the versioned export and import. **New rule:** the origin may
   change only through a rehearsed export/import migration (RP-07 §6 Procedure
   B) and never as part of a rollback. Batch 4.3 is that migration.
2. **"Never build Postgres"** — RP-05 §5, RP-09 §1 and §6. The reasoning: "a
   relational engine, a schema, migrations, connection pooling and row-level
   security policies, to hold one JSON object of about 14 KB… The operational
   surface exceeds the application." The answer, point by point: the schema is
   one row per storage key plus a history table (no normalisation, no
   row-level security — authorization is one `WHERE user_id = ?`); pooling is
   a connection string; migrations are one tool the auth library needs anyway;
   and in exchange the project gets a private execution context for secrets
   and an allowlist, a `pg_dump`-portable store, and a real restore window
   where Firestore Spark has "no rollback of any kind" (RP-07 §5). The cost the
   earlier reports named is real and stays named: three moving parts (host,
   database, auth library) where zero exist today.
3. **RP-05 §2's exclusion of "Vercel or Netlify function plus hosted
   Postgres"** on Neon's forced scale-to-zero. Verified: the restart adds "a
   few hundred milliseconds"; the project accepts one second; it is a latency,
   not a data-loss risk.
4. **Firestore `users/{uid}` plus client-rotated snapshots** (RP-05 §6, RP-07
   §5, RP-09 §1 and C4). The snapshot layer existed because Spark has no
   restore. Replacement: Neon's 6-hour restore window, an append-only
   `document_versions` table (every write keeps the previous version; the
   data is tiny), and the JSON file from batch 3.3.
5. **"Sign-in via Firebase `signInWithPopup`, never `signInWithRedirect`"**
   (`security-auth.md`, RP-06 §1, RP-09 C5). Superseded in mechanism, not in
   identity: Google stays the only provider, because RP-06's deciding axis —
   recovery after a device wipe — still holds. The redirect-breaks finding was
   specific to Firebase's redirect flow, which relied on third-party storage on
   the Firebase auth domain. A standard authorization-code redirect to a
   same-origin `/api/auth/callback/google` sets a first-party cookie and
   involves no third-party storage. A visible button still starts it.

### Decision stands, reason changes

1. **RP-06's auth comparison** never evaluated Better Auth, Auth.js, Clerk,
   Auth0 or Supabase Auth; they were outside the "no server" contract. This
   report evaluates them. The recovery axis transfers and still favours Google.
2. **"A static site cannot hold a secret"** (RP-06 §3, `security-auth.md`) is
   re-scoped, not deleted: the client bundle still cannot; only `api/` may read
   secrets, and nothing secret may carry a `VITE_` name.
3. **RP-06 §5c/§5d's "nothing contractual to do"** held because Google's DPA
   auto-incorporates and Warsaw is in the EU. Vercel and Neon are new
   processors: accepting their DPAs, choosing regions and reviewing
   subprocessors are tasks (batch 5.1), not inherited conclusions.
4. **RP-09 §1's never-build list** (payments, automated sending, an iCal feed,
   student records…) was justified by "GitHub Pages has no backend". It is
   re-affirmed on new grounds — scope, personal-data appetite, maintainer
   capacity — rather than silently inherited. A backend makes those features
   possible; it does not make them wanted.
5. **RP-05 §7 / RP-07 §4's local-first model** survives almost unchanged: the
   local write is the commit, everything else is replication, last-write-wins
   on timestamps, whole document, the indicator states, boot-time
   compare-and-push. Only Firestore's `hasPendingWrites` has no equivalent; it
   becomes the store's own `remote` directive.

### Inherited prerequisites

1. **Stable group ids.** Flagged by RP-04 §3, RP-07 §7 and RP-08 §43 and never
   solved; a database needs primary keys. RP-07 §2 supplies the migration
   rules. Batch 6.1 is that work, before any row is written.
2. **Neon's inactivity policy** was `TBD` in RP-05 §4. Now checked: no pause
   rule; one sentence about 90-day deletion of inactive Free projects exists
   only on the Azure-deprecation page. Recorded as a watch item; batch 6.4
   decides on a monthly keep-alive.
3. **The payment identifiers** must not reach any new sink (RP-05 §7, RP-06
   §7, RP-07 §5). The shipped default template has carried neutral placeholders
   since batch 2a.3d; batch 3.5's remaining tasks are Phase 3, before any
   upload. The teacher's own template, stored in her own authenticated row, is
   her data under the processors' DPAs — not a leak. Fixtures still never
   contain the values.
4. **Still open:** RP-09 T1 (her browser, device and OS), D9/T22 (retention
   period, from her accountant, never guessed), D10 (service worker).
5. **Two rules survive any stack:** the three key names and their shapes, and
   RP-06 §6's non-identifying group labels.

## 5. Open decisions for the owner

| Decision                                                                            | Recommended                          | Where it is recorded                 | Batch |
| ----------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------ | ----- |
| Ask Vercel Support in writing whether the Hobby plan fits this app                  | Yes, before real data is stored      | `deployment.md`                      | 4.1   |
| Custom domain before the cutover                                                    | Yes                                  | `deployment.md`                      | 4.3   |
| How "a red suite cannot publish" is kept: CI as a required check, or CLI deploy     | Required check                       | `deployment.md`                      | 4.3   |
| Length of the GitHub Pages transition window                                        | 60–90 days                           | `deployment.md`                      | 4.3   |
| Accept Neon's and Vercel's DPAs                                                     | Yes, read first                      | `security-auth.md`                   | 5.1   |
| Land 4.1 and 4.2 during Phase 3, or after 3.7                                       | During (they are inert)              | `docs/plan/README.md`                | —     |
| Dependabot security alerts on the repository                                        | Yes                                  | `security-auth.md`                   | 5.2   |
| Monthly keep-alive against Neon's 90-day sentence                                   | Decide after asking Neon             | `backend.md`                         | 6.4   |

## 6. Risks and watch items

| Risk                                                                                            | Likelihood / impact | Mitigation in the plan                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| Vercel removes the Hobby project under the non-commercial clause                                | Low / high          | Written ruling first (4.1); Cloudflare or Pro as fallbacks; the static build and Web-standard handlers move anywhere |
| Neon deletes an inactive Free project (the 90-day sentence)                                     | Low / high          | The app is used monthly; the JSON export stays the user-facing backup; keep-alive decision (6.4); Neon can restore a deleted project within 7 days |
| Product churn at Neon (Databricks, "Lakebase" renaming, Azure exit) or Better Auth (Vercel)     | Medium / medium     | Plain SQL and `pg_dump`; the auth schema is four tables in our database; the Hono app is host-agnostic  |
| A Better Auth security advisory on the core OAuth path                                          | Medium / high       | Dependabot security alerts; `npm audit` in the review batches; no plugins installed                     |
| The teacher's one-time export/import goes wrong                                                 | Low / high          | Rehearsed in an isolated profile first (4.3); the old site keeps serving her untouched data during the window |
| Free-tier terms change (RP-09 K13)                                                              | Medium / medium     | Every figure here is dated; the plan re-checks the pricing pages before 5.1                              |
| Sync propagates corruption (RP-09 K7)                                                           | Low / high          | Shape validation on the server (6.2); `document_versions` history; Neon restore window                  |

The GDPR remarks in this report and its pages are an engineer's reading of
vendor documentation, not legal advice.

## 7. Where this lands in the plan

The execution plan hub, [docs/plan/README.md](../../plan/README.md), now
carries Phases 4–6 with thirteen batches, a merge order and phase gates. The
decisions live in the context files, as the project's decision rule requires:
[deployment.md](../../../.claude/context/deployment.md),
[security-auth.md](../../../.claude/context/security-auth.md),
[storage-data-contract.md](../../../.claude/context/storage-data-contract.md),
[state-management.md](../../../.claude/context/state-management.md),
[backend.md](../../../.claude/context/backend.md) (new),
[testing.md](../../../.claude/context/testing.md),
[react-migration.md](../../../.claude/context/react-migration.md).

## 8. Sources

The vendor sources live in the three pages, one table each, every row with a
URL and the access date 2026-09-09. This hub cites only project documents.

| #  | Title                                        | URL                                                                | Accessed   | Supports              |
| -- | -------------------------------------------- | ------------------------------------------------------------------ | ---------- | --------------------- |
| P1 | RP-04 Build tooling and deployment           | ../rp04-build-deploy/rp04-build-deploy.md                          | 2026-09-09 | §4 origin, previews   |
| P2 | RP-05 Durable storage                        | ../rp05-durable-storage/rp05-durable-storage.md                    | 2026-09-09 | §4 Postgres verdict   |
| P3 | RP-06 Authentication and data protection     | ../rp06-auth-gdpr/rp06-auth-gdpr.md                                | 2026-09-09 | §4 auth, GDPR         |
| P4 | RP-07 Data migration, backup and recovery    | ../rp07-data-migration-recovery/rp07-data-migration-recovery.md    | 2026-09-09 | §4 envelope, ids      |
| P5 | RP-09 Synthesis and roadmap                  | ../rp09-roadmap/rp09-roadmap.md                                    | 2026-09-09 | §4 conflicts, risks   |
| P6 | Execution plan hub                           | ../../plan/README.md                                               | 2026-09-09 | §7                    |
| P7 | Storage data contract (context file)         | ../../../.claude/context/storage-data-contract.md                  | 2026-09-09 | §4 origin invariant   |
| P8 | Security and authentication (context file)   | ../../../.claude/context/security-auth.md                          | 2026-09-09 | §4 sign-in decision   |

## 9. Quick wins

Not applicable in the form the other reports use. The actionable output of
this report is the set of plan batches 4.1–6.5, each with its own tasks and
acceptance criteria, in [docs/plan/](../../plan/README.md). Writing them again
here as prompts would duplicate the plan, which the wiki rule forbids.

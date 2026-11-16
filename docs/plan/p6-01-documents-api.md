# Batch 6.1 — Documents API

Phase 6 · [Plan home](README.md) · Prev: [6.0](p6-00-record-server-first.md) · Next: [6.2](p6-02-remote-store.md) (batch [6.4](p6-04-backup-menu.md) runs in parallel)

**Planned in batch 6.0 on 2026-11-16. Built on 2026-11-16** (Red `437f268`,
Green `e2fc0cb`). The Neon migration reached `production` before merge, on
2026-11-16, run by the orchestrating session with the owner's yes in chat. The
preview check after merge is still open (Results).

## Goal

A signed-in, allowlisted user can read and write their three documents on the
server, and nobody can read anyone else's. Every write keeps the previous
version. Nothing in the app calls the API yet.

## Test basis

- The plan section "Batch 6.1" in
  [the Phase 6 plan](../superpowers/plans/2026-11-15-phase-6-server-first.md),
  with its Interfaces block.
- [backend.md](../../.claude/context/backend.md), section "Decided on
  2026-11-15 — the documents API".
- [security-auth.md](../../.claude/context/security-auth.md), section "Decided
  on 2026-11-15" (token check, allowlist, limits).
- [storage-data-contract.md](../../.claude/context/storage-data-contract.md)
  (the server row, conflicts).
- RP-09 acceptance criterion 21 (another account cannot read the data) and
  criterion 23 (a client with another schema version writes nothing; met here
  on the server by C5, owner decision 2026-11-16), and
  RP-07 §3–§6.
- [Neon Auth JWT guide](https://neon.com/docs/auth/guides/plugins/jwt): the token
  is in `getSession().data.session.token`, signed with EdDSA, `iss` and `aud`
  are the origin of the auth URL, and it expires after 15 minutes.
- Lessons 26 and 31: the deployed entry imports published npm packages only.

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                                                                           |
| ---- | ---------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| R6   | 2–3        | 3      | 6–9 high   | 3-value BVA on the limits, a decision table on the token, all transitions on concurrency, a fault seeding table, a person checks a preview. |
| R3   | 2–3        | 3      | 6–9 high   | The version history and the 409 rule protect her data from a lost write.                                                                    |
| R5   | TBD        | TBD    | TBD        | The allowlist is now checked on every request. Treated as high, as in batch 5.6.                                                            |

## Entry criteria

- [x] Batch [6.0](p6-00-record-server-first.md) is merged (`2fa6b67`, #88).
- [x] The test basis above is written down (it is).
- [x] This batch can pass its own exit criteria with only what it ships. The
      PGlite tests run the real migration, and the e2e checks use the local
      server's own test key. The Neon production migration is a step **before
      merge**, and needs the owner's yes in chat.

## Test conditions

| ID  | Test condition          | Test level            | Test type                       | Technique                                 | Coverage items                                                                                                                                                                                          | File                                 |
| --- | ----------------------- | --------------------- | ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | Token check             | component integration | functional, black-box, security | decision table                            | valid; expired; wrong `iss`; wrong `aud`; wrong alg; unknown `kid`; bad signature; missing header (8 rules)                                                                                             | `api/documents.test.ts`              |
| C2  | Allowlist per request   | component integration | functional, black-box, security | equivalence partitioning                  | listed; listed with other case or spaces; not listed; list empty → 403                                                                                                                                  | `api/documents.test.ts`              |
| C3  | Isolation (RP-09 AC 21) | component integration | functional, black-box, security | CRUD                                      | user B cannot read, overwrite or version user A's rows (CRUD matrix cells)                                                                                                                              | `api/documents.test.ts`              |
| C4  | Optimistic concurrency  | component integration | functional, black-box           | state transition                          | no row + null base → 200; row + same base → 200; row + stale base → 409 with copy; row + null base → 409                                                                                                | `api/documents.test.ts`              |
| C5  | Validation              | component integration | functional, black-box           | equivalence partitioning + error guessing | one invalid value per case: non-array data, group with no name, price not a number, date not `YYYY-MM-DD`, settings with no currency, template not a string or null, unknown key, schemaVersion 0 and 2 | `api/documents.test.ts`              |
| C6  | Version cap             | component integration | functional, black-box           | 3-value BVA                               | 49, 50, 51 previous versions → keeps 50                                                                                                                                                                 | `api/documents.test.ts`              |
| C7  | Body limit              | component integration | functional, non-functional      | 3-value BVA                               | 262 143, 262 144, 262 145 bytes                                                                                                                                                                         | `api/documents.test.ts`              |
| C8  | Validation parity       | component             | functional, white-box           | checklist                                 | each `e2e/fixtures/storage/*.json` is accepted by both validators; each C5 invalid case is refused by the entry                                                                                         | `api/validation-parity.test.ts`      |
| C9  | Over HTTP               | system                | functional, black-box           | scenario-based                            | mint → PUT → GET returns the same body; no token → 401                                                                                                                                                  | `e2e/features/api-documents.spec.ts` |

**Coverage items added while the tests were written** (all in the Red commit,
so each one failed before the code existed):

| ID  | Added coverage items                                                                                                                                                                                                                                                                                                 | Why                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | no `exp` claim → 401; no `email` claim → 401; no `NEON_AUTH_BASE_URL` → 500, nothing read; the application object answers 404 to the mint and JWKS paths                                                                                                                                                             | Error guessing: `jose` accepts a token with no `exp` unless told to require it. The last item is the "no test door" decision this page asks the Red step to make (see below). |
| C3  | the matrix has five cells: C, R, U, V (version) and D. D is "there is no delete route" (404) until batch 6.5                                                                                                                                                                                                         | CRUD: every operation gets a cell, including the one that does not exist yet.                                                                                                 |
| C4  | no row + a non-null base → 409 `{document: null}`, nothing written                                                                                                                                                                                                                                                   | State transition, high risk: all transitions, not only the four listed.                                                                                                       |
| C5  | month key not `YYYY-MM`; `baseUpdatedAt` not a date; request not JSON                                                                                                                                                                                                                                                | Error guessing.                                                                                                                                                               |
| C8  | the entry also refuses nine more bodies: `data` null, blank name, price not finite, dates missing, currency not a string, month key not `YYYY-MM`, month with no dates, settings with an empty currency, settings not an object. The C5 key and schema-version cases are route checks, not bodies, so C5 covers them | Checklist: the six C5 body cases plus the nearby shapes the app mends and the server must refuse.                                                                             |
| C9  | a valid token for an address not on the allowlist → 403                                                                                                                                                                                                                                                              | Proves the Playwright `webServer` really sets `ALLOWED_EMAILS`.                                                                                                               |

Interfaces this batch produces, fixed in the plan and quoted here so a later
batch can rely on them:

- Tables `documents(user_id text, key text check in ('data','settings','template'), body jsonb null, schema_version int not null, updated_at timestamptz not null, primary key (user_id, key))` and `document_versions(id bigserial pk, user_id, key, body jsonb, schema_version, updated_at, saved_at timestamptz default now())` with an index on `(user_id, key, saved_at desc)`. The entry uses drizzle `sql` templates only and does not import the schema (lesson 31).
- `GET /api/documents` → `200 {documents: {data|settings|template: {body, schemaVersion, updatedAt} | null}}`.
- `PUT /api/documents/:key` with `{body, schemaVersion: 1, baseUpdatedAt: string | null}`:
  - success → `200 {updatedAt}`, after copying the old row to `document_versions` and pruning to 50, in one transaction;
  - stale base, or null base while a row exists → `409 {document}`;
  - unknown key, bad shape or `schemaVersion` other than 1 → `400 {error}`;
  - more than 262 144 bytes → `413`;
  - no or invalid token → `401`; not allowlisted → `403`.
- Exported for tests: `verifyUserToken(token, baseUrl): Promise<{sub; email} | null>`, `validateDocument(key, body): boolean`, `type DocumentKey = "data" | "settings" | "template"`.
- `scripts/serve.mjs`: a throwaway Ed25519 key, a JWKS route and `POST /__neon-auth/__test/mint {sub, email}` → `{token}`. `e2e/ui/support/session-token.ts`: `mintToken(request, {sub?, email?})`, with a unique `sub` per call by default.

Files: modify `db/schema.ts`; generate `db/migrations/0000_*.sql` with
`npm run db:generate`; modify `api/[...all].ts`, `package.json` (add `jose` and
`@vercel/functions`), `scripts/serve.mjs`, `playwright.config.ts` (the webServer
environment) and `.env.example`.

## Tasks

- [x] Load the skills named in CLAUDE.md. **None of the three is installed in
      this session** (`istqb-foundation:istqb-foundation-level`,
      `istqb-test-design:istqb-advanced-level-test-analyst`,
      `superpowers:test-driven-development`). The session followed testing.md
      Part 1 instead, and says so to the owner in the pull request.
- [x] Red: write the tests above, with a stub entry whose routes answer 501 and
      whose `verifyUserToken` throws "not implemented". Run
      `npm run test:unit -- api/documents.test.ts`; it must fail on its
      assertions. Commit `Red: documents API …`.
- [x] Green: implement the routes. Generate the migration. Add the dev-server
      key, JWKS and mint route, and the `ALLOWED_EMAILS` value for the e2e
      server. Run `npm run test:unit`, `npm run test:e2e` and the three
      typechecks. Commit `Green: …`.
- [x] Fault seeding (high risk): see the table below.
- [x] Wire the `pg` pool with `attachDatabasePool` from `@vercel/functions`. It
      is a published package, so add it as a runtime dependency.
      `api/deployed-entry.test.ts` must still resolve every import.
- [x] **Before merge, with the owner's yes in chat (an MCP write):** run
      `prepare_database_migration` with the generated SQL on a temporary branch
      of `production`, then `describe_table_schema` for both tables. On
      success, run `complete_database_migration` to apply it to `production`.
      Record both operation ids on this page. The tables stay empty and unread
      until 6.2.
- [ ] After merge, on a preview (`web_fetch_vercel_url`): `GET /api/documents`
      without a token → 401, and `/api/health` → `db: ok`. This is a system
      integration test; record it under Results.
- [x] Open the pull request. The orchestrating session merges it on green CI.

## TDD log

| Step     | Commit    | Command                                      | Result                                                                                                                                                                                  |
| -------- | --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red      | `437f268` | `npm run test:unit -- api/documents.test.ts` | fails with: `expected 501 to be 200` — 42 of 43 tests fail; the others say `expected 501 to be 401`, `… 403`, `… 409`, `… 400`, `… 413`, or `promise rejected "Error: not implemented"` |
| Green    | `e2fc0cb` | `npm run test:unit -- api/documents.test.ts` | passes: 43 of 43                                                                                                                                                                        |
| Refactor | –         | –                                            | none                                                                                                                                                                                    |

Notes on the Red commit:

- **One test passes at Red, on purpose:** "the deployed application has no
  mint route and no JWKS route". It is a guard: it says the stub entry has no
  test door, and it must keep saying so after Green.
- **`api/validation-parity.test.ts` also fails at Red**, 18 of its 25 tests,
  on `Error: not implemented` from `validateDocument`. The seven that pass are
  the app's half (the app loads each fixture unchanged) and two guards (the
  fixture list and the key names). The app's loader already existed.
- **The e2e spec fails at Red too**: `mintToken` finds no mint route, and the
  stub answers 501 where 401 is expected.
- **The schema and the generated migration are in the Red commit.** The plan
  fixes the tables as an interface, and the PGlite tests apply the real
  migration. Without them, the C6 seeding would fail on a missing relation
  rather than on an assertion. The routes that use the tables are Green.
- **`jose` and `@vercel/functions` are in the Red commit's `package.json`**, so
  the `tdd-evidence` job's `npm ci` at that commit can run the tests, which
  sign tokens with `jose`.
- **`api/health.test.ts` changed in Green:** its fake database gained a
  `transaction` that rejects, because the `Db` seam now has one. The assertion
  is unchanged.

## Acceptance criteria

- [x] **Given** no token, **when** a client calls `GET /api/documents`, **then**
      the answer is 401. (C1 rule 8; C9 over HTTP.)
- [x] **Given** a valid token for a user who is not on the allowlist, **when**
      the client calls the API, **then** the answer is 403. (C2; C9 over HTTP.)
- [x] **Given** two allowlisted users, **when** user B calls the API, **then**
      B sees none of A's documents and cannot change them. (C3.)
- [x] **Given** a client that sends `schemaVersion` 0 or 2, **when** it saves,
      **then** the answer is 400 and nothing is written (RP-09 AC 23). (C5.)
- [x] **Given** a stored document, **when** a client saves with an old
      `baseUpdatedAt`, **then** the answer is 409 with the server copy and
      nothing is overwritten. (C4.)
- [x] **Given** a document that already has 50 previous versions, **when** it is
      saved again, **then** the oldest version is removed, so 50 remain. (C6.)
- [x] **Given** the deployed app, **when** the teacher uses it, **then** nothing
      changes, because no code calls the API yet. Evidence: no file under
      `app/` changed in this batch, and the whole e2e suite runs as before.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI. **Locally:** all exit 0
      except `test:e2e`, which fails only the 10 tests that fail on `main` in
      this container too (see Results). CI is the judge; this box is ticked
      when CI is green.
- [x] Coverage: covered coverage items ÷ identified coverage items =
      **65 / 65**. Planned on this page: 47 (C1 8, C2 4, C3 5, C4 4, C5 9, C6
      3, C7 3, C8 9 = 3 fixtures + 6 C5 bodies, C9 2). Added while writing the
      tests: 18 (C1 4, C4 1, C5 3, C8 9, C9 1; see the table under Test
      conditions).
- [x] The TDD log is complete.
- [x] The function count is still 1 (`api/one-function.test.ts` passes).
- [x] Every new anomaly has a DEF row or an explanation on this page. No new
      anomaly was found. The 10 local e2e failures are known and also happen
      on `main` (Results).
- [x] Counts: `test:unit` **522** (68 new: 43 in `api/documents.test.ts`, 25
      in `api/validation-parity.test.ts`), `test:e2e` **207** (3 new in
      `api-documents.spec.ts`).

## Confirmation and regression testing

Impact analysis: `api/[...all].ts` is the one deployed entry, so
`api/deployed-entry.test.ts`, `api/one-function.test.ts` and `api/health.test.ts`
must stay green. `playwright.config.ts` changes its webServer environment, so
the whole e2e suite runs again. `scripts/serve.mjs` gains test-only routes; the
dead-test-door lesson (DEF-028) applies: the mint route lives in the local
server only. The session decides in the Red step whether a test should prove
that the deployed entry has no such route, and records the answer.

**Decided in the Red step: yes.** `api/documents.test.ts` asks the application
object for `POST /__neon-auth/__test/mint`, `POST /api/__neon-auth/__test/mint`,
`POST /api/__test/mint` and `GET /__neon-auth/.well-known/jwks.json`, and
expects 404 for each. It calls the routes rather than searching the source for
a string, so it is not a fake check.

**Regression results:** `api/deployed-entry.test.ts` (compiles the entry the
way Vercel does, with `jose` and `@vercel/functions`, and answers a real
request), `api/one-function.test.ts`, `api/health.test.ts`,
`api/webhook.test.ts` and `api/db-seam.test.ts` all pass. The whole e2e suite
ran again with the new `webServer` environment: no new failure.
`auth-webhook.spec.ts` now gets its 401 branch (signature checked) rather
than 500, because `NEON_AUTH_BASE_URL` is set; it accepts both.

## Fault seeding

High risk (R6), so required. Break the code on purpose and record which tests
fail.

| Defect put in on purpose            | Result                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drop `WHERE user_id = …` from `GET` | Detected. 2 tests fail: C3 "R: B's GET returns none of A's documents" and C3 "C and V: B's own writes create B's rows and no version of A's". 41 pass. |
| Skip the `aud` check                | Detected. 1 test fails: C1 "rule 4, wrong aud". 42 pass.                                                                                               |
| Prune to 51 versions instead of 50  | Detected. 2 tests fail: C6 "50 previous versions" and C6 "51 previous versions". The 49 case passes, as it should: 50 remain either way.               |

Each defect was put into `api/[...all].ts` alone, `npx vitest run
api/documents.test.ts` was run, and the file was restored with
`git checkout`. Nothing seeded was committed.

## Results

Run on 2026-11-16 in the batch session's container, at Green `e2fc0cb` plus
this page.

| Check                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                                                                                             | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run lint`                                                                                                     | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run typecheck`                                                                                                | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run typecheck:app`                                                                                            | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run typecheck:api`                                                                                            | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run check:pii`                                                                                                | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run test:unit`                                                                                                | exit 0: 17 files, 522 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:e2e`                                                                                                 | 197 passed, 10 failed. The 10 are exactly the ones that fail on `main` in this container while CI is green: 7 in `visual-layout.spec.ts`, and 3 in `backup-round-trip.spec.ts` (lines 159, 185, 221). No other failure. The 3 new specs pass. CI is the judge.                                                                                                                                                                                                                 |
| `npm run db:generate`                                                                                              | wrote `db/migrations/0000_furry_justice.sql` (2 tables, 1 index). No database was used.                                                                                                                                                                                                                                                                                                                                                                                        |
| CI                                                                                                                 | Green on PR #90 at `b3a9a16`: `checks` and `tdd-evidence` succeeded on 2026-11-16 (`tdd-evidence` re-ran Red `437f268`).                                                                                                                                                                                                                                                                                                                                                       |
| Neon `prepare_database_migration` (temporary branch of `production`), then `describe_table_schema` for both tables | Done on 2026-11-16 by the orchestrating session, with the owner's yes in chat. Migration id `b213f547-6ec7-4a33-9c7b-e23a0018fdcb`. The SQL was `0000_furry_justice.sql` with the `--> statement-breakpoint` lines removed. Temporary branch `br-sweet-tooth-b1zysrh3`, parent `br-polished-term-b1eassui` (`production`), database `neondb`, project `square-lab-10400131`. `describe_table_schema` on the temporary branch showed both tables as the migration defines them. |
| Neon `complete_database_migration` (`production`)                                                                  | Done on 2026-11-16 at about 10:10 UTC, same migration id `b213f547-6ec7-4a33-9c7b-e23a0018fdcb`; it deleted the temporary branch. On `production`, `describe_table_schema` shows `documents` (5 columns, primary key `(user_id, key)`, `documents_key_check`) and `document_versions` (7 columns, primary key `id`, index `document_versions_user_key_saved_at_idx`), both empty. The batch session read both tables again and saw the same.                                   |
| Preview, after merge: `GET /api/documents` with no token → 401; `/api/health` → `db: ok`                           | _open: the orchestrating session, with the date._                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Do not run `npm run db:migrate` against `production`.** The migration
reaches Neon through the MCP steps above, so Neon has no
`__drizzle_migrations` record of it, and drizzle-kit would try to apply `0000`
again and fail on the existing tables. Recorded in backend.md, "Built in batch
6.1".

**Owner decisions of 2026-11-16, relayed by the orchestrating session:**

- A missing `NEON_AUTH_BASE_URL` answers `500`, and nothing is read (recorded
  in backend.md and security-auth.md).
- For batch 6.3: the move uploads the data the app loaded, after its repairs,
  and the move dialog lists the repairs. `localStorage` stays untouched until
  the read-back matches (recorded in storage-data-contract.md and on the
  [6.3 page](p6-03-move-local-data.md)).

## Merge order and dependencies

Depends on 6.0. Runs in parallel with [6.4](p6-04-backup-menu.md). The Neon
migration reaches production **before** this batch merges (owner decision,
2026-11-15). Deployable: yes — the routes exist and nothing calls them.

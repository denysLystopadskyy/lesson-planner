# Batch 6.1 — Documents API

Phase 6 · [Plan home](README.md) · Prev: [6.0](p6-00-record-server-first.md) · Next: [6.2](p6-02-remote-store.md) (batch [6.4](p6-04-backup-menu.md) runs in parallel)

**Planned in batch 6.0 on 2026-11-16. Not started.** The session that runs it
fills in the TDD log and the results.

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

- [ ] Batch [6.0](p6-00-record-server-first.md) is merged.
- [ ] The test basis above is written down (it is).
- [ ] This batch can pass its own exit criteria with only what it ships. The
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

- [ ] Load the skills named in CLAUDE.md. If the ISTQB skills are not
      installed, say so here and follow testing.md Part 1.
- [ ] Red: write the tests above, with a stub entry whose routes answer 501 and
      whose `verifyUserToken` throws "not implemented". Run
      `npm run test:unit -- api/documents.test.ts`; it must fail on its
      assertions. Commit `Red: documents API …`.
- [ ] Green: implement the routes. Generate the migration. Add the dev-server
      key, JWKS and mint route, and the `ALLOWED_EMAILS` value for the e2e
      server. Run `npm run test:unit`, `npm run test:e2e` and the three
      typechecks. Commit `Green: …`.
- [ ] Fault seeding (high risk): see the table below.
- [ ] Wire the `pg` pool with `attachDatabasePool` from `@vercel/functions`. It
      is a published package, so add it as a runtime dependency.
      `api/deployed-entry.test.ts` must still resolve every import.
- [ ] **Before merge, with the owner's yes in chat (an MCP write):** run
      `prepare_database_migration` with the generated SQL on a temporary branch
      of `production`, then `describe_table_schema` for both tables. On
      success, run `complete_database_migration` to apply it to `production`.
      Record both operation ids on this page. The tables stay empty and unread
      until 6.2.
- [ ] After merge, on a preview (`web_fetch_vercel_url`): `GET /api/documents`
      without a token → 401, and `/api/health` → `db: ok`. This is a system
      integration test; record it under Results.
- [ ] Open the pull request. The orchestrating session merges it on green CI.

## TDD log

| Step     | Commit | Command | Result                             |
| -------- | ------ | ------- | ---------------------------------- |
| Red      |        |         | _fails with: <one to three lines>_ |
| Green    |        |         | _passes_                           |
| Refactor |        |         | _optional; passes_                 |

## Acceptance criteria

- [ ] **Given** no token, **when** a client calls `GET /api/documents`, **then**
      the answer is 401.
- [ ] **Given** a valid token for a user who is not on the allowlist, **when**
      the client calls the API, **then** the answer is 403.
- [ ] **Given** two allowlisted users, **when** user B calls the API, **then**
      B sees none of A's documents and cannot change them.
- [ ] **Given** a client that sends `schemaVersion` 0 or 2, **when** it saves,
      **then** the answer is 400 and nothing is written (RP-09 AC 23).
- [ ] **Given** a stored document, **when** a client saves with an old
      `baseUpdatedAt`, **then** the answer is 409 with the server copy and
      nothing is overwritten.
- [ ] **Given** a document that already has 50 previous versions, **when** it is
      saved again, **then** the oldest version is removed, so 50 remain.
- [ ] **Given** the deployed app, **when** the teacher uses it, **then** nothing
      changes, because no code calls the API yet.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _N / N_.
- [ ] The TDD log is complete.
- [ ] The function count is still 1 (`api/one-function.test.ts`).
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.

## Confirmation and regression testing

Impact analysis: `api/[...all].ts` is the one deployed entry, so
`api/deployed-entry.test.ts`, `api/one-function.test.ts` and `api/health.test.ts`
must stay green. `playwright.config.ts` changes its webServer environment, so
the whole e2e suite runs again. `scripts/serve.mjs` gains test-only routes; the
dead-test-door lesson (DEF-028) applies: the mint route lives in the local
server only. The session decides in the Red step whether a test should prove
that the deployed entry has no such route, and records the answer.

## Fault seeding

High risk (R6), so required. Break the code on purpose and record which tests
fail.

| Defect put in on purpose            | Result |
| ----------------------------------- | ------ |
| Drop `WHERE user_id = …` from `GET` |        |
| Skip the `aud` check                |        |
| Prune to 51 versions instead of 50  |        |

## Results

_Filled in by the session that runs this batch: commands, SHAs, the two Neon
operation ids, and the preview check with its date._

## Merge order and dependencies

Depends on 6.0. Runs in parallel with [6.4](p6-04-backup-menu.md). The Neon
migration reaches production **before** this batch merges (owner decision,
2026-11-15). Deployable: yes — the routes exist and nothing calls them.

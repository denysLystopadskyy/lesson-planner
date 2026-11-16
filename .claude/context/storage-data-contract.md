# Storage data contract

The most important invariant in the project. Referenced from
[CLAUDE.md](../../CLAUDE.md). Background:
[RP-05 storage](../../docs/research/rp05-durable-storage/rp05-durable-storage.md),
[RP-07 backup and recovery](../../docs/research/rp07-data-migration-recovery/rp07-data-migration-recovery.md),
and for the database decision of 2026-09-09 the
[RP-10 database page](../../docs/research/rp10-service-evaluation/database.md).

## Decided on 2026-11-15 — server-first (batch 6.0) — read this first

Owner decisions, confirmed in chat on 2026-11-15 and 2026-11-16. The full plan is
[the Phase 6 server-first plan](../../docs/superpowers/plans/2026-11-15-phase-6-server-first.md).
Where a rule further down says "local-first", this section is right. Those rules
are marked **Superseded on 2026-11-15** and kept for the history.

- **Server-first replaces local-first when the teacher is signed in.** Neon
  Postgres is then the only store of her planner. The app has three start
  modes:
  - **No auth URL** (the GitHub Pages build has no `VITE_NEON_AUTH_URL`): local
    mode, exactly as before. Nothing about the three keys changes.
  - **Sign-in is available and she is signed out, and this browser holds
    planner data:** local mode, as today, until she signs in and the move runs.
  - **Sign-in is available and she is signed out, and this browser holds no
    planner data:** a sign-in screen only (owner, 2026-11-15).
- **Remote mode writes no planner key to `localStorage`, ever.** An e2e check
  in batch 6.2 proves it.
- **The move is one upload, read back and compared, then a clean-up.** The
  client uploads what it finds in `localStorage`, reads it back and compares the
  fingerprint (`fingerprintOf` in `app/src/backup.ts`). Only after they match,
  it removes **every planner key on this origin**:
  - the three data keys;
  - `groupLessonPlannerLastBackup`;
  - every `.pre-import.*`, `.pre-v*.*` and `.corrupt.backup` copy.

  Keys that belong to other owners (Neon Auth's) stay. If any step fails, the
  local copy is left untouched and a message is shown (risk R8 in
  [testing.md §1.8](testing.md#18-product-risks)).

- **RP-09 acceptance criterion 23 moves to the server (owner, 2026-11-16).**
  The API refuses a `PUT` whose `schemaVersion` is not 1, so a client with
  another schema version writes nothing. Batch 6.1, test condition C5, meets it.
- **Old batch 6.1 is dropped.** There are no group ids, no
  `groupLessonPlannerSchemaVersion` key and no `groupLessonPlannerSync` key.
  The schema version lives on the server row (`schema_version = 1`). The backup
  envelope stays at version 1. This resolves the five owner questions of batch
  T.10 by removing their premise (see
  [pt-10](../../docs/plan/pt-10-phase-6-pages-and-lessons.md)).
- **The server mirror is one row per key.** Table `documents(user_id, key,
body, schema_version, updated_at)` with `key` in `data | settings | template`,
  plus `document_versions`, which keeps the 50 previous bodies of each key. The
  body is the same bytes the browser used to store. There is no
  `client_updated_at` column: the client no longer has its own clock to compare.
- **Conflicts:** `PUT` carries `baseUpdatedAt`. If it does not match the server
  row, the answer is `409` with the server copy. A person chooses; nothing is
  merged automatically. This replaces last-write-wins on `updated_at`.
- **Backups.** The JSON backup (**Save Backup** and **Load Backup**) and the
  CSV download stay, as the teacher's local copies. Both sit under one
  **Backup** menu (batch 6.4). In remote mode, an import replaces the planner in
  the account after a confirmation, and Undo keeps the previous state in memory
  for the session only.
- **The old origin keeps its copy as the rollback until batch 4.4.** At the end
  of the window, 4.4 adds "Remove my data from this old site" to the moved
  banner.

## Built in batch 6.1 (2026-11-16) — what the server accepts as a body

Batch [6.1](../../docs/plan/p6-01-documents-api.md). The entry's
`validateDocument` is written inside `api/[...all].ts` (lesson 31), and
`api/validation-parity.test.ts` runs the e2e storage fixtures through it and
through the app's loaders.

- **The server refuses; the app mends.** The app's loader repairs a bad value
  and reports the repair (batch 3.1). The server refuses it with `400`,
  because the server copy is what every device loads next, and a repair made
  there would be silent.
- **`data`:** an array of groups. Each group has a non-blank `name`, a finite
  `price`, and `dates` as `YYYY-MM-DD` strings. `currency` is optional and a
  string. `monthlyOverrides` is optional; each key is `YYYY-MM`, each value
  has a finite `price` and `dates` as above. `null` is not a `data` body.
- **`settings`:** an object with a non-empty `defaultCurrency` string. `null`
  is not a `settings` body.
- **`template`:** a string, or `null`, which means "use the default
  template", as an absent key does.
- **Properties the contract does not name are allowed**, so that nothing the
  legacy app wrote is refused for an extra field.
- **The move uploads what the app loaded, after its repairs (owner decision,
  2026-11-16; built in batch 6.3).** The server refuses shapes the app only
  mends — for example an override with no `dates` (DEF-021) — so the raw
  `localStorage` text is not what is uploaded. The move dialog lists the
  repairs, so she sees what was mended before it goes to the server.
  `localStorage` stays untouched until the read-back matches. "The body is the
  same bytes the browser used to store" holds for every value the app stores
  itself.

## The three keys (do not rename, do not reshape)

| Key                          | Shape                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `groupLessonPlannerData`     | JSON array of groups: `{name, price, currency, dates: ["YYYY-MM-DD"], monthlyOverrides: {"YYYY-MM": {price, dates[]}}}` |
| `groupLessonPlannerSettings` | JSON object: `{defaultCurrency}`                                                                                        |
| `paymentTemplate`            | Raw string (not JSON)                                                                                                   |

## A fourth key, added in batch 3.3

| Key                            | Shape                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `groupLessonPlannerLastBackup` | Raw ISO 8601 timestamp string, not JSON. Absent means "never backed up" |

The first key added since this contract was written, so the reasoning is
recorded rather than assumed. It holds when the teacher last saved a backup
file, which the toolbar indicator reads to say "Last backup: N days ago".

It does not touch the three keys and it is not planner data: nothing reads it
but the indicator, and losing it costs a reminder, not a lesson. It is a raw
string rather than JSON for the same reason `paymentTemplate` is — a value that
is never parsed can never fail to parse.

It is deliberately **not** written into the backup file. The file records when
it was made, in `exportedAt`; this key records when _this browser_ last saved
one. Restoring an old backup must not convince the app it has a recent one.

## Keys that arrive with Phases 4–6 (decided 2026-09-09; not present yet)

**Superseded on 2026-11-15.** Neither key will be created: server-first removes
the need for both (see the section above). The table is kept for the history.

| Key                               | Arrives in batch  | Shape                                                                                                             |
| --------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `groupLessonPlannerSchemaVersion` | old 6.1 (dropped) | A bare decimal integer as a string, not JSON (RP-07 §2). Absence means version 0, the data every current user has |
| `groupLessonPlannerSync`          | old 6.3 (dropped) | JSON: `lastSyncedAt` and a per-key `baseUpdatedAt`. Sync metadata never goes inside the three data keys           |

Snapshot keys stay as RP-07 §2 designed them: `<key>.pre-v<N>.<epoch>` before a
migration, `<key>.pre-import.<epoch>` before an import, `<key>.corrupt.backup`
for a value that failed to parse.

## Rules

- **Origin rule (rewritten 2026-09-09).** `localStorage` belongs to one origin,
  today `https://denyslystopadskyy.github.io`. The origin may change **only**
  through a rehearsed export/import migration — RP-07 §6 Procedure B with the
  batch 3.3 export — and never as part of a rollback. Plan batch
  [4.3](../../docs/plan/p4-03-cutover-to-vercel.md) is the one planned change;
  after it the origin is the Vercel production URL or the custom domain. The
  three key names never change with the origin.
- **Byte compatibility.** The React app must read data written by the legacy
  app, and write data the legacy app could read, until the legacy file is
  deleted. The storage-contract specs (plan batch 1.13) prove this with
  realistic fixtures.
- **Staging prefix — retired at the cutover (plan batch 2a.4).** While the React
  build was staging at `/next/` it wrote keys carrying `VITE_STORAGE_PREFIX`, so
  it shared an origin with the live page and could not touch the real data. The
  shipped build sets no prefix and reads the three keys below.
  `storage-contract.spec.ts` asserts that: a `next:` key in the running app
  would mean the staging build shipped. The mechanism stays in the code
  (`app/src/storage-keys.ts`, the `storagePrefix` test fixture) because a
  second target on the same origin would need it again. A Vercel preview
  deployment has its own origin, so it never needs the prefix (decided
  2026-09-09); the e2e fixtures still use the seam.
- **Superseded on 2026-11-15: no group ids and no version key will be added.** The original rule follows. **No schema change before plan batch 6.1.** A version field and migrations
  are designed in RP-07 §2 and arrive there: `m1: v0 → v1` adds `id` to every
  group and nothing else. Migrations are pure functions, run in memory at load,
  and are persisted on the next user write together with a `pre-v1` snapshot —
  so nothing is written on mount, and the corrupt-storage guard keeps working.
  A stored version newer than the client puts the client in read-only mode and
  writes nothing (RP-07 §2 rule 4; RP-09 acceptance criterion 23).
- **D8 decided (2026-09-09): the `dates` denormalisation stays in v1.** Every
  date keeps living in `group.dates` and in `monthlyOverrides[month].dates`.
  Removing it is a larger change than ids need, and the fingerprint's parity
  check depends on both being present.
- **Nullability decided (2026-09-09):** `currency` and `monthlyOverrides` stay
  optional in stored groups, as today. Aligning the e2e `test-data.ts` type
  with the app's type, so there is one definition of `Group`, is open and
  unassigned: no batch lists that file yet.
- **Superseded on 2026-11-15 (the `client_updated_at` column is dropped; see the top section):** the server mirror (Phase 6) is one row per key, not a normalised schema.
  Table `documents(user_id, key, body, schema_version, updated_at,
client_updated_at)` with `key` in `data | settings | template`, plus an
  append-only `document_versions` table capped per key. The body is the same
  bytes the browser stores. This keeps the schema as small as the document
  model and makes the mapping auditable by eye (RP-07 §2's "one transform, two
  sinks").
- **Superseded on 2026-11-15 (server-first while signed in): local-first stays.** The local write is the commit; the server is the
  replica (RP-05 §7, RP-07 §4). Conflicts are last-write-wins on
  `updated_at`, whole document, no field-level merge; when both sides have data
  and differ, a person chooses (RP-07 §3). The indicator states are RP-07 §4's.
- **Backups:** a versioned JSON export/import covering all three keys arrives
  in plan batch 3.3. The CSV export is not a backup (it omits the template and
  can fail on re-import — see the DEF registry). In Phase 6 the export stays
  the user-facing backup; the server adds `document_versions` and Neon's
  6-hour restore window (Free plan, 2026-09-09).

## Open, and assigned

- ~~The shape of `groupLessonPlannerSync` beyond the two fields named above —
  plan batch 6.3.~~ **Superseded on 2026-11-15:** that key will not exist.

Resolved on 2026-09-09: the schema version field name and the migration rules,
both above, from RP-07 §2.

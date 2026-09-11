# Storage data contract

The most important invariant in the project. Referenced from
[CLAUDE.md](../../CLAUDE.md). Background:
[RP-05 storage](../../docs/research/rp05-durable-storage/rp05-durable-storage.md),
[RP-07 backup and recovery](../../docs/research/rp07-data-migration-recovery/rp07-data-migration-recovery.md),
and for the database decision of 2026-09-09 the
[RP-10 database page](../../docs/research/rp10-service-evaluation/database.md).

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

| Key                               | Arrives in batch                                         | Shape                                                                                                             |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `groupLessonPlannerSchemaVersion` | [6.1](../../docs/plan/p6-01-schema-version-group-ids.md) | A bare decimal integer as a string, not JSON (RP-07 §2). Absence means version 0, the data every current user has |
| `groupLessonPlannerSync`          | [6.3](../../docs/plan/p6-03-remote-persistence.md)       | JSON: `lastSyncedAt` and a per-key `baseUpdatedAt`. Sync metadata never goes inside the three data keys           |

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
- **No schema change before plan batch 6.1.** A version field and migrations
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
  optional in stored groups, as today. The e2e `test-data.ts` type is aligned
  to the app's type in batch 6.1, so there is one definition of `Group`.
- **The server mirror (Phase 6) is one row per key, not a normalised schema.**
  Table `documents(user_id, key, body, schema_version, updated_at,
client_updated_at)` with `key` in `data | settings | template`, plus an
  append-only `document_versions` table capped per key. The body is the same
  bytes the browser stores. This keeps the schema as small as the document
  model and makes the mapping auditable by eye (RP-07 §2's "one transform, two
  sinks").
- **Local-first stays.** The local write is the commit; the server is the
  replica (RP-05 §7, RP-07 §4). Conflicts are last-write-wins on
  `updated_at`, whole document, no field-level merge; when both sides have data
  and differ, a person chooses (RP-07 §3). The indicator states are RP-07 §4's.
- **Backups:** a versioned JSON export/import covering all three keys arrives
  in plan batch 3.3. The CSV export is not a backup (it omits the template and
  can fail on re-import — see the DEF registry). In Phase 6 the export stays
  the user-facing backup; the server adds `document_versions` and Neon's
  6-hour restore window (Free plan, 2026-09-09).

## TBD

- Resolved on 2026-09-09: the schema version field name and migration rules
  (above, from RP-07 §2). The shape of `groupLessonPlannerSync` beyond the two
  fields named above is decided in batch 6.3.

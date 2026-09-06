# Storage data contract

The most important invariant in the project. Referenced from
[CLAUDE.md](../../CLAUDE.md). Background:
[RP-05 storage](../../docs/research/rp05-durable-storage/rp05-durable-storage.md),
[RP-07 backup and recovery](../../docs/research/rp07-data-migration-recovery/rp07-data-migration-recovery.md).

## The three keys (do not rename, do not reshape)

| Key                          | Shape                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `groupLessonPlannerData`     | JSON array of groups: `{name, price, currency, dates: ["YYYY-MM-DD"], monthlyOverrides: {"YYYY-MM": {price, dates[]}}}` |
| `groupLessonPlannerSettings` | JSON object: `{defaultCurrency}`                                                                                        |
| `paymentTemplate`            | Raw string (not JSON)                                                                                                   |

## Rules

- **Origin invariant.** `localStorage` belongs to the origin
  `https://denyslystopadskyy.github.io`. Every deploy and cutover must keep the
  same origin and the same three keys, or the teacher's data is orphaned.
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
  (`app/src/storage-keys.ts`, the `storagePrefix` test fixture) because the next
  staging build needs it again.
- **No schema change before Phase 4.** A version field and migrations are
  designed in RP-07 and arrive with the database work.
- **Backups:** a versioned JSON export/import covering all three keys arrives
  in plan batch 3.3. The CSV export is not a backup (it omits the template and
  can fail on re-import — see the DEF registry).

## TBD

- Schema version field name and migration rules — Phase 4, from RP-07 §2.

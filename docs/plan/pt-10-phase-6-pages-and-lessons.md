# Batch T.10 — Phase 6 pages, lessons and registry wording

Phase T · [Plan home](README.md) · Prev: [T.9](pt-09-rewrite-phase-5.md) · Next: [6.0](p6-00-record-server-first.md)

**Absorbed into batch [6.0](p6-00-record-server-first.md) on 2026-11-15.** The
owner decided this in chat, with server-first. The Phase 6 pages were rewritten
there, and each review finding below is resolved on the page it belongs to. **One
task stays open:** the rewrite of `lessons-learned.md` in B2 English and ISTQB
terms was not part of 6.0. It remains a task of this page, to run in parallel
with T.4 to T.9 (see the open question on the 6.0 pull request).

**Planned in batch [T.1](pt-01-test-strategy.md) on 2026-10-17. Not started.**
The batch that runs it completes this page from the
[template](batch-template.md).

## Goal

The Phase 6 pages are full plans on the template, with test conditions, techniques and coverage items (done in 6.0), and the lessons file reads in B2 English and ISTQB terms (still open).

## Test basis

- The old Phase 6 pages `p6-01` to `p6-05`, which 6.0 replaced with `p6-00` to `p6-06`; the old ones are in git history.
- [testing.md Part 1](../../.claude/context/testing.md#part-1--test-strategy), especially the product risks R6 (another account reads her data) and R3 (data loss).
- [lessons-learned.md](lessons-learned.md).

## Review findings in the test basis (2026-10-17)

The acceptance test of batch T.1 asked a fresh session to plan the tests for
batch 6.1. It found these defects in the old p6-01 page (deleted on 2026-11-15; git
history has it) and nearby records — static testing that found defects before any code
exists. They are recorded here, not in the DEF registry, because no code has
them yet. This batch resolves each one on the page, or asks the owner.

1. **The backup envelope is already at version 1.** Batch 3.3 shipped
   `BACKUP_SCHEMA_VERSION = 1` (`app/src/backup.ts` line 47) with groups that
   have no `id`. p6-01 line 39 says "`schemaVersion` becomes 1", and RP-07 §2
   has the same gap. Decide: raise the envelope to 2, or treat a group with no
   `id` as version 0. **Owner question.**
   - **Resolved on 2026-11-15 (owner decision, by removing the premise):** old 6.1 is dropped, so the envelope stays at version 1 and groups keep having no `id`. The version lives on the server row (`schema_version = 1`). Recorded in [storage-data-contract.md](../../.claude/context/storage-data-contract.md).
2. **Ids would change on every reload before the first write.** "Nothing written
   on mount" plus ids made in memory means `#/group/<id>` breaks after a reload,
   while `#/group/1` survives today. **Owner question.**
   - **Resolved by removal:** there are no ids, so `#/group/<index>` is unchanged and nothing breaks on reload. Recorded in [react-migration.md](../../.claude/context/react-migration.md) and [p2b-09](p2b-09-hash-routing.md).
3. **The snapshot scope is unclear:** p6-01 says one `<key>.pre-v1.<epoch>`
   snapshot; RP-07 rule 3 says snapshot all keys. **Owner question.**
   - **Resolved by removal:** there is no `pre-v1` snapshot. In server-first, the move removes every `.pre-import.*`, `.pre-v*.*` and `.corrupt.backup` copy after a verified upload. Recorded in storage-data-contract.md; tested in [6.3](p6-03-move-local-data.md) (C2).
4. **Cases with no stated behaviour:** a version key that cannot be read; version
   1 with a group that has no `id`; a rollback to a build from before 6.1, whose
   `validateGroups` drops `id`. **Owner question.**
   - **Resolved by removal:** there is no version key to read, no migration and no rollback build to consider. The server refuses any `schemaVersion` other than 1 with a 400 ([6.1](p6-01-documents-api.md), C5).
5. **Read-only mode and "storage unchanged" conflict:** a backup export writes
   `groupLessonPlannerLastBackup`, and a failed read writes a `.corrupt.backup`
   key. Is export allowed in read-only mode? **Owner question.**
   - **Resolved by removal:** read-only mode for a newer version goes with the dropped batch (RP-09 criterion 23 moves to the server: the API refuses any `schemaVersion` other than 1, met by 6.1 C5; see the Phase 6 gate in the hub). In remote mode nothing is written to `localStorage`, so the export writes no `groupLessonPlannerLastBackup` and the indicator is hidden ([6.2](p6-02-remote-store.md)). Local mode is unchanged.
6. **Two places create groups and are not on the page:** the add flow
   (`App.tsx` `saveDraft`) and `deserializeCsv`. CSV has no `id` column, so a
   CSV round trip changes every id.
   - **Resolved by removal:** with no ids, the add flow and `deserializeCsv` need no change, and a CSV round trip changes nothing.
7. **The dependencies disagree:** the hub row says 6.1 depends on 5.4 and T.10;
   p6-01 line 61 says 5.4 only.
   - **Resolved on 2026-11-15:** the hub row of 6.0 says it depends on Step 0 and 5.4, and each Phase 6 page states the same dependency in its own "Merge order and dependencies". The T.10 dependency is gone because T.10 is absorbed.
8. **Comments and headings that point to the wrong phase:** `app/src/route.ts`
   line 14 and `app/src/types.ts` line 5 say "Phase 4" (it is Phase 6);
   storage-data-contract.md line 10, "The three keys (do not rename, do not
   reshape)", while 6.1 reshapes groups.
   - **Resolved:** the two "Phase 4" comments in `app/src/route.ts` and `app/src/types.ts` move to batch [6.2](p6-02-remote-store.md), which changes both files with a red commit (testing.md §1.5 has no exception for a comment-only change). The heading "The three keys (do not rename, do not reshape)" stays true for local mode, because no batch reshapes groups now.
9. **`e2e/features/testid-contract.spec.ts` line 20 says "The 8 frozen"** above a
   list of 7.
   - **Resolved in 6.0:** the comment in `e2e/features/testid-contract.spec.ts` now says "The 7 frozen".

## Tasks

- [x] Rewrite `p6-01` to `p6-05` on the template, with full test conditions, techniques and coverage items. **Done in 6.0** as the new pages `p6-00` to `p6-06`.
- [x] Fix their stale lines. **Done:** the old pages are gone; the new pages name no Better Auth session and keep `@neondatabase/auth` and `jose` at their latest patch (6.6).
- [ ] Rewrite `lessons-learned.md` in B2 English and ISTQB terms. **Keep every lesson number**, because other pages cite them. **Still open: not part of 6.0.**
- [x] Resolve each review finding above on the page it belongs to. **Done in 6.0** (see each finding).
- [x] Add the two code comments in item 8 (`app/src/route.ts`, `app/src/types.ts`) to the tasks of a batch that changes those files. **Done:** they are tasks of [6.2](p6-02-remote-store.md).
- [ ] Out of scope: the research reports RP-01 to RP-10, which are dated research records.

## TDD log

**Exception: docs only.** The comment in `e2e/features/testid-contract.spec.ts`
(item 9) is test code, not production code. The two comments in `app/src/`
(item 8) move to 6.2.

## Acceptance criteria

- [x] **Given** batch 6.1's page, **when** a session starts it, **then** the page already lists the test conditions, techniques, coverage items and the red commit to write first. (Met by [6.1](p6-01-documents-api.md) in 6.0.)
- [ ] **Given** any page that cites a lesson by number, **when** the reader follows it, **then** the lesson with that number says the same thing.

## Exit criteria

- [ ] The exit criteria in [testing.md §1.6](../../.claude/context/testing.md#16-entry-criteria-and-exit-criteria).

## Merge order and dependencies

Depends on T.1. Phase 6 no longer waits for this batch (owner, 2026-11-15). Deployable: yes.

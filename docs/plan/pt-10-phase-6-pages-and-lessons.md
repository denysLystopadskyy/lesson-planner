# Batch T.10 — Phase 6 pages, lessons and registry wording

Phase T · [Plan home](README.md) · Prev: [T.9](pt-09-rewrite-phase-5.md) · Next: [6.1](p6-01-schema-version-group-ids.md)

**Planned in batch [T.1](pt-01-test-strategy.md) on 2026-10-17. Not started.**
The batch that runs it completes this page from the
[template](batch-template.md).

## Goal

The Phase 6 pages are full plans on the template, with test conditions, techniques and coverage items, and the lessons file reads in B2 English and ISTQB terms.

## Test basis

- The Phase 6 pages `p6-01` to `p6-05`; they have not run yet.
- [testing.md Part 1](../../.claude/context/testing.md#part-1--test-strategy), especially the product risks R6 (another account reads her data) and R3 (data loss).
- [lessons-learned.md](lessons-learned.md).

## Review findings in the test basis (2026-10-17)

The acceptance test of batch T.1 asked a fresh session to plan the tests for
batch 6.1. It found these defects in the [p6-01](p6-01-schema-version-group-ids.md)
page and nearby records — static testing that found defects before any code
exists. They are recorded here, not in the DEF registry, because no code has
them yet. This batch resolves each one on the page, or asks the owner.

1. **The backup envelope is already at version 1.** Batch 3.3 shipped
   `BACKUP_SCHEMA_VERSION = 1` (`app/src/backup.ts` line 47) with groups that
   have no `id`. p6-01 line 39 says "`schemaVersion` becomes 1", and RP-07 §2
   has the same gap. Decide: raise the envelope to 2, or treat a group with no
   `id` as version 0. **Owner question.**
2. **Ids would change on every reload before the first write.** "Nothing written
   on mount" plus ids made in memory means `#/group/<id>` breaks after a reload,
   while `#/group/1` survives today. **Owner question.**
3. **The snapshot scope is unclear:** p6-01 says one `<key>.pre-v1.<epoch>`
   snapshot; RP-07 rule 3 says snapshot all keys. **Owner question.**
4. **Cases with no stated behaviour:** a version key that cannot be read; version
   1 with a group that has no `id`; a rollback to a build from before 6.1, whose
   `validateGroups` drops `id`. **Owner question.**
5. **Read-only mode and "storage unchanged" conflict:** a backup export writes
   `groupLessonPlannerLastBackup`, and a failed read writes a `.corrupt.backup`
   key. Is export allowed in read-only mode? **Owner question.**
6. **Two places create groups and are not on the page:** the add flow
   (`App.tsx` `saveDraft`) and `deserializeCsv`. CSV has no `id` column, so a
   CSV round trip changes every id.
7. **The dependencies disagree:** the hub row says 6.1 depends on 5.4 and T.10;
   p6-01 line 61 says 5.4 only.
8. **Comments and headings that point to the wrong phase:** `app/src/route.ts`
   line 14 and `app/src/types.ts` line 5 say "Phase 4" (it is Phase 6);
   storage-data-contract.md line 10, "The three keys (do not rename, do not
   reshape)", while 6.1 reshapes groups.
9. **`e2e/features/testid-contract.spec.ts` line 20 says "The 8 frozen"** above a
   list of 7.

## Tasks

- [ ] Rewrite `p6-01` to `p6-05` on the template, with full test conditions, techniques and coverage items, because they have not run yet.
- [ ] Fix their stale lines: `p6-02` line 31 ("the session comes from Better Auth"), `p6-04` line 24 and `p6-05` line 18 (`better-auth` at the latest patch).
- [ ] Rewrite `lessons-learned.md` in B2 English and ISTQB terms. **Keep every lesson number**, because other pages cite them.
- [ ] Resolve each review finding above on the page it belongs to, with the owner's answers to the questions; fix the comments and the heading in item 8 and the count in item 9.
- [ ] Out of scope: the research reports RP-01 to RP-10, which are dated research records.

## TDD log

**Exception: docs only**, plus the code comments in review finding 8 and 9,
which change no behaviour.

## Acceptance criteria

- [ ] **Given** batch 6.1's page, **when** a session starts it, **then** the page already lists the test conditions, techniques, coverage items and the red commit to write first.
- [ ] **Given** any page that cites a lesson by number, **when** the reader follows it, **then** the lesson with that number says the same thing.

## Exit criteria

- [ ] The exit criteria in [testing.md §1.6](../../.claude/context/testing.md#16-entry-criteria-and-exit-criteria).

## Merge order and dependencies

Depends on T.1. Phase 6 starts after this batch. Deployable: yes.

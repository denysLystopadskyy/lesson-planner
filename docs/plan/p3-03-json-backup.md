# Batch 3.3 — Versioned JSON backup (closes DEF-005)

Phase 3 · [Plan home](README.md) · Prev: [3.2](p3-02-input-import-sanitation.md) · Next: [3.4a](p3-04a-interaction-defects.md)

## Goal

The teacher gets a backup that can actually restore the app: one file with
everything in it, one click to save, and a way back if she loads the wrong one.

## The gate this batch could not pass as written, and what replaced it

The old acceptance criteria included _"the exported file contains the template
key"_, and DEF-005's pin at `csv-export-contract.spec.ts:107` asserted that the
**CSV** carries it. This batch ships a **JSON** backup and deliberately does not
widen the CSV, so shipping it could never turn that pin green.
[CLAUDE.md](../../CLAUDE.md) requires the choice to be recorded here rather than
worked around, so:

**The pin was retired, not flipped.** The test at that line now asserts the
opposite — that the CSV carries groups and not the template — and carries the
reasoning inline, because a pin that quietly changes sides is worse than one
that stays red. The assertion it used to make lives in
`backup-round-trip.spec.ts`, against the format that does carry all three keys.

**Why not widen the CSV.** A CSV cell cannot tell "no template stored" from "an
empty template", and those are different states here. A file whose job is to
open in a spreadsheet is also the wrong home for a multi-line message with bank
details in it. The two formats keep different jobs: the CSV moves groups into a
spreadsheet, the backup restores the app.

## Tasks

- [x] The envelope from [RP-07](../research/rp07-data-migration-recovery/rp07-data-migration-recovery.md) §2:
      `format`, `schemaVersion`, `exportedAt`, `source.origin`, `counts`,
      `fingerprint`, and `data` holding the three keys under their own names.
- [x] Export writes indented JSON, so the file is readable if the app is gone.
- [x] Import previews both sides, asks, then replaces — never partially.
- [x] A pre-import snapshot to `<key>.pre-import.<epoch>`, and an **Undo** the
      user can see.
- [x] A "Last backup: N days ago" indicator, stale past 14 days.
- [x] Round-trip spec: export → clear all → import → the planner comes back,
      template included.
- [x] Retire the DEF-005 CSV pin, with the reason recorded above and in the spec.

## Decisions recorded

**A fourth storage key.** `groupLessonPlannerLastBackup`, a raw ISO timestamp.
The first key added since the contract was written, so the reasoning is in
[storage-data-contract.md](../../.claude/context/storage-data-contract.md)
rather than here. It is deliberately not written into the backup file: the file
records when it was made, the key records when _this browser_ last saved one,
and restoring an old backup must not convince the app it has a recent one.

**`source.device` is not shipped.** RP-07 §2 specifies a per-device UUID so a
multi-device preview can name the device a file came from. There is one device
and no sync, so there is nothing to name. It arrives with
[6.3](p6-03-remote-persistence.md), along with the concept that gives it meaning.

**RP-07's Layers 1 and 2 are superseded.** That report predates
[RP-10](../research/rp10-service-evaluation/rp10-service-evaluation.md) and
assumes Firestore. Only Layer 3, the JSON envelope, is this batch's scope.

**An empty planner exports without complaint**, unlike the CSV, which refuses.
An empty planner is exactly the state after a mistaken "Clear all data", and the
moment a file is most wanted.

## One layout change, and how it was caught

The indicator was first placed at the end of the toolbar row with
`margin-left: auto`. That put a status message on the far side of the one
destructive control and pushed "Clear All Data" 157px off the right margin — a
geometry assertion in `visual-layout.spec.ts` failed, not a screenshot and not a
reviewer's eye. The indicator now sits at the front of the row and the assertion
passes unchanged, which is the right way round: the check was correct and the
change was not.

Baselines refreshed for all seven screens: macOS locally, Linux through
`baselines.yml`. Two frozen inventories also gained the new buttons —
`smoke.spec.ts`'s reachable-control list and `group-card-keyboard.spec.ts`'s tab
order. Both failed with a readable diff naming exactly the two additions, which
is those guards working.

## Acceptance criteria

- [x] Export → "Clear all data" → import restores the groups **byte-identically**
      and brings the payment template back. The CSV round trip cannot do this,
      and `csv-round-trip.spec.ts` still asserts that it cannot.
- [x] The exported file contains all three keys, is valid JSON, and is readable
      by a person.
- [x] The import preview names counts on **both** sides before anything is
      written, and declining changes nothing.
- [x] An import can be undone, and the undo restores the template too.
- [x] A file that is not a backup, is another app's JSON, is the app's own CSV,
      or claims a newer `schemaVersion` is refused whole and leaves the planner
      untouched.
- [x] The indicator reads "No backup saved yet" before the first export and
      "Last backup: today" after it.
- [x] DEF-005 marked closed in the [registry](def-registry.md).
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0.

## Merge order and dependencies

Depends on [3.1](p3-01-storage-guards.md) — guarded storage first, because the
restore path writes all three keys and needs a refused write to be reported.
Blocks [4.1](p4-01-vercel-project-previews.md): the origin rule in
[deployment.md](../../.claude/context/deployment.md) names this export as the
rehearsed way the origin moves. Deployable: yes.

# Batch 6.3 — Remote persistence in the store

Phase 6 · [Plan home](README.md) · Prev: [6.2](p6-02-documents-api.md) · Next: [6.4](p6-04-recovery-retention-erasure.md)

## Goal

When she is signed in, every change reaches the server, and a wiped browser
gets everything back by signing in. The local write stays the commit; the
server is the replica (RP-05 §7, RP-07 §4).

Design: [state-management.md](../../.claude/context/state-management.md),
[storage-data-contract.md](../../.claude/context/storage-data-contract.md).

## Tasks (TDD)

- [ ] The store gets a second directive, `remote`, with its own actions
      (`remote/hydrated`, `remote/flushed`, `remote/failed`). The compiler
      lists the switches to extend. The existing `pending` flush is unchanged.
- [ ] On sign-in (and on load when already signed in): compare both sides.
      Server empty and local has data → push (this is the one-time upload).
      Local empty and server has data → pull. Both have data and differ →
      **a human picks**: a dialog that shows both sides' counts and dates
      (RP-07 §3). Never merge automatically.
- [ ] After each local flush, a debounced (1–2 s) `PUT` of the changed
      document(s) with `baseUpdatedAt`. A 409 opens the same both-sides dialog.
- [ ] The indicator, with RP-07 §4's states: "Saved on this device only" /
      "Saving…" / "Backed up HH:MM" / "Not backed up for N days" (3) / "Backup
      is not working — tell the developer" (14). It advances only after the
      server answered — never on the local write.
- [ ] Offline: silent. Retry on the `online` event, and a boot-time compare
      (RP-09 AC 20). No modal.
- [ ] Sync metadata (`lastSyncedAt`, per-key `baseUpdatedAt`) lives in a fifth
      key, `groupLessonPlannerSync`. The three data keys stay byte-identical to
      today; the golden-shape spec proves it.
- [ ] Check migration trigger 2 in state-management.md honestly: did this
      batch need middleware? Record the answer and, if yes, open the Redux
      Toolkit batch.
- [ ] e2e against the local API (PGlite): the `signedIn` fixture plus a seeded
      server state. Specs: wiped profile restores by signing in (AC 18);
      `context.setOffline(true)` → the indicator does not advance (AC 19); a
      conflicting server copy → the dialog names both sides.

## Acceptance criteria

- RP-09 acceptance criteria 18, 19 and 20 are green specs.
- Golden-shape spec unchanged and green; only the fifth key is new.
- Full suite exit 0 at `--repeat-each=3`; no network-dependent assertion
  relies on a retry to pass ([lessons learned](lessons-learned.md), 21).

## Merge order and dependencies

Depends on 6.2. Deployable: yes — signed-out users see no change.

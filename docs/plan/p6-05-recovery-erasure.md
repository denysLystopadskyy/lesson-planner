# Batch 6.5 — Recovery drills and erasure

Phase 6 · [Plan home](README.md) · Prev: [6.3](p6-03-move-local-data.md) · Next: [6.6](p6-06-security-closeout.md)

**Planned in batch 6.0 on 2026-11-16. Not started.** The session that runs it
fills in the TDD log and the results. This is the old batch 6.4, re-pointed at
server-first.

## Goal

The teacher can delete her account and all her data from the account view, and
the recovery paths have each been practised once on test data, with the date and
the result recorded.

## Test basis

- The plan section "Batch 6.5" in
  [the Phase 6 plan](../superpowers/plans/2026-11-15-phase-6-server-first.md).
- RP-07 §6 (recovery procedures) and RP-09 (acceptance criteria 18 and 21).
- [backend.md](../../.claude/context/backend.md) (the documents API, the
  `document_versions` table, the SQL runbook it will hold).
- [security-auth.md](../../.claude/context/security-auth.md) (erasure and the
  `TBD` on retention).
- The API from [6.1](p6-01-documents-api.md) and the move from
  [6.3](p6-03-move-local-data.md).

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                                              |
| ---- | ---------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------- |
| R6   | 2–3        | 3      | 6–9 high   | The erase route must delete only the caller's rows: isolation cells of the CRUD matrix, a fault seeding table. |
| R3   | 2–3        | 3      | 6–9 high   | The drills prove each recovery path works before she depends on it.                                            |

## Entry criteria

- [ ] Batches [6.2](p6-02-remote-store.md) and [6.3](p6-03-move-local-data.md)
      are merged.
- [ ] The test basis above is written down (it is).
- [ ] This batch can pass its own exit criteria with only what it ships. The
      method to delete a Neon Auth user is checked in Neon's docs first; if the
      SDK has none, the owner deletes the user with `delete_auth_user` (an MCP
      write, with the owner's yes in chat), and the page records that.

## Test conditions

| ID  | Test condition                        | Test level            | Test type                       | Technique      | Coverage items                                                                                        | File                                   |
| --- | ------------------------------------- | --------------------- | ------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| C1  | `DELETE /api/documents`               | component integration | functional, black-box, security | CRUD           | the delete cells: documents and versions of `sub` are removed; no token → 401; not allowlisted → 403  | `api/documents.test.ts`                |
| C2  | Erasure isolation                     | component integration | functional, black-box, security | CRUD           | user B's delete leaves user A's rows untouched                                                        | `api/documents.test.ts`                |
| C3  | Delete my account and data            | system                | functional, black-box           | scenario-based | confirmation names what goes; after confirm the account holds no documents and the user is signed out | `e2e/features/account-erasure.spec.ts` |
| C4  | Drill A: sign in on a wiped profile   | system (by a person)  | functional, acceptance          | scenario-based | a browser with no data signs in and the groups appear                                                 | this page, Results                     |
| C5  | Drill B: JSON import into the account | system (by a person)  | functional, acceptance          | scenario-based | **Load Backup** into the account; counts match                                                        | this page, Results                     |
| C6  | Drill C1: restore from a version      | system (by a person)  | functional, acceptance          | scenario-based | restore one `document_versions` row by the developer SQL runbook in backend.md                        | this page, Results                     |
| C7  | Drill C2: Neon restore window         | system (by a person)  | functional, acceptance          | scenario-based | restore a branch within the 6-hour window on test data                                                | this page, Results                     |
| C8  | Drill: erasure                        | system (by a person)  | functional, acceptance          | scenario-based | run the erasure on a test account; nothing is left                                                    | this page, Results                     |

Design: **Delete my account and data** on the account view, behind a
confirmation that names what goes. `DELETE /api/documents` removes the documents
and versions rows for `sub`; the Neon Auth user is then deleted through the
client SDK. Retention stays `TBD` with its owner (the accountant, through the
owner). Neon's 90-day inactivity question goes to the owner. The drills run on
test data and each is recorded with its date and result.

## Tasks

- [ ] Load the skills named in CLAUDE.md. If the ISTQB skills are not
      installed, say so here and follow testing.md Part 1.
- [ ] Check in Neon's docs whether `@neondatabase/auth` can delete a user. Record
      the answer.
- [ ] Red: the erasure route tests (C1, C2) and `account-erasure.spec.ts` (C3).
      Commit `Red: …`.
- [ ] Green: the route, the account-view control, the confirmation. Commit
      `Green: …`.
- [ ] Write the developer SQL runbook for restoring from `document_versions` in
      backend.md.
- [ ] Run the drills on test data; record date and result for each.
- [ ] Record the retention question and its owner in security-auth.md, and put
      Neon's 90-day question to the owner.
- [ ] Open the pull request. The orchestrating session merges it on green CI
      after a review at `claude-opus-5-5` high: erasure must not cross
      accounts.

## TDD log

| Step     | Commit | Command | Result                             |
| -------- | ------ | ------- | ---------------------------------- |
| Red      |        |         | _fails with: <one to three lines>_ |
| Green    |        |         | _passes_                           |
| Refactor |        |         | _optional; passes_                 |

## Acceptance criteria

- [ ] **Given** a signed-in teacher, **when** she chooses **Delete my account and
      data** and confirms, **then** her documents and versions are gone and she
      is signed out.
- [ ] **Given** two accounts, **when** one is erased, **then** the other keeps
      all its data.
- [ ] **Given** a lost browser profile, **when** she signs in again, **then** her
      planner returns (drill A).
- [ ] **Given** a damaged document, **when** the maintainer follows the runbook,
      **then** the previous version is restored (drill C1).

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _N / N_.
- [ ] The TDD log is complete.
- [ ] Every drill is recorded with a date and a result.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.

## Confirmation and regression testing

Impact analysis: the account view changes, so its specs and the pixel baselines
run again. `api/documents.test.ts` gains cells but its existing cells must stay
green.

## Fault seeding

High risk (R6), so required.

| Defect put in on purpose                  | Result |
| ----------------------------------------- | ------ |
| Drop `WHERE user_id = …` from the delete  |        |
| Delete the documents but not the versions |        |

## Results

_Filled in by the session that runs this batch: the drill table, each with a date
and a result._

## Merge order and dependencies

Depends on [6.3](p6-03-move-local-data.md). Deployable: yes.

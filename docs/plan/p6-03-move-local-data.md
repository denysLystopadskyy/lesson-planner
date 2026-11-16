# Batch 6.3 — Move local data into the account, then clean localStorage

Phase 6 · [Plan home](README.md) · Prev: [6.2](p6-02-remote-store.md) · Next: [6.5](p6-05-recovery-erasure.md)

**Planned in batch 6.0 on 2026-11-16. Not started.** The session that runs it
fills in the TDD log and the results.

## Goal

When she signs in, any planner data in this browser is uploaded once, read back
and compared, and only then removed from `localStorage`. Remote-mode import
works and its undo works on an empty planner. A signed-out visitor with no local
data sees only a sign-in screen.

## Test basis

- The plan section "Batch 6.3" in
  [the Phase 6 plan](../superpowers/plans/2026-11-15-phase-6-server-first.md),
  with its Interfaces block, its "Regression cost" list and "Review focus"
  items 4 and 5.
- [storage-data-contract.md](../../.claude/context/storage-data-contract.md),
  section "Decided on 2026-11-15" (the move, the clean-up list, the three start
  modes).
- [state-management.md](../../.claude/context/state-management.md) (the start
  decision, the gate).
- [testing.md §1.8](../../.claude/context/testing.md#18-product-risks): risk R8.
- The defects [DEF-029 and DEF-030](def-registry.md).
- `fingerprintOf` and `countsLine` in `app/src/backup.ts`; the API from
  [6.1](p6-01-documents-api.md); the remote store from
  [6.2](p6-02-remote-store.md).

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                                        |
| ---- | ---------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| R8   | 2–3        | 3      | 6–9 high   | 3-value BVA where numbers matter, all transitions, a fault seeding table, a person checks on production. |
| R3   | 2–3        | 3      | 6–9 high   | Import in remote mode replaces the account's planner only after a confirmation; undo restores it.        |
| R4   | 2–3        | 3      | 6–9 high   | An upload that stops halfway keeps the local copy (Review focus 4).                                      |
| R7   | TBD        | TBD    | TBD        | A new screen and dialog; empty-start pixel baselines are re-rendered.                                    |

## Entry criteria

- [ ] Batch [6.2](p6-02-remote-store.md) is merged.
- [ ] The test basis above is written down (it is).
- [ ] This batch can pass its own exit criteria with only what it ships. The
      regression cost below is **taken in this batch**, not left to a later one.

## Test conditions

| ID  | Test condition               | Test level         | Test type             | Technique                         | Coverage items                                                                                                    | File                                                                |
| --- | ---------------------------- | ------------------ | --------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| C1  | `decideStart`                | component          | functional, white-box | decision table                    | local empty/non-empty × server empty/non-empty × equal/different (5 feasible rules)                               | `app/src/migration.test.ts`                                         |
| C2  | `clearLocalPlannerData`      | component          | functional, white-box | equivalence partitioning          | each planner key class removed; a foreign key kept; prefixed staging keys handled                                 | `app/src/storage.test.ts`                                           |
| C3  | Upload happy path            | system             | functional, black-box | scenario-based                    | dialog → move → server holds the data → localStorage holds no planner key                                         | `e2e/features/move-local-data.spec.ts`                              |
| C4  | Clear only after verify (R8) | system + component | functional, black-box | error guessing + fault seeding    | PUT fails; GET read-back differs; template PUT fails after data PUT → local untouched, message shown              | `e2e/features/move-local-data.spec.ts`, `app/src/migration.test.ts` |
| C5  | Both sides have data         | system             | functional, black-box | scenario-based                    | both choices; backup download offered first                                                                       | `e2e/features/move-local-data.spec.ts`                              |
| C6  | Import in remote mode        | system             | functional, black-box | scenario-based                    | JSON and CSV import go to the server; undo restores, on an empty and a non-empty planner                          | `e2e/features/remote-import.spec.ts`                                |
| C7  | Teacher's cutover path       | system             | functional, black-box | scenario-based                    | signed in, empty account, Load Backup file → server holds her counts (the 4.3 steps as a spec)                    | `e2e/features/remote-import.spec.ts`                                |
| C8  | `startMode`                  | component          | functional, white-box | decision table                    | the 5 rules below, plus pending with local data                                                                   | `app/src/start-mode.test.ts`                                        |
| C9  | Sign-in screen               | system             | functional, black-box | state transition, all transitions | signed out + empty → screen; sign in → remote; sign out → screen; signed out + local data → local mode, no screen | `e2e/features/sign-in-screen.spec.ts`                               |

### The start decision, before anything renders

`app/src/start-mode.ts` (pure):
`startMode({authAvailable, signedIn, isPending, localIsEmpty}): "local" | "sign-in" | "loading" | "remote"`.

- No auth URL → `local`.
- Session still pending → `loading`.
- Signed in → `remote`, through `RemoteGate`, which then runs `decideStart`.
- Signed out, local data present → `local`.
- Signed out, no local data → `sign-in`.

`SignInScreen` (`data-testid="sign-in-screen"`, a **new testid**, added to
`testid-contract.spec.ts` and testing.md §2.2 in the same commit) shows the app
name, one line ("Sign in to open your planner") and **Sign in with Google**.

### Interfaces

- `migration.ts`:
  - `type LocalSnapshot = LoadedData & {isEmpty: boolean}`. Empty means no groups **and** a null template.
  - `decideStart(local, server): "use-server" | "upload" | "choose" | "clear-local"`. `clear-local` is for both sides equal by `fingerprintOf`.
  - `uploadAndVerify(local, getToken): Promise<{ok: true} | {ok: false; error: string}>` PUTs all three documents, GETs them back and compares `fingerprintOf` with the local data. It clears nothing.
- `storage.ts`: `clearLocalPlannerData(): WriteResult` removes the keys listed in the storage contract and nothing else; `readLocalSnapshot(): LocalSnapshot`.
- `MoveDataDialog`: **upload** shows the counts from `countsLine`, with **Move to my account** and **Download a backup first**. **choose** shows both sides' counts, with **Keep my account's data** and **Replace with this browser's data**, each with a backup link first.
- Remote-mode import: **Load Backup** and **Load CSV** confirm "This replaces the planner in your account". Undo keeps the previous state **in memory** for the session, not in `localStorage`. This fixes DEF-029 in remote mode and removes DEF-030's cause there. Local mode is unchanged.

Files: create `app/src/migration.ts`, `MoveDataDialog.tsx`, `SignInScreen.tsx`
(with a CSS module) and `start-mode.ts`. Modify `app/src/storage.ts`,
`RemoteGate.tsx` and `App.tsx` (import, CSV import and Clear All in remote
mode).

### Regression cost, taken in this batch (impact analysis)

The serve build has an auth URL, so every signed-out spec that starts with an
empty planner now meets the sign-in screen.

- The fixture changes: when `signedIn` is true, `plannerState` seeds the
  **server** through the minted token, not `localStorage`.
- Specs that start empty switch to `signedIn: true`.
- Specs about the local contract keep a seeded `localStorage`, so they still run
  in local mode: `storage-contract`, `storage-guards`, `backup-round-trip`, the
  CSV specs and `moved-banner`.
- The pixel baselines that start empty are re-rendered through
  `baselines.yml`.
- **The session lists each spec that changes under Results.**

## Tasks

- [ ] Load the skills named in CLAUDE.md. If the ISTQB skills are not
      installed, say so here and follow testing.md Part 1.
- [ ] Red: the unit tests and e2e specs above, with stubs. Commit `Red: …`.
- [ ] Green: implement. Commit `Green: …`.
- [ ] Fault seeding: see the table below.
- [ ] Add the testid `sign-in-screen` to `testid-contract.spec.ts` and testing.md
      §2.2 in the same commit.
- [ ] Update the DEF-029 and DEF-030 rows in [def-registry.md](def-registry.md):
      "fixed in remote mode in 6.3; local mode retires with Pages in 4.4".
      Confirmation tests lose `test.fixme` where they exist.
- [ ] Re-render the pixel baselines that start empty with the `baselines.yml`
      workflow (manual dispatch), then commit them.
- [ ] Open the pull request. The orchestrating session merges it on green CI.

## TDD log

| Step     | Commit | Command | Result                             |
| -------- | ------ | ------- | ---------------------------------- |
| Red      |        |         | _fails with: <one to three lines>_ |
| Green    |        |         | _passes_                           |
| Refactor |        |         | _optional; passes_                 |

## Acceptance criteria

- [ ] **Given** local data and an empty account, **when** she signs in and
      chooses **Move to my account**, **then** the server holds her data and
      `localStorage` holds no planner key.
- [ ] **Given** any step of the upload fails, **when** the move runs, **then**
      the local data is untouched and a message says so.
- [ ] **Given** both sides hold different data, **when** she signs in, **then**
      she chooses which side to keep, with a backup link first.
- [ ] **Given** an empty account, **when** she loads a backup file, **then** the
      server holds the file's groups, and **Undo** works on the empty planner.
- [ ] **Given** she is signed out with no local data and sign-in is available,
      **when** the app opens, **then** she sees only the sign-in screen.
- [ ] **Given** the GitHub Pages build, **when** the app opens, **then** it is
      unchanged.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _N / N_.
- [ ] The TDD log is complete.
- [ ] The affected specs are listed under Results.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.
- [ ] Locally, `move-local-data`, `remote-save`, `remote-load` and
      `remote-import` are green at `--repeat-each=3`.

## Confirmation and regression testing

- Confirmation: DEF-029 and DEF-030 in remote mode (C6, C2). Local mode keeps
  both defects until Pages retires in 4.4.
- Regression: the whole e2e suite, especially the specs named above and the
  pixel baselines. Stop any `npm run serve` before the suite.

## Fault seeding

High risk (R8), so required.

| Defect put in on purpose           | Result |
| ---------------------------------- | ------ |
| Clear `localStorage` before verify |        |
| Compare only the group count       |        |
| Skip the template in the read-back |        |

## Results

_Filled in by the session that runs this batch. After merge, a person checks on
production: a real Google sign-in, one move, and the DevTools Application tab
shows no planner key. Record the date._

## Merge order and dependencies

Depends on [6.2](p6-02-remote-store.md). Deployable: yes — the Pages build has
no auth URL and stays in local mode.

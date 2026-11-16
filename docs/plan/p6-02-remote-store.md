# Batch 6.2 — Remote mode in the store

Phase 6 · [Plan home](README.md) · Prev: [6.1](p6-01-documents-api.md) · Next: [6.3](p6-03-move-local-data.md)

**Planned in batch 6.0 on 2026-11-16. Not started.** The session that runs it
fills in the TDD log and the results.

## Goal

When the teacher is signed in, the app loads her planner from the API before the
first paint, saves each change to the API, and writes no planner key to
`localStorage`. A failed save keeps the edit and retries. Signed out, the app
works exactly as it does today.

## Test basis

- The plan section "Batch 6.2" in
  [the Phase 6 plan](../superpowers/plans/2026-11-15-phase-6-server-first.md),
  with its Interfaces block, and its "Review focus" items 1 to 3 and 5.
- [state-management.md](../../.claude/context/state-management.md), section
  "Decided on 2026-11-15" (the gate, the save rules, the `sync` state).
- [storage-data-contract.md](../../.claude/context/storage-data-contract.md)
  (remote mode writes no planner key; conflicts).
- The API from [6.1](p6-01-documents-api.md).
- RP-09 acceptance criteria 18 (a wiped profile restores by signing in) and 19
  (the indicator does not advance offline).
- The owner's answer of 2026-11-15: a failed save keeps the edit and retries,
  and closing the tab warns.

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                              |
| ---- | ---------- | ------ | ---------- | ---------------------------------------------------------------------------------------------- |
| R4   | 2–3        | 3      | 6–9 high   | All transitions of the sync state machine, 3-value BVA on retry delays, a fault seeding table. |
| R3   | 2–3        | 3      | 6–9 high   | A 409 never loses an edit silently; the conflict dialog names both sides.                      |
| R7   | TBD        | TBD    | TBD        | A new indicator and dialogs change the layout; the pixel and accessibility specs run again.    |

## Entry criteria

- [ ] Batch [6.1](p6-01-documents-api.md) is merged, and its tables exist on
      Neon `production`.
- [ ] The test basis above is written down (it is).
- [ ] This batch can pass its own exit criteria with only what it ships: the
      local server mints test tokens (from 6.1), so no spec needs a real
      sign-in.

## Test conditions

| ID  | Test condition                                       | Test level          | Test type              | Technique                         | Coverage items                                                                                | File                                  |
| --- | ---------------------------------------------------- | ------------------- | ---------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| C1  | `retryDelayMs`                                       | component           | functional, white-box  | 3-value BVA                       | attempts 0, 1, 3, 4, 5, 100 → 1000, 2000, 5000, 10000, then 30000                             | `app/src/remote-sync.test.ts`         |
| C2  | `changedKeys`                                        | component           | functional, white-box  | decision table                    | none, one, all three changed; template null ↔ string                                          | `app/src/remote-sync.test.ts`         |
| C3  | Sync status machine                                  | component (reducer) | functional, white-box  | state transition, all transitions | off→saving→saved, saving→retrying→saving, saving→conflict→resolved, plus invalid ones ignored | `app/src/store.test.ts`               |
| C4  | A wiped profile restores by signing in (RP-09 AC 18) | system              | functional, black-box  | scenario-based                    | server seeded, local empty → groups shown                                                     | `e2e/features/remote-load.spec.ts`    |
| C5  | Remote mode never writes localStorage                | system              | functional, black-box  | checklist                         | after an add, an edit, a template save and Clear All → no planner key                         | `e2e/features/remote-save.spec.ts`    |
| C6  | Offline keeps the edit (AC 19)                       | system              | functional, black-box  | state transition                  | `setOffline(true)` → "Not saved — retrying", no advance; online → "Saved"                     | `e2e/features/remote-save.spec.ts`    |
| C7  | Review focus 1–3                                     | system              | functional, black-box  | error guessing                    | 401 then success; 409 dialog; `beforeunload` dialog fires                                     | `e2e/features/remote-save.spec.ts`    |
| C8  | Signed out is unchanged                              | system              | functional, regression | regression                        | the full existing suite, signed out                                                           | the existing `e2e/features/*.spec.ts` |

Interfaces this batch produces (from the plan; later batches rely on them):

- `auth-client.ts`: `getAccessToken(): Promise<string | null>` — `client.getSession()` → `data?.session.token ?? null`.
- `documents-api.ts`: `fetchDocuments(token)`, `putDocument(token, key, body, baseUpdatedAt): Promise<{kind: "saved"; updatedAt} | {kind: "conflict"; document}>`; other failures throw `ApiError {status}`; `type RemoteDocument = {body: unknown; schemaVersion: number; updatedAt: string}`; `type ServerDocuments = Record<DocumentKey, RemoteDocument | null>`.
- `remote-sync.ts` (pure): `documentsOf(state)`, `changedKeys(current, lastSaved)` (compares serialized strings), `retryDelayMs(attempt)`, `loadedFromServer(docs)`.
- `store.ts`: `PlannerState.sync: {status: "off" | "saving" | "saved" | "retrying" | "conflict"; savedAt: string | null; conflict: {key; document} | null}`; actions `remote/saving`, `remote/saved {at}`, `remote/failed`, `remote/conflict {key, document}`, `remote/resolved`. `pendingReducer` stays exhaustive.
- `StoreProvider` takes `persistence: {kind: "local"} | {kind: "remote"; getToken; initial: ServerDocuments}`. Local is today's subscriber, unchanged. Remote writes no `localStorage`; a 1 s debounce sends `changedKeys`; it retries with `retryDelayMs` and on the `online` event; a `beforeunload` guard is on while the status is not `saved` or `off`, or a debounce is pending; a 401 gets one fresh token and one retry, then `retrying` plus the sign-in prompt.
- `RemoteGate`: signed in, it shows "Loading your planner…" until `fetchDocuments` answers, then mounts `StoreProvider` in remote mode. If loading fails it shows an error with **Try again**. In 6.2 it takes the server data as it is; the local-data decision arrives in [6.3](p6-03-move-local-data.md).
- `SyncIndicator` (`#syncIndicator`): "Saving…", "Saved HH:MM", "Not saved — retrying", "Changed on another device". Remote mode only. The "Last backup" indicator is hidden in remote mode.
- `ConflictDialog`: names both sides (counts and time), with **Keep this screen** (PUT with the server's `updatedAt` as base) or **Use the saved version** (`backup/restore` from the server copy).

Files: create `app/src/documents-api.ts`, `remote-sync.ts`, `RemoteGate.tsx`,
`SyncIndicator.tsx` (with a CSS module) and `ConflictDialog.tsx`. Modify
`auth-client.ts`, `store.ts`, `StoreProvider.tsx`, `main.tsx`, `App.tsx`,
`AccountView.tsx` (the text "Your planner is saved in your account"), and
`route.ts` and `types.ts` (their stale "Phase 4" comments, T.10 item 8).
Fixtures: `e2e/ui/support/sign-in.ts` (`stubSession` returns `session.token`
from `mintToken`) and `e2e/ui/fixtures/test.ts` (a new option `serverState`,
seeded through the API).

## Tasks

- [ ] Load the skills named in CLAUDE.md. If the ISTQB skills are not
      installed, say so here and follow testing.md Part 1.
- [ ] Red: unit tests and e2e specs, with stubs for the new modules that throw
      "not implemented". Log the command, for example
      `npm run test:unit -- app/src/remote-sync.test.ts`. Commit `Red: …`.
- [ ] Green: implement. Update `sign-in.spec.ts` for the remote empty state
      (regression). Commit `Green: …`.
- [ ] Fix the two stale "Phase 4" comments in `route.ts` and `types.ts` in this
      batch's red-green cycle (T.10 item 8): they say Phase 4, and the work is
      Phase 6.
- [ ] Record in state-management.md whether trigger 2 fired (does the store
      need middleware?). The expected answer is no.
- [ ] Fault seeding: see the table below.
- [ ] Open the pull request. The orchestrating session merges it on green CI.

## TDD log

| Step     | Commit | Command | Result                             |
| -------- | ------ | ------- | ---------------------------------- |
| Red      |        |         | _fails with: <one to three lines>_ |
| Green    |        |         | _passes_                           |
| Refactor |        |         | _optional; passes_                 |

## Acceptance criteria

- [ ] **Given** a signed-in teacher with data on the server, **when** the app
      opens on a browser with no local data, **then** her groups appear.
- [ ] **Given** remote mode, **when** she adds a group, edits a price, saves the
      template or clears all data, **then** no planner key exists in
      `localStorage`.
- [ ] **Given** she is offline, **when** she edits, **then** the indicator says
      "Not saved — retrying" and keeps the edit; **when** the network returns,
      **then** it says "Saved".
- [ ] **Given** the token expires, **when** she saves, **then** the app gets a
      new token once and the save goes through; if that fails, the edit stays
      and the app asks her to sign in.
- [ ] **Given** the same planner changed on another device, **when** she saves,
      **then** a dialog names both sides and nothing is lost silently.
- [ ] **Given** unsaved changes, **when** she closes the tab, **then** the
      browser warns her.
- [ ] **Given** she is signed out, **when** she uses the app, **then** it behaves
      exactly as before.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _N / N_.
- [ ] The TDD log is complete.
- [ ] The answer on state-management.md trigger 2 is recorded.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.

## Confirmation and regression testing

Impact analysis: `store.ts` and `StoreProvider.tsx` serve every screen, so the
whole suite runs again (C8). The signed-out specs, the storage-contract specs
and the pixel baselines must be unchanged. The serve build has an auth URL, so
a signed-out spec that starts with an empty planner meets the sign-in screen
only from [6.3](p6-03-move-local-data.md), not in this batch.

## Fault seeding

High risk (R4), so required.

| Defect put in on purpose                         | Result |
| ------------------------------------------------ | ------ |
| The indicator advances before the server answers |        |
| The debounce never flushes                       |        |
| The 401 retry loops forever                      |        |

## Results

_Filled in by the session that runs this batch._

## Merge order and dependencies

Depends on [6.1](p6-01-documents-api.md). Deployable: yes — the GitHub Pages
build has no auth URL and stays in local mode, and on Vercel she signs in only
at cutover.

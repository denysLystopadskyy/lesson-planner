# Batch 6.2 — Remote mode in the store

Phase 6 · [Plan home](README.md) · Prev: [6.1](p6-01-documents-api.md) · Next: [6.3](p6-03-move-local-data.md)

**Planned in batch 6.0 on 2026-11-16. Built on 2026-11-16** (Red `dcdaf5f`,
Green `2c8c0e6`, Refactor `74151b2`). The pull request is open; the
orchestrating session merges it on green CI.

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

R7 in this batch: the sync indicator takes the backup indicator's place, with
the same size and colour, in remote mode only. Every pixel baseline is a
signed-out screen, so none changes. The conflict dialog uses the shared
`Dialog` shell and the existing `.modal` and `.dialog-actions` classes; it has
no pixel baseline and no accessibility scan of its own yet.

## Entry criteria

- [x] Batch [6.1](p6-01-documents-api.md) is merged (PR #90, `a2ee808`), and
      its tables exist on Neon `production` (operation recorded on the 6.1
      page).
- [x] The test basis above is written down (it is).
- [x] This batch can pass its own exit criteria with only what it ships: the
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

### Interfaces as built (2026-11-16)

The interfaces above hold. These are the additions, each for a reason the
plan did not foresee:

- **The token method.** `@neondatabase/auth` 0.5.0-beta has **both**
  `getSession()` → `data.session.token` and `token()` → `data.token`. The app
  uses **`getSession()` → `data.session.token`**, as planned: the package's
  fetch hook files every URL containing `/token` under `getSession` and
  answers it from the cached session, so `token()` can return a session
  object, not `{token}`. The package's own `getJWTToken` reads
  `session.token` too. Details in
  [security-auth.md](../../.claude/context/security-auth.md), "Built in batch
  6.2".
- `getAccessToken(options?: {fresh?: boolean})`. `fresh` skips the client's
  session cache (`X-Force-Fetch: true`), because the cache keeps a token until
  just before it expires, so "one fresh token" needs a way past it. It throws
  when the auth server cannot answer, and returns `null` only for "no
  session".
- `documents-api.ts` also exports `withToken(getToken, call)` (the one fresh
  token and one retry, shared by the gate and the store), `isRetryable`,
  `DOCUMENT_KEYS`, `SCHEMA_VERSION` and `type GetToken`. The conflict's
  `document` is `RemoteDocument | null`: the 6.1 API answers `409
{document: null}` when a base is named and the row is gone.
- `remote-sync.ts` also exports `savedAtOf(docs)`, the newest `updatedAt`, so
  the indicator can say "Saved HH:MM" before the first save.
- `store.ts`: `sync` has a fourth field, `problem: {kind: "network"} |
{kind: "sign-in"} | {kind: "refused"; message} | null`, and
  `remote/failed` carries it. `initialState(loaded, savedAt = null)`.
- `StoreProvider.tsx` also exports `useSync()`, `useRemoteControls()` (null in
  local mode) and the `Persistence` and `RemoteControls` types.
- `storage.ts` (not in the plan's list) exports `groupsFromValue` and
  `settingsFromValue`, the local loaders' checks for a value that did not come
  from `localStorage`, so a server body is mended and reported the same way.
- `Toolbar.tsx`: one optional prop, `syncIndicator`, shown in the backup
  indicator's place. Kept small because PR #89 (batch 6.4) also changes this
  file.
- `SyncIndicator.tsx` also holds `SyncNotice`: the alerts "Sign in to save"
  and "the server refused it".
- e2e: a new support module `e2e/ui/support/server-state.ts` (`seedServer`,
  `readServer`, `putServerDocument`) and a `sessionToken` fixture.

**Behaviour decided here, inside the recorded rules** (each is in a context
file, as the decision rule asks):

- The gate shows "Loading your planner…" **while the session is pending**, as
  the recorded `startMode` rule says (the function arrives in 6.3). On the
  Vercel build a signed-out visitor sees that line for one session request
  before the local planner. The GitHub Pages build has no auth client, so it
  starts in local mode at once.
- Once remote, the page stays remote; her own **Sign out** reloads the page
  (state-management.md).
- A `400`, `403` or `413` is not retried on a timer: the same body would be
  refused again. The edit stays, an alert names the reason, and the next edit
  or the `online` event sends it again.
- "Sign in to save" offers sign-in **in a new tab**, because Google sign-in
  leaves the page and would lose the unsaved edit (security-auth.md).
- In remote mode **Save Backup** writes no `groupLessonPlannerLastBackup`, and
  an import writes no `.pre-import.*` snapshot, so it offers no undo until 6.3
  (storage-data-contract.md).
- The indicator turns to "Saving…" as soon as an edit is pending, not when the
  request leaves (state-management.md). Found by the first full e2e run: the
  loaded "Saved" stayed on screen for the second the edit waited.

Files: create `app/src/documents-api.ts`, `remote-sync.ts`, `RemoteGate.tsx`,
`SyncIndicator.tsx` (with a CSS module) and `ConflictDialog.tsx`. Modify
`auth-client.ts`, `store.ts`, `StoreProvider.tsx`, `main.tsx`, `App.tsx`,
`AccountView.tsx` (the text "Your planner is saved in your account"), and
`route.ts` and `types.ts` (their stale "Phase 4" comments, T.10 item 8).
Fixtures: `e2e/ui/support/sign-in.ts` (`stubSession` returns `session.token`
from `mintToken`) and `e2e/ui/fixtures/test.ts` (a new option `serverState`,
seeded through the API).

## Tasks

- [x] Load the skills named in CLAUDE.md. **Not available in this session:**
      `istqb-foundation:istqb-foundation-level`,
      `istqb-test-design:istqb-advanced-level-test-analyst` and
      `superpowers:test-driven-development` are not installed. The batch
      followed testing.md Part 1 instead (techniques §1.4, TDD §1.5).
- [x] Red: unit tests and e2e specs, with stubs for the new modules that throw
      "not implemented". Commit `Red: …` (`dcdaf5f`).
- [x] Green: implement. Update `sign-in.spec.ts` for the remote empty state
      (regression). Commit `Green: …` (`2c8c0e6`).
- [x] Fix the two stale "Phase 4" comments in `route.ts` and `types.ts` in this
      batch's red-green cycle (T.10 item 8): in the Green commit. Both now name
      the Phase 6 decision (no group ids; the shapes are the server's bodies).
- [x] Record in state-management.md whether trigger 2 fired. **It did not**
      (Results).
- [x] Fault seeding: see the table below.
- [x] Open the pull request. The orchestrating session merges it on green CI.

## TDD log

| Step     | Commit    | Command                                                                                                | Result                                                                                                                                                                                                                                            |
| -------- | --------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red      | `dcdaf5f` | `npm run test:unit -- app/src/remote-sync.test.ts app/src/store.test.ts app/src/documents-api.test.ts` | fails with: `Error: not implemented` — 47 of 90 tests fail: the stubs throw (`remote-sync.ts`, `documents-api.ts`), and the C3 cells fail on assertions such as `expected 'saving' to be 'saved'`, because the stub `syncReducer` changed nothing |
| Green    | `2c8c0e6` | same command                                                                                           | passes: 90 of 90                                                                                                                                                                                                                                  |
| Refactor | `74151b2` | `npx playwright test e2e/features/remote-save.spec.ts`                                                 | passes: 10 of 10. Test code only: the "Saving…" spec now also asserts after the request has left, because fault seeding showed it could not see fault 1 (below)                                                                                   |

At the Red commit the e2e specs failed too, for the stated reason:
`npx playwright test e2e/features/remote-load.spec.ts e2e/features/remote-save.spec.ts`
→ 14 of 14 failed on the missing user interface (for example
`expect(locator).toHaveText(expected) failed` on `#syncIndicator`, and
`element(s) not found` for "Loading your planner…"). The seeding through the
API worked at Red.

**The Green commit also changed test code**, found by the first full e2e run:

- three expectations listed cards in the order they were added, but the app
  sorts cards by name;
- the 401 spec now asserts the exact sequence `PUT`, `get-session`, `PUT`;
- the `page` fixture waits for the app's ready signal (testing.md §2.9);
- one cast in `documents-api.test.ts` for ESLint.

## Acceptance criteria

- [x] **Given** a signed-in teacher with data on the server, **when** the app
      opens on a browser with no local data, **then** her groups appear.
      (`remote-load.spec.ts`, C4)
- [x] **Given** remote mode, **when** she adds a group, edits a price, saves the
      template or clears all data, **then** no planner key exists in
      `localStorage`. (`remote-save.spec.ts`, C5)
- [x] **Given** she is offline, **when** she edits, **then** the indicator says
      "Not saved — retrying" and keeps the edit; **when** the network returns,
      **then** it says "Saved". (C6)
- [x] **Given** the token expires, **when** she saves, **then** the app gets a
      new token once and the save goes through; if that fails, the edit stays
      and the app asks her to sign in. (C7, two specs, and `withToken` in
      `documents-api.test.ts`)
- [x] **Given** the same planner changed on another device, **when** she saves,
      **then** a dialog names both sides and nothing is lost silently. (C7, both
      choices)
- [x] **Given** unsaved changes, **when** she closes the tab, **then** the
      browser warns her. (C7: an unanswered save and a retry warn; a saved
      planner does not)
- [x] **Given** she is signed out, **when** she uses the app, **then** it behaves
      exactly as before. (C8: the existing suite. One visible difference on
      the Vercel build only: "Loading your planner…" while the session request
      is out; see "Interfaces as built".)

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI. _Locally all exit 0
      except the 10 known container anomalies in `test:e2e` (Results); CI on
      the pull request is the judge._
- [x] Coverage: covered coverage items ÷ identified coverage items =
      **25 / 25**. C1 6, C2 4, C3 4, C4 1, C5 4, C6 2, C7 3, C8 1. C3 covers all
      25 cells of its transition table; C1 adds attempt 2 and −1. C8 is
      covered once CI is green.
- [x] The TDD log is complete.
- [x] The answer on state-management.md trigger 2 is recorded: it did not fire.
- [x] Every new anomaly has a DEF row or an explanation on this page. No new
      DEF. The one defect found while building (the indicator kept "Saved"
      during the debounce) was fixed before the Green commit, so it never
      reached `main`.
- [x] Counts: `test:unit` **620** (77 new: 22 in `remote-sync.test.ts`, 23 in
      `documents-api.test.ts`, 32 in `store.test.ts`), `test:e2e` **222** (15
      new: 4 in `remote-load.spec.ts`, 10 in `remote-save.spec.ts`, 1 in
      `sign-in.spec.ts`).

## Confirmation and regression testing

Impact analysis: `store.ts` and `StoreProvider.tsx` serve every screen, so the
whole suite runs again (C8). The signed-out specs, the storage-contract specs
and the pixel baselines must be unchanged. The serve build has an auth URL, so
a signed-out spec that starts with an empty planner meets the sign-in screen
only from [6.3](p6-03-move-local-data.md), not in this batch.

## Fault seeding

High risk (R4), so required.

Each defect was put into one file alone, the unit tests and
`npx playwright test e2e/features/remote-save.spec.ts e2e/features/remote-load.spec.ts e2e/features/sign-in.spec.ts`
(25 tests) were run, and the file was restored with `git checkout`. Nothing
seeded was committed.

| Defect put in on purpose                                                                                           | Result                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The indicator advances before the server answers (`StoreProvider.tsx`: `remote/saved` dispatched before the `PUT`) | Unit: all pass (the reducer is not the defect). e2e: **5 fail** — C6 offline, review focus 5, both conflict specs, "while retrying, closing the tab warns". **The dedicated "Saving…" spec passed**, because the debounce already shows "Saving…"; it was strengthened (Refactor `74151b2`) and then failed with `Received: "Saved 12:00"`. With it, **6 fail**. |
| The debounce never flushes (`StoreProvider.tsx`: the timer never calls `flush`)                                    | e2e: **9 fail** — C5 checklist, "Saving…", C6, both 401 specs, both conflict specs, "while retrying" and "once saved, no warning".                                                                                                                                                                                                                               |
| The 401 retry loops forever (`documents-api.ts`: `withToken` asks for fresh tokens until one works)                | Unit: **1 fails** — "401 twice → throws 401 after exactly one retry, never a loop" (`expected [ false, true, true, true ] to deeply equal [ false, true ]`). e2e: **1 fails** — review focus 5, "Sign in to save" never appears.                                                                                                                                 |

## Results

Run on 2026-11-16 in the batch session's container (Node 24.22.3, npm
11.21.2), at Green `2c8c0e6`, and again at Refactor `74151b2` for the e2e
specs it touches.

| Check                   | Result                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`  | exit 0                                                                                                                                                                               |
| `npm run lint`          | exit 0                                                                                                                                                                               |
| `npm run typecheck`     | exit 0                                                                                                                                                                               |
| `npm run typecheck:app` | exit 0                                                                                                                                                                               |
| `npm run typecheck:api` | exit 0                                                                                                                                                                               |
| `npm run check:pii`     | exit 0                                                                                                                                                                               |
| `npm run test:unit`     | exit 0: 20 files, 620 tests                                                                                                                                                          |
| `npm run test:e2e`      | 212 passed, 10 failed. The 10 are exactly the known container anomalies: 7 in `visual-layout.spec.ts`, and 3 in `backup-round-trip.spec.ts` (lines 159, 185, 221). No other failure. |
| Stability               | `remote-save`, `remote-load` and `sign-in` at `--repeat-each=3`: 75 of 75 passed. `remote-save` at `--repeat-each=2` after the Refactor: 20 of 20.                                   |
| CI                      | _open: the pull request's run._                                                                                                                                                      |

**Trigger 2 (state-management.md): it did not fire.** The remote save loop is
a plain object that React feeds each new state. Each of its decisions reads
the state after the reducer ran, so a subscriber is enough. No action had to
be intercepted, delayed or rewritten, and the queue is "the screen differs
from what the server last took", not a list of actions. Recorded in
state-management.md, "Built in batch 6.2".

**Specs changed for the regression (C8):**

- `sign-in.spec.ts`: the signed-in block seeds the account (`serverState`); the
  account view's text is "Your planner is saved in your account. Signing out
  does not delete it."; "Her groups are untouched by being signed in" became
  "Her groups come from her account"; one new test for the remote empty state.
- `e2e/ui/fixtures/test.ts`: `serverState`, `sessionToken`, and the wait for
  the app's ready signal after `goto`. Without the wait,
  `a11y.spec.ts:222` and `group-card-keyboard.spec.ts:40` pressed Tab before
  the gate had mounted the planner. Neither spec changed.
- `e2e/ui/support/sign-in.ts`: `stubSession` takes the minted token.

**A person checks on production (risk R4 is high):** not yet. Nobody signs in
on production in remote mode until cutover (4.3, after 6.6). The check is: a
real Google sign-in, one edit, the indicator says "Saved", and the DevTools
Application tab shows no planner key. Record the date here.

**Anomaly in the `tdd-evidence` check (found 2026-11-16, no fix in this
batch).** The orchestrating session asked this batch to fill the 6.1 page's
"check after merge" row. `scripts/check-tdd-evidence.mjs` verifies the Red
rows of **every** batch page a pull request changes. The 6.1 page's Red
commits (`437f268`, `7f1783e`) were squash-merged in PR #90, so they are not on
this branch, and the job would fail with "no such commit in this clone" (seen
locally) or "the commit is not on this branch". So the 6.1 edit is **not in
this pull request**; it goes in a docs-only pull request, which the check
passes because no production code changes. The check's rule "a pull request
may also touch older pages" holds only for pages without Red rows.

**Questions for the owner** (none blocks the merge). **Answered on
2026-11-16:** 1 yes, 2 yes; 3 is not critical and becomes a follow-up in
Phase 6.

1. On the Vercel build, a signed-out visitor now sees "Loading your planner…"
   for one session request before the local planner. This follows the
   recorded `startMode` rule ("pending → loading"). Is that acceptable for
   the signed-out case, or should the local planner paint first while the
   session is pending? **Owner, 2026-11-16: acceptable.**
2. "Sign in to save" offers sign-in in a new tab, so the unsaved edit stays in
   this one. Is that the wording and the flow you want? **Owner, 2026-11-16:
   yes.**
3. Should the `tdd-evidence` check skip, or only warn on, the Red rows of a
   page whose batch is already merged? Today any later edit to such a page
   fails the job (anomaly above). This needs a DEF row and a small batch on
   `scripts/check-tdd-evidence.mjs`. **Owner, 2026-11-16: not critical; a
   follow-up in Phase 6.** Until then, a merged page with Red rows is edited
   only in a docs-only pull request.

## Merge order and dependencies

Depends on [6.1](p6-01-documents-api.md). Deployable: yes — the GitHub Pages
build has no auth URL and stays in local mode, and on Vercel she signs in only
at cutover.

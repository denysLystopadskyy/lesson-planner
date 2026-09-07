# Batch 2b.10 — State store (built-in reducer + context)

Phase 2b · [Plan home](README.md) · Prev: [2b.9](p2b-09-hash-routing.md) · Next: [3.1](p3-01-storage-guards.md)

## Goal

Application state moves into one store module built on `useReducer` and React
Context; persistence stays byte-compatible with the three keys. No state
library is added — see the migration triggers in
[state-management.md](../../.claude/context/state-management.md).

## Tasks

- [x] Store module with typed actions and per-domain reducers: `groups`,
      `settings`, `template`.
- [x] One provider at the app root; components read through selector hooks.
- [x] Persistence subscriber writes the three keys through the storage
      adapter. Calendar draft state stays component-local.
- [x] Persistence contract test: a UI mutation leads to storage that
      deep-equals the golden shape (extends batch 1.13 specs).
- [x] Decide the open TBD: template in the main reducer or its own context.
- [x] Confirm the Redux Toolkit migration triggers are recorded in
      [state-management.md](../../.claude/context/state-management.md).

## What shipped

- **`app/src/store.ts`** — `PlannerState`, four actions, three per-domain
  reducers composed into `plannerReducer`, and `initialState`. No React and no
  `localStorage` in the file, so every transition is a unit test.
- **`app/src/StoreProvider.tsx`** — the provider, the persistence effect, and
  the hooks components actually call: `useGroups`, `useSettings`, `useTemplate`,
  `useLoadError`, `usePlannerDispatch`.
- **`useLocalGroups.ts` is gone.** Each `App` handler now reads through a hook
  and dispatches one action.

## The decision the batch owed: the template goes in the main reducer

Recorded in
[state-management.md](../../.claude/context/state-management.md). A second
context would have contradicted "one provider at the app root" and walked
straight into migration trigger 1, which is _"context providers start to nest
painfully"_. Three reducers mirror the three keys, and that is what makes the
subscriber a loop over three writes.

## Persistence is a directive, not a diff

This is the part of the batch with a real trap in it, so it is worth stating.

The subscriber cannot decide what to write by comparing state with storage.
After "Clear all data" the two legitimately disagree — the state is an empty
planner and the keys are **gone** — and a reconciling subscriber would write
them straight back, so a cleared planner would no longer be indistinguishable
from one that was never used. So the reducer says what it wants instead:
`pending` is `write`, `clear` or `none`.

`none` is also its initial value, and that is the load-bearing part. **A
mount-time write would replace a corrupt stored value with an empty planner —
destroying the data the user opened the app to recover.** The corrupt-storage
spec that has guarded DEF-001 since batch 1.13 would not have noticed: it
asserts the alert and a visible button, and both are true either way. So this
batch added the assertion, and then proved it works by making `initialState`
ask for a write and watching the value become `[]`.

Two things the reducer deliberately does **not** do:

- **Clearing keeps `state.template`,** because `clearStoredData` keeps the key
  (DEF-013). State has to agree with storage; dropping it would show the
  default template in the editor until the next reload, which is neither
  today's behaviour nor the fixed one. Batch
  [3.4b](p3-04b-csv-clipboard-defects.md) changes both together.
- **`loadError` survives every action.** A commit over corrupt storage writes
  good data and leaves the banner up for the rest of the session. That is what
  the app did before the store, and changing it is not this batch's call.

## The golden-shape test, and the defect it found

The write-back test from batch 1.13 asserts field by field, which is the wrong
shape of assertion for one specific risk: **a field that should not be there at
all.** The store keeps bookkeeping on its state — `pending`, `loadError` — and
a subscriber that serialised the state object instead of the three slices would
write those into the teacher's data while every existing per-field assertion
still passed. So the new test reads all three keys and compares them with the
fixture it was seeded from, plus the one edit it made.

It failed the first time, and not because of the store: **saving a group's
details sets the app-wide default currency to that group's currency**, whether
or not the select was touched. The fixture's default is PLN and the edited group
is UAH, so the edit flipped it. The legacy app does the same thing one line
after its save, so the port is faithful — the behaviour is old and only the
measurement is new. Registered as **DEF-026**, asserted as current behaviour,
and fixed in [3.4a](p3-04a-interaction-defects.md).

## Also removed: a dead draft

`App` held a `templateDraft` state that was only ever set to `null` —
`TemplateModal` never received a setter — so `templateDraft ?? loadTemplate() ??
DEFAULT_TEMPLATE` always reduced to its second branch. It is gone rather than
ported into the store.

## Acceptance criteria

- [x] Full e2e suite + unit tests exit 0: **231 unit tests** (13 new over the
      reducer and its transition table) and the full Playwright suite at
      `--repeat-each=3`.
- [x] Storage-contract specs pass unchanged — the five existing describes are
      untouched and two new ones were appended, which is how the "extends batch
      1.13" task and the "pass unchanged" criterion are both honoured.
- [x] `package.json` gains no new runtime dependency: its diff against `main` is
      empty.

## Merge order and dependencies

Depends on 2b.9. Closes Phase 2b. Deployable: yes.

# State management

Decisions about application state in the React app. Referenced from
[CLAUDE.md](../../CLAUDE.md).

## Decided

- **Built-in React state: one store module on `useReducer` + Context**
  (user decision, 2026-09-01). The commissioning spec named Redux as an
  example only; after comparing built-ins, Zustand, Jotai, and Redux Toolkit,
  the minimal option won. This also matches the research (RP-02, RP-08),
  which judged the state small enough for React's own tools.
- **Shape:** one store module with typed actions and per-domain reducers for
  `groups`, `settings`, and `template` — mirroring the three storage keys one
  to one (see [storage-data-contract.md](storage-data-contract.md)). One
  provider at the app root.
- **Persistence:** a store subscriber writes the three `localStorage` keys
  through the storage adapter. The written bytes must stay compatible with
  the legacy shapes. The storage contract specs prove this on every batch.
  This layer is the same for any store library — it is the real contract.
- **Draft state stays local.** The calendar edit draft (selected dates,
  temporary overrides) lives in component state, not in the store. Only
  committed data enters the store and storage.
- The store arrives late on purpose: plan batch
  [2b.10](../../docs/plan/p2b-10-state-store.md), after components exist.
- **No state library is added to `package.json`.** This is checkable and is
  the point of the decision.

## Migration triggers to Redux Toolkit

"Migrate when needed" is only useful if "needed" is checkable. Move to Redux
Toolkit when any of these happens:

1. **Plumbing spreads.** A third unrelated part of the app coordinates the
   same state, or context providers start to nest painfully.
2. **Phase 6 sync needs middleware.** The remote persistence of plan batch
   [6.2](../../docs/plan/p6-02-remote-store.md) needs to intercept
   actions (queueing, retries, conflict marks) beyond what a plain subscriber
   can do. Batch 6.2 checks this honestly and records the answer here.
   **Answered on 2026-11-16: it did not fire** (see "Built in batch 6.2").
3. **Debugging misses an action log.** Time-travel or an action history is
   missed in real debugging sessions, more than once.
4. **The model outgrows three domains.** New entities join groups, settings,
   and template.

When a trigger fires, migrate to **Redux Toolkit specifically**, not another
library — the earlier comparison stays valid, and a `useReducer` reducer has
the same `(state, action) => state` shape as an RTK slice reducer, so the
reducers written now port into `createSlice` almost verbatim. The migration
is mechanical, not a rewrite. Record the trigger and the date here when it
happens.

## Settled in batch 2b.10

- **The template lives in the main reducer**, as a third per-domain reducer
  beside `groups` and `settings` (decided 2026-09-07). A second context would
  contradict the "one provider at the app root" decision above, and trigger 1
  below is precisely "context providers start to nest painfully" — adding a
  provider to avoid a reducer case would be walking into the trigger on
  purpose. The three reducers mirror the three keys, which is what makes the
  persistence subscriber a loop over three writes.
- **Persistence is driven by a directive on the state, not by a diff.** The
  reducer sets `pending` to `write`, `clear` or `none`, and the subscriber does
  what it says. A subscriber that compared state with storage would write the
  keys back after "Clear all data", because an empty planner and absent keys
  are a real disagreement. `pending` starts at `none`, which is what stops the
  app writing on mount — a mount-time write over a corrupt stored value
  destroys the data the user opened the app to recover.
- **State and dispatch are two contexts**, so a component that only dispatches
  does not re-render when the data changes. Beyond that the fan-out is plain
  `useContext`: every state consumer re-renders on every change, which is the
  right trade for one screen and a handful of groups. Narrowing it is trigger
  1's business, not a pre-emptive optimisation.

## Decided on 2026-11-15 — server-first remote mode (batch 6.0) — read this first

Owner decisions, confirmed in chat on 2026-11-15 and 2026-11-16. Plan:
[Phase 6 server-first](../../docs/superpowers/plans/2026-11-15-phase-6-server-first.md). The rules in the section after this one
describe the older local-first design. Each is marked **Superseded on
2026-11-15** where it no longer holds.

- **Server-first when signed in.** The store has a persistence mode:
  `local` (today's subscriber, unchanged) or `remote`. The start mode is a pure
  decision, `startMode({authAvailable, signedIn, isPending, localIsEmpty})`,
  with the results `local`, `sign-in`, `loading` and `remote`:
  - no auth URL → `local`;
  - the session is still pending → `loading`;
  - signed in → `remote`;
  - signed out and local data present → `local`;
  - signed out and no local data → `sign-in` (a sign-in screen only).
- **Remote mode loads before the first paint.** A gate (`RemoteGate`) shows
  "Loading your planner…" until the server answers, then mounts the store with
  the server data. This supersedes "hydration is an action, not a gate".
- **Remote mode never writes a planner key to `localStorage`.**
- **Saving.** A one-second debounce sends the changed documents. A failed save
  keeps the edit in memory, shows "Not saved — retrying", retries with growing
  delays and on the `online` event, and a `beforeunload` guard warns on close
  (owner, 2026-11-15). A `401` gets one fresh token and one retry, then the
  sign-in prompt. A `409` opens a dialog; a person chooses.
- **The store state gains `sync`:** `status` is `off`, `saving`, `saved`,
  `retrying` or `conflict`, with `savedAt` and the open conflict. New actions:
  `remote/saving`, `remote/saved`, `remote/failed`, `remote/conflict` and
  `remote/resolved`. `pendingReducer` stays exhaustive.
- **Trigger 2 (middleware) is watched.** Batch 6.2 records here whether it
  fired. The expected answer is no: a debounce effect and a retry timer are
  enough. **It did not fire** (batch 6.2, 2026-11-16; the reason is in "Built
  in batch 6.2" below).
- **The sign-in state is still not in the store.** The store learns only
  whether to run in remote mode.
- **The signed-out app with local data, and the GitHub Pages build, are
  unchanged.**

## Built in batch 6.2 (2026-11-16) — the remote store as it runs

Batch [6.2](../../docs/plan/p6-02-remote-store.md).

- **Trigger 2 did not fire (answer recorded on 2026-11-16).** No middleware
  was needed. The remote save loop in `StoreProvider.tsx` is a plain object
  that React feeds every new state (`observe`) and starts and stops with the
  provider. Every decision it makes — what changed, when to send, when to
  retry, when to warn on close — reads the state **after** the reducer ran,
  which a subscriber sees. Nothing had to intercept, delay or rewrite an
  action before the reducer. The queue is "the screen differs from what the
  server last took" (`changedKeys`), so it needs no list of actions. Redux
  Toolkit stays unadopted.
- **The gate** is `RemoteGate.tsx`, above the provider. It shows "Loading
  your planner…" while the session is pending (the decided `startMode` rule;
  the function itself arrives in 6.3) and while the documents load. It mounts
  a new provider to change mode, so one provider never changes mode.
- **Once remote, the page stays remote.** A session that ends elsewhere does
  not unmount the store, so unsaved edits stay on screen (review focus 5).
  Her own **Sign out** reloads the page without the hash; that is the one way
  back to local mode.
- **`sync` has a fourth field, `problem`** (`network`, `sign-in` or
  `refused`), kept from a failure until a save succeeds. A retry sets
  `saving` again, and the indicator keeps saying "Not saved — retrying" while
  a problem is open, instead of flickering. `remote/failed` carries the
  problem.
- **The status turns to `saving` as soon as an edit is pending**, at the
  start of the debounce, not when the request leaves. Before this, the
  indicator still said the loaded "Saved" for the second the edit waited.
- **Answers count only from `saving`.** `remote/saved`, `remote/failed` and
  `remote/conflict` in any other state are ignored, and nothing but
  `remote/resolved` leaves `conflict`. All 25 cells are in `store.test.ts`.
- **`pending` is set and not read in remote mode.** The local subscriber is
  off there, so `pending` keeps whatever the reducer last set. Only the local
  subscriber reads it.

## Decided on 2026-09-09 — remote persistence (plan Phase 6)

**Superseded on 2026-11-15 where marked below.** The bullets are kept for the
history.

- **Superseded on 2026-11-15 (the action names changed to `remote/saving`, `remote/saved`, `remote/failed`, `remote/conflict`, `remote/resolved`).** Remote persistence is a second directive on the state, `remote`, with its
  own actions** (`remote/hydrated`, `remote/flushed`, `remote/failed`). It
  cannot reuse `pending`: the existing subscriber writes and dispatches
  `storage/flushed` synchronously in one effect body, so by the time a network
  call resolved, `pending` would already be `none`. The exhaustive `switch` in
  `pendingReducer` (no `default`) is what makes the compiler list the work.
- **Superseded on 2026-11-15: remote mode now loads before the first paint, through a gate.** Hydration from the server is an action, not a gate above the root. The
  first paint still comes from `localStorage` through the synchronous
  initializer; `remote/hydrated` arrives later. This keeps the "no write on
  mount" spec true and keeps the app usable offline and signed out.
- **The sign-in state is not in the store.** The session is a cookie read
  through the auth client's hook (plan batch 5.3); the store only learns
  whether to run the remote subscriber.
- **The signed-out app is unchanged.** Every existing behaviour, spec and
  storage byte stays as it is when nobody is signed in.
- **Trigger 2 is watched, not fired.** Batch 6.2 (was 6.3) tries the built-in store
  first: a second effect with a debounce and a retry. If it needs true
  middleware, trigger 2 fires, the Redux Toolkit migration becomes a batch,
  and the date goes here.

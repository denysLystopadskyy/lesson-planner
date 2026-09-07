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
2. **Phase 4 sync needs middleware.** The cloud sync needs to intercept
   actions (queueing, retries, conflict marks) beyond what a plain
   subscriber can do.
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

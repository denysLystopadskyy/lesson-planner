# State management

Decisions about application state in the React app. Referenced from
[CLAUDE.md](../../CLAUDE.md).

## Decided

- **Redux Toolkit** is the state library (commissioning decision, 2026-08-20).
  Plain Redux without Toolkit is not used; Toolkit is the official recommended
  form.
- **Slices:** `groups`, `settings`, `template`. They mirror the three storage
  keys one to one (see
  [storage-data-contract.md](storage-data-contract.md)).
- **Persistence:** a store subscriber writes the three `localStorage` keys.
  The written bytes must stay compatible with the legacy shapes. The storage
  contract specs prove this on every batch.
- **Draft state stays local.** The calendar edit draft (selected dates,
  temporary overrides) lives in component state, not in the store. Only
  committed data enters Redux and storage.
- Redux arrives late on purpose: plan batch 2b.10, after components exist.

## Recorded tension (for honesty, not for re-opening)

The research (RP-02, RP-08) judged the app state small enough for React's own
state tools. Redux Toolkit was chosen anyway: the developer prefers it, and a
single store simplifies the Phase 4 sync work. The decision stands; this note
only records why both views existed.

## TBD

- Whether the template editor needs its own slice or one field in `settings`
  is enough — decide in plan batch 2b.10.

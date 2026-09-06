# Batch 2a.3c — Port slice 3: calendar and overrides

Phase 2a · [Plan home](README.md) · Prev: [2a.3b](p2a-03b-port-groups.md) · Next: [2a.3d](p2a-03d-port-template-message-csv.md)

## Goal

Schedule editing and monthly overrides work in the React app.

## Tasks

- [x] Port the calendar editor (date toggling, weekday select, month
      navigation, bulk price, Done/Cancel) and the override rows with their
      totals. Draft-vs-committed behaviour kept exactly as today.
- [x] Green the calendar and override behaviour against `/next/`.
- [x] Keep the pinned defects pinned: the port reproduces current behaviour.

## What landed

`schedule.ts` holds the arithmetic as **pure functions** — commit, weekday
toggle, bulk price, which months get a row — so the behaviour can be read
without a browser and reused by the Vitest work in batch
[2b.1](p2b-01-logic-modules-adrs.md). `CalendarEditor.tsx` and
`MonthlyOverrides.tsx` render it.

## Faithful on purpose, including the defects

The brief for this slice is a faithful port, and that means carrying defects
across rather than quietly improving them. Three are reproduced, each with a
comment saying so at the site:

- **DEF-010** — `applyBulkPrice` writes the price into _every_ month holding a
  selected date, not the month on screen. A selection made earlier in another
  month is silently repriced.
- **DEF-017** — the inline month price input renders while editing, inside the
  section the editor hides. It exists and no user can reach it.
- **DEF-012** — Escape during editing closes without asking.

That is a deliberate contrast with slice [2a.3b](p2a-03b-port-groups.md), where
DEF-008, DEF-009 and DEF-003 vanished. The difference is not inconsistency: those
three disappeared as a consequence of controlled inputs and a fallback, with no
extra code. These three would need code _added_ to change, and changing
behaviour in the same batch that ports it makes a cutover impossible to reason
about. The fixes are Phase 3's, and the pins stay.

## The contract spec passes against the port, a batch early

Batch 2a.3b was asked to run the full testid contract against `/next/` and could
not — ten of the fourteen hooks did not exist. It was moved to 2a.3d. With the
monthly rows and calendar landing here, **all fourteen are present now**, so the
spec is tagged and green against both apps, and 2a.3d's inherited task is
already done.

That includes DEF-017's odd shape: the contract asserts `month-price-input` is
_attached and hidden_, and the port matches, because it reproduces the defect.

## The tagging scheme was wrong and is fixed

The legacy project used `grepInvert: /@ported/`, so tagging a spec for the port
**silently removed it from the legacy run**. Tagging the contract spec would
have quietly halved its coverage while looking like an improvement.

Two tags now, one meaning each:

| Tag           | Meaning                                       |
| ------------- | --------------------------------------------- |
| `@ported`     | also run this spec against the React build    |
| `@portedonly` | and do **not** run it against the legacy page |

A spec covering both apps carries `@ported` alone. One that only makes sense
against the port carries both. Verified: the contract spec now reports a
`[legacy]` and a `[ported]` result for the same test.

## Acceptance criteria

- [x] `npx playwright test` exit 0 — 99 passed, 14 skipped, both projects.
- [x] The `@ported` set now includes the calendar, the override rows and the
      full testid contract.

## Merge order and dependencies

Depends on 2a.3b. Deployable: yes.

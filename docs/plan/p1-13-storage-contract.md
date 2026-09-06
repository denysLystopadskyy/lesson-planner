# Batch 1.13 — Storage contract specs

Phase 1 · [Plan home](README.md) · Prev: [1.12](p1-12-coverage-csv.md) · Next: [2a.1](p2a-01-vite-scaffold.md)

## Goal

Prove how the app reads and writes the three storage keys, with reusable
fixtures the React port will run against unchanged.

## Test design (technique named per group)

- **Equivalence partitioning — stored shapes:** empty storage (first run);
  a realistic dataset (three groups, two months, overrides); a legacy-shaped
  dataset written by the original app version.
- **Desired-behavior pin:** corrupt JSON in one key must show an error and
  offer recovery instead of a dead page.
- **Write-back check:** after each mutation, the three keys deep-equal the
  expected golden shapes (see
  [storage-data-contract.md](../../.claude/context/storage-data-contract.md)).

## Tasks

- [x] Fixture files under `e2e/fixtures/storage/`: `empty.json`,
      `realistic.json`, `legacy.json`, `corrupt.txt`. No personal data.
- [x] Seeding helper accepts an optional key prefix, exercised with and
      without one.
- [x] BDD specs for read, write-back, and the pins.

## What landed

`e2e/ui/support/storage-fixtures.ts` holds the three key names in one place and
turns a fixture file into Playwright storage state, with an optional prefix. The
fixture layer gained a `storageOverride` option, because the storage-contract
specs need shapes `plannerState` cannot express — a group with no currency, or a
key holding text that is not JSON.

Six tests: the three read partitions, a write-back check against the documented
shapes, the staging prefix, and corrupt data.

The **prefix** test is the one batch [2a.1](p2a-01-vite-scaffold.md) depends on.
It seeds `next:`-prefixed keys and asserts the app reads the production keys,
finds nothing, and leaves the prefixed data untouched beside it. That is the
whole safety argument for serving staging from the same origin.

The **write-back** check asserts the shapes the contract file documents,
including one detail easy to lose in a port: `paymentTemplate` is a **raw
string**, not JSON. The test asserts it does not start with a quote.

## Two pins, and both registry entries were wrong

Same lesson as DEF-008 in batch [1.8](p1-08-coverage-groups.md), twice more.

**DEF-003** was reached from an unexpected direction. The legacy fixture — a
group with `{name, price, dates}` and no `currency` — was meant to test byte
compatibility. Instead, clicking the card throws
`Currency code is required with currency style.` and the dialog never opens, so
the group is visible in the list and unreachable. `renderGroupInfo` does guard
the currency; `createMonthRow` calls `formatCurrency(total, group.currency)`
with no fallback, and that is the line that throws. The entry now names the
mechanism.

**DEF-001** said "makes the page dead, no error shown". The page is not dead —
it looks **completely normal**, and that is worse. `storage.load()` parses
without a guard, the exception escapes `App.init()`, and everything after it is
skipped: no `bindEvents()`, no `render.groups()`. The toolbar is static markup,
so it stays on screen with nothing behind it. Clicking "+ Add Group" does
nothing, the month dropdown has no options, and there is no empty state and no
error. A blank page would at least look broken.

The first version of this pin asserted "no page errors" and **passed**, because
the error is thrown while the inline script first runs — before any listener a
test attaches in its body exists. The pin now asserts that a control actually
responds, which is both what the user cares about and something a test can see.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.
- [x] The seeding helper works with and without a prefix, both exercised.

## Phase 1 is complete

Fourteen batches. The suite covers the app the plan set out to cover, every
known defect is pinned to a spec that fails without its flag, and the fixtures
here are the handover to Phase 2a: batch
[2a.3a](p2a-03a-port-shell-storage.md) runs these same files against the ported
app.

## Merge order and dependencies

Depends on 1.7. Last Phase 1 merge. Batch 2a.3a consumes these fixtures.
Deployable: yes.

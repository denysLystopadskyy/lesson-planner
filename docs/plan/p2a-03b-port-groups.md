# Batch 2a.3b — Port slice 2: groups

Phase 2a · [Plan home](README.md) · Prev: [2a.3a](p2a-03a-port-shell-storage.md) · Next: [2a.3c](p2a-03c-port-calendar-overrides.md)

## Goal

Group CRUD works in the React app: add, open, edit info, delete.

## Tasks

- [x] Port the group modal with its info display and edit form, the add and
      delete flows, and their confirmations. Logic largely as-is; one `<App>`.
- [x] Reproduce the frozen testids on the new markup — the four this slice
      renders. The other ten need 2a.3c; see the amendment.
- [x] Green the group flows against `/next/`, driven through the same
      Screenplay tasks the legacy specs use.

## What landed

`GroupModal.tsx` and a `useLocalGroups` hook, wired into the one `<App>`. The
ported specs reuse the **same Screenplay tasks** as the legacy ones —
`addGroup`, `editGroupInfo`, `deleteGroup`, `openGroupCard`. That is the real
test of a port: identical actions through identical page objects, against
different markup.

11 `@ported` specs pass; 94 in total across both projects.

## Three legacy defects that the port does not have

Each disappears because of the shape of the code, not because it was
special-cased — and each is asserted **unpinned** in `ported-groups.spec.ts`, so
a regression in the port fails loudly. The pins against the legacy app stay
where they are.

- **DEF-008** — Cancel reverts the price as well as the name. The edit form
  holds a draft in local state and nothing reaches the group until Save, so
  there is nothing for Cancel to fail to undo. The legacy app shows
  `UAH 777.00` after cancelling while storage still holds 100.
- **DEF-009** — changing the price cannot discard an unsaved name. Both are
  fields of one draft; editing either does not re-render the other from stored
  data.
- **DEF-003** — a group with no currency opens, because `currencyOf` falls back
  instead of handing `undefined` to `Intl`.

There is also a quieter improvement. The dialog focuses the name field
**synchronously** on open. The legacy app does it in a 100 ms `setTimeout`,
which steals focus back mid-typing — the cause of the suite-wide flake in batch
[1.10](p1-10-coverage-overrides-pricing.md). The port cannot reproduce that
flake because there is no timer to race.

## Amendment: the contract spec cannot pass here

The ticket asked for the testid-contract spec to pass against `/next/` in this
batch. It cannot: **ten of the fourteen frozen hooks do not exist yet.**

| Hooks                                                                                                                                | Rendered by          |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `group-card-name`, `group-card-lesson-count`, `data-group-name`, `data-group-index`                                                  | this slice           |
| `month-name`, `month-lesson-count`, `month-total`, `price-per-lesson`, `month-price-input`, `copy-payment-message`, `data-month-key` | 2a.3c (monthly rows) |
| `data-weekday`, `data-date`, `data-day`                                                                                              | 2a.3c (calendar)     |

Same shape as the `TS18003` problem in batch
[1.1](p1-01-toolchain-bootstrap.md): a batch asked to prove something with
parts a later batch delivers. This slice asserts the four hooks it is
responsible for, and **running the full contract spec against `/next/` moves to
[2a.3d](p2a-03d-port-template-message-csv.md)**, where the last of them lands.

## A helper that read the wrong keys

Two ported specs failed with `undefined` before this was found:
`planner-storage.ts` read the production key names while the port writes
prefixed ones, so it looked at an empty slot and reported nothing. It now takes
an optional prefix, and the `@ported` specs pass `PORTED_STORAGE_PREFIX`.

Worth noting because the failure mode is quiet: reading the wrong key returns
"no data" rather than an error, which reads as a broken app rather than a broken
test.

## Acceptance criteria

- [x] `npx playwright test --project=ported` exit 0 — 11 passed.
- [ ] ~~Testid-contract spec passes against `/next/`~~ — **moved to 2a.3d**, see
      the amendment above.
- [x] The legacy suite is unchanged — 94 passed across both projects.

## Merge order and dependencies

Depends on 2a.3a. Deployable: yes.

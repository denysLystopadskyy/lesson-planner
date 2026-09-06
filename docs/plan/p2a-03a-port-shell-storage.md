# Batch 2a.3a — Port slice 1: shell and storage adapter

Phase 2a · [Plan home](README.md) · Prev: [2a.2](p2a-02-deploy-workflow-runbook.md) · Next: [2a.3b](p2a-03b-port-groups.md)

## Goal

The one-big-App port starts: the React shell reads and writes the three keys
through a storage adapter, proven by the batch-1.13 fixtures.

## Tasks

- [x] Storage adapter module: read/parse and serialize/write the three keys,
      with the `VITE_STORAGE_PREFIX` prefix applied when set.
- [x] `<App>` renders the main screen (title, toolbar, group list) from
      stored data. No editing yet.
- [x] Parameterize the e2e suite — as **per-project options**, not environment
      variables. See the amendment below.
- [x] Smoke `@ported` specs: seed prefixed fixtures, open `/next/`, the group
      cards render with correct counts.

## What landed

`app/src/storage.ts` reads and writes the three keys; `app/src/types.ts` holds
the stored shapes, with `currency` and `monthlyOverrides` marked optional
because older data lacks them.

`<App>` renders the title, the toolbar and the group list. The toolbar buttons
are `disabled` rather than present-but-inert — handlers arrive in 2a.3b–2a.3d,
and a control that looks live and does nothing is precisely the failure DEF-001
produces in the legacy app.

## The port does not inherit two of the legacy defects

This is the part worth reviewing, because it is a deliberate behavioural
difference rather than a faithful copy:

- **DEF-001.** The legacy `storage.load()` calls `JSON.parse` unguarded, so one
  corrupt key leaves a page that looks normal and does nothing. The adapter
  returns a `LoadResult` instead of throwing: unreadable data renders an alert
  saying so, and the shell still works. A `@ported` spec asserts it.
- **DEF-003.** A group written without a currency cannot be opened in the legacy
  app — `createMonthRow` formats with `undefined` and throws. `currencyOf`
  falls back to the default, and a `@ported` spec seeds the `legacy.json`
  fixture and asserts the card renders with `data-currency="UAH"` and no page
  errors.

Both are pinned as defects against the legacy app and stay pinned; the fixes
land there in batches 3.1 and 3.2. The port simply must not reproduce them.

## Amendment: per-project options, not environment variables

The ticket asked for `BASE_PATH` and `STORAGE_PREFIX` environment variables.
Built that way, they are **global to a run**, and the two projects need
different values. Setting them for the ported project pointed the legacy
project at `/next/` as well: every legacy spec navigated to a 404 and the run
took nine minutes to fail.

They are Playwright **project options** instead, declared in the fixture and set
per project in `playwright.config.ts`. `npx playwright test` now runs both
projects correctly with no environment set, which is also what CI does.

The suite is split by **tag**, not directory: `legacy` runs everything except
`@ported`, and `ported` runs only `@ported`. A spec graduates to covering both
apps by gaining a tag, which is how 2a.3b–2a.3d grow port coverage without
duplicating files.

## Acceptance criteria

- [x] `npx playwright test --project=ported` exit 0 against the `/next/`
      preview — 5 passed.
- [x] Seeding the legacy-shaped fixture renders the same group and count as the
      legacy app does from the same file.
- [x] The full legacy suite still passes unchanged — 83 legacy plus 5 ported,
      88 passed and 14 skipped, no environment variables required.

One trap worth recording: the preview must be **built with the prefix**. The
first version of `serve:next` built without `VITE_STORAGE_PREFIX`, so the app
read unprefixed keys while the suite seeded prefixed ones and three specs failed
on empty data. The script now sets it, which also makes the local preview match
what the deploy workflow publishes.

## Merge order and dependencies

Depends on 2a.2 and on 1.13 (fixtures). Deployable: yes (only `/next/`
changes; real keys untouched thanks to the prefix).

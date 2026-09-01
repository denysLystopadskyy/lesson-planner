# Batch 2a.3a — Port slice 1: shell and storage adapter

Phase 2a · [Plan home](README.md) · Prev: [2a.2](p2a-02-deploy-workflow-runbook.md) · Next: [2a.3b](p2a-03b-port-groups.md)

## Goal

The one-big-App port starts: the React shell reads and writes the three keys
through a storage adapter, proven by the batch-1.13 fixtures.

## Tasks

- [ ] Storage adapter module: read/parse and serialize/write the three keys,
      with the `VITE_STORAGE_PREFIX` prefix applied when set.
- [ ] `<App>` renders the main screen (title, toolbar, group list) from
      stored data. No editing yet.
- [ ] Parameterize the e2e suite: `BASE_PATH` and `STORAGE_PREFIX` env vars
      with defaults for the legacy page; a `@ported` tag marks specs that run
      against `/next/`.
- [ ] Smoke `@ported` spec: seed prefixed `realistic.json`, open `/next/`,
      the group cards render with correct counts.

## Acceptance criteria

- `npx playwright test --grep @ported` exit 0 against the `/next/` preview.
- Seeding the legacy-shaped fixture renders the same golden state.
- The full legacy suite still passes unchanged.

## Merge order and dependencies

Depends on 2a.2 and on 1.13 (fixtures). Deployable: yes (only `/next/`
changes; real keys untouched thanks to the prefix).

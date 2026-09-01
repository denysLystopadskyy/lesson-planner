# Batch 2a.1 — Vite scaffold in app/

Phase 2a · [Plan home](README.md) · Prev: [1.13](p1-13-storage-contract.md) · Next: [2a.2](p2a-02-deploy-workflow-runbook.md)

## Goal

Add the React build tooling in a subdirectory without changing the served page.

Vite is explained in
[react-migration.md](../../.claude/context/react-migration.md).

## Tasks

- [ ] Create the Vite + React + TypeScript project in `app/` (root option in
      `vite.config.ts`). Latest stable versions; record them here.
- [ ] `base` comes from the CLI flag; storage prefix from
      `VITE_STORAGE_PREFIX`. Neither is hardcoded in the config.
- [ ] Placeholder `<App>` renders a title only.
- [ ] Add `app` build and preview scripts to the root `package.json`.
- [ ] State in the PR: while Pages publishes from the branch root, the raw
      `app/` sources are also published at `/lesson-planner/app/`. This is
      harmless and ends with the Actions switch (2a.2).

## Acceptance criteria

- `npm run build:app` exit 0; `dist/` contains the shell.
- Live `/lesson-planner/` response is hash-identical before and after merge.
- ESLint and Prettier cover `app/` (`lint`, `format:check` exit 0).

## Merge order and dependencies

Depends on 1.7 (CI) and may start in parallel with 1.8–1.13 (touches only
`app/`). Merges after 1.13. Deployable: yes.

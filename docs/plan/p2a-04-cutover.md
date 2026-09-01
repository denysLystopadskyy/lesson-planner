# Batch 2a.4 — Cutover

Phase 2a · [Plan home](README.md) · Prev: [2a.3d](p2a-03d-port-template-message-csv.md) · Next: [2b.1](p2b-01-logic-modules-adrs.md)

## Goal

The live URL serves the React build; the legacy file is gone; one revert
restores everything.

## Tasks

- [ ] Workflow: build with `--base=/lesson-planner/` and no storage prefix;
      publish the React build at `/`; stop publishing `/next/`.
- [ ] Delete the legacy `index.html`.
- [ ] Remove the `index.html` entry from `.prettierignore`.
- [ ] Run the full suite against the production build locally, then against
      the deployed URL.
- [ ] Verify on the teacher's device: her data is present (same origin, same
      keys; see
      [storage-data-contract.md](../../.claude/context/storage-data-contract.md)).

## Acceptance criteria

- The PR file list contains only: workflow change, `index.html` deletion,
  `.prettierignore` line removal. This is the rollback guarantee — one revert.
- Full suite exit 0 against the deployed `/`.
- Her data visible after cutover (manual confirmation recorded here).

## Merge order and dependencies

Depends on 2a.3d. Blocks all of Phase 2b. Deployable: yes — this batch IS the
cutover; rollback is one revert.

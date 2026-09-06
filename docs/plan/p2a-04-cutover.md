# Batch 2a.4 — Cutover

Phase 2a · [Plan home](README.md) · Prev: [2a.3e](p2a-03e-port-styles.md) · Next: [2b.1](p2b-01-logic-modules-adrs.md)

## Goal

The live URL serves the React build; the legacy file is gone; one revert
restores everything.

The React build must **look** like the page it replaces before this batch runs.
That is batch [2a.3e](p2a-03e-port-styles.md), added after screenshots showed
the port had no stylesheet at all.

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
- [ ] **Check the `paymentTemplate` key exists in her browser before cutover.**
      The legacy app writes that key only when the template editor is saved, and
      the React app's default is neutral rather than a copy of the legacy one
      (batch [2a.3d](p2a-03d-port-template-message-csv.md), see
      [security-auth.md](../../.claude/context/security-auth.md)). If the key is
      absent, her first payment message after cutover would carry
      `<recipient>` instead of her bank details. The fix is one minute in the
      template editor, done by her, on her device — nothing is copied into this
      repository.

## Acceptance criteria

- The PR file list contains only: workflow change, `index.html` deletion,
  `.prettierignore` line removal. This is the rollback guarantee — one revert.
- Full suite exit 0 against the deployed `/`.
- Her data visible after cutover (manual confirmation recorded here).
- A payment message generated after cutover carries her real payment block
  (confirmed by her, not reproduced here).

## Merge order and dependencies

Depends on 2a.3e. Blocks all of Phase 2b. Deployable: yes — this batch IS the
cutover; rollback is one revert.

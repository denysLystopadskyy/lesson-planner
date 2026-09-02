# Batch 1.3 — Scaffold core: config, fixtures, smoke, testid contract

Phase 1 · [Plan home](README.md) · Prev: [1.2](p1-02-land-test-hooks.md) · Next: [1.4](p1-04-feature-specs-1.md)

## Goal

Commit the Playwright config, the support layers, one smoke spec, and the
testid-contract spec — everything green.

## Tasks

- [ ] Commit `playwright.config.ts` (baseURL `http://localhost:4173`,
      UTC timezone, webServer on `npm run serve`).
- [ ] Commit `e2e/ui/`: fixtures (storage seed and reset, clock control),
      page objects, support helpers, and the Screenplay layer (kept — user
      decision; see [testing.md](../../.claude/context/testing.md)).
- [ ] Write one smoke spec: app loads, empty state text shows, a group can be
      added. Cover the batch-1.2 modal fix: closed modals are not reachable.
- [ ] Write the testid-contract spec: it lists the 8 frozen testids and the
      6 dataset hooks and fails if any is missing or renamed.
- [ ] Disposition the four working-copy docs: adopt `functionality.md`,
      `tech-details.md`, `bdd-usage.md` after review; correct or drop
      `qa-coverage-investigation.md` (its scenario LP-010 is proven false).
      Record the choice per file here.

## Acceptance criteria

- `npx playwright test` exit 0 (smoke + contract specs).
- The contract spec fails if a testid is renamed (verify once by mutation).
- Each of the four docs has a recorded disposition in this page.

## Merge order and dependencies

Depends on 1.2. Merges before 1.4. Deployable: yes.

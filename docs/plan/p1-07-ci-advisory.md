# Batch 1.7 — CI (advisory)

Phase 1 · [Plan home](README.md) · Prev: [1.6](p1-06-eslint.md) · Next: [1.8](p1-08-coverage-groups.md)

## Goal

Run format check, lint, typecheck, and the e2e suite on every pull request.

## Tasks

- [ ] GitHub Actions workflow: install, `format:check`, `lint`, `typecheck`,
      `playwright test` with the Playwright browser cache.
- [ ] Keep failure artifacts: traces and the JUnit report.
- [ ] Pin the Node version; record it in
      [deployment.md](../../.claude/context/deployment.md).
- [ ] Record the suite runtime in
      [testing.md](../../.claude/context/testing.md) (TBD there).
- [ ] Note in the workflow file: CI is advisory until the owner makes it a
      required check in Settings (owner-only action, like the Pages switch).

## Acceptance criteria

- The workflow runs green on this PR.
- A forced failing spec produces a trace artifact (verify once, then revert).

## Merge order and dependencies

Depends on 1.6. Merges before the coverage batches. Deployable: yes (CI does
not touch the served page).

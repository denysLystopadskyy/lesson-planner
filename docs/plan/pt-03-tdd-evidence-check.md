# Batch T.3 — A CI check for TDD evidence

Phase T · [Plan home](README.md) · Prev: [T.2](pt-02-project-settings-hook.md) · Next: [T.4](pt-04-rewrite-phase-1.md)

**Planned in batch [T.1](pt-01-test-strategy.md) on 2026-10-17. Not started.**
The batch that runs it completes this page from the
[template](batch-template.md).

## Goal

CI checks that a code batch has a red commit that really fails for the stated reason, or a named exception. This is the first batch to follow the red commit rule itself.

## Test basis

- [testing.md §1.5](../../.claude/context/testing.md#15-how-we-develop-tdd-and-bdd) — the red commit rule and the exceptions.
- [RP-11 TDD verdict](../research/rp11-docs-process-review/tdd-verdict.md) — why a check that only looks for a heading would be a fake check.

## Tasks

- [ ] Red: unit tests for the parser of a batch page's TDD log, and for the decision "production code changed and no red SHA and no exception → fail".
- [ ] Green: `scripts/check-tdd-evidence.mjs`. It finds the batch page changed in the pull request and reads its TDD log.
- [ ] If a red SHA is given: check out that commit, run only the stated command, and expect a non-zero exit with output that contains the stated failure message. Then expect the pull request head to pass.
- [ ] Production code means non-test files in `app/src/`, `api/`, `db/` and `scripts/serve.mjs`.
- [ ] Add a `tdd-evidence` job to `ci.yml` with `fetch-depth: 0`. It is advisory, like the rest of CI.
- [ ] A named exception is a record a person reviews at merge. The check says so and does not claim to verify it.

## TDD log

**Red commit required.** This batch is code, so its own TDD log has a red SHA, a command and a failure message.

## Acceptance criteria

- [ ] **Given** a pull request that changes `app/src/` and whose batch page has no TDD log, **when** CI runs, **then** `tdd-evidence` fails and names the missing log.
- [ ] **Given** a TDD log whose red commit passes its own command, **when** CI runs, **then** `tdd-evidence` fails: the test did not fail first.
- [ ] **Given** a docs-only pull request, **when** CI runs, **then** `tdd-evidence` passes and says no production code changed.

## Exit criteria

- [ ] The exit criteria in [testing.md §1.6](../../.claude/context/testing.md#16-entry-criteria-and-exit-criteria).

## Merge order and dependencies

Depends on T.2. Deployable: yes.

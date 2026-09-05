# Batch 1.7 — CI (advisory)

Phase 1 · [Plan home](README.md) · Prev: [1.6](p1-06-eslint.md) · Next: [1.8](p1-08-coverage-groups.md)

## Goal

Run format check, lint, typecheck, and the e2e suite on every pull request.

## Tasks

- [x] GitHub Actions workflow: install, `format:check`, `lint`, `typecheck`,
      `playwright test` with the Playwright browser cache.
- [x] Keep failure artifacts: traces and the JUnit report.
- [x] Pin the Node version; record it in
      [deployment.md](../../.claude/context/deployment.md). Node 24.
- [x] Record the suite runtime in
      [testing.md](../../.claude/context/testing.md).
- [x] Note in the workflow file: CI is advisory until the owner makes it a
      required check in Settings.

## What the workflow does

Four checks on every pull request and on pushes to `main`. Each runs under
`if: !cancelled()`, so one push reports every problem instead of stopping at the
first — a red format check should not hide a failing test.

Browsers are cached on the **resolved** Playwright version, read from the
installed package rather than the lockfile text, so a version bump misses the
cache instead of restoring browsers that no longer match the runner.

The workflow does not deploy. Publishing is still branch-based from `main`; the
deploy workflow arrives separately in batch
[2a.2](p2a-02-deploy-workflow-runbook.md) and must use the same Node major.

## Measured

|                            |            |
| -------------------------- | ---------- |
| Whole job, cold cache      | 58 s       |
| Suite alone, locally       | about 8 s  |
| `--repeat-each=3`, locally | about 19 s |

Budget recorded in [testing.md](../../.claude/context/testing.md): investigate if
a CI job passes five minutes.

## Artifacts are safe to keep, and that is not an accident

Traces, video and screenshots are uploaded on failure, and the JUnit report
always. That would have been a personal-data leak two batches ago: an unseeded
spec renders the app's default payment template, which carries the owner's real
identifiers. Batches [1.4](p1-04-feature-specs-1.md) and
[1.5](p1-05-feature-specs-2.md) made every template-rendering spec seed its own,
and the rule is recorded in
[security-auth.md](../../.claude/context/security-auth.md). A future spec that
ignores that rule puts real data into a downloadable artifact.

## Acceptance criteria

- [x] The workflow runs green on this PR. First run: `checks` passed in 58 s.
- [x] A forced failing spec produces a trace artifact, verified once and
      reverted. A deliberately failing spec was pushed; the run uploaded
      `playwright-artifacts` at 1.07 MB alongside `junit`, and both the spec and
      its lint alias were then removed.

## Owner action still outstanding

CI is **advisory**. A red run does not block a merge until the owner adds a
branch protection rule: Settings → Branches → rule for `main` → Require status
checks to pass → select `checks`. Only the repository owner can do this. It is
the same class of action as the Pages publishing-source switch in batch
[2a.2](p2a-02-deploy-workflow-runbook.md), and the runbook there should mention
both together.

## Merge order and dependencies

Depends on 1.6. Merges before the coverage batches. Deployable: yes (CI does
not touch the served page).

# Batch 2a.2 — Deploy workflow + owner runbook

Phase 2a · [Plan home](README.md) · Prev: [2a.1](p2a-01-vite-scaffold.md) · Next: [2a.3a](p2a-03a-port-shell-storage.md)

## Goal

Ship a Pages deploy workflow that is inert until the repository owner flips
the publishing source, plus the exact runbook for that flip.

## Tasks

- [ ] Workflow: build `app/` with `--base=/lesson-planner/next/`, compose an
      artifact with the legacy `index.html` at `/` and the React build at
      `/next/`, deploy with the official Pages actions. The deploy job runs
      only when the repository variable `PAGES_ACTIONS` is `true`, so this PR
      merges green while publishing is still branch-based.
- [ ] Gate the deploy job on the test job passing.
- [ ] Write the owner runbook in this page (below).

## Owner runbook (Settings actions only the owner can do)

1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → Variables: set
   `PAGES_ACTIONS` = `true`.
3. Run the workflow from the Actions tab (workflow_dispatch).
4. Verify: `/lesson-planner/` serves content hash-identical to before;
   `/lesson-planner/next/` returns 200 with the React shell.
5. Record the date of the flip in
   [deployment.md](../../.claude/context/deployment.md).

## Acceptance criteria

- The PR merges with the workflow green and the live site untouched.
- The batch closes only on runbook evidence: step 4 checks recorded here.

## Merge order and dependencies

Depends on 2a.1. Blocks 2a.3a. Deployable: yes (inert until the flip; the
flip itself is verified by the runbook).

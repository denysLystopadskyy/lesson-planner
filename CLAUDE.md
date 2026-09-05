# Lesson Planner — project guide

## What this project is

A small web app for one teacher. She plans lesson dates for her teaching groups,
sets prices, and copies a payment message for each month. The whole app is one
file, `index.html`. It runs on GitHub Pages at
`https://denyslystopadskyy.github.io/lesson-planner/`. All data lives in the
browser's `localStorage` under three keys. There is no server.

We are changing the project in phases: add tests, migrate to React, stabilize,
and only then plan a database. The full plan lives in [docs/plan/](docs/plan/README.md).
The research behind the plan lives in [docs/research/](docs/research/README.md).

## The decision rule

**Every global or architectural decision is recorded in the relevant grouped
context file and referenced from CLAUDE.md — never written inline in task
tickets or scattered across the repo.** If you make such a decision, add it to
the right file below in the same pull request. If a decision is not made yet,
the file marks it `TBD`.

## Context files (grouped decisions)

| File                                                                                 | Topic                                                                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [.claude/context/testing.md](.claude/context/testing.md)                             | Test tools, test style (BDD, TDD), locators, ISTQB techniques, snapshots             |
| [.claude/context/linting-formatting.md](.claude/context/linting-formatting.md)       | Prettier, ESLint presets, code style                                                 |
| [.claude/context/react-migration.md](.claude/context/react-migration.md)             | What Vite is, migration stages, staging path, icons                                  |
| [.claude/context/state-management.md](.claude/context/state-management.md)           | State approach: built-in reducer + context, Redux Toolkit migration triggers, drafts |
| [.claude/context/storage-data-contract.md](.claude/context/storage-data-contract.md) | The three localStorage keys, shapes, origin rule, staging prefix                     |
| [.claude/context/deployment.md](.claude/context/deployment.md)                       | GitHub Pages, merge-target rule, cutover, rollback                                   |
| [.claude/context/security-auth.md](.claude/context/security-auth.md)                 | Personal data rule, secrets, future Google sign-in                                   |

## Repository layout (today)

- `index.html` — the whole application (deployed as-is).
- `CLAUDE.md` — this file.
- `.claude/context/` — grouped decision files (see table above).
- `docs/plan/` — the phased execution plan: a hub page and one page per PR batch.
- `docs/research/` — nine research reports (markdown is the source of record).
- `LICENSE` — Apache-2.0 (copyright holder still `TBD`, see plan batch 3.7).
- `package.json`, `package-lock.json`, `.npmrc`, `tsconfig.json`,
  `.prettierignore`, `playwright.config.ts` — the toolchain (plan batch 1.1).

These commands work today:

| Command                                   | What it does                                       |
| ----------------------------------------- | -------------------------------------------------- |
| `npm ci`                                  | Install the pinned toolchain.                      |
| `npm run typecheck`                       | `tsc --noEmit`.                                    |
| `npm run format` / `npm run format:check` | Prettier over everything not in `.prettierignore`. |
| `npm run serve`                           | Serve the repo root on `http://localhost:4173`.    |

Test code (`e2e/`) does not exist on this branch yet; it arrives with plan
batches 1.3–1.5. Until then `npm run test:e2e` finds no specs, and the
`playwright.config.ts` `testDir` points at a directory that is not there. That
is expected, not a fault.

## Working rules

- Write documentation in plain English at B2 level. Short sentences. No idioms.
- Follow TypeScript strict style; avoid `any`. Keep functions small.
- Prefer 2-space indentation, descriptive names, kebab-case filenames.
- Test style and TDD/BDD rules: see [testing.md](.claude/context/testing.md).
- Commits: short, imperative subject ("Add lesson duplication flow"). Explain
  the why in the body when it is not obvious. Keep diffs small and focused.
- Pull requests: one plan batch per PR, linked to its page in `docs/plan/`.
  Target branch: `main` (see [deployment.md](.claude/context/deployment.md)).
- Never commit secrets, `node_modules/`, `test-results/`, or `playwright-report/`.
- Personal data rule: `index.html` contains real personal payment details.
  Refer to them only by line number, never copy the values. See
  [security-auth.md](.claude/context/security-auth.md).

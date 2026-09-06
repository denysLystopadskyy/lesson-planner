# Lesson Planner — project guide

## What this project is

A small web app for one teacher. She plans lesson dates for her teaching groups,
sets prices, and copies a payment message for each month. It is a React app
built with Vite, in `app/`. It runs on GitHub Pages at
`https://denyslystopadskyy.github.io/lesson-planner/`. All data lives in the
browser's `localStorage` under three keys. There is no server.

It was one file, `index.html`, until the cutover in plan batch 2a.4. That file
is gone; git history has it, and the research reports still refer to its line
numbers.

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

- `app/` — the application. `app/src/` holds the components and the pure
  modules (`storage.ts`, `schedule.ts`, `csv.ts`, `message.ts`, `format.ts`);
  `app/src/styles.css` is still a verbatim copy of the old inline stylesheet
  until plan batch 2b.7 rewrites it.
- `CLAUDE.md` — this file.
- `.claude/context/` — grouped decision files (see table above).
- `docs/plan/` — the phased execution plan: a hub page and one page per PR batch.
- `docs/research/` — nine research reports (markdown is the source of record).
- `LICENSE` — Apache-2.0 (copyright holder still `TBD`, see plan batch 3.7).
- `package.json`, `package-lock.json`, `.npmrc`, `tsconfig.json`,
  `.prettierignore`, `playwright.config.ts` — the toolchain (plan batch 1.1).
- `.github/workflows/` — advisory CI, and the deploy that publishes `app/dist`
  to Pages.

These commands work today:

| Command                                   | What it does                                             |
| ----------------------------------------- | -------------------------------------------------------- |
| `npm ci`                                  | Install the pinned toolchain.                            |
| `npm run typecheck`                       | `tsc --noEmit`.                                          |
| `npm run format` / `npm run format:check` | Prettier over everything not in `.prettierignore`.       |
| `npm run serve`                           | Build the app and preview it on `http://localhost:4173`. |
| `npm run dev:app`                         | Vite dev server with hot reload.                         |
| `npm run lint`                            | ESLint over everything.                                  |
| `npm run test:e2e`                        | The Playwright suite against the built app.              |

- `e2e/` — the Playwright suite (plan batch 1.3): `ui/` holds fixtures, page
  objects and the Screenplay layer; `features/` holds the specs.

`npm run test:e2e` runs 92 tests against the built app, of which nine are
`fixme` pins on the defects in [the registry](docs/plan/def-registry.md).

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
- **A batch must be able to pass its own acceptance gates** with only what that
  batch ships. Check this before starting it. If a gate needs a file from a later
  batch, move the file or move the gate, and record which in the batch page.
- **If a recorded rule cannot be honoured, change the record.** Never write a
  weak test, a fake check or a hedged claim so that a rule appears satisfied. Say
  why the rule does not fit and what replaced it. One fictional entry makes the
  whole record untrustworthy.
- **The checkout at `/Users/denyslystopadskyy/IdeaProjects/lesson-planner`
  shares this repository's `.git`.** Never run `git checkout`, `git stash`,
  `git add` or any other index-touching command there — it would destroy staged
  work on another branch, and the stash stack is shared. It stopped being a
  source of file contents when plan batch 1.5 adopted the last spec.
- Personal data rule: the owner's real payment identifiers are no longer in any
  tracked file — the cutover deleted the file that held them — but they are in
  git history, and any spec that renders a payment message must still seed its
  own template. See [security-auth.md](.claude/context/security-auth.md).

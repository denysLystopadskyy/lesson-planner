# Lesson Planner — project guide

## What this project is

A small web app for one teacher. She plans lesson dates for her teaching groups,
sets prices, and copies a payment message for each month. It is a React app
built with Vite, in `app/`. It runs on GitHub Pages at
`https://denyslystopadskyy.github.io/lesson-planner/`. All data lives in the
browser's `localStorage` under three keys. There is no server today. Plan
Phases 4–6 move the site to Vercel, add Google sign-in with Better Auth, and
store the data in a Neon Postgres database; the evaluation behind that is
[RP-10](docs/research/rp10-service-evaluation/rp10-service-evaluation.md)
(2026-09-09).

It was one file, `index.html`, until the cutover in plan batch 2a.4. That file
is gone; git history has it, and the research reports still refer to its line
numbers.

We are changing the project in phases: add tests, migrate to React, stabilize,
and only then plan a database. The full plan lives in [docs/plan/](docs/plan/README.md).
The research behind the plan lives in [docs/research/](docs/research/README.md).

**Phases 1, 2 and 3 are merged.** The defect registry went from 17 open rows to
one: DEF-027, found by Phase 3's own accessibility checklist and deferred with a
recorded decision. The suite carries no `fixme` pins.

Phase 4 (hosting migration) is next, and every batch of it is unblocked. Phases
4–6 were planned on 2026-09-09 from
[RP-10](docs/research/rp10-service-evaluation/rp10-service-evaluation.md).

## The decision rule

**Every global or architectural decision is recorded in the relevant grouped
context file and referenced from CLAUDE.md — never written inline in task
tickets or scattered across the repo.** If you make such a decision, add it to
the right file below in the same pull request. If a decision is not made yet,
the file marks it `TBD`.

## Context files (grouped decisions)

| File                                                                                 | Topic                                                                                   |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [.claude/context/testing.md](.claude/context/testing.md)                             | Test tools, test style (BDD, TDD), locators, ISTQB techniques, snapshots                |
| [.claude/context/linting-formatting.md](.claude/context/linting-formatting.md)       | Prettier, ESLint presets, code style                                                    |
| [.claude/context/react-migration.md](.claude/context/react-migration.md)             | What Vite is, migration stages, staging path, icons                                     |
| [.claude/context/state-management.md](.claude/context/state-management.md)           | State approach: built-in reducer + context, Redux Toolkit migration triggers, drafts    |
| [.claude/context/storage-data-contract.md](.claude/context/storage-data-contract.md) | The three localStorage keys, shapes, origin rule, staging prefix                        |
| [.claude/context/deployment.md](.claude/context/deployment.md)                       | GitHub Pages today, the move to Vercel, merge-target rule, cutover, rollback            |
| [.claude/context/security-auth.md](.claude/context/security-auth.md)                 | Personal data rule, secrets, Google sign-in with Better Auth, processors and DPAs       |
| [.claude/context/backend.md](.claude/context/backend.md)                             | The one API function (Hono), database access, Drizzle migrations, PGlite, local serving |

## Repository layout (today)

- `app/` — the application. `app/src/` holds the components, the pure modules
  (`store.ts`, `route.ts`, `storage.ts`, `schedule.ts`, `csv.ts`, `backup.ts`,
  `message.ts`, `format.ts`, `contrast.ts`), a `*.module.css` beside each of the
  six components that has one, and `styles.css` for the tokens, the element
  rules and the shared primitives. Every colour token's contrast ratio is
  asserted from that stylesheet by `contrast.test.ts`, with a completeness
  guard — a hex token in no checked pair fails the suite unless it carries a
  written exemption.
- `CLAUDE.md` — this file.
- `.claude/context/` — grouped decision files (see table above).
- `docs/plan/` — the phased execution plan: a hub page and one page per PR batch.
- `docs/research/` — ten research reports (markdown is the source of record);
  RP-10 is a four-page wiki.
- `LICENSE` — Apache-2.0, `Copyright 2026 Denys Lystopadskyy` (filled in plan
  batch 3.7 from authorship; worth the owner confirming).
- `README.md` — what the app is, how to run and test it (plan batch 3.7).
- `scripts/` — `check-no-personal-data.mjs`, the build check from plan batch
  3.5. It self-tests on every run.
- `package.json`, `package-lock.json`, `.npmrc`, `tsconfig.json`,
  `.prettierignore`, `playwright.config.ts` — the toolchain (plan batch 1.1).
- `.github/workflows/` — advisory CI, the deploy that publishes `app/dist` to
  Pages, and `baselines.yml`: a manual run that renders Linux screenshot
  baselines in the pinned Playwright container. It uploads an artifact and never
  commits — this machine has no container runtime.

These commands work today:

| Command                                   | What it does                                              |
| ----------------------------------------- | --------------------------------------------------------- |
| `npm ci`                                  | Install the pinned toolchain.                             |
| `npm run typecheck`                       | `tsc --noEmit`.                                           |
| `npm run format` / `npm run format:check` | Prettier over everything not in `.prettierignore`.        |
| `npm run serve`                           | Build the app and preview it on `http://localhost:4173`.  |
| `npm run dev:app`                         | Vite dev server with hot reload.                          |
| `npm run lint`                            | ESLint over everything.                                   |
| `npm run test:unit`                       | Vitest over `app/src/**/*.test.ts` (pure modules, node).  |
| `npm run typecheck:app`                   | `tsc --noEmit` on the app's tsconfig — JSX and DOM libs.  |
| `npm run test:e2e`                        | The Playwright suite against the built app.               |
| `npm run check:pii`                       | Fails on bank or tax identifier shapes in tracked source. |

- `e2e/` — the Playwright suite (plan batch 1.3): `ui/` holds fixtures, page
  objects and the Screenplay layer; `features/` holds the specs.
- Not present yet: `api/`, `db/`, `shared/` and `scripts/serve.mjs` arrive with
  plan Phases 4–6. Their layout is decided in
  [backend.md](.claude/context/backend.md).

`npm run test:e2e` runs 180 tests in 34 files with **no `fixme` pins left**;
`npm run test:unit` runs 331. Both counts move every batch — a smell test, not a
target.

## Working rules

- Write documentation in plain English at B2 level. Short sentences. No idioms.
- Follow TypeScript strict style; avoid `any`. Keep functions small.
- Prefer 2-space indentation, descriptive names, kebab-case filenames.
- A CSS-module class is `string | undefined` under `noUncheckedIndexedAccess`.
  Join class names with `cx()` from `app/src/cx.ts`, never a template string.
- Test style and TDD/BDD rules: see [testing.md](.claude/context/testing.md).
- Playwright starts and stops its own preview server, so a suite run always
  rebuilds. A preview started by hand is reused and serves a **stale** build —
  stop it before running the suite after editing `app/`.
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
  own template. `npm run check:pii` fails the build on an IBAN shape or a long
  digit run in tracked source. See
  [security-auth.md](.claude/context/security-auth.md).
- **`npm run typecheck` does not cover `app/src`.** The root `tsconfig.json`
  includes only `e2e/**` and `playwright.config.ts`, so a type error in the app
  cannot turn a PR red. Run `npm run typecheck:app` too. Plan batch 3.5 wrote
  the CI step that closes this and could not push it — the token lacked
  `workflow` scope — so the block is recorded on
  [that batch page](docs/plan/p3-05-pii-template-cleanup.md), waiting to be
  applied.

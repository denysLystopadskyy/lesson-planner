# Lesson Planner — project guide

## What this project is

A small web app for one teacher. She plans lesson dates for her teaching groups,
sets prices, and copies a payment message for each month. It is a React app
built with Vite, in `app/`.

- **She uses GitHub Pages:** `https://denyslystopadskyy.github.io/lesson-planner/`.
  Pages serves static files only, so nothing she uses talks to a server.
- **A Vercel production deployment also exists**, with the same app and the
  API in `api/`. She moves to it in batch 4.3, which waits on her.
- **All her data is in the browser's `localStorage`**: three data keys and a
  fourth key for the time of the last backup.
- Plan Phases 4–6 move the site to Vercel, add Google sign-in, and store the
  data in a Neon Postgres database. Sign-in is **Neon Auth** (Neon's managed
  Better Auth) since batch 5.5. The evaluation behind the plan is
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

**Phase 5 is complete.** Sign-in works on production: Google, through **Neon's
Managed Better Auth**, with the allowlist enforced by a `user.before_create`
webhook this project hosts and whose refusal was proven against a real Neon
call. The self-run Better Auth server built earlier in the phase was removed in
batch 5.7 — the switch and its costs are recorded in
[5.5](docs/plan/p5-05-switch-to-neon-auth.md).

**Nothing of the teacher's is stored on any server.** `public` holds no tables;
the planner is still local-first and Phase 6 is what changes that.

Batch [5.4](docs/plan/p5-04-security-review.md)'s security review is walked and
every row has a result. **Two rows failed and are the owner's**: Dependabot
alerts are off, and `main` has no branch protection, so a red suite can merge
and deploy. The second should be fixed before Phase 6's batch 6.3, which is when
her data first reaches a server.

Phase 4 (hosting migration) is in progress. Batches 4.1, 4.2 and 4.3a are
merged. **Batch 4.3, the cutover, waits on the owner** — the teacher has to
migrate her own data — and 4.4 then waits out a 60–90 day transition window.
See [deployment.md](.claude/context/deployment.md). All of Phase 5 (batches 5.0
to 5.8) merged ahead of 4.3 and 4.4, because none of it stores the teacher's
data. Phases 4–6 were planned on 2026-09-09 from
[RP-10](docs/research/rp10-service-evaluation/rp10-service-evaluation.md).

The review of 2026-10-17,
[RP-11](docs/research/rp11-docs-process-review/rp11-docs-process-review.md),
found that the records had not kept up with the switch to Neon Auth, and that
TDD was not recorded for feature work. Batch 5.9 corrects the records. A new
phase, **T — Test process (ISTQB)**, comes before Phase 6.

## The decision rule

**Every global or architectural decision is recorded in the relevant grouped
context file and referenced from CLAUDE.md — never written inline in task
tickets or scattered across the repo.** If you make such a decision, add it to
the right file below in the same pull request. If a decision is not made yet,
the file marks it `TBD`.

## Context files (grouped decisions)

| File                                                                                 | Topic                                                                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [.claude/context/testing.md](.claude/context/testing.md)                             | Test tools, test style (BDD, TDD), locators, ISTQB techniques, snapshots                                  |
| [.claude/context/linting-formatting.md](.claude/context/linting-formatting.md)       | Prettier, ESLint presets, code style                                                                      |
| [.claude/context/react-migration.md](.claude/context/react-migration.md)             | What Vite is, migration stages, staging path, icons                                                       |
| [.claude/context/state-management.md](.claude/context/state-management.md)           | State approach: built-in reducer + context, Redux Toolkit migration triggers, drafts                      |
| [.claude/context/storage-data-contract.md](.claude/context/storage-data-contract.md) | The localStorage keys (three data keys and the backup time), shapes, origin rule, staging prefix          |
| [.claude/context/deployment.md](.claude/context/deployment.md)                       | GitHub Pages today, the move to Vercel, merge-target rule, cutover, rollback                              |
| [.claude/context/security-auth.md](.claude/context/security-auth.md)                 | Personal data rule, secrets, Google sign-in through Neon Auth, the allowlist webhook, processors and DPAs |
| [.claude/context/backend.md](.claude/context/backend.md)                             | The one API function (Hono), database access, Drizzle migrations, PGlite, local serving                   |

## Repository layout (today)

- `app/` — the application. `app/src/` holds the components, the pure modules
  (`store.ts`, `route.ts`, `storage.ts`, `schedule.ts`, `csv.ts`, `backup.ts`,
  `message.ts`, `format.ts`, `contrast.ts`, `auth-client.ts`), a
  `*.module.css` beside each of the seven components that has one, and `styles.css` for the tokens, the element
  rules and the shared primitives. Every colour token's contrast ratio is
  asserted from that stylesheet by `contrast.test.ts`, with a completeness
  guard — a hex token in no checked pair fails the suite unless it carries a
  written exemption.
- `CLAUDE.md` — this file.
- `.claude/context/` — grouped decision files (see table above).
- `docs/plan/` — the phased execution plan: a hub page and one page per PR batch.
- `docs/research/` — eleven research reports (markdown is the source of
  record); RP-10 and RP-11 are small markdown wikis.
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

| Command                                   | What it does                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm ci`                                  | Install the pinned toolchain.                                                                 |
| `npm run typecheck`                       | `tsc --noEmit`.                                                                               |
| `npm run format` / `npm run format:check` | Prettier over everything not in `.prettierignore`.                                            |
| `npm run serve`                           | Build the app, then serve it **and the API** on `http://localhost:4173`. Refuses a busy port. |
| `npm run dev:app`                         | Vite dev server with hot reload.                                                              |
| `npm run lint`                            | ESLint over everything.                                                                       |
| `npm run test:unit`                       | Vitest over both projects: `app/src/**/*.test.ts` and `api/**/*.test.ts`.                     |
| `npm run typecheck:app`                   | `tsc --noEmit` on the app's tsconfig — JSX and DOM libs.                                      |
| `npm run typecheck:api`                   | `tsc --noEmit` on `api/tsconfig.json` — `api/` and `scripts/`.                                |
| `npm run test:e2e`                        | The Playwright suite against the built app.                                                   |
| `npm run check:pii`                       | Fails on bank or tax identifier shapes in tracked source.                                     |
| `npm run db:generate`                     | drizzle-kit: turn `db/schema.ts` into SQL under `db/migrations/`.                             |
| `npm run db:migrate`                      | drizzle-kit: apply those migrations. Needs `DATABASE_URL_UNPOOLED`.                           |

- `e2e/` — the Playwright suite (plan batch 1.3): `ui/` holds fixtures, page
  objects and the Screenplay layer; `features/` holds the specs.
- `api/` — the backend (plan batch 4.2): `[...all].ts` is one Hono application
  **and** the Vercel entry, in one file. It serves `GET /api/health` and, since
  batch 5.6, `POST /api/hooks/neon-auth`, the allowlist webhook that Neon calls
  before it creates a user. `package.json` declares the subtree ESM.
  **Why one file:** Vercel compiles each file here on its own, and Node 24 strips
  types. The two disagree about how a relative import is spelled. So a file with
  no relative import is the only file both can load (lesson 26).
  `api/tsconfig.json` is its own TypeScript project, and it must stay inside
  `api/`, because ESLint's `projectService` finds a file's project by walking up
  from the file.
- `scripts/serve.mjs` — the local server (plan batch 4.2). Serves `app/dist`
  and mounts the same Hono app under `/api` on port 4173, which is what
  Playwright's `webServer` starts. It replaces `vite preview`, and like it,
  refuses a busy port.
- `vercel.json` — the region (plan batch 4.1), the `/api/:path*` rewrite
  (5.2b) and the response headers, including the Content-Security-Policy
  (5.4a). The Vercel project exists since 2026-09-15.
- `neon.ts` — the Neon config-as-code policy (plan batch 5.0), deliberately
  empty, so every Neon service stays unmanaged. It is in the **root**
  TypeScript project: a root-level `.ts` file in no project fails typed
  linting on the file itself. `.neon` pins the linked project and is ignored.
- `db/` — the migrations folder, the PGlite helper and the Drizzle schema
  (plan batches 5.1a–5.2a). **The schema is empty since batch 5.7**: Neon owns
  the sign-in tables, and the app's own tables arrive in Phase 6. `migrations/`
  holds only drizzle-kit's journal.
  **Nothing deployed imports any of it.** `schema.ts` and
  `migrations/` are drizzle-kit's; `testing.ts` makes an in-process Postgres and
  is imported only by the unit tests and `scripts/serve.mjs`. It is an npm
  workspace package so those callers get a bare specifier, but the Vercel
  function does not use it: **the deployed entry may import published npm
  packages and nothing else.** A workspace package of TypeScript source is
  traced by Vercel and then not shipped, which cost one failed production
  deployment — lesson 31, and `api/deployed-entry.test.ts` now fails on any
  entry import that resolves to a `.ts` file. `db/**` sits in the **root**
  TypeScript project, like `neon.ts`.
- Not present yet: `shared/` arrives with plan Phase 6. Its layout is decided
  in [backend.md](.claude/context/backend.md).

`npm run test:e2e` ran 204 tests in 38 files at batch 5.7, with **no `fixme`
pins left**; `npm run test:unit` ran 374. Both counts change in every batch. Use
them as a rough check, not as a goal.

Unit tests that touch the database are slow on purpose, not by accident: PGlite
is Postgres compiled to WebAssembly, and it costs about 3.8 seconds for the
first database in a process and 1.5 for each one after. `api/vitest.config.ts`
allows 30 seconds a test for that reason. Share a database unless isolation is
the thing under test.

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
- **There are three TypeScript projects, and `npm run typecheck` is only one
  of them.** The root `tsconfig.json` includes `e2e/**`, `db/**`,
  `drizzle.config.ts`, `neon.ts`, `playwright.config.ts` and
  `vitest.config.ts`; `app/tsconfig.json` covers `app/src`;
  `api/tsconfig.json` covers `api/` and `scripts/`. Run all three locally:
  `typecheck`, `typecheck:app`, `typecheck:api`. CI has run the first two since
  2026-09-12 and the third since batch 4.2, so a type error anywhere turns a PR
  red; before that only `deploy.yml` would have caught an app error, after merge.

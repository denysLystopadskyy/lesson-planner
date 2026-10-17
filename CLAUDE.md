# Lesson Planner — project guide

## What this project is

A small web app for one teacher. She plans lesson dates for her teaching groups,
sets prices, and copies a payment message for each month. It is a React app
built with Vite, in `app/`.

- **The teacher** is the app's one user. **The owner** is the maintainer who
  runs these sessions and decides for the project.
- **She uses GitHub Pages:** `https://denyslystopadskyy.github.io/lesson-planner/`.
  Pages serves static files only, so nothing she uses talks to a server.
- **A Vercel production deployment also exists**, with the same app and the API
  in `api/`. She moves to it in batch 4.3.
- **All her data is in the browser's `localStorage`**: three data keys and a
  fourth key for the time of the last backup. No data of hers is on any server.
- The plan moves the site to Vercel, adds Google sign-in, and then stores the
  data in a Neon Postgres database. Sign-in is **Neon Auth** (Neon's managed
  Better Auth) since batch 5.5.

## How we test and build — read before any work

We use ISTQB terms (International Software Testing Qualifications Board) and
test-driven development (TDD). The strategy is
[testing.md](.claude/context/testing.md) Part 1.

1. **Load the skills.** At the start of any batch, and before you plan, write
   or review a test, load `istqb-foundation:istqb-foundation-level` and
   `istqb-test-design:istqb-advanced-level-test-analyst`. Before you change a
   file in `app/`, `api/`, `db/`, `scripts/` or `e2e/`, load
   `superpowers:test-driven-development`. If a skill is not available, tell the
   owner and follow testing.md Part 1. Details:
   [agentic-setup.md](.claude/context/agentic-setup.md).
2. **Start each batch page from [batch-template.md](docs/plan/batch-template.md)**
   and fill every section.
3. **Red commit first.** Commit the failing tests as `Red: …`, then the code as
   `Green: …`. Record both SHAs and the failure message in the page's TDD log.
   When no test can fail first, name an exception from
   [testing.md §1.5](.claude/context/testing.md#15-how-we-develop-tdd-and-bdd).
   Those exceptions are the owner's answer given in advance: where the TDD skill
   says "ask your human partner", §1.5 decides.
4. **In the page's test conditions table**, give each test condition a test
   level, a test type, a technique and its coverage items. Write the technique
   in the `describe` title of each coverage group.
5. **A known defect gets a DEF row** with severity and priority, and a test
   marked `test.fixme` — or the row says why no test can describe it. Running
   that test after the fix is confirmation testing.

## Where the project stands

The phases, the merge order and every batch page are in the
[plan hub](docs/plan/README.md). The research is in
[docs/research/](docs/research/README.md). Four facts every session needs:

- **Every merge to `main` deploys** to the teacher, and `main` has **no branch
  protection**, so a red suite can merge. Merge only on green CI.
- **Phase 4 waits on the owner:** batch 4.3 needs the teacher to move her own
  data. Phases 1, 2, 3 and 5 are complete.
- **Phase T (test process, ISTQB) comes next**, and Phase 6 (her data in the
  database) starts after it.
- The app was one file, `index.html`, until batch 2a.4. Git history has it, and
  the older research reports cite its line numbers.

## The decision rule

**Record every global or architectural decision in the right context file below,
in the same pull request.** Do not put a decision in a ticket, a batch page or a
code comment only. If a decision is not made yet, the file marks it `TBD`.

## Context files (grouped decisions)

- [testing.md](.claude/context/testing.md) — the test strategy in ISTQB terms
  (levels, types, techniques, TDD, entry and exit criteria, defects, risks), and
  the test automation rules.
- [agentic-setup.md](.claude/context/agentic-setup.md) — the skills a session
  loads, plugins, MCP servers (Vercel, Neon), hooks, memory.
- [linting-formatting.md](.claude/context/linting-formatting.md) — Prettier,
  ESLint presets, code style.
- [react-migration.md](.claude/context/react-migration.md) — Vite, the migration
  stages, the staging path, icons.
- [state-management.md](.claude/context/state-management.md) — the built-in
  reducer and context, when to move to Redux Toolkit, drafts.
- [storage-data-contract.md](.claude/context/storage-data-contract.md) — the
  `localStorage` keys, their shapes, the origin rule, the staging prefix.
- [deployment.md](.claude/context/deployment.md) — GitHub Pages, the move to
  Vercel, the merge-target rule, cutover, rollback.
- [security-auth.md](.claude/context/security-auth.md) — the personal data rule,
  secrets, Google sign-in through Neon Auth, the allowlist webhook, processors.
- [backend.md](.claude/context/backend.md) — the one API function (Hono),
  database access, Drizzle migrations, PGlite, local serving.

## Repository layout

- `app/` — the React app. `app/src/` holds the components, the pure modules and
  their tests, a CSS module beside each component that has one, and
  `styles.css` for the design tokens.
- `api/` — the backend: `[...all].ts` is one Hono app **and** the Vercel entry,
  in one file (lesson 26). It serves `GET /api/health` and
  `POST /api/hooks/neon-auth`, the allowlist webhook. **The deployed entry may
  import published npm packages only — never a project file** (lesson 31).
  `api/tsconfig.json` must stay inside `api/`, because ESLint's
  `projectService` finds a file's project by walking up from the file. Details:
  [backend.md](.claude/context/backend.md).
- `db/` — the Drizzle schema (empty until Phase 6), migrations and the PGlite
  helper. Only the unit tests and `scripts/serve.mjs` import it.
- `e2e/` — the Playwright suite: `ui/` holds fixtures, page objects and the
  Screenplay layer; `features/` holds the specs.
- `scripts/` — `serve.mjs` (the local server: the built app and the API on port
  4173), `check-no-personal-data.mjs` (the build check for personal data), and
  `probe-deployment.mjs` (run by hand: it reports which page a deployment
  answers with).
- `vercel.json` — the region, the `/api` rewrite and the response headers.
  `neon.ts` — the Neon policy, empty on purpose.
- `docs/plan/` — the plan: the hub, one page per batch, the DEF registry, the
  lessons. `docs/research/` — eleven research reports.
- `.github/workflows/` — CI (advisory), the GitHub Pages deploy, and
  `baselines.yml`, a manual run that renders the Linux pixel baselines.
- `shared/` arrives in Phase 6; its layout is decided in backend.md.

## Commands

| Command                                   | What it does                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm ci`                                  | Install the pinned toolchain.                                                         |
| `npm run format` / `npm run format:check` | Prettier over everything not in `.prettierignore`.                                    |
| `npm run lint`                            | ESLint over everything.                                                               |
| `npm run typecheck`                       | `tsc` on the root project (`e2e/`, `db/`, the config files).                          |
| `npm run typecheck:app`                   | `tsc` on `app/src`.                                                                   |
| `npm run typecheck:api`                   | `tsc` on `api/` and `scripts/`.                                                       |
| `npm run test:unit`                       | Vitest: `app/src/**/*.test.ts` and `api/**/*.test.ts`.                                |
| `npm run test:e2e`                        | Playwright against the built app and the local API.                                   |
| `npm run check:pii`                       | Fails on a bank or tax identifier shape in tracked source.                            |
| `npm run serve`                           | Build the app, then serve it and the API on `http://localhost:4173`.                  |
| `npm run dev:app`                         | Vite dev server with hot reload.                                                      |
| `npm run probe:deployment -- <url>`       | Two requests to one deployment; says which page answered. By hand only.               |
| `npm run db:generate` / `db:migrate`      | drizzle-kit: make SQL from `db/schema.ts` / apply it (needs `DATABASE_URL_UNPOOLED`). |

## Working rules

- **Write documentation in plain English at B2 level.** Short sentences. No
  idioms. Expand an abbreviation the first time you use it.
- Follow TypeScript strict style; avoid `any`. Keep functions small. Use 2-space
  indentation, descriptive names and kebab-case file names.
- A CSS-module class is `string | undefined` under `noUncheckedIndexedAccess`.
  Join class names with `cx()` from `app/src/cx.ts`, never a template string.
- **There are three TypeScript projects.** Run all three typechecks locally:
  `typecheck`, `typecheck:app`, `typecheck:api`. CI runs all three.
- **Stop any server you started with `npm run serve` before you run the suite.**
  Playwright reuses a running server locally, and it may serve an old build.
- **Database unit tests are slow on purpose.** PGlite is Postgres in
  WebAssembly. Share one database unless the test is about isolation.
- **Commits:** a short, imperative subject ("Add lesson duplication flow"), and
  the reason in the body. Batch branches use the `Red:`, `Green:` and
  `Refactor:` prefixes (see above).
- **Pull requests:** one plan batch per pull request, linked to its page in
  `docs/plan/`, into `main` ([deployment.md](.claude/context/deployment.md)).
  Never enable auto-merge. Never merge a red pull request.
- **A batch must be able to meet its own exit criteria** with only what it
  ships. Check this before you start. If a criterion needs a file from a later
  batch, move the file or move the criterion, and record which on the page.
- **If a recorded rule cannot be honoured, change the record.** Never write a
  weak test, a fake check or a hedged claim so that a rule looks satisfied. Say
  why the rule does not fit and what replaced it. One invented entry makes the
  whole record untrustworthy.
- **Never commit** secrets, `node_modules/`, `test-results/` or
  `playwright-report/`. **Never print or ask for a token or secret value.**
- **An MCP write** (an environment variable, a deployment, a database branch)
  needs the owner's yes in the chat. Reads are free. Details:
  [agentic-setup.md](.claude/context/agentic-setup.md).
- **The main checkout at `/Users/denyslystopadskyy/IdeaProjects/lesson-planner`
  shares this repository's `.git`.** Never run `git checkout`, `git stash`,
  `git add` or any other command that changes the index there. It would destroy
  staged work on another branch, and the stash stack is shared. Work in a
  worktree.
- **Personal data rule.** The owner's real payment identifiers are still in git
  history. A spec that renders a payment message must seed its own template.
  `npm run check:pii` fails the build on an IBAN (International Bank Account
  Number) shape or a long digit run. See
  [security-auth.md](.claude/context/security-auth.md).

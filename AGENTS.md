# Repository Guidelines

## Project Structure & Modules
- `index.html` is the entry point; client assets live alongside it.
- `e2e/` holds Playwright specs and fixtures; snapshots and traces output to `test-results/` (generated).
- `docs/` contains reference docs; update when behaviour or APIs change.
- `playwright.config.ts` centralizes test settings (base URL, traces, retries).

## Setup, Build & Run
- Install deps: `npm install`.
- Start dev server (port 4173): `npm run serve`.
- Run end-to-end suite: `npm run test:e2e`.
- Open Playwright UI for focused debugging: `npm run test:ui`.
- Update snapshots: `npm run test:update`.
- Inspect the latest trace: `npm run test:trace`.

## Coding Style & Naming
- Use TypeScript types instead of `any`; keep functions small and intention-revealing.
- Follow Clean Code / Clean Architecture: separate domain logic from UI concerns; avoid overvalidation.
- Prefer 2-space indentation, descriptive names (`lessonPlanForm`, `scheduleService`), and kebab-case filenames for components/utilities.
- Keep pure helpers in `src`-style utility modules; keep Playwright helpers in `e2e` fixtures.

## Testing Guidelines
- Framework: Playwright; keep tests atomic with no shared state between specs.
- Use `faker` for generated data; avoid reusing fixtures across suites unless immutable.
- Name specs after the user scenario (e.g., `lesson-creation.spec.ts`).
- Before committing, run `npm run test:e2e`; update snapshots only when UI changes are intentional.

## Commit & Pull Request Practices
- Commits: short, imperative subjects (“Add lesson duplication flow”); group related changes.
- Include why the change is needed in the body when non-obvious; reference tickets/issues where applicable.
- PRs: provide a concise summary, testing notes (`npm run test:e2e`), and screenshots/GIFs for UI changes.
- Keep diffs focused; prefer smaller PRs with clear acceptance criteria.

## Security & Configuration Tips
- Never commit `test-results/`, `playwright-report/`, or `node_modules/`; they are generated.
- Keep secrets out of the repo; rely on env vars or `.env.local` that is gitignored.
- If changing server port or base URL, align `npm run serve` and `playwright.config.ts` to keep tests stable.

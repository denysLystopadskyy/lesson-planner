# Batch 1.6 — ESLint

Phase 1 · [Plan home](README.md) · Prev: [1.5](p1-05-feature-specs-2.md) · Next: [1.7](p1-07-ci-advisory.md)

## Goal

Add ESLint with official presets and make the whole TypeScript corpus pass.

## Tasks

- [x] Flat config with: typescript-eslint `strictTypeChecked`,
      `eslint-plugin-playwright` recommended (scoped to `e2e/`),
      `eslint-config-prettier` last.
- [x] No hand-written rules. Two plugin **options** are configured and no rule
      is switched off — reasons in
      [linting-formatting.md](../../.claude/context/linting-formatting.md).
- [x] Fix all findings in the existing specs and helpers.
- [x] Add script `lint`.

## Installed versions

| Package                    | Version |
| -------------------------- | ------- |
| `eslint`                   | 10.10.0 |
| `typescript-eslint`        | 8.69.0  |
| `eslint-plugin-playwright` | 2.11.0  |
| `eslint-config-prettier`   | 10.1.8  |

The TypeScript pin held at 6.0.3 did its job: `typescript-eslint@8.69.0`
installed with no `ERESOLVE`, which is exactly what the exception in
[linting-formatting.md](../../.claude/context/linting-formatting.md) exists to
protect.

## From 98 findings to zero, without switching a rule off

| Step                                                | Findings left |
| --------------------------------------------------- | ------------- |
| First run                                           | 98            |
| Register spec-local test objects in `globalAliases` | 35            |
| Give `expect-expect` the Screenplay assertion names | 34            |
| Fix the code                                        | 0             |

**63 of the original 98 were one rule.** `playwright/no-standalone-expect` fired
on every `expect` in every spec. The first guess — that the Screenplay layer is
structurally incompatible with it — was wrong: all 63 were in spec files,
because each spec builds its own test object with `configureTest(...)` and the
plugin recognises a test block by name. Registering those names keeps the rule
doing its real job, which is catching an `expect` at module scope that would
never run.

The rest were genuine and are fixed rather than suppressed:

- **`require-await` (11)** — Screenplay questions that only read a locator were
  `async` with nothing to await. `Question<T>` now returns `T | Promise<T>`, so
  a question that answers synchronously can say so. `Actor.asks` awaits either.
- **`restrict-template-expressions` (16)** — numbers interpolated into strings,
  now wrapped in `String(...)`.
- **`no-unnecessary-condition` (3)** — see the tsconfig change below.
- **`await-thenable`, `no-confusing-void-expression`** — an `await` on a
  non-Promise inside another expression, split into two statements.
- **`no-unnecessary-type-parameters`, `no-unnecessary-type-assertion`** — a
  single-use generic and a redundant cast in `actor.ts`.

## `noUncheckedIndexedAccess` is now on

`no-unnecessary-condition` called `?? "UAH"` in `planner-state.ts` dead code.
The fallback is correct — the group list can be empty — but `groups[0]` was
typed as always present, so TypeScript believed the guard could never fire.
Deleting the fallback would have introduced a real bug.

The lint was right and the types were wrong. `noUncheckedIndexedAccess` makes an
index access `T | undefined`, which is what it is; the rule then agreed the
guard was needed. Two other accesses were made honest in the same change — a
weekday lookup, now a `readonly` tuple indexed by a literal union, and the year
segment of a month key, which now falls back rather than asserting.

## Acceptance criteria

- [x] `npx eslint . --max-warnings 0` exit 0.
- [x] `npm run typecheck` exit 0.
- [x] `npx prettier --check .` exit 0.
- [x] `npx playwright test --repeat-each=3` — 90 passed, 3 skipped, no flaky
      retries. The behaviour of the suite is unchanged by the lint fixes.

## Merge order and dependencies

Depends on 1.5 (type-checked linting needs the spec corpus). Merges before 1.7.
This is why ESLint comes after the specs, not before. Deployable: yes —
`index.html` is unchanged.

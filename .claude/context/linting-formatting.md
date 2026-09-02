# Linting and formatting

Decisions about code style tools. Referenced from [CLAUDE.md](../../CLAUDE.md).

## Decided

- **Prettier** formats all code and markdown we author.
  - `index.html` is excluded until the legacy file is deleted (plan batch 2a.4).
    Reason: formatting it creates a huge diff and breaks line references used
    by the research reports.
  - `docs/research/` is excluded permanently. It is an archive.
- **ESLint** uses the flat config format with official presets only:
  - `typescript-eslint` `strictTypeChecked` (strict + type-checked rules).
  - `eslint-plugin-playwright` recommended config for `e2e/`.
  - `eslint-config-prettier` last, to disable style rules Prettier owns.
- **Presets over hand-written rules.** Add a custom rule only when a preset
  does not cover a stated need, and record the need here.
- ESLint lands after the spec corpus exists (plan batch 1.6). Type-checked
  linting needs TypeScript files to check.
- Style basics: 2-space indentation, kebab-case filenames, no `any`.
- **Dependencies are raised to the latest stable version** when installed
  (user decision, 2026-08-20). Record the chosen versions in the lockfile and
  in the batch page; never invent version numbers in documents.

## TBD

- Exact tool versions — pinned by `package-lock.json` in plan batch 1.1.
- Whether any custom ESLint rule is ever needed (none expected).

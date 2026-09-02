# Batch 1.6 — ESLint

Phase 1 · [Plan home](README.md) · Prev: [1.5](p1-05-feature-specs-2.md) · Next: [1.7](p1-07-ci-advisory.md)

## Goal

Add ESLint with official presets and make the whole TypeScript corpus pass.

## Tasks

- [ ] Flat config with: typescript-eslint `strictTypeChecked`,
      `eslint-plugin-playwright` recommended (scoped to `e2e/`),
      `eslint-config-prettier` last.
- [ ] No hand-written rules. If one seems needed, record the need in
      [linting-formatting.md](../../.claude/context/linting-formatting.md) first.
- [ ] Fix all findings in the existing specs and helpers.
- [ ] Add script `lint`.

## Acceptance criteria

- `npx eslint . --max-warnings 0` exit 0.

## Merge order and dependencies

Depends on 1.5 (type-checked linting needs the spec corpus). Merges before 1.7.
This is why ESLint comes after the specs, not before. Deployable: yes.

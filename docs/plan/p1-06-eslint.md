# Batch 1.6 — ESLint

Phase 1 · [Plan home](README.md) · Prev: [1.5](p1-05-feature-specs-2.md) · Next: [1.7](p1-07-ci-advisory.md)

## Goal

Add ESLint with official presets and make the whole TypeScript corpus pass.

## Before starting

**Do not raise TypeScript first.** It is pinned at 6.0.3 precisely so this batch
can install: `typescript-eslint@8.69.0` declares `typescript: ">=4.8.4 <6.1.0"`,
and npm `latest` is 7.0.2, which fails with a hard `ERESOLVE`. The pin and its
expiry condition are in
[linting-formatting.md](../../.claude/context/linting-formatting.md); the story
is in [Lessons learned](lessons-learned.md).

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

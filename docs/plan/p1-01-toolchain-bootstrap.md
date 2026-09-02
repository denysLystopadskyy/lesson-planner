# Batch 1.1 — Toolchain bootstrap

Phase 1 · [Plan home](README.md) · Prev: [1.0](p1-00-docs-and-memory-bootstrap.md) · Next: [1.2](p1-02-land-test-hooks.md)

## Goal

Commit the Node toolchain (package.json, TypeScript, Prettier) so the repo can
run checks, without touching the served page.

## Tasks

- [ ] Create `package.json` from the working-copy scaffold. Raise every
      dependency to the latest stable version at install time. Commit the
      lockfile.
- [ ] Create `tsconfig.json`. Replace `moduleResolution: "node"` (removed in
      TypeScript 6) with a supported value, for example `"bundler"` or
      `"nodenext"`; `npm run typecheck` must pass.
- [ ] Add Prettier with scripts `format` and `format:check`.
- [ ] Add `.prettierignore`: `index.html` (until batch 2a.4) and
      `docs/research/` (permanent). Reasons are in
      [linting-formatting.md](../../.claude/context/linting-formatting.md).
- [ ] Format all files that are not ignored.
- [ ] Record the installed versions in this page.

## Acceptance criteria

- `npm ci` exit 0.
- `npm run typecheck` exit 0.
- `npx prettier --check .` exit 0.
- `git diff` shows no change to `index.html`.

## Merge order and dependencies

Depends on 1.0. Merges before 1.2. Deployable: yes (no served file changes).

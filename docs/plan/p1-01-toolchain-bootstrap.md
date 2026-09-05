# Batch 1.1 — Toolchain bootstrap

Phase 1 · [Plan home](README.md) · Prev: [1.0](p1-00-docs-and-memory-bootstrap.md) · Next: [1.2](p1-02-land-test-hooks.md)

## Goal

Commit the Node toolchain (package.json, TypeScript, Prettier) so the repo can
run checks, without touching the served page.

## Tasks

- [x] Create `package.json` from the working-copy scaffold. Raise every
      dependency to the latest stable version at install time. Commit the
      lockfile.
- [x] Create `tsconfig.json`. Replace `moduleResolution: "node"` (removed in
      TypeScript 6) with a supported value; `npm run typecheck` must pass.
      Landed as `"nodenext"`. The ticket also offered `"bundler"`; that turned
      out to be wrong here — see amendment 3.
- [x] Add Prettier with scripts `format` and `format:check`.
- [x] Add `.prettierignore`: `index.html` (until batch 2a.4) and
      `docs/research/` (permanent). Reasons are in
      [linting-formatting.md](../../.claude/context/linting-formatting.md).
- [x] Format all files that are not ignored.
- [x] Record the installed versions in this page.
- [x] Move `playwright.config.ts` in from batch 1.3 (see the amendment below).
- [x] Add `@types/node`, missing from the scaffold (see the amendment below).

## Installed versions

Read from `package-lock.json` at install time on 2026-09-05. Node v24.10.0,
npm 11.6.0.

| Package            | Version |
| ------------------ | ------- |
| `@faker-js/faker`  | 10.6.0  |
| `@playwright/test` | 1.63.0  |
| `@types/node`      | 26.4.1  |
| `http-server`      | 14.1.1  |
| `prettier`         | 3.9.6   |
| `typescript`       | 6.0.3   |

Versions are pinned exactly, not as ranges. A project `.npmrc` sets
`save-exact=true` so this holds on any machine, not only one whose global npm
config happens to set it. Reason and the TypeScript exception are recorded in
[linting-formatting.md](../../.claude/context/linting-formatting.md).

## Amendments to this batch

Four things in the original ticket did not survive contact with the toolchain.
All four were checked against the real scaffold before the change was made.

### 1. TypeScript is 6.0.3, not the latest 7.0.2

npm `latest` is TypeScript 7.0.2. Installing it breaks batch 1.6:
`typescript-eslint@8.69.0` declares `typescript: ">=4.8.4 <6.1.0"`, so
`npm install typescript-eslint` fails with `ERESOLVE`. TypeScript 6.0.3
typechecks the whole scaffold at exit 0 and sits inside that range.

This is a deliberate exception to the recorded "raise to latest stable" rule.
The exception and its expiry condition are recorded in
[linting-formatting.md](../../.claude/context/linting-formatting.md).

### 2. `playwright.config.ts` moved here from batch 1.3

The ticket asked for `npm run typecheck` to exit 0, but the tsconfig `include`
is `["e2e/**/*.ts", "playwright.config.ts"]` and both arrive in batch 1.3. With
neither present, `tsc` fails with `TS18003 No inputs were found in config file`.

`playwright.config.ts` is repo-root toolchain config, not test code, so it
belongs in this batch. With it present and `e2e/` still absent, the same
tsconfig exits 0. Batch 1.3 keeps the fixtures, page objects, Screenplay layer,
smoke spec and testid-contract spec.

Playwright itself is not run in this batch. A `testDir` that does not exist yet
is expected until 1.3.

### 3. `moduleResolution` is `nodenext`, paired with `module: "nodenext"`

The ticket offered `"bundler"` or `"nodenext"`. `"bundler"` is wrong here: it is
invalid with `module: "commonjs"`, and this is Node-hosted test code, not
bundler input. The decision is the **pair**, not the single field:

```json
"module": "nodenext",
"moduleResolution": "nodenext"
```

Verified at exit 0 over all 38 scaffold files, including the ESM-only
`@faker-js/faker@10`.

### 4. `@types/node` added

The scaffold's tsconfig sets `"types": ["node", "@playwright/test"]` but its
package.json never depended on `@types/node`. Every `process.env` reference
failed with `TS2591`. This batch adds the dependency.

## Acceptance criteria

- [x] `npm ci` exit 0.
- [x] `npm run typecheck` exit 0.
- [x] `npx prettier --check .` exit 0.
- [x] `git diff` shows no change to `index.html`.

## Merge order and dependencies

Depends on 1.0. Merges before 1.2. Deployable: yes (no served file changes).

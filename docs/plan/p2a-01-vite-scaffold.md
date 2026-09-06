# Batch 2a.1 — Vite scaffold in app/

Phase 2a · [Plan home](README.md) · Prev: [1.13](p1-13-storage-contract.md) · Next: [2a.2](p2a-02-deploy-workflow-runbook.md)

## Goal

Add the React build tooling in a subdirectory without changing the served page.

Vite is explained in
[react-migration.md](../../.claude/context/react-migration.md).

## Tasks

- [x] Create the Vite + React + TypeScript project in `app/` (root option in
      `vite.config.ts`). Latest stable versions; recorded below.
- [x] `base` comes from the CLI flag; storage prefix from
      `VITE_STORAGE_PREFIX`. Neither is hardcoded in the config.
- [x] Placeholder `<App>` renders a title only.
- [x] Add `app` build and preview scripts to the root `package.json`.
- [x] State in the PR that raw `app/` sources are published while Pages
      publishes from the branch root.

## Installed versions

Read from `package-lock.json` on 2026-09-06.

| Package                | Version |
| ---------------------- | ------- |
| `vite`                 | 8.2.2   |
| `@vitejs/plugin-react` | 6.1.1   |
| `react`                | 19.2.8  |
| `react-dom`            | 19.2.8  |
| `@types/react`         | 19.2.18 |
| `@types/react-dom`     | 19.2.7  |

`react` and `react-dom` are **dependencies**, not dev dependencies: they are
bundled into the shipped output rather than used only at build time.

## One package.json, one node_modules

`app/` has no `package.json` of its own. The root one gains four scripts —
`dev:app`, `build:app`, `preview:app` and `typecheck:app` — each pointing at
`app/vite.config.ts`, whose `root` is its own directory. One dependency tree is
simpler to keep lint, formatting and CI pointed at, and nothing here needs the
isolation a second one would buy.

`app/` has its own `tsconfig.json`, because the two halves of this repo compile
differently: the tests are Node-hosted CommonJS, the app is browser ESM with
JSX. `noUncheckedIndexedAccess` is on in both, matching the decision from batch
[1.6](p1-06-eslint.md).

## Both deploy knobs verified, not just written

**`base` is not in the config.** It appears twice in `vite.config.ts` and both
are comments explaining why it is absent; there is no `base:` key. Building with
`--base=/lesson-planner/next/` produced
`src="/lesson-planner/next/assets/index-*.js"`. Getting this wrong is how a
project Pages site 404s every asset, so it is passed per build rather than
edited here.

**The storage prefix reaches the bundle.** Building with
`VITE_STORAGE_PREFIX=next:` bakes `next:groupLessonPlannerData` into the
JavaScript; building without it produces the bare key. That was checked with
`src/storage-keys.ts` temporarily imported, because **nothing imports it yet** —
the placeholder `<App>` renders a title, so Vite tree-shakes the module out of a
normal build. It is the seed batch [2a.3a](p2a-03a-port-shell-storage.md) grows
the storage adapter from, and that batch is where the prefix starts being
exercised for real.

## Lint and formatting really do cover app/

Checked by probe rather than assumed. `eslint app` inspects five files. A
deliberate `any` in `app/src/` produced `no-explicit-any` and
`no-unsafe-return`; a badly formatted file produced a Prettier warning. Both
probes were removed.

## The served page is untouched

`git diff` reports no change to `index.html`, and its SHA-256 matches the live
page byte for byte:

```
0612db527a8b38395ecbffa126f71fdf2faf3c7e1d859c3329c2af7264822eb8
```

**While Pages publishes from the branch root, the raw `app/` sources are also
served**, at `/lesson-planner/app/`. They are TypeScript and JSX that no browser
executes and nothing links to. This is harmless and it ends with the Actions
switch in batch [2a.2](p2a-02-deploy-workflow-runbook.md). `app/dist/` is
gitignored, so no build output is published.

## Acceptance criteria

- [x] `npm run build:app` exit 0; `app/dist/` contains the shell
      (`index.html` plus a hashed JS asset).
- [x] The live `/lesson-planner/` response is hash-identical before and after
      merge — nothing this batch adds is on that path.
- [x] ESLint and Prettier cover `app/`; `lint` and `format:check` exit 0.
- [x] `typecheck` (tests) and `typecheck:app` both exit 0.

## Merge order and dependencies

Depends on 1.7 (CI) and may start in parallel with 1.8–1.13 (touches only
`app/`). Merges after 1.13. Deployable: yes.

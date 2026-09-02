# React migration

Decisions about the move from one HTML file to React. Referenced from
[CLAUDE.md](../../CLAUDE.md). Background:
[RP-02 strategy](../../docs/research/rp02-react-migration/rp02-react-migration.md),
[RP-04 build and deploy](../../docs/research/rp04-build-deploy/rp04-build-deploy.md).

## What is Vite, and why we use it

Today the browser runs `index.html` directly. React and TypeScript need a build
step: something must turn TSX files into plain JavaScript and bundle them into
static files that GitHub Pages can serve. **Vite is that build tool.** It gives
a fast dev server for local work and a `vite build` command that outputs a
static `dist/` folder. We chose Vite because Create React App is deprecated,
because Vite's `base` option solves the sub-path problem of a project Pages
site (without it, asset URLs point at the domain root and return 404), and
because it pairs with Vitest for unit tests.

## Decided

- **Stack:** Vite + React + TypeScript.
- **The Vite project lives in the `app/` subdirectory.** The legacy root
  `index.html` stays the served page until cutover.
- **`base` and the storage-key prefix are set by environment variables**
  (`--base` flag, `VITE_STORAGE_PREFIX`). They are never edited inside
  `vite.config.ts`. This keeps every deploy change a one-line, revertable diff.
- **Staging:** the React build is served at `/lesson-planner/next/` on the same
  origin. Staging writes **prefixed** storage keys, so it can never damage the
  teacher's real data. Cutover removes the prefix and serves at `/`.
- **Stage 2a: one big `<App>`.** Port the existing logic mostly as-is into one
  root component, in four reviewable slices. Stage 2b: split into components,
  add styles, routing, and the state store.
- **Emoji icons are replaced with inline SVG icon components** during
  componentization (plan batch 2b.6). This removes OS-dependent rendering and
  unblocks pixel visual regression (user decision, 2026-08-20).
- **Accessibility target: WCAG 2.2 Level AA**, built into the components
  (dialog semantics, keyboard-operable calendar), not patched later.
- **Vestigial features are dropped on purpose** during the port. The list is in
  RP-01's feature inventory (classification column). Dropping them is a
  deliberate change, not a regression; each drop is named in its batch page.
- Group identity is an array index today. Routes may use the index; the
  limitation is documented in the routing batch. A stable id needs a schema
  change and waits for Phase 4.

## TBD

- CSS approach (plain CSS vs CSS Modules) — decided as an ADR in plan batch 2b.1.
- React and Vite versions — pinned by the lockfile in plan batch 2a.1.

# React migration

Decisions about the move from one HTML file to React. Referenced from
[CLAUDE.md](../../CLAUDE.md). Background:
[RP-02 strategy](../../docs/research/rp02-react-migration/rp02-react-migration.md),
[RP-04 build and deploy](../../docs/research/rp04-build-deploy/rp04-build-deploy.md).

## What is Vite, and why we use it

The browser ran `index.html` directly until the cutover in plan batch 2a.4.
React and TypeScript need a build step: something must turn TSX files into plain JavaScript and bundle them into
static files that GitHub Pages can serve. **Vite is that build tool.** It gives
a fast dev server for local work and a `vite build` command that outputs a
static `dist/` folder. We chose Vite because Create React App is deprecated,
because Vite's `base` option solves the sub-path problem of a project Pages
site (without it, asset URLs point at the domain root and return 404), and
because it pairs with Vitest for unit tests.

## Decided

- **Stack:** Vite + React + TypeScript.
- **The Vite project lives in the `app/` subdirectory.** The legacy root
  `index.html` was the served page until the cutover in plan batch 2a.4 deleted
  it.
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
  unblocks pixel visual regression (user decision, 2026-08-20). Shape decided in
  [ADR 2](../../docs/plan/p2b-01-logic-modules-adrs.md): one component per icon,
  `currentColor`, `em` sizing, `aria-hidden` with the name on the control, and
  **no icon font and no external request** — the app makes none today and has to
  work offline.
- **CSS: a global sheet for the base, a CSS Module per component**
  ([ADR 1](../../docs/plan/p2b-01-logic-modules-adrs.md), implemented by 2b.7).
  The global layer keeps the custom properties and the element-level defaults —
  `body`, `button`, `h1`, `textarea` — because the app styles plain elements.
  Everything else is scoped, so two components cannot collide and a rule nobody
  imports is visibly dead. That is the specific failure the legacy stylesheet
  had: rules nobody could attribute and therefore nobody could delete.
- **Accessibility target: WCAG 2.2 Level AA**, built into the components
  (dialog semantics, keyboard-operable calendar), not patched later.
- **Vestigial features are dropped on purpose** during the port. The list is in
  RP-01's feature inventory (classification column). Dropping them is a
  deliberate change, not a regression; each drop is named in its batch page.
- **The port reproduces known defects rather than fixing them in the porting
  batch**, unless the fix is a consequence of the code's shape and costs no
  extra code (batch 2a.3c). Fixes belong to Phase 3, so a cutover compares like
  with like. Each reproduction carries a comment naming its DEF at the site.
- **The stylesheet is ported verbatim before the cutover, not after it**
  (owner decision, 2026-09-06, plan batch 2a.3e). The plan originally styled the
  app in 2b.7, seven batches after the cutover, which would have made the live
  app unstyled for the whole of Phase 2b. `app/src/styles.css` is a copy of the
  legacy `<style>` block and is excluded from Prettier while it stays one; 2b.7
  still owns the per-component extraction, the colour tokens and the contrast
  fixes.
- **The port's default payment template is neutral**, not a copy of the legacy
  one — see [security-auth.md](security-auth.md).
- Group identity is an array index today. Routes may use the index; the
  limitation is documented in the routing batch. A stable id needs a schema
  change and waits for Phase 4.

## TBD

- React and Vite versions — pinned by the lockfile in plan batch 2a.1.

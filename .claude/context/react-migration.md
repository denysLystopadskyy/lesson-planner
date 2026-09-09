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
- **CSS Modules landed for six components and stopped there** (plan batch
  2b.7): `CalendarEditor`, `GroupModal`, `MonthlyOverrides`, `GroupCard`,
  `GroupList`, `Dialog`. The other five keep the global sheet, because a module
  would hold two rules, or would break an id rule, or the component has no rules
  at all. A module scopes classes and cannot scope an id, and this app is
  unusually id-keyed because batch 1.2 froze ids as the test contract — eight id
  rules stay global whatever the ADR says.
- **A test never locates by a styling class.** Where one did, it moved to the
  frozen hook or to the semantics: `aria-selected` rather than `.selected`,
  `[data-group-name]` rather than `.group-card`. `.modal` is the exception and
  stays a global name, because three page objects read `#<id> .modal`.
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
- **The calendar is a `role="grid"` with one tab stop and a roving tabindex**
  (plan batch 2b.4). Week rows are real `row` nodes made boxless with
  `display: contents`, so the accessibility tree has rows and the seven-column
  layout is unchanged — measured in Chromium before it was built. Day cells stay
  `<div>`s: introducing a `<button>` there loses the hover background to the
  stylesheet's element-level rule, and a `<table>` would move both screenshot
  baselines and start painting the weekend headings.
- **Arrow keys clamp inside the month; only Page Up and Page Down change it.**
  A spill re-renders the grid under the key press and then needs focus restored
  to a cell that did not exist a moment earlier, which is batch 1.10's flake
  class. The roving stop also follows focus arriving by click, or the arrows
  would move from wherever the stop began.
- **Dialogs are the native `<dialog>` element, opened with `showModal()`**
  (plan batch 2b.3, closing DEF-023). The browser then supplies the focus trap,
  the Escape key and — the part that cannot be hand-rolled — real inertness for
  everything behind, which is what `aria-modal="true"` had been claiming
  falsely. `Dialog.tsx` is the shared shell; it also remembers the element that
  opened it and puts focus back, because React unmounts the dialog rather than
  closing it, so the browser's own restore never runs.
- **A clickable card is a `<div>` with a `<button>` inside its heading**, not a
  card-wide button and not `role="button"` (plan batch 2b.2). A `<button>` may
  contain phrasing content only, so wrapping an `<h2>` is invalid; and both
  wrapper shapes re-parent the heading under a button node, which costs the
  document outline a screen-reader user skims by. The whole card stays clickable
  through a stretched `::after` on that button, which is also what keeps the
  pointer target big enough for WCAG 2.2 AA 2.5.8. No `aria-label` on such a
  button: a heading takes its accessible name from its contents, so labelling
  the descendant renames the heading.
- **A focus ring is drawn with `:has(:focus-visible)`, never `:focus-within`**,
  and in `#0f172a` rather than the accent green, which is about 2.7:1 against
  the page background and below the 3:1 WCAG 2.2 AA 1.4.11 asks of an indicator.
  `:focus-within` keeps the ring after a mouse click, where it shows through the
  modal overlay and moves screenshot baselines for a state no keyboard user is
  in.
- **Routes live in the hash** (plan batch 2b.9): `#/`, `#/group/<index>`,
  `#/group/new`, `#/template`. Not the History API — this is a project Pages
  site with no server to rewrite paths, so a real path would 404 on refresh and
  a shared link would be dead. Opening a dialog pushes an entry so Back closes
  it; closing goes back, except when the dialog was the entry point, which is
  marked in `history.state` — otherwise a shared link plus Escape would send
  someone out of the app. The review dialog is not a route: its content is
  generated, so a link could not restore what the sender saw.
- Group identity is an array index today. Routes may use the index; the
  limitation is documented in the routing batch. A stable id arrives with the
  schema change in plan batch
  [6.1](../../docs/plan/p6-01-schema-version-group-ids.md); routes then use
  `#/group/<id>`. A `#/account` route arrives in batch
  [5.3](../../docs/plan/p5-03-sign-in-ui-account-route.md). Both decided
  2026-09-09, see
  [RP-10](../../docs/research/rp10-service-evaluation/rp10-service-evaluation.md).
- **The Vite `base` differs per host** (decided 2026-09-09): `/lesson-planner/`
  on GitHub Pages, `/` on Vercel from plan Phase 4. Both are passed by the
  build flag, never set in `vite.config.ts`. Hash routing needs no rewrite rule
  on either host.

## TBD

- React and Vite versions — pinned by the lockfile in plan batch 2a.1.

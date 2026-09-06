# Batch 2b.1 — Pure logic modules + two ADRs

Phase 2b · [Plan home](README.md) · Prev: [2a.4](p2a-04-cutover.md) · Next: [2b.2](p2b-02-toolbar-group-list.md)

## Goal

Extract the pure logic into typed modules with unit tests, and decide two
things that later batches implement.

## Tasks

- [x] ~~Extract pure modules: money formatting, month-key handling, date math,
      template rendering, CSV serialize/deserialize.~~ — done during the port,
      one slice at a time, because each slice needed the arithmetic before it
      could render anything. `format.ts` landed in
      [2a.3a](p2a-03a-port-shell-storage.md), `schedule.ts` in
      [2a.3c](p2a-03c-port-calendar-overrides.md), `csv.ts` and `message.ts` in
      [2a.3d](p2a-03d-port-template-message-csv.md).
- [x] Add **Vitest** for unit tests of these modules. Note: this extends the
      commissioned tool list (Playwright only); it supports the TDD rule for
      pure logic. Recorded in [testing.md](../../.claude/context/testing.md).
- [x] ADR 1 in this page: CSS approach.
- [x] ADR 2 in this page: icon set shape for 2b.6.

## ADR 1 — CSS Modules for components, one global sheet for the base

**Status:** accepted, batch 2b.1. Implemented by
[2b.7](p2b-07-styles-extraction.md).

### Context

`app/src/styles.css` is 274 lines copied verbatim from the deleted `index.html`
(batch [2a.3e](p2a-03e-port-styles.md)). It holds 31 class selectors and five
element selectors — `:root`, `body`, `button`, `h1`, `textarea` — and the
research catalogued dead rules in it that nobody could safely delete, because
nothing said which component owned which rule.

The components arrive in [2b.2](p2b-02-toolbar-group-list.md) to
[2b.6](p2b-06-svg-icons.md). The question is what they import.

### Decision

Two layers.

1. **A global stylesheet** keeps what is genuinely global: the `:root` custom
   properties, `body`, and the element-level defaults for `button`, `h1` and
   `textarea`. Element selectors are the point of this layer — the app styles
   plain HTML elements rather than wrapping every button in a component.
2. **A CSS Module per component** (`GroupModal.module.css` beside
   `GroupModal.tsx`) holds everything else. Class names are local, so two
   components cannot collide, and a rule no component imports is dead in a way
   a person can see.

### Why not one plain stylesheet

It is what the legacy page did, and the specific failure it produced is in the
research: rules nobody could attribute to a component and therefore nobody could
delete. Scoping is the cheapest fix for that, and Vite supports
`*.module.css` with no configuration.

### Why not one CSS Module for everything

The base layer styles elements, not classes, and element selectors in a module
are global anyway — the scoping would be a comment rather than a mechanism.

### What it costs

- Class names in the DOM become hashed. Nothing in the suite depends on them:
  the frozen contract is `id` and `data-testid` attributes, and the pixel
  baselines do not read the DOM. `.group-card`, `.modal-overlay` and
  `.month-override-row` **are** used as locators in a few page objects — those
  move to the frozen hooks in the same batch, or the class stays global.
- Two places to look for a rule. Mitigated by the split being a rule of thumb
  anyone can apply: does it name an element, or a component?

## ADR 2 — Inline SVG components, no icon font, no external requests

**Status:** accepted, batch 2b.1. Implemented by
[2b.6](p2b-06-svg-icons.md).

### Context

The icons are emoji today: 📅 in the title, 🧾 on Edit Template, 📋 on Copy
Payment Message, ✏️ on the two edit controls. Emoji are rendered by the
operating system, which is why the pixel baselines in
[2b.8](p2b-08-visual-regression.md) have to be made inside a pinned container
image, and why there are two baseline sets rather than one.

### Decision

Each icon becomes a small React component returning inline `<svg>`. No icon
font, no sprite sheet, no request to a CDN.

- `fill="currentColor"` so an icon takes the colour of the text around it and a
  disabled control's icon dims with it.
- `width`/`height` in `em`, so an icon scales with its button's font size.
- `aria-hidden="true"` on the `<svg>`, with the accessible name on the control —
  the buttons already carry `aria-label` where the label is not text.
- Paths from a licensed set with attribution recorded in this repository, or
  drawn here; either way the markup ships in the bundle.

### Why not an icon font

An extra network request on a page that otherwise needs none, a flash of missing
glyphs while it loads, and the same OS-dependent rendering problem in a
different coat.

### Why not external requests

The app is a single static page holding one person's payment details. It makes
no third-party requests today, and adding one to fetch a picture of a pencil
would be a poor trade. It also has to work offline, which is how a teacher uses
it between lessons.

### What it costs

Replacing the emoji changes every screen, so **2b.6 invalidates all fourteen
pixel baselines**. Regenerating them is one dispatch of `baselines.yml` and a
review of the diff; the loop is in
[testing.md](../../.claude/context/testing.md). That is noted on 2b.6's page.

## Acceptance criteria

- [x] `npm run test:unit` exit 0: **203 tests across five modules**, 0.9 s.
- [x] Full e2e suite still exit 0.
- [x] Both ADRs recorded here and mirrored in the context files.

## What the unit tests are worth

Each file was written against the module, then **mutation-verified**: at least
six plausible wrong edits per module — a flipped comparison, a dropped `.sort()`,
an off-by-one bound, a deleted guard — each applied, run, and reverted. A
mutation nothing caught was a hole, and the test that closes it was added before
the next mutation. That is the same discipline the e2e pins use, applied to
functions instead of screens.

Spot-checked independently afterwards with a mutation nobody had been asked to
try: `message.ts` builds its month name from `new Date(monthKey + "-02")`, and
changing the `02` to `01` fails the test named "names the month on a machine
eleven hours behind UTC". That day-of-month is load-bearing — in a negative-offset
timezone the first of the month is still the previous month locally, so the
message would name the wrong month for anyone west of Greenwich. Nothing in the
e2e suite could see it: Playwright pins `timezoneId: "UTC"`.

Nine registry defects are asserted as current behaviour with a comment naming
the fixing batch: DEF-001, 002, 003, 005, 006, 007, 010, 013 and 015. No pin is
duplicated — the desired behaviour stays stated once, in `e2e/`.

The suite runs in CI and in the deploy's `verify` job, so it gates the site the
same way the e2e suite does.

## Merge order and dependencies

Depends on 2a.4. First Phase 2b batch. Deployable: yes.

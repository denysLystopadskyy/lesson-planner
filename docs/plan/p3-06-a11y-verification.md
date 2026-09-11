# Batch 3.6 — Accessibility verification (WCAG 2.2 AA)

Phase 3 · [Plan home](README.md) · Prev: [3.5](p3-05-pii-template-cleanup.md) · Next: [3.7](p3-07-cleanup.md)

## Goal

Verify the accessibility target on the finished UI, with automated checks where
possible and a recorded manual pass where not — and fix what the verification
finds.

The page previously had an empty `## Goal` heading with the inherited-defects
section under it and the goal sentence twenty lines further down, so a top-down
reader met the defects before the purpose. Fixed here.

## Inherited from the styles batch

- **DEF-025** — every control's border was `#ccc`: **1.61:1** on a panel and
  **1.53:1** on the page, against the 3:1 that WCAG 2.2 AA 1.4.11 asks of a
  boundary that carries meaning. Batch [2b.7](p2b-07-styles-extraction.md)
  measured it and deferred it deliberately, because the fix repaints every
  control in the app. **Closed here**: `--border-control` is `#868f9e`, which
  computes to 3.26:1 and 3.12:1.
- **The screen-reader questions this suite cannot answer** — see the section
  near the foot of this page. They remain open, and now say so precisely.

## What the automation found

Nothing here was predicted by reading the code. Every item is something the
scan or the measurement produced.

| Finding                                                             | Rule   | Impact   | Fix                                                                                                 |
| ------------------------------------------------------------------- | ------ | -------- | --------------------------------------------------------------------------------------------------- |
| `role="status"` live region was a **child of `role="grid"`**        | 1.3.1  | critical | Moved outside `#calendar-grid`. A grid may only contain rows; a live region announces from anywhere |
| `#monthSelect` had **no accessible name**                           | 4.1.2  | critical | `aria-label="Month"`                                                                                |
| `#yearInput` had **no accessible name**                             | 4.1.2  | critical | `aria-label="Year"`                                                                                 |
| `#templateTextarea`, `#reviewTextarea` had **no accessible name**   | 4.1.2  | critical | `aria-label`. A heading above a control is not that control's name                                  |
| `#calendar-summary` rendered at **4.4:1** where 4.5 is asked        | 1.4.3  | serious  | Was a hard-coded `#64748b`; now `var(--text-secondary)` at 7.24:1                                   |
| **Horizontal scroll at 320px** — `.toolbar` forced 539px on one row | 1.4.10 | —        | `flex-wrap: wrap`. The `header` above already wrapped; the toolbar did not                          |
| `#selectedDatesPriceInput` was **108×21**                           | 2.5.8  | —        | `min-height: 24px`                                                                                  |

The two hard-coded colours in `styles.css` were also tokenised. A literal colour
belongs to no token pair, so `contrast.test.ts` cannot see it — which is exactly
how the 4.4:1 summary text survived batch 2b.7's contrast audit.

## Contrast is a test now, not a table

The batch asked for "computed ratios for all tokens recorded". A table records
what someone measured once and cannot notice a token changing underneath it; a
stale contrast table is worse than none, because it reads as a guarantee.

`app/src/contrast.test.ts` reads `styles.css`, computes every ratio, and asserts
each against its threshold — so a colour that stops clearing 1.4.3 or 1.4.11
fails a build. It carries a **completeness guard**: any hex token that appears in
no checked pair fails the suite, unless it is in an `EXEMPT` list with a written
reason. One token is exempt today — `--border-subtle`, a divider between blocks
of content rather than the edge of a control, which 1.4.11 does not cover.

It runs under `npm run test:unit`, which CI already runs. That was deliberate: a
new npm script would have needed a workflow edit, and
[3.5](p3-05-pii-template-cleanup.md) records that this session cannot push one.

## The manual checklist

Automation is silent about most of WCAG. This is the other half, and **AA is
not claimed by automation alone**. Each row says how it was checked, because
"pass" from an unstated method is not a result.

Method key: **axe** — the automated scan; **measured** — a scripted measurement
against the built app, quoted in the row; **tree** — read from the accessibility
tree Playwright exposes; **code** — read from source; **AT** — needs real
assistive technology, which this session has none of.

### Perceivable

| Criterion                        | Result | How                                                                                                                             |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text content           | Pass   | code — the six icons are decorative SVG beside real text labels; the file input is `display: none` with a button as its control |
| 1.3.1 Info and relationships     | Pass   | axe + tree — grid reports `role=grid`, 6 rows, 31 gridcells, 7 columnheaders. Was **failing**: see the table above              |
| 1.3.2 Meaningful sequence        | Pass   | tree — DOM order is reading order; nothing is repositioned by CSS                                                               |
| 1.3.4 Orientation                | Pass   | code — no orientation lock                                                                                                      |
| 1.3.5 Identify input purpose     | N/A    | code — no field collects information about the user                                                                             |
| 1.4.1 Use of colour              | Pass   | code — selected days carry a filled background and a count in text; no state is colour-only                                     |
| 1.4.3 Contrast (minimum)         | Pass   | `contrast.test.ts`, 12 text pairs + axe on every view. Was **failing** on the calendar summary                                  |
| 1.4.4 Resize text                | Pass   | measured — root font at 200%, `scrollWidth` 320 = `clientWidth` 320, controls still rendered                                    |
| 1.4.10 Reflow                    | Pass   | measured — at 320×640, `scrollWidth` 320 = `clientWidth` 320. Was **failing** at 559px                                          |
| 1.4.11 Non-text contrast         | Pass   | `contrast.test.ts`, 5 non-text pairs. Was **failing** — DEF-025                                                                 |
| 1.4.12 Text spacing              | Pass   | code — no fixed heights on text containers; `#calendar-summary`'s `1em` holds one line of its own text                          |
| 1.4.13 Content on hover or focus | N/A    | code — nothing appears on hover or focus                                                                                        |

### Operable

| Criterion                     | Result | How                                                                                                                                                                                                                                                            |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1.1 Keyboard                | Pass   | `a11y.spec.ts` + `calendar-keyboard.spec.ts` — every journey driven by keyboard alone                                                                                                                                                                          |
| 2.1.2 No keyboard trap        | Pass   | `a11y.spec.ts` — 25 tabs inside a dialog never reach a control behind it, and focus returns                                                                                                                                                                    |
| 2.1.4 Character key shortcuts | N/A    | code — no single-character shortcuts                                                                                                                                                                                                                           |
| 2.4.1 Bypass blocks           | N/A    | code — one screen, no repeated navigation block to bypass                                                                                                                                                                                                      |
| 2.4.2 Page titled             | Pass   | code — `<title>Group Lesson Planner</title>`                                                                                                                                                                                                                   |
| 2.4.3 Focus order             | Pass   | `a11y.spec.ts` — Escape returns focus to the card that opened the dialog                                                                                                                                                                                       |
| 2.4.4 Link purpose            | N/A    | code — the app has no links                                                                                                                                                                                                                                    |
| 2.4.6 Headings and labels     | Pass   | axe — was **failing** on four unnamed controls                                                                                                                                                                                                                 |
| 2.4.7 Focus visible           | Pass   | code — `:focus-visible` gives a 2px `--focus` outline; the ring is 17.85:1 on a panel and 3.48:1 on the accent                                                                                                                                                 |
| 2.4.11 Focus not obscured     | Pass   | measured — the toolbar wraps rather than overlapping, and no element is sticky                                                                                                                                                                                 |
| 2.5.1 Pointer gestures        | Pass   | code — every action is a single click or key press                                                                                                                                                                                                             |
| 2.5.2 Pointer cancellation    | Pass   | code — everything acts on `click`, which is cancellable by moving off the control                                                                                                                                                                              |
| 2.5.3 Label in name           | Pass   | tree — every visible label is the accessible name                                                                                                                                                                                                              |
| 2.5.4 Motion actuation        | N/A    | code — nothing responds to device motion                                                                                                                                                                                                                       |
| 2.5.7 Dragging movements      | N/A    | code — nothing is draggable                                                                                                                                                                                                                                    |
| 2.5.8 Target size (minimum)   | Pass   | measured — one control was 108×21 and is now 24px tall. The group-card button is 160×21 **and exempt with evidence**: its stretched `::after` makes the effective target 298×80, verified by `elementFromPoint` at the card's far corner returning that button |

### Understandable

| Criterion                       | Result   | How                                                                                                                     |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 3.1.1 Language of page          | Pass     | code — `<html lang="en">`                                                                                               |
| 3.1.2 Language of parts         | **Open** | code — the teacher's own group names and template are Ukrainian, in an `en` document, with no `lang` on them. See below |
| 3.2.1 On focus                  | Pass     | code — focus changes nothing                                                                                            |
| 3.2.2 On input                  | Pass     | code — no input submits or navigates on change                                                                          |
| 3.2.3 Consistent navigation     | N/A      | one screen                                                                                                              |
| 3.2.4 Consistent identification | Pass     | code — the same control has the same label everywhere                                                                   |
| 3.2.6 Consistent help           | N/A      | no help mechanism                                                                                                       |
| 3.3.1 Error identification      | Pass     | `storage-guards.spec.ts`, `csv-import-safety.spec.ts` — every refusal names what is wrong                               |
| 3.3.2 Labels or instructions    | Pass     | axe + the placeholder help added in 3.5                                                                                 |
| 3.3.3 Error suggestion          | Pass     | code — the CSV refusal names the row, the column and an example                                                         |
| 3.3.4 Error prevention          | Pass     | `backup-round-trip.spec.ts` — destructive actions confirm, snapshot and offer undo                                      |
| 3.3.7 Redundant entry           | Pass     | code — nothing is asked for twice                                                                                       |
| 3.3.8 Accessible authentication | N/A      | no authentication until Phase 5                                                                                         |

### Robust

| Criterion               | Result             | How                                                                                                           |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| 4.1.2 Name, role, value | Pass               | axe on seven views. Was **failing** on four controls                                                          |
| 4.1.3 Status messages   | Partly — see below | code + tree — `role="status"` regions exist and are correctly placed; whether they are **announced** needs AT |

## What is still open, precisely

**3.1.2 Language of parts.** The document is `lang="en"` and the teacher's data
is Ukrainian. A screen reader will pronounce her group names and her payment
message with English phonetics. Nothing in the app marks user content with a
language, and it cannot guess one reliably. This is a real AA gap, it is about
data rather than chrome, and it is **not** in this batch's task list — it wants
a decision (a language setting? per-group? detect?) rather than a quick fix.
Registered as **DEF-027** and routed to a Phase 4–6 batch.

**4.1.3, and the two questions from batch 2b.4.** Playwright reads a
DOM-derived tree, not a browse-mode cursor. Three claims are therefore
structurally unverifiable here:

1. that the calendar grid's arrow-key model is **discoverable** — 2b.4 put the
   weekday headings behind an ArrowUp rather than seven tab stops;
2. that the `role="status"` announcement after a bulk weekday selection is
   actually **read**; and
3. that the new placeholder and storage notices are announced at the right
   moment rather than swallowed.

This session has no assistive technology and cannot run one, so these are
**recorded as unverified rather than marked pass**. What can be said is that the
markup is right: the regions exist, carry the correct roles, and are now placed
where their role permits. A pass needs a person with VoiceOver or NVDA, and the
honest state of the record is that nobody has done that yet.

## Acceptance criteria

- [x] `npx playwright test --grep @a11y` exit 0 — **10 tests**, which is also the
      first time that grep matched anything.
- [x] The manual checklist above is complete, with a result and a method per row.
- [x] Every automated finding fixed, and each one has a row saying what it was.
- [x] Contrast is asserted from the stylesheet, with a completeness guard and a
      written exemption for the one token that is out of scope.
- [x] DEF-025 closed in the [registry](def-registry.md).
- [x] Two genuinely open items registered rather than quietly passed.
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0 — 180 passed, 0 skipped.

## Merge order and dependencies

After all UI-changing batches (3.1–3.5, and 3.4b). Deployable: yes.

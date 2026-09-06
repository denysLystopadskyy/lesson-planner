# Batch 2a.3f — Layout fix, and checks that can see it

Phase 2a · [Plan home](README.md) · Prev: [2a.3e](p2a-03e-port-styles.md) · Next: [2a.4](p2a-04-cutover.md)

## Why this batch exists

[2a.3e](p2a-03e-port-styles.md) brought the stylesheet across and left one
difference "on purpose": the toolbar rendered on its own row under the title,
because the copied rules position those buttons through markup the port
deliberately does not have. The batch page argued that was acceptable.

The owner looked at the staging build and said the layout was broken. They were
right — it is the first thing anyone sees, and "documented" is not the same as
"fine". The same page also asked for checks that would catch this class of
problem without a person looking.

## Goal

The React app's layout matches the page it replaces, and the suite can tell when
it does not.

## Tasks

- [x] Put the toolbar back on the title's row without putting buttons back
      inside the heading.
- [x] Hide the edit-details pencil while either editor is open, as
      `renderGroupInfo` does.
- [x] Add accessibility-snapshot, geometry and screenshot checks across the
      app's screens.

## The fix

Four rules, appended to `app/src/styles.css` below a marker that says everything
above it is the verbatim copy and this is not:

```css
header { display: flex; justify-content: space-between; align-items: center; … }
header h1 { margin: 0; }
.toolbar { display: flex; align-items: center; gap: 6px; }
.toolbar #addGroupBtn { margin-right: 14px; }
```

They move the flex container up one level, from the `<h1>` the legacy page uses
to the `<header>` the port has. The stylesheet is therefore no longer a pure
copy, and the file says so; [2b.7](p2b-07-styles-extraction.md) folds the block
into the per-component styles.

A geometry comparison of the two apps — same data, same viewport, ten elements
across three screens — now differs on one thing only, and it is the intended
one: the `<h1>` box is the title in the port and the whole header row in the
legacy page. Every other box matches within 20 px horizontally and 6 px
vertically.

## The checks, in three levels

New spec: `e2e/features/visual-layout.spec.ts`, one test per screen.

| Level                  | What it asserts                                                                                     | Where it runs           |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ----------------------- |
| Accessibility snapshot | roles and names, in order                                                                           | everywhere              |
| Geometry               | relationships between boxes — same row, right-aligned, stacked, centred, backdrop covers the window | everywhere, CI included |
| Pixels                 | `toHaveScreenshot` against committed baselines                                                      | macOS only, for now     |

The geometry level is the one that would have failed on the toolbar bug, and it
is resolution- and platform-independent, so it protects CI as well.

**The pixel level is honest about its limits.** The baselines are rendered on
macOS, and the icons are emoji, so they are font- and platform-dependent; a
Linux CI runner would need its own set and this machine cannot produce one
(no container runtime here). They are gated on `process.platform === "darwin"`
and skip elsewhere. [2b.8](p2b-08-visual-regression.md) is where they move into
the Playwright container and stop being a local-only check; [2b.6](p2b-06-svg-icons.md)
removes the emoji dependency first.

## A new defect, found by writing the snapshot

The main screen's accessibility snapshot could not be written to describe both
apps. The legacy page puts the five toolbar buttons **inside** the `<h1>`, so
the heading's accessible name is

> 📅 Group Lesson Planner + Add Group 🧾 Edit Template Load CSV Save CSV Clear All Data

and there is no banner landmark. A screen-reader user hears the whole toolbar
as the page heading. That is **DEF-019**, and the cutover closes it: the port
has a `banner` containing a heading named just the title, which
`visual-layout.spec.ts` now asserts against the port alone.

## Acceptance criteria

- [x] Full suite exit 0 with `--repeat-each=3`: 564 passed, 69 skipped.
- [x] Fourteen screenshot baselines committed, seven screens per app.
- [x] The geometry comparison between the two apps differs only on the `<h1>`
      box, which is the intended structural difference.

## Merge order and dependencies

Depends on 2a.3e. Blocks 2a.4. Deployable: yes.

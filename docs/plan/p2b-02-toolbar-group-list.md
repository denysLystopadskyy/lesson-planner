# Batch 2b.2 — Components: toolbar and group list

Phase 2b · [Plan home](README.md) · Prev: [2b.1](p2b-01-logic-modules-adrs.md) · Next: [2b.3](p2b-03-group-modal.md)

## Goal

Split the toolbar and the group grid out of the one big App component.

## Inherited constraint

The header is a `<header>` holding an `<h1>` and a `.toolbar`, laid out by four
rules at the foot of `app/src/styles.css` (batch
[2a.3f](p2a-03f-layout-fix-visual-checks.md)). Keep that shape: the legacy page
put the buttons inside the heading, which made the heading's accessible name the
title plus every button label (DEF-019). `visual-layout.spec.ts` asserts the
banner landmark, so a regression fails.

## Tasks

- [x] `Toolbar` and `GroupList`/`GroupCard` components; semantic buttons;
      cards become focusable, keyboard-activatable elements.
- [x] Keep the frozen testids; aria snapshot for the group list.

## What the card became, and what it did not

A card was a `<div>` with an `onClick`: fine with a pointer, unreachable without
one. Three shapes were considered.

| Shape                                       | Rejected because                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `role="button" tabindex="0"` on the card    | the heading is re-parented under a button node, and a `<div>` with a keydown handler has to re-implement Enter and Space, including stopping Space from scrolling |
| A `<button>` wrapping the whole card        | a `<button>` may contain phrasing content only, and an `<h2>` is not phrasing — it is invalid HTML, whatever the browsers tolerate                                |
| **A `<button>` inside the existing `<h2>`** | chosen                                                                                                                                                            |

So the card is still a `<div>` carrying all three dataset hooks on one node —
`planner.groupCard()` locates `[data-group-name]` and the storage contract
asserts `data-currency` on the same element — and the group name inside the
`<h2>` is now a real button. The platform supplies Tab, Enter and Space; the
heading keeps its own node in the accessibility tree, so a teacher skimming the
page still hears a list of level-2 headings.

Four CSS rules make that work, and each one earns its place — the reasons are at
the site in `app/src/styles.css`. The one worth repeating here: `all: unset` on
the nested button, because the sheet's element-level `button` rule would
otherwise draw a bordered box around every group name.

**No screenshot baseline moved.** All seven still match, which is the strongest
evidence the reset is complete. That was the goal: a keyboard fix nobody can see.

## Two things this batch deliberately did not do

- **No list semantics.** `role="list"` on `#groupList` is the obvious next step
  and it changes the frozen body snapshot in `visual-layout.spec.ts`. It is also
  arguable on the merits — the grid is a set of headed regions, not a list of
  short items. Left for [2b.4](p2b-04-calendar-editor.md) or later, deliberately.
- **No CSS Modules.** [ADR 1](p2b-01-logic-modules-adrs.md) assigns that to
  [2b.7](p2b-07-styles-extraction.md), and starting here would hash
  `.group-card`, which `group-regressions.spec.ts` uses as a locator.

## A defect found by the keyboard spec

**DEF-023** — an open dialog neither takes focus nor keeps it. Opening a group
from the keyboard leaves focus on the card behind the overlay; three tabs walk
the dialog's controls and the fourth leaves for the toolbar, while
`aria-modal="true"` tells a screen reader everything behind is unavailable.
Pinned here, fixed in [2b.3](p2b-03-group-modal.md), which owns the dialog.

Worth recording what was **not** found: focus does return to the card when the
dialog closes. Not because anything returns it — because nothing ever took it
away.

## Acceptance criteria

- [x] Full e2e suite exit 0; testid-contract spec exit 0.
- [x] Group cards reachable and activatable with the keyboard, in
      `group-card-keyboard.spec.ts`: tab order, Enter, Space without scrolling,
      the focus ring on the focused card and not its neighbour, a click in the
      card's corner still opening the group, and the `#groupList` accessibility
      snapshot.
- [x] No screenshot baseline changed.

## Merge order and dependencies

Depends on 2b.1. Deployable: yes.

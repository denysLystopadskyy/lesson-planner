# Batch 2b.6 — Replace emoji icons with SVG components

Phase 2b · [Plan home](README.md) · Prev: [2b.5](p2b-05-template-review-modals.md) · Next: [2b.7](p2b-07-styles-extraction.md)

## Note from 2b.8, which ran early

This batch was recorded as blocking [2b.8](p2b-08-visual-regression.md), because
pixel baselines want deterministic icons. 2b.8 ran first: pinning the container
image by digest fixes the emoji rendering well enough to compare against, so the
block did not hold. What remains true is that **this batch invalidates the seven
baselines** — replacing the emoji changes every screen. Regenerate them here,
through the loop in [testing.md](../../.claude/context/testing.md), and review
the diff as part of the icon change rather than after it.

## Goal

Remove OS-rendered emoji so every machine draws the same pixels — this
unblocks visual regression testing (user decision, 2026-08-20).

## Tasks

- [x] Inline SVG icon components (per ADR 2 in
      [2b.1](p2b-01-logic-modules-adrs.md)) replace: calendar, receipt,
      pencil, clipboard, and the arrow glyphs.
- [x] Every icon-only button gets an accessible name.
- [x] No external requests; SVGs inline in the bundle.

## Drawn for 16 pixels, not for a design tool

The paths are drawn in `app/src/icons.tsx` rather than lifted from a set, so
there is no licence to record and nothing to attribute.

The first drawings were wrong and a test could not have said so. At 1em — 16px
in a button — the calendar's ruled inner grid turned to mush and the receipt's
three text lines merged. The **rendered screenshot** showed it, which is the
argument for the review step in the baseline loop: `baselines.yml` uploads
rather than commits precisely so a person looks at the picture. Redrawn with
fewer, heavier shapes.

The title mark also needed a size of its own. Beside 22px bold type a flat 1em
icon reads as a small grey box, so it is 1.1em with an 8px gap.

## The month arrows had no name at all

`#prevMonthBtn` and `#nextMonthBtn` were labelled by their glyphs, so a screen
reader announced "button, black left-pointing triangle". They carry
`aria-label="Previous month"` and `"Next month"` now. That is a real fix this
batch happened to reach rather than a cosmetic swap.

## What it cost elsewhere

The emoji were part of five accessible names, so five specs changed: the
toolbar's exhaustive button list in `smoke.spec.ts`, the tab-order list in
`group-card-keyboard.spec.ts`, the header snapshot and two others in
`visual-layout.spec.ts`, the pencil in `group-management.spec.ts`, and the
arrows in `schedule-editing.spec.ts`.

**All fourteen baselines regenerated** — seven macOS locally, seven Linux
through `baselines.yml` — and reviewed before committing. The two platforms now
draw the _same icons_; only the text font still differs between them, which is
what this batch set out to achieve.

## Acceptance criteria

- `grep` for the emoji code points over `app/src` returns nothing.
- Full e2e suite exit 0; aria snapshots updated where names changed.

## Merge order and dependencies

Depends on 2b.5. Blocks 2b.8 (visual baselines need stable icons).
Deployable: yes.

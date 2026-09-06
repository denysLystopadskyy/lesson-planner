# Batch 2b.7 — Styles extraction

Phase 2b · [Plan home](README.md) · Prev: [2b.6](p2b-06-svg-icons.md) · Next: [2b.8](p2b-08-visual-regression.md)

## Goal

Move the inline `<style>` block into the form decided by ADR 1, with design
tokens for colors.

## Starting point

`app/src/styles.css` already exists: batch [2a.3e](p2a-03e-port-styles.md)
copied the legacy `<style>` block into it **verbatim**, so the cutover would not
ship an unstyled app. It is excluded from Prettier while it is a copy.

## Tasks

- [ ] Implement the 2b.1 CSS ADR; extract styles per component.
- [ ] Remove the `app/src/styles.css` line from `.prettierignore` — once the
      file is rewritten it is no longer a copy, and nothing is gained by leaving
      it unformatted.
- [ ] Replace the inline styles 2a.3e carried over (the calendar container, the
      price-setter row, the monthly header, the rule above it) with rules.
- [ ] Give the header its own rule so the toolbar returns to the title's row
      without putting buttons back inside the `<h1>` — see
      [2b.2](p2b-02-toolbar-group-list.md).
- [ ] Introduce color tokens; fix the contrast failures found by the research
      (accent-on-white, muted text, the invisible weekend shading) as token
      changes.
- [ ] Delete the dead CSS rules the research catalogued.

## Acceptance criteria

- Full e2e suite exit 0.
- Contrast checks for the tokens recorded in this page (computed ratios).

## Merge order and dependencies

Depends on 2b.6. Blocks 2b.8 (baselines need final styles). Deployable: yes.

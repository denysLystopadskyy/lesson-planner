# Batch 2b.7 — Styles extraction

Phase 2b · [Plan home](README.md) · Prev: [2b.6](p2b-06-svg-icons.md) · Next: [2b.8](p2b-08-visual-regression.md)

## Goal

Move the inline `<style>` block into the form decided by ADR 1, with design
tokens for colors.

## Tasks

- [ ] Implement the 2b.1 CSS ADR; extract styles per component.
- [ ] Introduce color tokens; fix the contrast failures found by the research
      (accent-on-white, muted text, the invisible weekend shading) as token
      changes.
- [ ] Delete the dead CSS rules the research catalogued.

## Acceptance criteria

- Full e2e suite exit 0.
- Contrast checks for the tokens recorded in this page (computed ratios).

## Merge order and dependencies

Depends on 2b.6. Blocks 2b.8 (baselines need final styles). Deployable: yes.

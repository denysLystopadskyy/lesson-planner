# Batch 2b.8 — Visual regression suite

Phase 2b · [Plan home](README.md) · Prev: [2b.7](p2b-07-styles-extraction.md) · Next: [2b.9](p2b-09-hash-routing.md)

## Goal

Pixel screenshots guard the key views, now that icons and styles are
deterministic.

## Tasks

- [ ] `visual.spec.ts`: main screen (empty and filled), group modal, calendar
      in edit mode, review modal — `toHaveScreenshot` baselines.
- [ ] Baselines are generated and compared **in CI Linux only**; local runs
      skip visual specs by default (fonts differ per OS).
- [ ] Update policy documented in
      [testing.md](../../.claude/context/testing.md): a PR that changes UI
      regenerates baselines in CI and reviews the diff.

## Acceptance criteria

- CI job green with committed baselines; a deliberate 1px style change fails
  the job (verify once, then revert).

## Merge order and dependencies

Depends on 2b.6 and 2b.7. Deployable: yes.

# Batch 3.6 — Accessibility verification (WCAG 2.2 AA)

Phase 3 · [Plan home](README.md) · Prev: [3.5](p3-05-pii-template-cleanup.md) · Next: [3.7](p3-07-cleanup.md)

## Goal

Verify the accessibility target on the finished UI, with automated checks
where possible and a manual checklist where not.

## Tasks

- [ ] `@a11y`-tagged specs: axe scan per view, keyboard-only flows, aria
      snapshots current.
- [ ] Manual checklist per WCAG 2.2 AA criterion group (perceivable,
      operable, understandable, robust) — results recorded in this page.
      AA conformance is never claimed by automation alone.
- [ ] Contrast: computed ratios for all tokens recorded (from 2b.7).
- [ ] Fix everything found; refresh baselines where the UI changed.

## Acceptance criteria

- `npx playwright test --grep @a11y` exit 0.
- The manual checklist in this page is complete, with a result per row.

## Merge order and dependencies

After all UI-changing batches (3.1–3.5). Deployable: yes.

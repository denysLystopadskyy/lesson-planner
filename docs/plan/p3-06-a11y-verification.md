# Batch 3.6 — Accessibility verification (WCAG 2.2 AA)

Phase 3 · [Plan home](README.md) · Prev: [3.5](p3-05-pii-template-cleanup.md) · Next: [3.7](p3-07-cleanup.md)

## Goal

## Inherited from the styles batch

- **DEF-025** — every control's border is `#ccc`, 1.61:1 on a panel and 1.53:1
  on the page, against the 3:1 WCAG 2.2 AA 1.4.11 asks of a meaningful
  boundary. Batch [2b.7](p2b-07-styles-extraction.md) measured it and deferred
  it deliberately: the fix is about `#868f9e` (3.26:1 and 3.12:1) and it
  repaints every button in the app, which was outside that batch's task list.
- **The screen-reader questions this suite cannot answer.** Playwright reads its
  own DOM-derived tree, not a browse-mode cursor. Two claims are therefore
  unverified and should be checked with a real screen reader here: that the
  calendar grid's arrow-key model is discoverable (batch 2b.4 put the weekday
  headings behind an ArrowUp rather than seven tab stops), and that the
  `role="status"` announcement after a bulk weekday selection is actually read.

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

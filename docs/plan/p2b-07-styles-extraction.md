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

- [ ] Implement the 2b.1 CSS ADR; extract styles per component. — **second PR**
- [x] Remove the `app/src/styles.css` line from `.prettierignore`.
- [x] Replace the inline styles 2a.3e carried over.
- [x] Give the header its own rule.
- [x] Introduce color tokens; fix the contrast failures.
- [x] **DEF-024** — closed.
- [x] Delete the dead CSS rules the research catalogued.

## Three audits first, each runtime-verified

The stylesheet was audited before it was touched: dead rules, contrast, and
which classes tests depend on. Every "no matches" in the dead-rule pass was
measured with `getComputedStyle` across all seven screens, not grepped.

**The contrast audit found nine 1.4.3 failures, not the three this page
inherited from the research** — and its numbers reproduced RP-08's independent
runtime measurement on fifteen pairs, so the two derivations agree.

| Failing pair              | Was    | Now                                     |
| ------------------------- | ------ | --------------------------------------- |
| primary button label      | 2.78:1 | **5.13:1**                              |
| primary button, hovered   | 2.74:1 | **5.62:1**                              |
| selected day (DEF-024)    | 2.78:1 | **5.13:1**                              |
| danger label on a panel   | 3.76:1 | **6.47:1**                              |
| danger label on the page  | 3.60:1 | **6.18:1**                              |
| danger label, hovered     | 3.08:1 | **5.30:1**                              |
| 11px labels on sunken     | 2.45:1 | **7.24:1**                              |
| 11px labels, row hover    | 2.34:1 | **6.92:1**                              |
| weekend tint vs container | 1.00:1 | **1.12:1** — a cue where there was none |

That is most of the app's buttons. Six token values changed; nine are recorded
at their current value so only six surfaces move.

Three choices worth the words:

- **`--accent-hover` replaces `filter: brightness(0.95)`.** A filter scales the
  label with the fill, so the hover pair failed too — 2.74:1 — and no lighter
  green survives it (`#348738` is 4.50:1 resting and 4.39:1 filtered).
- **`--danger` is chosen by its worst ground**, its own hover surface. `#c62828`
  gives 4.60:1 there; `#b91c1c` gives 5.30:1.
- **`--text-secondary` reuses the value the icons already had.** `#94a3b8`
  leaves the palette rather than a colour being added to it.

## Thirteen rule groups deleted

Nine were catalogued in RP-01 §306. `.hidden` and `[hidden]` were dead and
**not** catalogued — the port unmounts closed dialogs instead of hiding them,
and the user-agent sheet already supplies `[hidden]`. Four more are inert since
batch 2b.3: `.modal-overlay`'s background, `z-index`, `opacity` and
`transition`, plus `.modal-overlay.show`, because every overlay is a native
`<dialog>` in the top layer and `Dialog.tsx` always applies `show`.

## The fix introduced a defect, and the audit caught it first

Tinting the weekend column exposes the leading spacer cells: they never carried
`weekend`, so in any month that does not start on a Monday the column would have
an untinted gap at the top. **Invisible in the pinned month** — the clock is
2026-06-15 and June 2026 starts on a Monday — so no screenshot would have shown
it. The spacers carry the class now.

## One deferral, on the record

**DEF-025** — `#ccc` control borders are 1.61:1 on a panel and 1.53:1 on the
page, against the 3:1 that WCAG 2.2 AA 1.4.11 asks of a boundary carrying
meaning. The target is about `#868f9e` (3.26:1 and 3.12:1) and it repaints every
button in the app, which is not in this page's task list. Registered and routed
to [3.6](p3-06-a11y-verification.md) rather than quietly skipped.

## Acceptance criteria

- [x] Full e2e suite exit 0.
- [x] Contrast checks for the tokens recorded in this page — the table above,
      computed from the token values in `app/src/styles.css` rather than
      recalled.
- [x] All fourteen baselines regenerated and reviewed.

## Merge order and dependencies

Depends on 2b.6. Blocks 2b.8 (baselines need final styles). Deployable: yes.

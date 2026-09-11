# Batch 3.4a — Interaction defects (fixes DEF-010, DEF-011, DEF-012, DEF-016, DEF-026)

Phase 3 · [Plan home](README.md) · Prev: [3.3](p3-03-json-backup.md) · Next: [3.4b](p3-04b-csv-clipboard-defects.md)

## Goal

Editing behaves honestly: Cancel cancels, Escape asks, "Copied!" is true, and a
price goes where the user is looking.

## Why this page was rewritten

It was titled "fixes DEF-008, DEF-009, DEF-011, DEF-012" and half of that gate
was already green — DEF-008 and DEF-009 closed with the cutover in
[2a.4](p2a-04-cutover.md), which replaced the form that held them. Meanwhile the
[registry](def-registry.md) routes **DEF-026** here and the old page never named
it. DEF-010 and DEF-016 were in the task list with no gate at all.

## The two decisions this batch needed

**DEF-010 — bulk price scope.** Owner decision, 2026-09-11: **fix it, visible
month only.** `applyBulkPrice` was not even told which month was on screen, so
it could not limit the change to it — a date picked in June earlier in the same
session was silently repriced while the user looked at July. She could not see
June while doing it and nothing said it had happened. The function now takes the
visible month key and writes only that one. When the visible month holds none of
the selected dates it writes nothing: the field describes "selected dates", and
if none are in view there is nothing on screen for the number to describe.

**DEF-016 — the modal fade.** The registry describes the legacy mechanism —
`hidden` set in the same tick as the `show` class, so there were never two
frames to interpolate between — and **that mechanism no longer exists**. The
port is a native `<dialog>` with no `show` class. What carried over is only the
absence of a fade.

Fixed with `@starting-style`, which names the value a property has for the first
frame after the element enters the top layer, so the browser has something to
transition from. No JavaScript. **Only the opening fades, deliberately**: a
closing `<dialog>` can be animated with `transition-behavior: allow-discrete`,
but React unmounts this element on close, and keeping the component mounted
through a transition would delay every `toBeHidden` in the suite to buy 200ms of
polish.

## Tasks

- [x] **DEF-010** — bulk price applies to the month on screen and no other.
- [x] **DEF-011** — the clipboard write is awaited. On failure the button claims
      nothing, the dialog **stays open** so the text can still be selected by
      hand, and the reason is said out loud.
- [x] **DEF-012** — Escape during calendar editing asks before discarding, and
      only when there is something to lose. A confirm that always fires is one
      people learn to dismiss without reading.
- [x] **DEF-026** — a group edit no longer rewrites the app-wide default
      currency unless the select was actually changed.
- [x] **DEF-016** — dialogs fade in.
- [x] Remove the `test.fixme` from the DEF-010, DEF-011 and DEF-012 specs.

## What the code already said, and did not do

`store.ts` documents the intended rule for DEF-026 in as many words: _"A group
edit carries settings only when the currency select changed, exactly as the
legacy app writes the settings key only then."_ The reducer honoured it. The
call site in `App.tsx` sent the settings unconditionally, so a teacher with one
UAH group among her PLN ones flipped the app default every time she renamed it.
The comment was right and the caller was wrong, which is the kind of gap no
type checker closes.

## How DEF-016 was verified, since it has no spec

Sampling opacity mid-transition is the flaky test
[testing.md](../../.claude/context/testing.md) warns about, and screenshots run
with `animations: "disabled"`, so the suite is deliberately blind here. Verified
by hand instead, against the built app: the overlay's computed opacity rises
`0 → 0.07 → 0.22 → 0.41 → 0.58 → … → 1` across frames, and the backdrop moves
from `rgba(0,0,0,0)` to `rgba(0,0,0,0.4)`. Recorded rather than asserted, and
the reason is in `Dialog.module.css` beside the rule.

A `prefers-reduced-motion` guard turns the transition off for anyone who has
asked their system for that.

## Acceptance criteria

- [x] A bulk price set while July is on screen leaves June's price alone. Fails
      on the pre-batch code, which repriced both.
- [x] A refused clipboard write leaves the button not claiming success and the
      dialog open.
- [x] Escape with unsaved dates asks first, and dismissing keeps the selection.
- [x] Saving a group's details leaves the settings key untouched. The
      golden-shape spec asserted the opposite as current behaviour and now
      asserts the fix.
- [x] The dialog fade plays, verified by hand and recorded above.
- [x] DEF-010, DEF-011, DEF-012, DEF-016 and DEF-026 marked closed in the
      [registry](def-registry.md).
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0. Visual baselines unchanged: the fade does
      not reach a screenshot, and the copy error only renders on failure.

## Merge order and dependencies

Depends on 2b.10. Parallel-safe with 3.2 and 3.5. Deployable: yes.

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

- [ ] `Toolbar` and `GroupList`/`GroupCard` components; semantic buttons;
      cards become focusable, keyboard-activatable elements.
- [ ] Keep the frozen testids; aria snapshot for the group list.

## Acceptance criteria

- Full e2e suite exit 0; testid-contract spec exit 0.
- Group cards reachable and activatable with the keyboard (spec included).

## Merge order and dependencies

Depends on 2b.1. Deployable: yes.

# Batch 2b.2 — Components: toolbar and group list

Phase 2b · [Plan home](README.md) · Prev: [2b.1](p2b-01-logic-modules-adrs.md) · Next: [2b.3](p2b-03-group-modal.md)

## Goal

Split the toolbar and the group grid out of the one big App component.

## Tasks

- [ ] `Toolbar` and `GroupList`/`GroupCard` components; semantic buttons;
      cards become focusable, keyboard-activatable elements.
- [ ] Keep the frozen testids; aria snapshot for the group list.

## Acceptance criteria

- Full e2e suite exit 0; testid-contract spec exit 0.
- Group cards reachable and activatable with the keyboard (spec included).

## Merge order and dependencies

Depends on 2b.1. Deployable: yes.

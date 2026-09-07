# Batch 2b.9 — Hash routing

Phase 2b · [Plan home](README.md) · Prev: [2b.8](p2b-08-visual-regression.md) · Next: [2b.10](p2b-10-state-store.md)

## Goal

Views get URLs: the main screen and an open group become addressable, with
hash routes that work on GitHub Pages without a 404 fallback.

## Tasks

- [x] Hash-based routes: `#/` (main), `#/group/<index>` (group modal open),
      `#/template` (template modal). Back button closes modals.
- [x] Document the limitation: the group id is an array index today.
- [x] Specs: deep-link opens the right view; back/forward behave.

## Four routes, and one that was deliberately left out

`#/`, `#/group/<index>`, `#/group/new`, `#/template`.

The add flow got its own route rather than `#/group/-1`, which is what the
component's state used before. A URL saying "minus one" is a puzzle in a shared
link.

**The review dialog is not a route.** Its content is generated from the template
and the month, so a link to it would not restore what the sender saw — it would
regenerate a message from whatever the template says now. It stays component
state, which is what it is.

## Why the hash, and not the History API

This is a project GitHub Pages site with no server to rewrite paths.
`/lesson-planner/group/0` would be a 404 on refresh and a shared link would be
dead. Everything after the `#` never reaches the server.

## Closing is the interesting part

Opening a dialog **pushes** a history entry, so the Back button — and a phone's
back gesture — closes it. Closing then goes **back**, rather than pushing `#/`:
pushing would mean Back reopens the dialog, which is what makes a routed modal
annoying to use.

But going back is wrong when the dialog _was_ the entry point. Someone who opens
a shared `#/group/1` link and presses Escape would be sent out of the app
entirely. So a pushed entry is marked in `history.state`, and only a marked
entry is closed by going back; an unmarked one is replaced with `#/`. Both paths
have a spec.

Saving a new group **replaces** rather than pushes, so Back from the saved group
returns to the list instead of to an empty form for a group that now exists.

## The limitation, stated plainly

**A group is addressed by its array position, and a link is therefore reliable
within a session and a guess between them.** A group's identity today _is_ its
index — the stored data has no id field, see
[storage-data-contract.md](../../.claude/context/storage-data-contract.md). So:

- deleting a group shifts every link after it;
- a CSV import replaces the whole array and can put a different group at the
  same index;
- `#/group/9999` opens a dialog for a group that is not there.

`parseRoute` does not reject a large index, because it cannot know how many
groups exist — that is the component's business. A stable id needs the schema
change Phase 4 designs.

## Acceptance criteria

- [x] Full e2e suite exit 0, including the new routing specs: **nine e2e tests**
      (opening, two deep links, an unknown route, back and forward, Escape,
      closing a deep link, the add-route replacement, a reload) and **nine unit
      tests** over `parseRoute`/`formatRoute`, where the round trip is the
      property that matters.
- [x] No screenshot baseline changed, and no existing spec needed editing —
      routing is transparent to the behaviour that was already covered.

## Merge order and dependencies

Depends on 2b.8. Deployable: yes.

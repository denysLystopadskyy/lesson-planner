# Batch 2b.1 — Pure logic modules + two ADRs

Phase 2b · [Plan home](README.md) · Prev: [2a.4](p2a-04-cutover.md) · Next: [2b.2](p2b-02-toolbar-group-list.md)

## Goal

Extract the pure logic into typed modules with unit tests, and decide two
things that later batches implement.

## Tasks

- [ ] Extract pure modules: money formatting, month-key handling, date math,
      template rendering, CSV serialize/deserialize.
- [ ] Add **Vitest** for unit tests of these modules. Note: this extends the
      commissioned tool list (Playwright only); it supports the TDD rule for
      pure logic. Recorded in [testing.md](../../.claude/context/testing.md).
- [ ] ADR 1 in this page: CSS approach (plain CSS vs CSS Modules) — decide and
      record reasons; update
      [react-migration.md](../../.claude/context/react-migration.md).
- [ ] ADR 2 in this page: icon set shape for 2b.6 (inline SVG components,
      no icon font, no external requests).

## Acceptance criteria

- `npx vitest run` exit 0 with unit tests per module.
- Full e2e suite still exit 0.
- Both ADRs recorded here and mirrored in the context files.

## Merge order and dependencies

Depends on 2a.4. First Phase 2b batch. Deployable: yes.

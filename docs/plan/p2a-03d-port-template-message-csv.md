# Batch 2a.3d — Port slice 4: template, message, CSV

Phase 2a · [Plan home](README.md) · Prev: [2a.3c](p2a-03c-port-calendar-overrides.md) · Next: [2a.4](p2a-04-cutover.md)

## Goal

The remaining features work in the React app; the full suite passes against
staging.

## Inherited from 2a.3b

- [x] ~~Run the full testid-contract spec against `/next/`~~ — **done in
      [2a.3c](p2a-03c-port-calendar-overrides.md)**, a batch earlier than
      expected. All fourteen hooks existed as soon as the monthly rows and
      calendar landed, so the spec was tagged and greened there.

## Tasks

- [ ] Port template editing, message generation and review, clipboard copy,
      CSV export and import, clear-all, and the unload warning.
- [ ] The golden message test passes byte for byte against `/next/`.
- [ ] Run the FULL parameterized suite against `/next/`.

## Acceptance criteria

- `npx playwright test` (all specs, `BASE_PATH=/next/`, prefixed keys)
  exit 0 with `--repeat-each=3`; only fixme specs skip.

## Merge order and dependencies

Depends on 2a.3c and on 1.8–1.12 (full coverage merged). Blocks 2a.4.
Deployable: yes.

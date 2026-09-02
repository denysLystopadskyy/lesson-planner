# Batch 1.4 — Feature specs I

Phase 1 · [Plan home](README.md) · Prev: [1.3](p1-03-scaffold-core.md) · Next: [1.5](p1-05-feature-specs-2.md)

## Goal

Adopt the first three existing feature specs and make them pass against the
committed page.

## Tasks

- [ ] Commit and green: `group-management.spec.ts`, `data-reset.spec.ts`,
      `template-editing.spec.ts`.
- [ ] Fix locator gaps found while greening; add testids only when critical
      and append them to the contract spec and to
      [testing.md](../../.claude/context/testing.md).
- [ ] Keep specs in BDD style (Given / When / Then).

## Acceptance criteria

- `npx playwright test` exit 0.
- No spec uses CSS-structure or XPath locators.

## Merge order and dependencies

Depends on 1.3. Merges before 1.5. Deployable: yes.

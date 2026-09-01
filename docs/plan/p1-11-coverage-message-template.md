# Batch 1.11 — Coverage: payment message, template, clipboard

Phase 1 · [Plan home](README.md) · Prev: [1.10](p1-10-coverage-overrides-pricing.md) · Next: [1.12](p1-12-coverage-csv.md)

## Goal

Pin the payment message text exactly and cover template editing and clipboard.

## Test design (technique named per group)

- **Equivalence partitioning — template placeholders:** all three used, one
  missing, unknown placeholder left as-is.
- **Golden message test:** for a fixed dataset and clock, the generated
  message equals a stored golden string byte for byte. This is the contract
  the React port must reproduce.
- **Clipboard:** Copy writes the review text; the button feedback shows.
  The false "Copied!" on failure is pinned as DEF-011.
- **Decision table — copy button state:** enabled/disabled by lessons count.

## Tasks

- [ ] BDD specs; clipboard read through the Playwright permissions API.
- [ ] Golden files stored under `e2e/` fixtures; no personal data in goldens —
      use a neutral test template, never the shipped default one.

## Acceptance criteria

- `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.
- Golden fixtures contain no value from `index.html:387-392`.

## Merge order and dependencies

Depends on 1.7. Parallel development, sequential merge. Deployable: yes.

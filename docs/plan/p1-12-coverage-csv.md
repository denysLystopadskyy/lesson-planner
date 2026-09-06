# Batch 1.12 — Coverage: CSV export and import

Phase 1 · [Plan home](README.md) · Prev: [1.11](p1-11-coverage-message-template.md) · Next: [1.13](p1-13-storage-contract.md)

## Goal

Cover the CSV round trip and pin its known data-loss defects.

## Test design (technique named per group)

- **Equivalence partitioning — import files:** valid export, empty file,
  wrong header, non-CSV text.
- **Boundary value analysis — field content:** quotes, commas, newlines,
  Cyrillic text.
- **Error guessing (from the defect list):** DEF-002, DEF-004, DEF-005,
  DEF-006, DEF-007.
- **Round trip:** export → clear → import → state deep-equals the original.

## Tasks

- [x] BDD specs per group; `test.fixme` pins describe the desired behavior.

## What landed

| File                          | Covers                                | Tests         |
| ----------------------------- | ------------------------------------- | ------------- |
| `csv-export-contract.spec.ts` | Export bytes, escaping, BOM, template | 3, two pinned |
| `csv-import-safety.spec.ts`   | Import partitions and data loss       | 7, two pinned |
| `csv-round-trip.spec.ts`      | Export → wipe → import                | 2             |

Batch [1.5](p1-05-feature-specs-2.md) checked only the download's filename, and
its page said so. These read the bytes.

## Four defects pinned, all verified by removing the flag

- **DEF-007** — no UTF-8 BOM. The file begins `"Name`, so Excel on Windows reads
  it as the system code page and the Cyrillic group names arrive as mojibake.
- **DEF-005** — the template is not in the export. Verified by exporting a
  planner whose template says `Привіт` and finding no trace of it.
- **DEF-004** — a valid import replaces everything with no confirmation. The
  file picker is the only thing between a mis-click and losing every group.
- **DEF-006** — **the worst one, and worse than the registry described.**

## DEF-006, precisely

The registry said "a stray balanced quote in a field destroys data". Testing it
needed the exact shape, because the obvious malformed inputs are all caught:

| Input                                      | Result                |
| ------------------------------------------ | --------------------- |
| `Ab"cd` — quote inside an unquoted field   | rejected, data kept   |
| empty file                                 | rejected, data kept   |
| wrong header                               | rejected, data kept   |
| not CSV at all                             | rejected, data kept   |
| **`"a"b"c"` — four quotes, so "balanced"** | **accepted silently** |

That last row replaced both existing groups with a single group named `abc`, and
showed no dialog. The parser's only quote check is for one left open at end of
file; anything that happens to balance sails through and the result is written
straight over the planner. The registry entry now carries the concrete example.

## The round trip works — for the part CSV carries

Export, clear all three storage keys, reload, re-import: the groups come back
deep-equal, including a Cyrillic name containing a comma, two months at
different prices, and per-group currency.

The template does not, and nothing says so. That is DEF-005 from the user's
side, asserted as current behaviour rather than pinned twice. Restoring a backup
silently gives you a planner with the default template, so the next payment
message is not the one the teacher wrote.

## A note on stored order

These assertions read `localStorage`, not the cards, so they are in insertion
order. The alphabetical sort is a rendering step and never reaches the stored
array — worth knowing before writing an assertion that expects sorted data.

## DEF-002 is not re-pinned here

Its pin is in batch [1.9](p1-09-coverage-schedule-calendar.md), where the
malformed month key is created. The CSV re-import failure is the consequence,
and the round-trip test above would catch it if the corruption reached a backup.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.

## Merge order and dependencies

Depends on 1.7. Parallel development, sequential merge. Deployable: yes.

# Batch 1.8 — Coverage: group management

Phase 1 · [Plan home](README.md) · Prev: [1.7](p1-07-ci-advisory.md) · Next: [1.9](p1-09-coverage-schedule-calendar.md)

## Goal

Deepen group-management coverage using named ISTQB techniques.

## Test design (technique named per group)

- **Equivalence partitioning — group name:** normal text, empty (falls back to
  a default name), duplicate name, name with HTML characters (pins current
  behavior; see DEF-014 in the [DEF registry](def-registry.md)).
- **Boundary value analysis — default price:** 0, 0.01, a large value,
  negative, empty.
- **Decision table — closing the group form:** Save / Cancel / Escape /
  overlay click, each against "with changes" and "without changes".

## Tasks

- [x] One BDD spec file per technique group; the `describe` name carries the
      technique.
- [x] Pin known wrong behavior with `test.fixme(true, 'DEF-xxx: ...')` specs
      that describe the desired behavior.

## What landed

| File                             | Technique                | Tests         |
| -------------------------------- | ------------------------ | ------------- |
| `group-name-partitions.spec.ts`  | Equivalence partitioning | 5, one pinned |
| `group-price-boundaries.spec.ts` | Boundary value analysis  | 6             |
| `group-form-exits.spec.ts`       | Decision table           | 7, two pinned |

A small helper, `e2e/ui/support/planner-storage.ts`, reads the groups back out
of `localStorage`. Several of these assertions are about what was _stored_
rather than what is on screen, and the two are not always the same — see
DEF-008 below.

## Three defects pinned, and one of them was mis-described

All three pins were verified by removing the flag and checking the test fails
for the stated reason, then restoring the file and confirming it byte-identical.

- **DEF-014** — a group named `<b>bold</b>` is stored correctly but rendered
  through `innerHTML`, so the card contains a real `<b>` element and reads
  "bold". Unpinned, the test reports one injected element where none is wanted.
- **DEF-009** — typing a name and then changing the price throws the typed name
  away. Unpinned, the name box reads the old stored name. This is also why
  `fillGroupInfo` fills price before name; a tidy-up there would break the suite.
- **DEF-008** — **the registry described this one imprecisely, and the first
  version of the pin passed while the defect was present.**

The DEF-008 story is worth keeping. Written as "Cancel does not revert a
default-price change", the obvious test asserts the stored price after Cancel —
and that test goes green, because the price change is made to the in-memory
group and `storage.save()` is never called. Storage is right. The _screen_ is
wrong: the summary shows `UAH 777.00` while `localStorage` still holds 100, and
Cancel reverts neither. The next action that does save — editing the schedule,
say — then persists the abandoned price.

The test now asserts the price the user can see, which fails as it should. The
registry entry has been corrected, and the registry carries a short note about
false-green pins.

## Two questions for the owner, not defects

Neither is in the registry, because nobody has decided either is wrong. Both are
pinned as current behaviour so that a decision changes a test deliberately.

1. **The blank-name fallback differs between create and edit.** Saving a blank
   name on create gives `Untitled Group`; on edit it gives `Untitled`. Two
   defaults for one concept looks accidental.
2. **A negative price is accepted end to end.** No validation, no clamping; the
   group summary shows `-UAH 100.00`, and that figure would flow into the
   payment message the teacher sends. RP-01 raised this and it is still open.

A third observation, already visible in the tests: **duplicate group names are
allowed**, and nothing on the card distinguishes them. The suite locates cards
by `data-group-name`, so a duplicate makes that locator ambiguous — worth
knowing before more specs rely on it.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0 — 135 passed, 12 skipped.
      The skips are the four pinned defects (DEF-008, DEF-009, DEF-013,
      DEF-014) times three repeats, and nothing else.

## Merge order and dependencies

Depends on 1.7. Batches 1.8–1.13 can be developed in parallel but merge one by
one (they share Screenplay files). Deployable: yes.

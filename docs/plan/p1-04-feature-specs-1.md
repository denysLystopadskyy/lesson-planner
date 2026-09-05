# Batch 1.4 — Feature specs I

Phase 1 · [Plan home](README.md) · Prev: [1.3](p1-03-scaffold-core.md) · Next: [1.5](p1-05-feature-specs-2.md)

## Goal

Adopt the first three existing feature specs and make them pass against the
committed page.

## Tasks

- [x] Commit and green: `group-management.spec.ts`, `data-reset.spec.ts`,
      `template-editing.spec.ts`.
- [x] Fix locator gaps found while greening; add testids only when critical
      and append them to the contract spec and to
      [testing.md](../../.claude/context/testing.md). **No testid was needed** —
      see below.
- [x] Keep specs in BDD style (Given / When / Then).
- [x] Write the DEF-013 pin the [registry](def-registry.md) already promised
      this batch.
- [x] Stop the real payment identifiers reaching CI artifacts.

## This was a restructure, not a straight adoption

The three specs arrived as flat sequences of top-level `test()` calls: no
`describe`, no Given / When / Then, and no ISTQB technique named. The ticket
requires the first two and [testing.md](../../.claude/context/testing.md)
requires the third. Each spec is now wrapped in a `describe` that names its
technique, and the beats are marked:

| Spec                       | Technique                | Why that one                                                                                          |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `group-management.spec.ts` | State transition testing | A group moves absent → created → edited → deleted, and the planner moves between empty and populated. |
| `data-reset.spec.ts`       | Decision table           | One input, the browser confirmation; accept wipes, dismiss does not.                                  |
| `template-editing.spec.ts` | Equivalence partitioning | The partition is the exit path — Save persists, Cancel discards — not the text typed.                 |

## Four things found while greening

### 1. The one non-compliant locator, fixed without touching `index.html`

`e2e/ui/pages/planner-page.ts` located the empty state with
`page.locator(".empty-state")` — a styling class. The element has real
user-facing text, so it is now `page.getByText("No groups yet")`.

That satisfies the acceptance criterion and follows
[testing.md](../../.claude/context/testing.md)'s preference for user-facing
locators. Adding a `data-testid` would also have worked, but it would have
changed the served file — making this batch a deploy — and expanded the frozen
contract for no gain. **`index.html` is untouched, so this batch does not
deploy.** If the text proves brittle later, the testid is the fallback.

### 2. DEF-013 now has the pin the registry promised

The [registry](def-registry.md) already listed DEF-013 as pinned in this batch,
and nothing covered it. `storage.clear()` removes `groupLessonPlannerData` and
`groupLessonPlannerSettings` and leaves `paymentTemplate` behind, so a user who
clears their data keeps a template they believe is gone.

`data-reset.spec.ts` now asserts the **desired** behavior — no planner key
survives — under
`test.fixme(true, 'DEF-013: clear all data leaves the template key behind')`.
This is the first `fixme` in the suite, so it also proves the pinning pattern in
[testing.md](../../.claude/context/testing.md) works.

The pin was verified rather than assumed. Removing the flag makes the test fail
with `expect(received).toBeNull()` against the surviving template — DEF-013's
exact symptom, not an unrelated timeout. The spec was restored from a backup
afterwards and confirmed byte-for-byte identical.

### 3. The real payment identifiers would have reached CI artifacts

`template-editing.spec.ts` seeded no template, so the app fell back to its
default one, which carries the owner's real IBAN and tax id. With `trace`,
`video` and `screenshot` all set to `retain-on-failure` in
`playwright.config.ts`, a failing run would have copied those values into CI
artifacts.

Both template tests now seed their own template, as does the DEF-013 test. The
general rule is recorded in
[security-auth.md](../../.claude/context/security-auth.md), because
`payment-messages.spec.ts` in batch [1.5](p1-05-feature-specs-2.md) renders a
message generated from the same template and has the same exposure.

This is **not** DEF-015. That defect is about the values shipping in the source;
this is about them escaping into build output. Fixing one does not fix the other.

### 4. A load-bearing field order that looked like style

`fillGroupInfo` fills price, then name, then currency. That order cannot be
tidied: `groupPriceInput`'s `onchange` calls `updateDefaultPrice()`, which
re-renders the group info and overwrites an unsaved name edit — DEF-009.
Filling the name first would lose it and the suite would fail for a reason that
looks nothing like its cause. A comment on the method now says so.

## Clock control was not needed here

Batch 1.3 recorded clock control as a gap, and it looked like a blocker for this
batch. It is not: these three specs contain no date references at all. The one
clock-derived value that reaches an assertion is `- strong: /[A-Za-z]+ \d{4}/`
in the group-modal aria snapshot, which is month- and year-agnostic by
construction — the seeded group has no lessons, so exactly one row renders.

It **is** a blocker for [1.5](p1-05-feature-specs-2.md), whose four specs are all
date-dependent. That page now carries the design note.

## Acceptance criteria

- [x] `npx playwright test` exit 0 — 15 passed, 1 skipped. The skip is the
      DEF-013 `fixme`, which is the only intended skip.
- [x] No spec uses CSS-structure or XPath locators. The last class-based
      locator reachable from these specs is gone.
- [x] `npx playwright test --repeat-each=3` — 45 passed, 3 skipped, no flaky
      retries.

## Merge order and dependencies

Depends on 1.3. Merges before 1.5. Deployable: yes — `index.html` is unchanged,
so nothing about the live site moves.

# Batch 3.1 — Storage guards (fixes DEF-021, DEF-022)

Phase 3 · [Plan home](README.md) · Prev: [2b.10](p2b-10-state-store.md) · Next: [3.2](p3-02-input-import-sanitation.md)

## Goal

Stored data can be unreadable, misshapen or unwritable. None of the three may
end in silence, and none may end in a dead page.

## Why this page was rewritten

It used to be titled "fixes DEF-001" and its tasks included removing a
`test.fixme` from the DEF-001 spec. Both were written before the cutover in
[2a.4](p2a-04-cutover.md) deleted `index.html`: DEF-001 closed with that file,
its pin went with it, and `grep -rn fixme e2e/` finds no DEF-001 pin to remove.
Meanwhile the [registry](def-registry.md) routes **DEF-021** and **DEF-022** to
this batch, and the old page named neither.

So the acceptance criteria below are new. The old ones were satisfiable without
writing any code, which is the failure mode
[CLAUDE.md](../../CLAUDE.md) warns about: _never write a weak test, a fake check
or a hedged claim so that a rule appears satisfied._

## Tasks (TDD: each test fails for its stated reason first)

- [x] **DEF-021** — validate the shape after parsing, not just the syntax. A
      value that is valid JSON and the wrong shape used to reach the render and
      throw there: `monthsToRender` reads `.length` of a `dates` array that is
      not present, while rendering, so the group dialog died instead of opening.
- [x] **DEF-022** — guard every write. `saveGroups`, `saveSettings` and
      `saveTemplate` return a `WriteResult` instead of throwing, the persistence
      subscriber reads it, and a refused write reaches the screen.
- [x] Copy an unreadable value to `<key>.corrupt.backup` before carrying on, so
      the banner's promise that nothing was deleted is recoverable and not just
      true by inaction.
- [x] Call `navigator.storage.persist()` once at startup.
- [x] Give `.storage-error` a rule. It has been in the markup since the cutover
      with no CSS at all, so the DEF-001 banner rendered as unstyled body text.

## What "repair" means here, and why

A shape check can refuse the payload or mend it. This one mends it, and the rule
is **never drop what the user can still use**: a missing list becomes an empty
list, a bad field is discarded on its own, and a whole group goes only when it
has no name to show it under. A group is irreplaceable and a price is
retypeable, so a group with a zero price beats no group at all.

Every mend is reported on screen, because quietly changing stored data is the
same sin as quietly failing to store it. Only a value with no group in it — text
that is not a list — is refused outright.

## Acceptance criteria

- [x] Seeding `corrupt.txt` into the data key → the app loads, shows the error,
      the original value is untouched, and a `.corrupt.backup` key holds it.
- [x] A stored override with a price and no `dates` array → the group dialog
      **opens**, the group keeps its lessons, and the screen says what was
      repaired. Fails on the pre-batch code with "element(s) not found".
- [x] A browser that refuses to write the data key → the user is told the change
      is on screen and not stored, and the change stays on screen.
- [x] `saveGroups`, `saveSettings` and `saveTemplate` report a refusal rather
      than throwing, and report success on the ordinary path.
- [x] DEF-021 and DEF-022 marked closed in the [registry](def-registry.md).
- [x] `npm run typecheck:app`, `npm run lint`, `npm run test:unit`,
      `npm run test:e2e` all exit 0.

## A note on what the compiler did not catch

Changing the three save functions to return a `WriteResult` compiled clean while
every call site still ignored the result — TypeScript has no `must_use`. The
unit tests went green at that point and the user-facing defect was untouched.
That is why the criteria above are written as _the user is told_ rather than
_storage returns a result_, and why this batch adds e2e coverage at all.

## Merge order and dependencies

Depends on 2b.10. Blocks 3.3. **Not parallel-safe** — it rewrites every storage
read and write, and the defects routed to 3.2 and 3.4a sit on paths it touches.
Deployable: yes.

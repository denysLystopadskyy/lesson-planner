# Batch 3.7 — Cleanup (closes DEF-017)

Phase 3 · [Plan home](README.md) · Prev: [3.6](p3-06-a11y-verification.md) · Next: [4.1](p4-01-vercel-project-previews.md)

## Goal

Remove what is dead, complete what is half-done, and document the app. Last
batch of Phase 3.

## The ESLint preset, decided

The page recorded three options and asked for a choice. **Option three: enable
the preset, switch off the one rule that cannot see through the test factory.**

`eslint.config.mjs` spread `playwright.configs["flat/recommended"]` and then
wrote `rules:`, which replaces the preset's rules wholesale — **one rule was
active where the preset defines thirty-six**. Spreading them back in reports 203
problems, 201 of them `playwright/no-standalone-expect` firing on the per-spec
`configureTest()` aliases, which the rule cannot recognise as test functions.

The other option on the table was naming every alias in `globalAliases`, and
**Phase 3 is the argument against it**. That list exists and is already stale:
this phase added about twelve new aliases across five new specs and registered
none of them, and nothing noticed — because the rule was switched off by the
very mistake this batch is fixing. A list that silently falls behind is worse
than an honest exemption.

What is lost: an `expect` at module scope, outside any test, would never run and
would not be reported. What is kept: the other thirty-five rules, **which found
two real problems the moment they were switched on**.

| Finding                                  | What it was                                                                                                                                    | Fix                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright/prefer-web-first-assertions` | `payment-message-golden.spec.ts` read `inputValue()` into a variable and compared it — no retry, so a message arriving a frame late is a flake | `toHaveValue`, which compares the same string exactly and waits                                                                                                  |
| `playwright/no-conditional-in-test`      | `testid-contract.spec.ts` had an `if` inside its collection loop                                                                               | Counted with `Promise.all` and filtered. Restructuring says "this builds an inventory" more clearly than a suppression would, and the counts now run in parallel |

## DEF-017, settled by deletion

Owner decision, 2026-09-11: **delete the branch.**

The inline month price input was rendered into `#monthlySection` by the same
handler that sets that section to `display: none`, so it existed and no user
could reach it. The alternative was to show the section during calendar editing,
as the code comment intended. Deleting won because the calendar's bulk price
input already sets a month's price, and it is the control the user is looking at
while choosing that month's dates — reviving a second way to do the same thing,
in a panel that has to be un-hidden first, adds a path to test and maintain for
no capability.

`isEditing` and `onPriceChange` went with it: they existed only to feed that
branch, and so did `.priceEdit` in the CSS module.

**`month-price-input` left the frozen testid contract**, and that is the part
worth being careful about. A frozen hook that quietly disappears is exactly the
failure the contract exists to catch, so its removal is as loud as a rename
would be: the spec now asserts the hook is **absent**, and
[testing.md](../../.claude/context/testing.md) changed in the same PR, which
that document requires.

## Dead code: none left to delete

The task said to remove what the port had not already dropped. Checked and
found nothing:

- **No unused CSS classes** in any `*.module.css` — batch 2b.7 removed those
  when it split the stylesheet, and `.priceEdit` above was the last one, deleted
  with the branch that used it.
- **No unused exports** in the pure modules. Everything exported and not
  imported by another module is imported by that module's own unit test, which
  is what exporting it is for.

Recorded rather than left blank: "nothing to do" is a result, and a reader who
finds an unticked box assumes it was forgotten.

## The remaining tasks

- [x] **LICENSE copyright holder** — `Copyright 2026 Denys Lystopadskyy`, the
      sole author of every commit and the owner of the repository. **Worth the
      owner confirming**, since it is the one line here with legal weight and it
      was filled from inference rather than instruction.
- [x] **An app `README.md`** — what the app does, where the data lives and what
      that means for losing it, how to run it, how to test it, and links to the
      plan, the research and CLAUDE.md.
- [x] **Every TBD in `.claude/context/` closed or assigned.** Four were
      resolvable and are resolved; five remain and every one names its batch.

| File                                              | Was                                             | Now                                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linting-formatting.md`                           | "whether any custom ESLint rule is ever needed" | **Resolved: no.** This batch needed a rule switched _off_, not one written, so the official-presets-only policy holds unchanged                                                                    |
| `react-migration.md`                              | "React and Vite versions"                       | **Resolved.** Pinned exactly by `package.json` and the lockfile since 2a.1; repeating them here would be a second copy to forget                                                                   |
| `testing.md`                                      | suite runtime, and a list of testids            | **Neither was an open question.** The runtime is a budget and it is being met — about 2 min in CI at the end of Phase 3, against a 5 min threshold. The testid list _is_ the frozen contract above |
| `storage-data-contract.md`                        | a heading saying TBD over a resolved note       | Retitled; the one open item names batch 6.3                                                                                                                                                        |
| `backend.md`, `security-auth.md`, `deployment.md` | bare `## TBD` headings                          | Assigned already; the headings now say which phase, so the gate is visible without reading the list                                                                                                |

## Acceptance criteria

- [x] Full suite exit 0 — **180 e2e passed, 0 skipped; 331 unit passed.**
- [x] No TBD in `.claude/context/` that is not explicitly assigned to Phases
      4–6. Five remain, all assigned, all named at the heading.
- [x] The playwright preset is in effect: 35 rules active, one exempted with a
      recorded reason, both findings fixed.
- [x] DEF-017 closed in the [registry](def-registry.md).

## Phase 3 is done

The [hub's gate](README.md) is _"DEF registry has zero open rows (or a recorded
decision); corrupt-seed test shows recovery, not a dead page."_

- **The registry went from 17 open rows to one.** That one is DEF-027, found by
  this phase's own accessibility checklist and deferred with a recorded decision
  — the gate's parenthesis is exactly this case.
- **The corrupt-seed test shows recovery.**
  `storage-guards.spec.ts` seeds unreadable text, and the app loads, says so,
  leaves the value untouched and keeps a copy under `.corrupt.backup`.
- **The suite carries no `fixme` pins at all.** It had nine.

## Merge order and dependencies

Last Phase 3 batch. Deployable: yes.

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

- [x] Port template editing, message generation and review, clipboard copy,
      CSV export and import, clear-all, and the unload warning.
- [x] The golden message test passes byte for byte against `/next/`.
- [x] Run the FULL parameterized suite against `/next/`.

## What landed

Two more pure modules beside `schedule.ts`, so the parts worth unit-testing in
[2b.1](p2b-01-logic-modules-adrs.md) need no browser:

| Module               | Holds                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| `app/src/csv.ts`     | `escapeCsvValue`, `parseCsv`, `normalizeMonthKey`, `serializeCsv`, `deserializeCsv` |
| `app/src/message.ts` | `generateMonthlyPaymentMessage` and the default template                            |

`TemplateModal.tsx` and `ReviewModal.tsx` render the two remaining dialogs.
`App.tsx` gains the toolbar handlers — export, import, clear-all — and the
unload warning. The five toolbar controls are live; nothing on screen is
`disabled` any more.

`parseCsv` is ported statement for statement, including the index skip on a
doubled quote. Rewriting it "cleanly" would change which malformed files are
accepted, and DEF-006 is exactly a malformed file that **is** accepted.

## The suite now runs against both apps

The whole point of the acceptance criterion. Every spec describing behaviour the
two apps share carries `@ported` and reports a `[legacy]` and a `[ported]`
result: **170 passed, 23 skipped, exit 0**, and again with `--repeat-each=3`.

Three things had to happen first.

**Storage reads had to learn the prefix.** A spec that calls
`storedGroups(page)` reads the unprefixed key, so at `/next/` it finds nothing.
Most read back `[]` and failed loudly; `calendar-navigation-boundaries` **passed
anyway**, because its assertion compares against an empty object. They now take
the `storagePrefix` fixture, which the project supplies, rather than importing
`PORTED_STORAGE_PREFIX`. New helper: `storedTemplate(page, prefix)`.

**Structure assertions moved from the overlay to the panel.** The port marks the
overlay `role="dialog" aria-modal="true"`; the legacy markup does not. An
accessibility snapshot taken at the overlay therefore differs between the apps
by one wrapper node and nothing else. Taken at `#groupModal .modal` it is the
same tree for both, and the port keeps the role — that is the behaviour worth
having. Each modal page object gained a `panel` locator.

**Four specs stay legacy-only, on purpose:**

| Spec                                        | Why                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage-contract.spec.ts`                  | its fixtures are bound to the legacy origin. `ported-shell.spec.ts` covers the same shapes at 4174, and gained the **write-back** assertion this batch — the read side was covered, the write side was not, and the write side is the half that matters once 2a.4 points the port at real data |
| `group-form-exits` — DEF-008, DEF-009       | the port does not inherit them; `ported-groups.spec.ts` asserts the fixed behaviour, unpinned                                                                                                                                                                                                  |
| `group-name-partitions` — DEF-014           | React escapes by default, so the port never had it; a ported counterpart asserts that                                                                                                                                                                                                          |
| `group-form-exits` — "clicking the overlay" | the port has no stylesheet until [2b.7](p2b-07-styles-extraction.md), so the backdrop has no area to click. The handler exists; tag the spec when the styles land                                                                                                                              |

## Faithful on purpose, including the defects

Nine pins now run against the port as well, and **each was verified by removing
the flag and watching it fail at `/next/` for the stated reason** — the
discipline batch 1.3 set after two pins passed while their defects were present:

| DEF | What the port reproduces                                | Symptom seen at `/next/`                      |
| --- | ------------------------------------------------------- | --------------------------------------------- |
| 002 | a one-digit year still reaches a month key              | key did not match `YYYY-MM`                   |
| 004 | import replaces every group with no confirmation        | no dialog fired                               |
| 005 | the export omits the payment template                   | `Привіт` absent from the bytes                |
| 006 | a balanced stray quote is accepted                      | no dialog; groups replaced by one named `abc` |
| 007 | no UTF-8 BOM                                            | first bytes are `"Nam`                        |
| 010 | bulk price bleeds into other months holding a selection | both months repriced                          |
| 011 | "Copied!" shows even when the clipboard write failed    | label flipped, dialog closed                  |
| 012 | Escape during editing discards without asking           | selection gone                                |
| 013 | clear-all leaves the template key behind                | the seeded template survived                  |

## Deliberate divergences

Four, each small and each written down at the site:

1. **The default template carries no personal data.** The legacy default holds
   the owner's real IBAN and tax id (DEF-015); copying it into a second tracked
   file is what
   [security-auth.md](../../.claude/context/security-auth.md) forbids. The port
   ships the neutral placeholders batch [3.5](p3-05-pii-template-cleanup.md)
   specifies. **This is a cutover item** — see [2a.4](p2a-04-cutover.md).
2. **The bulk price applies on input, not on blur.** The legacy handler is bound
   to `oninput`. The port used `onBlur`, which looks identical in a browser and
   is dead under `locator.fill()`: the feature was silently inert and one spec
   caught it. Fixed here.
3. **Raising the default price cascades on Save**, not on the price field's
   `change` event. The legacy cascade runs from that event, which is also how it
   shows a price it has not stored (DEF-008). Same stored result, defect not
   inherited. `cascadeDefaultPrice` in `schedule.ts`.
4. **Escape closes one dialog.** With the review dialog open over the group
   dialog, the legacy app closes the **group** dialog and leaves the review one
   over an empty backdrop. Recorded as **DEF-018** against the legacy page; the
   port closes the topmost, so it carries no pin — see the note in the
   [registry](def-registry.md).

The blank-name fallback is **not** a divergence: the port reproduces the legacy
split — `Untitled Group` on create, `Untitled` on edit. Which one is right is an
open question for the owner.

## Acceptance criteria

- [x] `npx playwright test` (both projects) exit 0 with `--repeat-each=3`; only
      the fourteen `fixme` pins skip.
- [x] `npm run typecheck`, `npm run typecheck:app`, `npm run lint` and
      `npx prettier --check .` all clean.

## Merge order and dependencies

Depends on 2a.3c and on 1.8–1.12 (full coverage merged). Blocks 2a.4.
Deployable: yes.

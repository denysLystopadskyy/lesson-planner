# DEF registry — known defects and their pins

Rule (from [testing.md](../../.claude/context/testing.md)): a known defect gets
a spec that describes the **desired** behavior, marked
`test.fixme(true, 'DEF-xxx: <reason>')`. The fixing batch removes the flag in
the same PR as the fix. A test never asserts a bug as the expected result.

Sources: the defect analysis in
[RP-01](../research/rp01-app-inventory/rp01-app-inventory.md) §8 and
[RP-08](../research/rp08-ux-a11y-audit/rp08-ux-a11y-audit.md).
Line numbers refer to the 1,473-line committed `index.html`. Batch
[1.2](p1-02-land-test-hooks.md) landed the 1,491-line version, so those numbers
have now shifted.

| id      | Defect (short)                                                                                                                                                                                                                                                             | Pinned in                                                                                                | Fixed in                                                                                                                                                        | Status                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| DEF-001 | Corrupt JSON in one storage key leaves the page **inert but looking normal** — the static toolbar shows, no handlers are bound, no data loads and no error appears                                                                                                         | [1.13](p1-13-storage-contract.md) — `storage-contract.spec.ts`                                           | [2a.4](p2a-04-cutover.md) — the port never had it; `storage-contract.spec.ts` asserts the alert                                                                 | closed                 |
| DEF-002 | Year input can create month keys like `5-06-01` — a whole ISO date stored where a `YYYY-MM` key belongs; re-import of the app's own export then fails                                                                                                                      | [1.9](p1-09-coverage-schedule-calendar.md) — `calendar-navigation-boundaries.spec.ts`                    | [3.2](p3-02-input-import-sanitation.md)                                                                                                                         | closed                 |
| DEF-003 | A group whose currency is missing or not a currency code cannot be opened — `createMonthRow` calls `formatCurrency` with no fallback and throws                                                                                                                            | [1.13](p1-13-storage-contract.md) — `storage-contract.spec.ts`                                           | [2a.4](p2a-04-cutover.md) — the port falls back to the default currency; asserted in `storage-contract.spec.ts`                                                 | closed                 |
| DEF-004 | CSV import replaces all data without confirmation                                                                                                                                                                                                                          | [1.12](p1-12-coverage-csv.md) — `csv-import-safety.spec.ts`                                              | [3.4b](p3-04b-csv-clipboard-defects.md)                                                                                                                         | open                   |
| DEF-005 | CSV export omits the payment template, so the "backup" is incomplete                                                                                                                                                                                                       | [1.12](p1-12-coverage-csv.md) — `csv-export-contract.spec.ts`                                            | [3.3](p3-03-json-backup.md) — a JSON backup carrying all three keys; the CSV pin was retired rather than flipped, see that page                                 | closed                 |
| DEF-006 | A stray _balanced_ quote destroys data on import — `"a"b"c"` is accepted silently and replaces every group with one named `abc`                                                                                                                                            | [1.12](p1-12-coverage-csv.md) — `csv-import-safety.spec.ts`                                              | [3.4b](p3-04b-csv-clipboard-defects.md)                                                                                                                         | open                   |
| DEF-007 | CSV export has no UTF-8 BOM; Cyrillic breaks in Excel                                                                                                                                                                                                                      | [1.12](p1-12-coverage-csv.md) — `csv-export-contract.spec.ts`                                            | [3.4b](p3-04b-csv-clipboard-defects.md)                                                                                                                         | open                   |
| DEF-008 | Cancel does not revert a default-price change; the summary shows the abandoned price while storage still holds the old one, and the next save persists the abandoned value                                                                                                 | [1.8](p1-08-coverage-groups.md) — `group-form-exits.spec.ts`                                             | [2a.4](p2a-04-cutover.md) — the port holds a draft; asserted in `group-regressions.spec.ts`                                                                     | closed                 |
| DEF-009 | A price change silently reverts an unsaved name edit                                                                                                                                                                                                                       | [1.8](p1-08-coverage-groups.md) — `group-form-exits.spec.ts`                                             | [2a.4](p2a-04-cutover.md) — same draft, same spec                                                                                                               | closed                 |
| DEF-010 | Bulk price can rewrite months the user does not see (cross-month bleed)                                                                                                                                                                                                    | [1.10](p1-10-coverage-overrides-pricing.md) — `pricing-bulk-scope.spec.ts`                               | [3.4a](p3-04a-interaction-defects.md) — fixed, not declared intended: the price applies to the month on screen only (owner decision, 2026-09-11)                | closed                 |
| DEF-011 | "Copied!" shows even when the clipboard write failed                                                                                                                                                                                                                       | [1.11](p1-11-coverage-message-template.md) — `clipboard-copy.spec.ts`                                    | [3.4a](p3-04a-interaction-defects.md)                                                                                                                           | closed                 |
| DEF-012 | Escape during calendar editing discards changes without asking                                                                                                                                                                                                             | [1.9](p1-09-coverage-schedule-calendar.md) — `calendar-edit-transitions.spec.ts`                         | [3.4a](p3-04a-interaction-defects.md)                                                                                                                           | closed                 |
| DEF-013 | "Clear all data" leaves the template key behind                                                                                                                                                                                                                            | [1.4](p1-04-feature-specs-1.md) — `data-reset.spec.ts`, `fixme`                                          | [3.4b](p3-04b-csv-clipboard-defects.md)                                                                                                                         | open                   |
| DEF-014 | Group name is inserted into `innerHTML` without escaping (stored XSS pattern)                                                                                                                                                                                              | [1.8](p1-08-coverage-groups.md) — `group-name-partitions.spec.ts`                                        | [2a.4](p2a-04-cutover.md) — React escapes; asserted in `group-regressions.spec.ts`                                                                              | closed                 |
| DEF-015 | Real personal payment identifiers ship in the default template (lines 387–392, 400)                                                                                                                                                                                        | not a spec — a grep gate                                                                                 | [2a.4](p2a-04-cutover.md) — the file holding the values is deleted; git history is a separate, optional decision                                                | closed (working tree)  |
| DEF-016 | Modal open/close fade never plays. The legacy page set `hidden` in the same tick as the `show` class; the React app mounts the overlay with `show` already applied, so the `opacity 0.2s` transition is dead code for a second reason                                      | not a spec — see the note below                                                                          | [3.4a](p3-04a-interaction-defects.md) — `@starting-style` on the native `<dialog>`; opening only, verified by hand, no spec                                     | closed                 |
| DEF-017 | Inline month price input is rendered into `#monthlySection` by the same handler that sets that section to `display: none`, so no user can ever see or reach it                                                                                                             | [1.3](p1-03-scaffold-core.md) (attachment only)                                                          | [3.7](p3-07-cleanup.md) — fix or delete the dead branch                                                                                                         | open (decision needed) |
| DEF-018 | Escape with the review dialog open closes the **group** dialog underneath it, leaving the review dialog over an empty backdrop                                                                                                                                             | not a spec — see the note below                                                                          | [2a.4](p2a-04-cutover.md) — the legacy Escape handler is gone                                                                                                   | closed                 |
| DEF-019 | The five toolbar buttons sit inside the `<h1>`, so the heading's accessible name is the title plus every button label, and the page has no banner landmark                                                                                                                 | [2a.3f](p2a-03f-layout-fix-visual-checks.md) — `visual-layout.spec.ts`, asserted against the port        | [2a.4](p2a-04-cutover.md) — the page that had it is deleted; the port's banner is asserted in `visual-layout.spec.ts`                                           | closed                 |
| DEF-020 | A price written the way a spreadsheet or a European locale writes it — `250,50` or `1 200` — is imported as **0**, silently. `Number("250,50")` is `NaN`, `parseNumber` returns null, and the fallback is zero                                                             | [2b.1](p2b-01-logic-modules-adrs.md) — `csv.test.ts`, asserted as current behaviour                      | [3.2](p3-02-input-import-sanitation.md)                                                                                                                         | closed                 |
| DEF-021 | A stored override without its `dates` array crashes the group dialog: `monthsToRender` reads `.length` of `undefined`. `storage.ts` guards `JSON.parse` but never the shape, so data that parses and is wrong reaches the render                                           | [2b.1](p2b-01-logic-modules-adrs.md) — `schedule.test.ts`, asserted as current behaviour                 | [3.1](p3-01-storage-guards.md)                                                                                                                                  | closed                 |
| DEF-022 | A refused write is not reported. `saveGroups`, `saveSettings` and `saveTemplate` call `setItem` with no guard, so a quota error or a private-browsing refusal escapes; the app has no server, so the edit is simply lost and nothing says so                               | [2b.1](p2b-01-logic-modules-adrs.md) — `storage.test.ts`, asserted as current behaviour                  | [3.1](p3-01-storage-guards.md)                                                                                                                                  | closed                 |
| DEF-023 | An open dialog neither takes focus nor keeps it. Focus stays on the control behind the overlay, and Tab walks the dialog's controls and then leaves for the toolbar — while `aria-modal="true"` tells a screen reader that everything behind is unavailable                | [2b.2](p2b-02-toolbar-group-list.md) — `group-card-keyboard.spec.ts`, `fixme`                            | [2b.3](p2b-03-group-modal.md) — the native `<dialog>` element; the pin is gone and `group-card-keyboard.spec.ts` asserts it plainly                             | closed                 |
| DEF-024 | A selected day is white on the accent green at 16px/600 — **2.78:1**, where WCAG 2.2 AA 1.4.3 asks 4.5:1 for text that size. Every selected date in the calendar is below the standard, and selection is the calendar's whole purpose                                      | [2b.4](p2b-04-calendar-editor.md) — measured, not pinned: a spec would have to assert the failing colour | [2b.7](p2b-07-styles-extraction.md) — `--accent` moved to `#2e7d32`; white on a selected day now measures 5.13:1                                                | closed                 |
| DEF-025 | Every control's border is `#ccc`: **1.61:1** on a panel and **1.53:1** on the page, where WCAG 2.2 AA 1.4.11 asks 3:1 of a boundary that carries meaning. It is the outline that says where a button ends                                                                  | [2b.7](p2b-07-styles-extraction.md) — measured, and deferred on the record rather than omitted           | [3.6](p3-06-a11y-verification.md) — the target is about `#868f9e` (3.26:1 and 3.12:1); it repaints every button in the app, which is not this batch's task list | open                   |
| DEF-026 | Saving a group's details overwrites the **app-wide** default currency with that group's currency, whether or not the select was touched. A planner whose default is PLN is flipped to UAH by editing the price of a UAH group, and the next new group then defaults to UAH | [2b.10](p2b-10-state-store.md) — `storage-contract.spec.ts`, asserted as current behaviour               | [3.4a](p3-04a-interaction-defects.md)                                                                                                                           | closed                 |

When a batch closes a DEF, update the Status column in the same PR.

## Four rows added by unit-testing the pure modules

DEF-026 was found by the golden-shape assertion in batch
[2b.10](p2b-10-state-store.md): the field-by-field write-back check beside it
had passed for batches, because the fixture it used had the same currency
everywhere. The legacy app did the same thing on the line after its save, so
the port is faithful and the behaviour is old — only the measurement is new.

DEF-020, DEF-021 and DEF-022 were found in batch
[2b.1](p2b-01-logic-modules-adrs.md), by writing unit tests for code that had
already been ported and shipped. None is reachable from the screens the e2e
suite drives: a locale-formatted price needs a CSV nobody in the suite writes,
a shape-invalid override needs storage that parses and is still wrong, and a
refused write needs a full disk. All three are cheap to assert one function at
a time, and none was visible from outside.

They follow the unit convention rather than the pin convention: the tests assert
what the functions do today, with a comment naming the fixing batch. See
[testing.md](../../.claude/context/testing.md).

## Eight rows closed by deleting a file

The cutover in [2a.4](p2a-04-cutover.md) deleted `index.html`, and with it every
defect that lived only in that file: DEF-001, DEF-003, DEF-008, DEF-009,
DEF-014, DEF-018 and DEF-019, plus DEF-015 in the working tree.

None of the eight was _fixed_. Seven never existed in the React app, because
controlled inputs, a guarded storage read, React's escaping, a single Escape
handler and a real `<header>` landmark do not have those failure modes. The
eighth, DEF-015, is closed only in the working tree: git history still holds the
values and cleaning it is the owner's separate decision.

The pins went with the page. Where a spec still says something worth saying, it
was rewritten as a plain assertion of the working behaviour —
`storage-contract.spec.ts` for DEF-001 and DEF-003, `group-regressions.spec.ts`
for DEF-008, DEF-009 and DEF-014, `visual-layout.spec.ts` for DEF-019 — so a
regression fails loudly instead of a `fixme` quietly passing.

## DEF-024 was fixed in 2b.7 and stayed open on the record

Batch [2b.7](p2b-07-styles-extraction.md) moved `--accent` from `#4caf50` to
`#2e7d32`, ticked DEF-024 off on its own page and recorded the new ratio in its
results table. It did not update the Status column here, so the row read `open`
for three batches while the defect was gone.

The close was verified before flipping it, rather than trusted: `--accent` is
`#2e7d32` at `app/src/styles.css:55-58`, `.day.selected` paints `#fff` on that
token at `app/src/CalendarEditor.module.css:32-36`, and white on `#2e7d32`
computes to 5.13:1 — above the 4.5:1 that 1.4.3 asks. This matters beyond one
row: the Phase 3 exit gate is "zero open rows", so a stale `open` is a batch of
work that nobody can do.

The rule above — update the Status column in the same PR — is the one that was
missed. It is worth re-reading as a check on the _closing_ batch, not on the
next reader.

## A pin can pass while its defect is present

DEF-008 was first pinned in batch [1.8](p1-08-coverage-groups.md) with a test
that asserted `localStorage`, and it **passed** — because the price change is
made to the in-memory group and never saved. Storage was right; the screen was
wrong. A pin that green-lights its own defect is worse than no pin, so the test
now asserts the price the user can see.

The lesson generalises: write the pin against the symptom a person would
report, and prove it fails by removing the flag before trusting it.

## Notes on defects that carry no spec pin

**DEF-016** cannot be pinned the way the rule intends. The desired behavior is a
200 ms CSS transition, and there is no way to assert it here that the project's
own rules allow: polling opacity mid-transition is flaky by construction, and
pixel regression is barred until the emoji icons become SVG (plan batches 2b.6
and 2b.8, see [testing.md](../../.claude/context/testing.md)). So it is recorded
without a pin, the same treatment DEF-015 gets. Verify it by hand when 3.4a
fixes it, or fold it into the visual suite once 2b.8 makes a transition
observable.

**DEF-018** was found while porting the review dialog in batch
[2a.3d](p2a-03d-port-template-message-csv.md), not by a test. The legacy Escape
handler looks through a fixed list — group, template, review — and closes the
first one it finds open, so the dialog underneath goes and the one on top stays.
It carries no pin because the port does **not** reproduce it: `GroupModal.tsx`
takes an `escapeCloses` prop and the topmost dialog closes. Pinning it would
mean a spec that must skip against the legacy page and pass against the port,
which the two-tag scheme has no way to express. Batch 3.4a fixes the legacy page
or the batch that deletes it makes the point moot.

**DEF-017** is pinned only in the weak sense. The contract spec asserts that
`month-price-input` is _attached_ and _hidden_, because the hook is frozen and
must not silently disappear. That assertion is not a statement that the current
behavior is correct — it is what will fail, and demand a decision, whichever way
3.7 settles it. The decision needed: show `#monthlySection` during calendar
editing so the inline inputs work as the code comment intends, or delete the
branch and keep the calendar's bulk price input as the only way to set a price.
Related prior art: RP-01 lists this control as **core**, and
`qa-coverage-investigation.md` proposed a scenario for it. Both are wrong in the
same way scenario LP-010 was — a test written against unreachable code.

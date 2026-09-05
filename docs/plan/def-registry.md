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

| id      | Defect (short)                                                                                                                                                             | Pinned in                                                                 | Fixed in                                                            | Status                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- |
| DEF-001 | Corrupt JSON in one storage key makes the page dead, no error shown                                                                                                        | [1.13](p1-13-storage-contract.md)                                         | [3.1](p3-01-storage-guards.md)                                      | open                   |
| DEF-002 | Year input can create month keys like `5-08-10`; re-import of the app's own export then fails                                                                              | [1.9](p1-09-coverage-schedule-calendar.md), [1.12](p1-12-coverage-csv.md) | [3.2](p3-02-input-import-sanitation.md)                             | open                   |
| DEF-003 | A currency value that is not three letters makes a group impossible to open                                                                                                | [1.12](p1-12-coverage-csv.md)                                             | [3.2](p3-02-input-import-sanitation.md)                             | open                   |
| DEF-004 | CSV import replaces all data without confirmation                                                                                                                          | [1.12](p1-12-coverage-csv.md)                                             | [3.4b](p3-04b-csv-clipboard-defects.md)                             | open                   |
| DEF-005 | CSV export omits the payment template, so the "backup" is incomplete                                                                                                       | [1.12](p1-12-coverage-csv.md)                                             | [3.3](p3-03-json-backup.md) (JSON backup covers all keys)           | open                   |
| DEF-006 | A stray balanced quote in a field destroys data on import                                                                                                                  | [1.12](p1-12-coverage-csv.md)                                             | [3.4b](p3-04b-csv-clipboard-defects.md)                             | open                   |
| DEF-007 | CSV export has no UTF-8 BOM; Cyrillic breaks in Excel                                                                                                                      | [1.12](p1-12-coverage-csv.md)                                             | [3.4b](p3-04b-csv-clipboard-defects.md)                             | open                   |
| DEF-008 | Cancel does not revert a default-price change; the summary shows the abandoned price while storage still holds the old one, and the next save persists the abandoned value | [1.8](p1-08-coverage-groups.md) — `group-form-exits.spec.ts`              | [3.4a](p3-04a-interaction-defects.md)                               | open                   |
| DEF-009 | A price change silently reverts an unsaved name edit                                                                                                                       | [1.8](p1-08-coverage-groups.md) — `group-form-exits.spec.ts`              | [3.4a](p3-04a-interaction-defects.md)                               | open                   |
| DEF-010 | Bulk price can rewrite months the user does not see (cross-month bleed)                                                                                                    | [1.10](p1-10-coverage-overrides-pricing.md)                               | [3.4a](p3-04a-interaction-defects.md) — fix or declare intended     | open (decision needed) |
| DEF-011 | "Copied!" shows even when the clipboard write failed                                                                                                                       | [1.11](p1-11-coverage-message-template.md)                                | [3.4a](p3-04a-interaction-defects.md)                               | open                   |
| DEF-012 | Escape during calendar editing discards changes without asking                                                                                                             | [1.9](p1-09-coverage-schedule-calendar.md)                                | [3.4a](p3-04a-interaction-defects.md)                               | open                   |
| DEF-013 | "Clear all data" leaves the template key behind                                                                                                                            | [1.4](p1-04-feature-specs-1.md) — `data-reset.spec.ts`, `fixme`           | [3.4b](p3-04b-csv-clipboard-defects.md)                             | open                   |
| DEF-014 | Group name is inserted into `innerHTML` without escaping (stored XSS pattern)                                                                                              | [1.8](p1-08-coverage-groups.md) — `group-name-partitions.spec.ts`         | [3.2](p3-02-input-import-sanitation.md) (React escaping + assert)   | open                   |
| DEF-015 | Real personal payment identifiers ship in the default template (lines 387–392, 400)                                                                                        | not a spec — a grep gate                                                  | [3.5](p3-05-pii-template-cleanup.md) — LOW priority (user decision) | open                   |
| DEF-016 | Modal open/close fade no longer plays; `hidden` is set in the same tick as the `show` class, so the `opacity 0.2s` transition is dead code                                 | not a spec — see the note below                                           | [3.4a](p3-04a-interaction-defects.md)                               | open                   |
| DEF-017 | Inline month price input is rendered into `#monthlySection` by the same handler that sets that section to `display: none`, so no user can ever see or reach it             | [1.3](p1-03-scaffold-core.md) (attachment only)                           | [3.7](p3-07-cleanup.md) — fix or delete the dead branch             | open (decision needed) |

When a batch closes a DEF, update the Status column in the same PR.

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

# DEF registry — known defects and their pins

Rule (from [testing.md](../../.claude/context/testing.md)): a known defect gets
a spec that describes the **desired** behavior, marked
`test.fixme(true, 'DEF-xxx: <reason>')`. The fixing batch removes the flag in
the same PR as the fix. A test never asserts a bug as the expected result.

Sources: the defect analysis in
[RP-01](../research/rp01-app-inventory/rp01-app-inventory.md) §8 and
[RP-08](../research/rp08-ux-a11y-audit/rp08-ux-a11y-audit.md).
Line numbers refer to the 1,473-line committed `index.html`; they shift after
batch [1.2](p1-02-land-test-hooks.md).

| id | Defect (short) | Pinned in | Fixed in | Status |
| --- | --- | --- | --- | --- |
| DEF-001 | Corrupt JSON in one storage key makes the page dead, no error shown | [1.13](p1-13-storage-contract.md) | [3.1](p3-01-storage-guards.md) | open |
| DEF-002 | Year input can create month keys like `5-08-10`; re-import of the app's own export then fails | [1.9](p1-09-coverage-schedule-calendar.md), [1.12](p1-12-coverage-csv.md) | [3.2](p3-02-input-import-sanitation.md) | open |
| DEF-003 | A currency value that is not three letters makes a group impossible to open | [1.12](p1-12-coverage-csv.md) | [3.2](p3-02-input-import-sanitation.md) | open |
| DEF-004 | CSV import replaces all data without confirmation | [1.12](p1-12-coverage-csv.md) | [3.4b](p3-04b-csv-clipboard-defects.md) | open |
| DEF-005 | CSV export omits the payment template, so the "backup" is incomplete | [1.12](p1-12-coverage-csv.md) | [3.3](p3-03-json-backup.md) (JSON backup covers all keys) | open |
| DEF-006 | A stray balanced quote in a field destroys data on import | [1.12](p1-12-coverage-csv.md) | [3.4b](p3-04b-csv-clipboard-defects.md) | open |
| DEF-007 | CSV export has no UTF-8 BOM; Cyrillic breaks in Excel | [1.12](p1-12-coverage-csv.md) | [3.4b](p3-04b-csv-clipboard-defects.md) | open |
| DEF-008 | Cancel does not revert a default-price change | [1.10](p1-10-coverage-overrides-pricing.md) | [3.4a](p3-04a-interaction-defects.md) | open |
| DEF-009 | A price change silently reverts an unsaved name edit | [1.10](p1-10-coverage-overrides-pricing.md) | [3.4a](p3-04a-interaction-defects.md) | open |
| DEF-010 | Bulk price can rewrite months the user does not see (cross-month bleed) | [1.10](p1-10-coverage-overrides-pricing.md) | [3.4a](p3-04a-interaction-defects.md) — fix or declare intended | open (decision needed) |
| DEF-011 | "Copied!" shows even when the clipboard write failed | [1.11](p1-11-coverage-message-template.md) | [3.4a](p3-04a-interaction-defects.md) | open |
| DEF-012 | Escape during calendar editing discards changes without asking | [1.9](p1-09-coverage-schedule-calendar.md) | [3.4a](p3-04a-interaction-defects.md) | open |
| DEF-013 | "Clear all data" leaves the template key behind | pinned in feature specs ([1.4](p1-04-feature-specs-1.md)) | [3.4b](p3-04b-csv-clipboard-defects.md) | open |
| DEF-014 | Group name is inserted into `innerHTML` without escaping (stored XSS pattern) | [1.8](p1-08-coverage-groups.md) | [3.2](p3-02-input-import-sanitation.md) (React escaping + assert) | open |
| DEF-015 | Real personal payment identifiers ship in the default template (lines 387–392, 400) | not a spec — a grep gate | [3.5](p3-05-pii-template-cleanup.md) — LOW priority (user decision) | open |

When a batch closes a DEF, update the Status column in the same PR.

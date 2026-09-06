> **Historical.** This describes `index.html`, the single-file app that plan
> batch [2a.4](plan/p2a-04-cutover.md) deleted. It is kept because the research
> reports and the DEF registry refer to that structure. For the app as it is
> now, read `app/src/` and [the plan](plan/README.md).

**Architecture Overview**
The app is a single-page static HTML file. All UI, state management, and logic live in `index.html` under a single `App` object. The object is organized into `state`, `config`, `elements`, `handlers`, `render`, `services`, and `utils` sections.

**State Model**
The application state is stored in `App.state` with the following keys.

- `groups`: array of group objects.
- `editingIndex`: index of the group currently being edited, or `null`.
- `isEditing`: unified edit mode flag for schedule and prices.
- `isEditingGroupInfo`: flag for group info edit mode.
- `tempSelectedDates`: temporary `Set` of selected date keys while editing.
- `calMonth`: active calendar month index.
- `calYear`: active calendar year.
- `defaultCurrency`: last used currency, defaults to `UAH`.
- `tempMonthlyOverrides`: temporary overrides while editing.

**Data Model**
Group shape stored in `groups`.

- `{ name, price, currency, dates, monthlyOverrides }`
- `dates` is a sorted list of ISO date keys `YYYY-MM-DD`.
  Monthly override shape stored in `monthlyOverrides`.
- `{ price, dates[] }` keyed by `YYYY-MM`.

**Persistence**
Local storage keys used by the app.

- `groupLessonPlannerData` stores the serialized groups array.
- `groupLessonPlannerSettings` stores `{ defaultCurrency }`.
- `paymentTemplate` stores the custom message template.

**Test Hooks**
The UI exposes stable `data-*` hooks for Playwright on dynamic and repeated elements.
These hooks landed in plan batch 1.2. RP-01 records this claim as false, which it
was at the time: it was written against the then-uncommitted working copy. It is
true of the deployed app now. The names below are a frozen contract enforced by
`e2e/features/testid-contract.spec.ts`; see
[.claude/context/testing.md](../.claude/context/testing.md).

- Group cards include `data-group-name`, `data-group-index`, and `data-testid="group-card-lesson-count"`.
- Monthly rows include `data-month-key` and child hooks for lesson count, total, per-lesson price, and copy action.
- Calendar weekday headers expose `data-weekday`.
- Calendar day cells expose `data-date`, `data-day`, and `data-weekday`.

**Test Bootstrap Contract**
The Playwright suite seeds app state through storage state before page load.

- Tests write the same localStorage keys listed above via `e2e/ui/support/storage-state.ts`.
- This keeps scenarios isolated and fast, but any persistence-key change must be updated in both app code and test bootstrap.

**CSV Import/Export**
Export format.

- Header columns: `Name`, `Default Price`, `Currency`, `Month`, `Month Price`, `Dates`.
- `Dates` is a space-delimited list of ISO date keys.
- Values are CSV-escaped with quotes.
  Import behavior.
- Requires all header columns listed above.
- Accepts month formats `YYYY-MM` or `YYYY/M` and normalizes to `YYYY-MM`.
- Merges duplicate group rows and deduplicates dates.
- Throws on missing columns, an empty file, and invalid month values, and the
  existing data is preserved when it throws.
- **Does not throw on every malformed file.** A stray quote that happens to
  balance is accepted silently and replaces the existing data with garbage, with
  no dialog. Recorded as DEF-006 in
  [docs/plan/def-registry.md](plan/def-registry.md); fixed in plan batch 3.4b.
  Do not rely on the parser to reject a corrupt backup.

**Calendar and Selection Rules**

- Week starts on Monday, weekday headers toggle all matching days in the visible month.
- The calendar highlights the current day and weekends.
- `Clear Month` removes all selected dates in the visible month.
- The summary shows selected count and total with the current month price.
- The bulk price input updates per-month prices for the months affected by the current selection.

**Pricing and Overrides**

- Default price is stored on the group and applied to new months.
- When the default price changes, future overrides with the old price are updated.
- Overrides only persist for months that have at least one lesson.

**Payment Message Generation**

- Template tokens: `{{month}}`, `{{lessons}}`, `{{total}}`.
- Month name is computed from the month key and formatted in `en-US`.
- The generated message is shown in the review modal and can be copied to clipboard.

**Utility Functions**

- Date helpers: `iso`, `pad`, `startWeekday`, `toMonthKey`, `formatDate`.
- Currency formatting via `Intl.NumberFormat`.
- CSV parser with quote handling and RFC4180-style rules.
- `deepClone` for safe override editing.

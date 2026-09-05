/**
 * The instant every test runs at.
 *
 * The app reads `new Date()` in ten places — the calendar's opening month, the
 * `today` highlight, the always-rendered current-month row, the CSV export
 * filename, and the `>=` guard in `updateDefaultPrice`. Without a pin, those
 * move with the wall clock and several specs would drift or break on a month
 * boundary.
 *
 * Mid-month and mid-year on purpose. A date at the end of a month makes
 * `updateDefaultPrice`'s current-month guard a boundary case, and a date in
 * December makes "next month" a year rollover. Neither should fire by accident;
 * a spec that wants those cases should ask for them by overriding `now`.
 *
 * **Two clocks have to agree.** Pinning the browser is only half of it: the
 * specs also generate their test months in Node, through `faker.date.soon()`,
 * which reads the Node process clock. `page.clock` cannot reach that. So
 * `test-data.ts` pins faker's reference date to this same instant at module
 * scope — early enough to beat the `pickMonthContext()` calls that run while
 * specs are being collected.
 */
export const FIXED_NOW = new Date("2026-06-15T12:00:00.000Z");

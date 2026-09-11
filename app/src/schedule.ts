import type { DateKey, Group, MonthKey, MonthOverride } from "./types";

/**
 * Schedule and override arithmetic, ported from the legacy `App.services.groups`
 * and kept as pure functions so the behaviour can be read without a browser.
 *
 * These reproduce the legacy behaviour deliberately, defects included — batch
 * 2a.3c's brief is a faithful port, with fixes waiting for Phase 3. Where a
 * function encodes a known defect it says so.
 */

/**
 * The range of years a calendar may show — DEF-002.
 *
 * The year input is an `<input type="number">`, which accepts anything a
 * keyboard can produce. Typing a single digit gave the day cells dates like
 * `5-12-01`, and saving wrote that whole date in where a `YYYY-MM` month key
 * belongs; the app's own CSV export then refused to re-import it, so a backup
 * taken afterwards could not be restored.
 *
 * These bounds are a planning range, not a claim about calendars. The app plans
 * lesson dates for a working teacher, so a century either side of now is
 * generous. What matters is only that a year outside the range cannot reach a
 * month key.
 */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

/** Whether a year can safely become part of a `YYYY-MM` key. */
export const isSupportedYear = (year: number): boolean =>
  Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const DAY_NAMES = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

/**
 * The weekday names in full, Monday first, for accessible names.
 *
 * `DAY_NAMES` holds the visible three-letter labels, and the frozen test
 * contract asserts that text, so the long form lives here instead of replacing
 * it. A screen reader reading a column header should say "Monday", not "Mon".
 */
export const FULL_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const pad = (value: number): string => String(value).padStart(2, "0");

export const isoDate = (
  year: number,
  monthIndex: number,
  day: number,
): DateKey => `${String(year)}-${pad(monthIndex + 1)}-${pad(day)}`;

export const monthKeyOf = (date: DateKey): MonthKey => date.slice(0, 7);

export const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate();

/** Monday-first weekday index, 0..6. */
export const weekdayOf = (
  year: number,
  monthIndex: number,
  day: number,
): number => (new Date(year, monthIndex, day).getDay() + 6) % 7;

/** Blank cells before the 1st, so the grid starts on the right weekday. */
export const leadingSpacers = (year: number, monthIndex: number): number =>
  weekdayOf(year, monthIndex, 1);

export const overridesOf = (group: Group): Record<MonthKey, MonthOverride> =>
  group.monthlyOverrides ?? {};

/** A month's price: its override if it has one, else the group default. */
export const priceForMonth = (
  overrides: Record<MonthKey, MonthOverride>,
  monthKey: MonthKey,
  fallback: number,
): number => overrides[monthKey]?.price ?? fallback;

const groupDatesByMonth = (
  dates: Iterable<DateKey>,
): Record<MonthKey, DateKey[]> => {
  const byMonth: Record<MonthKey, DateKey[]> = {};
  for (const date of dates) {
    const key = monthKeyOf(date);
    (byMonth[key] ??= []).push(date);
  }
  return byMonth;
};

/**
 * Commits a pending selection into a group, the way `saveDateChanges` does.
 *
 * A month that ends with no dates is dropped entirely rather than kept at zero,
 * which is why cancelling out of every date in a month removes its row.
 */
export const commitSelection = (
  group: Group,
  selected: ReadonlySet<DateKey>,
  pendingOverrides: Record<MonthKey, MonthOverride>,
): Group => {
  const byMonth = groupDatesByMonth(selected);
  const overrides: Record<MonthKey, MonthOverride> = {};

  for (const monthKey of new Set([
    ...Object.keys(pendingOverrides),
    ...Object.keys(byMonth),
  ])) {
    const dates = byMonth[monthKey] ?? [];
    if (dates.length === 0) continue; // normalizeOverrides drops empty months
    overrides[monthKey] = {
      price: pendingOverrides[monthKey]?.price ?? group.price,
      dates: [...dates].sort(),
    };
  }

  return {
    ...group,
    dates: [...selected].sort(),
    monthlyOverrides: overrides,
  };
};

/**
 * Toggling a weekday header.
 *
 * Not a toggle in the usual sense, and the port keeps it that way: with none of
 * that weekday selected it selects all, with **all** selected it clears them,
 * and with only some selected it completes the set. Documented in batch 1.9.
 */
export const toggleWeekday = (
  selected: ReadonlySet<DateKey>,
  year: number,
  monthIndex: number,
  weekday: number,
): Set<DateKey> => {
  const next = new Set(selected);
  const matching: DateKey[] = [];
  for (let day = 1; day <= daysInMonth(year, monthIndex); day += 1) {
    if (weekdayOf(year, monthIndex, day) === weekday) {
      matching.push(isoDate(year, monthIndex, day));
    }
  }

  const allSelected = matching.every((date) => next.has(date));
  for (const date of matching) {
    if (allSelected) next.delete(date);
    else next.add(date);
  }
  return next;
};

/**
 * Applying the bulk price — to the month on screen, and no other.
 *
 * **DEF-010, fixed in plan batch 3.4a** (owner decision, 2026-09-11). The
 * legacy behaviour wrote the price into every month holding a selected date,
 * and the port was faithful to it. A selection made earlier in another month
 * was therefore silently repriced while the user looked at July — she could not
 * see June while doing it, and nothing said it had happened.
 *
 * The function now takes the visible month and writes only that one. Nothing
 * happens at all when the visible month holds none of the selected dates: the
 * field describes "selected dates", and if none are in view there is nothing on
 * screen for the number to describe, so inventing an override would be a second
 * surprise rather than a convenience.
 */
export const applyBulkPrice = (
  overrides: Record<MonthKey, MonthOverride>,
  selected: ReadonlySet<DateKey>,
  price: number,
  currentMonthKey: MonthKey,
): Record<MonthKey, MonthOverride> => {
  const byMonth = groupDatesByMonth(selected);
  if (byMonth[currentMonthKey] === undefined) return { ...overrides };
  return {
    ...overrides,
    [currentMonthKey]: {
      price,
      dates: overrides[currentMonthKey]?.dates ?? [],
    },
  };
};

/**
 * Which month rows to render: every month with lessons, plus the month the
 * calendar is currently showing — which is why an empty current month still
 * gets a row.
 */
export const monthsToRender = (
  overrides: Record<MonthKey, MonthOverride>,
  currentMonthKey: MonthKey,
): MonthKey[] => {
  // `Array.isArray`, not `.dates.length`. A month that is present without its
  // `dates` array is DEF-021: `JSON.parse` and an `as` cast let stored bytes in
  // wearing a type they do not satisfy, so `MonthOverride["dates"]` being
  // non-nullable is a claim about intent rather than about the value. Storage
  // repairs that shape on load, but this runs during a render and a render that
  // throws takes the whole group dialog down — two guards for one crash is the
  // right number when one of them is a render.
  const withLessons = Object.keys(overrides).filter((key) => {
    const dates: DateKey[] | undefined = overrides[key]?.dates;
    return Array.isArray(dates) && dates.length > 0;
  });
  return [...new Set([...withLessons, currentMonthKey])].sort();
};

/**
 * Raising or lowering the group default, the way `updateDefaultPrice` does.
 *
 * A month moves only when it is **not in the past** and its price still equals
 * the **old** default — so a month priced by hand keeps its price, and so does
 * a month that has already been invoiced.
 */
export const cascadeDefaultPrice = (
  overrides: Record<MonthKey, MonthOverride>,
  oldPrice: number,
  newPrice: number,
  currentMonthKey: MonthKey,
): Record<MonthKey, MonthOverride> =>
  Object.fromEntries(
    Object.entries(overrides).map(([monthKey, override]) =>
      monthKey >= currentMonthKey && override.price === oldPrice
        ? [monthKey, { ...override, price: newPrice }]
        : [monthKey, override],
    ),
  );

export const monthLabel = (monthKey: MonthKey): string => {
  const [year, month] = monthKey.split("-");
  const index = Number(month) - 1;
  return `${MONTH_NAMES[index] ?? monthKey} ${year ?? ""}`.trim();
};

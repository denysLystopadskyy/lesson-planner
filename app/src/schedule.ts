import type { DateKey, Group, MonthKey, MonthOverride } from "./types";

/**
 * Schedule and override arithmetic, ported from the legacy `App.services.groups`
 * and kept as pure functions so the behaviour can be read without a browser.
 *
 * These reproduce the legacy behaviour deliberately, defects included — batch
 * 2a.3c's brief is a faithful port, with fixes waiting for Phase 3. Where a
 * function encodes a known defect it says so.
 */

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
 * Applying the bulk price.
 *
 * **This reproduces DEF-010 on purpose.** The price is written into every month
 * that holds a selected date, not only the month on screen, so a selection made
 * earlier in another month is silently repriced. The port is faithful here; the
 * fix — or a decision that the bleed is intended — belongs to plan batch 3.4a.
 */
export const applyBulkPrice = (
  overrides: Record<MonthKey, MonthOverride>,
  selected: ReadonlySet<DateKey>,
  price: number,
): Record<MonthKey, MonthOverride> => {
  const next = { ...overrides };
  for (const monthKey of Object.keys(groupDatesByMonth(selected))) {
    next[monthKey] = {
      price,
      dates: next[monthKey]?.dates ?? [],
    };
  }
  return next;
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
  const withLessons = Object.keys(overrides).filter(
    (key) => (overrides[key]?.dates.length ?? 0) > 0,
  );
  return [...new Set([...withLessons, currentMonthKey])].sort();
};

export const monthLabel = (monthKey: MonthKey): string => {
  const [year, month] = monthKey.split("-");
  const index = Number(month) - 1;
  return `${MONTH_NAMES[index] ?? monthKey} ${year ?? ""}`.trim();
};

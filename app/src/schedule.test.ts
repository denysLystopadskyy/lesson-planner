import { describe, expect, it } from "vitest";
import {
  DAY_NAMES,
  MONTH_NAMES,
  applyBulkPrice,
  cascadeDefaultPrice,
  commitSelection,
  daysInMonth,
  isoDate,
  leadingSpacers,
  monthKeyOf,
  monthLabel,
  monthsToRender,
  overridesOf,
  pad,
  priceForMonth,
  toggleWeekday,
  weekdayOf,
} from "./schedule";
import type { DateKey, Group, MonthKey, MonthOverride } from "./types";

/**
 * Unit tests for the schedule arithmetic.
 *
 * The module is a faithful port of the legacy code, defects included, so these
 * tests state what it does **today**. Where that is wrong, the comment names
 * the DEF and the batch that fixes it, per the rule in CLAUDE.md. The e2e suite
 * holds the `fixme` pins that describe the desired behaviour; they are not
 * repeated here.
 *
 * June 2026 is the working month in most tests. It starts on a Monday, which
 * makes the weekday arithmetic easy to read, and the e2e clock is pinned inside
 * it (`FIXED_NOW`, 2026-06-15).
 */

const buildGroup = (changes: Partial<Group> = {}): Group => ({
  name: "Bulk Fixture",
  price: 100,
  currency: "UAH",
  dates: [],
  ...changes,
});

const month = (price: number, dates: DateKey[]): MonthOverride => ({
  price,
  dates,
});

/** The five Mondays of June 2026. */
const JUNE_MONDAYS: DateKey[] = [
  "2026-06-01",
  "2026-06-08",
  "2026-06-15",
  "2026-06-22",
  "2026-06-29",
];

const MONDAY = 0;
const TUESDAY = 1;
const SUNDAY = 6;

/** The day names the calendar header renders, in the order it renders them. */
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The month names the month picker renders, in the order it renders them. */
const CALENDAR_MONTHS = [
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
];

const sorted = (dates: Iterable<DateKey>): DateKey[] => [...dates].sort();

/**
 * Boundary value analysis on the index into each list, with the completeness
 * check the testing rules ask for. `CalendarEditor` renders both lists with
 * `.map((name, index) => …)` and reads `MONTH_NAMES[monthIndex]` for the
 * footer, so a name in the wrong slot mislabels real dates. Every position
 * carries meaning, not only the two ends, so the whole list is pinned. Checking
 * January and December alone would miss two names swapped in the middle.
 */
describe("MONTH_NAMES and DAY_NAMES — boundary value analysis", () => {
  it("The twelve month names are listed in calendar order", () => {
    expect([...MONTH_NAMES]).toEqual(CALENDAR_MONTHS);
  });

  it("The seven day names are listed Monday first", () => {
    expect([...DAY_NAMES]).toEqual(WEEK_DAYS);
  });

  it("Each day name sits at the index weekdayOf gives that day", () => {
    // The header cell and the dates under it share one index, so this is the
    // check that ties the list to the arithmetic. The first week of June 2026
    // runs from Monday the 1st to Sunday the 7th.
    const firstWeek = [1, 2, 3, 4, 5, 6, 7].map(
      (day) => DAY_NAMES[weekdayOf(2026, 5, day)],
    );

    expect(firstWeek).toEqual(WEEK_DAYS);
  });

  it("Each month key is labelled with the name at its own index", () => {
    const labels = [...CALENDAR_MONTHS.keys()].map((index) =>
      monthLabel(`2026-${pad(index + 1)}`),
    );

    expect(labels).toEqual(CALENDAR_MONTHS.map((name) => `${name} 2026`));
  });
});

/**
 * Boundary value analysis. The field is two characters wide, so the values that
 * matter are the ones just inside it, just outside it, and the one that fills
 * the pad with a sign instead of a digit.
 */
describe("pad — boundary value analysis", () => {
  it("A single digit gets a leading zero", () => {
    expect(pad(1)).toBe("01");
    expect(pad(9)).toBe("09");
  });

  it("Two digits are left as they are", () => {
    expect(pad(10)).toBe("10");
    expect(pad(31)).toBe("31");
  });

  it("A number too wide for the field is not cut short", () => {
    // A month index past December still produces a key. Nothing here rejects
    // it; see the isoDate tests below for what that key looks like.
    expect(pad(100)).toBe("100");
  });

  it("A minus sign fills the pad, so a negative number keeps its own width", () => {
    expect(pad(-1)).toBe("-1");
  });
});

/**
 * Boundary value analysis over the two ends of the year and the two ends of the
 * month. `isoDate` does no arithmetic of its own — it formats what it is given,
 * so an out-of-range month index passes straight through.
 */
describe("isoDate — boundary value analysis", () => {
  it("Month index zero is January and month index eleven is December", () => {
    expect(isoDate(2026, 0, 1)).toBe("2026-01-01");
    expect(isoDate(2026, 11, 31)).toBe("2026-12-31");
  });

  it("A month index past December is written out as a thirteenth month", () => {
    expect(isoDate(2026, 12, 1)).toBe("2026-13-01");
  });

  it("The year is never padded, so a small year makes a short key", () => {
    // This is the arithmetic behind DEF-002, not the defect itself: the
    // function faithfully formats the year it is handed, and the year input is
    // what lets a value this small reach it. The right behaviour is to reject
    // or pad the year so every key is ten characters. Plan batch 3.2
    // (input and import sanitation) fixes it.
    expect(isoDate(5, 5, 1)).toBe("5-06-01");
  });
});

/**
 * Boundary value analysis on a fixed-width slice. The function takes the first
 * seven characters and trusts them to be `YYYY-MM`.
 */
describe("monthKeyOf — boundary value analysis", () => {
  it("A normal date key keeps its year and its month", () => {
    expect(monthKeyOf("2026-06-15")).toBe("2026-06");
  });

  it("A one-digit year makes the month key hold a whole date", () => {
    // DEF-002. `5-06-01` is seven characters long, so the slice keeps all of
    // it and a date ends up stored where a `YYYY-MM` key belongs — which is
    // why re-importing the app's own export then fails. The right behaviour is
    // a key of `YYYY-MM` for every input. Plan batch 3.2 fixes it.
    expect(monthKeyOf(isoDate(5, 5, 1))).toBe("5-06-01");
  });

  it("A three-digit year makes the month key end in a dash", () => {
    // DEF-002 again, cut in a different place. Same fix, plan batch 3.2.
    expect(monthKeyOf("999-06-01")).toBe("999-06-");
  });
});

/**
 * Boundary value analysis. February is the boundary month, the century years
 * are the boundary of the leap rule, and December is the boundary where the
 * underlying Date has to roll into the next year.
 */
describe("daysInMonth — boundary value analysis", () => {
  it("February has 29 days in a leap year and 28 in a common year", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  it("A century year follows the 400-year rule", () => {
    expect(daysInMonth(2000, 1)).toBe(29);
    expect(daysInMonth(1900, 1)).toBe(28);
  });

  it("Short months, long months and December all come out right", () => {
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 3)).toBe(30);
    // December asks the Date for day zero of the January after it, so the year
    // rolls over inside the Date rather than here.
    expect(daysInMonth(2026, 11)).toBe(31);
  });
});

/**
 * Equivalence partitioning: years below 100 are one partition, and the Date
 * constructor treats them differently from every other year. DEF-002 says the
 * year input can reach these values, so this is reachable, not theoretical.
 */
describe("Years below 100 — equivalence partitioning", () => {
  it("A year below 100 is read as a year in the 1900s", () => {
    // Year 0 divides by 400 and would be a leap year. 1900 does not and is
    // not, so 28 days proves which year the Date used.
    expect(daysInMonth(0, 1)).toBe(28);
  });

  it("The grid is laid out for one year while the keys claim another", () => {
    // The same low year, two answers. `isoDate` stores year 50; the calendar
    // arithmetic lays the month out as 1950. The stored data and the grid the
    // user clicked disagree. Plan batch 3.2 keeps the year out of this range.
    expect(isoDate(50, 1, 1)).toBe("50-02-01");
    // 1 February 1950 was a Wednesday, which is index 2 Monday-first. Stated
    // rather than derived: `toBe(weekdayOf(1950, 1, 1))` would compare the
    // function with itself and name no day at all.
    expect(weekdayOf(50, 1, 1)).toBe(2);
    // And 1 February 2050 is a Tuesday, so the low year is not being widened
    // into the 2000s.
    expect(weekdayOf(2050, 1, 1)).toBe(1);
  });
});

/**
 * Boundary value analysis on a Monday-first index: the two ends of the week,
 * and the day number that falls off the end of the month.
 */
describe("weekdayOf — boundary value analysis", () => {
  it("Monday is 0 and Sunday is 6", () => {
    expect(weekdayOf(2026, 5, 1)).toBe(MONDAY);
    expect(weekdayOf(2026, 5, 7)).toBe(SUNDAY);
  });

  it("Saturday is 5, the last index before the week starts again", () => {
    expect(weekdayOf(2026, 5, 6)).toBe(5);
  });

  it("A day number past the end of the month rolls into the next month", () => {
    // 32 January 2026 is 1 February 2026, a Sunday. The Date normalises it; no
    // caller is told the day was out of range.
    expect(weekdayOf(2026, 0, 32)).toBe(SUNDAY);
    expect(weekdayOf(2026, 0, 32)).toBe(weekdayOf(2026, 1, 1));
  });
});

/**
 * Boundary value analysis: a month starting on the first weekday needs no
 * spacers, a month starting on the last weekday needs the most, and a month
 * starting midweek sits between them.
 */
describe("leadingSpacers — boundary value analysis", () => {
  it("A month that starts on Monday needs no blank cells", () => {
    expect(leadingSpacers(2026, 5)).toBe(0);
  });

  it("A month that starts on Sunday needs six blank cells", () => {
    expect(leadingSpacers(2026, 1)).toBe(6);
  });

  it("A month that starts midweek needs one cell per earlier weekday", () => {
    // January 2026 starts on a Thursday.
    expect(leadingSpacers(2026, 0)).toBe(3);
  });
});

/** Equivalence partitioning: the overrides are there, or they are not. */
describe("overridesOf — equivalence partitioning", () => {
  it("A group written by an older version yields an empty record", () => {
    expect(overridesOf(buildGroup())).toEqual({});
  });

  it("A group with overrides yields the very same object, not a copy", () => {
    // Worth knowing: the caller can write straight into the group through the
    // returned record. GroupModal takes a `structuredClone` before editing.
    const overrides = { "2026-06": month(100, ["2026-06-01"]) };
    const group = buildGroup({ monthlyOverrides: overrides });
    expect(overridesOf(group)).toBe(overrides);
  });
});

/**
 * Equivalence partitioning: the month has an override, or it has none. Zero is
 * the boundary that shows `??` is not `||`.
 */
describe("priceForMonth — equivalence partitioning", () => {
  const overrides: Record<MonthKey, MonthOverride> = {
    "2026-06": month(250, ["2026-06-01"]),
    "2026-07": month(0, ["2026-07-06"]),
  };

  it("A month with an override uses the override price", () => {
    expect(priceForMonth(overrides, "2026-06", 100)).toBe(250);
  });

  it("A month with no override falls back to the group price", () => {
    expect(priceForMonth(overrides, "2026-08", 100)).toBe(100);
  });

  it("A price of zero is kept, not read as a missing price", () => {
    expect(priceForMonth(overrides, "2026-07", 100)).toBe(0);
  });
});

/**
 * Decision table. Two conditions decide what happens to a month:
 *
 * | selected dates in the month | pending override | result                    |
 * | --------------------------- | ---------------- | ------------------------- |
 * | yes                         | yes              | kept at the pending price |
 * | yes                         | no               | kept at the group price   |
 * | no                          | yes              | dropped entirely          |
 * | no                          | no               | nothing to do             |
 */
describe("commitSelection — decision table", () => {
  it("Selected dates are grouped by month and sorted inside each month", () => {
    const group = buildGroup();
    const selected = new Set<DateKey>([
      "2026-07-06",
      "2026-06-15",
      "2026-06-01",
    ]);

    expect(commitSelection(group, selected, {}).monthlyOverrides).toEqual({
      "2026-06": month(100, ["2026-06-01", "2026-06-15"]),
      "2026-07": month(100, ["2026-07-06"]),
    });
  });

  it("A month with a pending price keeps that price", () => {
    const group = buildGroup();
    const selected = new Set<DateKey>(["2026-06-01"]);
    const pending = { "2026-06": month(250, []) };

    expect(commitSelection(group, selected, pending).monthlyOverrides).toEqual({
      "2026-06": month(250, ["2026-06-01"]),
    });
  });

  it("A month with no pending price falls back to the group default", () => {
    // A sharp edge, not a defect. The function never reads the group's own
    // `monthlyOverrides`, so a price saved earlier is lost unless the caller
    // passes it back in. GroupModal does exactly that — it seeds the pending
    // record with `structuredClone(overridesOf(group))` when the dialog opens
    // — so the saved price survives in the app. Do not "fix" it here.
    const group = buildGroup({
      monthlyOverrides: { "2026-06": month(250, ["2026-06-01"]) },
    });
    const selected = new Set<DateKey>(["2026-06-01"]);

    expect(commitSelection(group, selected, {}).monthlyOverrides).toEqual({
      "2026-06": month(100, ["2026-06-01"]),
    });
  });

  it("A month that ends with no dates is dropped, not kept at zero", () => {
    // This is why cancelling out of every date in a month removes its row.
    const group = buildGroup();
    const pending = {
      "2026-06": month(250, ["2026-06-01"]),
      "2026-07": month(300, ["2026-07-06"]),
    };
    const selected = new Set<DateKey>(["2026-07-06"]);

    expect(commitSelection(group, selected, pending).monthlyOverrides).toEqual({
      "2026-07": month(300, ["2026-07-06"]),
    });
  });

  it("The group's own date list holds every selected date in order", () => {
    const group = buildGroup();
    const selected = new Set<DateKey>([
      "2026-07-06",
      "2026-06-15",
      "2026-06-01",
    ]);

    expect(commitSelection(group, selected, {}).dates).toEqual([
      "2026-06-01",
      "2026-06-15",
      "2026-07-06",
    ]);
  });

  it("The name, price and currency of the group are carried over", () => {
    const group = buildGroup({ name: "Tuesday Group", price: 120 });
    const result = commitSelection(group, new Set<DateKey>(), {});

    expect(result.name).toBe("Tuesday Group");
    expect(result.price).toBe(120);
    expect(result.currency).toBe("UAH");
  });

  it("The group passed in is not changed", () => {
    const group = buildGroup({
      dates: ["2026-05-04"],
      monthlyOverrides: { "2026-05": month(250, ["2026-05-04"]) },
    });

    commitSelection(group, new Set<DateKey>(["2026-06-01"]), {});

    expect(group.dates).toEqual(["2026-05-04"]);
    expect(group.monthlyOverrides).toEqual({
      "2026-05": month(250, ["2026-05-04"]),
    });
  });
});

/**
 * State transition testing. A weekday column has three states — none of its
 * dates selected, some of them, all of them — and the header click moves
 * between them. It is not a plain toggle: from "some" it completes the set
 * rather than clearing it, so two clicks from "some" are needed to clear.
 */
describe("toggleWeekday — state transition testing", () => {
  it("With none of that weekday selected, all of them are selected", () => {
    const result = toggleWeekday(new Set<DateKey>(), 2026, 5, MONDAY);
    expect(sorted(result)).toEqual(JUNE_MONDAYS);
  });

  it("With every one of that weekday selected, they are all cleared", () => {
    const result = toggleWeekday(new Set(JUNE_MONDAYS), 2026, 5, MONDAY);
    expect(sorted(result)).toEqual([]);
  });

  it("With only some selected, the set is completed rather than cleared", () => {
    const some = new Set<DateKey>(["2026-06-08", "2026-06-22"]);
    const result = toggleWeekday(some, 2026, 5, MONDAY);
    expect(sorted(result)).toEqual(JUNE_MONDAYS);
  });

  it("Two clicks from a part-filled column are needed to empty it", () => {
    const some = new Set<DateKey>(["2026-06-08"]);
    const filled = toggleWeekday(some, 2026, 5, MONDAY);
    expect(sorted(toggleWeekday(filled, 2026, 5, MONDAY))).toEqual([]);
  });

  it("Other weekdays and other months are left alone", () => {
    const other = new Set<DateKey>(["2026-05-04", "2026-06-03"]);
    const result = toggleWeekday(other, 2026, 5, MONDAY);

    expect(sorted(result)).toEqual(
      sorted([...JUNE_MONDAYS, "2026-05-04", "2026-06-03"]),
    );
  });

  it("The set passed in is not changed", () => {
    const before = new Set<DateKey>(["2026-06-08"]);
    toggleWeekday(before, 2026, 5, MONDAY);
    expect(sorted(before)).toEqual(["2026-06-08"]);
  });

  it("A weekday index outside the week matches nothing and changes nothing", () => {
    const before = new Set<DateKey>(["2026-06-08"]);
    const result = toggleWeekday(before, 2026, 5, 7);

    expect(result).not.toBe(before);
    expect(sorted(result)).toEqual(["2026-06-08"]);
  });
});

/**
 * Boundary value analysis on the two ends of the loop that collects the dates
 * of one weekday.
 *
 * The state transition tests above all use Monday in June 2026, and that one
 * fixture hides both ends by accident: the last day of the month, the 30th, is
 * a Tuesday, and the day before the 1st, 31 May, is a Sunday. Neither is a
 * Monday, so a loop that stopped a day early, or started a day early, would
 * still pass every test above. These two pick months where each end is a
 * Tuesday, so the exact set says whether the end was read.
 */
describe("toggleWeekday — boundary value analysis", () => {
  it("The last day of the month is selected when it falls on that weekday", () => {
    // 30 June 2026 is a Tuesday and is the last day of the month.
    const result = toggleWeekday(new Set<DateKey>(), 2026, 5, TUESDAY);

    expect(sorted(result)).toEqual([
      "2026-06-02",
      "2026-06-09",
      "2026-06-16",
      "2026-06-23",
      "2026-06-30",
    ]);
  });

  it("The day before the 1st is left out, even when it falls on that weekday", () => {
    // 30 June 2026 is a Tuesday, so July's "day zero" is one too. A loop that
    // started at zero would put the date "2026-07-00" into the selection.
    const result = toggleWeekday(new Set<DateKey>(), 2026, 6, TUESDAY);

    expect(sorted(result)).toEqual([
      "2026-07-07",
      "2026-07-14",
      "2026-07-21",
      "2026-07-28",
    ]);
  });
});

/**
 * Equivalence partitioning over three kinds of month: the one the user is
 * looking at, another month that also holds a selected date, and a month with
 * no selection at all. The first two are the same partition to this function,
 * which is the defect.
 */
describe("applyBulkPrice — equivalence partitioning", () => {
  it("Every month holding a selected date is repriced, not only the one on screen", () => {
    // DEF-010, reproduced on purpose. The function is not even told which
    // month is on screen, so it cannot limit the change to it: a date picked
    // in June earlier in the same editing session is silently repriced when
    // the user sets a price while looking at July. The right behaviour is to
    // reprice only the visible month. Plan batch 3.4a fixes it or records the
    // bleed as intended — the DEF registry marks it "decision needed".
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-06": month(100, ["2026-06-08"]),
      "2026-07": month(100, ["2026-07-08"]),
    };
    const selected = new Set<DateKey>(["2026-06-08", "2026-07-08"]);

    expect(applyBulkPrice(overrides, selected, 777)).toEqual({
      "2026-06": month(777, ["2026-06-08"]),
      "2026-07": month(777, ["2026-07-08"]),
    });
  });

  it("A month with no selected date keeps its price", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-06": month(100, ["2026-06-08"]),
      "2026-07": month(100, ["2026-07-08"]),
    };
    const selected = new Set<DateKey>(["2026-07-08"]);

    expect(applyBulkPrice(overrides, selected, 777)).toEqual({
      "2026-06": month(100, ["2026-06-08"]),
      "2026-07": month(777, ["2026-07-08"]),
    });
  });

  it("A repriced month that had no override gets an empty date list", () => {
    // The selected dates are not written into the new override. Only
    // `commitSelection` fills them in, when the dialog is saved.
    const selected = new Set<DateKey>(["2026-06-08"]);

    expect(applyBulkPrice({}, selected, 777)).toEqual({
      "2026-06": month(777, []),
    });
  });

  it("A month priced before it is saved has no row to show the price in", () => {
    // The empty date list above meets `monthsToRender`, which drops months
    // with no dates. So the price is set, stored in the pending record, and
    // invisible until the selection is committed.
    const priced = applyBulkPrice({}, new Set<DateKey>(["2026-06-08"]), 777);

    expect(monthsToRender(priced, "2026-07")).toEqual(["2026-07"]);
  });

  it("The record passed in is not changed", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-06": month(100, ["2026-06-08"]),
    };

    applyBulkPrice(overrides, new Set<DateKey>(["2026-06-08"]), 777);

    expect(overrides).toEqual({ "2026-06": month(100, ["2026-06-08"]) });
  });
});

/**
 * A small decision table — a month is empty or not, and it is the month on
 * screen or not — checked at the boundary that matters for the sort order, the
 * turn of the year.
 */
describe("monthsToRender — boundary value analysis", () => {
  it("The month on screen is rendered even when it holds no lessons", () => {
    expect(monthsToRender({}, "2026-06")).toEqual(["2026-06"]);
  });

  it("An empty month that is not on screen is dropped", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-05": month(100, []),
      "2026-06": month(100, ["2026-06-08"]),
    };

    expect(monthsToRender(overrides, "2026-06")).toEqual(["2026-06"]);
  });

  it("Months are sorted, so December comes before the January after it", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-01": month(100, ["2026-01-05"]),
      "2025-12": month(100, ["2025-12-01"]),
    };

    expect(monthsToRender(overrides, "2026-01")).toEqual([
      "2025-12",
      "2026-01",
    ]);
  });

  it("The month on screen is listed once, even when it holds lessons", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-06": month(100, ["2026-06-08"]),
    };

    expect(monthsToRender(overrides, "2026-06")).toEqual(["2026-06"]);
  });
});

/**
 * Boundary value analysis on the month number: the first month, the last month,
 * and the two values just outside that range.
 */
describe("monthLabel — boundary value analysis", () => {
  it("The first and last months are named", () => {
    expect(monthLabel("2026-01")).toBe("January 2026");
    expect(monthLabel("2026-12")).toBe("December 2026");
  });

  it("A month number outside the year falls back to the key and repeats the year", () => {
    // Nobody would expect this from the name. There is no month 13, so the
    // fallback prints the whole key and then appends the year again.
    expect(monthLabel("2026-13")).toBe("2026-13 2026");
    expect(monthLabel("2026-00")).toBe("2026-00 2026");
  });

  it("A key that is really a whole date is labelled with the wrong year", () => {
    // DEF-002 reaching the screen. `5-06-01` splits into year "5" and month
    // "06", so the row reads "June 5" and the corruption looks like a label
    // bug. The right behaviour is that no such key is ever stored; plan batch
    // 3.2 fixes it at the input.
    expect(monthLabel("5-06-01")).toBe("June 5");
  });

  it("An empty key gives an empty label rather than an error", () => {
    expect(monthLabel("")).toBe("");
  });
});

/**
 * Decision table. Two conditions, six cells:
 *
 * | month    | price equals the old default | result             |
 * | -------- | ---------------------------- | ------------------ |
 * | past     | yes                          | keeps its price    |
 * | past     | no                           | keeps its price    |
 * | current  | yes                          | moves to the new   |
 * | current  | no                           | keeps its price    |
 * | future   | yes                          | moves to the new   |
 * | future   | no                           | keeps its price    |
 *
 * The current month counts as "not in the past", so it moves. The month keys
 * are compared as text, which is safe because they are zero-padded.
 */
describe("cascadeDefaultPrice — decision table", () => {
  it("A future month priced at the old default moves to the new price", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-07": month(100, ["2026-07-06"]),
    };

    expect(cascadeDefaultPrice(overrides, 100, 150, "2026-06")).toEqual({
      "2026-07": month(150, ["2026-07-06"]),
    });
  });

  it("The month on screen moves too, because only the past is protected", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-06": month(100, ["2026-06-08"]),
    };

    expect(cascadeDefaultPrice(overrides, 100, 150, "2026-06")).toEqual({
      "2026-06": month(150, ["2026-06-08"]),
    });
  });

  it("A past month keeps its price even when it matches the old default", () => {
    // A month that has already been invoiced must not change.
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-05": month(100, ["2026-05-04"]),
    };

    expect(cascadeDefaultPrice(overrides, 100, 150, "2026-06")).toEqual({
      "2026-05": month(100, ["2026-05-04"]),
    });
  });

  it("A month priced by hand keeps its price, before, during and after", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-05": month(250, ["2026-05-04"]),
      "2026-06": month(250, ["2026-06-08"]),
      "2026-07": month(250, ["2026-07-06"]),
    };

    // Compared with a literal, not with `overrides`. A function that mutated
    // its argument and repriced would move both sides together, and the test
    // would pass while the defect was present.
    expect(cascadeDefaultPrice(overrides, 100, 150, "2026-06")).toEqual({
      "2026-05": month(250, ["2026-05-04"]),
      "2026-06": month(250, ["2026-06-08"]),
      "2026-07": month(250, ["2026-07-06"]),
    });
  });

  it("A corrupt key counts as a future month", () => {
    // DEF-002 again. "5-06-01" is compared as text, and "5" sorts after "2",
    // so a broken key is always treated as being in the future and is
    // repriced. Plan batch 3.2 keeps such keys out of storage.
    const overrides: Record<MonthKey, MonthOverride> = {
      "5-06-01": month(100, ["5-06-01"]),
    };

    expect(cascadeDefaultPrice(overrides, 100, 150, "2026-06")).toEqual({
      "5-06-01": month(150, ["5-06-01"]),
    });
  });

  it("The record passed in is not changed", () => {
    const overrides: Record<MonthKey, MonthOverride> = {
      "2026-07": month(100, ["2026-07-06"]),
    };

    cascadeDefaultPrice(overrides, 100, 150, "2026-06");

    expect(overrides).toEqual({ "2026-07": month(100, ["2026-07-06"]) });
  });
});

describe("Stored data that parses and is still wrong", () => {
  it("An override with no dates array crashes the month list", () => {
    // DEF-021. `storage.ts` guards `JSON.parse` and nothing else, so a value
    // that is valid JSON and the wrong shape reaches the render. This is the
    // line that throws — `MonthlyOverrides.tsx` calls `monthsToRender` while
    // rendering, so the group dialog dies rather than showing the group.
    // Asserted as it behaves today; plan batch 3.1 validates the shape on load
    // and this becomes a test that the bad month is dropped.
    const fromStorage = { "2026-06": { price: 100 } } as unknown as Record<
      MonthKey,
      MonthOverride
    >;

    expect(() => monthsToRender(fromStorage, "2026-07")).toThrow(TypeError);
  });

  it("The same shape is safe once it has an empty dates array", () => {
    // The neighbouring case, so the test above is pinned to the missing array
    // rather than to anything else about the object.
    const fromStorage: Record<MonthKey, MonthOverride> = {
      "2026-06": { price: 100, dates: [] },
    };

    expect(monthsToRender(fromStorage, "2026-07")).toEqual(["2026-07"]);
  });
});

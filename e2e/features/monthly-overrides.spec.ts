import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import { formatCurrency, monthName } from "../ui/support/formatters";
import { plannerState } from "../ui/support/planner-state";
import {
  buildGroup,
  buildOverride,
  pickMonthContext,
  randomDatesInMonth,
} from "../ui/support/test-data";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  openScheduleEditor,
  selectCalendarDays,
  setBulkPrice,
  setCalendarMonthYear,
} from "../ui/screenplay/tasks/schedule-tasks";
import { calendarSummaryText } from "../ui/screenplay/questions/schedule-questions";
import {
  monthRowLessonCount,
  monthRowPerLessonText,
  monthRowTotalText,
} from "../ui/screenplay/questions/monthly-questions";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";

const editSeed = 5505;
faker.seed(editSeed);
const editingGroup = buildGroup();
const editMonthPriceTest = configureTest({
  plannerState: plannerState({
    groups: [editingGroup],
  }),
});

/**
 * ISTQB technique: state transition testing. A month's price moves from the
 * group default to an override, and that override then has to survive into the
 * monthly list. One test sets it, the other reads it back after a reload of
 * state from storage.
 *
 * The month each test works in comes from `pickMonthContext()`, deterministic
 * because faker's reference date is pinned - see `e2e/ui/support/clock.ts`.
 */
editMonthPriceTest.describe(
  "Monthly overrides — state transition testing",
  () => {
    editMonthPriceTest(
      "Setting a bulk price updates the calendar summary",
      async ({ actor }) => {
        const { year, monthIndex, key } = pickMonthContext();

        await actor.attemptsTo(
          openGroupCard(editingGroup.name),
          openScheduleEditor(),
          setCalendarMonthYear(year, monthIndex),
        );

        const selectedDates = randomDatesInMonth({
          year,
          monthIndex,
          count: faker.number.int({ min: 2, max: 5 }),
        });

        const days = selectedDates.map((date) => Number(date.split("-")[2]));
        await actor.attemptsTo(selectCalendarDays(year, monthIndex, days));

        const newPrice = faker.number.int({ min: 100, max: 1800 });
        await actor.attemptsTo(setBulkPrice(newPrice));

        const summary = await actor.asks(calendarSummaryText());
        const expectedTotal = formatCurrency(
          selectedDates.length * newPrice,
          editingGroup.currency,
        );
        await expect(summary).toContainText(
          `${String(selectedDates.length)} days selected in ${monthName(key)}`,
        );
        await expect(summary).toContainText(expectedTotal);
      },
    );
  },
);

const overrideSeed = 6606;
faker.seed(overrideSeed);
const { year, monthIndex, key } = pickMonthContext();
const overridePrice = faker.number.int({ min: 100, max: 2000 });
const dates = randomDatesInMonth({
  year,
  monthIndex,
  count: faker.number.int({ min: 2, max: 4 }),
});
const { override } = buildOverride({
  monthKey: key,
  price: overridePrice,
  dates,
});
const overrideGroup = buildGroup({
  monthlyOverrides: {
    [key]: override,
  },
});
const persistedOverrideTest = configureTest({
  plannerState: plannerState({
    groups: [overrideGroup],
  }),
});

persistedOverrideTest.describe(
  "Monthly overrides — state transition testing",
  () => {
    persistedOverrideTest(
      "A saved override shows its own price in the monthly list",
      async ({ actor }) => {
        await actor.attemptsTo(openGroupCard(overrideGroup.name));
        const web = actor.abilityTo(BrowseTheWeb);
        await expectAriaSnapshot(
          web.monthlyOverrides.rowByMonthKey(key),
          `
- strong: /${monthName(key)} ${String(year)}/
- text: /\\(\\d+ lessons\\) Total:\\s.* Per lesson:\\s.*/
- button /Copy Payment Message/
`,
        );

        const expectedTotal = formatCurrency(
          overridePrice * dates.length,
          overrideGroup.currency,
        );
        const expectedPerLesson = formatCurrency(
          overridePrice,
          overrideGroup.currency,
        );

        await expect(await actor.asks(monthRowLessonCount(key))).toHaveText(
          `(${String(dates.length)} lessons)`,
        );
        await expect(
          await actor.asks(monthRowPerLessonText(key)),
        ).toContainText(expectedPerLesson);
        await expect(await actor.asks(monthRowTotalText(key))).toContainText(
          expectedTotal,
        );
      },
    );
  },
);

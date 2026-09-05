import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import {
  countWeekdayInMonth,
  formatCurrency,
  monthKey,
  monthName,
} from "../ui/support/formatters";
import {
  buildGroup,
  pickMonthContext,
  randomDatesInMonth,
} from "../ui/support/test-data";
import { plannerState } from "../ui/support/planner-state";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  clearMonthSelection,
  openScheduleEditor,
  saveDateChanges,
  cancelDateChanges,
  selectCalendarDays,
  setCalendarMonthYear,
  toggleWeekday,
} from "../ui/screenplay/tasks/schedule-tasks";
import {
  calendarSummaryText,
  selectedDaysCount,
} from "../ui/screenplay/questions/schedule-questions";
import {
  monthRowLessonCount,
  monthRowTotalText,
} from "../ui/screenplay/questions/monthly-questions";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { calendarHiddenAfterSave } from "../ui/screenplay/assertions/schedule-assertions";

const scheduleSeed = 4404;
faker.seed(scheduleSeed);
const scheduleGroup = buildGroup();
const scheduleTest = configureTest({
  plannerState: plannerState({
    groups: [scheduleGroup],
  }),
});

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * ISTQB technique: state transition testing.
 *
 * The calendar editor is a small state machine: closed -> open -> dates
 * selected -> saved or cancelled. Each test drives one transition and asserts
 * the state it lands in, including the two exits, which must differ.
 *
 * The months these tests work in come from `pickMonthContext()`, which is
 * deterministic because faker's reference date is pinned — see
 * `e2e/ui/support/clock.ts`.
 */
scheduleTest.describe("Schedule editing — state transition testing", () => {
  scheduleTest("Open the schedule editor", async ({ actor }) => {
    // Fixed, not random: the aria snapshot below names February and 2026, so the
    // calendar has to be on exactly that month.
    const snapshotYear = 2026;
    const snapshotMonthIndex = 1;

    await actor.attemptsTo(
      openGroupCard(scheduleGroup.name),
      openScheduleEditor(),
      setCalendarMonthYear(snapshotYear, snapshotMonthIndex),
    );

    const web = actor.abilityTo(BrowseTheWeb);
    await expectAriaSnapshot(
      web.calendarEditor.container,
      `
- button "◀"
- combobox:
  - option "January"
  - option "February" [selected]
  - option "March"
  - option "April"
  - option "May"
  - option "June"
  - option "July"
  - option "August"
  - option "September"
  - option "October"
  - option "November"
  - option "December"
- spinbutton: "2026"
- button "▶"
- button "Today"
- button "Clear Month"
- text: /Mon Tue Wed Thu Fri Sat Sun .* Set price for selected dates:/
- spinbutton "Set price for selected dates:" [disabled]: /\\d+/
- text: Select dates to enable price editing.
- button "Cancel"
- button "Done"
`,
    );
    await expect(web.calendarEditor.container).toBeVisible();
    await expect(web.groupModal.monthlySection).toBeHidden();
  });

  scheduleTest("Select individual dates", async ({ actor }) => {
    const { year, monthIndex, key } = pickMonthContext();

    await actor.attemptsTo(
      openGroupCard(scheduleGroup.name),
      openScheduleEditor(),
      setCalendarMonthYear(year, monthIndex),
    );

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const day = faker.number.int({ min: 1, max: daysInMonth });

    await actor.attemptsTo(selectCalendarDays(year, monthIndex, [day]));

    const summary = await actor.asks(calendarSummaryText());
    const expectedTotal = formatCurrency(
      scheduleGroup.price,
      scheduleGroup.currency,
    );
    await expect(summary).toContainText(`1 days selected in ${monthName(key)}`);
    await expect(summary).toContainText(expectedTotal);
  });

  scheduleTest("Toggle all weekdays in a month", async ({ actor }) => {
    const { year, monthIndex, key } = pickMonthContext();
    const weekdayIndex = faker.helpers.arrayElement([0, 1, 2, 3, 4]);
    const weekdayLabel = dayLabels[weekdayIndex];

    await actor.attemptsTo(
      openGroupCard(scheduleGroup.name),
      openScheduleEditor(),
      setCalendarMonthYear(year, monthIndex),
      toggleWeekday(weekdayLabel),
    );

    const expectedCount = countWeekdayInMonth(year, monthIndex, weekdayIndex);
    const expectedTotal = formatCurrency(
      expectedCount * scheduleGroup.price,
      scheduleGroup.currency,
    );

    await expect(await actor.asks(selectedDaysCount())).toHaveCount(
      expectedCount,
    );
    const summary = await actor.asks(calendarSummaryText());
    await expect(summary).toContainText(
      `${expectedCount} days selected in ${monthName(key)}`,
    );
    await expect(summary).toContainText(expectedTotal);
  });

  scheduleTest("Clear the current month", async ({ actor }) => {
    const { year, monthIndex } = pickMonthContext();

    await actor.attemptsTo(
      openGroupCard(scheduleGroup.name),
      openScheduleEditor(),
      setCalendarMonthYear(year, monthIndex),
    );

    const selectedDates = randomDatesInMonth({
      year,
      monthIndex,
      count: faker.number.int({ min: 2, max: 4 }),
    });

    const days = selectedDates.map((date) => Number(date.split("-")[2]));
    await actor.attemptsTo(selectCalendarDays(year, monthIndex, days));

    await actor.attemptsTo(clearMonthSelection());
    await expect(await actor.asks(selectedDaysCount())).toHaveCount(0);
    await expect(await actor.asks(calendarSummaryText())).toHaveText("");
  });

  scheduleTest("Save date changes", async ({ actor }) => {
    const { year, monthIndex } = pickMonthContext();
    const monthKeyValue = monthKey(year, monthIndex);

    await actor.attemptsTo(
      openGroupCard(scheduleGroup.name),
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

    await actor.attemptsTo(saveDateChanges());

    await actor.verifies(calendarHiddenAfterSave());

    const expectedCount = selectedDates.length;
    const expectedTotal = formatCurrency(
      expectedCount * scheduleGroup.price,
      scheduleGroup.currency,
    );

    await expect(
      await actor.asks(monthRowLessonCount(monthKeyValue)),
    ).toHaveText(`(${expectedCount} lessons)`);
    await expect(
      await actor.asks(monthRowTotalText(monthKeyValue)),
    ).toContainText(expectedTotal);
  });

  scheduleTest("Cancel date changes", async ({ actor }) => {
    const { year, monthIndex } = pickMonthContext();
    const monthKeyValue = monthKey(year, monthIndex);

    await actor.attemptsTo(
      openGroupCard(scheduleGroup.name),
      openScheduleEditor(),
      setCalendarMonthYear(year, monthIndex),
    );

    const selectedDates = randomDatesInMonth({
      year,
      monthIndex,
      count: faker.number.int({ min: 2, max: 4 }),
    });

    const days = selectedDates.map((date) => Number(date.split("-")[2]));
    await actor.attemptsTo(selectCalendarDays(year, monthIndex, days));

    await actor.attemptsTo(cancelDateChanges());

    await expect(
      await actor.asks(monthRowLessonCount(monthKeyValue)),
    ).toHaveText("(0 lessons)");
  });
});

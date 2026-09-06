import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { countWeekdayInMonth } from "../ui/support/formatters";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";

/**
 * ISTQB technique: equivalence partitioning on the weekday header.
 *
 * Clicking a weekday header is a bulk toggle, and its behaviour depends on what
 * is already selected. The partitions are: none of that weekday selected, all
 * of them selected, and some of them. The third is the one that surprises —
 * "some" behaves like "none", not like a toggle.
 *
 * June 2026 is the pinned month and has five Mondays, which the assertions
 * derive rather than hard-code.
 */

const GROUP = "Weekday Fixture";
const YEAR = 2026;
const MONTH_INDEX = 5; // June
const MONDAY = 0; // The week starts on Monday in this app.

const fixture = () =>
  plannerState({
    groups: [buildGroup({ name: GROUP, price: 50, currency: "UAH" })],
  });

const noneSelected = configureTest({ plannerState: fixture() });

noneSelected.describe("Weekday header — equivalence partitioning", () => {
  noneSelected(
    "With none selected, the header selects every one",
    async ({ actor }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      await calendarEditor.weekdayHeader(MONDAY).click();

      await expect(calendarEditor.selectedDays()).toHaveCount(
        countWeekdayInMonth(YEAR, MONTH_INDEX, MONDAY),
      );
    },
  );
});

const allSelected = configureTest({ plannerState: fixture() });

allSelected.describe("Weekday header — equivalence partitioning", () => {
  allSelected(
    "With all selected, the header clears them",
    async ({ actor }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      await calendarEditor.weekdayHeader(MONDAY).click();
      await calendarEditor.weekdayHeader(MONDAY).click();

      await expect(calendarEditor.selectedDays()).toHaveCount(0);
    },
  );
});

const someSelected = configureTest({ plannerState: fixture() });

someSelected.describe("Weekday header — equivalence partitioning", () => {
  someSelected(
    "With some selected, the header fills the rest rather than toggling",
    async ({ actor }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      const all = countWeekdayInMonth(YEAR, MONTH_INDEX, MONDAY);

      // Given a partial selection of Mondays
      await calendarEditor.weekdayHeader(MONDAY).click();
      await calendarEditor.selectedDays().first().click();
      await expect(calendarEditor.selectedDays()).toHaveCount(all - 1);

      // When the header is clicked again
      await calendarEditor.weekdayHeader(MONDAY).click();

      // Then it completes the set instead of clearing it. Only "all selected"
      // clears, which is the branch worth knowing about: a user who deselects
      // one day and clicks the header expecting a toggle gets the opposite.
      await expect(calendarEditor.selectedDays()).toHaveCount(all);
    },
  );
});

const gridStructure = configureTest({ plannerState: fixture() });

gridStructure.describe("Weekday header — equivalence partitioning", () => {
  gridStructure("The calendar grid keeps its structure", async ({ actor }) => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

    // The seven headers in Monday-first order, then the day cells. Pinned as a
    // structure check only: the days themselves are asserted by count and by
    // date attribute elsewhere, so this does not enumerate thirty numbers that
    // would have to be rewritten every time the pinned month changes.
    await expectAriaSnapshot(
      calendarEditor.calendarDow,
      `
- text: Mon Tue Wed Thu Fri Sat Sun
`,
    );
    await expect(calendarEditor.calendar.locator("[data-date]")).toHaveCount(
      30,
    );
  });
});

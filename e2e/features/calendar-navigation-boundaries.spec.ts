import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { storedGroups } from "../ui/support/planner-storage";

/**
 * ISTQB technique: boundary value analysis on month and year navigation.
 *
 * The boundaries are the ends of the year, where stepping a month has to carry
 * into the next or previous one, and the year input itself, which accepts
 * anything the `number` type allows because it has no `min`, `max` or `step`.
 */

const GROUP = "Nav Fixture";

const fixture = () =>
  plannerState({
    groups: [buildGroup({ name: GROUP, price: 50, currency: "UAH" })],
  });

const forwardRollover = configureTest({ plannerState: fixture() });

forwardRollover.describe(
  "Calendar navigation — boundary value analysis @ported",
  () => {
    forwardRollover(
      "December steps forward into January of the next year",
      async ({ actor }) => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        await calendarEditor.monthSelect.selectOption("11");
        await calendarEditor.nextMonthButton.click();

        await expect(calendarEditor.monthSelect).toHaveValue("0");
        await expect(calendarEditor.yearInput).toHaveValue("2027");
      },
    );
  },
);

const backwardRollover = configureTest({ plannerState: fixture() });

backwardRollover.describe(
  "Calendar navigation — boundary value analysis @ported",
  () => {
    backwardRollover(
      "January steps back into December of the previous year",
      async ({ actor }) => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        await calendarEditor.monthSelect.selectOption("0");
        await calendarEditor.prevMonthButton.click();

        await expect(calendarEditor.monthSelect).toHaveValue("11");
        await expect(calendarEditor.yearInput).toHaveValue("2025");
      },
    );
  },
);

const todayReturns = configureTest({ plannerState: fixture() });

todayReturns.describe(
  "Calendar navigation — boundary value analysis @ported",
  () => {
    todayReturns(
      "Today returns to the pinned month from anywhere",
      async ({ actor }) => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        await calendarEditor.setMonthYear(2031, 0);
        await expect(calendarEditor.yearInput).toHaveValue("2031");

        await calendarEditor.todayButton.click();

        // June 2026 is the fixed instant the suite runs at — see support/clock.ts.
        await expect(calendarEditor.monthSelect).toHaveValue("5");
        await expect(calendarEditor.yearInput).toHaveValue("2026");
      },
    );
  },
);

const malformedYear = configureTest({ plannerState: fixture() });

malformedYear.describe(
  "Calendar navigation — boundary value analysis @ported",
  () => {
    malformedYear(
      "A one-digit year cannot produce a corrupt month key",
      async ({ actor, page, storagePrefix }) => {
        malformedYear.fixme(
          true,
          "DEF-002: the year input accepts anything and writes a malformed month key",
        );
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        // When a single digit is typed into the year
        await calendarEditor.yearInput.fill("5");
        await calendarEditor.yearInput.press("Tab");

        // Then either the input refuses it or the saved key is still a real
        // month. Today neither holds: the year is accepted as `5`, the day cells
        // carry dates like `5-12-01`, and saving writes that whole date in as the
        // month key. The app's own CSV export then re-imports as
        // `Invalid month format`, so a backup taken afterwards cannot be
        // restored. Fixed in plan batch 3.2.
        await calendarEditor.calendar.locator("[data-date]").first().click();
        await calendarEditor.saveButton.click();

        const keys = Object.keys(
          (await storedGroups(page, storagePrefix))[0]?.monthlyOverrides ?? {},
        );
        for (const key of keys) {
          expect(key).toMatch(/^\d{4}-\d{2}$/);
        }
      },
    );
  },
);

import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { storedGroups } from "../ui/support/planner-storage";

/**
 * ISTQB technique: state transition testing on the calendar editor.
 *
 * States: the group overview, and the editor open with a pending selection.
 * Transitions out of the editor are Done, Cancel and Escape, and they are not
 * interchangeable — Done keeps, Cancel discards and returns to the overview,
 * Escape discards and closes the whole dialog without asking (DEF-012).
 *
 * The clock is pinned, so the editor always opens on June 2026 and these tests
 * do not drift.
 */

const GROUP = "Calendar Fixture";

const fixture = () =>
  plannerState({
    groups: [buildGroup({ name: GROUP, price: 50, currency: "UAH" })],
  });

/** The month keys the group has overrides for, straight out of storage. */
const overrideKeys = async (
  page: import("@playwright/test").Page,
  storagePrefix: string,
) =>
  Object.keys(
    (await storedGroups(page, storagePrefix))[0]?.monthlyOverrides ?? {},
  );

const openEditor = configureTest({ plannerState: fixture() });

openEditor.describe(
  "Calendar editing — state transition testing @ported",
  () => {
    openEditor(
      "Opening the editor hides the monthly list and shows the pinned month",
      async ({ actor }) => {
        const { calendarEditor, groupModal } = actor.abilityTo(BrowseTheWeb);

        // Given the group overview
        await actor.attemptsTo(openGroupCard(GROUP));
        await expect(groupModal.monthlySection).toBeVisible();

        // When the schedule editor opens
        await actor.attemptsTo(openScheduleEditor());

        // Then the two swap, and the calendar starts on the pinned month.
        await expect(calendarEditor.container).toBeVisible();
        await expect(groupModal.monthlySection).toBeHidden();
        await expect(calendarEditor.monthSelect).toHaveValue("5");
        await expect(calendarEditor.yearInput).toHaveValue("2026");
      },
    );
  },
);

const doneExit = configureTest({ plannerState: fixture() });

doneExit.describe("Calendar editing — state transition testing @ported", () => {
  doneExit(
    "Done keeps the selection and returns to the list",
    async ({ actor, page, storagePrefix }) => {
      const { calendarEditor, groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      // When two days are picked and Done is pressed
      await calendarEditor.dayCell(2026, 5, 8).click();
      await calendarEditor.dayCell(2026, 5, 15).click();
      await calendarEditor.saveButton.click();

      // Then the month is stored and the overview is back.
      expect(await overrideKeys(page, storagePrefix)).toEqual(["2026-06"]);
      await expect(groupModal.monthlySection).toBeVisible();
      await expect(calendarEditor.container).toBeHidden();
    },
  );
});

const cancelExit = configureTest({ plannerState: fixture() });

cancelExit.describe(
  "Calendar editing — state transition testing @ported",
  () => {
    cancelExit(
      "Cancel discards the selection and returns to the list",
      async ({ actor, page, storagePrefix }) => {
        const { calendarEditor, groupModal } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        await calendarEditor.dayCell(2026, 5, 8).click();
        await calendarEditor.cancelButton.click();

        // Nothing stored, and unlike Escape the dialog stays open.
        expect(await overrideKeys(page, storagePrefix)).toEqual([]);
        await expect(groupModal.monthlySection).toBeVisible();
        await expect(groupModal.modal).toBeVisible();
      },
    );
  },
);

const escapeExitDuringEdit = configureTest({ plannerState: fixture() });

escapeExitDuringEdit.describe(
  "Calendar editing — state transition testing @ported",
  () => {
    escapeExitDuringEdit(
      "Escape asks before throwing away a pending selection",
      async ({ actor, page }) => {
        escapeExitDuringEdit.fixme(
          true,
          "DEF-012: Escape during calendar editing discards changes without asking",
        );
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        // Given a day picked but not saved
        await calendarEditor.dayCell(2026, 5, 8).click();
        await expect(calendarEditor.selectedDays()).toHaveCount(1);

        // When Escape is pressed
        let asked = false;
        page.on("dialog", (dialog) => {
          asked = true;
          void dialog.dismiss();
        });
        await page.keyboard.press("Escape");

        // Then the user is asked first, and dismissing keeps the work.
        // Today no dialog appears at all: the whole group dialog closes and the
        // selection is gone, with nothing said. Fixed in plan batch 3.4a.
        expect(asked).toBe(true);
        await expect(calendarEditor.selectedDays()).toHaveCount(1);
      },
    );
  },
);

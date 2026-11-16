import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import {
  chooseSaveCsv,
  clickOutsideTheMenu,
  openBackupMenu,
  pressEscape,
  tabToBackupMenuButton,
} from "../ui/screenplay/tasks/backup-menu-tasks";

/**
 * The Backup menu — plan batch 6.4.
 *
 * Save CSV, Load CSV, Save Backup and Load Backup sit under one disclosure
 * button. Their ids and labels did not change, because the teacher's written
 * steps quote the labels.
 *
 * Two coverage groups, one per test condition on the batch page:
 * C1 (state transition, all transitions) and C2 (checklist, accessibility).
 * C3, the regression run, is every existing spec that saves or loads a file:
 * they reach the buttons through `PlannerPage`, which opens the menu first.
 */

const main = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Monday Beginners" })],
  }),
});

const LABELS = ["Load CSV", "Save CSV", "Save Backup", "Load Backup"];

main.describe(
  "Backup menu states — state transition testing, all transitions",
  () => {
    main(
      "The menu starts closed and hides the four actions",
      async ({ actor }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        // Given the planner just loaded
        // Then the button says it is collapsed and no action is shown
        await expect(planner.backupMenuButton).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        await expect(planner.backupMenu).toBeHidden();
        await expect(planner.saveBackupButton).toBeHidden();
      },
    );

    main(
      "Closed to open by a click shows the four actions with their labels",
      async ({ actor }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        // When the teacher opens Backup
        await actor.attemptsTo(openBackupMenu());

        // Then the button is expanded and controls the panel
        await expect(planner.backupMenuButton).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await expect(planner.backupMenuButton).toHaveAttribute(
          "aria-controls",
          "backupMenu",
        );
        // And the four buttons keep their ids and labels
        for (const [id, label] of [
          ["#loadCsvBtn", "Load CSV"],
          ["#saveCsvBtn", "Save CSV"],
          ["#saveBackupBtn", "Save Backup"],
          ["#loadBackupBtn", "Load Backup"],
        ] as const) {
          await expect(planner.backupMenu.locator(id)).toHaveText(label);
        }
        await expect(planner.backupMenu.getByRole("button")).toHaveText(LABELS);
      },
    );

    main("Open to closed by a second click", async ({ actor }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // Given the menu is open
      await actor.attemptsTo(openBackupMenu());

      // When the teacher clicks Backup again
      await actor.attemptsTo(openBackupMenu());

      // Then it is closed
      await expect(planner.backupMenuButton).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(planner.backupMenu).toBeHidden();
    });

    main(
      "Open to closed by Esc, and focus returns to Backup",
      async ({ actor }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        // Given the menu is open
        await actor.attemptsTo(openBackupMenu());

        // When the teacher presses Esc
        await actor.attemptsTo(pressEscape());

        // Then it is closed and Backup holds focus
        await expect(planner.backupMenu).toBeHidden();
        await expect(planner.backupMenuButton).toBeFocused();
      },
    );

    main(
      "Open to closed by a click outside, and focus returns to Backup",
      async ({ actor }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        // Given the menu is open
        await actor.attemptsTo(openBackupMenu());

        // When the teacher clicks outside it, on something that is not a control
        await actor.attemptsTo(clickOutsideTheMenu());

        // Then it is closed and Backup holds focus
        await expect(planner.backupMenu).toBeHidden();
        await expect(planner.backupMenuButton).toBeFocused();
      },
    );

    main(
      "Open to closed by choosing an action, and the action still runs",
      async ({ actor, page }) => {
        const { planner } = actor.abilityTo(BrowseTheWeb);

        // Given the menu is open
        await actor.attemptsTo(openBackupMenu());

        // When the teacher chooses Save CSV
        const download = page.waitForEvent("download");
        await actor.attemptsTo(chooseSaveCsv());

        // Then the file is saved, the menu is closed and Backup holds focus
        expect((await download).suggestedFilename()).toMatch(/\.csv$/);
        await expect(planner.backupMenu).toBeHidden();
        await expect(planner.backupMenuButton).toBeFocused();
      },
    );
  },
);

main.describe("Backup menu accessibility — checklist", () => {
  main(
    "A keyboard user opens the menu with Enter and reaches every action",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // Given focus arrives on Backup by Tab
      await actor.attemptsTo(tabToBackupMenuButton());

      // When they press Enter
      await page.keyboard.press("Enter");

      // Then the menu is open, and Tab reaches the four actions in order
      await expect(planner.backupMenuButton).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      for (const label of LABELS) {
        await page.keyboard.press("Tab");
        await expect(
          planner.backupMenu.getByRole("button", { name: label }),
        ).toBeFocused();
      }
    },
  );

  main(
    "Esc from inside the menu closes it and returns focus to Backup",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // Given the menu is open and focus is on its first action
      await actor.attemptsTo(tabToBackupMenuButton());
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");

      // When they press Esc
      await actor.attemptsTo(pressEscape());

      // Then the menu is closed and Backup holds focus
      await expect(planner.backupMenu).toBeHidden();
      await expect(planner.backupMenuButton).toBeFocused();
    },
  );

  main(
    "Tabbing out of the last action closes the menu without taking focus back",
    async ({ actor, page }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);

      // Given the menu is open and focus is on the last action
      await actor.attemptsTo(tabToBackupMenuButton());
      await page.keyboard.press("Enter");
      for (let stop = 0; stop < LABELS.length; stop += 1) {
        await page.keyboard.press("Tab");
      }

      // When they press Tab once more
      await page.keyboard.press("Tab");

      // Then the menu is closed, and focus moved on to Clear All Data
      await expect(planner.backupMenu).toBeHidden();
      await expect(planner.clearDataButton).toBeFocused();
    },
  );
});

import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";

export const openBackupMenu = (): Task => async (actor) => {
  await step("Open the Backup menu", async () => {
    await actor.abilityTo(BrowseTheWeb).planner.backupMenuButton.click();
  });
};

export const pressEscape = (): Task => async (actor) => {
  await step("Press Esc", async () => {
    const { page } = actor.abilityTo(BrowseTheWeb);
    await page.keyboard.press("Escape");
  });
};

/** A click on the page title: not a control, so it takes no focus itself. */
export const clickOutsideTheMenu = (): Task => async (actor) => {
  await step("Click outside the menu", async () => {
    const { page } = actor.abilityTo(BrowseTheWeb);
    await page.getByRole("heading", { level: 1 }).click();
  });
};

export const chooseSaveCsv = (): Task => async (actor) => {
  await step("Choose Save CSV", async () => {
    await actor.abilityTo(BrowseTheWeb).planner.saveCsvButton.click();
  });
};

/** Presses Tab to the Backup button, as a keyboard user arrives at it. */
export const tabToBackupMenuButton =
  (limit = 6): Task =>
  async (actor) => {
    await step("Tab to the Backup button", async () => {
      const { page, planner } = actor.abilityTo(BrowseTheWeb);
      for (let stop = 0; stop < limit; stop += 1) {
        await page.keyboard.press("Tab");
        if (
          await planner.backupMenuButton.evaluate(
            (el) => el === document.activeElement,
          )
        ) {
          return;
        }
      }
      throw new Error(`Tab never reached Backup within ${String(limit)} stops`);
    });
  };

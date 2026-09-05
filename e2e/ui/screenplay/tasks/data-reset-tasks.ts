import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";

export const clearAllData = (): Task => async (actor) => {
  await step("Clear all data", async () => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await planner.clearAllData();
  });
};

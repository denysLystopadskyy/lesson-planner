import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";

export const exportCsv = (): Task => async (actor) => {
  await step("Export CSV", async () => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await planner.saveCsv();
  });
};

export const importCsv =
  (filePath: string): Task =>
  async (actor) => {
    const fileName = filePath.split("/").pop() ?? filePath;
    await step(`Import CSV from ${fileName}`, async () => {
      const { planner } = actor.abilityTo(BrowseTheWeb);
      await planner.loadCsv(filePath);
    });
  };

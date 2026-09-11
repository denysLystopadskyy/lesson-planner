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

export const exportBackup = (): Task => async (actor) => {
  await step("Export backup", async () => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await planner.saveBackup();
  });
};

export const importBackup =
  (filePath: string): Task =>
  async (actor) => {
    const fileName = filePath.split("/").pop() ?? filePath;
    await step(`Import backup from ${fileName}`, async () => {
      const { planner } = actor.abilityTo(BrowseTheWeb);
      await planner.loadBackup(filePath);
    });
  };

export const undoImport = (): Task => async (actor) => {
  await step("Undo the import", async () => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await planner.undoImport();
  });
};

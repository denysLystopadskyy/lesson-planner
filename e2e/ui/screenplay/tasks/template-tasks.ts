import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";

export const openTemplateEditor = (): Task => async (actor) => {
  await step("Open template editor", async () => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await planner.openTemplateModal();
  });
};

export const saveTemplate =
  (text: string): Task =>
  async (actor) => {
    await step("Save template changes", async () => {
      const { templateModal } = actor.abilityTo(BrowseTheWeb);
      await templateModal.setTemplate(text);
      await templateModal.save();
    });
  };

export const cancelTemplate =
  (text: string): Task =>
  async (actor) => {
    await step("Cancel template changes", async () => {
      const { templateModal } = actor.abilityTo(BrowseTheWeb);
      await templateModal.setTemplate(text);
      await templateModal.cancel();
    });
  };

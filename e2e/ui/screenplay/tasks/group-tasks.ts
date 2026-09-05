import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";

export const openAddGroupModal = (): Task => async (actor) => {
  await step("Open add group modal", async () => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await planner.openAddGroupModal();
  });
};

export const openGroupCard =
  (name: string): Task =>
  async (actor) => {
    await step(`Open group card: \"${name}\"`, async () => {
      const { planner } = actor.abilityTo(BrowseTheWeb);
      await planner.openGroupCard(name);
    });
  };

export const addGroup =
  ({
    name,
    price,
    currency,
  }: {
    name: string;
    price: number;
    currency: string;
  }): Task =>
  async (actor) => {
    await step(
      `Add group: \"${name}\" (${String(price)} ${currency})`,
      async () => {
        const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
        await planner.openAddGroupModal();
        await groupModal.fillGroupInfo({ name, price, currency });
        await groupModal.saveGroup();
      },
    );
  };

export const editGroupInfo =
  ({
    name,
    price,
    currency,
  }: {
    name: string;
    price: number;
    currency: string;
  }): Task =>
  async (actor) => {
    await step(
      `Edit group info: \"${name}\" (${String(price)} ${currency})`,
      async () => {
        const { groupModal } = actor.abilityTo(BrowseTheWeb);
        await groupModal.enterEditMode();
        await groupModal.fillGroupInfo({ name, price, currency });
        await groupModal.saveGroup();
      },
    );
  };

export const deleteGroup = (): Task => async (actor) => {
  await step("Delete group", async () => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    await groupModal.deleteGroup();
  });
};

export const closeModalWithEscape = (): Task => async (actor) => {
  await step("Close modal (Escape)", async () => {
    const { page } = actor.abilityTo(BrowseTheWeb);
    await page.keyboard.press("Escape");
  });
};

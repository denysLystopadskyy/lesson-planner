import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";
import { monthName } from "../../support/formatters";

export const openPaymentMessageForMonth =
  (monthKey: string): Task =>
  async (actor) => {
    // A month key is always "YYYY-MM", but an index access can miss as far as
    // the type system knows, so fall back rather than assert.
    const year = monthKey.split("-")[0] ?? monthKey;
    await step(
      `Open payment message for ${monthName(monthKey)} ${year}`,
      async () => {
        const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
        await monthlyOverrides.copyPaymentMessage(monthKey);
      },
    );
  };

export const copyAndClosePaymentMessage = (): Task => async (actor) => {
  await step("Copy and close payment message", async () => {
    const { reviewModal } = actor.abilityTo(BrowseTheWeb);
    await reviewModal.copyAndClose();
  });
};

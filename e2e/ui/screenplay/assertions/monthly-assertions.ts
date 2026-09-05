import { expect } from "@playwright/test";
import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Assertion } from "../actor";

export const copyPaymentMessageDisabled =
  (monthKey: string): Assertion =>
  async (actor) => {
    const web = actor.abilityTo(BrowseTheWeb);
    await expect(
      web.monthlyOverrides.copyButton(monthKey),
      "copy payment message should be disabled",
    ).toBeDisabled();
  };

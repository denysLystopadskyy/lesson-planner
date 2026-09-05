import { expect } from "@playwright/test";
import { formatCurrency } from "../../support/formatters";
import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Assertion } from "../actor";

export const groupCardVisible =
  (name: string): Assertion =>
  async (actor) => {
    const web = actor.abilityTo(BrowseTheWeb);
    await expect(
      web.planner.groupCard(name),
      "updated group card should be visible",
    ).toBeVisible();
  };

export const groupInfoUpdated =
  ({
    name,
    price,
    currency,
  }: {
    name: string;
    price: number;
    currency: string;
  }): Assertion =>
  async (actor) => {
    const web = actor.abilityTo(BrowseTheWeb);
    await expect(
      web.groupModal.nameDisplay,
      "updated group name should be visible",
    ).toHaveText(name);
    await expect(
      web.groupModal.currencyDisplay,
      "updated group currency should be visible",
    ).toHaveText(currency);
    await expect(
      web.groupModal.priceDisplay,
      "updated group price should be visible",
    ).toHaveText(formatCurrency(price, currency));
  };

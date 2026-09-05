import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Question } from "../actor";
import type { Locator } from "@playwright/test";

export const reviewMessageText = (): Question<Locator> => async (actor) => {
  const { reviewModal } = actor.abilityTo(BrowseTheWeb);
  return reviewModal.textarea;
};

import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Question } from "../actor";
import type { Locator } from "@playwright/test";

export const templateText = (): Question<Locator> => async (actor) => {
  const { templateModal } = actor.abilityTo(BrowseTheWeb);
  return templateModal.textarea;
};

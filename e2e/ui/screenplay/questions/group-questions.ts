import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Question } from "../actor";
import type { Locator } from "@playwright/test";

export const groupCardLessonCount =
  (name: string): Question<Locator> =>
  async (actor) => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    return planner.groupCardLessonCount(name);
  };

export const groupInfoValues =
  (): Question<{ name: Locator; price: Locator; currency: Locator }> =>
  async (actor) => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    return {
      name: groupModal.nameDisplay,
      price: groupModal.priceDisplay,
      currency: groupModal.currencyDisplay,
    };
  };

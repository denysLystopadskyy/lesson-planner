import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Question } from "../actor";
import type { Locator } from "@playwright/test";

export const monthRowLessonCount =
  (key: string): Question<Locator> =>
  async (actor) => {
    const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
    return monthlyOverrides.lessonCount(key);
  };

export const monthRowTotalText =
  (key: string): Question<Locator> =>
  async (actor) => {
    const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
    return monthlyOverrides.totalText(key);
  };

export const monthRowPerLessonText =
  (key: string): Question<Locator> =>
  async (actor) => {
    const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
    return monthlyOverrides.perLessonText(key);
  };

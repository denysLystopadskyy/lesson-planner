import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Question } from "../actor";
import type { Locator } from "@playwright/test";

export const calendarSummaryText = (): Question<Locator> => (actor) => {
  const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
  return calendarEditor.summary;
};

export const selectedDaysCount = (): Question<Locator> => (actor) => {
  const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
  return calendarEditor.selectedDays();
};

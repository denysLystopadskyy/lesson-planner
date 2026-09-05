import { expect } from "@playwright/test";
import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Assertion } from "../actor";

export const calendarHiddenAfterSave = (): Assertion => async (actor) => {
  const web = actor.abilityTo(BrowseTheWeb);
  await expect(
    web.calendarEditor.container,
    "calendar editor should be hidden after save",
  ).toBeHidden();
};

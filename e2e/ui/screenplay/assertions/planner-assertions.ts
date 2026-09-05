import { expect } from "@playwright/test";
import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Assertion } from "../actor";

export const emptyStateVisible =
  (message: string): Assertion =>
  async (actor) => {
    const web = actor.abilityTo(BrowseTheWeb);
    await expect(web.planner.emptyState, message).toBeVisible();
  };

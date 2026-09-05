import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export const expectAriaSnapshot = async (
  locator: Locator,
  snapshot: string,
) => {
  await expect(locator).toMatchAriaSnapshot(snapshot);
};

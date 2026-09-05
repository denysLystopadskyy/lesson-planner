import type { Page } from "@playwright/test";
import type { Group } from "./test-data";

/** The three keys the app persists under. Mirrored in storage-state.ts. */
const DATA_KEY = "groupLessonPlannerData";

/** The groups as the app has actually written them, not as the UI renders them. */
export const storedGroups = async (page: Page): Promise<Group[]> => {
  const raw = await page.evaluate((key) => localStorage.getItem(key), DATA_KEY);
  return raw === null ? [] : (JSON.parse(raw) as Group[]);
};

/** Group names in stored order — enough for most assertions about naming. */
export const storedGroupNames = async (page: Page): Promise<string[]> =>
  (await storedGroups(page)).map((group) => group.name);

/** A single group's stored price, located by name. */
export const storedPriceOf = async (
  page: Page,
  name: string,
): Promise<number | undefined> =>
  (await storedGroups(page)).find((group) => group.name === name)?.price;

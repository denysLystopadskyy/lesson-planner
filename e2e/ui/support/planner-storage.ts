import type { Page } from "@playwright/test";
import type { Group } from "./test-data";

/**
 * Reading the planner's data back out of the browser.
 *
 * Every function takes an optional key prefix. It is empty against the legacy
 * page and `next:` against the port — pass
 * `PORTED_STORAGE_PREFIX` from `environment.ts` in a `@ported` spec. Without
 * it these read the production keys and quietly find nothing, which is exactly
 * how two ported specs failed with `undefined` before this argument existed.
 */
const DATA_KEY = "groupLessonPlannerData";

/** The groups as the app has actually written them, not as the UI renders them. */
export const storedGroups = async (
  page: Page,
  prefix = "",
): Promise<Group[]> => {
  const raw = await page.evaluate(
    (key) => localStorage.getItem(key),
    `${prefix}${DATA_KEY}`,
  );
  return raw === null ? [] : (JSON.parse(raw) as Group[]);
};

/** Group names in stored order — enough for most assertions about naming. */
export const storedGroupNames = async (
  page: Page,
  prefix = "",
): Promise<string[]> =>
  (await storedGroups(page, prefix)).map((group) => group.name);

/** A single group's stored price, located by name. */
export const storedPriceOf = async (
  page: Page,
  name: string,
  prefix = "",
): Promise<number | undefined> =>
  (await storedGroups(page, prefix)).find((group) => group.name === name)
    ?.price;

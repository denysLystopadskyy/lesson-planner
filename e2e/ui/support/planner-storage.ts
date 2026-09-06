import type { Page } from "@playwright/test";
import type { Group } from "./test-data";

/**
 * Reading the planner's data back out of the browser.
 *
 * Every function takes an optional key prefix, which specs pass from the
 * `storagePrefix` fixture. It is empty now that the staging build at `/next/`
 * is gone, and the argument stays because a second target would need it again —
 * and because reading the wrong key is silent: a spec that finds nothing can
 * still agree with an assertion that expects nothing.
 */
const DATA_KEY = "groupLessonPlannerData";
const TEMPLATE_KEY = "paymentTemplate";

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

/** The raw payment template, or null when the key is absent. */
export const storedTemplate = async (
  page: Page,
  prefix = "",
): Promise<string | null> =>
  page.evaluate((key) => localStorage.getItem(key), `${prefix}${TEMPLATE_KEY}`);

/** A single group's stored price, located by name. */
export const storedPriceOf = async (
  page: Page,
  name: string,
  prefix = "",
): Promise<number | undefined> =>
  (await storedGroups(page, prefix)).find((group) => group.name === name)
    ?.price;

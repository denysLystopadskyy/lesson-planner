import { STORAGE_KEYS } from "./storage-keys";
import { DEFAULT_CURRENCY, type Group, type Settings } from "./types";

/**
 * Reading and writing the three keys.
 *
 * Two rules shape this module, both from
 * .claude/context/storage-data-contract.md:
 *
 * 1. The key names and value shapes are fixed. `paymentTemplate` in particular
 *    is a **raw string**, not JSON — batch 1.13's contract spec asserts it does
 *    not start with a quote.
 * 2. Reading must not throw. The legacy app calls `JSON.parse` unguarded, so a
 *    single corrupt key leaves the page inert with no message (DEF-001). Here a
 *    bad value is reported, not thrown, and the caller decides what to show.
 */

export type LoadResult<T> =
  { ok: true; value: T } | { ok: false; raw: string; error: string };

const parse = <T>(raw: string | null, fallback: T): LoadResult<T> => {
  if (raw === null) return { ok: true, value: fallback };
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return {
      ok: false,
      raw,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const loadGroups = (): LoadResult<Group[]> =>
  parse<Group[]>(localStorage.getItem(STORAGE_KEYS.data), []);

export const loadSettings = (): LoadResult<Settings> =>
  parse<Settings>(localStorage.getItem(STORAGE_KEYS.settings), {
    defaultCurrency: DEFAULT_CURRENCY,
  });

/** The template is stored raw. `null` means the app should use its default. */
export const loadTemplate = (): string | null =>
  localStorage.getItem(STORAGE_KEYS.template);

export const saveGroups = (groups: Group[]): void => {
  localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(groups));
};

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
};

export const saveTemplate = (template: string): void => {
  localStorage.setItem(STORAGE_KEYS.template, template);
};

/**
 * "Clear all data", exactly as far as the legacy app clears it.
 *
 * **DEF-013 is reproduced here on purpose.** Two of the three keys go; the
 * template survives a wipe the user was told could not be undone. Batch 3.4b
 * removes the third key and unpins the spec in the same PR.
 */
export const clearStoredData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.data);
  localStorage.removeItem(STORAGE_KEYS.settings);
};

/**
 * The effective currency for a group.
 *
 * A group written by an older version has no `currency`, and the legacy app
 * throws `Currency code is required with currency style.` when it formats one
 * (DEF-003). Falling back here is what stops the port inheriting that.
 */
export const currencyOf = (group: Group, settings: Settings): string =>
  group.currency ?? settings.defaultCurrency;

/** Total planned lessons, counted the way the legacy card counts them. */
export const lessonCountOf = (group: Group): number => group.dates.length;

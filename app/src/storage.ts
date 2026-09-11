import { STORAGE_KEYS } from "./storage-keys";
import {
  DEFAULT_CURRENCY,
  type Group,
  type MonthKey,
  type MonthOverride,
  type Settings,
} from "./types";

/**
 * Reading and writing the three keys.
 *
 * Three rules shape this module, the first two from
 * .claude/context/storage-data-contract.md:
 *
 * 1. The key names and value shapes are fixed. `paymentTemplate` in particular
 *    is a **raw string**, not JSON — batch 1.13's contract spec asserts it does
 *    not start with a quote.
 * 2. Reading must not throw. The legacy app calls `JSON.parse` unguarded, so a
 *    single corrupt key leaves the page inert with no message (DEF-001). Here a
 *    bad value is reported, not thrown, and the caller decides what to show.
 * 3. **Writing must not throw either, and neither must fail silently.** Batch
 *    3.1 added this one. See below.
 *
 * ## What batch 3.1 changed
 *
 * Rule 2 used to stop at `JSON.parse`. Text that parsed was cast to the shape
 * the caller asked for and handed on, so a value that was valid JSON and the
 * wrong shape reached the render and threw there instead — DEF-021, where an
 * override with no `dates` array takes down the group dialog. Parsing and
 * validating are different questions, and only the first was being asked.
 *
 * Writes had no rule at all. `setItem` was called bare, so a full quota or a
 * private window that refuses storage threw out of a React event handler and
 * the user was told nothing while the edit was not saved — DEF-022. There is no
 * server to fall back on, so silence is the whole harm.
 *
 * ## Why loading repairs rather than rejects
 *
 * A shape check can refuse the payload or mend it. This one mends it, and the
 * rule it follows is **never drop what the user can still use**: a missing list
 * becomes an empty list, a bad field is discarded on its own, and a whole group
 * goes only when it has no name to show it under. A group is irreplaceable and
 * a price is retypeable, so a group with a zero price beats no group at all.
 *
 * Every mend is reported in `repairs`, because quietly changing stored data is
 * the same sin as quietly failing to store it. Only a value with no group in it
 * — text that is not a list — is refused outright.
 */

export type LoadResult<T> =
  | {
      ok: true;
      value: T;
      /**
       * What had to be mended to make the stored value usable. Absent on a
       * clean load, so a caller can treat it as "nothing to say".
       */
      repairs?: string[];
    }
  | { ok: false; raw: string; error: string };

/** What a write did. A refused write is a value, never an exception. */
export type WriteResult = { ok: true } | { ok: false; error: string };

/**
 * Where an unreadable value is kept. The user's first question on seeing the
 * error banner is whether the data is gone, and the honest answer needs the
 * bytes to still exist.
 */
export const CORRUPT_BACKUP_SUFFIX = ".corrupt.backup";

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A validated value, and the list of mends it took to get there. */
type Validated<T> = { value: T; repairs: string[] };

/**
 * Keeps the unreadable text under a second key before anything else touches it.
 *
 * Two deliberate choices. An existing backup is never replaced — the first
 * failure holds what the user actually lost, and a later boot must not write
 * over it. And a refusal to write the backup is swallowed: storage that refuses
 * writes is exactly the storage most likely to be holding a truncated value,
 * and turning a reported error into a thrown one during boot would undo the
 * point of rule 2.
 */
const backUpCorruptValue = (key: string, raw: string): void => {
  try {
    const backupKey = `${key}${CORRUPT_BACKUP_SUFFIX}`;
    if (localStorage.getItem(backupKey) !== null) return;
    localStorage.setItem(backupKey, raw);
  } catch {
    // Deliberately ignored — see above.
  }
};

/**
 * Read a key, parse it, and check its shape.
 *
 * `validate` returns `null` for a value with nothing usable in it. That is the
 * only way past this function without a value, and it is treated exactly like
 * unparseable text: reported, backed up, and left alone.
 */
const readKey = <T>(
  key: string,
  fallback: T,
  validate: (parsed: unknown) => Validated<T> | null,
  refusal: string,
): LoadResult<T> => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    // A browser that refuses to read is not a corrupt value; there is nothing
    // to back up and nothing to show the user but the reason.
    return { ok: false, raw: "", error: messageOf(error) };
  }
  if (raw === null) return { ok: true, value: fallback };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    backUpCorruptValue(key, raw);
    return { ok: false, raw, error: messageOf(error) };
  }

  const validated = validate(parsed);
  if (validated === null) {
    backUpCorruptValue(key, raw);
    return { ok: false, raw, error: refusal };
  }
  return validated.repairs.length === 0
    ? { ok: true, value: validated.value }
    : { ok: true, value: validated.value, repairs: validated.repairs };
};

/** Mends one group's month rows. A month is never dropped, only emptied. */
const validateOverrides = (
  name: string,
  stored: Record<string, unknown>,
  repairs: string[],
): Record<MonthKey, MonthOverride> => {
  const overrides: Record<MonthKey, MonthOverride> = {};
  for (const [monthKey, value] of Object.entries(stored)) {
    if (!isRecord(value)) {
      repairs.push(`“${name}”, ${monthKey}: the stored month was not a month.`);
      continue;
    }
    const price = value["price"];
    const dates = value["dates"];
    if (!isNumber(price)) {
      repairs.push(
        `“${name}”, ${monthKey}: the stored price was not a number, so it now reads 0.`,
      );
    }
    if (!Array.isArray(dates)) {
      // The shape behind DEF-021: `monthsToRender` reads `.length` of this.
      repairs.push(
        `“${name}”, ${monthKey}: there was no list of dates, so the month starts empty.`,
      );
    }
    overrides[monthKey] = {
      price: isNumber(price) ? price : 0,
      dates: Array.isArray(dates)
        ? dates.filter((date): date is string => typeof date === "string")
        : [],
    };
  }
  return overrides;
};

/** Mends the list of groups, or refuses a value that holds no groups at all. */
const validateGroups = (parsed: unknown): Validated<Group[]> | null => {
  if (!Array.isArray(parsed)) return null;

  const repairs: string[] = [];
  const groups: Group[] = [];

  parsed.forEach((entry, index) => {
    const position = `entry ${String(index + 1)}`;
    if (!isRecord(entry)) {
      repairs.push(`Dropped ${position}: it was not a group.`);
      return;
    }

    const name = entry["name"];
    if (typeof name !== "string" || name.trim() === "") {
      // The one unrepairable case. A group with no name has nothing to show it
      // under and nothing to tell the user they have lost.
      repairs.push(`Dropped ${position}: it had no name.`);
      return;
    }

    const price = entry["price"];
    if (!isNumber(price)) {
      repairs.push(
        `“${name}”: the stored price was not a number, so it now reads 0.`,
      );
    }

    const group: Group = {
      name,
      price: isNumber(price) ? price : 0,
      dates: [],
    };

    const dates = entry["dates"];
    if (Array.isArray(dates)) {
      group.dates = dates.filter(
        (date): date is string => typeof date === "string",
      );
      const dropped = dates.length - group.dates.length;
      if (dropped > 0) {
        repairs.push(
          `“${name}”: dropped ${String(dropped)} stored date(s) that were not dates.`,
        );
      }
    } else {
      repairs.push(
        `“${name}”: there was no list of dates, so the group starts with none.`,
      );
    }

    // Both optional fields are left off entirely when unusable, rather than set
    // to undefined: `currency` absent is a documented state that falls back to
    // the app default (DEF-003), and an absent `monthlyOverrides` is what data
    // from an older version looks like.
    const currency = entry["currency"];
    if (typeof currency === "string") {
      group.currency = currency;
    } else if (currency !== undefined) {
      repairs.push(
        `“${name}”: the stored currency was not a currency code, so the default applies.`,
      );
    }

    const overrides = entry["monthlyOverrides"];
    if (isRecord(overrides)) {
      group.monthlyOverrides = validateOverrides(name, overrides, repairs);
    } else if (overrides !== undefined) {
      repairs.push(`“${name}”: the stored month rows were not month rows.`);
    }

    groups.push(group);
  });

  return { value: groups, repairs };
};

/**
 * Mends the settings, and never refuses them.
 *
 * Unlike the groups there is nothing here worth recovering by hand: the one
 * field has a sane default, and every screen works without knowing the stored
 * value was wrong. Falling back is the whole repair.
 */
const validateSettings = (parsed: unknown): Validated<Settings> => {
  const fallback: Settings = { defaultCurrency: DEFAULT_CURRENCY };
  if (!isRecord(parsed)) {
    return {
      value: fallback,
      repairs: [
        "The stored settings were not settings, so the defaults apply.",
      ],
    };
  }
  const currency = parsed["defaultCurrency"];
  if (typeof currency === "string" && currency !== "") {
    return { value: { defaultCurrency: currency }, repairs: [] };
  }
  return {
    value: fallback,
    repairs: [
      "The stored default currency was not a currency code, so the default applies.",
    ],
  };
};

export const loadGroups = (): LoadResult<Group[]> =>
  readKey<Group[]>(
    STORAGE_KEYS.data,
    [],
    validateGroups,
    "The saved data was not a list of groups.",
  );

export const loadSettings = (): LoadResult<Settings> =>
  readKey<Settings>(
    STORAGE_KEYS.settings,
    { defaultCurrency: DEFAULT_CURRENCY },
    validateSettings,
    "The saved settings could not be read.",
  );

/** The template is stored raw. `null` means the app should use its default. */
export const loadTemplate = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.template);
  } catch {
    // Same reasoning as a refused read above: there is a default to fall back
    // to, and no screen depends on knowing the read failed.
    return null;
  }
};

/** The one place a write happens. Every caller gets a result, never a throw. */
const write = (key: string, value: string): WriteResult => {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
};

export const saveGroups = (groups: Group[]): WriteResult =>
  write(STORAGE_KEYS.data, JSON.stringify(groups));

export const saveSettings = (settings: Settings): WriteResult =>
  write(STORAGE_KEYS.settings, JSON.stringify(settings));

export const saveTemplate = (template: string): WriteResult =>
  write(STORAGE_KEYS.template, template);

/** Removes the template key, for a restore of a backup that carried none. */
export const removeTemplate = (): WriteResult => {
  try {
    localStorage.removeItem(STORAGE_KEYS.template);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
};

/**
 * "Clear all data" — all of it, since plan batch 3.4b.
 *
 * **DEF-013.** The legacy app removed two of the three keys, so the payment
 * template survived a wipe the user had been told could not be undone. That is
 * wrong in both directions: someone clearing their data to hand the browser on
 * left their bank details behind, and someone clearing it to start fresh found
 * the old message still there with no way to explain it.
 *
 * The backup key is deliberately **not** cleared. It records when this browser
 * last saved a file; the file itself is elsewhere and still exists, so
 * forgetting that it was made would be a lie in the other direction.
 */
export const clearStoredData = (): WriteResult => {
  try {
    localStorage.removeItem(STORAGE_KEYS.data);
    localStorage.removeItem(STORAGE_KEYS.settings);
    localStorage.removeItem(STORAGE_KEYS.template);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
};

/** When this browser last saved a backup file, or `null` — plan batch 3.3. */
export const loadLastBackupAt = (): Date | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.lastBackup);
    if (raw === null) return null;
    const at = new Date(raw);
    // A key someone edited by hand, or a value from a browser that stored
    // something else under the name. An unreadable date is the same as none.
    return Number.isNaN(at.getTime()) ? null : at;
  } catch {
    return null;
  }
};

export const saveLastBackupAt = (at: Date): WriteResult =>
  write(STORAGE_KEYS.lastBackup, at.toISOString());

/**
 * Copies the three keys aside before an import replaces them — plan batch 3.3.
 *
 * The naming is RP-07 §2's: `<key>.pre-import.<epoch>`. An epoch rather than a
 * fixed slot, so a second import cannot overwrite the snapshot taken before the
 * first — the one the teacher may actually want back.
 *
 * A key that is absent is snapshotted as absent, by writing nothing, and
 * `restoreSnapshot` removes it again. Otherwise undoing an import into a fresh
 * profile would leave the imported data in place under a key that never
 * existed.
 */
export const snapshotBeforeImport = (at: Date): string => {
  const stamp = String(at.getTime());
  for (const key of [
    STORAGE_KEYS.data,
    STORAGE_KEYS.settings,
    STORAGE_KEYS.template,
  ]) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null)
        localStorage.setItem(`${key}.pre-import.${stamp}`, value);
    } catch {
      // A snapshot that cannot be written must not stop the import: the user
      // asked for the import, and the write that follows reports its own
      // failure. What it does mean is that undo will find nothing, which is
      // why the caller checks before offering it.
    }
  }
  return stamp;
};

/** Whether a snapshot with this stamp can still be restored. */
export const hasSnapshot = (stamp: string): boolean => {
  try {
    return [
      STORAGE_KEYS.data,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.template,
    ].some(
      (key) => localStorage.getItem(`${key}.pre-import.${stamp}`) !== null,
    );
  } catch {
    return false;
  }
};

/** Puts a pre-import snapshot back, and clears it. Returns what was restored. */
export const restoreSnapshot = (
  stamp: string,
): {
  groups: LoadResult<Group[]>;
  settings: LoadResult<Settings>;
  template: string | null;
} | null => {
  if (!hasSnapshot(stamp)) return null;
  try {
    for (const key of [
      STORAGE_KEYS.data,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.template,
    ]) {
      const snapshotKey = `${key}.pre-import.${stamp}`;
      const value = localStorage.getItem(snapshotKey);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      localStorage.removeItem(snapshotKey);
    }
  } catch {
    return null;
  }
  return {
    groups: loadGroups(),
    settings: loadSettings(),
    template: loadTemplate(),
  };
};

/**
 * Ask the browser not to evict this origin's data under storage pressure.
 *
 * Everything the teacher has is in `localStorage` and nowhere else, so eviction
 * is total loss. This is a request and not a guarantee — a browser may grant
 * it, refuse it, or not implement it at all — which is why the only thing worth
 * promising is that asking never throws.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    // `typeof navigator`, not `globalThis.navigator?.`: the DOM types declare
    // `navigator` as always present, so an optional chain on it reads to the
    // linter as dead code. It is not — this module is unit-tested under Node.
    const manager: StorageManager | undefined =
      typeof navigator === "undefined" ? undefined : navigator.storage;
    if (typeof manager?.persist !== "function") return false;
    return await manager.persist();
  } catch {
    return false;
  }
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

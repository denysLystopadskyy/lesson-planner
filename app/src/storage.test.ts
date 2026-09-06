import { afterEach, beforeEach, describe, expect, it } from "vitest";
// `formatCurrency` is imported into a storage test on purpose. It is the only
// way to show what a bad return from `currencyOf` costs the caller — see the
// decision table below.
import { formatCurrency } from "./format";
import { STORAGE_KEYS } from "./storage-keys";
import {
  clearStoredData,
  currencyOf,
  lessonCountOf,
  loadGroups,
  loadSettings,
  loadTemplate,
  saveGroups,
  saveSettings,
  saveTemplate,
  type LoadResult,
} from "./storage";
import type { Group, Settings } from "./types";

/**
 * Unit tests for the three storage keys.
 *
 * The Vitest environment is `node`, so there is no `localStorage`. Every test
 * runs against a small fake: one `Map` behind the six members of `Storage`.
 * The module uses only three of them — `getItem`, `setItem` and `removeItem` —
 * but a real `Storage` has all six, so the fake has all six. It stores what it
 * is given and returns it. It records nothing about the calls, so each
 * assertion below is about behaviour, not about traffic.
 *
 * Keys always come from `STORAGE_KEYS`, never typed out. A build can set
 * `VITE_STORAGE_PREFIX`, and a test that hard-coded `groupLessonPlannerData`
 * would then pass or fail for the wrong reason. One test checks the contract
 * names as suffixes, which holds with or without a prefix.
 */

let store: Map<string, string>;

const createFakeStorage = (): Storage => ({
  get length(): number {
    return store.size;
  },
  clear(): void {
    store.clear();
  },
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  key(index: number): string | null {
    return [...store.keys()][index] ?? null;
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  setItem(key: string, value: string): void {
    store.set(key, value);
  },
});

beforeEach(() => {
  store = new Map<string, string>();
  globalThis.localStorage = createFakeStorage();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

/** Reads the failure branch of a load result, or fails the test. */
const failureOf = (
  result: LoadResult<unknown>,
): { raw: string; error: string } => {
  if (result.ok) {
    throw new Error(
      `Expected a reported failure, but the value loaded: ${JSON.stringify(result.value)}`,
    );
  }
  return result;
};

/** Reads the value out of a load result, or fails the test. */
const unwrap = <T>(result: LoadResult<T>): T => {
  if (!result.ok) {
    throw new Error(`Expected a value, but loading failed: ${result.error}`);
  }
  return result.value;
};

const anna: Group = {
  name: "Anna",
  price: 400,
  currency: "UAH",
  dates: ["2026-09-01", "2026-09-08"],
};

/**
 * The input here is the raw text sitting under a key. Four partitions cover
 * it: the key is absent, the text is JSON of the right shape, the text is JSON
 * of another shape, and the text is not JSON at all.
 */
describe("Reading the stored keys (equivalence partitioning)", () => {
  it("loads an empty list of groups when nothing was ever saved", () => {
    expect(loadGroups()).toEqual({ ok: true, value: [] });
  });

  it("loads the default currency when no settings were ever saved", () => {
    // The literal, not `DEFAULT_CURRENCY`. Comparing the loaded value against
    // the constant that produced it would pass whatever the constant said.
    expect(loadSettings()).toEqual({
      ok: true,
      value: { defaultCurrency: "UAH" },
    });
  });

  it("loads no payment template when none was ever saved", () => {
    expect(loadTemplate()).toBeNull();
  });

  it("loads groups written by the legacy app exactly as they were stored", () => {
    const legacy: Group[] = [
      {
        name: "Anna",
        price: 400,
        currency: "UAH",
        dates: ["2026-09-01", "2026-10-06"],
        monthlyOverrides: {
          "2026-10": { price: 450, dates: ["2026-10-06"] },
        },
      },
    ];
    store.set(STORAGE_KEYS.data, JSON.stringify(legacy));

    expect(loadGroups()).toEqual({ ok: true, value: legacy });
  });

  it("loads settings written by the legacy app exactly as they were stored", () => {
    store.set(STORAGE_KEYS.settings, '{"defaultCurrency":"PLN"}');

    expect(loadSettings()).toEqual({
      ok: true,
      value: { defaultCurrency: "PLN" },
    });
  });

  it("reports a corrupt group list instead of throwing", () => {
    // DEF-001. The legacy page calls `JSON.parse` unguarded here, so one bad
    // key leaves it inert with no message. The port must report and continue.
    const broken = '[{"name":"Anna",';
    store.set(STORAGE_KEYS.data, broken);

    const failure = failureOf(loadGroups());

    expect(failure.raw).toBe(broken);
    expect(failure.error).not.toBe("");
  });

  it("reports corrupt settings instead of throwing", () => {
    store.set(STORAGE_KEYS.settings, "{defaultCurrency: PLN}");

    expect(failureOf(loadSettings()).raw).toBe("{defaultCurrency: PLN}");
  });

  it("reports only the corrupt key and still reads the other two", () => {
    // This is the invariant DEF-001 is really about: one bad key must not take
    // the other two down with it.
    const broken = '[{"name":"Anna",';
    store.set(STORAGE_KEYS.data, broken);
    store.set(STORAGE_KEYS.settings, '{"defaultCurrency":"PLN"}');
    store.set(STORAGE_KEYS.template, "Please pay for the lessons.");

    expect(failureOf(loadGroups()).raw).toBe(broken);
    expect(loadSettings()).toEqual({
      ok: true,
      value: { defaultCurrency: "PLN" },
    });
    expect(loadTemplate()).toBe("Please pay for the lessons.");
  });

  it("treats an empty group list key as corrupt, not as absent", () => {
    // The boundary between the two partitions. An absent key is `null` and
    // falls back; an empty string is text that is not JSON, so it is reported.
    store.set(STORAGE_KEYS.data, "");

    expect(failureOf(loadGroups()).raw).toBe("");
  });

  it("accepts JSON of any other shape, because nothing checks the shape", () => {
    store.set(STORAGE_KEYS.data, "null");

    // `parse` casts its result to `Group[]`, so `ok: true` means "the text was
    // JSON", not "the value is a list of groups". The caller receives `null`
    // through a type that says `Group[]`.
    expect(loadGroups()).toEqual({ ok: true, value: null });
  });
});

/**
 * The template is a raw string, so its length is the interesting input. Zero
 * characters is the boundary: it is the shortest present value, and the one
 * that looks like an absent key to any caller testing for truth.
 */
describe("Saving and loading the payment template (boundary value analysis)", () => {
  it("stores the template raw, not as JSON", () => {
    const template = 'Pay "in full" before the first lesson.';
    saveTemplate(template);

    const stored = store.get(STORAGE_KEYS.template);

    expect(stored).toBe(template);
    expect(stored).not.toMatch(/^"/);
    expect(stored).not.toContain('\\"');
  });

  it("returns text that is not valid JSON, character for character", () => {
    // The template key never goes through `JSON.parse`, so text that would be
    // reported as corrupt under the other two keys is a fine template.
    saveTemplate("{oops");

    expect(loadTemplate()).toBe("{oops");
  });

  it("tells an empty template apart from a missing one", () => {
    expect(loadTemplate()).toBeNull();

    saveTemplate("");

    // `null` means "use the app default". `""` means "the teacher cleared it".
    // Both are falsy, so a caller testing truth loses the difference.
    expect(loadTemplate()).toBe("");
  });

  it("keeps the spacing of the template exactly as it was typed", () => {
    // Still the boundary, read the other way round: the first and last
    // characters of the value. Those are the ones a helpful `trim()` would
    // take. The teacher's message is several lines long and her own blank
    // lines are part of it, so trimming would be a silent edit of her text.
    const template = "\n  Please pay for the lessons.\n\n";
    saveTemplate(template);

    expect(store.get(STORAGE_KEYS.template)).toBe(template);
    expect(loadTemplate()).toBe(template);
  });

  it("replaces the template rather than appending to it", () => {
    saveTemplate("First version.");
    saveTemplate("Second version.");

    expect(loadTemplate()).toBe("Second version.");
  });
});

/**
 * The store moves between states: empty, populated, corrupt and cleared. Each
 * test walks one transition and checks the state it lands in.
 */
describe("Saving, then clearing all data (state transition testing)", () => {
  it("writes each key under the name the storage contract fixes", () => {
    saveGroups([anna]);
    saveSettings({ defaultCurrency: "UAH" });
    saveTemplate("Please pay for the lessons.");

    expect([...store.keys()].sort()).toEqual(
      [STORAGE_KEYS.data, STORAGE_KEYS.settings, STORAGE_KEYS.template].sort(),
    );
    // A staging build prefixes every key, so only the ending is fixed.
    expect(STORAGE_KEYS.data).toMatch(/groupLessonPlannerData$/);
    expect(STORAGE_KEYS.settings).toMatch(/groupLessonPlannerSettings$/);
    expect(STORAGE_KEYS.template).toMatch(/paymentTemplate$/);
  });

  it("reads back the groups and settings it wrote", () => {
    saveGroups([anna]);
    saveSettings({ defaultCurrency: "PLN" });

    expect(loadGroups()).toEqual({ ok: true, value: [anna] });
    expect(loadSettings()).toEqual({
      ok: true,
      value: { defaultCurrency: "PLN" },
    });
  });

  it("writes plain JSON that the legacy app could read", () => {
    // A round trip through this module alone would still pass if both sides
    // encoded twice. These check the bytes on the key, which is what the
    // legacy reader sees.
    saveGroups([anna]);
    saveSettings({ defaultCurrency: "PLN" });

    expect(store.get(STORAGE_KEYS.data)).toBe(JSON.stringify([anna]));
    expect(store.get(STORAGE_KEYS.settings)).toBe(
      JSON.stringify({ defaultCurrency: "PLN" }),
    );
  });

  it("saves every group, in order, and keeps the monthly overrides", () => {
    // The transition this covers is "one saved group" to "several". Every
    // other test here saves the single fixture group, which has no overrides,
    // so a save that kept only the first group, reversed the list or dropped
    // an optional field would write bytes nobody could tell from the right
    // ones. Two groups, the second carrying overrides, is the smallest list
    // where all three faults show.
    const olena: Group = {
      name: "Olena",
      price: 300,
      currency: "PLN",
      dates: ["2026-10-06", "2026-10-13"],
      monthlyOverrides: {
        "2026-10": { price: 450, dates: ["2026-10-06"] },
      },
    };

    saveGroups([anna, olena]);

    expect(store.get(STORAGE_KEYS.data)).toBe(JSON.stringify([anna, olena]));
    expect(unwrap(loadGroups())).toEqual([anna, olena]);
  });

  it("overwrites a corrupt value on the next save", () => {
    store.set(STORAGE_KEYS.data, "not json");

    saveGroups([anna]);

    expect(loadGroups()).toEqual({ ok: true, value: [anna] });
  });

  it("removes the group and settings keys, so both fall back again", () => {
    saveGroups([anna]);
    saveSettings({ defaultCurrency: "PLN" });

    clearStoredData();

    // The keys go rather than being written empty, so a cleared planner looks
    // exactly like one that was never used.
    expect(store.has(STORAGE_KEYS.data)).toBe(false);
    expect(store.has(STORAGE_KEYS.settings)).toBe(false);
    expect(loadGroups()).toEqual({ ok: true, value: [] });
    expect(loadSettings()).toEqual({
      ok: true,
      value: { defaultCurrency: "UAH" },
    });
  });

  it("leaves the payment template behind (DEF-013)", () => {
    // This asserts what the code does today, not what it should do. The right
    // behaviour is to remove all three keys: the user was told the wipe could
    // not be undone, and the template survives it. Plan batch 3.4b removes the
    // third key, and must flip this assertion to `toBeNull()` in the same PR.
    saveGroups([anna]);
    saveTemplate("Please pay for the lessons.");

    clearStoredData();

    expect(loadTemplate()).toBe("Please pay for the lessons.");
    expect(store.has(STORAGE_KEYS.template)).toBe(true);
  });

  it("clears an already empty store without complaint", () => {
    clearStoredData();
    clearStoredData();

    expect(store.size).toBe(0);
    expect(loadGroups()).toEqual({ ok: true, value: [] });
  });
});

/**
 * Two conditions decide the answer: whether the group carries a currency, and
 * what the settings hold. The table:
 *
 * | group.currency  | result                          |
 * | --------------- | ------------------------------- |
 * | a currency code | that code                       |
 * | absent          | `settings.defaultCurrency`      |
 * | an empty string | the empty string                |
 */
describe("The currency a group is shown in (decision table)", () => {
  const settings: Settings = { defaultCurrency: "PLN" };

  it("keeps the currency the group was saved with", () => {
    expect(currencyOf(anna, settings)).toBe("UAH");
  });

  it("falls back to the settings default for a group saved without one", () => {
    // DEF-003 in the legacy app: such a group cannot be opened at all, because
    // `formatCurrency` is called with no fallback and throws. The port does not
    // inherit that. The default comes from the argument, so "PLN" here proves
    // the value is read from the settings and not from a constant.
    const older: Group = { name: "Olena", price: 300, dates: [] };

    expect(currencyOf(older, settings)).toBe("PLN");
  });

  it("passes an empty currency straight through, so the group still breaks", () => {
    // DEF-003 covers a currency that is missing **or is not a currency code**.
    // `??` replaces only `null` and `undefined`, so the second half survives:
    // an empty string is a value, it is returned, and the caller throws.
    const broken: Group = {
      name: "Olena",
      price: 300,
      currency: "",
      dates: [],
    };

    expect(currencyOf(broken, settings)).toBe("");
    expect(() => formatCurrency(100, currencyOf(broken, settings))).toThrow(
      RangeError,
    );
  });
});

/**
 * The partitions are the group's date list: empty, holding dates, and absent
 * from the stored record altogether.
 */
describe("Counting a group's planned lessons (equivalence partitioning)", () => {
  it("counts nothing for a group with no dates", () => {
    const empty: Group = {
      name: "Olena",
      price: 300,
      currency: "UAH",
      dates: [],
    };

    expect(lessonCountOf(empty)).toBe(0);
  });

  it("counts every date, across every month", () => {
    const spread: Group = {
      name: "Anna",
      price: 400,
      currency: "UAH",
      dates: ["2026-09-01", "2026-09-08", "2026-10-06"],
    };

    expect(lessonCountOf(spread)).toBe(3);
  });

  it("ignores the monthly overrides", () => {
    // The count is the length of the top-level list. An override that lists
    // other dates does not change it, even though the month rows are built
    // from the overrides.
    const withOverride: Group = {
      name: "Anna",
      price: 400,
      currency: "UAH",
      dates: ["2026-09-01"],
      monthlyOverrides: {
        "2026-10": { price: 450, dates: ["2026-10-06", "2026-10-13"] },
      },
    };

    expect(lessonCountOf(withOverride)).toBe(1);
  });

  it("throws for a stored group that has no date list", () => {
    // Nothing between the key and here checks the shape, and the cast inside
    // `parse` means TypeScript believes this value is a `Group`. The count is
    // where the missing field is finally noticed.
    store.set(STORAGE_KEYS.data, '[{"name":"Anna","price":400}]');
    const [group] = unwrap(loadGroups());
    if (group === undefined) throw new Error("the stored group should load");

    expect(() => lessonCountOf(group)).toThrow(TypeError);
  });
});

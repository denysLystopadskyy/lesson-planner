import { afterEach, beforeEach, describe, expect, it } from "vitest";
// `formatCurrency` is imported into a storage test on purpose. It is the only
// way to show what a bad return from `currencyOf` costs the caller — see the
// decision table below.
import { formatCurrency } from "./format";
import { STORAGE_KEYS } from "./storage-keys";
import {
  CORRUPT_BACKUP_SUFFIX,
  clearStoredData,
  currencyOf,
  lessonCountOf,
  loadGroups,
  loadSettings,
  loadTemplate,
  requestPersistentStorage,
  saveGroups,
  saveSettings,
  saveTemplate,
  type LoadResult,
  type WriteResult,
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

/** Reads the message out of a refused write, or fails the test. */
const refusalOf = (result: WriteResult): string => {
  if (result.ok)
    throw new Error("Expected the write to be refused, but it succeeded");
  return result.error;
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
    // Not merely non-empty: "0" or the raw text would satisfy that. The engine
    // owns the exact wording, so match the one word it is guaranteed to carry.
    expect(failure.error).toMatch(/JSON/i);
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

  it("refuses JSON that is not a list of groups", () => {
    store.set(STORAGE_KEYS.data, "null");

    // Before batch 3.1 this returned `{ ok: true, value: null }`: `parse` cast
    // its result to `Group[]`, so `ok: true` meant "the text was JSON", not
    // "the value is a list of groups", and `null` reached the render through a
    // type that said otherwise. Now the shape is checked and `ok` means what
    // it says.
    expect(failureOf(loadGroups()).error).toMatch(/list/i);
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

  it("removes the payment template too (DEF-013)", () => {
    // Before batch 3.4b the template survived a wipe the user had been told
    // could not be undone. That is wrong in both directions: someone clearing
    // their data to hand the browser on left their bank details behind, and
    // someone clearing it to start fresh found the old message still there.
    store.set(STORAGE_KEYS.data, "[]");
    store.set(STORAGE_KEYS.settings, '{"defaultCurrency":"UAH"}');
    store.set(STORAGE_KEYS.template, "Please pay for the lessons.");

    clearStoredData();

    expect(loadTemplate()).toBeNull();
  });

  it("leaves the last-backup key alone", () => {
    // The backup key records when this browser last saved a file. The file
    // itself is elsewhere and still exists, so forgetting it was made would be
    // a lie in the other direction.
    store.set(STORAGE_KEYS.lastBackup, "2026-06-15T12:00:00.000Z");

    clearStoredData();

    expect(store.get(STORAGE_KEYS.lastBackup)).toBe("2026-06-15T12:00:00.000Z");
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

  it("counts nothing for a stored group that had no date list", () => {
    // Before batch 3.1 the missing field reached this call and threw a
    // TypeError. The load now repairs the shape, so the group counts zero
    // lessons instead of taking the dialog down with it.
    store.set(STORAGE_KEYS.data, '[{"name":"Anna","price":400}]');
    const [group] = unwrap(loadGroups());
    if (group === undefined) throw new Error("the stored group should load");

    expect(lessonCountOf(group)).toBe(0);
  });
});

describe("A write the browser refuses (DEF-022)", () => {
  /** Swaps in a `localStorage` whose `setItem` always refuses. */
  const withRefusingStorage = (body: () => void): void => {
    const refusing = {
      getItem: () => null,
      setItem: () => {
        const error = new Error("The quota has been exceeded.");
        error.name = "QuotaExceededError";
        throw error;
      },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    const previous = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: refusing,
      configurable: true,
      writable: true,
    });
    try {
      body();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: previous,
        configurable: true,
        writable: true,
      });
    }
  };

  it("reports the refusal instead of throwing past the caller", () => {
    // DEF-022. A full quota or a private window that refuses storage used to
    // throw straight out of the save, past a React event handler, and the user
    // was told nothing while the edit was not saved. There is no server to
    // fall back on, so silence is the whole harm.
    withRefusingStorage(() => {
      // Not merely `ok: false` — the message is what the user is shown, so it
      // has to carry the reason the browser gave rather than a generic phrase.
      expect(refusalOf(saveGroups([]))).toMatch(/quota/i);
      expect(refusalOf(saveSettings({ defaultCurrency: "UAH" }))).toMatch(
        /quota/i,
      );
      expect(refusalOf(saveTemplate("anything"))).toMatch(/quota/i);
    });
  });

  it("reports success when the write goes through", () => {
    // The other half of the contract: a caller that has to check `ok` needs
    // `ok` to be true on the ordinary path, or it will report a false alarm.
    expect(saveGroups([anna])).toEqual({ ok: true });
    expect(saveTemplate("Pay by Friday")).toEqual({ ok: true });
    expect(unwrap(loadGroups())).toEqual([anna]);
  });

  it("reports a refused clear rather than leaving the data half-gone", () => {
    withRefusingStorage(() => {
      // `removeItem` still works in the fake above, so this one succeeds; the
      // point is that the call has a result at all and the caller can react.
      expect(clearStoredData()).toEqual({ ok: true });
    });
  });
});

/**
 * Stored text can be valid JSON and still be the wrong shape. `JSON.parse`
 * cannot tell the difference, and the `as T` inside the module means
 * TypeScript stops asking. Everything below is about the gap between those two
 * facts — DEF-021.
 *
 * The rule the repairs follow: **never drop what the user can still use.** A
 * missing list becomes an empty list, a bad field is discarded on its own, and
 * a whole group goes only when it has no name to show. Losing a group is worse
 * than showing one with a zero price, because the user can fix a price and
 * cannot recover a group.
 */
describe("Stored groups of the wrong shape (DEF-021)", () => {
  /** Puts arbitrary JSON under the data key. */
  const storeRaw = (json: string): void => {
    store.set(STORAGE_KEYS.data, json);
  };

  /** Reads the repairs a load reported, or an empty list. */
  const repairsOf = (result: LoadResult<unknown>): string[] =>
    result.ok ? (result.repairs ?? []) : [];

  it("An override with no dates array gets an empty one", () => {
    // The exact shape that used to crash the group dialog: `monthsToRender`
    // reads `.length` of a `dates` that is not there, while rendering.
    storeRaw(
      JSON.stringify([
        {
          name: "Anna",
          price: 400,
          monthlyOverrides: { "2026-06": { price: 100 } },
        },
      ]),
    );

    const [group] = unwrap(loadGroups());

    expect(group?.monthlyOverrides).toEqual({
      "2026-06": { price: 100, dates: [] },
    });
  });

  it("A group with no dates array gets an empty one", () => {
    storeRaw(JSON.stringify([{ name: "Anna", price: 400 }]));

    expect(unwrap(loadGroups())).toEqual([
      { name: "Anna", price: 400, dates: [] },
    ]);
  });

  it("Only the string dates survive a list with rubbish in it", () => {
    storeRaw(
      JSON.stringify([
        { name: "Anna", price: 400, dates: ["2026-09-01", 7, null] },
      ]),
    );

    expect(unwrap(loadGroups())[0]?.dates).toEqual(["2026-09-01"]);
  });

  it("A price that is not a number becomes zero, and says so", () => {
    // Zero is wrong, but it is visibly wrong, and the group survives. Silently
    // keeping a `NaN` price would put "NaN" on the card and in the message.
    storeRaw(
      JSON.stringify([{ name: "Anna", price: "four hundred", dates: [] }]),
    );

    const result = loadGroups();

    expect(unwrap(result)[0]?.price).toBe(0);
    expect(repairsOf(result).join(" ")).toMatch(/price/i);
  });

  it("A currency that is not a string is dropped, so the default applies", () => {
    storeRaw(
      JSON.stringify([{ name: "Anna", price: 400, currency: 7, dates: [] }]),
    );

    expect(unwrap(loadGroups())[0]).not.toHaveProperty("currency");
  });

  it("A group with no usable name is dropped, and the rest still load", () => {
    storeRaw(
      JSON.stringify([{ price: 1 }, { name: "Anna", price: 400, dates: [] }]),
    );

    const result = loadGroups();

    expect(unwrap(result)).toEqual([{ name: "Anna", price: 400, dates: [] }]);
    expect(repairsOf(result)).toHaveLength(1);
  });

  it("A stored value that is not a list at all cannot be read as groups", () => {
    // This one is not repairable: there is no group in it to keep. It takes the
    // same route as unparseable text, so the user gets the banner and the data
    // is left alone.
    storeRaw(JSON.stringify({ name: "Anna" }));

    expect(failureOf(loadGroups()).error).toMatch(/list/i);
  });

  it("Good data passes through with nothing reported", () => {
    // The guard against a validator that "repairs" correct data. If this test
    // ever reports a repair, the banner would cry wolf on every clean load.
    storeRaw(JSON.stringify([anna]));

    const result = loadGroups();

    expect(unwrap(result)).toEqual([anna]);
    expect(repairsOf(result)).toEqual([]);
  });

  it("Settings of the wrong shape fall back to the default currency", () => {
    store.set(STORAGE_KEYS.settings, JSON.stringify({ defaultCurrency: 7 }));

    expect(unwrap(loadSettings())).toEqual({ defaultCurrency: "UAH" });
  });
});

/**
 * What happens to text that cannot be parsed at all. The app has always
 * reported it; what it never did was keep it. A user who sees the banner has
 * one question — is my data gone — and the honest answer needs the bytes to
 * still exist.
 */
describe("An unreadable value is kept, not overwritten", () => {
  it("The raw text is copied to a backup key", () => {
    store.set(STORAGE_KEYS.data, "not json at all {{{");

    failureOf(loadGroups());

    expect(store.get(`${STORAGE_KEYS.data}${CORRUPT_BACKUP_SUFFIX}`)).toBe(
      "not json at all {{{",
    );
  });

  it("The original key is left exactly as it was", () => {
    store.set(STORAGE_KEYS.data, "not json at all {{{");

    failureOf(loadGroups());

    expect(store.get(STORAGE_KEYS.data)).toBe("not json at all {{{");
  });

  it("An existing backup is not overwritten by a later boot", () => {
    // The first failure holds the data the user actually lost. A second boot
    // must not replace it — least of all with a value the app itself wrote.
    store.set(`${STORAGE_KEYS.data}${CORRUPT_BACKUP_SUFFIX}`, "the first one");
    store.set(STORAGE_KEYS.data, "broken again {{{");

    failureOf(loadGroups());

    expect(store.get(`${STORAGE_KEYS.data}${CORRUPT_BACKUP_SUFFIX}`)).toBe(
      "the first one",
    );
  });

  it("A backup the browser refuses still lets the app boot", () => {
    // Storage that refuses writes is exactly the storage most likely to be
    // holding a truncated value. Failing to back it up must not turn a
    // reported error into a thrown one.
    const previous = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => "not json at all {{{",
        setItem: () => {
          throw new Error("The quota has been exceeded.");
        },
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
      configurable: true,
      writable: true,
    });

    try {
      expect(failureOf(loadGroups()).raw).toBe("not json at all {{{");
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: previous,
        configurable: true,
        writable: true,
      });
    }
  });
});

/**
 * `navigator.storage.persist()` asks the browser not to evict the origin's
 * data under pressure. It is a request, not a guarantee, and it is missing
 * altogether in some browsers — so the only thing worth asserting is that
 * asking never throws.
 */
describe("Asking the browser to keep the data", () => {
  const withNavigator = async (
    value: unknown,
    body: () => Promise<void>,
  ): Promise<void> => {
    const had = "navigator" in globalThis;
    const previous = Reflect.get(globalThis, "navigator") as unknown;
    Object.defineProperty(globalThis, "navigator", {
      value,
      configurable: true,
      writable: true,
    });
    try {
      await body();
    } finally {
      if (had) {
        Object.defineProperty(globalThis, "navigator", {
          value: previous,
          configurable: true,
          writable: true,
        });
      } else {
        Reflect.deleteProperty(globalThis, "navigator");
      }
    }
  };

  it("passes on what the browser answers", async () => {
    await withNavigator(
      { storage: { persist: () => Promise.resolve(true) } },
      async () => {
        await expect(requestPersistentStorage()).resolves.toBe(true);
      },
    );
  });

  it("answers false when the browser has no storage manager", async () => {
    await withNavigator({}, async () => {
      await expect(requestPersistentStorage()).resolves.toBe(false);
    });
  });

  it("answers false when the browser refuses the request", async () => {
    await withNavigator(
      { storage: { persist: () => Promise.reject(new Error("no")) } },
      async () => {
        await expect(requestPersistentStorage()).resolves.toBe(false);
      },
    );
  });
});

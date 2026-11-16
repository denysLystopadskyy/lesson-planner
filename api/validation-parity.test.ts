import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateDocument, type DocumentKey } from "./[...all].ts";

/**
 * C8. The entry's validator and the app's validator agree (plan batch 6.1).
 *
 * The entry may import published packages only (lesson 31), so its validator
 * is written inside it and cannot share code with `app/src/storage.ts`. This
 * checklist is what keeps the two from drifting:
 *
 * 1. every storage fixture the e2e suite seeds is accepted by **both** — the
 *    app loads it with no repair, and the entry accepts it as a document body;
 * 2. every invalid case of C5 is refused by the entry.
 *
 * A fixture value of `null` for `data` or `settings` means "this key is absent
 * from localStorage" (`e2e/ui/support/storage-fixtures.ts`). An absent key is
 * never uploaded, so there is no body to check. For `template`, `null` **is** a
 * body: it means "use the default template", and the entry must accept it.
 */

/**
 * The app's own loaders, imported at run time.
 *
 * A static import would make `typecheck:api` check `app/src/storage.ts` under
 * the API's Node settings, where its `import.meta.env` and DOM types do not
 * exist (it is checked by `typecheck:app` instead). A path that TypeScript
 * does not follow keeps each file in its own project; Vitest still runs the
 * real module. The type below is the slice of its exports this test calls.
 */
type AppStorage = {
  loadGroups: () => { ok: boolean; value?: unknown; repairs?: string[] };
  loadSettings: () => { ok: boolean; value?: unknown; repairs?: string[] };
  loadTemplate: () => string | null;
};
const APP_STORAGE = path.resolve(import.meta.dirname, "../app/src/storage.ts");
const loaded: unknown = await import(APP_STORAGE);
const { loadGroups, loadSettings, loadTemplate } = loaded as AppStorage;

const FIXTURES = "e2e/fixtures/storage";

const KEYS: Record<string, DocumentKey> = {
  groupLessonPlannerData: "data",
  groupLessonPlannerSettings: "settings",
  paymentTemplate: "template",
};

const fixtures = readdirSync(FIXTURES)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({
    name,
    values: JSON.parse(
      readFileSync(path.join(FIXTURES, name), "utf8"),
    ) as Record<string, unknown>,
  }));

/** A `localStorage` holding the fixture as the browser would hold it. */
const installStorage = (values: Record<string, unknown>): void => {
  const store = new Map<string, string>();
  for (const [storageKey, value] of Object.entries(values)) {
    if (value === null) continue;
    store.set(
      storageKey,
      // The template is stored raw; the other two are JSON.
      storageKey === "paymentTemplate" && typeof value === "string"
        ? value
        : JSON.stringify(value),
    );
  }
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("C8 validation parity — checklist", () => {
  it("finds the fixtures it is meant to check", () => {
    expect(fixtures.map((fixture) => fixture.name).sort()).toEqual([
      "empty.json",
      "legacy.json",
      "realistic.json",
    ]);
  });

  describe.each(fixtures)("$name", ({ values }) => {
    it("uses only the three planner keys", () => {
      expect(Object.keys(values).sort()).toEqual(Object.keys(KEYS).sort());
    });

    it("is loaded by the app unchanged, with no repair", () => {
      installStorage(values);

      const groups = loadGroups();
      const settings = loadSettings();

      // An absent key loads as the app's own default.
      expect(groups).toStrictEqual({
        ok: true,
        value: values["groupLessonPlannerData"] ?? [],
      });
      expect(settings).toStrictEqual({
        ok: true,
        value: values["groupLessonPlannerSettings"] ?? {
          defaultCurrency: "UAH",
        },
      });
      expect(loadTemplate()).toBe(values["paymentTemplate"] ?? null);
    });

    it("is accepted by the entry, key by key", () => {
      for (const [storageKey, key] of Object.entries(KEYS)) {
        const value = values[storageKey];
        if (value === null && key !== "template") continue;
        expect({ key, accepted: validateDocument(key, value) }).toEqual({
          key,
          accepted: true,
        });
      }
    });
  });

  /** The C5 shapes, as bodies. The key and schema-version cases are routes. */
  const invalid: [string, DocumentKey, unknown][] = [
    ["non-array data", "data", { name: "A" }],
    ["data null", "data", null],
    ["group with no name", "data", [{ price: 250, dates: [] }]],
    [
      "group with a blank name",
      "data",
      [{ name: "  ", price: 250, dates: [] }],
    ],
    ["price not a number", "data", [{ name: "A", price: "250", dates: [] }]],
    ["price null", "data", [{ name: "A", price: null, dates: [] }]],
    ["dates missing", "data", [{ name: "A", price: 250 }]],
    [
      "date not YYYY-MM-DD",
      "data",
      [{ name: "A", price: 250, dates: ["2026-7-6"] }],
    ],
    [
      "currency not a string",
      "data",
      [{ name: "A", price: 250, currency: 980, dates: [] }],
    ],
    [
      "month key not YYYY-MM",
      "data",
      [
        {
          name: "A",
          price: 250,
          dates: [],
          monthlyOverrides: { "2026-7": { price: 250, dates: [] } },
        },
      ],
    ],
    [
      "month with no dates",
      "data",
      [
        {
          name: "A",
          price: 250,
          dates: [],
          monthlyOverrides: { "2026-07": { price: 250 } },
        },
      ],
    ],
    ["settings with no currency", "settings", {}],
    ["settings with an empty currency", "settings", { defaultCurrency: "" }],
    ["settings not an object", "settings", "PLN"],
    ["template not a string or null", "template", 42],
    ["U+0000 in the template", "template", "a\u0000b"],
    [
      "U+0000 in a group name",
      "data",
      [{ name: "A\u0000", price: 250, dates: [] }],
    ],
    [
      "U+0000 in a currency",
      "data",
      [{ name: "A", price: 250, currency: "UA\u0000H", dates: [] }],
    ],
    [
      "U+0000 in a date",
      "data",
      [{ name: "A", price: 250, dates: ["2026-07-06\u0000"] }],
    ],
    [
      "U+0000 in the default currency",
      "settings",
      { defaultCurrency: "PLN\u0000" },
    ],
  ];

  /**
   * Found in batch 6.1: the app **keeps** strings the entry refuses. Its
   * loader mends shapes, not characters, so a U+0000 in a group name or the
   * template loads unchanged, and any string is kept as a date. These pin
   * the gap, so batch 6.3's repaired upload knows it must normalise or report
   * such values (storage-data-contract.md, "Built in batch 6.1").
   */
  describe("gaps the 6.3 upload must handle (the app keeps, the entry refuses)", () => {
    it("U+0000 in a group name and in the template", () => {
      const groups = [{ name: "A\u0000", price: 250, dates: [] }];
      installStorage({
        groupLessonPlannerData: groups,
        groupLessonPlannerSettings: null,
        paymentTemplate: "a\u0000b",
      });

      expect(loadGroups()).toStrictEqual({ ok: true, value: groups });
      expect(loadTemplate()).toBe("a\u0000b");
      expect(validateDocument("data", groups)).toBe(false);
      expect(validateDocument("template", "a\u0000b")).toBe(false);
    });

    it("a date that is not YYYY-MM-DD", () => {
      const groups = [{ name: "A", price: 250, dates: ["6 July 2026"] }];
      installStorage({
        groupLessonPlannerData: groups,
        groupLessonPlannerSettings: null,
        paymentTemplate: null,
      });

      expect(loadGroups()).toStrictEqual({ ok: true, value: groups });
      expect(validateDocument("data", groups)).toBe(false);
    });
  });

  it.each(invalid)("the entry refuses: %s", (_, key, body) => {
    expect(validateDocument(key, body)).toBe(false);
  });
});

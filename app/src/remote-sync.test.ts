import { describe, expect, it } from "vitest";
import type { RemoteDocument, ServerDocuments } from "./documents-api";
import {
  changedKeys,
  documentsOf,
  loadedFromServer,
  retryDelayMs,
  savedAtOf,
  type PlannerDocuments,
} from "./remote-sync";
import type { Group } from "./types";

/**
 * The pure half of remote mode — plan batch 6.2, test conditions C1 and C2.
 *
 * Risk R4 is high (testing.md §1.8), so the retry delays get 3-value boundary
 * value analysis and `changedKeys` gets a full decision table.
 */

const groupOf = (name: string, price = 100): Group => ({
  name,
  price,
  currency: "UAH",
  dates: ["2026-06-01"],
  monthlyOverrides: {},
});

const docOf = (body: unknown, updatedAt = "2026-06-15T10:00:00.000Z") =>
  ({ body, schemaVersion: 1, updatedAt }) satisfies RemoteDocument;

const emptyServer: ServerDocuments = {
  data: null,
  settings: null,
  template: null,
};

describe("C1 retryDelayMs — 3-value boundary value analysis", () => {
  // The schedule: 1 s, 2 s, 5 s, 10 s, then 30 s for every later attempt.
  // Boundaries: the first attempt (0) and the step to the cap (3 → 4).
  it.each([
    [0, 1000],
    [1, 2000],
    [2, 5000],
    [3, 10000],
    [4, 30000],
    [5, 30000],
    [100, 30000],
  ])("attempt %i waits %i ms", (attempt, delay) => {
    expect(retryDelayMs(attempt)).toBe(delay);
  });

  it("A value below the first boundary is treated as the first attempt", () => {
    expect(retryDelayMs(-1)).toBe(1000);
  });
});

describe("C2 changedKeys — decision table", () => {
  const saved: PlannerDocuments = {
    data: [groupOf("Monday")],
    settings: { defaultCurrency: "UAH" },
    template: null,
  };

  it("Rule 1: nothing changed → no key", () => {
    expect(changedKeys(structuredClone(saved), saved)).toEqual([]);
  });

  it("Rule 2: one key changed → only that key", () => {
    expect(
      changedKeys({ ...saved, data: [groupOf("Monday", 120)] }, saved),
    ).toEqual(["data"]);
  });

  it("Rule 3: all three changed → all three, in key order", () => {
    expect(
      changedKeys(
        {
          data: [],
          settings: { defaultCurrency: "PLN" },
          template: "Hello",
        },
        saved,
      ),
    ).toEqual(["data", "settings", "template"]);
  });

  it("Rule 4: template null → string is a change", () => {
    expect(changedKeys({ ...saved, template: "" }, saved)).toEqual([
      "template",
    ]);
  });

  it("Rule 5: template string → null is a change", () => {
    expect(
      changedKeys(saved, { ...saved, template: "Lessons for {{month}}" }),
    ).toEqual(["template"]);
  });

  it("Compares serialized text, not object identity", () => {
    // A fresh array with the same content is not a change, so a commit that
    // rebuilds the list without editing it sends nothing.
    expect(changedKeys({ ...saved, data: [groupOf("Monday")] }, saved)).toEqual(
      [],
    );
  });
});

describe("documentsOf — the state as the three bodies", () => {
  it("Maps groups, settings and template to data, settings and template", () => {
    expect(
      documentsOf({
        groups: [groupOf("Monday")],
        settings: { defaultCurrency: "PLN" },
        template: null,
      }),
    ).toEqual({
      data: [groupOf("Monday")],
      settings: { defaultCurrency: "PLN" },
      template: null,
    });
  });
});

describe("loadedFromServer — equivalence partitioning on the server's answer", () => {
  it("An empty account loads as an empty planner with defaults", () => {
    const loaded = loadedFromServer(emptyServer);

    expect(loaded.groups).toEqual({ ok: true, value: [] });
    expect(loaded.settings).toEqual({
      ok: true,
      value: { defaultCurrency: "UAH" },
    });
    expect(loaded.template).toBeNull();
  });

  it("Stored bodies load as they are", () => {
    const loaded = loadedFromServer({
      data: docOf([groupOf("Monday")]),
      settings: docOf({ defaultCurrency: "PLN" }),
      template: docOf("Lessons for {{month}}"),
    });

    expect(loaded.groups).toEqual({ ok: true, value: [groupOf("Monday")] });
    expect(loaded.settings).toEqual({
      ok: true,
      value: { defaultCurrency: "PLN" },
    });
    expect(loaded.template).toBe("Lessons for {{month}}");
  });

  it("A template row holding null means the default template", () => {
    expect(
      loadedFromServer({ ...emptyServer, template: docOf(null) }).template,
    ).toBeNull();
  });

  it("A data body that is not a list is an error, not an empty planner", () => {
    const loaded = loadedFromServer({ ...emptyServer, data: docOf({}) });

    expect(loaded.groups.ok).toBe(false);
  });

  it("A mended group reports the repair, as the local loader does", () => {
    const loaded = loadedFromServer({
      ...emptyServer,
      data: docOf([{ name: "Monday", price: "x", dates: [] }]),
    });

    expect(loaded.groups.ok && loaded.groups.repairs?.length).toBe(1);
  });
});

describe("savedAtOf — the newest stamp the server gave", () => {
  it("No rows → null", () => {
    expect(savedAtOf(emptyServer)).toBeNull();
  });

  it("Several rows → the latest updatedAt", () => {
    expect(
      savedAtOf({
        data: docOf([], "2026-06-15T10:00:00.000Z"),
        settings: docOf({ defaultCurrency: "UAH" }, "2026-06-15T11:30:00.000Z"),
        template: null,
      }),
    ).toBe("2026-06-15T11:30:00.000Z");
  });
});

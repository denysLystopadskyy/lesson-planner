import { describe, expect, it } from "vitest";
import {
  initialState,
  plannerReducer,
  type Action,
  type LoadedData,
  type Pending,
  type PlannerState,
} from "./store";
import type { Group } from "./types";

/**
 * The store.
 *
 * ISTQB technique: state transition testing. The interesting machine is not the
 * data — it is `pending`, the field that tells the persistence subscriber what
 * to do. It has three states and four events, so the whole table fits in one
 * test and every cell is asserted, including the ones that must do nothing.
 *
 * Two transitions carry the batch's real risk. `data/clear` must ask for a
 * **clear** rather than a write, or the cleared keys would be written straight
 * back; and the initial state must ask for **nothing**, or the app would
 * overwrite a corrupt stored value on mount and destroy the data the user came
 * to recover.
 */

const groupOf = (name: string, price = 100): Group => ({
  name,
  price,
  currency: "UAH",
  dates: [],
  monthlyOverrides: {},
});

const loaded = (over: Partial<LoadedData> = {}): LoadedData => ({
  groups: { ok: true, value: [groupOf("Monday Beginners")] },
  settings: { ok: true, value: { defaultCurrency: "PLN" } },
  template: "Lessons for {{month}}.",
  ...over,
});

const stateOf = (over: Partial<PlannerState> = {}): PlannerState => ({
  ...initialState(loaded()),
  ...over,
});

describe("initialState — equivalence partitioning on the stored values", () => {
  it("Readable data becomes the state, and asks for no write", () => {
    const state = initialState(loaded());

    expect(state.groups).toEqual([groupOf("Monday Beginners")]);
    expect(state.settings).toEqual({ defaultCurrency: "PLN" });
    expect(state.template).toBe("Lessons for {{month}}.");
    expect(state.loadError).toBeNull();
    // The one that protects the corrupt-storage case below.
    expect(state.pending).toBe("none");
  });

  it("Unreadable groups become an empty planner and a reported error", () => {
    const state = initialState(
      loaded({
        groups: { ok: false, raw: "not json at all {{{", error: "Bad token" },
      }),
    );

    // DEF-001 is what happens when this throws instead: a page that looks
    // normal and does nothing.
    expect(state.groups).toEqual([]);
    expect(state.loadError).toBe("Bad token");
    // And still no write, so the unreadable value is left where the user can
    // still get at it.
    expect(state.pending).toBe("none");
  });

  it("Unreadable settings fall back silently", () => {
    const state = initialState(
      loaded({ settings: { ok: false, raw: "{{{", error: "Bad token" } }),
    );

    // No banner for this one: the currency has a sane default and no screen
    // depends on knowing the stored value was broken.
    expect(state.settings).toEqual({ defaultCurrency: "UAH" });
    expect(state.loadError).toBeNull();
  });

  it("A missing template key stays null rather than becoming a default", () => {
    // The distinction is load-bearing: null means "nothing stored, so the app
    // supplies its default", and the subscriber must not write anything.
    expect(initialState(loaded({ template: null })).template).toBeNull();
  });
});

describe("plannerReducer — state transition testing", () => {
  it("A commit replaces the groups and asks for a write", () => {
    const next = plannerReducer(stateOf(), {
      type: "groups/commit",
      groups: [groupOf("Wednesday Advanced", 500)],
    });

    expect(next.groups).toEqual([groupOf("Wednesday Advanced", 500)]);
    expect(next.pending).toBe("write");
  });

  it("A commit without settings leaves the currency alone", () => {
    // Deleting a group or saving a schedule carries no settings, and the
    // legacy app writes the settings key only when the select changed.
    const next = plannerReducer(stateOf(), {
      type: "groups/commit",
      groups: [],
    });

    expect(next.settings).toEqual({ defaultCurrency: "PLN" });
  });

  it("A commit with settings changes the default currency", () => {
    const next = plannerReducer(stateOf(), {
      type: "groups/commit",
      groups: [],
      settings: { defaultCurrency: "USD" },
    });

    expect(next.settings).toEqual({ defaultCurrency: "USD" });
  });

  it("Saving the template touches nothing else", () => {
    const before = stateOf();
    const next = plannerReducer(before, {
      type: "template/save",
      template: "New {{month}}",
    });

    expect(next.template).toBe("New {{month}}");
    expect(next.groups).toBe(before.groups);
    expect(next.settings).toBe(before.settings);
    expect(next.pending).toBe("write");
  });

  it("Clearing empties the planner and asks for a clear, not a write", () => {
    const next = plannerReducer(stateOf(), { type: "data/clear" });

    expect(next.groups).toEqual([]);
    expect(next.settings).toEqual({ defaultCurrency: "UAH" });
    // "clear" removes the keys. Asking for a write here would put an empty
    // planner back into storage, so a cleared planner would no longer be
    // indistinguishable from one that was never used.
    expect(next.pending).toBe("clear");
  });

  it("Clearing keeps the template, because clearing storage keeps its key", () => {
    // DEF-013: `clearStoredData` removes two of the three keys. State has to
    // agree with storage — dropping the template here would show the default
    // in the editor until the next reload. Batch 3.4b changes both together.
    expect(plannerReducer(stateOf(), { type: "data/clear" }).template).toBe(
      "Lessons for {{month}}.",
    );
  });

  it("A load error survives every action", () => {
    const broken = stateOf({ loadError: "Bad token" });

    for (const action of [
      { type: "groups/commit", groups: [] },
      { type: "template/save", template: "x" },
      { type: "data/clear" },
      { type: "storage/flushed" },
    ] satisfies Action[]) {
      expect(plannerReducer(broken, action).loadError).toBe("Bad token");
    }
  });

  it("The reducer does not mutate the state it is given", () => {
    const before = Object.freeze(stateOf());

    // Frozen, so a mutating reducer throws here rather than passing every
    // assertion above and corrupting a later render.
    expect(() =>
      plannerReducer(before, { type: "groups/commit", groups: [] }),
    ).not.toThrow();
    expect(before.groups).toEqual([groupOf("Monday Beginners")]);
  });

  /**
   * The whole transition table, including the cells that must do nothing.
   *
   * `storage/flushed` is the only event that returns to "none", and it is sent
   * by the subscriber once it has written. Without that edge the effect would
   * fire again on the next unrelated render.
   */
  it("Every state and event pair leads where the table says", () => {
    const table: { from: Pending; action: Action; to: Pending }[] = [
      {
        from: "none",
        action: { type: "groups/commit", groups: [] },
        to: "write",
      },
      {
        from: "none",
        action: { type: "template/save", template: "x" },
        to: "write",
      },
      { from: "none", action: { type: "data/clear" }, to: "clear" },
      { from: "none", action: { type: "storage/flushed" }, to: "none" },
      {
        from: "write",
        action: { type: "groups/commit", groups: [] },
        to: "write",
      },
      { from: "write", action: { type: "data/clear" }, to: "clear" },
      { from: "write", action: { type: "storage/flushed" }, to: "none" },
      // A commit while a clear is still pending wins: the user did something
      // new, and the keys it writes are the ones the clear would have removed.
      {
        from: "clear",
        action: { type: "groups/commit", groups: [] },
        to: "write",
      },
      {
        from: "clear",
        action: { type: "template/save", template: "x" },
        to: "write",
      },
      { from: "clear", action: { type: "storage/flushed" }, to: "none" },
    ];

    for (const row of table) {
      expect(
        plannerReducer(stateOf({ pending: row.from }), row.action).pending,
      ).toBe(row.to);
    }
  });
});

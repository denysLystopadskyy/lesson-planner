import { describe, expect, it } from "vitest";
import {
  initialState,
  plannerReducer,
  type Action,
  type LoadedData,
  type Pending,
  type PlannerState,
  type SyncState,
  type SyncStatus,
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

  it("Clearing drops the template, because clearing storage drops its key", () => {
    // DEF-013, fixed in batch 3.4b. State and storage have to agree: keeping
    // the template here would show the old message in the editor until the
    // next reload, after the app had said it was gone.
    expect(
      plannerReducer(stateOf(), { type: "data/clear" }).template,
    ).toBeNull();
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

/**
 * Test condition C3 of batch 6.2: the sync status machine.
 *
 * ISTQB technique: state transition testing, **all transitions** (risk R4 is
 * high). Five states and five events give 25 cells. Every cell is asserted,
 * including the 15 that must change nothing: an answer that arrives when no
 * request is in flight is a stale answer, and acting on it would claim a save
 * that did not happen.
 */
describe("C3 sync status — state transition testing, all transitions", () => {
  const document = {
    body: [],
    schemaVersion: 1,
    updatedAt: "2026-06-15T09:00:00.000Z",
  };
  const events: Record<string, Action> = {
    saving: { type: "remote/saving" },
    saved: { type: "remote/saved", at: "2026-06-15T10:00:00.000Z" },
    failed: { type: "remote/failed", problem: { kind: "network" } },
    conflict: { type: "remote/conflict", key: "data", document },
    resolved: { type: "remote/resolved" },
  };

  // from → event → to. "=" means the event is ignored in that state.
  const table: Record<SyncStatus, Record<string, SyncStatus | "=">> = {
    off: {
      saving: "saving",
      saved: "=",
      failed: "=",
      conflict: "=",
      resolved: "=",
    },
    saving: {
      saving: "saving",
      saved: "saved",
      failed: "retrying",
      conflict: "conflict",
      resolved: "=",
    },
    saved: {
      saving: "saving",
      saved: "=",
      failed: "=",
      conflict: "=",
      resolved: "=",
    },
    retrying: {
      saving: "saving",
      saved: "=",
      failed: "=",
      conflict: "=",
      resolved: "=",
    },
    conflict: {
      saving: "=",
      saved: "=",
      failed: "=",
      conflict: "=",
      resolved: "saved",
    },
  };

  const syncOf = (status: SyncStatus): SyncState => ({
    status,
    savedAt: "2026-06-15T08:00:00.000Z",
    conflict:
      status === "conflict" ? { key: "settings", document: null } : null,
    problem: status === "retrying" ? { kind: "network" } : null,
  });

  for (const [from, row] of Object.entries(table) as [
    SyncStatus,
    Record<string, SyncStatus | "=">,
  ][]) {
    for (const [event, to] of Object.entries(row)) {
      const action = events[event];
      if (action === undefined) throw new Error(`no event ${event}`);
      it(`${from} + ${event} → ${to === "=" ? `${from} (ignored)` : to}`, () => {
        const before = stateOf({ sync: syncOf(from) });
        const after = plannerReducer(before, action);

        if (to === "=") {
          expect(after.sync).toEqual(before.sync);
        } else {
          expect(after.sync.status).toBe(to);
        }
      });
    }
  }

  it("off → saving → saved records the server's stamp", () => {
    let state = stateOf();
    state = plannerReducer(state, events["saving"] as Action);
    state = plannerReducer(state, events["saved"] as Action);

    expect(state.sync).toEqual({
      status: "saved",
      savedAt: "2026-06-15T10:00:00.000Z",
      conflict: null,
      problem: null,
    });
  });

  it("saving → retrying → saving keeps the problem until a save succeeds", () => {
    let state = stateOf({ sync: syncOf("saving") });
    state = plannerReducer(state, {
      type: "remote/failed",
      problem: { kind: "sign-in" },
    });
    expect(state.sync.problem).toEqual({ kind: "sign-in" });

    // The retry starts: still the same problem, so the prompt stays up.
    state = plannerReducer(state, events["saving"] as Action);
    expect(state.sync).toMatchObject({
      status: "saving",
      problem: { kind: "sign-in" },
    });

    state = plannerReducer(state, events["saved"] as Action);
    expect(state.sync.problem).toBeNull();
  });

  it("saving → conflict → resolved opens and then closes the conflict", () => {
    let state = stateOf({ sync: syncOf("saving") });
    state = plannerReducer(state, events["conflict"] as Action);
    expect(state.sync.conflict).toEqual({ key: "data", document });

    state = plannerReducer(state, events["resolved"] as Action);
    expect(state.sync).toMatchObject({ status: "saved", conflict: null });
  });

  it("A failure keeps the stamp of the last real save", () => {
    const state = plannerReducer(
      stateOf({ sync: syncOf("saving") }),
      events["failed"] as Action,
    );

    expect(state.sync.savedAt).toBe("2026-06-15T08:00:00.000Z");
  });

  it("No remote action changes the planner's data or the local directive", () => {
    const before = stateOf({ pending: "write", sync: syncOf("saving") });
    for (const action of Object.values(events)) {
      const after = plannerReducer(before, action);
      expect(after.groups).toBe(before.groups);
      expect(after.settings).toBe(before.settings);
      expect(after.template).toBe(before.template);
      expect(after.pending).toBe("write");
    }
  });

  it("No local action changes the sync state", () => {
    const before = stateOf({ sync: syncOf("retrying") });
    const locals: Action[] = [
      { type: "groups/commit", groups: [] },
      { type: "template/save", template: "x" },
      { type: "data/clear" },
      { type: "storage/flushed" },
      { type: "storage/failed", error: "full" },
    ];
    for (const action of locals) {
      expect(plannerReducer(before, action).sync).toBe(before.sync);
    }
  });

  it("The initial state is off, with the stamp it was given", () => {
    expect(initialState(loaded()).sync).toEqual({
      status: "off",
      savedAt: null,
      conflict: null,
      problem: null,
    });
    expect(
      initialState(loaded(), "2026-06-15T07:00:00.000Z").sync.savedAt,
    ).toBe("2026-06-15T07:00:00.000Z");
  });
});

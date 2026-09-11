import type { LoadResult } from "./storage";
import { DEFAULT_CURRENCY, type Group, type Settings } from "./types";

/**
 * The planner's state, as a reducer.
 *
 * Three per-domain reducers, one for each stored key, composed into one
 * `plannerReducer` — see
 * .claude/context/state-management.md, which chose React's own tools over a
 * state library and records the triggers that would change that. A
 * `useReducer` reducer has the same `(state, action) => state` shape as a Redux
 * Toolkit slice reducer, so this file is the part that would port over almost
 * verbatim if a trigger ever fires.
 *
 * **Nothing here touches `localStorage` or React**, so every transition below
 * is a unit test rather than a browser test. What the browser has to prove is
 * that the bytes reaching storage are still the legacy shapes, and that is the
 * storage-contract spec's job.
 *
 * ## Why the state carries a `pending` field
 *
 * Persistence is a subscriber: one effect in `StoreProvider` reacts to state
 * changes and writes the keys. The subscriber cannot decide what to do by
 * comparing state with storage, because after "Clear all data" the two
 * legitimately disagree — state is an empty planner and the keys are **gone**,
 * and a subscriber that reconciled the difference would write them straight
 * back. So the reducer says what it wants instead: `write`, `clear`, or
 * nothing at all.
 *
 * `none` is also the initial value, which is what keeps the app from writing on
 * mount. That matters more than it looks: a mount-time write over the corrupt
 * value that `loadError` reports would destroy the data the user came to
 * recover, and no existing spec would notice.
 */

/** What the persistence subscriber must do next. */
export type Pending = "none" | "write" | "clear";

export type PlannerState = {
  groups: Group[];
  settings: Settings;
  /** The stored template, or null when the key is absent. */
  template: string | null;
  /** Set when the stored groups could not be read at all — DEF-001. */
  loadError: string | null;
  /**
   * What had to be mended to make the stored data usable — DEF-021. Readable
   * data with a repaired shape is not an error: the app works, and the user is
   * told what changed underneath them.
   */
  loadRepairs: string[];
  /** Set when the browser refused a write — DEF-022. */
  writeError: string | null;
  pending: Pending;
};

export type Action =
  /** Replaces the groups, and the settings when the currency changed too. */
  | { type: "groups/commit"; groups: Group[]; settings?: Settings }
  | { type: "template/save"; template: string }
  | { type: "data/clear" }
  /** Sent by the subscriber once it has written; nothing else sends it. */
  | { type: "storage/flushed" }
  /** Sent by the subscriber when the browser refused the write — DEF-022. */
  | { type: "storage/failed"; error: string };

const groupsReducer = (groups: Group[], action: Action): Group[] => {
  switch (action.type) {
    case "groups/commit":
      return action.groups;
    case "data/clear":
      return [];
    default:
      return groups;
  }
};

const settingsReducer = (settings: Settings, action: Action): Settings => {
  switch (action.type) {
    case "groups/commit":
      // A group edit carries settings only when the currency select changed,
      // exactly as the legacy app writes the settings key only then.
      return action.settings ?? settings;
    case "data/clear":
      return { defaultCurrency: DEFAULT_CURRENCY };
    default:
      return settings;
  }
};

const templateReducer = (
  template: string | null,
  action: Action,
): string | null => {
  switch (action.type) {
    case "template/save":
      return action.template;
    // "Clear all data" deliberately does **not** drop the template, because
    // `clearStoredData` leaves the key behind (DEF-013, pinned and fixed in
    // batch 3.4b). State has to agree with storage: dropping it here would
    // show the default template in the editor until the next reload, which is
    // neither the current behaviour nor the fixed one.
    default:
      return template;
  }
};

const pendingReducer = (pending: Pending, action: Action): Pending => {
  switch (action.type) {
    case "groups/commit":
    case "template/save":
      return "write";
    case "data/clear":
      return "clear";
    case "storage/flushed":
    // A refused write clears the request too. Leaving it pending would re-run
    // the subscriber on the next state change and fail again, and a full quota
    // does not empty itself — the user has to act, so tell them once.
    case "storage/failed":
      return "none";
  }
};

const writeErrorReducer = (
  writeError: string | null,
  action: Action,
): string | null => {
  switch (action.type) {
    case "storage/failed":
      return action.error;
    // A write that goes through clears the alarm: whatever was refused before,
    // what is on screen is now saved.
    case "storage/flushed":
      return null;
    default:
      return writeError;
  }
};

export const plannerReducer = (
  state: PlannerState,
  action: Action,
): PlannerState => ({
  groups: groupsReducer(state.groups, action),
  settings: settingsReducer(state.settings, action),
  template: templateReducer(state.template, action),
  // Both describe the load, so no action changes either. A commit over corrupt
  // storage writes good data but leaves the banner up for the rest of the
  // session, which is what the app did before the store and is not this
  // batch's decision to change.
  loadError: state.loadError,
  loadRepairs: state.loadRepairs,
  writeError: writeErrorReducer(state.writeError, action),
  pending: pendingReducer(state.pending, action),
});

/** What the three keys read back as, before any of it becomes state. */
export type LoadedData = {
  groups: LoadResult<Group[]>;
  settings: LoadResult<Settings>;
  template: string | null;
};

/**
 * The starting state.
 *
 * A bad `groups` value becomes an empty planner **and** a `loadError`, so the
 * app can say so instead of going inert (DEF-001).
 *
 * A value that loaded but had to be mended is a third case, added in batch 3.1:
 * it is not an error, so there is no banner replacing the app, but it is not
 * nothing either. Changing what the user stored without saying so is the same
 * sin as failing to store it, so the repairs travel into state and are shown.
 * Settings repairs are folded in here too — the fallback that used to be silent
 * now says it happened.
 */
export const initialState = (loaded: LoadedData): PlannerState => ({
  groups: loaded.groups.ok ? loaded.groups.value : [],
  settings: loaded.settings.ok
    ? loaded.settings.value
    : { defaultCurrency: DEFAULT_CURRENCY },
  template: loaded.template,
  loadError: loaded.groups.ok ? null : loaded.groups.error,
  loadRepairs: [
    ...(loaded.groups.ok ? (loaded.groups.repairs ?? []) : []),
    ...(loaded.settings.ok ? (loaded.settings.repairs ?? []) : []),
  ],
  writeError: null,
  pending: "none",
});

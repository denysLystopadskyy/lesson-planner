import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ActionDispatch,
  type ReactNode,
} from "react";
import {
  clearStoredData,
  loadGroups,
  loadSettings,
  loadTemplate,
  requestPersistentStorage,
  saveGroups,
  saveSettings,
  saveTemplate,
  type WriteResult,
} from "./storage";
import {
  initialState,
  plannerReducer,
  type Action,
  type PlannerState,
} from "./store";

/**
 * The one provider at the app root, and the hooks that read through it.
 *
 * This file is the only place that knows the store is React's: `store.ts` is
 * pure, and the components below it ask for `useGroups()` rather than for a
 * context. That split is what keeps the Redux Toolkit migration in
 * .claude/context/state-management.md mechanical — the reducers port as slice
 * reducers, and this file is replaced by a `Provider` plus `useSelector`.
 *
 * State and dispatch are two contexts on purpose. Dispatch is stable for the
 * life of the app, so a component that only dispatches — the toolbar — does not
 * re-render when the groups change.
 *
 * Plain `useContext` re-renders every consumer of the state context on every
 * change. That is the right trade at this size: one screen, a handful of
 * groups, no list long enough to notice. Splitting state into narrower contexts
 * or reaching for a subscription library is what trigger 1 in
 * state-management.md is for.
 */

const StateContext = createContext<PlannerState | null>(null);
const DispatchContext = createContext<ActionDispatch<[Action]> | null>(null);

/** Reads the three keys once, on the first render and never again. */
const loadInitialState = (): PlannerState =>
  initialState({
    groups: loadGroups(),
    settings: loadSettings(),
    template: loadTemplate(),
  });

/**
 * Writes the three keys, stopping at the first refusal.
 *
 * Stopping matters: the keys are written in order and a quota that refuses the
 * groups will refuse the rest, so carrying on would collect three copies of one
 * problem. The first message is the one worth showing.
 */
const writeEverything = (state: PlannerState): WriteResult => {
  const groups = saveGroups(state.groups);
  if (!groups.ok) return groups;
  const settings = saveSettings(state.settings);
  if (!settings.ok) return settings;
  // Only when there is one. Writing "" would turn "no template stored, use the
  // default" into "an empty template is stored".
  if (state.template === null) return { ok: true };
  return saveTemplate(state.template);
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(
    plannerReducer,
    undefined,
    loadInitialState,
  );

  // Ask once, on mount, that the browser not evict this origin under storage
  // pressure. Everything the teacher has is in `localStorage` and nowhere
  // else, so eviction is total loss. The answer is not acted on: a refusal
  // changes nothing the app can do about it, and the call never throws.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // The persistence subscriber. It writes what the reducer asked for and
  // nothing else — in particular it does not write on mount, because
  // `pending` starts at "none". A mount-time write would replace a corrupt
  // stored value with an empty planner, and the user who came to recover that
  // data would find it gone.
  //
  // Every write is checked. Before batch 3.1 these calls were made bare and a
  // browser that refused one threw out of the effect, so the edit was lost and
  // nothing said so (DEF-022). The result now decides which action goes back.
  useEffect(() => {
    if (state.pending === "none") return;
    const result: WriteResult =
      state.pending === "clear" ? clearStoredData() : writeEverything(state);
    dispatch(
      result.ok
        ? { type: "storage/flushed" }
        : { type: "storage/failed", error: result.error },
    );
  }, [state]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};

const usePlannerState = (): PlannerState => {
  const state = useContext(StateContext);
  if (state === null) {
    throw new Error("A planner hook was used outside StoreProvider");
  }
  return state;
};

export const useGroups = (): PlannerState["groups"] => usePlannerState().groups;

export const useSettings = (): PlannerState["settings"] =>
  usePlannerState().settings;

/** The stored template, or null when the key is absent. */
export const useTemplate = (): PlannerState["template"] =>
  usePlannerState().template;

/** Non-null only when the stored groups could not be parsed — DEF-001. */
export const useLoadError = (): PlannerState["loadError"] =>
  usePlannerState().loadError;

/** The mends made to stored data while loading it — DEF-021. */
export const useLoadRepairs = (): PlannerState["loadRepairs"] =>
  usePlannerState().loadRepairs;

/** Non-null when the browser refused to save — DEF-022. */
export const useWriteError = (): PlannerState["writeError"] =>
  usePlannerState().writeError;

export const usePlannerDispatch = (): ActionDispatch<[Action]> => {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) {
    throw new Error("usePlannerDispatch was used outside StoreProvider");
  }
  return dispatch;
};

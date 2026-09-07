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
  saveGroups,
  saveSettings,
  saveTemplate,
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

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(
    plannerReducer,
    undefined,
    loadInitialState,
  );

  // The persistence subscriber. It writes what the reducer asked for and
  // nothing else — in particular it does not write on mount, because
  // `pending` starts at "none". A mount-time write would replace a corrupt
  // stored value with an empty planner, and the user who came to recover that
  // data would find it gone.
  useEffect(() => {
    if (state.pending === "none") return;
    if (state.pending === "clear") {
      clearStoredData();
    } else {
      saveGroups(state.groups);
      saveSettings(state.settings);
      // Only when there is one. Writing "" would turn "no template stored, use
      // the default" into "an empty template is stored".
      if (state.template !== null) saveTemplate(state.template);
    }
    dispatch({ type: "storage/flushed" });
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

export const usePlannerDispatch = (): ActionDispatch<[Action]> => {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) {
    throw new Error("usePlannerDispatch was used outside StoreProvider");
  }
  return dispatch;
};

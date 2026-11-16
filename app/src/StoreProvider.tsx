import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ActionDispatch,
  type ReactNode,
} from "react";
import {
  ApiError,
  isRetryable,
  putDocument,
  withToken,
  type DocumentKey,
  type GetToken,
  type RemoteDocument,
  type ServerDocuments,
} from "./documents-api";
import {
  changedKeys,
  documentsOf,
  loadedFromServer,
  retryDelayMs,
  savedAtOf,
  type PlannerDocuments,
} from "./remote-sync";
import {
  clearStoredData,
  loadGroups,
  loadSettings,
  loadTemplate,
  requestPersistentStorage,
  saveGroups,
  saveSettings,
  removeTemplate,
  saveTemplate,
  type WriteResult,
} from "./storage";
import {
  initialState,
  plannerReducer,
  type Action,
  type PlannerState,
  type SyncProblem,
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
 * **Two persistence modes** (plan batch 6.2, state-management.md "Decided on
 * 2026-11-15"). `local` is the subscriber below, unchanged since batch 3.1: it
 * writes the three `localStorage` keys. `remote` writes **no** planner key to
 * `localStorage`, ever; it saves the changed documents to the API instead. The
 * mode is fixed for the provider's life — `RemoteGate` mounts a new provider
 * to change it — so neither path ever sees the other's state.
 *
 * Plain `useContext` re-renders every consumer of the state context on every
 * change. That is the right trade at this size: one screen, a handful of
 * groups, no list long enough to notice. Splitting state into narrower contexts
 * or reaching for a subscription library is what trigger 1 in
 * state-management.md is for.
 */

const StateContext = createContext<PlannerState | null>(null);
const DispatchContext = createContext<ActionDispatch<[Action]> | null>(null);

/** How the planner is kept. Fixed for the life of one provider. */
export type Persistence =
  | { kind: "local" }
  | {
      kind: "remote";
      getToken: GetToken;
      /** What `GET /api/documents` answered, before the first paint. */
      initial: ServerDocuments;
    };

/** The two answers to a conflict. Remote mode only. */
export type RemoteControls = {
  /** Send this screen again, over the server's newer version, knowingly. */
  keepThisScreen: () => void;
  /** Put the server's version of the conflicting document on screen. */
  useSavedVersion: () => void;
};

/** `null` in local mode, which is how a component tells the modes apart. */
const RemoteContext = createContext<RemoteControls | null>(null);

/** Reads the three keys once, on the first render and never again. */
const loadInitialState = (persistence: Persistence): PlannerState =>
  persistence.kind === "remote"
    ? initialState(
        loadedFromServer(persistence.initial),
        savedAtOf(persistence.initial),
      )
    : initialState({
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
  // `null` means no template is stored, so the key is removed rather than
  // skipped. Skipping was right while nothing could turn a stored template
  // back into none; restoring a backup that has none can (batch 3.3), and a
  // skipped write would leave the old template behind after the restore.
  // Writing "" instead is not an option — that is a stored empty template,
  // which is a different state.
  if (state.template === null) return removeTemplate();
  return saveTemplate(state.template);
};

/** How long an edit waits for the next one before it is sent. */
const DEBOUNCE_MS = 1000;

/** What a failed save means for the teacher; see `SyncProblem` in `store.ts`. */
const problemOf = (error: unknown): SyncProblem => {
  if (error instanceof ApiError && error.status === 401) {
    return { kind: "sign-in" };
  }
  if (error instanceof ApiError && !isRetryable(error)) {
    return { kind: "refused", message: error.message };
  }
  // No answer, a server error, or the auth server unreachable: all worth
  // trying again.
  return { kind: "network" };
};

/** An account with no rows, to load one document on its own. */
const noDocuments: ServerDocuments = {
  data: null,
  settings: null,
  template: null,
};

/**
 * Remote persistence: the save loop, outside React.
 *
 * A plain object, not a set of effects, because its state — what the server
 * last took, the timers, whether a request is out — must not cause renders,
 * and a request that resolves after a render must still see the newest edit.
 * React reaches it through `observe` (every state change), and `start` and
 * `stop` (mount and unmount, twice in `StrictMode`).
 *
 * **Trigger 2 of state-management.md** asks whether this needs middleware. It
 * does not: every decision here reads the state *after* the reducer ran, which
 * a subscriber sees, and nothing has to intercept, delay or rewrite an action
 * before it reaches the reducer. The answer is recorded in state-management.md.
 *
 * The rules, from the plan (batch 6.2) and the owner (2026-11-15):
 *
 * - an edit waits `DEBOUNCE_MS` for the next one, then the changed documents
 *   are sent, one `PUT` each, in key order;
 * - each `PUT` names the version it replaces (`baseUpdatedAt`), and a 409
 *   stops everything until a person chooses;
 * - a failure keeps the edit, and is retried after `retryDelayMs` and at once
 *   on the `online` event — except a refusal (400, 403, 413), which the same
 *   body would meet again, so it waits for the next edit;
 * - a 401 gets one fresh token and one retry (`withToken`), then she is asked
 *   to sign in, and the timer keeps trying;
 * - `beforeunload` warns while the screen holds anything the server has not
 *   taken: a debounce, a request in flight, a retry, a conflict.
 */
const createRemoteSync = (
  getToken: GetToken,
  dispatch: ActionDispatch<[Action]>,
  initial: ServerDocuments,
  first: PlannerState,
) => {
  let state = first;
  // What the server holds, as the bodies on screen when it took them. Starting
  // from the screen (not the raw server body) means a value the loader had to
  // mend is not sent back on mount: nothing is written until she edits.
  const savedBodies: PlannerDocuments = { ...documentsOf(first) };
  const stamps: Record<DocumentKey, string | null> = {
    data: initial.data?.updatedAt ?? null,
    settings: initial.settings?.updatedAt ?? null,
    template: initial.template?.updatedAt ?? null,
  };
  let conflict: { key: DocumentKey; document: RemoteDocument | null } | null =
    null;
  let inFlight = false;
  let failures = 0;
  let running = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const stillRunning = () => running;

  const pending = (): DocumentKey[] =>
    changedKeys(documentsOf(state), savedBodies);

  const clearTimers = () => {
    if (debounce !== null) clearTimeout(debounce);
    if (retry !== null) clearTimeout(retry);
    debounce = null;
    retry = null;
  };

  const scheduleRetry = () => {
    retry = setTimeout(() => {
      retry = null;
      void flush();
    }, retryDelayMs(failures));
    failures += 1;
  };

  const flush = async (): Promise<void> => {
    if (!running || inFlight || conflict !== null) return;
    if (pending().length === 0) return;
    clearTimers();
    inFlight = true;
    if (state.sync.status !== "saving") dispatch({ type: "remote/saving" });

    let savedAt: string | null = null;
    try {
      // Again until nothing is left, so an edit made while a request was out
      // goes in the same run instead of being reported as saved.
      for (let keys = pending(); keys.length > 0; keys = pending()) {
        for (const key of keys) {
          const body = documentsOf(state)[key];
          const result = await withToken(getToken, (token) =>
            putDocument(token, key, body, stamps[key]),
          );
          if (result.kind === "conflict") {
            conflict = { key, document: result.document };
            dispatch({
              type: "remote/conflict",
              key,
              document: result.document,
            });
            return;
          }
          savedBodies[key] = body;
          stamps[key] = result.updatedAt;
          savedAt = result.updatedAt;
        }
      }
      failures = 0;
      // Only now: the indicator says "Saved" after the server has answered,
      // never before (fault seeding, batch 6.2).
      if (savedAt !== null) dispatch({ type: "remote/saved", at: savedAt });
    } catch (error) {
      const problem = problemOf(error);
      dispatch({ type: "remote/failed", problem });
      // `stillRunning()`, not `running`: the provider may have unmounted while
      // the request was out, and a timer must not outlive it.
      if (problem.kind !== "refused" && stillRunning()) scheduleRetry();
    } finally {
      inFlight = false;
    }
  };

  /**
   * An edit the server has not taken: wait for the next one, then send.
   *
   * The status turns to `saving` at once, not when the request leaves. For
   * the length of the debounce the screen holds an unsaved edit, and an
   * indicator still saying "Saved" then would be a claim the server has not
   * backed (risk R4).
   */
  const schedule = () => {
    if (!running || conflict !== null || inFlight) return;
    if (pending().length === 0) return;
    if (debounce !== null) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      void flush();
    }, DEBOUNCE_MS);
    if (state.sync.status !== "saving") dispatch({ type: "remote/saving" });
  };

  const onOnline = () => {
    if (retry !== null) clearTimeout(retry);
    retry = null;
    void flush();
  };

  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    // The screen and the server disagree: whatever the reason, closing now
    // loses the difference.
    if (pending().length > 0) event.preventDefault();
  };

  return {
    observe(next: PlannerState) {
      // Only an edit restarts the debounce. The save loop's own actions change
      // `sync` and nothing else, and must not push the save further away.
      const edited =
        next.groups !== state.groups ||
        next.settings !== state.settings ||
        next.template !== state.template;
      state = next;
      if (edited) schedule();
    },
    start() {
      running = true;
      window.addEventListener("online", onOnline);
      window.addEventListener("beforeunload", onBeforeUnload);
      schedule();
    },
    stop() {
      running = false;
      clearTimers();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    },
    controls: {
      keepThisScreen() {
        if (conflict === null) return;
        // The server's version becomes the base, so the next PUT replaces it
        // on purpose. A third device saving in between is a new 409.
        stamps[conflict.key] = conflict.document?.updatedAt ?? null;
        conflict = null;
        dispatch({ type: "remote/resolved" });
        void flush();
      },
      useSavedVersion() {
        if (conflict === null) return;
        const { key, document } = conflict;
        const loaded = loadedFromServer({ ...noDocuments, [key]: document });
        const groups =
          key === "data"
            ? loaded.groups.ok
              ? loaded.groups.value
              : []
            : state.groups;
        const settings =
          key === "settings"
            ? loaded.settings.ok
              ? loaded.settings.value
              : state.settings
            : state.settings;
        const template = key === "template" ? loaded.template : state.template;
        // The screen now shows what the server holds for this key (an empty
        // value when the row is gone), so that is the saved body. The other
        // keys are sent as usual if they differ.
        savedBodies[key] = documentsOf({ groups, settings, template })[key];
        stamps[key] = document?.updatedAt ?? null;
        conflict = null;
        dispatch({ type: "backup/restore", groups, settings, template });
        dispatch({ type: "remote/resolved" });
      },
    } satisfies RemoteControls,
  };
};

export const StoreProvider = ({
  persistence = { kind: "local" },
  children,
}: {
  persistence?: Persistence;
  children: ReactNode;
}) => {
  const [state, dispatch] = useReducer(
    plannerReducer,
    persistence,
    loadInitialState,
  );
  // Made once, with the first state. `persistence` cannot change for the
  // life of this provider (see the file comment), so neither can this.
  const [remote] = useState(() =>
    persistence.kind === "remote"
      ? createRemoteSync(
          persistence.getToken,
          dispatch,
          persistence.initial,
          state,
        )
      : null,
  );

  // Ask once, on mount, that the browser not evict this origin under storage
  // pressure. Everything the teacher has is in `localStorage` and nowhere
  // else, so eviction is total loss. The answer is not acted on: a refusal
  // changes nothing the app can do about it, and the call never throws.
  // Remote mode keeps nothing there, so it does not ask.
  useEffect(() => {
    if (remote === null) void requestPersistentStorage();
  }, [remote]);

  // The persistence subscriber. It writes what the reducer asked for and
  // nothing else — in particular it does not write on mount, because
  // `pending` starts at "none". A mount-time write would replace a corrupt
  // stored value with an empty planner, and the user who came to recover that
  // data would find it gone.
  //
  // Every write is checked. Before batch 3.1 these calls were made bare and a
  // browser that refused one threw out of the effect, so the edit was lost and
  // nothing said so (DEF-022). The result now decides which action goes back.
  //
  // Local mode only. In remote mode `pending` is still set by the reducer and
  // read by nobody: the rule "remote mode writes no planner key" is kept here,
  // by never calling the storage adapter.
  useEffect(() => {
    if (remote !== null) return;
    if (state.pending === "none") return;
    const result: WriteResult =
      state.pending === "clear" ? clearStoredData() : writeEverything(state);
    dispatch(
      result.ok
        ? { type: "storage/flushed" }
        : { type: "storage/failed", error: result.error },
    );
  }, [remote, state]);

  // Remote mode: hand every state to the save loop, and run it while mounted.
  useEffect(() => {
    remote?.observe(state);
  }, [remote, state]);
  useEffect(() => {
    if (remote === null) return;
    remote.start();
    return () => {
      remote.stop();
    };
  }, [remote]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <RemoteContext.Provider value={remote?.controls ?? null}>
          {children}
        </RemoteContext.Provider>
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

/** Remote mode's save status; `off` for good in local mode. */
export const useSync = (): PlannerState["sync"] => usePlannerState().sync;

/** The conflict answers in remote mode, or `null` in local mode. */
export const useRemoteControls = (): RemoteControls | null =>
  useContext(RemoteContext);

export const usePlannerDispatch = (): ActionDispatch<[Action]> => {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) {
    throw new Error("usePlannerDispatch was used outside StoreProvider");
  }
  return dispatch;
};

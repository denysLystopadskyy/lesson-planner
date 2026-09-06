import { useCallback, useState } from "react";
import {
  clearStoredData,
  loadGroups,
  loadSettings,
  saveGroups,
  saveSettings,
} from "./storage";
import { DEFAULT_CURRENCY, type Group, type Settings } from "./types";

/**
 * The planner's data, loaded once and written back on every change.
 *
 * The legacy app keeps its state on a global `App.state` object and calls
 * `storage.save()` from each handler. Here the state is React's and every
 * mutation goes through `commit`, so a write cannot be forgotten — which is
 * half of what makes DEF-008 possible in the legacy app, where the price input
 * mutates the group but never saves.
 */
export const useLocalGroups = () => {
  const [initial] = useState(() => ({
    groups: loadGroups(),
    settings: loadSettings(),
  }));

  const [groups, setGroups] = useState<Group[]>(
    initial.groups.ok ? initial.groups.value : [],
  );
  const [settings, setSettings] = useState<Settings>(
    initial.settings.ok
      ? initial.settings.value
      : { defaultCurrency: DEFAULT_CURRENCY },
  );

  const commit = useCallback((next: Group[], nextSettings?: Settings) => {
    setGroups(next);
    saveGroups(next);
    if (nextSettings !== undefined) {
      setSettings(nextSettings);
      saveSettings(nextSettings);
    }
  }, []);

  /**
   * "Clear all data". Removes the keys rather than writing empty ones, so a
   * cleared planner is indistinguishable from one that was never used — the
   * legacy behaviour, template key included (DEF-013, see `storage.ts`).
   */
  const clearAll = useCallback(() => {
    setGroups([]);
    setSettings({ defaultCurrency: DEFAULT_CURRENCY });
    clearStoredData();
  }, []);

  return {
    groups,
    settings,
    commit,
    clearAll,
    /** Present only when stored data could not be parsed — see DEF-001. */
    loadError: initial.groups.ok ? null : initial.groups.error,
  };
};

import { useCallback, useEffect, useState } from "react";
import { MAIN, formatRoute, parseRoute, type Route } from "./route";

/**
 * The current route, and the two ways to change it.
 *
 * `go` pushes a history entry, so the browser's Back button closes a dialog —
 * which is what a phone's back gesture does, and what the plan asks for.
 * `replace` swaps the current entry instead, for a move that should not be
 * something to go back to: saving a new group lands on that group, and Back
 * from there should return to the list rather than to the empty add form.
 *
 * `close` is the interesting one. Going back is right when this app pushed the
 * entry, and wrong when the dialog *was* the entry — someone opening a shared
 * `#/group/1` link would be sent out of the app entirely. So a pushed entry is
 * marked, and only a marked entry is closed by going back.
 */

type Navigation = {
  route: Route;
  go: (next: Route) => void;
  replace: (next: Route) => void;
  close: () => void;
};

const PUSHED = { pushedByApp: true };

export const useHashRoute = (): Navigation => {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseRoute(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const go = useCallback((next: Route) => {
    window.history.pushState(PUSHED, "", formatRoute(next));
    setRoute(next);
  }, []);

  const replace = useCallback((next: Route) => {
    // Keeps whatever mark the current entry had: replacing the add form with
    // the saved group leaves an entry Back should still close.
    window.history.replaceState(window.history.state, "", formatRoute(next));
    setRoute(next);
  }, []);

  const close = useCallback(() => {
    const state: unknown = window.history.state;
    const pushedByApp =
      typeof state === "object" &&
      state !== null &&
      "pushedByApp" in state &&
      state.pushedByApp === true;

    if (pushedByApp) {
      window.history.back();
      return;
    }
    // The dialog was the entry point, so there is nothing of ours to go back
    // to. Replace rather than push, or Back would reopen the dialog.
    window.history.replaceState(null, "", formatRoute(MAIN));
    setRoute(MAIN);
  }, []);

  return { route, go, replace, close };
};

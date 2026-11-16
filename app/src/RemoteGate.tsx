import { useEffect, useState, type ReactNode } from "react";
import { getAccessToken, useSession } from "./auth-client";
import {
  fetchDocuments,
  withToken,
  type ServerDocuments,
} from "./documents-api";
import { StoreProvider } from "./StoreProvider";

/**
 * Chooses the persistence mode, and loads the account before the first paint
 * — plan batch 6.2 (state-management.md, "Decided on 2026-11-15").
 *
 * - **No auth URL** (the GitHub Pages build), or an auth server that cannot
 *   answer: local mode at once, exactly as before.
 * - **The session is still being read:** "Loading your planner…". Painting
 *   the local planner first would show a signed-in teacher a planner that is
 *   not hers, and let her edit it.
 * - **Signed in:** "Loading your planner…" until `GET /api/documents`
 *   answers, then the store in remote mode with the server's data as it is.
 *   The choice between local and server data arrives in batch 6.3.
 * - **Signed out:** local mode, as today. The sign-in screen for an empty
 *   browser arrives in batch 6.3.
 *
 * **Once remote, it stays remote** for the life of the page. If the session
 * ends somewhere else, the edits on screen must not be dropped with it (review
 * focus 5): the next save is refused, she is asked to sign in, and the edit
 * stays. Her own **Sign out** reloads the page (`App.tsx`), which is the one
 * way back to local mode.
 */

type Phase =
  | { kind: "waiting" }
  | { kind: "local" }
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "remote"; initial: ServerDocuments };

/** Where the session points, before any loading is done. */
const wantedMode = (session: ReturnType<typeof useSession>) => {
  if (session.isUnavailable) return "local";
  if (session.isPending) return "wait";
  return session.isSignedIn ? "remote" : "local";
};

export const RemoteGate = ({ children }: { children: ReactNode }) => {
  const session = useSession();
  const wanted = wantedMode(session);
  const [phase, setPhase] = useState<Phase>(() =>
    wanted === "local" ? { kind: "local" } : { kind: "waiting" },
  );
  // Remote, or on the way there: the session no longer decides.
  const committed =
    phase.kind === "loading" ||
    phase.kind === "failed" ||
    phase.kind === "remote";

  useEffect(() => {
    if (committed) return;
    if (wanted === "remote") setPhase({ kind: "loading" });
    else if (wanted === "local" && phase.kind !== "local") {
      setPhase({ kind: "local" });
    }
  }, [committed, wanted, phase.kind]);

  useEffect(() => {
    if (phase.kind !== "loading") return;
    let current = true;
    withToken(getAccessToken, fetchDocuments).then(
      (initial) => {
        if (current) setPhase({ kind: "remote", initial });
      },
      (error: unknown) => {
        if (current) {
          setPhase({
            kind: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [phase.kind]);

  switch (phase.kind) {
    case "local":
      return (
        <StoreProvider key="local" persistence={{ kind: "local" }}>
          {children}
        </StoreProvider>
      );
    case "remote":
      return (
        <StoreProvider
          key="remote"
          persistence={{
            kind: "remote",
            getToken: getAccessToken,
            initial: phase.initial,
          }}
        >
          {children}
        </StoreProvider>
      );
    case "failed":
      return (
        <main>
          <div role="alert">
            <p>
              <strong>Your planner could not be loaded.</strong> Nothing has
              been changed. ({phase.message})
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setPhase({ kind: "loading" });
              }}
            >
              Try again
            </button>
          </div>
        </main>
      );
    case "waiting":
    case "loading":
      return (
        <main>
          <p role="status">Loading your planner…</p>
        </main>
      );
  }
};

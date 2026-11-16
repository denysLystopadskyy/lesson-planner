import type { DocumentKey, ServerDocuments } from "./documents-api";
import type { LoadedData, PlannerState } from "./store";

/**
 * The pure half of remote mode — plan batch 6.2.
 *
 * Everything here is a plain function of its arguments, so the decisions that
 * carry the risk (what to send, when to try again, what the server's answer
 * becomes on screen) are component tests, not browser tests.
 */

/** The three bodies, exactly as they are sent to the server. */
export type PlannerDocuments = Record<DocumentKey, unknown>;

export const documentsOf = (
  _state: Pick<PlannerState, "groups" | "settings" | "template">,
): PlannerDocuments => {
  throw new Error("not implemented");
};

export const changedKeys = (
  _current: PlannerDocuments,
  _lastSaved: PlannerDocuments,
): DocumentKey[] => {
  throw new Error("not implemented");
};

export const retryDelayMs = (_attempt: number): number => {
  throw new Error("not implemented");
};

export const loadedFromServer = (_docs: ServerDocuments): LoadedData => {
  throw new Error("not implemented");
};

export const savedAtOf = (_docs: ServerDocuments): string | null => {
  throw new Error("not implemented");
};

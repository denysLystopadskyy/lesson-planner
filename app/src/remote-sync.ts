import {
  DOCUMENT_KEYS,
  type DocumentKey,
  type ServerDocuments,
} from "./documents-api";
import { groupsFromValue, settingsFromValue } from "./storage";
import type { LoadedData, PlannerState } from "./store";
import { DEFAULT_CURRENCY } from "./types";

/**
 * The pure half of remote mode — plan batch 6.2.
 *
 * Everything here is a plain function of its arguments, so the decisions that
 * carry the risk (what to send, when to try again, what the server's answer
 * becomes on screen) are component tests, not browser tests.
 */

/** The three bodies, exactly as they are sent to the server. */
export type PlannerDocuments = Record<DocumentKey, unknown>;

/** The state's three domains as the three bodies, one to one. */
export const documentsOf = (
  state: Pick<PlannerState, "groups" | "settings" | "template">,
): PlannerDocuments => ({
  data: state.groups,
  settings: state.settings,
  template: state.template,
});

/**
 * The keys whose body differs from the last one the server took.
 *
 * Compared as serialized text, not by identity: a commit that rebuilds the
 * list without changing it must send nothing, and two bodies that serialize
 * alike are, to the server, the same body. Key order is fixed (`data`,
 * `settings`, `template`), so a save always runs in the same order.
 */
export const changedKeys = (
  current: PlannerDocuments,
  lastSaved: PlannerDocuments,
): DocumentKey[] =>
  DOCUMENT_KEYS.filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(lastSaved[key]),
  );

/** 1 s, 2 s, 5 s, 10 s, then 30 s for every later attempt. */
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000] as const;
const RETRY_CAP_MS = 30000;

/**
 * How long to wait before retry number `attempt + 1`.
 *
 * `attempt` counts the failures so far, from 0. The steps grow quickly and
 * stop at 30 s: offline for an hour costs 120 requests, not thousands, and a
 * network that comes back is noticed at once through the `online` event
 * anyway.
 */
export const retryDelayMs = (attempt: number): number =>
  RETRY_DELAYS_MS[Math.max(0, attempt)] ?? RETRY_CAP_MS;

/**
 * The server's documents as the same `LoadedData` the local loaders give, so
 * `initialState` has one input whichever mode it starts in.
 *
 * A key with no row is what an empty `localStorage` key is: an empty planner,
 * the default currency, the default template. A body goes through the same
 * checks the local loader uses, so a mended value is reported the same way.
 */
export const loadedFromServer = (docs: ServerDocuments): LoadedData => ({
  groups:
    docs.data === null
      ? { ok: true, value: [] }
      : groupsFromValue(docs.data.body),
  settings:
    docs.settings === null
      ? { ok: true, value: { defaultCurrency: DEFAULT_CURRENCY } }
      : settingsFromValue(docs.settings.body),
  template: typeof docs.template?.body === "string" ? docs.template.body : null,
});

/**
 * The newest stamp among the loaded documents: when the account was last
 * saved, from any device. `null` for an empty account.
 */
export const savedAtOf = (docs: ServerDocuments): string | null =>
  DOCUMENT_KEYS.map((key) => docs[key]?.updatedAt ?? null).reduce<
    string | null
  >(
    (latest, at) =>
      at !== null && (latest === null || Date.parse(at) > Date.parse(latest))
        ? at
        : latest,
    null,
  );

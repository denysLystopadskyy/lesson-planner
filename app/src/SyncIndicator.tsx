import { cx } from "./cx";
import { pad } from "./schedule";
import type { SyncState } from "./store";
import styles from "./SyncIndicator.module.css";

/**
 * Where remote mode's saving stands — plan batch 6.2.
 *
 * Shown in remote mode only, in the place of the "Last backup" indicator: that
 * one is about this browser's copy, and in remote mode this browser keeps none.
 *
 * Four texts, from the plan: "Saving…", "Saved HH:MM", "Not saved — retrying"
 * and "Changed on another device". Two rules decide which:
 *
 * - **Saved only after the server answered.** The status reaches `saved` only
 *   from a request in flight (`store.ts`), and the time is the server's stamp.
 * - **A retry does not hide a failure.** While a failed save is tried again,
 *   the text stays "Not saved — retrying" instead of flickering to "Saving…"
 *   every few seconds. A refusal the timer will not retry says "Not saved".
 *
 * Not a live region, like the backup indicator: it changes on every save, and
 * a screen reader announcing each one would interrupt her work. The problems
 * that need her are announced by `SyncNotice`.
 */

/** "HH:MM" in the browser's own time zone. */
const timeOf = (at: string): string => {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const syncText = (sync: SyncState): string => {
  const saved = sync.savedAt === null ? "" : `Saved ${timeOf(sync.savedAt)}`;
  switch (sync.status) {
    case "off":
    case "saved":
      return saved;
    case "saving":
      return sync.problem === null ? "Saving…" : "Not saved — retrying";
    case "retrying":
      return sync.problem?.kind === "refused"
        ? "Not saved"
        : "Not saved — retrying";
    case "conflict":
      return "Changed on another device";
  }
};

export const SyncIndicator = ({ sync }: { sync: SyncState }) => (
  <span
    id="syncIndicator"
    className={cx(
      styles.indicator,
      (sync.problem !== null || sync.status === "conflict") && styles.problem,
    )}
  >
    {syncText(sync)}
  </span>
);

/**
 * The failures she has to act on, as alerts above the planner.
 *
 * **Sign in to save** (review focus 5): the token was refused twice, so the
 * session has ended — signed out in another tab, or expired. The edit stays on
 * screen and the timer keeps trying. Signing in **in a new tab** is offered
 * rather than here, because Google sign-in leaves the page, and leaving the
 * page would lose the very edit this notice is about. Once she has signed in
 * there, the next retry in this tab gets the new session and saves.
 */
export const SyncNotice = ({ sync }: { sync: SyncState }) => {
  if (sync.problem?.kind === "sign-in") {
    return (
      <div role="alert" className="storage-error">
        <p>
          <strong>Sign in to save.</strong> Your changes are still on screen,
          but they are not saved in your account.
        </p>
        <p>
          <a href={window.location.pathname} target="_blank" rel="noopener">
            Open the planner in a new tab
          </a>{" "}
          and sign in there. This tab saves as soon as you have — keep it open
          until it says “Saved”.
        </p>
      </div>
    );
  }
  if (sync.problem?.kind === "refused") {
    return (
      <div role="alert" className="storage-error">
        <p>Your last change could not be saved: the server refused it.</p>
        <p>
          It is still on screen, but it is <strong>not saved</strong> — closing
          this tab would lose it. The details were:{" "}
          <code>{sync.problem.message}</code>
        </p>
      </div>
    );
  }
  return null;
};

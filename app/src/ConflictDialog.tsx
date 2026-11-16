import { Dialog } from "./Dialog";
import { countsLine, type BackupData } from "./backup";
import type { DocumentKey, RemoteDocument } from "./documents-api";
import { loadedFromServer } from "./remote-sync";
import { pad } from "./schedule";

/**
 * The planner changed on another device — plan batch 6.2, review focus 2.
 *
 * A save named a version the server no longer holds, so the server answered
 * 409 with its copy. Nothing is merged automatically (storage-data-contract.md,
 * "Conflicts"): she sees both sides and chooses.
 *
 * - **Keep this screen** sends what is on screen over the newer version,
 *   knowingly.
 * - **Use the saved version** puts the account's version on screen.
 *
 * Escape and the backdrop do nothing: closing without a choice would leave
 * the save stopped with nothing on screen saying why.
 */

type Props = {
  conflict: { key: DocumentKey; document: RemoteDocument | null };
  /** What is on screen now. */
  screen: BackupData;
  onKeep: () => void;
  onUseSaved: () => void;
};

const WHAT: Record<DocumentKey, string> = {
  data: "the groups and their lessons",
  settings: "the default currency",
  template: "the payment template",
};

const timeOf = (at: string): string => {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** The screen, with the conflicting document replaced by the server's copy. */
const accountSide = (
  screen: BackupData,
  key: DocumentKey,
  document: RemoteDocument | null,
): BackupData => {
  const loaded = loadedFromServer({
    data: null,
    settings: null,
    template: null,
    [key]: document,
  });
  return {
    groupLessonPlannerData:
      key === "data"
        ? loaded.groups.ok
          ? loaded.groups.value
          : []
        : screen.groupLessonPlannerData,
    groupLessonPlannerSettings:
      key === "settings" && loaded.settings.ok
        ? loaded.settings.value
        : screen.groupLessonPlannerSettings,
    paymentTemplate:
      key === "template" ? loaded.template : screen.paymentTemplate,
  };
};

export const ConflictDialog = ({
  conflict,
  screen,
  onKeep,
  onUseSaved,
}: Props) => {
  const { key, document } = conflict;
  const account =
    document === null
      ? "Saved in your account: nothing — it was removed there."
      : `Saved in your account at ${timeOf(document.updatedAt)}: ${countsLine(
          accountSide(screen, key, document),
        )}`;

  return (
    <Dialog
      id="conflictModal"
      label="Changed on another device"
      onClose={() => undefined}
    >
      <div className="modal">
        <h3>Changed on another device</h3>
        <p>
          Your planner was saved from another device or tab while you were
          working here. The difference is in {WHAT[key]}. Nothing has been
          overwritten — choose which version to keep.
        </p>
        <ul>
          <li>This screen: {countsLine(screen)}</li>
          <li>{account}</li>
        </ul>
        <div className="dialog-actions no-rule">
          <button type="button" className="primary" onClick={onKeep}>
            Keep this screen
          </button>
          <button type="button" onClick={onUseSaved}>
            Use the saved version
          </button>
        </div>
      </div>
    </Dialog>
  );
};

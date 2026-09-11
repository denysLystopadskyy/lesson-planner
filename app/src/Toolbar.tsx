import { useRef } from "react";
import { cx } from "./cx";
import { TemplateIcon } from "./icons";

/**
 * The controls above the group grid, the two hidden file inputs behind
 * "Load CSV" and "Load Backup", and the backup indicator.
 *
 * Save/Load Backup sit beside Save/Load CSV rather than replacing them. The two
 * formats have different jobs: the CSV opens in a spreadsheet, and the backup
 * restores the app. Batch 3.3 added the second because the first was never able
 * to do the second — it omits the payment template (DEF-005).
 *
 * The `<header>` and the `<h1>` stay in `App`, and the toolbar stays a sibling
 * of the heading rather than a child of it. That is not a style preference: the
 * legacy page put these buttons inside the `<h1>`, which made the heading's
 * accessible name the title followed by every button label and left the page
 * with no banner landmark. That is DEF-019, closed by deleting the page, and
 * `visual-layout.spec.ts` asserts the banner so it cannot come back.
 *
 * The file input lives here because only this component opens it. It is
 * `display: none`, which also keeps it out of the tab order — the button is the
 * control, and a second stop on an invisible input would be a bug a keyboard
 * user meets and nobody else does.
 */

type Props = {
  onAddGroup: () => void;
  onEditTemplate: () => void;
  onExportCsv: () => void;
  onImportCsv: (file: File, input: HTMLInputElement) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File, input: HTMLInputElement) => void;
  onClearAll: () => void;
  /** What the backup indicator says, from `backupAge`. */
  backup: { text: string; stale: boolean };
};

export const Toolbar = ({
  onAddGroup,
  onEditTemplate,
  onExportCsv,
  onImportCsv,
  onExportBackup,
  onImportBackup,
  onClearAll,
  backup,
}: Props) => {
  const csvInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      {/* First, not last. It ended up after "Clear All Data" at first, which
          put a status message on the far side of the one destructive control
          and pushed that control 157px off the right margin — caught by the
          geometry assertion in `visual-layout.spec.ts`, not by eye.

          Not an alert, either. Nothing is wrong and nothing is waiting on her,
          so a screen reader should reach it by reading rather than be
          interrupted by it. */}
      <span
        id="backupIndicator"
        className={cx("backup-indicator", backup.stale && "stale")}
      >
        {backup.text}
      </span>
      <button
        id="addGroupBtn"
        type="button"
        className="primary"
        onClick={onAddGroup}
      >
        + Add Group
      </button>
      <button id="editTemplateBtn" type="button" onClick={onEditTemplate}>
        <TemplateIcon /> Edit Template
      </button>
      <button
        id="loadCsvBtn"
        type="button"
        onClick={() => {
          csvInput.current?.click();
        }}
      >
        Load CSV
      </button>
      <button id="saveCsvBtn" type="button" onClick={onExportCsv}>
        Save CSV
      </button>
      <button id="saveBackupBtn" type="button" onClick={onExportBackup}>
        Save Backup
      </button>
      <button
        id="loadBackupBtn"
        type="button"
        onClick={() => {
          backupInput.current?.click();
        }}
      >
        Load Backup
      </button>
      <button
        id="clearDataBtn"
        type="button"
        className="danger"
        onClick={onClearAll}
      >
        Clear All Data
      </button>
      <input
        id="backupInput"
        ref={backupInput}
        type="file"
        accept="application/json,.json"
        className="file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onImportBackup(file, event.target);
        }}
      />
      <input
        id="csvInput"
        ref={csvInput}
        type="file"
        accept=".csv"
        className="file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onImportCsv(file, event.target);
        }}
      />
    </div>
  );
};

import { useRef } from "react";
import { TemplateIcon } from "./icons";

/**
 * The five controls above the group grid, and the hidden file input behind
 * "Load CSV".
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
  onClearAll: () => void;
};

export const Toolbar = ({
  onAddGroup,
  onEditTemplate,
  onExportCsv,
  onImportCsv,
  onClearAll,
}: Props) => {
  const csvInput = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
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
      <button
        id="clearDataBtn"
        type="button"
        className="danger"
        onClick={onClearAll}
      >
        Clear All Data
      </button>
      <input
        id="csvInput"
        ref={csvInput}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onImportCsv(file, event.target);
        }}
      />
    </div>
  );
};

import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";

/**
 * The payment-message template editor.
 *
 * Save writes the raw string to `paymentTemplate`; Cancel discards the edit.
 * The draft lives in local state, so Cancel has nothing to undo — the same
 * shape that keeps DEF-008 out of the group dialog.
 *
 * Focus is taken synchronously on open. The legacy app uses a 100 ms
 * `setTimeout`, which is the pattern behind the suite-wide flake found in batch
 * 1.10.
 */

type Props = {
  template: string;
  onSave: (template: string) => void;
  onClose: () => void;
};

export const TemplateModal = ({ template, onSave, onClose }: Props) => {
  const [draft, setDraft] = useState(template);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  return (
    <Dialog
      id="templateModal"
      label="Edit Payment Message Template"
      onClose={onClose}
    >
      <div className="modal">
        <h3>Edit Payment Message Template</h3>
        <p>
          You can use <code>{"{{month}}"}</code>, <code>{"{{lessons}}"}</code>,{" "}
          <code>{"{{total}}"}</code>
        </p>
        <textarea
          id="templateTextarea"
          ref={textarea}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <div style={{ textAlign: "right" }}>
          <button id="cancelTemplateBtn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            id="saveTemplateBtn"
            type="button"
            onClick={() => {
              onSave(draft);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Dialog>
  );
};

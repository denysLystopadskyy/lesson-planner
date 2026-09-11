import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { unfilledPlaceholders } from "./message";

/**
 * The payment-message template editor.
 *
 * Save writes the raw string to `paymentTemplate`; Cancel discards the edit.
 * The draft lives in local state, so Cancel has nothing to undo — the same
 * shape that keeps DEF-008 out of the group dialog.
 *
 * Focus goes to the textarea on open. `showModal()` in `Dialog.tsx` would
 * focus the first focusable element anyway, which is the same textarea today —
 * this states the intent, so adding a control above it later does not silently
 * move the caret out of the template text. Either way it is synchronous: the legacy app
 * used a 100 ms `setTimeout`, the pattern behind the suite-wide flake found in
 * batch 1.10.
 */

type Props = {
  template: string;
  onSave: (template: string) => void;
  onClose: () => void;
};

export const TemplateModal = ({ template, onSave, onClose }: Props) => {
  const [draft, setDraft] = useState(template);
  // Recomputed as she types, so the hint goes away the moment it is answered
  // rather than after a save — plan batch 3.5.
  const unfilled = unfilledPlaceholders(draft);
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
        {unfilled.length > 0 && (
          <p id="templatePlaceholderHelp" className="template-help">
            Replace{" "}
            {unfilled.map((name, index) => (
              <span key={name}>
                {index > 0 ? " and " : ""}
                <code>{name}</code>
              </span>
            ))}{" "}
            with your own payment details. The app fills in the month, the
            lesson count and the total, but it cannot know these — so it ships
            them blank rather than shipping somebody else&rsquo;s. You only need
            to do this once.
          </p>
        )}
        <textarea
          id="templateTextarea"
          // The dialog's heading names the task; the control needs its own name (axe `label`, critical).
          aria-label="Payment message template"
          ref={textarea}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <div className="dialog-actions no-rule">
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

import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { unfilledPlaceholders } from "./message";

/**
 * The review dialog: the generated message, editable before it is copied.
 *
 * **DEF-011, fixed in plan batch 3.4a.** `navigator.clipboard.writeText` used
 * to be fired and not awaited, so the button said "Copied!" and the dialog
 * closed whether or not the write had succeeded — which is exactly what happens
 * when the document is not focused or permission is denied. The user then went
 * to paste a message that was never on the clipboard, and the rejection
 * surfaced only as an unhandled promise in a console she will never open.
 *
 * The write is now awaited. On success nothing changes. On failure the label
 * does not claim anything, the dialog **stays open** so the text can still be
 * selected and copied by hand, and the reason is said out loud — a failure the
 * user can work around is only useful if she knows to work around it.
 */

type Props = {
  message: string;
  onClose: () => void;
};

const COPY_LABEL = "Copy & Close";

export const ReviewModal = ({ message, onClose }: Props) => {
  const [draft, setDraft] = useState(message);
  const [label, setLabel] = useState(COPY_LABEL);
  const [copyError, setCopyError] = useState<string | null>(null);
  // The template editor asks her to fill these in; this is the last place that
  // can notice she has not — plan batch 3.5. A message still carrying
  // `<account>` looks finished, copies cleanly, and reaches a parent who cannot
  // pay it.
  const unfilled = unfilledPlaceholders(draft);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const copyAndClose = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(draft);
    } catch (error) {
      // Deliberately not "Copy failed" alone. The two realistic causes — the
      // document losing focus, and permission being denied — both have the same
      // workaround, and naming it is the difference between a dead end and a
      // message she can still send.
      setCopyError(
        `The message could not be copied (${error instanceof Error ? error.message : String(error)}). ` +
          `Select the text above and copy it yourself.`,
      );
      return;
    }
    setLabel("Copied!");
    setTimeout(() => {
      setLabel(COPY_LABEL);
      onClose();
    }, 1000);
  };

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  return (
    <Dialog id="reviewModal" label="Review Payment Message" onClose={onClose}>
      <div className="modal">
        <h3>Review Payment Message</h3>
        <textarea
          id="reviewTextarea"
          ref={textarea}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        {unfilled.length > 0 && (
          <p
            id="reviewPlaceholderWarning"
            role="status"
            className="template-help"
          >
            This message still contains {unfilled.join(" and ")}. Edit it here,
            or set your payment details once in Edit Template.
          </p>
        )}
        {copyError !== null && (
          <p id="copyError" role="alert" className="copy-error">
            {copyError}
          </p>
        )}
        <div className="dialog-actions no-rule">
          <button id="cancelReviewBtn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            id="copyAndCloseBtn"
            type="button"
            onClick={() => {
              void copyAndClose();
            }}
          >
            {label}
          </button>
        </div>
      </div>
    </Dialog>
  );
};

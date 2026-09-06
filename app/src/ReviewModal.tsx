import { useEffect, useRef, useState } from "react";

/**
 * The review dialog: the generated message, editable before it is copied.
 *
 * **DEF-011 is reproduced here on purpose.** `navigator.clipboard.writeText` is
 * fired and not awaited, so the button says "Copied!" and the dialog closes
 * whether or not the write succeeded — which is what a user sees when the
 * document is not focused or permission is denied. Batch 3.4a awaits the
 * promise and reports the failure; changing it here would move a fix into the
 * batch that ports the feature.
 */

type Props = {
  message: string;
  onClose: () => void;
};

const COPY_LABEL = "Copy & Close";

export const ReviewModal = ({ message, onClose }: Props) => {
  const [draft, setDraft] = useState(message);
  const [label, setLabel] = useState(COPY_LABEL);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      id="reviewModal"
      className="modal-overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="Review Payment Message"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <h3>Review Payment Message</h3>
        <textarea
          id="reviewTextarea"
          ref={textarea}
          style={{ width: "95%", minHeight: "300px" }}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
        <div style={{ textAlign: "right", marginTop: "10px" }}>
          <button id="cancelReviewBtn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            id="copyAndCloseBtn"
            type="button"
            onClick={() => {
              // Not awaited — DEF-011. See the note at the top of this file.
              void navigator.clipboard.writeText(draft);
              setLabel("Copied!");
              setTimeout(() => {
                setLabel(COPY_LABEL);
                onClose();
              }, 1000);
            }}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
};

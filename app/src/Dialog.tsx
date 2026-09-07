import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * The shell every dialog in the app sits in.
 *
 * It is the native `<dialog>` element, opened with `showModal()`, and that is
 * the whole point: the browser then supplies what batch 2b.2 measured this app
 * failing to do by hand (DEF-023).
 *
 * - **Focus goes into the dialog** when it opens, and Tab cycles inside it.
 * - **Everything behind becomes inert.** Not hidden, not merely covered —
 *   inert, so a screen reader cannot reach it either. The old markup set
 *   `aria-modal="true"`, which *claimed* that and could not deliver it: three
 *   tabs walked the dialog and the fourth landed on the toolbar behind.
 * - **Escape closes**, as the platform's `cancel` event.
 * - **Focus returns** to whatever opened the dialog.
 *
 * A hand-rolled trap can do all of this and usually gets one case wrong —
 * Shift+Tab off the first control, a control that becomes disabled while open,
 * the calendar swapping the dialog's contents mid-edit. None of those is our
 * problem now.
 *
 * The element keeps `className="modal-overlay show"` and the `id` the frozen
 * test contract locates, so the specs and the stylesheet see what they saw
 * before. `styles.css` resets the user-agent dialog box and moves the tint to
 * `::backdrop`.
 */

type Props = {
  id: string;
  /** Names the dialog for assistive technology. */
  label: string;
  /** Escape, or a click on the backdrop. */
  onClose: () => void;
  /**
   * False while another dialog is open on top of this one, so a single Escape
   * closes a single dialog. Without it both handlers fire and two dialogs go.
   */
  escapeCloses?: boolean;
  children: ReactNode;
};

export const Dialog = ({
  id,
  label,
  onClose,
  escapeCloses = true,
  children,
}: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element === null || element.open) return;

    // Remembered here, restored below. A `<dialog>` restores focus itself when
    // it is closed, but React unmounts this one instead — by the time any
    // cleanup runs the element is on its way out of the document, and the
    // browser has nothing to restore from. Without this the user lands back at
    // the top of the page after every dialog.
    const opener = document.activeElement;
    element.showModal();

    return () => {
      if (element.open) element.close();
      // `isConnected` because the opener can be gone: renaming a group replaces
      // its card. `focus` on a detached node silently does nothing, so the
      // check is about saying that out loud rather than about avoiding a throw.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      id={id}
      ref={dialog}
      className="modal-overlay show"
      aria-label={label}
      onCancel={(event) => {
        // The platform's Escape. Prevented so the browser does not close the
        // element behind React's back, leaving the component mounted and the
        // dialog gone.
        event.preventDefault();
        if (escapeCloses) onClose();
      }}
      onClick={(event) => {
        // A modal `<dialog>` fills the viewport, so a click on the backdrop is
        // reported on the dialog itself. Anything inside the panel has a
        // different target.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
};

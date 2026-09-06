import { useEffect, useRef, useState } from "react";
import { formatCurrency, SUPPORTED_CURRENCIES } from "./format";
import { currencyOf } from "./storage";
import { DEFAULT_CURRENCY, type Group, type Settings } from "./types";

/**
 * The group dialog: read-only summary, an edit form behind the pencil, and
 * delete.
 *
 * Three legacy behaviours are deliberately **not** reproduced. Each is a pinned
 * defect against the legacy app, and each disappears here as a consequence of
 * the shape of the code rather than by being special-cased:
 *
 * - **DEF-008** — Cancel reverts the price as well as the name. The edit form
 *   holds a draft in local state and nothing reaches the group until Save, so
 *   there is nothing for Cancel to fail to undo.
 * - **DEF-009** — changing the price cannot wipe an unsaved name. Both are
 *   fields of the same draft; editing one does not re-render the other from
 *   stored data.
 * - **DEF-003** — a group with no currency still opens, because `currencyOf`
 *   falls back to the default instead of handing `undefined` to `Intl`.
 *
 * The dialog also focuses the name field synchronously on open. The legacy app
 * does it in a 100 ms `setTimeout`, which steals focus back mid-typing — the
 * cause of the suite-wide flake found in batch 1.10.
 */

export type GroupDraft = {
  name: string;
  price: string;
  currency: string;
};

export const draftFromGroup = (
  group: Group,
  settings: Settings,
): GroupDraft => ({
  name: group.name,
  price: String(group.price),
  currency: currencyOf(group, settings),
});

export const emptyDraft = (settings: Settings): GroupDraft => ({
  name: "Untitled Group",
  price: "0",
  currency: settings.defaultCurrency || DEFAULT_CURRENCY,
});

type Props = {
  /** The group being edited, or null when adding a new one. */
  group: Group | null;
  settings: Settings;
  startInEditMode: boolean;
  onSave: (draft: GroupDraft) => void;
  onDelete: () => void;
  onClose: () => void;
};

export const GroupModal = ({
  group,
  settings,
  startInEditMode,
  onSave,
  onDelete,
  onClose,
}: Props) => {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [draft, setDraft] = useState<GroupDraft>(() =>
    group === null ? emptyDraft(settings) : draftFromGroup(group, settings),
  );
  const nameInput = useRef<HTMLInputElement>(null);

  // Focus on open, and only on open. No timeout, so nothing can steal focus
  // out from under a user — or a test — that starts typing immediately.
  useEffect(() => {
    if (isEditing) nameInput.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const displayCurrency =
    group === null ? draft.currency : currencyOf(group, settings);
  const displayPrice = group === null ? Number(draft.price) || 0 : group.price;

  return (
    <div
      id="groupModal"
      className="modal-overlay show"
      role="dialog"
      aria-modal="true"
      aria-label={group === null ? "Add Group" : "Edit Group"}
      onClick={(event) => {
        // Only a click on the backdrop itself closes; clicks inside the panel
        // bubble up to here and must not.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <h3 id="groupModalTitle">
          {group === null ? "Add Group" : "Edit Group"}
        </h3>

        {isEditing ? (
          <form
            id="groupInfoForm"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(draft);
              setIsEditing(false);
            }}
          >
            <label htmlFor="groupNameInput">Group Name</label>
            <input
              id="groupNameInput"
              ref={nameInput}
              type="text"
              value={draft.name}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
              }}
            />

            <label htmlFor="groupPriceInput">Default Price</label>
            <input
              id="groupPriceInput"
              type="number"
              value={draft.price}
              onChange={(event) => {
                setDraft({ ...draft, price: event.target.value });
              }}
            />

            <label htmlFor="groupCurrencyInput">Currency</label>
            <select
              id="groupCurrencyInput"
              value={draft.currency}
              onChange={(event) => {
                setDraft({ ...draft, currency: event.target.value });
              }}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>

            <button id="saveGroupBtn" type="submit">
              Save
            </button>
            <button
              id="cancelGroupBtn"
              type="button"
              onClick={() => {
                // Discards the whole draft — price included. That is DEF-008
                // not happening.
                setDraft(
                  group === null
                    ? emptyDraft(settings)
                    : draftFromGroup(group, settings),
                );
                if (group === null) onClose();
                else setIsEditing(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div id="groupInfoDisplay">
            <span>Group Name</span>
            <span id="groupNameDisplay">{group?.name ?? draft.name}</span>
            <span>Default Price</span>
            <span id="groupPriceDisplay">
              {formatCurrency(displayPrice, displayCurrency)}
            </span>
            <span>Currency</span>
            <span id="groupCurrencyDisplay">{displayCurrency}</span>
            <button
              id="editGroupInfoBtn"
              type="button"
              aria-label="Edit group details"
              onClick={() => {
                setDraft(
                  group === null
                    ? emptyDraft(settings)
                    : draftFromGroup(group, settings),
                );
                setIsEditing(true);
              }}
            >
              ✏️
            </button>
          </div>
        )}

        {/* Populated in batch 2a.3c, when the monthly rows and calendar land. */}
        <div id="monthlySection">
          <hr />
          <h4>Monthly Overrides &amp; Schedule</h4>
        </div>

        {group !== null && (
          <button id="deleteGroupBtn" type="button" onClick={onDelete}>
            Delete Group
          </button>
        )}
      </div>
    </div>
  );
};

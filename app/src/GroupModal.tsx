import { useEffect, useRef, useState } from "react";
import { CalendarEditor } from "./CalendarEditor";
import { MonthlyOverrides } from "./MonthlyOverrides";
import { formatCurrency, SUPPORTED_CURRENCIES } from "./format";
import { commitSelection, isoDate, overridesOf } from "./schedule";
import { currencyOf } from "./storage";
import {
  DEFAULT_CURRENCY,
  type DateKey,
  type Group,
  type MonthKey,
  type MonthOverride,
  type Settings,
} from "./types";

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
  /** Commits a schedule edit. Null group means the add flow, which has none. */
  onScheduleSave: (next: Group) => void;
  /** Asks for the payment message for one month; the review dialog is App's. */
  onCopyMessage: (monthKey: MonthKey) => void;
  /**
   * False while the review dialog is open on top of this one, so a single
   * Escape closes a single dialog. The legacy app closes the group dialog and
   * leaves the review dialog stranded over an empty backdrop.
   */
  escapeCloses: boolean;
};

export const GroupModal = ({
  group,
  settings,
  startInEditMode,
  onSave,
  onDelete,
  onClose,
  onScheduleSave,
  onCopyMessage,
  escapeCloses,
}: Props) => {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [draft, setDraft] = useState<GroupDraft>(() =>
    group === null ? emptyDraft(settings) : draftFromGroup(group, settings),
  );
  const nameInput = useRef<HTMLInputElement>(null);

  // Schedule editing state. Nothing here touches the group until Done.
  const now = new Date();
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [pendingDates, setPendingDates] = useState<Set<DateKey>>(new Set());
  const [pendingOverrides, setPendingOverrides] = useState<
    Record<MonthKey, MonthOverride>
  >({});

  const startEditingDates = (monthKey?: MonthKey) => {
    if (group === null) return;
    setPendingDates(new Set(group.dates));
    setPendingOverrides(structuredClone(overridesOf(group)));
    if (monthKey !== undefined) {
      const [year, month] = monthKey.split("-");
      setCalYear(Number(year));
      setCalMonth(Number(month) - 1);
    } else {
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
    }
    setIsEditingDates(true);
  };

  const activeOverrides = isEditingDates
    ? pendingOverrides
    : overridesOf(group ?? { name: "", price: 0, dates: [] });
  const currentMonthKey: MonthKey = isoDate(calYear, calMonth, 1).slice(0, 7);

  // Focus on open, and only on open. No timeout, so nothing can steal focus
  // out from under a user — or a test — that starts typing immediately.
  useEffect(() => {
    if (isEditing) nameInput.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    if (!escapeCloses) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, escapeCloses]);

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

        <div className="group-info-container">
          <div className="group-info-wrapper">
            {isEditing ? (
              <form
                id="groupInfoForm"
                className="group-info-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSave(draft);
                  setIsEditing(false);
                }}
              >
                <div className="field group-name-field">
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
                </div>
                <div className="price-details-container">
                  <div className="field">
                    <label htmlFor="groupPriceInput">Default Price</label>
                    <input
                      id="groupPriceInput"
                      type="number"
                      value={draft.price}
                      onChange={(event) => {
                        setDraft({ ...draft, price: event.target.value });
                      }}
                    />
                  </div>
                  <div className="field">
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
                  </div>
                </div>

                <div className="form-actions">
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
                  <button id="saveGroupBtn" className="primary" type="submit">
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <div id="groupInfoDisplay" className="group-info-display">
                {/* One field per row, label then value, with the space between
                them that the legacy markup gets from its indentation. Without
                it the flattened text reads "Group NameKunze Group", which is
                what a screen reader would announce. */}
                <div className="field">
                  <label>Group Name</label>{" "}
                  <div className="field-value" id="groupNameDisplay">
                    {group?.name ?? draft.name}
                  </div>
                </div>{" "}
                <div className="field">
                  <label>Default Price</label>{" "}
                  <div className="field-value" id="groupPriceDisplay">
                    {formatCurrency(displayPrice, displayCurrency)}
                  </div>
                </div>{" "}
                <div className="field">
                  <label>Currency</label>{" "}
                  <div className="field-value" id="groupCurrencyDisplay">
                    {displayCurrency}
                  </div>
                </div>
              </div>
            )}
          </div>
          {!isEditing && (
            <button
              id="editGroupInfoBtn"
              type="button"
              className="icon-button"
              title="Edit group details"
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
          )}
        </div>

        {group !== null && (
          <>
            {/* Hidden while the calendar is open, exactly as the legacy app
                hides it — which is what makes DEF-017 observable: the inline
                price inputs below are rendered into a section nobody can see. */}
            <div
              id="monthlySection"
              style={{ display: isEditingDates ? "none" : "block" }}
            >
              <hr style={{ margin: "16px 0", borderColor: "#e2e8f0" }} />
              <div
                className="monthly-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4>Monthly Overrides &amp; Schedule</h4>
                <button
                  id="editScheduleBtn"
                  type="button"
                  onClick={() => {
                    startEditingDates();
                  }}
                >
                  ✏️ Edit Schedule
                </button>
              </div>
              <MonthlyOverrides
                overrides={activeOverrides}
                currentMonthKey={currentMonthKey}
                groupPrice={group.price}
                currency={currencyOf(group, settings)}
                isEditing={isEditingDates}
                onOpenMonth={(monthKey) => {
                  startEditingDates(monthKey);
                }}
                onPriceChange={(monthKey, price) => {
                  setPendingOverrides({
                    ...pendingOverrides,
                    [monthKey]: {
                      price,
                      dates: pendingOverrides[monthKey]?.dates ?? [],
                    },
                  });
                }}
                onCopyMessage={onCopyMessage}
              />
            </div>

            {isEditingDates && (
              <CalendarEditor
                year={calYear}
                monthIndex={calMonth}
                onMonthChange={(year, monthIndex) => {
                  setCalYear(year);
                  setCalMonth(monthIndex);
                }}
                selected={pendingDates}
                onSelectedChange={setPendingDates}
                overrides={pendingOverrides}
                onOverridesChange={setPendingOverrides}
                groupPrice={group.price}
                currency={currencyOf(group, settings)}
                onDone={() => {
                  onScheduleSave(
                    commitSelection(group, pendingDates, pendingOverrides),
                  );
                  setIsEditingDates(false);
                }}
                onCancel={() => {
                  setIsEditingDates(false);
                }}
              />
            )}
          </>
        )}

        {group !== null && (
          <div className="group-modal-footer">
            <button
              id="deleteGroupBtn"
              type="button"
              className="danger"
              onClick={onDelete}
            >
              Delete Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

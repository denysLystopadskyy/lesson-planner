import { useState } from "react";
import { GroupModal, type GroupDraft } from "./GroupModal";
import { currencyOf, lessonCountOf } from "./storage";
import { useLocalGroups } from "./useLocalGroups";
import type { Group, Settings } from "./types";

/**
 * Port slice 2: the main screen plus group create, edit and delete.
 *
 * Still one component tree with no router and no store — stage 2b splits it up.
 * Controls for features that have not been ported yet stay `disabled`, so
 * nothing on screen looks live and does nothing.
 */

const sortGroups = (groups: Group[]): { group: Group; index: number }[] =>
  groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) =>
      a.group.name.localeCompare(b.group.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

const GroupCard = ({
  group,
  index,
  settings,
  onOpen,
}: {
  group: Group;
  index: number;
  settings: Settings;
  onOpen: () => void;
}) => (
  <div
    className="group-card"
    data-group-name={group.name}
    data-group-index={String(index)}
    data-currency={currencyOf(group, settings)}
    onClick={onOpen}
  >
    <h2 data-testid="group-card-name">{group.name}</h2>
    <div className="group-card-info" data-testid="group-card-lesson-count">
      {lessonCountOf(group)} planned lessons
    </div>
  </div>
);

const StorageError = ({ message }: { message: string }) => (
  <div role="alert" className="storage-error">
    <p>Your saved data could not be read.</p>
    <p>
      Nothing has been changed or deleted. The details were:{" "}
      <code>{message}</code>
    </p>
  </div>
);

/** null = closed. `index` of -1 means the add flow. */
type ModalState = { index: number } | null;

export const App = () => {
  const { groups, settings, commit, loadError } = useLocalGroups();
  const [modal, setModal] = useState<ModalState>(null);

  const isAdding = modal !== null && modal.index === -1;
  // `?? null` because noUncheckedIndexedAccess makes an index access
  // `Group | undefined`, and an out-of-range index is a real possibility while
  // group identity is still the array position.
  const openGroup =
    modal !== null && !isAdding ? (groups[modal.index] ?? null) : null;

  const saveDraft = (draft: GroupDraft) => {
    const price = Number(draft.price) || 0;
    const name = draft.name.trim() || "Untitled Group";
    const next = [...groups];

    if (isAdding) {
      next.push({
        name,
        price,
        currency: draft.currency,
        dates: [],
        monthlyOverrides: {},
      });
      // Stay open on the new group, as the legacy app does.
      setModal({ index: next.length - 1 });
    } else if (modal !== null) {
      const existing = next[modal.index];
      if (existing !== undefined) {
        next[modal.index] = {
          ...existing,
          name,
          price,
          currency: draft.currency,
        };
      }
    }

    commit(next, { defaultCurrency: draft.currency });
  };

  const deleteOpenGroup = () => {
    if (modal === null || openGroup === null) return;
    if (!window.confirm(`Delete group "${openGroup.name}"?`)) return;
    commit(groups.filter((_, index) => index !== modal.index));
    setModal(null);
  };

  return (
    <>
      <header>
        <h1>📅 Group Lesson Planner</h1>
        <div className="toolbar">
          <button
            id="addGroupBtn"
            type="button"
            onClick={() => {
              setModal({ index: -1 });
            }}
          >
            + Add Group
          </button>
          {/* Ported in 2a.3d. */}
          <button id="editTemplateBtn" type="button" disabled>
            🧾 Edit Template
          </button>
          <button id="loadCsvBtn" type="button" disabled>
            Load CSV
          </button>
          <button id="saveCsvBtn" type="button" disabled>
            Save CSV
          </button>
          <button id="clearDataBtn" type="button" disabled>
            Clear All Data
          </button>
        </div>
      </header>

      {loadError !== null && <StorageError message={loadError} />}

      <div id="groupList" className="group-list">
        {loadError === null &&
          (groups.length === 0 ? (
            <div className="empty-state">
              No groups yet. Click &apos;+ Add Group&apos; to get started!
            </div>
          ) : (
            sortGroups(groups).map(({ group, index }) => (
              <GroupCard
                key={`${group.name}-${String(index)}`}
                group={group}
                index={index}
                settings={settings}
                onOpen={() => {
                  setModal({ index });
                }}
              />
            ))
          ))}
      </div>

      {modal !== null && (
        <GroupModal
          group={openGroup ?? null}
          settings={settings}
          startInEditMode={isAdding}
          onSave={saveDraft}
          onDelete={deleteOpenGroup}
          onClose={() => {
            setModal(null);
          }}
        />
      )}
    </>
  );
};

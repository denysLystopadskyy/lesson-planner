import { useMemo } from "react";
import { currencyOf, lessonCountOf, loadGroups, loadSettings } from "./storage";
import { DEFAULT_CURRENCY, type Group, type Settings } from "./types";

/**
 * Port slice 1: the main screen, read-only.
 *
 * Renders the title, the toolbar and the group list from stored data. Editing
 * arrives in 2a.3b–2a.3d. The toolbar buttons are present because the screen is
 * not the screen without them, and they are `disabled` rather than silently
 * inert — a control that looks live and does nothing is exactly the failure
 * DEF-001 produces in the legacy app.
 *
 * The testids and dataset hooks match the frozen contract in
 * .claude/context/testing.md, so the batch-1.13 fixtures and the contract spec
 * apply to this app unchanged.
 */

const sortGroups = (groups: Group[]): Group[] =>
  [...groups].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

const GroupCard = ({
  group,
  index,
  settings,
}: {
  group: Group;
  index: number;
  settings: Settings;
}) => (
  <div
    className="group-card"
    data-group-name={group.name}
    data-group-index={String(index)}
    data-currency={currencyOf(group, settings)}
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

export const App = () => {
  const loaded = useMemo(() => {
    const groups = loadGroups();
    const settings = loadSettings();
    return { groups, settings };
  }, []);

  const settings: Settings = loaded.settings.ok
    ? loaded.settings.value
    : { defaultCurrency: DEFAULT_CURRENCY };

  return (
    <>
      <header>
        <h1>📅 Group Lesson Planner</h1>
        <div className="toolbar">
          {/* Disabled until the handlers land in 2a.3b-2a.3d. */}
          <button id="addGroupBtn" type="button" disabled>
            + Add Group
          </button>
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

      {!loaded.groups.ok && <StorageError message={loaded.groups.error} />}

      <div id="groupList" className="group-list">
        {loaded.groups.ok &&
          (loaded.groups.value.length === 0 ? (
            <div className="empty-state">
              No groups yet. Click &apos;+ Add Group&apos; to get started!
            </div>
          ) : (
            sortGroups(loaded.groups.value).map((group, index) => (
              <GroupCard
                key={`${group.name}-${String(index)}`}
                group={group}
                index={index}
                settings={settings}
              />
            ))
          ))}
      </div>
    </>
  );
};

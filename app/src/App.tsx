import { useEffect, useRef, useState } from "react";
import { GroupModal, type GroupDraft } from "./GroupModal";
import { ReviewModal } from "./ReviewModal";
import { TemplateModal } from "./TemplateModal";
import { deserializeCsv, serializeCsv } from "./csv";
import { DEFAULT_TEMPLATE, generateMonthlyPaymentMessage } from "./message";
import { cascadeDefaultPrice, overridesOf, pad } from "./schedule";
import {
  currencyOf,
  lessonCountOf,
  loadTemplate,
  saveTemplate,
} from "./storage";
import { useLocalGroups } from "./useLocalGroups";
import type { Group, MonthKey, Settings } from "./types";

/**
 * Port slice 4: the whole feature set. Template editing, the payment message
 * and its review dialog, CSV export and import, clear-all and the unload
 * warning join the group and schedule work from the earlier slices.
 *
 * Still one component tree with no router and no store — stage 2b splits it up.
 *
 * Three defects are reproduced rather than fixed, each with a note at the site:
 * **DEF-004** (import replaces without asking), **DEF-011** (`ReviewModal.tsx`)
 * and **DEF-013** (`storage.ts`). The CSV format carries three more, listed in
 * `csv.ts`. Fixing any of them inside the batch that ports them would make the
 * cutover impossible to reason about; Phase 3 owns them.
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
  const { groups, settings, commit, clearAll, loadError } = useLocalGroups();
  const [modal, setModal] = useState<ModalState>(null);
  /** Non-null while the template editor is open, holding the stored text. */
  const [templateDraft, setTemplateDraft] = useState<string | null>(null);
  /** Non-null while the review dialog is open, holding the generated message. */
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  // The unload warning. Bound only while there is something to lose, exactly
  // as the legacy app binds it.
  useEffect(() => {
    if (groups.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      // `preventDefault()` alone, without the deprecated `returnValue` the
      // legacy app also assigns. Every current browser ignores the custom
      // string and shows its own wording, so the two behave identically on
      // screen and the deprecated property buys nothing.
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [groups.length]);

  const isAdding = modal !== null && modal.index === -1;
  // `?? null` because noUncheckedIndexedAccess makes an index access
  // `Group | undefined`, and an out-of-range index is a real possibility while
  // group identity is still the array position.
  const openGroup =
    modal !== null && !isAdding ? (groups[modal.index] ?? null) : null;

  const saveDraft = (draft: GroupDraft) => {
    const price = Number(draft.price) || 0;
    const next = [...groups];

    if (isAdding) {
      next.push({
        // Blank falls back to "Untitled Group" on create and to "Untitled" on
        // edit. The two differ in the legacy app and the port keeps both; which
        // one is right is an open question for the owner, listed on the batch
        // page.
        name: draft.name.trim() || "Untitled Group",
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
        const now = new Date();
        const currentMonthKey = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}`;
        next[modal.index] = {
          ...existing,
          name: draft.name.trim() || "Untitled",
          price,
          currency: draft.currency,
          // Raising the default carries current and future months that were
          // still on the old one with it. The legacy app does this from the
          // price field's `change` event, which is also how it manages to show
          // a price it has not saved (DEF-008); here it happens on Save, so
          // the stored result is the same and the defect is not inherited.
          monthlyOverrides: cascadeDefaultPrice(
            overridesOf(existing),
            existing.price,
            price,
            currentMonthKey,
          ),
        };
      }
    }

    commit(next, { defaultCurrency: draft.currency });
  };

  const exportCsv = () => {
    if (groups.length === 0) {
      window.alert("There are no groups to export yet.");
      return;
    }
    const blob = new Blob([serializeCsv(groups)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const timestamp =
      new Date().toISOString().replace(/[:T]/g, "-").split(".")[0] ?? "";
    const link = document.createElement("a");
    link.href = url;
    link.download = `lesson-planner-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importCsv = (file: File, input: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed = deserializeCsv(text);
        // No confirmation, and the replacement is total — DEF-004. The file
        // picker is the only step between a mis-click and losing every group.
        commit(parsed.groups, { defaultCurrency: parsed.defaultCurrency });
        setModal(null);
      } catch (error) {
        window.alert(
          `Unable to load CSV: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        // Reset, so re-choosing the same file fires `change` again.
        input.value = "";
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    if (
      !window.confirm("Clear all groups and schedules? This cannot be undone.")
    )
      return;
    clearAll();
    setModal(null);
  };

  const copyMessageFor = (monthKey: MonthKey) => {
    if (openGroup === null) return;
    setReviewMessage(
      generateMonthlyPaymentMessage(
        loadTemplate() ?? DEFAULT_TEMPLATE,
        overridesOf(openGroup),
        monthKey,
        currencyOf(openGroup, settings),
      ),
    );
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
          <button
            id="editTemplateBtn"
            type="button"
            onClick={() => {
              setTemplateDraft(loadTemplate() ?? DEFAULT_TEMPLATE);
            }}
          >
            🧾 Edit Template
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
          <button id="saveCsvBtn" type="button" onClick={exportCsv}>
            Save CSV
          </button>
          <button id="clearDataBtn" type="button" onClick={clearAllData}>
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
              if (file !== undefined) importCsv(file, event.target);
            }}
          />
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
          onScheduleSave={(next) => {
            const updated = [...groups];
            updated[modal.index] = next;
            commit(updated);
          }}
          onCopyMessage={copyMessageFor}
          escapeCloses={reviewMessage === null}
        />
      )}

      {templateDraft !== null && (
        <TemplateModal
          template={templateDraft}
          onSave={(template) => {
            saveTemplate(template);
            setTemplateDraft(null);
          }}
          onClose={() => {
            setTemplateDraft(null);
          }}
        />
      )}

      {reviewMessage !== null && (
        <ReviewModal
          message={reviewMessage}
          onClose={() => {
            setReviewMessage(null);
          }}
        />
      )}
    </>
  );
};

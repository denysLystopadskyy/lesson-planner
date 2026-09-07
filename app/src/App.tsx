import { useEffect, useState } from "react";
import { CalendarIcon } from "./icons";
import { GroupList } from "./GroupList";
import { GroupModal, type GroupDraft } from "./GroupModal";
import { StorageError } from "./StorageError";
import { Toolbar } from "./Toolbar";
import { ReviewModal } from "./ReviewModal";
import { TemplateModal } from "./TemplateModal";
import { deserializeCsv, serializeCsv } from "./csv";
import { DEFAULT_TEMPLATE, generateMonthlyPaymentMessage } from "./message";
import { cascadeDefaultPrice, overridesOf, pad } from "./schedule";
import { currencyOf, loadTemplate, saveTemplate } from "./storage";
import { useLocalGroups } from "./useLocalGroups";
import type { MonthKey } from "./types";

/**
 * The application shell: the state, the handlers, and the three dialogs.
 *
 * Batch 2b.2 moved the pieces that only draw things into their own files —
 * `Toolbar`, `GroupList` with `GroupCard`, and `StorageError`. What is left
 * here is what they all need: the stored groups, the modal state, and the
 * handlers that change either. The `<header>` stays here because the banner
 * landmark is the page's, not the toolbar's.
 *
 * Three defects are reproduced rather than fixed, each with a note at the site:
 * **DEF-004** (import replaces without asking), **DEF-011** (`ReviewModal.tsx`)
 * and **DEF-013** (`storage.ts`). The CSV format carries three more, listed in
 * `csv.ts`. Fixing any of them inside the batch that ports them would make the
 * cutover impossible to reason about; Phase 3 owns them.
 */

/** null = closed. `index` of -1 means the add flow. */
type ModalState = { index: number } | null;

export const App = () => {
  const { groups, settings, commit, clearAll, loadError } = useLocalGroups();
  const [modal, setModal] = useState<ModalState>(null);
  /** Non-null while the template editor is open, holding the stored text. */
  const [templateDraft, setTemplateDraft] = useState<string | null>(null);
  /** Non-null while the review dialog is open, holding the generated message. */
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
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
        <h1>
          {/* Slightly larger than the text, and spaced: at a flat 1em beside
              22px bold type the mark reads as a small grey box. */}
          <CalendarIcon size="1.1em" />
          <span>Group Lesson Planner</span>
        </h1>
        <Toolbar
          onAddGroup={() => {
            setModal({ index: -1 });
          }}
          onEditTemplate={() => {
            setTemplateDraft(loadTemplate() ?? DEFAULT_TEMPLATE);
          }}
          onExportCsv={exportCsv}
          onImportCsv={importCsv}
          onClearAll={clearAllData}
        />
      </header>

      {loadError !== null && <StorageError message={loadError} />}

      {loadError === null && (
        <GroupList
          groups={groups}
          settings={settings}
          onOpen={(index) => {
            setModal({ index });
          }}
        />
      )}

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

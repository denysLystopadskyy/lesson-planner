import { useEffect, useState } from "react";
import { CalendarIcon } from "./icons";
import { GroupList } from "./GroupList";
import { GroupModal, type GroupDraft } from "./GroupModal";
import {
  ImportUndo,
  StorageError,
  StorageRepairs,
  WriteError,
} from "./StorageError";
import { Toolbar } from "./Toolbar";
import { ReviewModal } from "./ReviewModal";
import { TemplateModal } from "./TemplateModal";
import {
  backupAge,
  countsLine,
  createBackup,
  parseBackup,
  serializeBackup,
  type BackupData,
} from "./backup";
import { deserializeCsv, serializeCsv } from "./csv";
import { DEFAULT_TEMPLATE, generateMonthlyPaymentMessage } from "./message";
import { cascadeDefaultPrice, overridesOf, pad } from "./schedule";
import {
  currencyOf,
  hasSnapshot,
  loadLastBackupAt,
  restoreSnapshot,
  saveLastBackupAt,
  snapshotBeforeImport,
} from "./storage";
import {
  useGroups,
  useLoadError,
  useLoadRepairs,
  useWriteError,
  usePlannerDispatch,
  useSettings,
  useTemplate,
} from "./StoreProvider";
import { useHashRoute } from "./useHashRoute";
import type { MonthKey } from "./types";

/**
 * The application shell: the state, the handlers, and the three dialogs.
 *
 * Batch 2b.2 moved the pieces that only draw things into their own files —
 * `Toolbar`, `GroupList` with `GroupCard`, and `StorageError`. Batch 2b.10 then
 * moved the state out into `store.ts`, so what is left here is the handlers:
 * each one reads the current data through a hook and dispatches one action.
 * The `<header>` stays here because the banner landmark is the page's, not the
 * toolbar's.
 *
 * Three defects are reproduced rather than fixed, each with a note at the site:
 * **DEF-004** (import replaces without asking), **DEF-011** (`ReviewModal.tsx`)
 * and **DEF-013** (`storage.ts`). The CSV format carries three more, listed in
 * `csv.ts`. Fixing any of them inside the batch that ports them would make the
 * cutover impossible to reason about; Phase 3 owns them.
 */

export const App = () => {
  const groups = useGroups();
  const settings = useSettings();
  const template = useTemplate();
  const loadError = useLoadError();
  const loadRepairs = useLoadRepairs();
  const writeError = useWriteError();
  const dispatch = usePlannerDispatch();
  // Read once. Only this component writes it, so it cannot go stale underneath
  // us, and re-reading storage on every render would be work for nothing.
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(() =>
    loadLastBackupAt(),
  );
  // The stamp of the snapshot taken before the last import, while undoing it is
  // still offered. Cleared once used, so the offer cannot outlive the data.
  const [undoStamp, setUndoStamp] = useState<string | null>(null);
  // Which dialog is open is a route now, so a view has a URL and the Back
  // button closes what it opened — see `route.ts` for why the routes are in
  // the hash and what the index-based group link cannot promise.
  const { route, go, replace, close } = useHashRoute();
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

  const isAdding = route.view === "newGroup";
  const openIndex = route.view === "group" ? route.index : null;
  const dialogOpen = isAdding || openIndex !== null;
  // `?? null` because noUncheckedIndexedAccess makes an index access
  // `Group | undefined`, and an out-of-range index is a real possibility while
  // group identity is still the array position.
  const openGroup = openIndex !== null ? (groups[openIndex] ?? null) : null;

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
      // Stay open on the new group, as the legacy app does — and replace the
      // history entry rather than pushing, so Back returns to the list instead
      // of to the add form the group was just created from.
      replace({ view: "group", index: next.length - 1 });
    } else if (openIndex !== null) {
      const existing = next[openIndex];
      if (existing !== undefined) {
        const now = new Date();
        const currentMonthKey = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}`;
        next[openIndex] = {
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

    // DEF-026. This used to send the settings every time, so saving a group's
    // details reset the **app-wide** default currency to that group's currency
    // whether or not the select had been touched — a teacher with one PLN group
    // among her UAH ones flipped the default every time she renamed it.
    //
    // `store.ts` already documented the intended rule: "A group edit carries
    // settings only when the currency select changed." The reducer honoured it;
    // this call site did not. What counts as changed is the currency the dialog
    // opened with — the group's own, or the app default when it has none.
    const previousCurrency = isAdding
      ? settings.defaultCurrency
      : (openGroup?.currency ?? settings.defaultCurrency);

    dispatch({
      type: "groups/commit",
      groups: next,
      ...(draft.currency === previousCurrency
        ? {}
        : { settings: { defaultCurrency: draft.currency } }),
    });
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

  const downloadFile = (contents: string, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentBackupData = (): BackupData => ({
    groupLessonPlannerData: groups,
    groupLessonPlannerSettings: settings,
    paymentTemplate: template,
  });

  const exportBackup = () => {
    // No "nothing to export" guard, unlike the CSV. An empty planner is a
    // legitimate thing to back up — it is exactly the state after a mistaken
    // "Clear all data", and the moment she most wants a file.
    const now = new Date();
    const backup = createBackup(
      currentBackupData(),
      now,
      window.location.origin,
    );
    const stamp = now.toISOString().replace(/[:T]/g, "-").split(".")[0] ?? "";
    downloadFile(
      serializeBackup(backup),
      `lesson-planner-backup-${stamp}.json`,
      "application/json",
    );
    // Recorded only after the download is handed to the browser. Claiming a
    // backup that never happened is worse than claiming none.
    saveLastBackupAt(now);
    setLastBackupAt(now);
  };

  /** The both-sides preview from RP-07 §3 step 5.2, as one confirm. */
  const importPreview = (incoming: BackupData): string => {
    const here = countsLine(currentBackupData());
    const there = countsLine(incoming);
    return [
      "Replace everything in this planner with the backup file?",
      "",
      `Now:  ${here}`,
      `File: ${there}`,
      "",
      "This replaces all groups, settings and the payment template.",
      "You can undo it straight afterwards.",
    ].join("\n");
  };

  const importBackup = (file: File, input: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const backup = parseBackup(text);
        // The dry run: nothing has been written at this point, and saying no
        // leaves the planner exactly as it was.
        if (!window.confirm(importPreview(backup.data))) return;
        const stamp = snapshotBeforeImport(new Date());
        dispatch({
          type: "backup/restore",
          groups: backup.data.groupLessonPlannerData,
          settings: backup.data.groupLessonPlannerSettings,
          template: backup.data.paymentTemplate,
        });
        // Offered only when there is something to put back. A snapshot the
        // browser refused to write must not become a button that does nothing.
        setUndoStamp(hasSnapshot(stamp) ? stamp : null);
        close();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file);
  };

  const undoImport = () => {
    if (undoStamp === null) return;
    const restored = restoreSnapshot(undoStamp);
    setUndoStamp(null);
    if (restored === null) {
      window.alert(
        "That import can no longer be undone: the saved copy is gone.",
      );
      return;
    }
    dispatch({
      type: "backup/restore",
      groups: restored.groups.ok ? restored.groups.value : [],
      settings: restored.settings.ok ? restored.settings.value : settings,
      template: restored.template,
    });
  };

  const importCsv = (file: File, input: HTMLInputElement) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed = deserializeCsv(text);
        // No confirmation, and the replacement is total — DEF-004. The file
        // picker is the only step between a mis-click and losing every group.
        dispatch({
          type: "groups/commit",
          groups: parsed.groups,
          settings: { defaultCurrency: parsed.defaultCurrency },
        });
        close();
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
    dispatch({ type: "data/clear" });
    close();
  };

  const copyMessageFor = (monthKey: MonthKey) => {
    if (openGroup === null) return;
    setReviewMessage(
      generateMonthlyPaymentMessage(
        template ?? DEFAULT_TEMPLATE,
        overridesOf(openGroup),
        monthKey,
        currencyOf(openGroup, settings),
      ),
    );
  };

  const deleteOpenGroup = () => {
    if (openIndex === null || openGroup === null) return;
    if (!window.confirm(`Delete group "${openGroup.name}"?`)) return;
    dispatch({
      type: "groups/commit",
      groups: groups.filter((_, index) => index !== openIndex),
    });
    close();
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
            go({ view: "newGroup" });
          }}
          onEditTemplate={() => {
            go({ view: "template" });
          }}
          onExportCsv={exportCsv}
          onImportCsv={importCsv}
          onExportBackup={exportBackup}
          onImportBackup={importBackup}
          onClearAll={clearAllData}
          backup={backupAge(lastBackupAt, new Date())}
        />
      </header>

      {loadError !== null && <StorageError message={loadError} />}

      {/* Both of these sit above the list rather than replacing it: the data
          loaded, so hiding it would be a worse answer than showing it with a
          note attached. */}
      <StorageRepairs repairs={loadRepairs} />
      {undoStamp !== null && <ImportUndo onUndo={undoImport} />}
      {writeError !== null && <WriteError message={writeError} />}

      {loadError === null && (
        <GroupList
          groups={groups}
          settings={settings}
          onOpen={(index) => {
            go({ view: "group", index });
          }}
        />
      )}

      {dialogOpen && (
        <GroupModal
          group={openGroup ?? null}
          settings={settings}
          startInEditMode={isAdding}
          onSave={saveDraft}
          onDelete={deleteOpenGroup}
          onClose={close}
          onScheduleSave={(next) => {
            if (openIndex === null) return;
            const updated = [...groups];
            updated[openIndex] = next;
            dispatch({ type: "groups/commit", groups: updated });
          }}
          onCopyMessage={copyMessageFor}
          escapeCloses={reviewMessage === null}
        />
      )}

      {route.view === "template" && (
        <TemplateModal
          template={template ?? DEFAULT_TEMPLATE}
          onSave={(next) => {
            dispatch({ type: "template/save", template: next });
            close();
          }}
          onClose={close}
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

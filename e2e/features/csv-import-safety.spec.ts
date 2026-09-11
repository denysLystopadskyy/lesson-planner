import { promises as fs } from "fs";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { importCsv } from "../ui/screenplay/tasks/csv-tasks";
import type { Actor } from "../ui/screenplay/actor";
import { storedGroupNames } from "../ui/support/planner-storage";

/**
 * Importing a CSV, and what it costs when the file is wrong.
 *
 * ISTQB technique: equivalence partitioning on the file. A file is either a
 * valid export, or rejected, or — the partition that matters — accepted while
 * being nonsense. The last one is where the data goes.
 *
 * Import always replaces. There is no merge, so every case here starts with
 * groups already present and asks what is left afterwards.
 *
 * Assertions read storage rather than the cards, so they are in **insertion**
 * order. The alphabetical sort is a rendering step and does not reach the
 * stored array.
 */

const HEADER = "Name,Default Price,Currency,Month,Month Price,Dates";
const VALID_ROW = '"Imported","5","PLN","2026-07","5","2026-07-06"';

const existing = () =>
  plannerState({
    groups: [
      buildGroup({ name: "KeepMe", price: 10, currency: "UAH" }),
      buildGroup({ name: "AlsoKeep", price: 20, currency: "UAH" }),
    ],
  });

/** Writes `content` to a temp file and imports it, capturing any dialog text. */
const importText = async (
  actor: Actor,
  page: import("@playwright/test").Page,
  outputPath: string,
  content: string,
) => {
  await fs.writeFile(outputPath, content, "utf-8");
  let dialogText: string | null = null;
  page.on("dialog", (dialog) => {
    dialogText ??= dialog.message();
    void dialog.accept();
  });
  // Since batch 3.4b **every** import shows a dialog first: the confirm for a
  // readable file, the alert for a refused one. So the helper can wait on that
  // event instead of sleeping. The 300ms sleep it replaced was the elapsed-time
  // wait testing.md forbids, and CI proved the point on this batch's first run.
  await Promise.all([
    page.waitForEvent("dialog"),
    actor.attemptsTo(importCsv(outputPath)),
  ]);
  return () => dialogText;
};

const REJECTED = [
  { label: "an empty file", content: "" },
  { label: "a file with the wrong header", content: "Foo,Bar\r\n1,2" },
  { label: "text that is not CSV at all", content: "just some prose" },
  {
    label: "a row with an unbalanced quote",
    content: `${HEADER}\r\nAb"cd,5,UAH,2026-07,5,2026-07-06`,
  },
  // DEF-020, both shapes a spreadsheet writes. These used to be *accepted*:
  // `Number("250,50")` is NaN, and the fallback turned it into 0, so the file
  // replaced every group and the next payment message asked a parent for
  // nothing. They belong in this list because refusing is the fix — and
  // because the assertion that comes with it, that the existing data survives,
  // is the half that actually mattered.
  {
    label: "a price written with a decimal comma",
    content: `${HEADER}\r\n"Kids","250,50","UAH","","",""`,
  },
  {
    label: "a price written with a thousands separator",
    content: `${HEADER}\r\n"Kids","1 200","UAH","2026-07","300","2026-07-06"`,
  },
];

for (const bad of REJECTED) {
  const rejectTest = configureTest({ plannerState: existing() });

  rejectTest.describe("CSV import — equivalence partitioning", () => {
    rejectTest(
      `Importing ${bad.label} is refused and keeps the existing data`,
      async ({ actor, page, storagePrefix }, testInfo) => {
        const dialog = await importText(
          actor,
          page,
          testInfo.outputPath("bad.csv"),
          bad.content,
        );

        expect(dialog()).toContain("Unable to load CSV:");
        expect(await storedGroupNames(page, storagePrefix)).toEqual([
          "KeepMe",
          "AlsoKeep",
        ]);
      },
    );
  });
}

const unreadablePrice = configureTest({ plannerState: existing() });

unreadablePrice.describe("CSV import — equivalence partitioning", () => {
  unreadablePrice(
    "A refused price says which cell it is and what a price looks like",
    async ({ actor, page }, testInfo) => {
      // "Unable to load CSV" alone leaves the teacher opening a spreadsheet and
      // hunting. The row number is the one she can see in her own editor, and
      // the example is the difference between knowing something is wrong and
      // knowing what to change.
      const dialog = await importText(
        actor,
        page,
        testInfo.outputPath("comma-price.csv"),
        `${HEADER}\r\n"Kids","300","UAH","2026-07","250,50","2026-07-06"`,
      );

      const message = dialog() ?? "";

      expect(message).toContain("Row 2");
      expect(message).toContain("Month Price");
      expect(message).toContain("250,50");
      expect(message).toContain("250.50");
    },
  );
});

const validImport = configureTest({ plannerState: existing() });

validImport.describe("CSV import — equivalence partitioning", () => {
  validImport(
    "A valid file replaces everything that was there, once confirmed",
    async ({ actor, page, storagePrefix }, testInfo) => {
      const dialog = await importText(
        actor,
        page,
        testInfo.outputPath("ok.csv"),
        `${HEADER}\r\n${VALID_ROW}`,
      );

      // Before batch 3.4b nothing was asked at all: the file picker was the
      // only step between a mis-click and losing every group (DEF-004). Now the
      // replacement happens, but only after the question — and `importText`
      // accepts it, which is what makes this the "yes" branch of the pair.
      expect(dialog()).toContain("Replace everything");
      // Polled: accepting the confirm returns before the reducer has written,
      // and the helper no longer sleeps to cover that gap.
      await expect
        .poll(async () => await storedGroupNames(page, storagePrefix))
        .toEqual(["Imported"]);
    },
  );
});

const confirmBeforeReplace = configureTest({ plannerState: existing() });

confirmBeforeReplace.describe("CSV import — equivalence partitioning", () => {
  confirmBeforeReplace(
    "Importing over existing data asks first",
    async ({ actor, page, storagePrefix }, testInfo) => {
      await fs.writeFile(
        testInfo.outputPath("ok.csv"),
        `${HEADER}\r\n${VALID_ROW}`,
        "utf-8",
      );

      // Waits for the dialog **event**, not for the import call to return.
      // `setInputFiles` resolves as soon as the file is attached; the confirm
      // comes later, out of `FileReader.onload`. An assertion straight after
      // the import therefore races the reader — which is exactly how this test
      // passed here and failed in CI on its first run.
      const [dialog] = await Promise.all([
        page.waitForEvent("dialog"),
        actor.attemptsTo(importCsv(testInfo.outputPath("ok.csv"))),
      ]);

      // Before batch 3.4b nothing was asked at all and the replacement was
      // immediate: the file picker was the only step between a mis-click and
      // losing every group (DEF-004).
      expect(dialog.message()).toContain("Replace everything");
      await dialog.dismiss();

      // And dismissing keeps them. `toPass` rather than a bare read: the
      // absence of a write has no event to wait for, so the only honest check
      // is that it stays absent.
      await expect(async () => {
        expect(await storedGroupNames(page, storagePrefix)).toEqual([
          "KeepMe",
          "AlsoKeep",
        ]);
      }).toPass({ timeout: 2000 });
    },
  );
});

const balancedQuote = configureTest({ plannerState: existing() });

balancedQuote.describe("CSV import — equivalence partitioning", () => {
  balancedQuote(
    "A mis-quoted field is refused rather than silently accepted",
    async ({ actor, page, storagePrefix }, testInfo) => {
      const dialog = await importText(
        actor,
        page,
        testInfo.outputPath("evil.csv"),
        // Four quotes, so the parser's "unmatched quote" check is satisfied,
        // but the field is still nonsense.
        `${HEADER}\r\n"a"b"c",5,UAH,2026-07,5,2026-07-06`,
      );

      // Then the file is rejected and the data survives.
      //
      // Today: no dialog, and both groups are replaced by a single group named
      // `abc`. This is the worst defect in the registry — it is silent, it is
      // total, and the only copy of the data is the one it just overwrote. The
      // parser rejects a quote left open at end of file and nothing else.
      // Fixed in plan batch 3.4b.
      expect(dialog()).toContain("Unable to load CSV:");
      expect(await storedGroupNames(page, storagePrefix)).toEqual([
        "KeepMe",
        "AlsoKeep",
      ]);
    },
  );
});

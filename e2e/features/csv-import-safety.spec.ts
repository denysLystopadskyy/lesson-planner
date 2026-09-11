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
  await actor.attemptsTo(importCsv(outputPath));
  // A rejected import shows a dialog; an accepted one shows none. Give the
  // rejection path a moment to fire rather than assuming either outcome.
  await page.waitForTimeout(300);
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
    "A valid file replaces everything that was there, without asking",
    async ({ actor, page, storagePrefix }, testInfo) => {
      const dialog = await importText(
        actor,
        page,
        testInfo.outputPath("ok.csv"),
        `${HEADER}\r\n${VALID_ROW}`,
      );

      // Current behaviour, asserted so the DEF-004 fix has to change it
      // deliberately: two groups are gone and nothing was asked.
      expect(dialog()).toBeNull();
      expect(await storedGroupNames(page, storagePrefix)).toEqual(["Imported"]);
    },
  );
});

const confirmBeforeReplace = configureTest({ plannerState: existing() });

confirmBeforeReplace.describe("CSV import — equivalence partitioning", () => {
  confirmBeforeReplace(
    "Importing over existing data asks first",
    async ({ actor, page, storagePrefix }, testInfo) => {
      confirmBeforeReplace.fixme(
        true,
        "DEF-004: CSV import replaces all data without confirmation",
      );
      await fs.writeFile(
        testInfo.outputPath("ok.csv"),
        `${HEADER}\r\n${VALID_ROW}`,
        "utf-8",
      );

      // Dismissing the confirmation must keep the existing groups.
      let asked = false;
      page.on("dialog", (dialog) => {
        asked = true;
        void dialog.dismiss();
      });
      await actor.attemptsTo(importCsv(testInfo.outputPath("ok.csv")));

      // Today nothing is asked at all and the replacement is immediate. The
      // file dialog is the only step between a mis-click and losing every
      // group. Fixed in plan batch 3.4b.
      expect(asked).toBe(true);
      expect(await storedGroupNames(page, storagePrefix)).toEqual([
        "KeepMe",
        "AlsoKeep",
      ]);
    },
  );
});

const balancedQuote = configureTest({ plannerState: existing() });

balancedQuote.describe("CSV import — equivalence partitioning", () => {
  balancedQuote(
    "A mis-quoted field is refused rather than silently accepted",
    async ({ actor, page, storagePrefix }, testInfo) => {
      balancedQuote.fixme(
        true,
        "DEF-006: a stray balanced quote is accepted and destroys existing data",
      );
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

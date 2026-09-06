import { promises as fs } from "fs";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { exportCsv } from "../ui/screenplay/tasks/csv-tasks";
import type { Actor } from "../ui/screenplay/actor";

/**
 * What the exported file actually contains.
 *
 * Batch 1.5 only checked the download's filename, which RP-03 called out: the
 * export could be wrong in every field and that test would pass. These read the
 * bytes.
 *
 * ISTQB technique: boundary value analysis on field content — the characters
 * that break naive CSV writers are commas, quotes, newlines and non-ASCII text.
 */

const MONTH = "2026-07";
const DATES = ["2026-07-06", "2026-07-13"];

/** Downloads the export and returns its raw bytes, not a decoded string. */
const exportedBytes = async (
  actor: Actor,
  page: import("@playwright/test").Page,
  outputPath: string,
) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    actor.attemptsTo(exportCsv()),
  ]);
  await download.saveAs(outputPath);
  return fs.readFile(outputPath);
};

const awkward = () =>
  plannerState({
    groups: [
      buildGroup({
        name: 'Група, «А» "friday"',
        price: 250,
        currency: "UAH",
        monthlyOverrides: { [MONTH]: { price: 250, dates: DATES } },
      }),
    ],
    template: "Привіт {{month}} {{lessons}} {{total}}",
  });

const exportContract = configureTest({ plannerState: awkward() });

exportContract.describe("CSV export — content contract @ported", () => {
  exportContract(
    "Commas, quotes and Cyrillic survive the export intact",
    async ({ actor, page }, testInfo) => {
      const bytes = await exportedBytes(
        actor,
        page,
        testInfo.outputPath("export.csv"),
      );
      const text = bytes.toString("utf-8");

      // The header is fixed and every field is quoted.
      expect(text.split("\r\n")[0]).toBe(
        '"Name","Default Price","Currency","Month","Month Price","Dates"',
      );
      // A quote inside a field is doubled, per RFC 4180, and the comma and the
      // Cyrillic text come through unchanged.
      expect(text).toContain('"Група, «А» ""friday"""');
      // Dates are space-separated inside one quoted field.
      expect(text).toContain('"2026-07-06 2026-07-13"');
      expect(text.split("\r\n")).toHaveLength(2);
    },
  );
});

const bomTest = configureTest({ plannerState: awkward() });

bomTest.describe("CSV export — content contract @ported", () => {
  bomTest(
    "The export starts with a UTF-8 byte order mark",
    async ({ actor, page }, testInfo) => {
      bomTest.fixme(
        true,
        "DEF-007: CSV export has no UTF-8 BOM; Cyrillic breaks in Excel",
      );
      const bytes = await exportedBytes(
        actor,
        page,
        testInfo.outputPath("export.csv"),
      );

      // Excel on Windows reads a BOM-less file as the system code page, so the
      // Cyrillic group names in this export arrive as mojibake for the one
      // person who uses them. The bytes today begin `"Name`. Fixed in plan
      // batch 3.4b.
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    },
  );
});

const templateTest = configureTest({ plannerState: awkward() });

templateTest.describe("CSV export — content contract @ported", () => {
  templateTest(
    "The export carries the payment template as well as the groups",
    async ({ actor, page }, testInfo) => {
      templateTest.fixme(
        true,
        'DEF-005: CSV export omits the payment template, so the "backup" is incomplete',
      );
      const bytes = await exportedBytes(
        actor,
        page,
        testInfo.outputPath("export.csv"),
      );

      // The template is one of the three things the app stores, and the CSV is
      // the only backup it offers. Export, reinstall, import — and the teacher's
      // customised message is gone with nothing to say it left. Batch 3.3
      // supersedes this with a versioned JSON backup rather than widening CSV.
      expect(bytes.toString("utf-8")).toContain("Привіт");
    },
  );
});

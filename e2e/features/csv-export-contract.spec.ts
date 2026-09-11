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

exportContract.describe("CSV export — content contract", () => {
  exportContract(
    "Commas, quotes and Cyrillic survive the export intact",
    async ({ actor, page }, testInfo) => {
      const bytes = await exportedBytes(
        actor,
        page,
        testInfo.outputPath("export.csv"),
      );
      const text = bytes.toString("utf-8");

      // The header is fixed and every field is quoted. The byte order mark
      // added in batch 3.4b (DEF-007) is stripped first — it has its own test
      // below, and threading it through here would say nothing.
      expect(text.replace(/^\ufeff/, "").split("\r\n")[0]).toBe(
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

bomTest.describe("CSV export — content contract", () => {
  bomTest(
    "The export starts with a UTF-8 byte order mark",
    async ({ actor, page }, testInfo) => {
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

templateTest.describe("CSV export — content contract", () => {
  templateTest(
    "The export carries the groups only, and not the payment template",
    async ({ actor, page }, testInfo) => {
      // This test was DEF-005's pin, and it asserted the opposite: that the
      // export should carry the template. **The pin was retired in batch 3.3
      // rather than turned green**, and the reason is recorded here because a
      // pin that quietly changes sides is worse than one that stays red.
      //
      // DEF-005 was real — the CSV was the only backup the app offered, and it
      // omitted one of the three stored keys, so restoring left the teacher's
      // customised message gone with nothing to say it left. The fix chosen was
      // not to widen the CSV. A CSV cell cannot tell "no template stored" from
      // "an empty template", and a file meant to open in a spreadsheet is the
      // wrong place for a multi-line message with an IBAN in it.
      //
      // So the CSV keeps its job — groups, in a spreadsheet — and
      // `backup-round-trip.spec.ts` holds the assertion this one used to make,
      // against the JSON backup that does carry all three keys. What is
      // asserted here now is that the split is deliberate and stays that way.
      const bytes = await exportedBytes(
        actor,
        page,
        testInfo.outputPath("export.csv"),
      );

      expect(bytes.toString("utf-8")).not.toContain("Привіт");
    },
  );
});

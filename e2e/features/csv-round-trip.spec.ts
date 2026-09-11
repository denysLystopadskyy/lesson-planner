import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { exportCsv, importCsv } from "../ui/screenplay/tasks/csv-tasks";
import { storedGroups, storedTemplate } from "../ui/support/planner-storage";

/**
 * The round trip: export, wipe, import, compare.
 *
 * This is the promise the CSV feature makes — that it is a backup. The test
 * checks the promise for the part of the data CSV carries, and says plainly
 * which part it does not.
 */

const roundTripState = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Група, «А»",
        price: 250,
        currency: "UAH",
        monthlyOverrides: {
          "2026-07": { price: 250, dates: ["2026-07-06", "2026-07-13"] },
          "2026-08": { price: 300, dates: ["2026-08-03"] },
        },
      }),
      buildGroup({ name: "Second", price: 90, currency: "PLN" }),
    ],
    template: "Привіт {{month}} {{lessons}} {{total}}",
  });

const roundTrip = configureTest({ plannerState: roundTripState() });

roundTrip.describe("CSV round trip", () => {
  roundTrip(
    "Groups, months, prices and dates survive export and re-import",
    async ({ actor, page, storagePrefix }, testInfo) => {
      const before = await storedGroups(page, storagePrefix);

      // Export
      const file = testInfo.outputPath("backup.csv");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        actor.attemptsTo(exportCsv()),
      ]);
      await download.saveAs(file);

      // Wipe everything the app stores, then reload from empty
      await page.evaluate(() => {
        localStorage.clear();
      });
      await page.reload();
      expect(await storedGroups(page, storagePrefix)).toEqual([]);

      // Re-import the backup
      await actor.attemptsTo(importCsv(file));
      await expect
        .poll(async () => (await storedGroups(page, storagePrefix)).length)
        .toBe(before.length);

      // Group structure comes back identical, including the Cyrillic name, the
      // comma inside it, two separate months with different prices, and the
      // per-group currency.
      expect(await storedGroups(page, storagePrefix)).toEqual(before);
    },
  );
});

const templateLost = configureTest({ plannerState: roundTripState() });

templateLost.describe("CSV round trip", () => {
  templateLost(
    "The template does not survive the round trip, and nothing says so",
    async ({ actor, page, storagePrefix }, testInfo) => {
      const file = testInfo.outputPath("backup.csv");
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        actor.attemptsTo(exportCsv()),
      ]);
      await download.saveAs(file);

      await page.evaluate(() => {
        localStorage.clear();
      });
      await page.reload();
      await actor.attemptsTo(importCsv(file));
      await expect
        .poll(async () => (await storedGroups(page, storagePrefix)).length)
        .toBe(2);

      // A CSV round trip does not carry the template, and since batch 3.3 that
      // is the decided split rather than DEF-005: the CSV moves groups into a
      // spreadsheet, and the JSON backup is what restores the app. Asserted so
      // the boundary between the two formats cannot drift by accident — see
      // `backup-round-trip.spec.ts` for the format that does carry it.
      const template = await storedTemplate(page, storagePrefix);
      expect(template).toBeNull();
    },
  );
});

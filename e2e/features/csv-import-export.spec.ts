import { promises as fs } from "fs";
import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import { formatCurrency } from "../ui/support/formatters";
import { plannerState } from "../ui/support/planner-state";
import {
  buildGroup,
  pickCurrency,
  pickMonthContext,
  randomDatesInMonth,
} from "../ui/support/test-data";
import { exportCsv, importCsv } from "../ui/screenplay/tasks/csv-tasks";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  monthRowLessonCount,
  monthRowPerLessonText,
  monthRowTotalText,
} from "../ui/screenplay/questions/monthly-questions";

const escapeCsv = (value: string | number) => {
  return `"${String(value).replace(/"/g, '""')}"`;
};

const buildCsv = (rows: Array<Array<string | number>>) => {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
};

const exportSeed = 1313;
faker.seed(exportSeed);
const exportGroup = buildGroup();
const exportWithGroupsTest = configureTest({
  plannerState: plannerState({
    groups: [exportGroup],
  }),
});

exportWithGroupsTest.describe("CSV export — decision table @ported", () => {
  exportWithGroupsTest(
    "Exporting with groups downloads a file",
    async ({ actor, page }) => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        actor.attemptsTo(exportCsv()),
      ]);

      expect(download.suggestedFilename()).toMatch(/^lesson-planner-.*\.csv$/);
    },
  );
});

const noGroupSeed = 1414;
faker.seed(noGroupSeed);
const noGroupCurrency = pickCurrency();
const exportEmptyTest = configureTest({
  plannerState: plannerState({
    groups: [],
    defaultCurrency: noGroupCurrency,
  }),
});

exportEmptyTest.describe("CSV export — decision table @ported", () => {
  exportEmptyTest(
    "Exporting with no groups explains why nothing happened",
    async ({ actor, page }) => {
      const dialogPromise = page.waitForEvent("dialog");
      const exportPromise = actor.attemptsTo(exportCsv());
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe("There are no groups to export yet.");
      await dialog.accept();
      await exportPromise;
    },
  );
});

const importSeed = 1515;
faker.seed(importSeed);
const importContext = pickMonthContext();
const importGroupName = faker.company.name();
const importDefaultPrice = faker.number.int({ min: 100, max: 1500 });
const importCurrency = pickCurrency();
const importMonthPrice = faker.number.int({ min: 120, max: 2000 });
const importDates = randomDatesInMonth({
  year: importContext.year,
  monthIndex: importContext.monthIndex,
  count: faker.number.int({ min: 2, max: 4 }),
});

const importCsvContent = buildCsv([
  ["Name", "Default Price", "Currency", "Month", "Month Price", "Dates"],
  [
    importGroupName,
    importDefaultPrice,
    importCurrency,
    importContext.key,
    importMonthPrice,
    importDates.join(" "),
  ],
]);
const importValidTest = configureTest({
  plannerState: plannerState({
    groups: [],
    defaultCurrency: importCurrency,
  }),
});

importValidTest.describe("CSV import — decision table @ported", () => {
  importValidTest(
    "A valid file restores the group, its month and its prices",
    async ({ actor }, testInfo) => {
      const csvPath = testInfo.outputPath("import.csv");
      await fs.writeFile(csvPath, importCsvContent, "utf-8");

      await actor.attemptsTo(importCsv(csvPath));
      await actor.attemptsTo(openGroupCard(importGroupName));

      const expectedTotal = formatCurrency(
        importMonthPrice * importDates.length,
        importCurrency,
      );
      const expectedPerLesson = formatCurrency(
        importMonthPrice,
        importCurrency,
      );

      await expect(
        await actor.asks(monthRowLessonCount(importContext.key)),
      ).toHaveText(`(${String(importDates.length)} lessons)`);
      await expect(
        await actor.asks(monthRowPerLessonText(importContext.key)),
      ).toContainText(expectedPerLesson);
      await expect(
        await actor.asks(monthRowTotalText(importContext.key)),
      ).toContainText(expectedTotal);
    },
  );
});

const invalidSeed = 1616;
faker.seed(invalidSeed);
const invalidMonth = faker.number.int({ min: 13, max: 24 });
const invalidYear = faker.number.int({ min: 2000, max: 2030 });
const invalidCurrency = pickCurrency();
const invalidCsvContent = buildCsv([
  ["Name", "Default Price", "Currency", "Month", "Month Price", "Dates"],
  [
    faker.company.name(),
    faker.number.int({ min: 100, max: 900 }),
    invalidCurrency,
    `${String(invalidYear)}-${String(invalidMonth)}`,
    "",
    "",
  ],
]);
const importInvalidTest = configureTest({
  plannerState: plannerState({
    groups: [],
    defaultCurrency: invalidCurrency,
  }),
});

importInvalidTest.describe("CSV import — decision table @ported", () => {
  importInvalidTest(
    "A file with an impossible month is rejected",
    async ({ actor, page }, testInfo) => {
      const csvPath = testInfo.outputPath("invalid.csv");
      await fs.writeFile(csvPath, invalidCsvContent, "utf-8");

      const dialogPromise = page.waitForEvent("dialog");
      const importPromise = actor.attemptsTo(importCsv(csvPath));
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain("Unable to load CSV:");
      await dialog.accept();
      await importPromise;
    },
  );
});

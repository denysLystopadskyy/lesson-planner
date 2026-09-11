import { promises as fs } from "fs";
import type { Page } from "@playwright/test";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import type { Actor } from "../ui/screenplay/actor";
import {
  exportBackup,
  importBackup,
  undoImport,
} from "../ui/screenplay/tasks/csv-tasks";
import {
  storedGroupNames,
  storedGroups,
  storedTemplate,
} from "../ui/support/planner-storage";

/**
 * The versioned JSON backup — plan batch 3.3, closing DEF-005.
 *
 * The defect was that the app's only backup could not restore the app: the CSV
 * export omits the payment template, so export–reinstall–import returned the
 * groups and silently dropped the teacher's payment details. The fix is a
 * second format rather than a wider CSV — a spreadsheet cell cannot tell "no
 * template stored" from "an empty template", and a file meant to open in Excel
 * is the wrong home for a multi-line message with bank details in it.
 *
 * Technique: state transition testing on the data — full planner → exported →
 * cleared → restored, and the branch back out of a restore through undo. The
 * round trip is the only assertion that proves the file is worth keeping; every
 * other test here guards a way it could stop being worth keeping.
 */

const TEMPLATE = "Привіт! За {{month}}: {{lessons}} занять, {{total}}.";

const planner = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Група, «А»",
        price: 250,
        currency: "UAH",
        monthlyOverrides: {
          "2026-07": { price: 250, dates: ["2026-07-06", "2026-07-13"] },
        },
      }),
      buildGroup({ name: "Wednesday Advanced", price: 300, currency: "UAH" }),
    ],
    defaultCurrency: "UAH",
    template: TEMPLATE,
  });

/** Downloads the backup and returns the file's text. */
const exportedText = async (
  actor: Actor,
  page: Page,
  outputPath: string,
): Promise<string> => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    actor.attemptsTo(exportBackup()),
  ]);
  await download.saveAs(outputPath);
  return fs.readFile(outputPath, "utf-8");
};

/**
 * Answers every confirm, and reports what each one asked.
 *
 * Every message, not just the first: the round trip below answers two — "Clear
 * all data" and then the import preview — and a handler that kept only the
 * first would assert against the wrong question and pass for the wrong reason.
 */
const answerConfirms = (page: Page, accept: boolean) => {
  const asked: string[] = [];
  page.on("dialog", (dialog) => {
    asked.push(dialog.message());
    void (accept ? dialog.accept() : dialog.dismiss());
  });
  return () => asked;
};

/** The last thing the app asked, or "" when it asked nothing. */
const lastAsked = (asked: () => string[]): string => asked().at(-1) ?? "";

/* ---------------------------------------------------------------------------
 * What the file contains.
 * ------------------------------------------------------------------------- */

const contents = configureTest({ plannerState: planner() });

contents.describe("Backup file — content contract", () => {
  contents(
    "Carries all three stored keys",
    async ({ actor, page }, testInfo) => {
      // DEF-005 in one assertion, and the one the CSV could never satisfy.
      const text = await exportedText(
        actor,
        page,
        testInfo.outputPath("backup.json"),
      );
      const backup: unknown = JSON.parse(text);

      expect(text).toContain(TEMPLATE);
      expect(backup).toMatchObject({
        format: "group-lesson-planner-backup",
        schemaVersion: 1,
        data: {
          groupLessonPlannerSettings: { defaultCurrency: "UAH" },
          paymentTemplate: TEMPLATE,
        },
      });
    },
  );

  contents(
    "Is readable by a person, not one long line",
    async ({ actor, page }, testInfo) => {
      // The file is the escape hatch for the app disappearing. If she has to
      // open it in a text editor, she should be able to find her groups.
      const text = await exportedText(
        actor,
        page,
        testInfo.outputPath("backup.json"),
      );

      expect(text.split("\n").length).toBeGreaterThan(10);
      expect(text).toContain("Група, «А»");
    },
  );

  contents(
    "Records when it was made, and updates the indicator",
    async ({ actor, page }, testInfo) => {
      const { planner: plannerPage } = actor.abilityTo(BrowseTheWeb);

      // Before: this profile has never saved one.
      await expect(plannerPage.backupIndicator).toHaveText(
        "No backup saved yet",
      );

      await exportedText(actor, page, testInfo.outputPath("backup.json"));

      await expect(plannerPage.backupIndicator).toHaveText(
        "Last backup: today",
      );
    },
  );
});

/* ---------------------------------------------------------------------------
 * The round trip: export, clear, restore.
 * ------------------------------------------------------------------------- */

const roundTrip = configureTest({ plannerState: planner() });

roundTrip.describe("Backup — state transition testing", () => {
  roundTrip(
    "Export, clear everything, import: the planner comes back whole",
    async ({ actor, page, storagePrefix }, testInfo) => {
      const { planner: plannerPage } = actor.abilityTo(BrowseTheWeb);
      const file = testInfo.outputPath("backup.json");

      // Given a planner with groups and a customised template, exported
      const before = await storedGroups(page, storagePrefix);
      await exportedText(actor, page, file);

      // When everything is cleared and the backup is loaded back
      const asked = answerConfirms(page, true);
      await plannerPage.clearAllData();
      await actor.attemptsTo(importBackup(file));

      // Then the groups are byte-identical to what was stored before, and the
      // template is back — which the CSV round trip cannot do.
      await expect
        .poll(async () => (await storedGroups(page, storagePrefix)).length)
        .toBe(2);
      expect(await storedGroups(page, storagePrefix)).toEqual(before);
      expect(await storedTemplate(page, storagePrefix)).toBe(TEMPLATE);
      expect(lastAsked(asked)).toContain("Replace everything");
    },
  );

  roundTrip(
    "The preview counts both sides before anything is replaced",
    async ({ actor, page, storagePrefix }, testInfo) => {
      // RP-07 §3 step 5.2: the machine must not decide which copy wins, so it
      // has to show enough for the person to. Counting only the incoming file
      // would let her approve a replacement without knowing what she is losing.
      const file = testInfo.outputPath("backup.json");
      await exportedText(actor, page, file);

      const asked = answerConfirms(page, false);
      await actor.attemptsTo(importBackup(file));
      await page.waitForTimeout(300);

      const message = lastAsked(asked);
      expect(message).toContain("Now:");
      expect(message).toContain("File:");
      expect(message).toContain("2 groups");

      // And saying no changes nothing at all.
      expect(await storedGroupNames(page, storagePrefix)).toEqual([
        "Група, «А»",
        "Wednesday Advanced",
      ]);
    },
  );
});

/* ---------------------------------------------------------------------------
 * Undoing an import.
 * ------------------------------------------------------------------------- */

const undoable = configureTest({ plannerState: planner() });

undoable.describe("Backup — state transition testing", () => {
  undoable(
    "An import can be undone, and the planner returns to what it was",
    async ({ actor, page, storagePrefix }, testInfo) => {
      // The confirm covers the mis-click. This covers the case it cannot:
      // choosing the wrong file, and only seeing it once the screen redraws.
      const { planner: plannerPage } = actor.abilityTo(BrowseTheWeb);
      const file = testInfo.outputPath("other.json");
      await fs.writeFile(
        file,
        JSON.stringify({
          format: "group-lesson-planner-backup",
          schemaVersion: 1,
          data: {
            groupLessonPlannerData: [
              { name: "Somebody Else", price: 1, dates: [] },
            ],
            groupLessonPlannerSettings: { defaultCurrency: "PLN" },
            paymentTemplate: null,
          },
        }),
        "utf-8",
      );

      answerConfirms(page, true);
      await actor.attemptsTo(importBackup(file));
      await expect
        .poll(async () => await storedGroupNames(page, storagePrefix))
        .toEqual(["Somebody Else"]);

      await actor.attemptsTo(undoImport());

      await expect
        .poll(async () => await storedGroupNames(page, storagePrefix))
        .toEqual(["Група, «А»", "Wednesday Advanced"]);
      // The template came back too — the wrong file had none, and a restore
      // that dropped it would have been a second silent loss.
      expect(await storedTemplate(page, storagePrefix)).toBe(TEMPLATE);
      await expect(plannerPage.undoImportButton).toBeHidden();
    },
  );
});

/* ---------------------------------------------------------------------------
 * Files that must be refused.
 * ------------------------------------------------------------------------- */

const REFUSED = [
  { label: "a file that is not JSON", contents: "not json at all {{{" },
  { label: "another application's JSON", contents: '{"hello":"world"}' },
  {
    label: "the app's own CSV export",
    contents: "Name,Default Price,Currency,Month,Month Price,Dates",
  },
  {
    label: "a backup from a newer version of the planner",
    contents: JSON.stringify({
      format: "group-lesson-planner-backup",
      schemaVersion: 99,
      data: {
        groupLessonPlannerData: [],
        groupLessonPlannerSettings: { defaultCurrency: "PLN" },
        paymentTemplate: null,
      },
    }),
  },
];

for (const bad of REFUSED) {
  const refuses = configureTest({ plannerState: planner() });

  refuses.describe("Backup import — equivalence partitioning", () => {
    refuses(
      `Importing ${bad.label} is refused and keeps the existing data`,
      async ({ actor, page, storagePrefix }, testInfo) => {
        // Import replaces everything, so a partly-applied file is data loss.
        // Each of these is refused whole, and the planner is untouched.
        const file = testInfo.outputPath("bad.json");
        await fs.writeFile(file, bad.contents, "utf-8");
        const asked = answerConfirms(page, true);

        await actor.attemptsTo(importBackup(file));
        await page.waitForTimeout(300);

        // The refusal reaches the user: a file the app will not read must say
        // so, not fail quietly and leave her wondering whether it worked.
        expect(lastAsked(asked)).not.toBe("");
        expect(await storedGroupNames(page, storagePrefix)).toEqual([
          "Група, «А»",
          "Wednesday Advanced",
        ]);
        expect(await storedTemplate(page, storagePrefix)).toBe(TEMPLATE);
      },
    );
  });
}

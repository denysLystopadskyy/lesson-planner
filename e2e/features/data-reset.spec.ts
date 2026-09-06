import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import { storedTemplate } from "../ui/support/planner-storage";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { clearAllData } from "../ui/screenplay/tasks/data-reset-tasks";
import { emptyStateVisible } from "../ui/screenplay/assertions/planner-assertions";
import { groupCardVisible } from "../ui/screenplay/assertions/group-assertions";

/**
 * ISTQB technique: decision table.
 *
 * "Clear all data" has one input — the browser confirmation — and the table has
 * two rows: accept wipes the planner, dismiss changes nothing. A third case
 * covers what the wipe is supposed to reach, which today it does not (DEF-013).
 */

const confirmSeed = 1717;
faker.seed(confirmSeed);
const confirmGroup = buildGroup();
const confirmResetTest = configureTest({
  plannerState: plannerState({
    groups: [confirmGroup],
  }),
});

confirmResetTest.describe("Clear all data — decision table @ported", () => {
  confirmResetTest(
    "Accepting the confirmation wipes the planner",
    async ({ actor, page }) => {
      // Given a planner holding one group
      // When the user clears all data and accepts the confirmation
      const dialogPromise = page.waitForEvent("dialog");
      const clearPromise = actor.attemptsTo(clearAllData());
      const dialog = await dialogPromise;
      await dialog.accept();
      await clearPromise;

      // Then the planner is empty.
      await actor.verifies(
        emptyStateVisible("empty state should be visible after clearing"),
      );
    },
  );
});

const cancelSeed = 1818;
faker.seed(cancelSeed);
const cancelGroup = buildGroup();
const cancelResetTest = configureTest({
  plannerState: plannerState({
    groups: [cancelGroup],
  }),
});

cancelResetTest.describe(
  "Cancel clear all data — decision table @ported",
  () => {
    cancelResetTest(
      "Dismissing the confirmation changes nothing",
      async ({ actor, page }) => {
        // Given a planner holding one group
        // When the user clears all data but dismisses the confirmation
        const dialogPromise = page.waitForEvent("dialog");
        const clearPromise = actor.attemptsTo(clearAllData());
        const dialog = await dialogPromise;
        await dialog.dismiss();
        await clearPromise;

        // Then the group is still there.
        await actor.verifies(groupCardVisible(cancelGroup.name));
      },
    );
  },
);

/**
 * DEF-013. This describes the DESIRED behavior, not the current one, per the
 * pinning rule in .claude/context/testing.md — a test never asserts a bug as
 * the expected result. Plan batch 3.4b removes the `fixme` in the same PR as
 * the fix.
 *
 * Today `storage.clear()` removes `groupLessonPlannerData` and
 * `groupLessonPlannerSettings` and leaves `paymentTemplate` behind, so a user
 * who clears their data keeps a payment message template they thought was gone.
 *
 * The template is seeded explicitly because `buildStorageState` only writes that
 * key when one is supplied — and seeding it also keeps the app's real default
 * template, which carries personal payment identifiers, out of this test and out
 * of any failure artifact. See .claude/context/security-auth.md.
 */
const templateSeed = 1919;
faker.seed(templateSeed);
const seededTemplate = `${faker.lorem.sentence()} {{month}} {{lessons}} {{total}}`;
const clearTemplateTest = configureTest({
  plannerState: plannerState({
    groups: [buildGroup()],
    template: seededTemplate,
  }),
});

clearTemplateTest.describe("Clear all data — decision table @ported", () => {
  clearTemplateTest(
    "Clearing all data also removes the payment template",
    async ({ actor, page, storagePrefix }) => {
      clearTemplateTest.fixme(
        true,
        "DEF-013: clear all data leaves the template key behind",
      );

      // Given a planner with a group and a saved template
      const before = await storedTemplate(page, storagePrefix);
      expect(before).toBe(seededTemplate);

      // When the user clears all data and accepts
      const dialogPromise = page.waitForEvent("dialog");
      const clearPromise = actor.attemptsTo(clearAllData());
      const dialog = await dialogPromise;
      await dialog.accept();
      await clearPromise;
      await actor.verifies(
        emptyStateVisible("empty state should be visible after clearing"),
      );

      // Then no planner key survives, the template included.
      expect(await storedTemplate(page, storagePrefix)).toBeNull();
    },
  );
});

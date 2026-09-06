import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup, pickCurrency } from "../ui/support/test-data";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import {
  addGroup,
  closeModalWithEscape,
  deleteGroup,
  editGroupInfo,
  openGroupCard,
} from "../ui/screenplay/tasks/group-tasks";
import { groupCardLessonCount } from "../ui/screenplay/questions/group-questions";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import {
  groupCardVisible,
  groupInfoUpdated,
} from "../ui/screenplay/assertions/group-assertions";
import { emptyStateVisible } from "../ui/screenplay/assertions/planner-assertions";

/**
 * ISTQB technique: state transition testing.
 *
 * A group moves through absent -> created -> edited -> deleted, and the planner
 * moves between the empty state and a populated list. Each test drives one
 * transition and asserts the state it lands in.
 *
 * Test data is generated at module scope after an explicit `faker.seed(...)`,
 * so it is identical on every run and on every worker. In-test faker calls are
 * reseeded per test from the title plus the worker index, so they vary by
 * worker — fine for values nothing asserts against a fixed expectation.
 */

const addGroupSeed = 1201;
faker.seed(addGroupSeed);
const addGroupData = {
  name: faker.company.name(),
  price: faker.number.int({ min: 50, max: 1200 }),
  currency: pickCurrency(),
};
const addGroupTest = configureTest({
  plannerState: plannerState({
    groups: [],
    defaultCurrency: addGroupData.currency,
  }),
});

addGroupTest.describe("Group management — state transition testing", () => {
  addGroupTest("A new group starts with no lessons", async ({ actor }) => {
    // Given an empty planner
    // When the user adds a group
    await addGroupTest.step("add a group", async () => {
      await actor.attemptsTo(
        addGroup({
          name: addGroupData.name,
          price: addGroupData.price,
          currency: addGroupData.currency,
        }),
      );
    });

    // Then its card appears in the list, counting no lessons yet.
    await expect(
      await actor.asks(groupCardLessonCount(addGroupData.name)),
    ).toHaveText("0 planned lessons");
  });
});

const editGroupSeed = 2202;
faker.seed(editGroupSeed);
const editGroupExisting = buildGroup();
const editGroupTest = configureTest({
  plannerState: plannerState({
    groups: [editGroupExisting],
  }),
});

editGroupTest.describe("Group editing — state transition testing", () => {
  editGroupTest(
    "Editing name, price and currency updates both the modal and the card",
    async ({ actor }) => {
      // Given an existing group, opened
      await actor.attemptsTo(openGroupCard(editGroupExisting.name));

      // The dialog's structure is checked once, as an accessibility smoke check.
      // The assertions that carry the meaning of this test come after it.
      //
      // The `- strong: /[A-Za-z]+ \d{4}/` line matches the month row the app
      // always renders for the current month. It is month- and year-agnostic on
      // purpose: the seeded group has no lessons, so exactly one row renders and
      // this stays true across any month or year boundary without clock control.
      const modal = actor.abilityTo(BrowseTheWeb).groupModal.panel;
      await expectAriaSnapshot(
        modal,
        `
- heading "Edit Group" [level=3]
- text: /Group Name .* Default Price .* Currency .*/
- button /Edit group details/: /✏️/
- separator
- heading "Monthly Overrides & Schedule" [level=4]
- button /Edit Schedule/
- strong: /[A-Za-z]+ \\d{4}/
- text: /\\(\\d+ lessons\\) Total:\\s.* Per lesson:\\s.*/
- button /Copy Payment Message/ [disabled]
- button "Delete Group"
`,
      );

      const updatedName = faker.company.name();
      const updatedPrice = faker.number.int({ min: 100, max: 1500 });
      const updatedCurrency = pickCurrency();

      // When all three fields change and are saved
      await actor.attemptsTo(
        editGroupInfo({
          name: updatedName,
          price: updatedPrice,
          currency: updatedCurrency,
        }),
      );

      // Then the modal shows the new values
      await actor.verifies(
        groupInfoUpdated({
          name: updatedName,
          price: updatedPrice,
          currency: updatedCurrency,
        }),
      );

      // And the card behind it follows the rename.
      await actor.attemptsTo(closeModalWithEscape());
      await actor.verifies(groupCardVisible(updatedName));
    },
  );
});

const deleteGroupSeed = 3303;
faker.seed(deleteGroupSeed);
const deleteGroupExisting = buildGroup();
const deleteGroupTest = configureTest({
  plannerState: plannerState({
    groups: [deleteGroupExisting],
  }),
});

deleteGroupTest.describe("Group deletion — state transition testing", () => {
  deleteGroupTest(
    "Deleting the only group returns the planner to its empty state",
    async ({ actor, page }) => {
      // Given the only group, opened
      await actor.attemptsTo(openGroupCard(deleteGroupExisting.name));

      // When the user deletes it and confirms
      const dialogPromise = page.waitForEvent("dialog");
      const deletePromise = actor.attemptsTo(deleteGroup());
      const dialog = await dialogPromise;

      // The confirmation names the group, so it cannot be accepted blind.
      expect(dialog.message()).toContain(deleteGroupExisting.name);
      await dialog.accept();
      await deletePromise;

      // Then the planner is empty again.
      await actor.verifies(
        emptyStateVisible("empty state should be visible after delete"),
      );
    },
  );
});

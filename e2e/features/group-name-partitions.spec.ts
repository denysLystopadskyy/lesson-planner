import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { storedGroupNames } from "../ui/support/planner-storage";

/**
 * ISTQB technique: equivalence partitioning on the group name.
 *
 * The partitions are: ordinary text, blank, a name that already exists, and a
 * name containing HTML. The app treats blank differently depending on whether
 * the group is being created or edited, so blank is two cases, not one.
 */

const nameOnAdd = configureTest({ plannerState: plannerState({ groups: [] }) });

nameOnAdd.describe("Group name — equivalence partitioning", () => {
  nameOnAdd("Ordinary text is kept as typed", async ({ actor, page }) => {
    const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

    // Given an empty planner
    // When a group is added with an ordinary name
    await planner.openAddGroupModal();
    await groupModal.groupNameInput.fill("Tuesday Beginners");
    await groupModal.saveGroup();

    // Then that is the name stored and shown.
    expect(await storedGroupNames(page)).toEqual(["Tuesday Beginners"]);
    await expect(
      planner.groupCard("Tuesday Beginners").getByTestId("group-card-name"),
    ).toHaveText("Tuesday Beginners");
  });

  nameOnAdd(
    "A blank name on create falls back to 'Untitled Group'",
    async ({ actor, page }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      // When a group is saved with the name left blank
      await planner.openAddGroupModal();
      await groupModal.groupNameInput.fill("");
      await groupModal.saveGroup();

      // Then the create fallback is used. Note this differs from the edit
      // fallback below — the app uses two different defaults.
      expect(await storedGroupNames(page)).toEqual(["Untitled Group"]);
    },
  );
});

const nameOnEdit = configureTest({
  plannerState: plannerState({ groups: [buildGroup({ name: "Original" })] }),
});

nameOnEdit.describe("Group name — equivalence partitioning", () => {
  nameOnEdit(
    "A blank name on edit falls back to 'Untitled', not 'Untitled Group'",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);

      // Given an existing group
      await actor.attemptsTo(openGroupCard("Original"));

      // When its name is cleared and saved
      await groupModal.enterEditMode();
      await groupModal.groupNameInput.fill("");
      await groupModal.saveGroup();

      // Then a different default appears than the one create uses. This is the
      // app's real behaviour and the test pins it, but the inconsistency is
      // unlikely to be deliberate — recorded on the batch page as a question
      // for the owner rather than invented as a defect.
      expect(await storedGroupNames(page)).toEqual(["Untitled"]);
    },
  );
});

const duplicateName = configureTest({
  plannerState: plannerState({ groups: [buildGroup({ name: "Same Name" })] }),
});

duplicateName.describe("Group name — equivalence partitioning", () => {
  duplicateName(
    "A duplicate name is accepted and produces two indistinguishable cards",
    async ({ actor, page }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      // Given a group called "Same Name"
      // When a second group is created with exactly that name
      await planner.openAddGroupModal();
      await groupModal.groupNameInput.fill("Same Name");
      await groupModal.saveGroup();
      await page.keyboard.press("Escape");

      // Then both exist, and nothing on the card distinguishes them. The tests
      // locate cards by `data-group-name`, so this is also the case that would
      // make such a locator ambiguous.
      expect(await storedGroupNames(page)).toEqual(["Same Name", "Same Name"]);
      await expect(planner.groupCard("Same Name")).toHaveCount(2);
    },
  );
});

const htmlName = configureTest({ plannerState: plannerState({ groups: [] }) });

htmlName.describe("Group name — equivalence partitioning", () => {
  htmlName(
    "A name containing HTML is displayed as text, not parsed as markup",
    async ({ actor, page }) => {
      htmlName.fixme(
        true,
        "DEF-014: the group name is written into innerHTML without escaping",
      );
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      // Given an empty planner
      // When a group is named with something that looks like markup
      await planner.openAddGroupModal();
      await groupModal.groupNameInput.fill("<b>bold</b>");
      await groupModal.saveGroup();
      await page.keyboard.press("Escape");

      // Then the name is shown literally and no element is created from it.
      // Today the opposite happens: the stored value is correct, but the card
      // renders a real <b> and reads "bold". The sink is `card.innerHTML` in
      // `createGroupCard`. Fixed in plan batch 3.2 by React's escaping.
      const card = page.locator(".group-card").first();
      expect(await storedGroupNames(page)).toEqual(["<b>bold</b>"]);
      await expect(card.locator("b")).toHaveCount(0);
      await expect(card.getByTestId("group-card-name")).toHaveText(
        "<b>bold</b>",
      );
    },
  );
});

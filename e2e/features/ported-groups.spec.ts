import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import {
  addGroup,
  closeModalWithEscape,
  deleteGroup,
  editGroupInfo,
  openGroupCard,
} from "../ui/screenplay/tasks/group-tasks";
import { groupCardLessonCount } from "../ui/screenplay/questions/group-questions";
import { groupInfoUpdated } from "../ui/screenplay/assertions/group-assertions";
import { emptyStateVisible } from "../ui/screenplay/assertions/planner-assertions";
import { storedGroupNames, storedPriceOf } from "../ui/support/planner-storage";
import { PORTED_STORAGE_PREFIX } from "../ui/support/environment";

/**
 * Group CRUD against the React port — `@ported`, so these run only at `/next/`.
 *
 * They reuse the same Screenplay tasks the legacy specs use. That is the real
 * test of the port: the same actions, driven through the same page objects,
 * against different markup.
 */

const emptyPlanner = configureTest({
  plannerState: plannerState({ groups: [] }),
});

emptyPlanner.describe("Ported groups @ported @portedonly", () => {
  emptyPlanner(
    "A group can be added from the empty state",
    async ({ actor }) => {
      await actor.attemptsTo(
        addGroup({ name: "Ported Group", price: 250, currency: "UAH" }),
      );

      await expect(
        await actor.asks(groupCardLessonCount("Ported Group")),
      ).toHaveText("0 planned lessons");
    },
  );
});

const oneGroup = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Editable", price: 100, currency: "UAH" })],
  }),
});

oneGroup.describe("Ported groups @ported @portedonly", () => {
  oneGroup(
    "Editing name, price and currency updates the card",
    async ({ actor, page }) => {
      await actor.attemptsTo(openGroupCard("Editable"));
      await actor.attemptsTo(
        editGroupInfo({ name: "Renamed", price: 321, currency: "PLN" }),
      );

      await actor.verifies(
        groupInfoUpdated({ name: "Renamed", price: 321, currency: "PLN" }),
      );
      await actor.attemptsTo(closeModalWithEscape());
      expect(await storedGroupNames(page, PORTED_STORAGE_PREFIX)).toEqual([
        "Renamed",
      ]);
      expect(await storedPriceOf(page, "Renamed", PORTED_STORAGE_PREFIX)).toBe(
        321,
      );
    },
  );
});

const deletable = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Doomed", price: 10, currency: "UAH" })],
  }),
});

deletable.describe("Ported groups @ported @portedonly", () => {
  deletable(
    "Deleting the only group returns the empty state",
    async ({ actor, page }) => {
      await actor.attemptsTo(openGroupCard("Doomed"));

      const dialogPromise = page.waitForEvent("dialog");
      const deletePromise = actor.attemptsTo(deleteGroup());
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain("Doomed");
      await dialog.accept();
      await deletePromise;

      await actor.verifies(emptyStateVisible("empty state after delete"));
      expect(await storedGroupNames(page, PORTED_STORAGE_PREFIX)).toEqual([]);
    },
  );
});

/**
 * The port must not inherit DEF-008 or DEF-009. Both are pinned against the
 * legacy app in `group-form-exits.spec.ts` and stay pinned there; these assert
 * the fixed behaviour here, unpinned, so a regression in the port fails loudly.
 */

const cancelRevertsPrice = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Exit Fixture", price: 100, currency: "UAH" })],
  }),
});

cancelRevertsPrice.describe("Ported groups @ported @portedonly", () => {
  cancelRevertsPrice(
    "Cancel discards a price edit — DEF-008 is not inherited",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Exit Fixture"));

      await groupModal.enterEditMode();
      await groupModal.groupPriceInput.fill("777");
      await groupModal.cancelButton.click();

      // The legacy app shows "UAH 777.00" here while storage still holds 100.
      await expect(groupModal.priceDisplay).toHaveText("UAH 100.00");
      expect(
        await storedPriceOf(page, "Exit Fixture", PORTED_STORAGE_PREFIX),
      ).toBe(100);
    },
  );
});

const priceKeepsName = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Exit Fixture", price: 100, currency: "UAH" })],
  }),
});

priceKeepsName.describe("Ported groups @ported @portedonly", () => {
  priceKeepsName(
    "Changing the price keeps an unsaved name — DEF-009 is not inherited",
    async ({ actor }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Exit Fixture"));

      await groupModal.enterEditMode();
      await groupModal.groupNameInput.fill("Typed But Unsaved");
      await groupModal.groupPriceInput.fill("250");
      await groupModal.groupPriceInput.blur();

      // In the legacy app the name box reverts to the stored name here.
      await expect(groupModal.groupNameInput).toHaveValue("Typed But Unsaved");
    },
  );
});

const hookSubset = configureTest({
  plannerState: plannerState({
    groups: [buildGroup({ name: "Hooked", price: 10, currency: "UAH" })],
  }),
});

hookSubset.describe("Ported groups @ported @portedonly", () => {
  hookSubset(
    "The group-level frozen hooks are present on the ported markup",
    async ({ actor }) => {
      const { planner } = actor.abilityTo(BrowseTheWeb);
      const card = planner.groupCard("Hooked");

      // The four hooks this slice is responsible for. The remaining ten need
      // the monthly rows and calendar from 2a.3c, and the full contract spec
      // runs against /next/ from 2a.3d — see the batch page.
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("data-group-index", "0");
      await expect(card.getByTestId("group-card-name")).toHaveText("Hooked");
      await expect(card.getByTestId("group-card-lesson-count")).toHaveText(
        "0 planned lessons",
      );
    },
  );
});

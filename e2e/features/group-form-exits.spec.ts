import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { storedGroupNames, storedPriceOf } from "../ui/support/planner-storage";

/**
 * ISTQB technique: decision table for leaving the group form.
 *
 * Conditions: how the form is left (Save, Cancel, Escape, click the overlay)
 * and whether anything was changed. Actions: is the change kept, and is the
 * dialog still open.
 *
 * | Exit    | With changes            | Without changes |
 * | ------- | ----------------------- | --------------- |
 * | Save    | kept, dialog stays open | no-op           |
 * | Cancel  | discarded, stays open   | no-op           |
 * | Escape  | discarded, dialog closes| no-op           |
 * | Overlay | discarded, dialog closes| no-op           |
 *
 * Two cells are defects rather than design, and are pinned as such below:
 * a price edit survives Cancel (DEF-008), and changing the price throws away an
 * unsaved name edit (DEF-009).
 */

const START_NAME = "Exit Fixture";
const START_PRICE = 100;

// Currency is pinned, not left to faker: one assertion below checks the
// formatted price text, which carries the currency code.
const fixture = () =>
  plannerState({
    groups: [
      buildGroup({ name: START_NAME, price: START_PRICE, currency: "UAH" }),
    ],
  });

const saveExit = configureTest({ plannerState: fixture() });

saveExit.describe("Leaving the group form — decision table @ported", () => {
  saveExit(
    "Save keeps the change and leaves the dialog open",
    async ({ actor, page, storagePrefix }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(START_NAME));

      await groupModal.enterEditMode();
      await groupModal.groupNameInput.fill("Saved Name");
      await groupModal.saveGroup();

      expect(await storedGroupNames(page, storagePrefix)).toEqual([
        "Saved Name",
      ]);
      await expect(groupModal.modal).toBeVisible();
    },
  );
});

const cancelNameExit = configureTest({ plannerState: fixture() });

cancelNameExit.describe(
  "Leaving the group form — decision table @ported",
  () => {
    cancelNameExit(
      "Cancel discards a name edit",
      async ({ actor, page, storagePrefix }) => {
        const { groupModal } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(START_NAME));

        await groupModal.enterEditMode();
        await groupModal.groupNameInput.fill("Discarded");
        await groupModal.cancelButton.click();

        expect(await storedGroupNames(page, storagePrefix)).toEqual([
          START_NAME,
        ]);
        // Cancel leaves edit mode but keeps the dialog open — it cancels the edit,
        // not the dialog. Escape and the overlay are what close it.
        await expect(groupModal.modal).toBeVisible();
      },
    );
  },
);

const cancelPriceExit = configureTest({ plannerState: fixture() });

cancelPriceExit.describe("Leaving the group form — decision table", () => {
  cancelPriceExit(
    "Cancel discards a price edit too",
    async ({ actor, page, storagePrefix }) => {
      cancelPriceExit.fixme(
        true,
        "DEF-008: Cancel does not revert a default-price change",
      );
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(START_NAME));

      // Given an edit in progress
      await groupModal.enterEditMode();

      // When the price is changed and the edit cancelled
      await groupModal.groupPriceInput.fill("777");
      await groupModal.cancelButton.click();

      // Then the summary shows the old price again, exactly as it does for the
      // name above.
      //
      // Today it shows "UAH 777.00". Note where the damage is: the price
      // input's `onchange` mutates the in-memory group but does not call
      // `storage.save()`, so localStorage still holds 100 while the screen says
      // 777. Cancel reverts neither. The next action that does trigger a save —
      // editing the schedule, say — then persists the abandoned price.
      //
      // Asserting on storage alone would pass while the defect is present,
      // which is why this asserts what the user can actually see.
      await expect(groupModal.priceDisplay).toHaveText("UAH 100.00");
      expect(await storedPriceOf(page, START_NAME, storagePrefix)).toBe(
        START_PRICE,
      );
    },
  );
});

const priceKeepsName = configureTest({ plannerState: fixture() });

priceKeepsName.describe("Leaving the group form — decision table", () => {
  priceKeepsName(
    "Changing the price keeps an unsaved name edit",
    async ({ actor }) => {
      priceKeepsName.fixme(
        true,
        "DEF-009: a price change silently reverts an unsaved name edit",
      );
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(START_NAME));

      // Given a name typed but not yet saved
      await groupModal.enterEditMode();
      await groupModal.groupNameInput.fill("Typed But Unsaved");

      // When the price is changed, committing the field
      await groupModal.groupPriceInput.fill("250");
      await groupModal.groupPriceInput.blur();

      // Then the typed name is still in the box. Today it is not: the price
      // `onchange` re-renders the whole group info and overwrites the field with
      // the stored name. This is also why `fillGroupInfo` must fill price before
      // name. Fixed in plan batch 3.4a.
      await expect(groupModal.groupNameInput).toHaveValue("Typed But Unsaved");
    },
  );
});

const escapeExit = configureTest({ plannerState: fixture() });

escapeExit.describe("Leaving the group form — decision table @ported", () => {
  escapeExit(
    "Escape discards the edit and closes the dialog",
    async ({ actor, page, storagePrefix }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(START_NAME));

      await groupModal.enterEditMode();
      await groupModal.groupNameInput.fill("Never Saved");
      await page.keyboard.press("Escape");

      expect(await storedGroupNames(page, storagePrefix)).toEqual([START_NAME]);
      await expect(groupModal.modal).toBeHidden();
    },
  );
});

const overlayExit = configureTest({ plannerState: fixture() });

/**
 * Legacy-only, deliberately. The React port ships no stylesheet until batch
 * 2b.7, so `.modal-overlay` is not a full-screen backdrop there — it wraps the
 * panel tightly and the corner this test clicks is inside the panel. The
 * handler exists in `GroupModal.tsx`; there is simply no backdrop area to hit.
 * Tag this `@ported` when 2b.7 lands the styles.
 */
overlayExit.describe("Leaving the group form — decision table", () => {
  overlayExit(
    "Clicking the overlay discards the edit and closes the dialog",
    async ({ actor, page, storagePrefix }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(START_NAME));

      await groupModal.enterEditMode();
      await groupModal.groupNameInput.fill("Never Saved");
      // The overlay is the dialog's backdrop; clicking its corner avoids the
      // panel in the middle.
      await groupModal.modal.click({ position: { x: 5, y: 5 } });

      expect(await storedGroupNames(page, storagePrefix)).toEqual([START_NAME]);
      await expect(groupModal.modal).toBeHidden();
    },
  );
});

const noChangeExit = configureTest({ plannerState: fixture() });

noChangeExit.describe("Leaving the group form — decision table @ported", () => {
  noChangeExit(
    "Leaving without changing anything is a no-op, however you leave",
    async ({ actor, page, storagePrefix }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);

      // The "without changes" column collapses to one case: nothing the four
      // exits do can alter state that was never edited.
      for (const leave of [
        async () => {
          await groupModal.enterEditMode();
          await groupModal.saveGroup();
        },
        async () => {
          await groupModal.enterEditMode();
          await groupModal.cancelButton.click();
        },
        async () => {
          await page.keyboard.press("Escape");
        },
      ]) {
        await actor.attemptsTo(openGroupCard(START_NAME));
        await leave();
        expect(await storedGroupNames(page, storagePrefix)).toEqual([
          START_NAME,
        ]);
        expect(await storedPriceOf(page, START_NAME, storagePrefix)).toBe(
          START_PRICE,
        );
        await page.keyboard.press("Escape");
      }
    },
  );
});

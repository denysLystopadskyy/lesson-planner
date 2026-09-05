import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { storedPriceOf } from "../ui/support/planner-storage";

/**
 * ISTQB technique: boundary value analysis on the default price.
 *
 * The app stores `Number(input.value) || 0`, so the interesting values sit
 * around zero, around the smallest currency unit, and outside the range a price
 * can sensibly take. The input is `type="number"` with no `min`, `max` or
 * `step`, so the browser rejects none of them.
 *
 * Two of these cases have no agreed answer yet — see the note on the negative
 * and fractional cases. They assert what the app does today so that a future
 * decision changes a test deliberately rather than silently.
 */

type PriceCase = {
  readonly label: string;
  readonly typed: string;
  readonly stored: number;
};

const CASES: readonly PriceCase[] = [
  { label: "zero", typed: "0", stored: 0 },
  { label: "the smallest fraction", typed: "0.01", stored: 0.01 },
  { label: "a large value", typed: "999999999", stored: 999999999 },
  { label: "a negative value", typed: "-5", stored: -5 },
  // `Number("") || 0` — the empty string coerces to 0, not NaN.
  { label: "left empty", typed: "", stored: 0 },
];

for (const priceCase of CASES) {
  const priceTest = configureTest({
    plannerState: plannerState({ groups: [] }),
  });

  priceTest.describe("Default price — boundary value analysis", () => {
    priceTest(
      `A price of ${priceCase.label} is stored as ${String(priceCase.stored)}`,
      async ({ actor, page }) => {
        const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);
        const name = `Price ${priceCase.label}`;

        // Given an empty planner
        // When a group is saved with this price
        await planner.openAddGroupModal();
        await groupModal.groupNameInput.fill(name);
        await groupModal.groupPriceInput.fill(priceCase.typed);
        await groupModal.saveGroup();

        // Then the stored value is exactly this.
        expect(await storedPriceOf(page, name)).toBe(priceCase.stored);
      },
    );
  });
}

/**
 * The negative and fractional cases above are recorded behaviour, not approved
 * behaviour. Nothing in the app rejects a negative price, and a negative price
 * produces a negative month total and a negative figure in the payment message
 * the teacher sends. Whether that should be blocked is a product question
 * raised by RP-01 and still open; it is not in the DEF registry because nobody
 * has decided it is wrong.
 *
 * This test states the consequence plainly, so the decision is made against
 * something concrete rather than in the abstract.
 */
const negativeTotal = configureTest({
  plannerState: plannerState({ groups: [] }),
});

negativeTotal.describe("Default price — boundary value analysis", () => {
  negativeTotal(
    "A negative price reaches the month total unchallenged",
    async ({ actor, page }) => {
      const { planner, groupModal } = actor.abilityTo(BrowseTheWeb);

      await planner.openAddGroupModal();
      await groupModal.groupNameInput.fill("Negative");
      await groupModal.groupPriceInput.fill("-100");
      await groupModal.saveGroup();

      // No dialog, no validation message, no clamping — the group summary
      // simply shows a negative amount of money.
      expect(await storedPriceOf(page, "Negative")).toBe(-100);
      await expect(groupModal.priceDisplay).toHaveText("-UAH 100.00");
    },
  );
});

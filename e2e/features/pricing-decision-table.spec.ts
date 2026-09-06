import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { storedGroups } from "../ui/support/planner-storage";

/**
 * ISTQB technique: decision table for the effective price of a month.
 *
 * A month's price comes from the group default unless the month carries an
 * override. Changing the default then cascades, but only into some months —
 * `updateDefaultPrice` rewrites an override only when it is **not in the past**
 * and its price still equals the **old** default. Four rows, one per
 * combination that matters.
 *
 * | Month    | Override price   | Cascades? |
 * | -------- | ---------------- | --------- |
 * | past     | old default      | no        |
 * | current  | old default      | yes       |
 * | future   | old default      | yes       |
 * | future   | custom           | no        |
 *
 * "Past", "current" and "future" are relative to the pinned instant, June 2026.
 */

const GROUP = "Pricing Fixture";
const OLD_DEFAULT = 100;
const NEW_DEFAULT = 200;
const CUSTOM = 555;

const overrideFor = (month: string, price: number) => ({
  price,
  dates: [`${month}-05`, `${month}-12`],
});

const fixture = () =>
  plannerState({
    groups: [
      buildGroup({
        name: GROUP,
        price: OLD_DEFAULT,
        currency: "UAH",
        monthlyOverrides: {
          "2026-05": overrideFor("2026-05", OLD_DEFAULT), // past
          "2026-06": overrideFor("2026-06", OLD_DEFAULT), // current
          "2026-07": overrideFor("2026-07", OLD_DEFAULT), // future
          "2026-08": overrideFor("2026-08", CUSTOM), // future, custom
        },
      }),
    ],
  });

const pricesByMonth = async (page: import("@playwright/test").Page) => {
  const overrides = (await storedGroups(page))[0]?.monthlyOverrides ?? {};
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [key, value.price]),
  );
};

const cascade = configureTest({ plannerState: fixture() });

cascade.describe("Effective price — decision table", () => {
  cascade(
    "Raising the default rewrites only current and future months still on the old default",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP));

      // When the group default price is raised
      await groupModal.enterEditMode();
      await groupModal.groupPriceInput.fill(String(NEW_DEFAULT));
      await groupModal.saveGroup();

      // Then exactly the two eligible months move.
      expect(await pricesByMonth(page)).toEqual({
        "2026-05": OLD_DEFAULT, // past — left alone
        "2026-06": NEW_DEFAULT, // current — cascaded
        "2026-07": NEW_DEFAULT, // future — cascaded
        "2026-08": CUSTOM, // deliberately priced — not overwritten
      });
    },
  );
});

const noCascadeWithoutMatch = configureTest({ plannerState: fixture() });

noCascadeWithoutMatch.describe("Effective price — decision table", () => {
  noCascadeWithoutMatch(
    "A month priced by hand is never touched by a later default change",
    async ({ actor, page }) => {
      const { groupModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP));

      // Two default changes in a row, so the second cannot match the first's
      // old value either.
      await groupModal.enterEditMode();
      await groupModal.groupPriceInput.fill("300");
      await groupModal.saveGroup();
      await groupModal.enterEditMode();
      await groupModal.groupPriceInput.fill("400");
      await groupModal.saveGroup();

      const prices = await pricesByMonth(page);
      expect(prices["2026-08"]).toBe(CUSTOM);
      // And the cascade still follows the moving default for eligible months.
      expect(prices["2026-07"]).toBe(400);
    },
  );
});

const rowTotals = configureTest({ plannerState: fixture() });

rowTotals.describe("Effective price — decision table", () => {
  rowTotals(
    "Each month row shows its own price times its own lessons",
    async ({ actor }) => {
      const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP));

      // Two lessons per month in the fixture, so the totals are derived rather
      // than copied from the app.
      await expect(monthlyOverrides.perLessonText("2026-07")).toContainText(
        "100.00",
      );
      await expect(monthlyOverrides.totalText("2026-07")).toContainText(
        "200.00",
      );
      await expect(monthlyOverrides.perLessonText("2026-08")).toContainText(
        "555.00",
      );
      await expect(monthlyOverrides.totalText("2026-08")).toContainText(
        "1,110.00",
      );
    },
  );
});

const rowStructure = configureTest({ plannerState: fixture() });

rowStructure.describe("Effective price — decision table", () => {
  rowStructure("A month row keeps its structure", async ({ actor }) => {
    const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard(GROUP));

    await expectAriaSnapshot(
      monthlyOverrides.rowByMonthKey("2026-07"),
      `
- strong: /July 2026/
- text: /\\(2 lessons\\) Total:\\s.* Per lesson:\\s.*/
- button /Copy Payment Message/
`,
    );
  });
});

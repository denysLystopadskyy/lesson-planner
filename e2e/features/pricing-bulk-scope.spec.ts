import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { storedGroups } from "../ui/support/planner-storage";

/**
 * The bulk price control — "set price for selected dates".
 *
 * Two groups here. The first is the scope question, which is a pinned defect
 * (DEF-010). The second is boundary value analysis on the input itself.
 *
 * DEF-008 and DEF-009 are pinned in batch 1.8's `group-form-exits.spec.ts`
 * rather than repeated here; this batch's plan page lists them, but a defect
 * wants one pin, not two that can drift apart.
 */

const GROUP = "Bulk Fixture";
const DEFAULT_PRICE = 100;

const fixture = () =>
  plannerState({
    groups: [
      buildGroup({ name: GROUP, price: DEFAULT_PRICE, currency: "UAH" }),
    ],
  });

const pricesByMonth = async (
  page: import("@playwright/test").Page,
  storagePrefix: string,
) => {
  const overrides =
    (await storedGroups(page, storagePrefix))[0]?.monthlyOverrides ?? {};
  return Object.fromEntries(
    Object.entries(overrides).map(([key, value]) => [key, value.price]),
  );
};

const bulkScope = configureTest({ plannerState: fixture() });

bulkScope.describe("Bulk price — scope @ported", () => {
  bulkScope(
    "A bulk price applies only to the month on screen",
    async ({ actor, page, storagePrefix }) => {
      bulkScope.fixme(
        true,
        "DEF-010: bulk price rewrites every month holding a selected date, not just the visible one",
      );
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      // Given a date picked in June
      await calendarEditor.dayCell(2026, 5, 8).click();

      // And another picked in July, which is now the month on screen
      await calendarEditor.nextMonthButton.click();
      await calendarEditor.dayCell(2026, 6, 8).click();

      // When a price is set for the selected dates
      await calendarEditor.selectedDatesPriceInput.fill("777");
      await calendarEditor.selectedDatesPriceInput.press("Tab");
      await calendarEditor.saveButton.click();

      // Then only July moves; June keeps the group default.
      //
      // Today both change. `setBulkPrice` collects every month that holds a
      // selected date and writes the price into all of them, so a selection
      // made earlier in another month is silently repriced. The user cannot see
      // June while doing this. Batch 3.4a must either fix this or record it as
      // intended — the DEF registry marks it "decision needed".
      expect(await pricesByMonth(page, storagePrefix)).toEqual({
        "2026-06": DEFAULT_PRICE,
        "2026-07": 777,
      });
    },
  );
});

const singleMonthBulk = configureTest({ plannerState: fixture() });

singleMonthBulk.describe("Bulk price — scope @ported", () => {
  singleMonthBulk(
    "With one month selected the bulk price is unambiguous",
    async ({ actor, page, storagePrefix }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      await calendarEditor.dayCell(2026, 5, 8).click();
      await calendarEditor.dayCell(2026, 5, 15).click();
      await calendarEditor.selectedDatesPriceInput.fill("250");
      await calendarEditor.selectedDatesPriceInput.press("Tab");
      await calendarEditor.saveButton.click();

      // The case DEF-010 does not affect, kept so the fix has a green
      // neighbour to preserve.
      expect(await pricesByMonth(page, storagePrefix)).toEqual({
        "2026-06": 250,
      });
    },
  );
});

/**
 * ISTQB technique: boundary value analysis on the bulk price input.
 *
 * The control is disabled until something is selected, which is itself a
 * boundary worth asserting. The empty case is the interesting one: the code
 * guards on `NaN`, but `Number("")` is `0`, so clearing the box prices the
 * month at zero instead of leaving it alone.
 */

const disabledUntilSelection = configureTest({ plannerState: fixture() });

disabledUntilSelection.describe(
  "Bulk price — boundary value analysis @ported",
  () => {
    disabledUntilSelection(
      "The input is disabled until at least one date is selected",
      async ({ actor }) => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        await expect(calendarEditor.selectedDatesPriceInput).toBeDisabled();
        await calendarEditor.dayCell(2026, 5, 8).click();
        await expect(calendarEditor.selectedDatesPriceInput).toBeEnabled();
      },
    );
  },
);

type BulkCase = {
  readonly label: string;
  readonly typed: string;
  readonly stored: number;
};

const BULK_CASES: readonly BulkCase[] = [
  { label: "zero", typed: "0", stored: 0 },
  { label: "the smallest fraction", typed: "0.01", stored: 0.01 },
  { label: "a large value", typed: "999999999", stored: 999999999 },
];

for (const bulkCase of BULK_CASES) {
  const bulkBoundary = configureTest({ plannerState: fixture() });

  bulkBoundary.describe("Bulk price — boundary value analysis @ported", () => {
    bulkBoundary(
      `A bulk price of ${bulkCase.label} is stored as ${String(bulkCase.stored)}`,
      async ({ actor, page, storagePrefix }) => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        await calendarEditor.dayCell(2026, 5, 8).click();
        await calendarEditor.selectedDatesPriceInput.fill(bulkCase.typed);
        await calendarEditor.selectedDatesPriceInput.press("Tab");
        await calendarEditor.saveButton.click();

        expect(await pricesByMonth(page, storagePrefix)).toEqual({
          "2026-06": bulkCase.stored,
        });
      },
    );
  });
}

const emptyBulk = configureTest({ plannerState: fixture() });

emptyBulk.describe("Bulk price — boundary value analysis @ported", () => {
  emptyBulk(
    "An empty bulk price silently reprices the month to zero",
    async ({ actor, page, storagePrefix }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      await calendarEditor.dayCell(2026, 5, 8).click();
      await calendarEditor.selectedDatesPriceInput.fill("");
      await calendarEditor.selectedDatesPriceInput.press("Tab");
      await calendarEditor.saveButton.click();

      // The month is repriced to zero, and no warning is given.
      //
      // `setBulkPrice` guards with `if (isNaN(newPrice)) return`, which looks
      // like it protects an empty box — but `Number("")` is `0`, not `NaN`, so
      // the guard never fires and clearing the field silently makes the month
      // free. The guard only catches text a `number` input will not accept in
      // the first place, so it is effectively dead.
      //
      // Recorded as current behaviour rather than filed: whether an empty box
      // should mean "zero" or "leave it alone" is a product question, and it is
      // on the batch page for the owner.
      expect(await pricesByMonth(page, storagePrefix)).toEqual({
        "2026-06": 0,
      });
    },
  );
});

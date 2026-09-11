import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";

/**
 * The test-hook contract.
 *
 * This is a guard, not a coverage group, so it names no ISTQB technique: it
 * asserts nothing about behavior. It exists so that renaming or dropping a hook
 * fails here, loudly and in one place, instead of failing as a confusing
 * locator timeout spread across the feature specs.
 *
 * The frozen list is recorded in .claude/context/testing.md. Adding a hook is
 * allowed; renaming or removing one is a contract change. Keep the two lists in
 * step with that file.
 */

/** The 8 frozen `data-testid` values. */
const FROZEN_TESTIDS = [
  "copy-payment-message",
  "group-card-lesson-count",
  "group-card-name",
  "month-lesson-count",
  "month-name",
  "month-total",
  "price-per-lesson",
] as const;

/** The 6 frozen dataset hooks, as their rendered attribute names. */
const FROZEN_DATASET_HOOKS = [
  "data-group-name",
  "data-group-index",
  "data-month-key",
  "data-weekday",
  "data-date",
  "data-day",
] as const;

/**
 * A month far enough from today that the app's "always show the current month"
 * row can never collide with it. The suite does not control the clock yet, so
 * the seeded month is pinned instead of computed.
 */
const SEEDED_MONTH = "2030-03";
const SEEDED_DATES = ["2030-03-04", "2030-03-11"];

const contractTest = configureTest({
  plannerState: plannerState({
    groups: [
      buildGroup({
        name: "Contract Group",
        price: 200,
        currency: "UAH",
        dates: SEEDED_DATES,
        monthlyOverrides: {
          [SEEDED_MONTH]: { price: 200, dates: SEEDED_DATES },
        },
      }),
    ],
  }),
});

contractTest(
  "Group card exposes its two testids and two dataset hooks",
  async ({ actor }) => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    const card = planner.groupCard("Contract Group");

    await expect(card, "the card is located by data-group-name").toBeVisible();
    await expect(card).toHaveAttribute("data-group-index", "0");
    await expect(card.getByTestId("group-card-name")).toHaveText(
      "Contract Group",
    );
    await expect(card.getByTestId("group-card-lesson-count")).toHaveText(
      "2 planned lessons",
    );
  },
);

contractTest(
  "Month row exposes its view-mode testids and dataset hook",
  async ({ actor }) => {
    const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Contract Group"));

    const row = monthlyOverrides.rowByMonthKey(SEEDED_MONTH);
    await expect(row, "the row is located by data-month-key").toBeVisible();
    await expect(monthlyOverrides.lessonCount(SEEDED_MONTH)).toHaveText(
      "(2 lessons)",
    );
    await expect(row.getByTestId("month-name")).toContainText("March 2030");
    await expect(monthlyOverrides.totalText(SEEDED_MONTH)).toContainText("400");
    await expect(monthlyOverrides.perLessonText(SEEDED_MONTH)).toContainText(
      "200",
    );
    await expect(monthlyOverrides.copyButton(SEEDED_MONTH)).toBeEnabled();
  },
);

contractTest(
  "Calendar exposes the weekday, date and day hooks",
  async ({ actor }) => {
    const { groupModal, calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Contract Group"));
    await groupModal.editScheduleButton.click();

    await expect(calendarEditor.container).toBeVisible();

    // Weekday headers: Monday is index 0 because the week starts on Monday.
    await expect(calendarEditor.weekdayHeader(0)).toHaveText("Mon");

    // Day cells carry all three of date, day and weekday.
    const firstDay = calendarEditor.calendar.locator("[data-date]").first();
    await expect(firstDay).toHaveAttribute("data-date", /^\d{4}-\d{2}-\d{2}$/);
    await expect(firstDay).toHaveAttribute("data-day", /^\d{1,2}$/);
    await expect(firstDay).toHaveAttribute("data-weekday", /^[0-6]$/);
  },
);

/**
 * `month-price-input` **left the contract in batch 3.7**, and this is what
 * replaced its guard.
 *
 * The hook used to be asserted as attached-but-hidden: the app rendered the
 * inline price inputs into `#monthlySection` in the same handler that set that
 * section to `display: none`, so the control was in the DOM and no user could
 * ever reach it — DEF-017. The comment here said that whichever way the defect
 * was settled, this assertion would notice. It has: the branch was deleted
 * (owner decision, 2026-09-11), so the hook is gone and the assertion is now
 * that it stays gone.
 *
 * That matters more than it looks. A frozen hook that quietly disappears is the
 * failure the contract exists to catch, so removing one has to be as loud as
 * renaming one. `.claude/context/testing.md` changed in the same PR, which that
 * document requires.
 */
contractTest(
  "The inline month price input is gone, and stays gone",
  async ({ actor }) => {
    const { groupModal, page } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Contract Group"));

    // In view mode the row shows the price it always did. This is the control
    // the deleted input was a second, unreachable way of changing.
    await expect(page.getByTestId("price-per-lesson").first()).toBeVisible();

    await groupModal.editScheduleButton.click();

    await expect(
      page.getByTestId("month-price-input"),
      "DEF-017 deleted this control; the calendar's bulk price sets a month price now",
    ).toHaveCount(0);

    // `price-per-lesson` is still rendered while the calendar is open — it is
    // simply inside `#monthlySection`, which the editor hides. That hiding is
    // the mechanism that made the deleted input unreachable, so asserting it
    // here keeps the reason for the deletion in view.
    await expect(page.getByTestId("price-per-lesson").first()).toBeAttached();
    await expect(page.getByTestId("price-per-lesson").first()).toBeHidden();
  },
);

/**
 * The completeness check. The three tests above assert each hook where it
 * belongs; this one walks the same states and proves that every frozen name is
 * accounted for, so a rename cannot slip through by being asserted nowhere.
 */
contractTest(
  "Every frozen hook is present across the states that render it",
  async ({ actor }) => {
    const { planner, groupModal, page } = actor.abilityTo(BrowseTheWeb);
    const seen = new Set<string>();

    const collect = async () => {
      for (const id of await page
        .locator("[data-testid]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-testid") ?? ""),
        )) {
        seen.add(id);
      }
      // Counted together, then filtered — rather than an `if` inside the loop.
      // A conditional in a test usually means the test asserts different things
      // in different runs, which is what `playwright/no-conditional-in-test`
      // is for; this one only builds an inventory that is asserted
      // unconditionally below. Restructuring says that more clearly than a
      // suppression comment would, and the counts now run in parallel.
      const counts = await Promise.all(
        FROZEN_DATASET_HOOKS.map((attr) => page.locator(`[${attr}]`).count()),
      );
      FROZEN_DATASET_HOOKS.filter(
        (_, index) => (counts[index] ?? 0) > 0,
      ).forEach((attr) => seen.add(attr));
    };

    await expect(planner.groupCard("Contract Group")).toBeVisible();
    await collect(); // group list
    await actor.attemptsTo(openGroupCard("Contract Group"));
    await collect(); // group modal, view mode
    await groupModal.editScheduleButton.click();
    await expect(page.locator("[data-date]").first()).toBeVisible();
    await collect(); // calendar, edit mode

    const missing = [...FROZEN_TESTIDS, ...FROZEN_DATASET_HOOKS].filter(
      (name) => !seen.has(name),
    );
    expect(
      missing,
      `frozen hooks missing from the app: ${missing.join(", ")}`,
    ).toEqual([]);
  },
);

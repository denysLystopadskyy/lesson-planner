import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { storedGroups } from "../ui/support/planner-storage";

/**
 * Picking dates without a mouse.
 *
 * This was the largest accessibility gap in the app: thirty-odd day cells and
 * seven weekday headings, every one of them a `<div>` with an `onClick` and no
 * way in from the keyboard. Batch 2b.4 made the grid a real grid — one tab
 * stop, a roving tabindex, arrows to move, Space to select.
 *
 * ISTQB technique: boundary value analysis on the grid's edges. The interesting
 * cells are the first, the last, the ends of a week row, and the ones an arrow
 * would have to leave the month to reach.
 *
 * **The group is seeded with no dates on purpose.** `pendingDates` starts from
 * every date the group has in every month, and the bulk price input is disabled
 * only while that set is empty — so a group with dates opens the editor with an
 * extra tab stop, and the tab-order assertion below would be wrong by one.
 *
 * The clock is pinned to 2026-06-15, and June 2026 starts on a Monday: no
 * leading spacers, thirty cells. The spacer case therefore needs another month,
 * which is why one test navigates to March 2026.
 */

const GROUP = "Schedule Fixture";

const noDates = () =>
  plannerState({
    groups: [
      buildGroup({ name: GROUP, price: 100, currency: "UAH", dates: [] }),
    ],
  });

const tabStop = configureTest({ plannerState: noDates() });

tabStop.describe("Calendar keyboard access — boundary value analysis", () => {
  tabStop("The whole grid is one tab stop", async ({ actor, page }) => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

    // From the last control before the grid, one Tab reaches the grid and the
    // next leaves it. Thirty cells and seven headers add a single stop.
    await calendarEditor.clearMonthButton.focus();
    await page.keyboard.press("Tab");
    await expect(calendarEditor.dayCell(2026, 5, 15)).toBeFocused();

    // And the next Tab leaves the grid entirely. It lands on Cancel, not on
    // the price input, because that input is disabled until something is
    // selected — a disabled control is not a tab stop, which is the behaviour
    // `pricing-bulk-scope.spec.ts` pins from the other side.
    await page.keyboard.press("Tab");
    await expect(calendarEditor.selectedDatesPriceInput).toBeDisabled();
    await expect(calendarEditor.cancelButton).toBeFocused();
  });
});

const entryFocus = configureTest({ plannerState: noDates() });

entryFocus.describe(
  "Calendar keyboard access — boundary value analysis",
  () => {
    entryFocus("Opening the editor puts focus on today", async ({ actor }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      // The editor replaces the control that had focus — the pencil unmounts and
      // the monthly section is hidden — so without moving focus it would fall to
      // <body> and a keyboard user would tab in from the top of the dialog again.
      // The entry cell is the first selected date in the month, else today, else
      // the 1st; nothing is selected here, and the clock is pinned to the 15th.
      await expect(calendarEditor.dayCell(2026, 5, 15)).toBeFocused();
    });
  },
);

const arrows = configureTest({ plannerState: noDates() });

arrows.describe("Calendar keyboard access — boundary value analysis", () => {
  arrows("Arrows move by a day and by a week", async ({ actor, page }) => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());
    await calendarEditor.dayCell(2026, 5, 15).focus();

    await page.keyboard.press("ArrowRight");
    await expect(calendarEditor.dayCell(2026, 5, 16)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(calendarEditor.dayCell(2026, 5, 23)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(calendarEditor.dayCell(2026, 5, 22)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(calendarEditor.dayCell(2026, 5, 15)).toBeFocused();
  });
});

const edges = configureTest({ plannerState: noDates() });

edges.describe("Calendar keyboard access — boundary value analysis", () => {
  edges("An arrow never leaves the month", async ({ actor, page }) => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

    // The month is clamped rather than spilling into the next one. That is a
    // deliberate choice: a spill re-renders the grid under the key press, and
    // then focus has to be restored to a cell that did not exist a moment ago
    // — the class of timing bug that cost batch 1.10 half a day. Page Up and
    // Page Down change the month instead, on purpose and one screen at a time.
    await calendarEditor.dayCell(2026, 5, 1).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(calendarEditor.dayCell(2026, 5, 1)).toBeFocused();
    await expect(calendarEditor.monthSelect).toHaveValue("5");

    await calendarEditor.dayCell(2026, 5, 30).focus();
    await page.keyboard.press("ArrowRight");
    await expect(calendarEditor.dayCell(2026, 5, 30)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(calendarEditor.dayCell(2026, 5, 30)).toBeFocused();
    await expect(calendarEditor.monthSelect).toHaveValue("5");
  });
});

const rowEnds = configureTest({ plannerState: noDates() });

rowEnds.describe("Calendar keyboard access — boundary value analysis", () => {
  rowEnds(
    "Home and End reach the ends of the week",
    async ({ actor, page }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());
      await calendarEditor.dayCell(2026, 5, 17).focus();

      // 17 June 2026 is a Wednesday, so its week runs Monday the 15th to Sunday
      // the 21st.
      await page.keyboard.press("Home");
      await expect(calendarEditor.dayCell(2026, 5, 15)).toBeFocused();
      await page.keyboard.press("End");
      await expect(calendarEditor.dayCell(2026, 5, 21)).toBeFocused();

      // And with Control, the ends of the month.
      await page.keyboard.press("ControlOrMeta+Home");
      await expect(calendarEditor.dayCell(2026, 5, 1)).toBeFocused();
      await page.keyboard.press("ControlOrMeta+End");
      await expect(calendarEditor.dayCell(2026, 5, 30)).toBeFocused();
    },
  );
});

const paging = configureTest({ plannerState: noDates() });

paging.describe("Calendar keyboard access — boundary value analysis", () => {
  paging(
    "Page Up and Page Down change the month, keeping the day",
    async ({ actor, page }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());
      await calendarEditor.dayCell(2026, 5, 15).focus();

      await page.keyboard.press("PageDown");
      await expect(calendarEditor.monthSelect).toHaveValue("6");
      await expect(calendarEditor.dayCell(2026, 6, 15)).toBeFocused();

      // Back to March, which is the month with leading spacers — June 2026 has
      // none, so nothing else in the suite renders one. Then to the 31st, and one
      // page forward into April, which has 30 days: the day is clamped, not lost.
      await page.keyboard.press("PageUp");
      await page.keyboard.press("PageUp");
      await page.keyboard.press("PageUp");
      await page.keyboard.press("PageUp");
      await expect(calendarEditor.monthSelect).toHaveValue("2");
      await expect(
        calendarEditor.calendar.locator(
          '[role="gridcell"][aria-hidden="true"]',
        ),
      ).toHaveCount(6);

      await page.keyboard.press("ControlOrMeta+End");
      await expect(calendarEditor.dayCell(2026, 2, 31)).toBeFocused();
      await page.keyboard.press("PageDown");
      await expect(calendarEditor.dayCell(2026, 3, 30)).toBeFocused();
    },
  );
});

const selecting = configureTest({ plannerState: noDates() });

selecting.describe("Calendar keyboard access — boundary value analysis", () => {
  selecting(
    "Space selects the focused date and Space again clears it",
    async ({ actor, page }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());
      await calendarEditor.dayCell(2026, 5, 15).focus();

      await page.keyboard.press(" ");
      await expect(calendarEditor.dayCell(2026, 5, 15)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // The class is what paints it, and the attribute is what a screen reader
      // reads. Both, because either alone can go stale.
      // The class that paints it is scoped to the component now, so it is not a
      // thing a test can name. The state is `aria-selected` above, and the paint
      // is covered by the calendar's pixel baseline.

      await page.keyboard.press(" ");
      await expect(calendarEditor.dayCell(2026, 5, 15)).toHaveAttribute(
        "aria-selected",
        "false",
      );
      await expect(calendarEditor.dayCell(2026, 5, 15)).not.toHaveClass(
        /selected/,
      );
    },
  );
});

const headers = configureTest({ plannerState: noDates() });

headers.describe("Calendar keyboard access — boundary value analysis", () => {
  headers(
    "Arrow up from the top row reaches the weekday headings",
    async ({ actor, page }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      // 1 June 2026 is a Monday and sits in the top row, so up from it is the
      // Monday heading rather than the previous month.
      await calendarEditor.dayCell(2026, 5, 1).focus();
      await page.keyboard.press("ArrowUp");
      await expect(calendarEditor.weekdayHeader(0)).toBeFocused();

      // Space there selects every Monday in the month — the bulk action that had
      // no keyboard route at all before this batch.
      await page.keyboard.press(" ");
      await expect(calendarEditor.dayCell(2026, 5, 1)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(calendarEditor.dayCell(2026, 5, 29)).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Down returns to the first cell of that column.
      await page.keyboard.press("ArrowDown");
      await expect(calendarEditor.dayCell(2026, 5, 1)).toBeFocused();
    },
  );
});

const focusRing = configureTest({ plannerState: noDates() });

focusRing.describe("Calendar keyboard access — boundary value analysis", () => {
  focusRing(
    "A cell reached by keyboard shows a focus ring",
    async ({ actor, page }) => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

      await calendarEditor.clearMonthButton.focus();
      await page.keyboard.press("Tab");

      // WCAG 2.2 AA 2.4.7 and 1.4.11. #0f172a is 17.06:1 on the container and
      // 6.42:1 on a selected day's green, so the ring is visible on either fill.
      const outline = await calendarEditor
        .dayCell(2026, 5, 15)
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            style: style.outlineStyle,
            width: style.outlineWidth,
            color: style.outlineColor,
          };
        });
      expect(outline.style).toBe("solid");
      expect(outline.width).toBe("2px");
      expect(outline.color).toBe("rgb(15, 23, 42)");
    },
  );
});

/**
 * The batch's acceptance journey: enter edit mode, select two dates, set a
 * price, Done — every step a key.
 */
const journey = configureTest({ plannerState: noDates() });

journey.describe(
  "Scheduling with the keyboard alone — state transition testing",
  () => {
    journey(
      "Select two dates, price them and save, without a mouse",
      async ({ actor, page, storagePrefix }) => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard(GROUP), openScheduleEditor());

        // Two Mondays, reached with arrows and selected with Space.
        await calendarEditor.dayCell(2026, 5, 1).focus();
        await page.keyboard.press(" ");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press(" ");
        await expect(calendarEditor.dayCell(2026, 5, 8)).toHaveAttribute(
          "aria-selected",
          "true",
        );

        // Tab to the price input — enabled now that something is selected — and
        // type a price.
        await page.keyboard.press("Tab");
        await expect(calendarEditor.selectedDatesPriceInput).toBeFocused();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.type("450");

        // Tab past Cancel to Done, and commit.
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await expect(calendarEditor.saveButton).toBeFocused();
        await page.keyboard.press("Enter");

        // Then the two dates and their price are stored.
        const groups = await storedGroups(page, storagePrefix);
        expect(groups[0]?.dates).toEqual(["2026-06-01", "2026-06-08"]);
        expect(groups[0]?.monthlyOverrides["2026-06"]).toEqual({
          price: 450,
          dates: ["2026-06-01", "2026-06-08"],
        });
      },
    );
  },
);

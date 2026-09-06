import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openScheduleEditor } from "../ui/screenplay/tasks/schedule-tasks";
import { openTemplateEditor } from "../ui/screenplay/tasks/template-tasks";
import { openPaymentMessageForMonth } from "../ui/screenplay/tasks/payment-tasks";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";

/**
 * What the app looks like, as opposed to what it does.
 *
 * Every other spec in this suite is behavioural, and that is exactly how the
 * React port reached batch 2a.3e with **no stylesheet at all** and a green
 * suite: nothing asked. Then 2a.3e added the stylesheet and the toolbar still
 * rendered on its own row under the title, because the copied rules position it
 * through markup the port deliberately does not have — and again, nothing
 * asked. Both were found by a person looking at the screen.
 *
 * ISTQB technique: state transition testing over the screens. Each state the
 * app can be looking at gets one check of its structure and one of its layout.
 *
 * Three levels, weakest to strongest:
 *
 * 1. **Accessibility snapshots** — the roles and names, in order. They catch a
 *    control that vanished or changed its name, and they run everywhere.
 * 2. **Geometry** — relationships between boxes: same row, right-aligned,
 *    stacked, centred. Resolution- and platform-independent, so these run in CI
 *    too, and they are what would have failed on the toolbar bug.
 * 3. **Pixels** — `toHaveScreenshot` against committed baselines. The strongest
 *    and the most environment-bound: a screenshot records one renderer and one
 *    font inventory. There are two baseline sets, macOS and Linux, and
 *    Playwright puts the platform in the filename so each compares against its
 *    own. CI runs in an image pinned by digest; `.github/workflows/baselines.yml`
 *    makes the Linux set in that same image. Regenerating them is a reviewed
 *    step, not a command anyone runs to make a red run green — the loop is in
 *    .claude/context/testing.md.
 */

const MONTH = "2026-06";
const TEMPLATE = "Lessons for {{month}}: {{lessons}} at {{total}}.";

const populated = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Monday Beginners",
        price: 250,
        currency: "UAH",
        monthlyOverrides: {
          [MONTH]: {
            price: 250,
            dates: ["2026-06-01", "2026-06-08", "2026-06-15"],
          },
        },
      }),
      buildGroup({ name: "Wednesday Advanced", price: 300, currency: "UAH" }),
    ],
    template: TEMPLATE,
  });

/* ---------- The main screen ---------- */

const mainScreen = configureTest({ plannerState: populated() });

mainScreen.describe("Visual layout — state transition testing", () => {
  mainScreen("The main screen", async ({ actor, page }) => {
    const { planner } = actor.abilityTo(BrowseTheWeb);

    // The toolbar shares the title's row and ends at the right margin. This is
    // the assertion the 2a.3e layout bug would have failed: the buttons sat on
    // their own row, 46 px below the title.
    const title = await planner.pageTitle.boundingBox();
    const addGroup = await planner.addGroupButton.boundingBox();
    const clearData = await planner.clearDataButton.boundingBox();
    const list = await page.locator("#groupList").boundingBox();
    expect(title).not.toBeNull();
    expect(addGroup).not.toBeNull();
    expect(clearData).not.toBeNull();
    expect(list).not.toBeNull();
    if (
      title === null ||
      addGroup === null ||
      clearData === null ||
      list === null
    ) {
      return;
    }

    const rowOf = (box: { y: number; height: number }) =>
      box.y + box.height / 2;
    // Same row as the title, within half a button's height.
    expect(Math.abs(rowOf(addGroup) - rowOf(title))).toBeLessThan(
      addGroup.height / 2,
    );
    expect(Math.abs(rowOf(clearData) - rowOf(addGroup))).toBeLessThan(2);
    // The last button reaches the right margin: 20 px of body padding.
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (viewport !== null) {
      expect(viewport.width - (clearData.x + clearData.width)).toBeLessThan(30);
    }
    // The group list starts below the header, not beside or behind it.
    expect(list.y).toBeGreaterThan(title.y + title.height);

    await expect(page).toHaveScreenshot("main-screen.png");
  });
});

/**
 * The header's structure.
 *
 * This could not be asserted against the legacy page: it put the five buttons
 * **inside** the `<h1>`, so the heading's accessible name was "📅 Group Lesson
 * Planner + Add Group 🧾 Edit Template Load CSV Save CSV Clear All Data" and
 * there was no banner landmark at all — DEF-019, closed by deleting the page.
 *
 * Asserting the shape below is what stops batch 2b.2 putting the buttons back
 * inside the heading to shorten a stylesheet.
 */
const headerStructure = configureTest({ plannerState: populated() });

headerStructure.describe("Visual layout — state transition testing", () => {
  headerStructure(
    "The header is a landmark and the heading is only the heading",
    async ({ page }) => {
      await expectAriaSnapshot(
        page.locator("body"),
        `
- banner:
  - heading "📅 Group Lesson Planner" [level=1]
  - button "+ Add Group"
  - button "🧾 Edit Template"
  - button "Load CSV"
  - button "Save CSV"
  - button "Clear All Data"
- heading "Monday Beginners" [level=2]
- text: 3 planned lessons
- heading "Wednesday Advanced" [level=2]
- text: 0 planned lessons
`,
      );
    },
  );
});

const emptyScreen = configureTest({
  plannerState: plannerState({ groups: [], template: TEMPLATE }),
});

emptyScreen.describe("Visual layout — state transition testing", () => {
  emptyScreen("The empty state", async ({ actor, page }) => {
    const { planner } = actor.abilityTo(BrowseTheWeb);
    await expect(planner.emptyState).toBeVisible();

    // The empty message is centred in the page, not tucked against the left.
    const message = await planner.emptyState.boundingBox();
    const viewport = page.viewportSize();
    expect(message).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (message !== null && viewport !== null) {
      const centre = message.x + message.width / 2;
      expect(Math.abs(centre - viewport.width / 2)).toBeLessThan(40);
    }

    await expect(page).toHaveScreenshot("empty-state.png");
  });
});

/* ---------- The dialogs ---------- */

const dialog = configureTest({ plannerState: populated() });

dialog.describe("Visual layout — state transition testing", () => {
  dialog("The group dialog", async ({ actor, page }) => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Monday Beginners"));

    const panel = await groupModal.panel.boundingBox();
    const viewport = page.viewportSize();
    expect(panel).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (panel !== null && viewport !== null) {
      // Centred horizontally, and not wider than the window.
      const centre = panel.x + panel.width / 2;
      expect(Math.abs(centre - viewport.width / 2)).toBeLessThan(10);
      expect(panel.width).toBeLessThanOrEqual(viewport.width);
      // The backdrop covers the window — this is what makes a click outside the
      // panel close the dialog, and it is what the port lacked before 2a.3e.
      const overlay = await groupModal.modal.boundingBox();
      expect(overlay?.width).toBeGreaterThanOrEqual(viewport.width - 1);
      expect(overlay?.height).toBeGreaterThanOrEqual(viewport.height - 1);
    }

    await expect(page).toHaveScreenshot("group-dialog.png");
  });
});

const editForm = configureTest({ plannerState: populated() });

editForm.describe("Visual layout — state transition testing", () => {
  editForm("The group edit form", async ({ actor, page }) => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openGroupCard("Monday Beginners"));
    await groupModal.enterEditMode();

    await expectAriaSnapshot(
      groupModal.panel,
      `
- heading "Edit Group" [level=3]
- text: Group Name
- textbox
- text: Default Price
- spinbutton
- text: Currency
- combobox
- button "Cancel"
- button "Save"
- heading "Monthly Overrides & Schedule" [level=4]
`,
    );

    // The pencil is gone while the form is open, as it is in the legacy page.
    await expect(groupModal.editInfoButton).toBeHidden();

    await expect(page).toHaveScreenshot("group-edit-form.png");
  });
});

const calendar = configureTest({ plannerState: populated() });

calendar.describe("Visual layout — state transition testing", () => {
  calendar("The calendar editor", async ({ actor, page }) => {
    const { calendarEditor, groupModal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(
      openGroupCard("Monday Beginners"),
      openScheduleEditor(),
    );

    // Seven columns, and the grid sits under its weekday header rather than
    // beside it.
    const dow = await page.locator("#calendar-dow").boundingBox();
    const grid = await page.locator("#calendar").boundingBox();
    expect(dow).not.toBeNull();
    expect(grid).not.toBeNull();
    if (dow !== null && grid !== null) {
      expect(grid.y).toBeGreaterThan(dow.y);
      expect(Math.abs(grid.x - dow.x)).toBeLessThan(2);
      expect(Math.abs(grid.width - dow.width)).toBeLessThan(2);
    }
    // Every day cell is inside the grid.
    const firstDay = await calendarEditor.dayCell(2026, 5, 1).boundingBox();
    if (firstDay !== null && grid !== null) {
      expect(firstDay.x).toBeGreaterThanOrEqual(grid.x - 1);
      expect(firstDay.y).toBeGreaterThanOrEqual(grid.y - 1);
    }
    // The pencil is hidden here too — `renderGroupInfo` hides it whenever
    // either editor is open.
    await expect(groupModal.editInfoButton).toBeHidden();

    await expect(page).toHaveScreenshot("calendar-editor.png");
  });
});

const templateModal = configureTest({ plannerState: populated() });

templateModal.describe("Visual layout — state transition testing", () => {
  templateModal("The template editor", async ({ actor, page }) => {
    const { templateModal: modal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openTemplateEditor());

    await expectAriaSnapshot(
      modal.panel,
      `
- heading "Edit Payment Message Template" [level=3]
- paragraph: /You can use/
- textbox
- button "Cancel"
- button "Save"
`,
    );

    await expect(page).toHaveScreenshot("template-editor.png");
  });
});

const reviewModal = configureTest({ plannerState: populated() });

reviewModal.describe("Visual layout — state transition testing", () => {
  reviewModal("The review dialog", async ({ actor, page }) => {
    const { reviewModal: modal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(
      openGroupCard("Monday Beginners"),
      openPaymentMessageForMonth(MONTH),
    );

    await expectAriaSnapshot(
      modal.panel,
      `
- heading "Review Payment Message" [level=3]
- textbox
- button "Cancel"
- button "Copy & Close"
`,
    );

    await expect(page).toHaveScreenshot("review-dialog.png");
  });
});

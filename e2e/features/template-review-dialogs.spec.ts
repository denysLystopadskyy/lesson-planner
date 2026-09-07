import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { formatCurrency } from "../ui/support/formatters";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openTemplateEditor } from "../ui/screenplay/tasks/template-tasks";
import { storedTemplate } from "../ui/support/planner-storage";

/**
 * The template and review dialogs, on the same footing as the group dialog.
 *
 * Batch 2b.3 moved all three onto the native `<dialog>` at once, because
 * DEF-023 was one defect and fixing a third of it would have left a pin nobody
 * could remove. What was left for this batch is the part that was never
 * asserted: that the behaviour really is the same in all three, and that the
 * copy flow — the app's whole purpose, the thing that reaches a parent — can be
 * driven without a mouse.
 *
 * ISTQB technique: equivalence partitioning on the way a dialog is dismissed.
 * A dialog closes by its own control, by Escape, or by a click on the backdrop,
 * and before 2b.3 only the group dialog honoured the third.
 */

const MONTH = "2026-06";
const PRICE = 250;
const DATES = ["2026-06-01", "2026-06-08"];
const TEMPLATE = "Lessons for {{month}}: {{lessons}} at {{total}}.";

const withLessons = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Copy Group",
        price: PRICE,
        currency: "UAH",
        monthlyOverrides: { [MONTH]: { price: PRICE, dates: DATES } },
      }),
    ],
    template: TEMPLATE,
  });

/* ---------- Dismissing by the backdrop ---------- */

const templateBackdrop = configureTest({ plannerState: withLessons() });

templateBackdrop.describe(
  "Dismissing a dialog — equivalence partitioning",
  () => {
    templateBackdrop(
      "A click on the backdrop closes the template editor and keeps the template",
      async ({ actor, page, storagePrefix }) => {
        const { templateModal } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openTemplateEditor());
        await templateModal.setTemplate("Typed but never saved");

        // A modal `<dialog>` fills the viewport, so a click at the very edge is a
        // click on the backdrop. Before batch 2b.3 this dialog ignored it — the
        // handler existed only on the group modal — and the teacher had to find
        // Cancel.
        await page.mouse.click(4, 4);

        await expect(templateModal.modal).toBeHidden();
        expect(await storedTemplate(page, storagePrefix)).toBe(TEMPLATE);
      },
    );
  },
);

const reviewBackdrop = configureTest({ plannerState: withLessons() });

reviewBackdrop.describe(
  "Dismissing a dialog — equivalence partitioning",
  () => {
    reviewBackdrop(
      "A click on the backdrop closes the review dialog",
      async ({ actor, page }) => {
        const { monthlyOverrides, reviewModal, groupModal } =
          actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard("Copy Group"));
        await monthlyOverrides.copyPaymentMessage(MONTH);
        await expect(reviewModal.modal).toBeVisible();

        await page.mouse.click(4, 4);

        // The review dialog goes and the group dialog behind it stays: closing
        // the top dialog must not close the one that opened it.
        await expect(reviewModal.modal).toBeHidden();
        await expect(groupModal.modal).toBeVisible();
      },
    );
  },
);

/* ---------- Where focus lands ---------- */

const templateFocus = configureTest({ plannerState: withLessons() });

templateFocus.describe("Dismissing a dialog — equivalence partitioning", () => {
  templateFocus(
    "The template editor opens with the cursor in the text",
    async ({ actor }) => {
      const { templateModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openTemplateEditor());

      // Editing the template is the only thing this dialog does, so the caret
      // belongs in the box. The legacy page did this on a 100 ms timeout, which
      // is the pattern that stole focus mid-typing in batch 1.10.
      await expect(templateModal.textarea).toBeFocused();
    },
  );
});

/* ---------- The copy flow, without a mouse ---------- */

const keyboardCopy = configureTest({
  plannerState: withLessons(),
  clipboard: "working",
});

keyboardCopy.describe(
  "Copying a payment message with the keyboard alone — state transition testing",
  () => {
    keyboardCopy(
      "Open the message, read it, copy it and land back on the row",
      async ({ actor, page }) => {
        const { monthlyOverrides, reviewModal, groupModal } =
          actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openGroupCard("Copy Group"));

        // The month row's copy control is a real button, so Tab reaches it and
        // Enter opens the review dialog.
        await monthlyOverrides.copyButton(MONTH).focus();
        await page.keyboard.press("Enter");
        await expect(reviewModal.modal).toBeVisible();

        // The message is in the textarea, which has focus, so it can be read and
        // edited before it is sent to a parent.
        await expect(reviewModal.textarea).toBeFocused();
        await expect(reviewModal.textarea).toHaveValue(
          `Lessons for June: ${String(DATES.length)} at ${formatCurrency(PRICE * DATES.length, "UAH")}.`,
        );

        // Tab past Cancel to Copy & Close, and press it.
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await expect(reviewModal.copyButton).toBeFocused();
        await page.keyboard.press("Enter");

        await expect
          .poll(async () => page.evaluate(() => window.__copiedText))
          .toBe(
            `Lessons for June: ${String(DATES.length)} at ${formatCurrency(PRICE * DATES.length, "UAH")}.`,
          );
        await expect(reviewModal.modal).toBeHidden();

        // And focus is back on the control that opened it, inside the group
        // dialog, so the next month's message is one Tab away rather than a
        // journey from the top.
        await expect(groupModal.modal).toBeVisible();
        await expect(monthlyOverrides.copyButton(MONTH)).toBeFocused();
      },
    );
  },
);

const keyboardTemplate = configureTest({ plannerState: withLessons() });

keyboardTemplate.describe(
  "Copying a payment message with the keyboard alone — state transition testing",
  () => {
    keyboardTemplate(
      "Edit the template and save it, without a mouse",
      async ({ actor, page, storagePrefix }) => {
        const { templateModal } = actor.abilityTo(BrowseTheWeb);
        await actor.attemptsTo(openTemplateEditor());

        await expect(templateModal.textarea).toBeFocused();
        await page.keyboard.press("ControlOrMeta+a");
        await page.keyboard.type("Due for {{month}}: {{total}}");

        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        await expect(templateModal.saveButton).toBeFocused();
        await page.keyboard.press("Enter");

        await expect(templateModal.modal).toBeHidden();
        expect(await storedTemplate(page, storagePrefix)).toBe(
          "Due for {{month}}: {{total}}",
        );
      },
    );
  },
);

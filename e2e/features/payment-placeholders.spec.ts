import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openPaymentMessageForMonth } from "../ui/screenplay/tasks/payment-tasks";
import { openTemplateEditor } from "../ui/screenplay/tasks/template-tasks";

/**
 * The two placeholders only the teacher can fill — plan batch 3.5, DEF-015.
 *
 * The app ships `<recipient>` and `<account>` blank because the alternative was
 * shipping the owner's own IBAN and tax identifier in public source. That is
 * the right trade, and it leaves a quieter problem behind: a message still
 * carrying `<account>` looks finished, copies cleanly, and reaches a parent who
 * cannot pay it. Nothing in the app used to say so.
 *
 * Technique: state transition testing on the template — shipped default, half
 * filled, filled — checked in the two places that can see it. The editor is
 * where it is fixed; the review dialog is the last moment before the text
 * leaves the app.
 */

const MONTH = "2026-06";

const freshPlanner = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Payment Group",
        price: 250,
        currency: "UAH",
        monthlyOverrides: {
          [MONTH]: { price: 250, dates: ["2026-06-01", "2026-06-08"] },
        },
      }),
    ],
    // `template` is left off entirely, not set to empty: an absent key is what
    // "never saved a template" looks like in storage, and it is the state every
    // new user is in. An empty string would be a template she chose.
  });

const shipped = configureTest({ plannerState: freshPlanner() });

shipped.describe("Payment placeholders — state transition testing", () => {
  shipped("The editor says which ones to fill", async ({ actor }) => {
    const { templateModal } = actor.abilityTo(BrowseTheWeb);
    await actor.attemptsTo(openTemplateEditor());

    await expect(templateModal.placeholderHelp).toBeVisible();
    await expect(templateModal.placeholderHelp).toContainText("<recipient>");
    await expect(templateModal.placeholderHelp).toContainText("<account>");
  });

  shipped(
    "The hint narrows as they are filled, and goes when they are",
    async ({ actor }) => {
      // It follows the text rather than the save, so the answer arrives while
      // she is still looking at the question.
      const { templateModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openTemplateEditor());

      await templateModal.setTemplate("Pay me at <account>, thanks.");
      await expect(templateModal.placeholderHelp).toContainText("<account>");
      await expect(templateModal.placeholderHelp).not.toContainText(
        "<recipient>",
      );

      await templateModal.setTemplate("Pay me at the usual place, thanks.");
      await expect(templateModal.placeholderHelp).toBeHidden();
    },
  );

  shipped(
    "The review dialog catches a message that would go out unfilled",
    async ({ actor }) => {
      // The case the editor hint cannot cover: she never opened the editor.
      // This is the last screen before the text reaches a parent.
      const { reviewModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(
        openGroupCard("Payment Group"),
        openPaymentMessageForMonth(MONTH),
      );

      await expect(reviewModal.placeholderWarning).toBeVisible();
      await expect(reviewModal.placeholderWarning).toContainText("<account>");
    },
  );
});

const filledIn = configureTest({
  plannerState: plannerState({
    groups: [
      buildGroup({
        name: "Payment Group",
        price: 250,
        currency: "UAH",
        monthlyOverrides: {
          [MONTH]: { price: 250, dates: ["2026-06-01", "2026-06-08"] },
        },
      }),
    ],
    template: "For {{month}}: {{lessons}} lessons, {{total}}. Pay as usual.",
  }),
});

filledIn.describe("Payment placeholders — state transition testing", () => {
  // The guard against a hint that becomes noise. A warning she cannot act on is
  // worse than none, and one that appears on every message is one she stops
  // reading before the day it matters. Two tests rather than one journey: the
  // group dialog stays open behind the review dialog, so reaching the toolbar
  // afterwards would mean closing two things to assert a third.
  filledIn("Her own message carries no warning", async ({ actor }) => {
    const { reviewModal } = actor.abilityTo(BrowseTheWeb);

    await actor.attemptsTo(
      openGroupCard("Payment Group"),
      openPaymentMessageForMonth(MONTH),
    );

    await expect(reviewModal.modal).toBeVisible();
    await expect(reviewModal.placeholderWarning).toBeHidden();
  });

  filledIn("Her own template carries no hint", async ({ actor }) => {
    const { templateModal } = actor.abilityTo(BrowseTheWeb);

    await actor.attemptsTo(openTemplateEditor());

    await expect(templateModal.modal).toBeVisible();
    await expect(templateModal.placeholderHelp).toBeHidden();
  });
});

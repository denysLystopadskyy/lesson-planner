import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";
import { formatCurrency } from "../ui/support/formatters";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openPaymentMessageForMonth } from "../ui/screenplay/tasks/payment-tasks";

/**
 * Copying the payment message.
 *
 * ISTQB technique: decision table on the copy control. The conditions are
 * whether the month has lessons, and whether the clipboard write succeeds.
 *
 * | Lessons | Clipboard | Expected |
 * | ------- | --------- | -------- |
 * | none    | n/a       | control disabled |
 * | some    | succeeds  | text copied, dialog closes |
 * | some    | fails     | the user is told (DEF-011) |
 *
 * The failing row is the one the app gets wrong: `copyAndClose` calls
 * `navigator.clipboard.writeText(...)` without awaiting it and shows "Copied!"
 * regardless.
 */

const MONTH = "2026-07";
const PRICE = 250;
const DATES = ["2026-07-06", "2026-07-13"];
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

const copyWorks = configureTest({
  plannerState: withLessons(),
  clipboard: "working",
});

copyWorks.describe("Copying the message — decision table @ported", () => {
  copyWorks(
    "A successful copy writes the message and closes the dialog",
    async ({ actor }) => {
      const { page, reviewModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Copy Group"));
      await actor.attemptsTo(openPaymentMessageForMonth(MONTH));

      await reviewModal.copyButton.click();

      await expect
        .poll(async () => page.evaluate(() => window.__copiedText))
        .toBe(
          `Lessons for July: ${String(DATES.length)} at ${formatCurrency(PRICE * DATES.length, "UAH")}.`,
        );
      await expect(reviewModal.modal).toBeHidden();
    },
  );
});

const copyFails = configureTest({
  plannerState: withLessons(),
  clipboard: "failing",
});

copyFails.describe("Copying the message — decision table @ported", () => {
  copyFails(
    "A failed copy tells the user instead of claiming success",
    async ({ actor }) => {
      copyFails.fixme(
        true,
        'DEF-011: "Copied!" shows even when the clipboard write failed',
      );
      const { reviewModal } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Copy Group"));
      await actor.attemptsTo(openPaymentMessageForMonth(MONTH));

      // Given a clipboard that refuses — what a real browser does when the
      // document is not focused, or permission is denied
      // When the user copies
      await reviewModal.copyButton.click();

      // Then the button must not claim success, and the dialog must stay open
      // so the text can still be selected by hand.
      //
      // Today it does the opposite: `copyAndClose` never awaits the write, so
      // the label flips to "Copied!" and the dialog closes a second later while
      // the clipboard is empty. The rejection surfaces only as an unhandled
      // promise rejection in the console. The user believes a message they
      // never copied is ready to paste. Fixed in plan batch 3.4a.
      await expect(reviewModal.copyButton).not.toHaveText(/Copied/);
      await expect(reviewModal.modal).toBeVisible();
    },
  );
});

const nothingToCopy = configureTest({
  plannerState: plannerState({
    groups: [
      buildGroup({
        name: "Copy Group",
        price: PRICE,
        currency: "UAH",
        monthlyOverrides: { [MONTH]: { price: PRICE, dates: [] } },
      }),
    ],
    template: TEMPLATE,
  }),
});

nothingToCopy.describe("Copying the message — decision table @ported", () => {
  nothingToCopy(
    "A month with no lessons offers no copy control",
    async ({ actor }) => {
      const { monthlyOverrides } = actor.abilityTo(BrowseTheWeb);
      await actor.attemptsTo(openGroupCard("Copy Group"));

      // An override with an empty date list renders no row of its own, so the
      // only row is the current month — and its control is disabled.
      await expect(monthlyOverrides.copyButton("2026-06")).toBeDisabled();
    },
  );
});

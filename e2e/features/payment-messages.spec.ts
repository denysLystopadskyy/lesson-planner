import { faker } from "@faker-js/faker";
import { configureTest, expect } from "../ui/fixtures/test";
import { formatCurrency, monthKey, monthName } from "../ui/support/formatters";
import { plannerState } from "../ui/support/planner-state";
import {
  buildGroup,
  buildOverride,
  pickMonthContext,
  randomDatesInMonth,
} from "../ui/support/test-data";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import {
  copyAndClosePaymentMessage,
  openPaymentMessageForMonth,
} from "../ui/screenplay/tasks/payment-tasks";
import { reviewMessageText } from "../ui/screenplay/questions/review-questions";
import { BrowseTheWeb } from "../ui/screenplay/abilities/browse-the-web";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { copyPaymentMessageDisabled } from "../ui/screenplay/assertions/monthly-assertions";
import { FIXED_NOW } from "../ui/support/clock";

/**
 * ISTQB technique: equivalence partitioning on the month's lesson count. A
 * month either has lessons — a message can be generated and copied — or it has
 * none, and the control is disabled. One representative of each class, plus the
 * copy transition itself.
 *
 * Every test here seeds its own template, and that is required rather than
 * tidy. With nothing seeded the app falls back to its default template, which
 * carries the owner's real IBAN and tax id, and this spec renders that template
 * into the review dialog. Traces, video and screenshots are all kept on
 * failure, so an unseeded run would copy those values into CI artifacts. See
 * .claude/context/security-auth.md.
 */
const SEEDED_TEMPLATE =
  "Payment for {{month}}: {{lessons}} lessons, {{total}} due. Thank you.";

const messageSeed = 7707;
faker.seed(messageSeed);
const messageContext = pickMonthContext();
const messageDates = randomDatesInMonth({
  year: messageContext.year,
  monthIndex: messageContext.monthIndex,
  count: faker.number.int({ min: 2, max: 4 }),
});
const messagePrice = faker.number.int({ min: 100, max: 2000 });
const { override: messageOverride } = buildOverride({
  monthKey: messageContext.key,
  price: messagePrice,
  dates: messageDates,
});
const messageGroup = buildGroup({
  monthlyOverrides: {
    [messageContext.key]: messageOverride,
  },
});
const generateMessageTest = configureTest({
  plannerState: plannerState({
    groups: [messageGroup],
    template: SEEDED_TEMPLATE,
  }),
});

generateMessageTest.describe(
  "Payment messages — equivalence partitioning",
  () => {
    generateMessageTest(
      "A month with lessons produces a message carrying month, count and total",
      async ({ actor }) => {
        // Given a group with lessons in one month and a saved template
        // When the payment message for that month is opened
        await actor.attemptsTo(openGroupCard(messageGroup.name));
        await actor.attemptsTo(openPaymentMessageForMonth(messageContext.key));

        // The dialog's shape is an accessibility smoke check; the value
        // assertions below are what this test is about.
        const web = actor.abilityTo(BrowseTheWeb);
        await expectAriaSnapshot(
          web.reviewModal.panel,
          `
- heading "Review Payment Message" [level=3]
- textbox
- button "Cancel"
- button "Copy & Close"
`,
        );

        const message = await actor.asks(reviewMessageText());
        const expectedTotal = formatCurrency(
          messagePrice * messageDates.length,
          messageGroup.currency,
        );

        // Then all three tokens are substituted.
        await expect(message).toHaveValue(
          new RegExp(monthName(messageContext.key)),
        );
        await expect(message).toHaveValue(
          new RegExp(String(messageDates.length)),
        );
        await expect(message).toHaveValue(
          new RegExp(expectedTotal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
      },
    );
  },
);

const copySeed = 8808;
faker.seed(copySeed);
const copyContext = pickMonthContext();
const copyDates = randomDatesInMonth({
  year: copyContext.year,
  monthIndex: copyContext.monthIndex,
  count: faker.number.int({ min: 2, max: 4 }),
});
const copyPrice = faker.number.int({ min: 100, max: 2000 });
const { override: copyOverride } = buildOverride({
  monthKey: copyContext.key,
  price: copyPrice,
  dates: copyDates,
});
const copyGroup = buildGroup({
  monthlyOverrides: {
    [copyContext.key]: copyOverride,
  },
});
const copyMessageTest = configureTest({
  plannerState: plannerState({
    groups: [copyGroup],
    template: SEEDED_TEMPLATE,
  }),
  clipboard: "working",
});

copyMessageTest.describe(
  "Copying the message — state transition testing",
  () => {
    copyMessageTest(
      "Copy and close puts the message on the clipboard and shuts the dialog",
      async ({ actor }) => {
        // Given the review dialog open on a month with lessons
        await actor.attemptsTo(openGroupCard(copyGroup.name));
        await actor.attemptsTo(openPaymentMessageForMonth(copyContext.key));
        const expectedMessage = await actor.asks(reviewMessageText());

        // When the user copies and closes
        await actor.attemptsTo(copyAndClosePaymentMessage());

        // Then the clipboard holds exactly what was shown, and the dialog is
        // gone. Note the app reports success without awaiting the clipboard
        // write — that is DEF-011, fixed in plan batch 3.4a. Here the write is
        // stubbed, so this asserts the message content, not the app's error
        // handling.
        const web = actor.abilityTo(BrowseTheWeb);
        await expect
          .poll(async () => web.page.evaluate(() => window.__copiedText))
          .toBe(await expectedMessage.inputValue());
        await expect(web.reviewModal.modal).toBeHidden();
      },
    );
  },
);

const emptySeed = 9909;
faker.seed(emptySeed);
const emptyGroup = buildGroup({ dates: [], monthlyOverrides: {} });

/**
 * Derived from the pinned instant, not `new Date()`. The app always renders a
 * row for its own current month; while this line read the host clock and the
 * browser ran pinned, the two disagreed and the test looked for a row that was
 * never rendered.
 */
const emptyMonthKey = monthKey(
  FIXED_NOW.getUTCFullYear(),
  FIXED_NOW.getUTCMonth(),
);
const emptyMonthTest = configureTest({
  plannerState: plannerState({
    groups: [emptyGroup],
  }),
});

emptyMonthTest.describe("Payment messages — equivalence partitioning", () => {
  emptyMonthTest(
    "A month with no lessons offers nothing to copy",
    async ({ actor }) => {
      // Given a group with no lessons at all
      // When its card is opened
      await actor.attemptsTo(openGroupCard(emptyGroup.name));

      // Then the current month's row has its copy control disabled.
      await actor.verifies(copyPaymentMessageDisabled(emptyMonthKey));
    },
  );
});

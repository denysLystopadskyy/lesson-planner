import { readFileSync } from "fs";
import path from "path";
import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { formatCurrency } from "../ui/support/formatters";
import { buildGroup } from "../ui/support/test-data";
import { openGroupCard } from "../ui/screenplay/tasks/group-tasks";
import { openPaymentMessageForMonth } from "../ui/screenplay/tasks/payment-tasks";
import { reviewMessageText } from "../ui/screenplay/questions/review-questions";

/**
 * The golden payment message.
 *
 * This is the contract the React port has to reproduce. The message is the one
 * thing in this app that leaves it and reaches another person, so "close
 * enough" is not a standard — the assertion is byte for byte, whitespace and
 * currency formatting included.
 *
 * The template and the expected output live in `e2e/fixtures/` rather than in
 * this file, so a diff on a wording change reads as a wording change.
 *
 * **The golden file contains a non-breaking space.** `Intl.NumberFormat` puts
 * U+00A0 between the currency code and the amount, not an ordinary space. It is
 * invisible in a diff and in a failure message — the first version of this test
 * failed with "expected UAH 1,000.00, received UAH 1,000.00". Any reimplementation
 * that formats currency by hand will produce a subtly different message.
 *
 * **The fixtures are deliberately neutral.** The app's shipped default template
 * carries the owner's real bank details, and a golden file is committed, echoed
 * in failure output and uploaded as a CI artifact. See
 * .claude/context/security-auth.md.
 */

const FIXTURES = path.join(__dirname, "..", "fixtures");
const MONTH = "2026-07";
const PRICE = 250;
const DATES = ["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"];

/** Read at module scope: `configureTest` needs the template before any test runs. */
const readFixture = (name: string) =>
  readFileSync(path.join(FIXTURES, name), "utf-8");

const goldenFixture = () =>
  plannerState({
    groups: [
      buildGroup({
        name: "Golden Group",
        price: PRICE,
        currency: "UAH",
        monthlyOverrides: { [MONTH]: { price: PRICE, dates: DATES } },
      }),
    ],
    template: readFixture("golden-payment-message.template.txt"),
  });

const golden = configureTest({ plannerState: goldenFixture() });

golden.describe("Payment message — golden contract", () => {
  golden(
    "The generated message matches the golden file byte for byte",
    async ({ actor }) => {
      await actor.attemptsTo(openGroupCard("Golden Group"));
      await actor.attemptsTo(openPaymentMessageForMonth(MONTH));

      const expected = readFixture("golden-payment-message.txt");
      const actual = await (await actor.asks(reviewMessageText())).inputValue();

      // No normalising, no trimming. Both files end with a newline, and the
      // template's trailing newline flows through into the message, so an exact
      // comparison is the right one — and it is the only one that would notice
      // a port quietly dropping it.
      expect(actual).toBe(expected);
    },
  );
});

/**
 * ISTQB technique: equivalence partitioning on template placeholders.
 *
 * A template either uses a placeholder or it does not, and it may contain text
 * that looks like one but is not. Three partitions, one representative each.
 */

const groupWith = (template: string) =>
  plannerState({
    groups: [
      buildGroup({
        name: "Placeholder Group",
        price: PRICE,
        currency: "UAH",
        monthlyOverrides: { [MONTH]: { price: PRICE, dates: DATES } },
      }),
    ],
    template,
  });

const allThree = configureTest({
  plannerState: groupWith("{{month}}|{{lessons}}|{{total}}"),
});

allThree.describe("Template placeholders — equivalence partitioning", () => {
  allThree("All three placeholders are substituted", async ({ actor }) => {
    await actor.attemptsTo(openGroupCard("Placeholder Group"));
    await actor.attemptsTo(openPaymentMessageForMonth(MONTH));

    await expect(await actor.asks(reviewMessageText())).toHaveValue(
      `July|4|${formatCurrency(PRICE * DATES.length, "UAH")}`,
    );
  });
});

const oneMissing = configureTest({
  plannerState: groupWith("Only the total: {{total}}"),
});

oneMissing.describe("Template placeholders — equivalence partitioning", () => {
  oneMissing(
    "A template that omits a placeholder simply lacks that value",
    async ({ actor }) => {
      await actor.attemptsTo(openGroupCard("Placeholder Group"));
      await actor.attemptsTo(openPaymentMessageForMonth(MONTH));

      // No error, no empty marker — the other two are just absent.
      await expect(await actor.asks(reviewMessageText())).toHaveValue(
        `Only the total: ${formatCurrency(PRICE * DATES.length, "UAH")}`,
      );
    },
  );
});

const unknownPlaceholder = configureTest({
  plannerState: groupWith("{{month}} and {{student}} and {{Total}}"),
});

unknownPlaceholder.describe(
  "Template placeholders — equivalence partitioning",
  () => {
    unknownPlaceholder(
      "An unknown placeholder is left in the message as literal text",
      async ({ actor }) => {
        await actor.attemptsTo(openGroupCard("Placeholder Group"));
        await actor.attemptsTo(openPaymentMessageForMonth(MONTH));

        // `{{student}}` is not a thing, and `{{Total}}` differs in case from
        // the real one. Neither is substituted and neither is stripped, so a
        // typo reaches the recipient verbatim. Worth knowing: nothing warns.
        await expect(await actor.asks(reviewMessageText())).toHaveValue(
          "July and {{student}} and {{Total}}",
        );
      },
    );
  },
);

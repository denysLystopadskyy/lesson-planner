import { formatCurrency } from "./format";
import type { MonthKey, MonthOverride } from "./types";

/**
 * The payment message.
 *
 * This is the one thing the app produces that leaves it and reaches another
 * person, so batch 1.11's golden test asserts it byte for byte. Two details
 * carry that:
 *
 * - the month name comes from `new Date(monthKey + "-02")`, exactly as the
 *   legacy app builds it, not from a month-name array — the second of the
 *   month avoids the timezone edge the first would have; and
 * - the total goes through `Intl.NumberFormat`, which puts a **non-breaking
 *   space** (U+00A0) between the currency code and the amount. Formatting by
 *   hand produces a message that looks identical and is not.
 */

/**
 * The default used when nothing is stored.
 *
 * **Deliberately not the legacy default.** That one carries the owner's real
 * IBAN and tax identifier in the shipped source (DEF-015), which
 * .claude/context/security-auth.md forbids copying into new files, and batch
 * 3.5 removes from the legacy page for the same reason. The placeholders below
 * are what 3.5 specifies; the owner fills them in once in the template editor.
 * See the cutover note on plan batch 2a.4.
 */
export const DEFAULT_TEMPLATE = `Dear Students,

In {{month}}, we will have {{lessons}} lessons, with a total fee of {{total}}.

Payment details:
<recipient>
<account>

Thank you!
`;

/**
 * Builds the message for one group-month pair.
 *
 * Returns an empty string for a month with no lessons, as the legacy app does —
 * the copy control is disabled in that state, so nothing normally reaches this.
 */
export const generateMonthlyPaymentMessage = (
  template: string,
  overrides: Record<MonthKey, MonthOverride>,
  monthKey: MonthKey,
  currency: string,
): string => {
  const monthData = overrides[monthKey];
  if (monthData === undefined || monthData.dates.length === 0) return "";

  const lessons = monthData.dates.length;
  const total = monthData.price * lessons;
  const monthName = new Date(`${monthKey}-02`).toLocaleString("en-US", {
    month: "long",
  });

  return template
    .replace(/{{month}}/g, monthName)
    .replace(/{{lessons}}/g, String(lessons))
    .replace(/{{total}}/g, formatCurrency(total, currency));
};

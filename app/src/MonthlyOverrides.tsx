import { formatCurrency } from "./format";
import { ClipboardIcon } from "./icons";
import styles from "./MonthlyOverrides.module.css";
import { monthLabel, monthsToRender, priceForMonth } from "./schedule";
import type { MonthKey, MonthOverride } from "./types";

/**
 * The month rows under a group.
 *
 * ## DEF-017, closed in batch 3.7 by deleting the branch
 *
 * There used to be an inline price input here, rendered while the calendar was
 * open — inside `#monthlySection`, which the same handler sets to
 * `display: none`. It existed and no user could ever reach it. The legacy app
 * had the same contradiction, and the port reproduced it faithfully.
 *
 * The choice was to show the section during calendar editing, as the code
 * comment intended, or to delete the branch. **Deleted** (owner decision,
 * 2026-09-11): the calendar's bulk price input already sets a month's price,
 * and it is the control the user is looking at while picking that month's
 * dates. Reviving a second way to do the same thing, in a panel that has to be
 * un-hidden first, adds a path to test and maintain for no capability.
 *
 * `month-price-input` left the frozen testid contract with it —
 * `testid-contract.spec.ts` and `.claude/context/testing.md` changed in the
 * same PR, which that document requires.
 *
 * One legacy behaviour is still reproduced on purpose: an empty current month
 * gets a row, because the row list is "months with lessons, plus the month the
 * calendar is showing".
 */

type Props = {
  overrides: Record<MonthKey, MonthOverride>;
  currentMonthKey: MonthKey;
  groupPrice: number;
  currency: string;
  onOpenMonth: (monthKey: MonthKey) => void;
  onCopyMessage: (monthKey: MonthKey) => void;
};

export const MonthlyOverrides = ({
  overrides,
  currentMonthKey,
  groupPrice,
  currency,
  onOpenMonth,
  onCopyMessage,
}: Props) => (
  <div id="monthlyOverrides">
    {monthsToRender(overrides, currentMonthKey).map((monthKey) => {
      const lessons = overrides[monthKey]?.dates.length ?? 0;
      const price = priceForMonth(overrides, monthKey, groupPrice);
      return (
        <div
          key={monthKey}
          className={styles.row}
          data-month-key={monthKey}
          onClick={() => {
            onOpenMonth(monthKey);
          }}
        >
          <div className={styles.name} data-testid="month-name">
            <strong>{monthLabel(monthKey)}</strong>{" "}
            <span data-testid="month-lesson-count">({lessons} lessons)</span>
          </div>
          <div className={styles.priceStack}>
            <div className={styles.total} data-testid="month-total">
              Total: {formatCurrency(lessons * price, currency)}
            </div>
            <div className={styles.perLesson} data-testid="price-per-lesson">
              Per lesson: {formatCurrency(price, currency)}
            </div>
          </div>
          <div>
            <button
              type="button"
              data-testid="copy-payment-message"
              disabled={lessons === 0}
              onClick={(event) => {
                event.stopPropagation();
                onCopyMessage(monthKey);
              }}
            >
              <ClipboardIcon /> Copy Payment Message
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

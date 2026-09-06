import { formatCurrency } from "./format";
import { monthLabel, monthsToRender, priceForMonth } from "./schedule";
import type { MonthKey, MonthOverride } from "./types";

/**
 * The month rows under a group.
 *
 * Two legacy behaviours are reproduced on purpose, because batch 2a.3c is a
 * faithful port and both are pinned defects whose fixes belong to Phase 3:
 *
 * - The inline price input is rendered while editing, inside a section the
 *   editor hides — so it exists and no user can reach it. That is DEF-017, and
 *   the frozen testid contract asserts exactly that shape.
 * - An empty current month still gets a row, because the row list is "months
 *   with lessons, plus the month the calendar is showing".
 */

type Props = {
  overrides: Record<MonthKey, MonthOverride>;
  currentMonthKey: MonthKey;
  groupPrice: number;
  currency: string;
  isEditing: boolean;
  onOpenMonth: (monthKey: MonthKey) => void;
  onPriceChange: (monthKey: MonthKey, price: number) => void;
  onCopyMessage: (monthKey: MonthKey) => void;
};

export const MonthlyOverrides = ({
  overrides,
  currentMonthKey,
  groupPrice,
  currency,
  isEditing,
  onOpenMonth,
  onPriceChange,
  onCopyMessage,
}: Props) => (
  <div id="monthlyOverrides">
    {monthsToRender(overrides, currentMonthKey).map((monthKey) => {
      const lessons = overrides[monthKey]?.dates.length ?? 0;
      const price = priceForMonth(overrides, monthKey, groupPrice);
      return (
        <div
          key={monthKey}
          className="month-override-row"
          data-month-key={monthKey}
          onClick={() => {
            onOpenMonth(monthKey);
          }}
        >
          <div className="month-name" data-testid="month-name">
            <strong>{monthLabel(monthKey)}</strong>{" "}
            <span data-testid="month-lesson-count">({lessons} lessons)</span>
          </div>
          <div className="price-stack">
            <div className="month-total" data-testid="month-total">
              Total: {formatCurrency(lessons * price, currency)}
            </div>
            {isEditing ? (
              <label className="price-edit">
                Price:
                <input
                  type="number"
                  className="month-price-input"
                  data-testid="month-price-input"
                  defaultValue={String(price)}
                  onChange={(event) => {
                    onPriceChange(monthKey, Number(event.target.value) || 0);
                  }}
                />
              </label>
            ) : (
              <div className="price-per-lesson" data-testid="price-per-lesson">
                Per lesson: {formatCurrency(price, currency)}
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              className="copy-msg-btn"
              data-testid="copy-payment-message"
              disabled={lessons === 0}
              onClick={(event) => {
                event.stopPropagation();
                onCopyMessage(monthKey);
              }}
            >
              📋 Copy Payment Message
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

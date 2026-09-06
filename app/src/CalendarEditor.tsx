import { useState } from "react";
import { formatCurrency } from "./format";
import {
  DAY_NAMES,
  MONTH_NAMES,
  applyBulkPrice,
  daysInMonth,
  isoDate,
  leadingSpacers,
  monthKeyOf,
  priceForMonth,
  toggleWeekday,
  weekdayOf,
} from "./schedule";
import type { DateKey, MonthKey, MonthOverride } from "./types";

/**
 * The calendar editor: pick dates, navigate months, set a bulk price.
 *
 * The draft lives here and in the parent's pending state; nothing reaches the
 * group until Done, which is the legacy behaviour and the reason Cancel can
 * discard cleanly.
 */

type Props = {
  year: number;
  monthIndex: number;
  onMonthChange: (year: number, monthIndex: number) => void;
  selected: ReadonlySet<DateKey>;
  onSelectedChange: (next: Set<DateKey>) => void;
  overrides: Record<MonthKey, MonthOverride>;
  onOverridesChange: (next: Record<MonthKey, MonthOverride>) => void;
  groupPrice: number;
  currency: string;
  onDone: () => void;
  onCancel: () => void;
};

export const CalendarEditor = ({
  year,
  monthIndex,
  onMonthChange,
  selected,
  onSelectedChange,
  overrides,
  onOverridesChange,
  groupPrice,
  currency,
  onDone,
  onCancel,
}: Props) => {
  const monthKey: MonthKey = isoDate(year, monthIndex, 1).slice(0, 7);
  const [bulkPrice, setBulkPrice] = useState<string>(
    String(priceForMonth(overrides, monthKey, groupPrice)),
  );

  const today = new Date();
  const todayKey = isoDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const days = daysInMonth(year, monthIndex);
  const selectedInMonth = [...selected].filter(
    (date) => monthKeyOf(date) === monthKey,
  ).length;
  const total =
    selectedInMonth * priceForMonth(overrides, monthKey, groupPrice);

  const step = (direction: number) => {
    let month = monthIndex + direction;
    let nextYear = year;
    if (month < 0) {
      month = 11;
      nextYear -= 1;
    } else if (month > 11) {
      month = 0;
      nextYear += 1;
    }
    onMonthChange(nextYear, month);
  };

  return (
    <div id="calendar-container">
      <div className="calendar-controls">
        <button
          id="prevMonthBtn"
          type="button"
          onClick={() => {
            step(-1);
          }}
        >
          ◀
        </button>
        <select
          id="monthSelect"
          value={String(monthIndex)}
          onChange={(event) => {
            onMonthChange(year, Number(event.target.value));
          }}
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={String(index)}>
              {name}
            </option>
          ))}
        </select>
        <input
          id="yearInput"
          type="number"
          value={String(year)}
          onChange={(event) => {
            onMonthChange(Number(event.target.value), monthIndex);
          }}
        />
        <button
          id="nextMonthBtn"
          type="button"
          onClick={() => {
            step(1);
          }}
        >
          ▶
        </button>
        <button
          id="todayBtn"
          type="button"
          onClick={() => {
            const now = new Date();
            onMonthChange(now.getFullYear(), now.getMonth());
          }}
        >
          Today
        </button>
        <button
          id="clearMonthBtn"
          type="button"
          onClick={() => {
            const next = new Set(selected);
            for (const date of selected) {
              if (monthKeyOf(date) === monthKey) next.delete(date);
            }
            onSelectedChange(next);
          }}
        >
          Clear Month
        </button>
      </div>

      <div id="calendar-dow" className="calendar-dow">
        {DAY_NAMES.map((name, index) => (
          <div
            key={name}
            data-weekday={String(index)}
            className={index >= 5 ? "weekend" : undefined}
            title={`Select all ${name}s in this month`}
            onClick={() => {
              onSelectedChange(
                toggleWeekday(selected, year, monthIndex, index),
              );
            }}
          >
            {name}
          </div>
        ))}
      </div>

      <div id="calendar" className="calendar">
        {Array.from({ length: leadingSpacers(year, monthIndex) }, (_, i) => (
          <div key={`spacer-${String(i)}`} className="spacer" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const dateKey = isoDate(year, monthIndex, day);
          const weekday = weekdayOf(year, monthIndex, day);
          const classes = ["day"];
          if (weekday >= 5) classes.push("weekend");
          if (dateKey === todayKey) classes.push("today");
          if (selected.has(dateKey)) classes.push("selected");
          return (
            <div
              key={dateKey}
              className={classes.join(" ")}
              data-date={dateKey}
              data-day={String(day)}
              data-weekday={String(weekday)}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(dateKey)) next.delete(dateKey);
                else next.add(dateKey);
                onSelectedChange(next);
              }}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div id="calendar-summary">
        {selectedInMonth > 0
          ? `${String(selectedInMonth)} days selected in ${MONTH_NAMES[monthIndex] ?? ""} — Total: ${formatCurrency(total, currency)}`
          : ""}
      </div>

      <label htmlFor="selectedDatesPriceInput">
        Set price for selected dates:
      </label>
      <input
        id="selectedDatesPriceInput"
        type="number"
        disabled={selected.size === 0}
        value={bulkPrice}
        onChange={(event) => {
          setBulkPrice(event.target.value);
        }}
        onBlur={(event) => {
          const value = Number(event.target.value);
          if (Number.isNaN(value)) return;
          onOverridesChange(applyBulkPrice(overrides, selected, value));
        }}
      />
      {selected.size === 0 && (
        <span>Select dates to enable price editing.</span>
      )}

      <button id="cancelDateChangesBtn" type="button" onClick={onCancel}>
        Cancel
      </button>
      <button id="saveDateChangesBtn" type="button" onClick={onDone}>
        Done
      </button>
    </div>
  );
};

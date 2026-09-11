import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { cx } from "./cx";
import styles from "./CalendarEditor.module.css";
import { formatCurrency } from "./format";
import {
  applyBulkPrice,
  DAY_NAMES,
  daysInMonth,
  FULL_DAY_NAMES,
  isoDate,
  isSupportedYear,
  leadingSpacers,
  MAX_YEAR,
  MIN_YEAR,
  MONTH_NAMES,
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

  // The year input keeps its own text while it is being edited. A controlled
  // `value={String(year)}` cannot work here: every keystroke would have to
  // commit, and committing a partial year is exactly the defect.
  const [yearDraft, setYearDraft] = useState<string>(String(year));

  // Keep the draft in step when the year changes from anywhere else — the
  // month arrows crossing a boundary, or Today.
  useEffect(() => {
    setYearDraft(String(year));
  }, [year]);

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

  /**
   * Which cell the one tab stop is on.
   *
   * A month is 30 to 37 cells and they cannot each be a tab stop, so exactly
   * one is tabbable and the arrows move which — the roving tabindex from the
   * WAI-ARIA date-grid pattern. The headers join the same scope, reached by
   * arrowing up off the top row, so bulk selection needs no extra tab stops.
   */
  type Active =
    { kind: "day"; date: DateKey } | { kind: "header"; weekday: number };

  const entryDate = (): DateKey => {
    const inMonth = [...selected]
      .filter((d) => monthKeyOf(d) === monthKey)
      .sort();
    if (inMonth[0] !== undefined) return inMonth[0];
    if (monthKeyOf(todayKey) === monthKey) return todayKey;
    return isoDate(year, monthIndex, 1);
  };

  const [active, setActive] = useState<Active>(() => ({
    kind: "day",
    date: entryDate(),
  }));
  const [announcement, setAnnouncement] = useState("");
  // Only a key press moves focus. Without this the grid would steal focus on
  // every render, including the mount that follows a mouse click.
  const movedByKey = useRef(false);
  const grid = useRef<HTMLDivElement>(null);

  // Focus the entry cell when the editor opens. Without this focus falls to
  // <body>: the pencil that had it unmounts and `#monthlySection` is hidden, so
  // a keyboard user would have to tab in from the top of the dialog again.
  useEffect(() => {
    grid.current
      ?.querySelector<HTMLElement>(`[data-date="${entryDate()}"]`)
      ?.focus();
    // Mount only: `entryDate` reads state that later renders change, and
    // re-running this would drag focus back whenever a date is selected.
  }, []);

  useEffect(() => {
    if (!movedByKey.current) return;
    movedByKey.current = false;
    const selector =
      active.kind === "day"
        ? `[data-date="${active.date}"]`
        : `#calendar-dow [data-weekday="${String(active.weekday)}"]`;
    grid.current?.querySelector<HTMLElement>(selector)?.focus();
  }, [active]);

  const weeks = (() => {
    // The leading spacers carry `weekend` when they fall in the Saturday or
    // Sunday column. Without it the weekend tint has an untinted gap at the
    // top of the column in every month that does not start on a Monday —
    // invisible in the pinned month, June 2026, which is exactly why it
    // needed writing down rather than leaving to a screenshot.
    type Cell =
      | {
          dateKey: DateKey;
          day: number;
          weekday: number;
          classes: string;
          label: string;
        }
      | { spacer: true; weekday: number };
    const cells: Cell[] = Array.from(
      { length: leadingSpacers(year, monthIndex) },
      (_, index) => ({ spacer: true as const, weekday: index }),
    );
    for (let day = 1; day <= days; day += 1) {
      const dateKey = isoDate(year, monthIndex, day);
      const weekday = weekdayOf(year, monthIndex, day);
      const classes = [styles.day];
      if (weekday >= 5) classes.push(styles.weekend);
      if (dateKey === todayKey) classes.push(styles.today);
      if (selected.has(dateKey)) classes.push(styles.selected);
      cells.push({
        dateKey,
        day,
        weekday,
        classes: cx(...classes),
        // The whole date, so moving between cells says where you are. "8" on
        // its own tells a screen-reader user nothing.
        label: `${FULL_DAY_NAMES[weekday] ?? ""} ${String(day)} ${MONTH_NAMES[monthIndex] ?? ""} ${String(year)}`,
      });
    }
    // No trailing spacers: `.spacer` is bordered, so they would paint empty
    // boxes the grid does not have today.
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  })();

  const toggleDate = (dateKey: DateKey) => {
    const next = new Set(selected);
    if (next.has(dateKey)) next.delete(dateKey);
    else next.add(dateKey);
    onSelectedChange(next);
  };

  const selectWeekday = (weekday: number) => {
    const next = toggleWeekday(selected, year, monthIndex, weekday);
    onSelectedChange(next);
    const count = [...next].filter((d) => monthKeyOf(d) === monthKey).length;
    setAnnouncement(
      `${String(count)} dates selected in ${MONTH_NAMES[monthIndex] ?? ""} ${String(year)}`,
    );
  };

  /** Moves the roving stop by whole days, clamped inside the month. */
  const moveByDays = (from: DateKey, delta: number): Active => {
    const day = Number(from.slice(8));
    const target = day + delta;
    if (target < 1) {
      // Up off the top row reaches that column's heading rather than the
      // previous month. Left off the 1st simply stops: the month never changes
      // under an arrow key, so focus can never end up on a cell that has just
      // been re-rendered away.
      return delta === -7
        ? { kind: "header", weekday: weekdayOf(year, monthIndex, day) }
        : { kind: "day", date: from };
    }
    if (target > days) return { kind: "day", date: from };
    return { kind: "day", date: isoDate(year, monthIndex, target) };
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    const move = (next: Active) => {
      event.preventDefault();
      movedByKey.current = true;
      setActive(next);
    };

    if (active.kind === "header") {
      if (key === "ArrowDown") {
        // Back into the first cell of that column.
        for (let day = 1; day <= days; day += 1) {
          if (weekdayOf(year, monthIndex, day) === active.weekday) {
            move({ kind: "day", date: isoDate(year, monthIndex, day) });
            return;
          }
        }
        return;
      }
      if (key === "ArrowLeft" && active.weekday > 0) {
        move({ kind: "header", weekday: active.weekday - 1 });
        return;
      }
      if (key === "ArrowRight" && active.weekday < 6) {
        move({ kind: "header", weekday: active.weekday + 1 });
        return;
      }
      if (key === " " || key === "Enter") {
        event.preventDefault();
        selectWeekday(active.weekday);
      }
      return;
    }

    const day = Number(active.date.slice(8));
    switch (key) {
      case "ArrowLeft":
        move(moveByDays(active.date, -1));
        return;
      case "ArrowRight":
        move(moveByDays(active.date, 1));
        return;
      case "ArrowUp":
        move(moveByDays(active.date, -7));
        return;
      case "ArrowDown":
        move(moveByDays(active.date, 7));
        return;
      case "Home":
        move({
          kind: "day",
          date: isoDate(
            year,
            monthIndex,
            event.ctrlKey || event.metaKey
              ? 1
              : Math.max(1, day - weekdayOf(year, monthIndex, day)),
          ),
        });
        return;
      case "End":
        move({
          kind: "day",
          date: isoDate(
            year,
            monthIndex,
            event.ctrlKey || event.metaKey
              ? days
              : Math.min(days, day + (6 - weekdayOf(year, monthIndex, day))),
          ),
        });
        return;
      case "PageUp":
      case "PageDown": {
        // The month changes here and only here, through the same `step` the
        // arrow buttons use. The day number is kept and clamped, so Page Down
        // from 31 May lands on 30 June rather than nowhere.
        event.preventDefault();
        const direction = key === "PageUp" ? -1 : 1;
        const nextMonth = monthIndex + direction;
        const nextYear = year + (nextMonth < 0 ? -1 : nextMonth > 11 ? 1 : 0);
        const wrapped = (nextMonth + 12) % 12;
        const clamped = Math.min(day, daysInMonth(nextYear, wrapped));
        movedByKey.current = true;
        setActive({ kind: "day", date: isoDate(nextYear, wrapped, clamped) });
        step(direction);
        return;
      }
      case " ":
      case "Enter":
        event.preventDefault();
        toggleDate(active.date);
        return;
      default:
        return;
    }
  };

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
      <div className={styles.controls}>
        <button
          id="prevMonthBtn"
          type="button"
          aria-label="Previous month"
          onClick={() => {
            step(-1);
          }}
        >
          <ChevronLeftIcon />
        </button>
        <select
          id="monthSelect"
          // The visible text is the value, so there is nowhere to put a label
          // without repeating "Month" beside a control that already says
          // "June". A name it is (axe `select-name`, critical).
          aria-label="Month"
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
          // Same reasoning as the month select (axe `label`, critical).
          aria-label="Year"
          type="number"
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={yearDraft}
          onChange={(event) => {
            const next = event.target.value;
            setYearDraft(next);
            // Only a usable year is committed. An unusable one stays in the
            // field and reaches nothing — which is the whole of DEF-002: the
            // year used to go straight through, the day cells took dates like
            // `5-12-01`, and saving wrote that where a `YYYY-MM` key belongs.
            const parsed = Number(next);
            if (isSupportedYear(parsed)) onMonthChange(parsed, monthIndex);
          }}
          onBlur={() => {
            // Typing "2026" passes through "2", "20" and "202", so a draft
            // that is not yet a year is normal while the field has focus. On
            // the way out it is not, and the last good year comes back rather
            // than the field being left saying something the calendar is not.
            if (!isSupportedYear(Number(yearDraft))) setYearDraft(String(year));
          }}
        />
        <button
          id="nextMonthBtn"
          type="button"
          aria-label="Next month"
          onClick={() => {
            step(1);
          }}
        >
          <ChevronRightIcon />
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
          className="danger"
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

      {/* One tab stop for the whole grid, then the arrow keys. 30 to 37 day
          cells cannot each be a tab stop, so the grid holds a roving tabindex:
          exactly one cell is tabbable, and the arrows move which. That is the
          WAI-ARIA date-grid pattern.

          The wrapper takes an `id` and no class. `.calendar .weekend` paints
          the weekend columns, and the seven weekday headers already carry
          `weekend` — inert today only because `#calendar-dow` is not inside
          `.calendar`. A `class="calendar"` here would start painting them and
          move both screenshot baselines. */}
      <div
        id="calendar-grid"
        ref={grid}
        role="grid"
        aria-multiselectable="true"
        aria-label={`${MONTH_NAMES[monthIndex] ?? ""} ${String(year)}`}
        onKeyDown={onGridKeyDown}
      >
        <div id="calendar-keys" className="sr-only">
          Use the arrow keys to move between dates and Space to select. Page Up
          and Page Down change the month. Arrow up from the top row reaches the
          weekday headings, where Space selects every date of that weekday in
          the month.
        </div>

        <div id="calendar-dow" className={styles.dow} role="row">
          {DAY_NAMES.map((name, index) => (
            <div
              key={name}
              role="columnheader"
              data-weekday={String(index)}
              className={index >= 5 ? styles.weekend : undefined}
              title={`Select all ${name}s in this month`}
              // The full weekday name, because a screen reader reads the column
              // header when the column changes and "Mon" is not a word. The
              // visible text stays "Mon" — the frozen contract asserts it.
              aria-label={`Select all ${FULL_DAY_NAMES[index] ?? name}s in this month`}
              tabIndex={
                active.kind === "header" && active.weekday === index ? 0 : -1
              }
              aria-describedby="calendar-keys"
              onFocus={() => {
                setActive({ kind: "header", weekday: index });
              }}
              onClick={() => {
                selectWeekday(index);
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <div id="calendar" className={styles.calendar} role="rowgroup">
          {weeks.map((week, weekIndex) => (
            // `display: contents` in the stylesheet, so the row is a real node
            // in the accessibility tree and no box in the layout. Measured: the
            // cells keep their position in the seven-column grid.
            <div
              key={`week-${String(weekIndex)}`}
              className={styles.week}
              role="row"
            >
              {week.map((cell, columnIndex) =>
                "spacer" in cell ? (
                  <div
                    key={`spacer-${String(weekIndex)}-${String(columnIndex)}`}
                    className={cx(
                      styles.spacer,
                      cell.weekday >= 5 && styles.weekend,
                    )}
                    role="gridcell"
                    aria-hidden="true"
                  />
                ) : (
                  <div
                    key={cell.dateKey}
                    className={cell.classes}
                    role="gridcell"
                    data-date={cell.dateKey}
                    data-day={String(cell.day)}
                    data-weekday={String(cell.weekday)}
                    aria-selected={selected.has(cell.dateKey)}
                    aria-label={cell.label}
                    aria-current={
                      cell.dateKey === todayKey ? "date" : undefined
                    }
                    aria-describedby="calendar-keys"
                    tabIndex={
                      active.kind === "day" && active.date === cell.dateKey
                        ? 0
                        : -1
                    }
                    // The roving stop follows focus, however focus arrived —
                    // a click, a screen reader's own navigation, or a test.
                    // Without this the arrows would keep moving from wherever
                    // the stop started, so clicking the 20th and pressing
                    // ArrowRight would jump back near the 15th.
                    onFocus={() => {
                      setActive({ kind: "day", date: cell.dateKey });
                    }}
                    onClick={() => {
                      toggleDate(cell.dateKey);
                    }}
                  >
                    {cell.day}
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selecting a whole weekday changes up to five cells that are not
          focused, which is otherwise silent. The count and the month only —
          never the total, because the bulk price input writes on every
          keystroke and would queue an announcement per digit.

          Outside `#calendar-grid`, not inside it: a `role="grid"` may only
          contain rows and their descendants, so a `role="status"` child made it
          an invalid grid (axe `aria-required-children`, critical). A live
          region announces from anywhere, so the fix costs nothing. */}
      <div className="sr-only" role="status">
        {announcement}
      </div>

      <div id="calendar-summary">
        {selectedInMonth > 0
          ? `${String(selectedInMonth)} days selected in ${MONTH_NAMES[monthIndex] ?? ""} — Total: ${formatCurrency(total, currency)}`
          : ""}
      </div>

      <div id="price-setter-container">
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
            // On input, not on blur. The legacy handler is bound to `oninput`, so
            // the summary total follows each keystroke — and a test that fills the
            // field without blurring still sees the price applied. An earlier
            // version of this component used `onBlur` and silently applied
            // nothing.
            const value = Number(event.target.value);
            if (Number.isNaN(value)) return;
            // `monthKey` is the month on screen. Passing it is the whole of
            // DEF-010: before batch 3.4a the price went into every month
            // holding a selected date, including ones the user could not see.
            onOverridesChange(
              applyBulkPrice(overrides, selected, value, monthKey),
            );
          }}
        />
        {selected.size === 0 && (
          <span id="selectedDatesPriceHelper" className={styles.helper}>
            Select dates to enable price editing.
          </span>
        )}
      </div>

      <div className="dialog-actions">
        <button id="cancelDateChangesBtn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          id="saveDateChangesBtn"
          type="button"
          className="primary"
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
};

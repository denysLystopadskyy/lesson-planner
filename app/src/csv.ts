import { pad } from "./schedule";
import { DEFAULT_CURRENCY, type Group, type MonthKey } from "./types";

/**
 * The CSV format, ported from `App.services.csv` and `App.utils`.
 *
 * Pure functions, like `schedule.ts`, so the format can be read without a
 * browser and unit-tested in batch 2b.1.
 *
 * **Four defects are reproduced here on purpose.** A faithful port is the whole
 * brief for slice 2a.3; changing behaviour in the batch that moves it makes the
 * cutover impossible to reason about. Each fix has a Phase 3 batch:
 *
 * - **DEF-005** — the export carries groups only. The payment template, one of
 *   the three stored keys, is not in it, so the "backup" restores a planner
 *   with a template the teacher did not write. Batch 3.3 replaces this with a
 *   versioned JSON backup rather than widening the CSV.
 * - **DEF-006** — `parseCsv` rejects only a quote left open at end of file. A
 *   *balanced* stray quote such as `"a"b"c"` parses to `abc` and is accepted.
 *   Batch 3.4b.
 * - **DEF-007** — no UTF-8 BOM, so Excel on Windows reads the Cyrillic group
 *   names as mojibake. Batch 3.4b.
 * - **DEF-002** — `normalizeMonthKey` accepts `5-06` shapes the year input can
 *   produce. Batch 3.2.
 */

const HEADER = [
  "Name",
  "Default Price",
  "Currency",
  "Month",
  "Month Price",
  "Dates",
] as const;

/** Quote every field and double any quote inside it, per RFC 4180. */
export const escapeCsvValue = (value: string | number | undefined): string => {
  const stringValue = value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
};

/**
 * Basic RFC4180-ish parser.
 *
 * Ported statement for statement, including the index skip on a doubled quote
 * and the end-of-file check that is the *only* validation it does — see
 * DEF-006 above.
 */
export const parseCsv = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    if (inQuotes) {
      if (char === '"') {
        if (csvText[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char ?? "";
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\r") {
      continue;
    } else if (char === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char ?? "";
    }
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unmatched quote detected.");
  }
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
};

/** Normalises a month value coming from CSV into `YYYY-MM`. */
export const normalizeMonthKey = (value: string): MonthKey => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = /^(\d{4})[-/]?(\d{1,2})$/.exec(trimmed);
  if (match === null) throw new Error(`Invalid month format: "${value}"`);
  const [, year, rawMonth] = match;
  const month = Number(rawMonth);
  if (month < 1 || month > 12)
    throw new Error(`Invalid month value: "${value}"`);
  return `${year ?? ""}-${pad(month)}`;
};

/** One row per month, or a single bare row for a group with no months. */
export const serializeCsv = (groups: Group[]): string => {
  const rows: (string | number | undefined)[][] = [[...HEADER]];

  for (const group of groups) {
    const overrides = group.monthlyOverrides ?? {};
    const months = Object.keys(overrides).sort();
    if (months.length === 0) {
      rows.push([group.name, group.price, group.currency, "", "", ""]);
      continue;
    }
    for (const monthKey of months) {
      const monthData = overrides[monthKey] ?? {
        price: group.price,
        dates: [],
      };
      rows.push([
        group.name,
        group.price,
        group.currency,
        monthKey,
        monthData.price,
        monthData.dates.join(" "),
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
};

const parseNumber = (value: string | undefined): number | null => {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

/** Reads an export back. Import always replaces; there is no merge. */
export const deserializeCsv = (
  csvText: string,
): { groups: Group[]; defaultCurrency: string } => {
  const parsedRows = parseCsv(csvText).filter((row) =>
    row.some((cell) => cell.trim() !== ""),
  );
  if (parsedRows.length === 0) throw new Error("CSV file is empty.");

  const header = (parsedRows[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const requireColumn = (label: string): number => {
    const index = header.indexOf(label);
    if (index === -1) throw new Error(`Missing "${label}" column in CSV.`);
    return index;
  };
  const idx = {
    name: requireColumn("name"),
    defaultPrice: requireColumn("default price"),
    currency: requireColumn("currency"),
    month: requireColumn("month"),
    monthPrice: requireColumn("month price"),
    dates: requireColumn("dates"),
  };

  const groupsMap = new Map<string, Group>();
  for (const row of parsedRows.slice(1)) {
    if (row.length === 0) continue;
    const name = (row[idx.name] ?? "").trim();
    if (!name) continue;

    const defaultPrice = parseNumber(row[idx.defaultPrice]) ?? 0;
    const currency = (row[idx.currency] ?? "").trim() || DEFAULT_CURRENCY;
    const monthValue = (row[idx.month] ?? "").trim();
    const monthPrice = parseNumber(row[idx.monthPrice]);
    const datesRaw = (row[idx.dates] ?? "").trim();
    const dates = datesRaw ? datesRaw.split(/\s+/).filter(Boolean) : [];

    const group = groupsMap.get(name) ?? {
      name,
      price: defaultPrice,
      currency,
      dates: [],
      monthlyOverrides: {},
    };
    groupsMap.set(name, group);
    // The last row for a name wins on both fields, as in the legacy loop.
    group.price = defaultPrice;
    group.currency = currency;

    if (monthValue) {
      const monthKey = normalizeMonthKey(monthValue);
      const overrides = (group.monthlyOverrides ??= {});
      const override = (overrides[monthKey] ??= {
        price: group.price,
        dates: [],
      });
      if (monthPrice !== null) override.price = monthPrice;
      override.dates =
        dates.length > 0
          ? [...new Set([...override.dates, ...dates])].sort()
          : [];
    }

    if (dates.length > 0) {
      group.dates = [...new Set([...group.dates, ...dates])].sort();
    }
  }

  const groups = [...groupsMap.values()].map((group) => ({
    ...group,
    dates: [...new Set(group.dates)].sort(),
    // A month left with no dates is dropped, not kept at zero — the same rule
    // `commitSelection` and the legacy `normalizeOverrides` follow.
    monthlyOverrides: Object.fromEntries(
      Object.entries(group.monthlyOverrides ?? {}).filter(
        ([, override]) => override.dates.length > 0,
      ),
    ),
  }));

  return {
    groups,
    defaultCurrency: groups[0]?.currency ?? DEFAULT_CURRENCY,
  };
};

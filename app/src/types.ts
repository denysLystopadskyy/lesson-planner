/**
 * The stored shapes, exactly as the legacy app writes them.
 *
 * These mirror .claude/context/storage-data-contract.md. Nothing here may be
 * renamed or reshaped before Phase 4 — the React app has to read what the
 * legacy app wrote, and write what the legacy app can still read.
 */

export type MonthKey = string; // "YYYY-MM"
export type DateKey = string; // "YYYY-MM-DD"

export type MonthOverride = {
  price: number;
  dates: DateKey[];
};

export type Group = {
  name: string;
  price: number;
  /** Absent in data written by older versions — see DEF-003. */
  currency?: string;
  dates: DateKey[];
  /** Absent in data written by older versions. */
  monthlyOverrides?: Record<MonthKey, MonthOverride>;
};

export type Settings = {
  defaultCurrency: string;
};

export const DEFAULT_CURRENCY = "UAH";

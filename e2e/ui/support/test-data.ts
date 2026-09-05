import { faker } from "@faker-js/faker";
import { isoDate, monthKey as toMonthKey } from "./formatters";

export type MonthOverride = {
  price: number;
  dates: string[];
};

export type Group = {
  name: string;
  price: number;
  currency: string;
  dates: string[];
  monthlyOverrides: Record<string, MonthOverride>;
};

export const seedFaker = (seed: number) => {
  faker.seed(seed);
};

export const seedFromTitle = (title: string) => {
  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
};

export const pickCurrency = () => faker.helpers.arrayElement(["UAH", "PLN"]);

export const pickMonthContext = () => {
  const date = faker.date.soon({ days: 240 });
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  return {
    year,
    monthIndex,
    key: toMonthKey(year, monthIndex),
  };
};

export const buildDates = ({
  year,
  monthIndex,
  days,
}: {
  year: number;
  monthIndex: number;
  days: number[];
}) => {
  return days.map((day) => isoDate(year, monthIndex, day));
};

export const randomDatesInMonth = ({
  year,
  monthIndex,
  count,
}: {
  year: number;
  monthIndex: number;
  count: number;
}) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const pool = Array.from({ length: daysInMonth }, (_, idx) => idx + 1);
  const selected = faker.helpers.arrayElements(pool, count);
  return buildDates({ year, monthIndex, days: selected });
};

export const buildOverride = ({
  monthKey,
  price,
  dates,
}: {
  monthKey: string;
  price: number;
  dates: string[];
}) => {
  return {
    monthKey,
    override: {
      price,
      dates: Array.from(new Set(dates)).sort(),
    },
  };
};

export const buildGroup = (options: Partial<Group> = {}): Group => {
  const currency = options.currency ?? pickCurrency();
  const price = options.price ?? faker.number.int({ min: 50, max: 1200 });
  const monthlyOverrides = options.monthlyOverrides ?? {};

  const overrideDates = Object.values(monthlyOverrides).flatMap(
    (override) => override.dates ?? [],
  );
  const combinedDates = [...(options.dates ?? []), ...overrideDates];

  const dates = Array.from(new Set(combinedDates)).sort();

  const normalizedOverrides = Object.fromEntries(
    Object.entries(monthlyOverrides).map(([key, override]) => [
      key,
      {
        price: override.price,
        dates: Array.from(new Set(override.dates ?? [])).sort(),
      },
    ]),
  );

  return {
    name: options.name ?? faker.company.name(),
    price,
    currency,
    dates,
    monthlyOverrides: normalizedOverrides,
  };
};

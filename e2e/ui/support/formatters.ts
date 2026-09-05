const pad = (value: number) => String(value).padStart(2, "0");

export const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
};

export const monthKey = (year: number, monthIndex: number) => {
  return `${String(year)}-${pad(monthIndex + 1)}`;
};

export const monthName = (key: string) => {
  return new Date(`${key}-02`).toLocaleString("en-US", { month: "long" });
};

export const countWeekdayInMonth = (
  year: number,
  monthIndex: number,
  weekdayIndexMon0: number,
) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    const dayIndexMon0 = (date.getDay() + 6) % 7;
    if (dayIndexMon0 === weekdayIndexMon0) count += 1;
  }
  return count;
};

export const isoDate = (year: number, monthIndex: number, day: number) => {
  return `${String(year)}-${pad(monthIndex + 1)}-${pad(day)}`;
};

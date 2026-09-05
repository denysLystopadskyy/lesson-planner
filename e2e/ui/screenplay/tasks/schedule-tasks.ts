import { BrowseTheWeb } from "../abilities/browse-the-web";
import type { Task } from "../actor";
import { step } from "../../support/steps";
import { monthKey, monthName } from "../../support/formatters";

export const openScheduleEditor = (): Task => async (actor) => {
  await step("Open schedule editor", async () => {
    const { groupModal } = actor.abilityTo(BrowseTheWeb);
    await groupModal.openScheduleEditor();
  });
};

export const setCalendarMonthYear =
  (year: number, monthIndex: number): Task =>
  async (actor) => {
    await step(
      `Set calendar to ${monthName(monthKey(year, monthIndex))} ${year}`,
      async () => {
        const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
        await calendarEditor.setMonthYear(year, monthIndex);
      },
    );
  };

export const selectCalendarDay =
  (year: number, monthIndex: number, day: number): Task =>
  async (actor) => {
    await step(`Select day ${day}`, async () => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await calendarEditor.selectDay(year, monthIndex, day);
    });
  };

export const selectCalendarDays =
  (year: number, monthIndex: number, days: number[]): Task =>
  async (actor) => {
    await step(`Select days: ${days.join(", ")}`, async () => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      for (const day of days) {
        await calendarEditor.selectDay(year, monthIndex, day);
      }
    });
  };

export const toggleWeekday =
  (label: string): Task =>
  async (actor) => {
    await step(`Toggle weekday ${label}`, async () => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      const weekdayIndex = [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
      ].indexOf(label);
      if (weekdayIndex < 0) {
        throw new Error(`Unsupported weekday label: ${label}`);
      }
      await calendarEditor.toggleWeekday(weekdayIndex);
    });
  };

export const clearMonthSelection = (): Task => async (actor) => {
  await step("Clear month selection", async () => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await calendarEditor.clearMonth();
  });
};

export const setBulkPrice =
  (value: number): Task =>
  async (actor) => {
    await step(`Set bulk price to ${value}`, async () => {
      const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
      await calendarEditor.setBulkPrice(value);
    });
  };

export const saveDateChanges = (): Task => async (actor) => {
  await step("Save date changes", async () => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await calendarEditor.saveChanges();
  });
};

export const cancelDateChanges = (): Task => async (actor) => {
  await step("Cancel date changes", async () => {
    const { calendarEditor } = actor.abilityTo(BrowseTheWeb);
    await calendarEditor.cancelChanges();
  });
};

import type { Locator, Page } from "@playwright/test";
import { isoDate } from "../support/formatters";

export class CalendarEditor {
  readonly page: Page;
  readonly container: Locator;
  readonly monthSelect: Locator;
  readonly yearInput: Locator;
  readonly calendar: Locator;
  readonly calendarDow: Locator;
  readonly clearMonthButton: Locator;
  readonly selectedDatesPriceInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly summary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator("#calendar-container");
    this.monthSelect = page.locator("#monthSelect");
    this.yearInput = page.locator("#yearInput");
    this.calendar = page.locator("#calendar");
    this.calendarDow = page.locator("#calendar-dow");
    this.clearMonthButton = page.locator("#clearMonthBtn");
    this.selectedDatesPriceInput = page.locator("#selectedDatesPriceInput");
    this.saveButton = page.locator("#saveDateChangesBtn");
    this.cancelButton = page.locator("#cancelDateChangesBtn");
    this.summary = page.locator("#calendar-summary");
  }

  dayCell(year: number, monthIndex: number, day: number) {
    return this.calendar.locator(
      `[data-date="${isoDate(year, monthIndex, day)}"]`,
    );
  }

  weekdayHeader(dayIndex: number) {
    return this.calendarDow.locator(`[data-weekday="${String(dayIndex)}"]`);
  }

  async setMonthYear(year: number, monthIndex: number) {
    await this.monthSelect.selectOption(String(monthIndex));
    await this.yearInput.fill(String(year));
    await this.yearInput.press("Tab");
  }

  async selectDay(year: number, monthIndex: number, day: number) {
    await this.dayCell(year, monthIndex, day).click();
  }

  async toggleWeekday(dayIndex: number) {
    await this.weekdayHeader(dayIndex).click();
  }

  async clearMonth() {
    await this.clearMonthButton.click();
  }

  async setBulkPrice(value: number) {
    await this.selectedDatesPriceInput.fill(String(value));
  }

  async saveChanges() {
    await this.saveButton.click();
  }

  async cancelChanges() {
    await this.cancelButton.click();
  }

  selectedDays() {
    return this.calendar.locator(".day.selected");
  }
}

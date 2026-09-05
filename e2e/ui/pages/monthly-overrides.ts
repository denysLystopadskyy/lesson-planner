import type { Locator, Page } from "@playwright/test";

export class MonthlyOverrides {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator("#monthlyOverrides");
  }

  rowByMonthKey(key: string) {
    return this.page.locator(`[data-month-key="${key}"]`);
  }

  lessonCount(key: string) {
    return this.rowByMonthKey(key).getByTestId("month-lesson-count");
  }

  copyButton(key: string) {
    return this.rowByMonthKey(key).getByTestId("copy-payment-message");
  }

  totalText(key: string) {
    return this.rowByMonthKey(key).getByTestId("month-total");
  }

  perLessonText(key: string) {
    return this.rowByMonthKey(key).getByTestId("price-per-lesson");
  }

  async copyPaymentMessage(key: string) {
    await this.copyButton(key).click();
  }

  async isCopyEnabled(key: string) {
    return this.copyButton(key).isEnabled();
  }
}

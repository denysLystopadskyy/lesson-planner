import type { Locator, Page } from "@playwright/test";

export class ReviewModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly textarea: Locator;
  readonly copyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator("#reviewModal");
    this.textarea = page.locator("#reviewTextarea");
    this.copyButton = page.locator("#copyAndCloseBtn");
    this.cancelButton = page.locator("#cancelReviewBtn");
  }

  async messageValue() {
    return this.textarea.inputValue();
  }

  async copyAndClose() {
    await this.copyButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }
}

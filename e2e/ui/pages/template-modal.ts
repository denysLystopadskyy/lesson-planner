import type { Locator, Page } from "@playwright/test";

export class TemplateModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly panel: Locator;
  readonly textarea: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator("#templateModal");
    this.panel = page.locator("#templateModal .modal");
    this.textarea = page.locator("#templateTextarea");
    this.saveButton = page.locator("#saveTemplateBtn");
    this.cancelButton = page.locator("#cancelTemplateBtn");
  }

  async setTemplate(text: string) {
    await this.textarea.fill(text);
  }

  async templateValue() {
    return this.textarea.inputValue();
  }

  async save() {
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }
}

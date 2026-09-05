import type { Locator, Page } from "@playwright/test";

export class PlannerPage {
  readonly page: Page;
  readonly addGroupButton: Locator;
  readonly editTemplateButton: Locator;
  readonly loadCsvButton: Locator;
  readonly saveCsvButton: Locator;
  readonly clearDataButton: Locator;
  readonly csvInput: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addGroupButton = page.locator("#addGroupBtn");
    this.editTemplateButton = page.locator("#editTemplateBtn");
    this.loadCsvButton = page.locator("#loadCsvBtn");
    this.saveCsvButton = page.locator("#saveCsvBtn");
    this.clearDataButton = page.locator("#clearDataBtn");
    this.csvInput = page.locator("#csvInput");
    this.emptyState = page.locator(".empty-state");
  }

  groupCard(name: string) {
    return this.page.locator(`[data-group-name=${JSON.stringify(name)}]`);
  }

  groupCardLessonCount(name: string) {
    return this.groupCard(name).getByTestId("group-card-lesson-count");
  }

  async openAddGroupModal() {
    await this.addGroupButton.click();
  }

  async openGroupCard(name: string) {
    await this.groupCard(name).click();
  }

  async openTemplateModal() {
    await this.editTemplateButton.click();
  }

  async saveCsv() {
    await this.saveCsvButton.click();
  }

  async loadCsv(filePath: string) {
    await this.csvInput.setInputFiles(filePath);
  }

  async clearAllData() {
    await this.clearDataButton.click();
  }
}

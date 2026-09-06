import { expect, type Locator, type Page } from "@playwright/test";

export class PlannerPage {
  readonly page: Page;
  readonly addGroupButton: Locator;
  readonly editTemplateButton: Locator;
  readonly loadCsvButton: Locator;
  readonly saveCsvButton: Locator;
  readonly clearDataButton: Locator;
  readonly csvInput: Locator;
  /** Owned by the group dialog; held here only to wait for it to take focus. */
  readonly groupNameInput: Locator;
  readonly emptyState: Locator;
  /** The page title. Held for layout checks — see visual-layout.spec.ts. */
  readonly pageTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addGroupButton = page.locator("#addGroupBtn");
    this.editTemplateButton = page.locator("#editTemplateBtn");
    this.loadCsvButton = page.locator("#loadCsvBtn");
    this.saveCsvButton = page.locator("#saveCsvBtn");
    this.clearDataButton = page.locator("#clearDataBtn");
    this.csvInput = page.locator("#csvInput");
    this.groupNameInput = page.locator("#groupNameInput");
    // Located by its user-facing text, not the .empty-state styling class:
    // testing.md prefers role and text locators, and this keeps index.html
    // unchanged rather than expanding the frozen testid contract.
    this.emptyState = page.getByText("No groups yet");
    this.pageTitle = page.getByRole("heading", { level: 1 });
  }

  groupCard(name: string) {
    return this.page.locator(`[data-group-name=${JSON.stringify(name)}]`);
  }

  groupCardLessonCount(name: string) {
    return this.groupCard(name).getByTestId("group-card-lesson-count");
  }

  /**
   * Opens the add-group dialog and waits until it is safe to type into.
   *
   * The wait is not padding. `openGroupModal` ends with
   * `setTimeout(() => groupNameInput.focus(), 100)`, so the app steals focus
   * back to the name field a tenth of a second after the dialog appears. A test
   * that starts filling immediately can be mid-way through the price field when
   * that fires, and the price text lands in the name box instead — producing a
   * group called "Price the smallest fraction0.01" with a price of 0.
   *
   * Waiting for the focus to arrive uses the app's own signal that the timeout
   * has run, so there is no sleep and no race left.
   */
  async openAddGroupModal() {
    await this.addGroupButton.click();
    await expect(this.groupNameInput).toBeFocused();
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

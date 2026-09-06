import type { Locator, Page } from "@playwright/test";

export class GroupModal {
  readonly page: Page;
  readonly modal: Locator;
  /**
   * The dialog panel inside the overlay.
   *
   * Structure assertions anchor here rather than on the overlay. The React port
   * marks the overlay `role="dialog" aria-modal="true"`, which the legacy
   * markup does not, so an accessibility snapshot taken at the overlay differs
   * between the two apps by a wrapper node and nothing else. Taken at the panel
   * it is the same tree for both — and the port keeps the role, which is the
   * behaviour worth having.
   */
  readonly panel: Locator;
  readonly groupNameInput: Locator;
  readonly groupPriceInput: Locator;
  readonly groupCurrencySelect: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly editInfoButton: Locator;
  readonly deleteButton: Locator;
  readonly editScheduleButton: Locator;
  readonly monthlySection: Locator;
  readonly nameDisplay: Locator;
  readonly priceDisplay: Locator;
  readonly currencyDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator("#groupModal");
    this.panel = page.locator("#groupModal .modal");
    this.groupNameInput = page.locator("#groupNameInput");
    this.groupPriceInput = page.locator("#groupPriceInput");
    this.groupCurrencySelect = page.locator("#groupCurrencyInput");
    this.saveButton = page.locator("#saveGroupBtn");
    this.cancelButton = page.locator("#cancelGroupBtn");
    this.editInfoButton = page.locator("#editGroupInfoBtn");
    this.deleteButton = page.locator("#deleteGroupBtn");
    this.editScheduleButton = page.locator("#editScheduleBtn");
    this.monthlySection = page.locator("#monthlySection");
    this.nameDisplay = page.locator("#groupNameDisplay");
    this.priceDisplay = page.locator("#groupPriceDisplay");
    this.currencyDisplay = page.locator("#groupCurrencyDisplay");
  }

  async enterEditMode() {
    await this.editInfoButton.click();
  }

  /**
   * The field order here is load-bearing, not stylistic. `groupPriceInput`'s
   * `onchange` calls `updateDefaultPrice()`, which re-renders the group info and
   * overwrites an unsaved name edit — that is DEF-009. Filling the name first
   * would therefore lose it and the tests would fail. Keep price first until
   * DEF-009 is fixed in plan batch 3.4a.
   */
  async fillGroupInfo({
    name,
    price,
    currency,
  }: {
    name: string;
    price: number;
    currency: string;
  }) {
    await this.groupPriceInput.fill(String(price));
    await this.groupNameInput.fill(name);
    await this.groupCurrencySelect.selectOption(currency);
  }

  async saveGroup() {
    await this.saveButton.click();
  }

  async cancelGroupEdit() {
    await this.cancelButton.click();
  }

  async deleteGroup() {
    await this.deleteButton.click();
  }

  async openScheduleEditor() {
    await this.editScheduleButton.click();
  }

  async displayedName() {
    return this.nameDisplay.textContent();
  }

  async displayedPrice() {
    return this.priceDisplay.textContent();
  }

  async displayedCurrency() {
    return this.currencyDisplay.textContent();
  }
}

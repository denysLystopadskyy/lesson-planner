import type { Page } from "@playwright/test";
import { PlannerPage } from "../../pages/planner-page";
import { GroupModal } from "../../pages/group-modal";
import { CalendarEditor } from "../../pages/calendar-editor";
import { MonthlyOverrides } from "../../pages/monthly-overrides";
import { TemplateModal } from "../../pages/template-modal";
import { ReviewModal } from "../../pages/review-modal";

export class BrowseTheWeb {
  readonly page: Page;
  readonly planner: PlannerPage;
  readonly groupModal: GroupModal;
  readonly calendarEditor: CalendarEditor;
  readonly monthlyOverrides: MonthlyOverrides;
  readonly templateModal: TemplateModal;
  readonly reviewModal: ReviewModal;

  constructor(page: Page) {
    this.page = page;
    this.planner = new PlannerPage(page);
    this.groupModal = new GroupModal(page);
    this.calendarEditor = new CalendarEditor(page);
    this.monthlyOverrides = new MonthlyOverrides(page);
    this.templateModal = new TemplateModal(page);
    this.reviewModal = new ReviewModal(page);
  }

  static using(page: Page) {
    return new BrowseTheWeb(page);
  }
}

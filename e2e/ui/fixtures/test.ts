import { test as base, expect } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import {
  plannerState as normalizePlannerState,
  type PlannerState,
  type PlannerStateInput,
} from "../support/planner-state";
import { buildStorageState } from "../support/storage-state";
import { seedFaker, seedFromTitle } from "../support/test-data";
import { stubClipboard } from "../support/clipboard";
import { Actor } from "../screenplay/actor";
import { BrowseTheWeb } from "../screenplay/abilities/browse-the-web";

type TestOptions = {
  plannerState: PlannerState;
  clipboard: boolean;
};

type Fixtures = {
  actor: Actor;
  context: BrowserContext;
  resolvedBaseURL: string;
};

export const test = base.extend<TestOptions & Fixtures>({
  plannerState: [normalizePlannerState(), { option: true }],
  clipboard: [false, { option: true }],
  resolvedBaseURL: async ({}, use, testInfo) => {
    const { baseURL = "http://localhost:4173" } = testInfo.project.use;
    await use(baseURL);
  },
  context: async (
    { browser, plannerState, resolvedBaseURL, clipboard },
    use,
    testInfo,
  ) => {
    const storageState = buildStorageState(resolvedBaseURL, plannerState);
    const { timezoneId = "UTC" } = testInfo.project.use;
    const context = await browser.newContext({
      storageState,
      timezoneId,
      acceptDownloads: true,
    });

    if (clipboard) {
      await stubClipboard(context);
    }

    await use(context);
    await context.close();
  },
  page: async ({ context, resolvedBaseURL }, use) => {
    const page = await context.newPage();
    await page.goto(resolvedBaseURL);
    await use(page);
  },
  actor: async ({ page }, use) => {
    const actor = Actor.named("Planner").whoCan(BrowseTheWeb.using(page));
    await use(actor);
  },
});

export const configureTest = (
  options: {
    plannerState?: PlannerStateInput;
    clipboard?: boolean;
  } = {},
): typeof test => {
  return test.extend({
    plannerState: normalizePlannerState(options.plannerState),
    clipboard: options.clipboard ?? false,
  });
};

test.beforeEach(async ({}, testInfo) => {
  seedFaker(seedFromTitle(testInfo.title) + testInfo.workerIndex);
});

export { expect };

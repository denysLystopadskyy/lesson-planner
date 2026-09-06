import { test as base, expect } from "@playwright/test";
import type { BrowserContext, BrowserContextOptions } from "@playwright/test";
import {
  plannerState as normalizePlannerState,
  type PlannerState,
  type PlannerStateInput,
} from "../support/planner-state";
import { buildStorageState } from "../support/storage-state";
import { seedFaker, seedFromTitle } from "../support/test-data";
import { stubClipboard, type ClipboardMode } from "../support/clipboard";
import { FIXED_NOW } from "../support/clock";
import { APP_BASE_PATH, APP_STORAGE_PREFIX } from "../support/environment";
import { Actor } from "../screenplay/actor";
import { BrowseTheWeb } from "../screenplay/abilities/browse-the-web";

export type TestOptions = {
  plannerState: PlannerState;
  clipboard: ClipboardMode;
  /** The instant the browser runs at. Override per spec to test a boundary. */
  now: Date;
  /**
   * Storage state to use verbatim instead of building it from `plannerState`.
   * The storage-contract specs need shapes `plannerState` cannot express — a
   * legacy group with no currency, or a key holding text that is not JSON.
   */
  storageOverride: BrowserContextOptions["storageState"] | undefined;
  /** Path the app is served under; set by the project. */
  basePath: string;
  /** Prefix on the three storage keys; set by the project. */
  storagePrefix: string;
};

type Fixtures = {
  actor: Actor;
  context: BrowserContext;
  resolvedBaseURL: string;
};

export const test = base.extend<TestOptions & Fixtures>({
  plannerState: [normalizePlannerState(), { option: true }],
  clipboard: ["off", { option: true }],
  now: [FIXED_NOW, { option: true }],
  storageOverride: [undefined, { option: true }],
  basePath: [APP_BASE_PATH, { option: true }],
  storagePrefix: [APP_STORAGE_PREFIX, { option: true }],
  resolvedBaseURL: async ({}, use, testInfo) => {
    const { baseURL = "http://localhost:4173" } = testInfo.project.use;
    await use(baseURL);
  },
  context: async (
    {
      browser,
      plannerState,
      resolvedBaseURL,
      clipboard,
      now,
      storageOverride,
      storagePrefix,
    },
    use,
    testInfo,
  ) => {
    const storageState =
      storageOverride ??
      buildStorageState(resolvedBaseURL, plannerState, storagePrefix);
    const { timezoneId = "UTC" } = testInfo.project.use;
    const context = await browser.newContext({
      storageState,
      timezoneId,
      acceptDownloads: true,
    });

    // Pin the clock on the context, not the page. The clock is context-scoped,
    // so installing it here registers the init script before any page exists —
    // which means it covers the app's load-time `new Date()` calls. Doing it
    // after `page.goto()` would be too late: `App.state.calMonth` and
    // `calYear` are evaluated while the inline script parses.
    //
    // `setFixedTime` rather than `install`: it freezes what `Date.now()` and
    // `new Date()` report while leaving timers running normally. The app has
    // five `setTimeout` calls, two of them focus calls in the template and
    // review modals, and `pauseAt` would strand them.
    await context.clock.setFixedTime(now);

    if (clipboard !== "off") {
      await stubClipboard(context, clipboard);
    }

    await use(context);
    await context.close();
  },
  page: async ({ context, resolvedBaseURL, basePath }, use) => {
    const page = await context.newPage();
    await page.goto(new URL(basePath, resolvedBaseURL).toString());
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
    clipboard?: ClipboardMode;
    now?: Date;
    storageOverride?: BrowserContextOptions["storageState"];
  } = {},
): typeof test => {
  return test.extend({
    plannerState: normalizePlannerState(options.plannerState),
    clipboard: options.clipboard ?? "off",
    now: options.now ?? FIXED_NOW,
    storageOverride: options.storageOverride,
  });
};

// Seeded from the title alone, deliberately not from the worker index. Adding
// the index made the same test generate different data on different workers,
// so a failure could not be reproduced locally and a retry that landed
// elsewhere was not re-running the same case. Specs are isolated by their own
// storage state, so two workers holding identical data costs nothing.
test.beforeEach(({}, testInfo) => {
  seedFaker(seedFromTitle(testInfo.title));
});

export { expect };

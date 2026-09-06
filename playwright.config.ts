import { defineConfig } from "@playwright/test";
import {
  APP_BASE_PATH,
  APP_STORAGE_PREFIX,
} from "./e2e/ui/support/environment";
import type { TestOptions } from "./e2e/ui/fixtures/test";

/**
 * One app, one project.
 *
 * Between batches 2a.3a and 2a.4 there were two: `legacy` served the original
 * `index.html` at `/`, and `ported` served the React build at `/next/` with
 * prefixed storage keys. Specs carried `@ported` to run against both and
 * `@portedonly` to run against the port alone. The cutover deleted the legacy
 * page, so both tags and the second project went with it.
 *
 * `npm run serve` builds the app the way the deploy workflow does — base `/`,
 * no storage prefix — and previews it, so the suite runs against the same
 * output that ships.
 */
export default defineConfig<TestOptions>({
  testDir: "e2e/features",
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["junit", { outputFile: "test-results/junit.xml" }], ["html"]]
    : [["list"], ["html"]],
  use: {
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "app",
      use: {
        baseURL: "http://localhost:4173",
        basePath: APP_BASE_PATH,
        storagePrefix: APP_STORAGE_PREFIX,
      },
    },
  ],

  webServer: {
    command: "npm run serve",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

import { defineConfig } from "@playwright/test";
import {
  LEGACY_BASE_PATH,
  LEGACY_STORAGE_PREFIX,
  PORTED_BASE_PATH,
  PORTED_STORAGE_PREFIX,
} from "./e2e/ui/support/environment";
import type { TestOptions } from "./e2e/ui/fixtures/test";

/**
 * Two projects, one suite.
 *
 * `legacy` runs everything against the served `index.html`. `ported` runs only
 * the specs tagged `@ported` against the React build, served the way the deploy
 * workflow serves it — under `/next/`, with prefixed storage keys.
 *
 * The split is by tag rather than by directory so a spec can graduate from one
 * to both by adding a tag, which is how slices 2a.3b–2a.3d will grow coverage
 * of the port without duplicating files.
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
      name: "legacy",
      grepInvert: /@ported/,
      use: {
        baseURL: "http://localhost:4173",
        basePath: LEGACY_BASE_PATH,
        storagePrefix: LEGACY_STORAGE_PREFIX,
      },
    },
    {
      name: "ported",
      grep: /@ported/,
      use: {
        baseURL: "http://localhost:4174",
        basePath: PORTED_BASE_PATH,
        storagePrefix: PORTED_STORAGE_PREFIX,
      },
    },
  ],

  webServer: [
    {
      command: "npm run serve",
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run serve:next",
      port: 4174,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});

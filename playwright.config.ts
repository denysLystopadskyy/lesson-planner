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
 * Two tags, one meaning each:
 *
 * - `@ported` — also run this spec against the React build at `/next/`.
 * - `@portedonly` — and do **not** run it against the legacy page.
 *
 * So a spec that should cover both apps carries `@ported` alone, and one that
 * only makes sense against the port carries both. An earlier version used
 * `grepInvert: /@ported/` on the legacy project, which meant tagging a spec for
 * the port silently removed it from the legacy run — the opposite of the
 * intent.
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
      grepInvert: /@portedonly/,
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

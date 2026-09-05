import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e/features",
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["junit", { outputFile: "test-results/junit.xml" }], ["html"]]
    : [["list"], ["html"]],
  use: {
    baseURL: "http://localhost:4173",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run serve",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

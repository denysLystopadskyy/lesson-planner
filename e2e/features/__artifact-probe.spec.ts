import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";

const probeTest = configureTest({ plannerState: plannerState({ groups: [] }) });

probeTest.describe("Artifact probe — temporary", () => {
  probeTest("deliberate failure to prove trace upload", async ({ page }) => {
    await expect(page.locator("#does-not-exist")).toBeVisible({
      timeout: 1000,
    });
  });
});

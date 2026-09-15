import { test, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";

/**
 * The notice the old site shows after the app moves — plan batch 4.3.
 *
 * Two states, and the absent one matters more. `VITE_MOVED_TO` is read at
 * build time, so "has this moved?" is decided by whichever build produced the
 * bundle: the GitHub Pages build sets it, the Vercel build does not. The
 * failure to fear is the new site telling the teacher to leave the new site.
 *
 * Testing both needs two bundles, because a build-time value cannot be changed
 * from a running page. `npm run serve` builds the second one into
 * `app/dist/moved/` with the variable set, so `basePath: "/moved/"` opens it.
 * Neither `npm run build:app` nor the Pages workflow produces that directory,
 * so it never reaches a deployment.
 *
 * ISTQB technique: equivalence partitioning over the one input that decides
 * everything here — the variable set, and the variable not set.
 */
const onePlanner = plannerState({
  groups: [buildGroup({ name: "Monday Beginners", price: 250 })],
});

test.describe("The new site says nothing about moving", () => {
  test.use({ plannerState: onePlanner });

  test("shows no banner", async ({ page }) => {
    await expect(page.getByTestId("movedBanner")).toHaveCount(0);
  });

  /**
   * The group is asserted as well as the banner's absence. A page that failed
   * to render at all would also have no banner, and would pass the check above
   * while proving nothing.
   */
  test("still renders the planner", async ({ page }) => {
    await expect(page.getByText("Monday Beginners")).toBeVisible();
  });
});

test.describe("The old site says where the app went", () => {
  test.use({ plannerState: onePlanner, basePath: "/moved/" });

  test("names the new address and links to it", async ({ page }) => {
    const banner = page.getByTestId("movedBanner");

    await expect(banner).toBeVisible();
    await expect(banner).toContainText("This app has moved");
    await expect(page.getByTestId("movedBannerLink")).toHaveAttribute(
      "href",
      "https://moved.example.test/planner",
    );
  });

  /**
   * The banner asks her to export, so the export has to be in the banner. A
   * notice that says "export your data" and then leaves her to find the button
   * is the version of this that fails quietly.
   */
  test("offers the export without leaving the banner", async ({ page }) => {
    await expect(
      page.getByTestId("movedBanner").getByRole("button", {
        name: /export a backup/i,
      }),
    ).toBeVisible();
  });

  /**
   * Her data is still here. The whole point of the transition window is that
   * the old site keeps working, so the banner must sit above a working planner
   * rather than replace it.
   */
  test("keeps the planner working underneath", async ({ page }) => {
    await expect(page.getByText("Monday Beginners")).toBeVisible();
  });
});

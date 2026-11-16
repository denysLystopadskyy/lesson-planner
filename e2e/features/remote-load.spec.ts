import { configureTest, expect } from "../ui/fixtures/test";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";

/**
 * Remote mode loads before the first paint — plan batch 6.2, test condition C4
 * (RP-09 acceptance criterion 18).
 *
 * Signed in, the planner comes from her account, not from this browser. The
 * session is stubbed with a token the local server minted, and the account is
 * seeded through the API (testing.md §2.9), so the app talks to the real API
 * code on PGlite.
 */

const serverPlanner = () =>
  plannerState({
    groups: [
      buildGroup({ name: "Monday Beginners" }),
      buildGroup({ name: "Thursday Advanced" }),
    ],
  });

/** A browser profile with nothing in it: a new laptop, or a wiped one. */
const EMPTY_PROFILE = { cookies: [], origins: [] };

const wipedProfile = configureTest({
  signedIn: true,
  serverState: serverPlanner(),
  storageOverride: EMPTY_PROFILE,
});

wipedProfile.describe(
  "C4 A wiped profile restores by signing in — scenario-based",
  () => {
    wipedProfile("Her groups come from her account", async ({ page }) => {
      // Given her planner is saved in her account, and this browser holds
      // nothing. When she opens the app signed in,
      // Then her groups appear,
      await expect(page.getByTestId("group-card-name")).toHaveText([
        "Monday Beginners",
        "Thursday Advanced",
      ]);
      // and the toolbar says they are saved, in place of the backup reminder,
      // which is about this browser's copy and has no meaning here.
      await expect(page.locator("#syncIndicator")).toHaveText(
        /^Saved \d\d:\d\d$/,
      );
      await expect(page.locator("#backupIndicator")).toHaveCount(0);
    });
  },
);

const slowServer = configureTest({
  signedIn: true,
  serverState: serverPlanner(),
  storageOverride: EMPTY_PROFILE,
});

slowServer.describe(
  "Before the server answers — state transition testing",
  () => {
    slowServer(
      "Nothing of the planner is shown until the documents arrive",
      async ({ page }) => {
        // Given the server is slow to answer,
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route("**/api/documents", async (route) => {
          await held;
          await route.continue();
        });

        // When she opens the app,
        await page.reload();

        // Then she sees that it is loading, and no planner to edit yet:
        await expect(page.getByText("Loading your planner…")).toBeVisible();
        await expect(page.locator("#addGroupBtn")).toHaveCount(0);

        // When the server answers, Then the planner appears with her groups.
        release();
        await expect(page.getByTestId("group-card-name")).toHaveText([
          "Monday Beginners",
          "Thursday Advanced",
        ]);
        await expect(page.getByText("Loading your planner…")).toHaveCount(0);
      },
    );

    slowServer(
      "A failed load says so, and Try again loads the planner",
      async ({ page }) => {
        // Given the first request for her documents fails,
        let failures = 1;
        await page.route("**/api/documents", async (route) => {
          if (failures > 0) {
            failures -= 1;
            await route.fulfill({ status: 503, body: "Service Unavailable" });
            return;
          }
          await route.continue();
        });

        // When she opens the app,
        await page.reload();

        // Then she is told, and is not shown an empty planner she could
        // mistake for her own:
        await expect(page.getByRole("alert")).toContainText(
          "Your planner could not be loaded",
        );
        await expect(page.locator("#addGroupBtn")).toHaveCount(0);

        // When she tries again, Then her groups appear.
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByTestId("group-card-name")).toHaveText([
          "Monday Beginners",
          "Thursday Advanced",
        ]);
      },
    );
  },
);

const bothSides = configureTest({
  signedIn: true,
  serverState: plannerState({
    groups: [buildGroup({ name: "From The Account" })],
  }),
  plannerState: plannerState({
    groups: [buildGroup({ name: "Only In This Browser" })],
  }),
});

bothSides.describe(
  "Signed in, the account is the planner — scenario-based",
  () => {
    bothSides(
      "The account's data is shown, not this browser's (6.2 takes the server as it is)",
      async ({ page }) => {
        // Given her account and this browser hold different planners,
        // When she opens the app signed in,
        // Then the account's planner is shown. The choice between the two
        // arrives in batch 6.3.
        await expect(page.getByTestId("group-card-name")).toHaveText([
          "From The Account",
        ]);
      },
    );
  },
);

import { configureTest } from "../ui/fixtures/test";
import { expect } from "@playwright/test";
import { expectAriaSnapshot } from "../ui/support/aria-snapshot";
import { E2E_EMAIL } from "../ui/support/sign-in";
import { plannerState } from "../ui/support/planner-state";
import { buildGroup } from "../ui/support/test-data";

/**
 * Signing in, the account view, and signing out.
 *
 * **No spec here performs a real Google sign-in.** Google allows no wildcard
 * redirect URIs, so its flow works on production and on `localhost` only and a
 * changing preview URL can never be registered. A person checks it on
 * production and records the date on the batch page; the rule is in
 * `.claude/context/testing.md`. What these specs cover is everything the app
 * does either side of that redirect.
 *
 * The session arrives as a cookie put on the browser context before the first
 * paint, not by driving the button — otherwise every signed-in spec would
 * depend on the sign-in button working, which is one spec's job rather than all
 * of theirs.
 */

const oneGroup = () =>
  plannerState({ groups: [buildGroup({ name: "Monday Beginners" })] });

const signedOut = configureTest({ plannerState: oneGroup() });

signedOut.describe("Signed out — the planner is what it always was", () => {
  signedOut(
    "The header offers Google, and does not start sign-in by itself",
    async ({ page }) => {
      // Given a signed-out visitor, When the planner loads,
      // Then the button is there and nothing has navigated anywhere.
      await expect(page.getByTestId("sign-in")).toBeVisible();
      await expect(page.getByTestId("account-link")).toHaveCount(0);

      // The rule this pins: a visible button starts sign-in, and nothing starts
      // it on load. If the app ever redirected to Google by itself, the page
      // would not still be on the planner's own origin.
      expect(new URL(page.url()).host).toBe("localhost:4173");
      await expect(
        page.getByRole("heading", { name: "Group Lesson Planner" }),
      ).toBeVisible();
    },
  );

  signedOut(
    "The account view is not reachable signed out",
    async ({ page }) => {
      // Given a signed-out visitor, When they follow a link to #/account,
      // Then the planner is shown instead of an account view.
      await page.goto("/#/account");

      await expect(page.getByTestId("account-email")).toHaveCount(0);
      await expect(page.getByText("Monday Beginners")).toBeVisible();
    },
  );
});

const signedIn = configureTest({ plannerState: oneGroup(), signedIn: true });

signedIn.describe("Signed in — state transition testing", () => {
  signedIn(
    "The header shows the account instead of the button",
    async ({ page }) => {
      // Given a signed-in teacher, When the planner loads,
      // Then the banner names the account she is signed in as.
      await expect(page.getByTestId("account-link")).toHaveText(E2E_EMAIL);
      await expect(page.getByTestId("sign-in")).toHaveCount(0);
    },
  );

  signedIn("The account button opens the account view", async ({ page }) => {
    // Given a signed-in teacher, When she uses the account button,
    // Then she reaches the account view and the URL says where she is.
    await page.getByTestId("account-link").click();

    await expect(page.getByTestId("account-email")).toHaveText(E2E_EMAIL);
    expect(new URL(page.url()).hash).toBe("#/account");
  });

  signedIn("#/account works as a deep link", async ({ page }) => {
    // Given a signed-in teacher, When she opens the account URL directly,
    // Then the account view is what she gets.
    await page.goto("/#/account");

    await expect(page.getByTestId("account-email")).toHaveText(E2E_EMAIL);
  });

  signedIn(
    "The account view reads as a section with a heading",
    async ({ page }) => {
      await page.goto("/#/account");

      await expectAriaSnapshot(
        page.getByRole("region", { name: "Account" }),
        `
- region "Account":
  - heading "Account" [level=2]
  - paragraph: Signed in as ${E2E_EMAIL}
  - paragraph: Your lesson data is still stored in this browser. Signing out does not delete it.
  - button "Back to the planner"
  - button "Sign out"
`,
      );
    },
  );

  /**
   * RP-07 §4: an explicit sign-out needs a confirmation. The cost of the
   * accidental version is being locked out of her own planner on a borrowed
   * machine until she can reach her Google account again.
   */
  signedIn(
    "Sign out asks first, and a refusal changes nothing",
    async ({ page }) => {
      await page.goto("/#/account");
      page.once("dialog", (dialog) => {
        void dialog.dismiss();
      });

      await page.getByRole("button", { name: "Sign out" }).click();

      // Still signed in, still on the account view.
      await expect(page.getByTestId("account-email")).toHaveText(E2E_EMAIL);
    },
  );

  signedIn(
    "Sign out, once confirmed, returns the signed-out header",
    async ({ page }) => {
      await page.goto("/#/account");
      page.once("dialog", (dialog) => {
        void dialog.accept();
      });

      await page.getByRole("button", { name: "Sign out" }).click();

      await expect(page.getByTestId("sign-in")).toBeVisible();
      await expect(page.getByTestId("account-link")).toHaveCount(0);
    },
  );

  /**
   * The planner is the planner either way. Signing in adds a header control and
   * a route, and changes nothing about her groups — Phase 6 is what moves data
   * to a server, and this batch deliberately is not that.
   */
  signedIn("Her groups are untouched by being signed in", async ({ page }) => {
    await expect(page.getByText("Monday Beginners")).toBeVisible();
  });
});

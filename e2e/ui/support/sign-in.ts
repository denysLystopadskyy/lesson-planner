import type { Page } from "@playwright/test";

/**
 * A signed-in session for a spec, without an account and without a network.
 *
 * **No spec performs a real sign-in.** Google allows no wildcard redirect URIs,
 * so its flow works on production and on `localhost` only; a person checks it
 * there and records the date on the batch page. That rule is in
 * `.claude/context/testing.md` and it has not changed.
 *
 * What changed is how a spec holds a session. It used to sign in for real
 * against a test-only e-mail-and-password provider on our own Better Auth
 * server. Neon runs that server now (batch 5.5), on a `*.neon.tech` origin that
 * cannot be run offline, and `neon neon-auth user create` makes a user but
 * issues no session. There is nothing left to sign in to.
 *
 * So the session is **stubbed at the network boundary**: the client's request
 * for the current session is intercepted and answered. That works because the
 * Neon SDK is Better Auth's own client pointed at Neon's host — it asks
 * `get-session` over HTTP, and an intercepted answer is indistinguishable from
 * a real one to everything above it.
 *
 * **This is less machinery than it replaces.** The old fixture needed
 * `AUTH_TEST_MODE`, an allowlisted test address, and a password provider that
 * had to be fenced off from production and asserted absent by a unit test. This
 * needs none of them: there is no test-only door in the deployed code at all,
 * because the pretending happens in the browser the spec controls.
 *
 * **What it does not prove**, and this is the honest cost: that Neon will issue
 * a session, or that the app can hold a real one. A stub proves the app behaves
 * correctly *given* a session. The other half is the person signing in on
 * production — which is exactly the split `testing.md` already describes for
 * Google, so the shape is unchanged even though the mechanism is.
 */

/** The address a signed-in spec sees. Fake, on a reserved TLD that cannot resolve. */
export const E2E_EMAIL = "planner-e2e@example.test";

/** What the auth client is told when it asks who is signed in. */
const sessionBody = () => ({
  session: {
    id: "e2e-session",
    token: "e2e-token",
    userId: "e2e-user",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
  user: {
    id: "e2e-user",
    email: E2E_EMAIL,
    name: "Planner E2E",
    emailVerified: true,
    image: null,
  },
});

/**
 * Answer the auth client, for **every** spec.
 *
 * Installed whether or not the spec wants a session, and that is deliberate.
 * The client is pointed at a host that does not exist — `serve.mjs` builds with
 * a `.invalid` URL — so without this the signed-*out* specs would see the
 * client fail to reach it, and the app would correctly render no account
 * control at all (batch 5.3b). They would be testing an outage rather than a
 * signed-out planner.
 *
 * So the suite always answers: `null` for signed out, a session for signed in.
 * Every spec then gets a deterministic auth state with no network at all.
 *
 * Signing out has to actually change the answer, or the spec asserting that the
 * header goes back to offering sign-in would be asserting nothing. The flag
 * below is that state, and removing the line that flips it fails exactly one
 * spec — which is how it was checked.
 */
export const stubSession = async (
  page: Page,
  options: { signedIn: boolean },
): Promise<void> => {
  let signedIn = options.signedIn;

  // Matched on the path rather than the origin, so this keeps working when the
  // client is pointed at Neon's host instead of our own (batch 5.7).
  await page.route(/\/(get-session|session)(\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(signedIn ? sessionBody() : null),
    });
  });

  await page.route(/\/sign-out/, async (route) => {
    signedIn = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
};

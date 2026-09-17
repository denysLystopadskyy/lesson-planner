import type { BrowserContextOptions } from "@playwright/test";

/**
 * A real session, without Google.
 *
 * Google allows no wildcard redirect URIs, so its sign-in works on production
 * and on `localhost` only and can never be driven from a spec — the rule is in
 * `.claude/context/testing.md`, and real Google sign-in is checked by a person
 * on production and recorded on the batch page.
 *
 * So the suite uses the test-only e-mail-and-password provider, which exists
 * only when `AUTH_TEST_MODE=1`. `scripts/serve.mjs` sets that flag and Vercel
 * never does; `api/auth.test.ts` asserts the production configuration carries
 * no such provider.
 *
 * **The allowlist applies here exactly as it applies to Google.** With
 * `ALLOWED_EMAILS` unset the sign-up endpoint answers 403 `not_allowed`,
 * because an empty list admits nobody — so `scripts/serve.mjs` appends the one
 * address below, and that address is the only one this path can use.
 */

/** The only address the local server admits. Kept in step with `serve.mjs`. */
export const E2E_EMAIL = "planner-e2e@example.test";
const E2E_PASSWORD = "a-long-enough-password-for-the-suite";

type Cookie = NonNullable<
  Exclude<BrowserContextOptions["storageState"], string | undefined>
>["cookies"][number];

/**
 * Turn one `set-cookie` header into the shape `storageState` wants.
 *
 * Only what Playwright requires is read. Attributes the browser would apply —
 * `Secure`, `SameSite`, `Max-Age` — are deliberately not carried over: the
 * suite runs on `http://localhost`, where a `Secure` cookie would be dropped,
 * and what those flags are **on the deployment** is checked by a person against
 * the live response in batch 5.4's checklist row 14. Asserting them here would
 * be asserting what this file just wrote.
 */
const toCookie = (header: string, origin: string): Cookie | null => {
  const [pair] = header.split(";");
  const eq = pair?.indexOf("=") ?? -1;
  if (pair === undefined || eq <= 0) return null;

  return {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
    domain: new URL(origin).hostname,
    path: "/",
    expires: -1,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  };
};

/**
 * `Origin` is not optional here.
 *
 * Better Auth checks it against `trustedOrigins` and answers 403
 * `MISSING_OR_NULL_ORIGIN` without one — which is the CSRF protection working,
 * not something to route around. A browser always sends it; Node's `fetch` does
 * not, so the fixture sends the origin it is actually talking to. That the
 * check fires at all is worth knowing: batch 5.4's checklist row 15 observes a
 * cross-origin POST being rejected, and this is the same guard.
 */
const post = async (origin: string, path: string, body: unknown) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });

/**
 * Sign in, creating the account the first time.
 *
 * `scripts/serve.mjs` builds a fresh in-process PGlite database every time it
 * starts, so the account exists for the life of one server and not beyond it.
 * Signing in first and falling back to signing up handles both without the
 * caller needing to know which run this is.
 */
export const signInForTests = async (origin: string): Promise<Cookie[]> => {
  const credentials = { email: E2E_EMAIL, password: E2E_PASSWORD };

  let response = await post(origin, "/api/auth/sign-in/email", credentials);
  const signInStatus = response.status;
  let signInBody = "";
  if (!response.ok) {
    signInBody = await response.clone().text();
    response = await post(origin, "/api/auth/sign-up/email", {
      ...credentials,
      name: "Planner E2E",
    });
  }

  if (!response.ok) {
    // Report **both** attempts. Reporting only the second sent an earlier
    // version of this fixture chasing "user already exists", which is the
    // sign-up refusing correctly and says nothing about why the sign-in before
    // it did not work.
    throw new Error(
      `The test-only sign-in failed.\n` +
        `  sign-in:  ${String(signInStatus)} ${signInBody}\n` +
        `  sign-up:  ${String(response.status)} ${await response.text()}`,
    );
  }

  return response.headers
    .getSetCookie()
    .map((header) => toCookie(header, origin))
    .filter((cookie): cookie is Cookie => cookie !== null);
};

import { createAuthClient } from "better-auth/react";

/**
 * The browser's half of sign-in.
 *
 * **No `baseURL`.** The client defaults to the page's own origin, which is
 * exactly right here: on Vercel the app and the function share one origin, so
 * the browser sends no preflight, the session cookie is first-party, and the
 * app needs no CORS configuration. Writing an origin in would be a second place
 * for the deployment URL to be wrong.
 *
 * Nothing secret reaches this file. The client sends the browser to
 * `/api/auth/*` and reads what comes back; the Google client secret, the
 * session secret and the allowlist live only in the function's environment. A
 * grep of `app/dist` for those names is an acceptance criterion in batches 5.1
 * and 5.2 for exactly this reason.
 */
const client = createAuthClient();

/**
 * Start Google sign-in.
 *
 * Only ever from a click. Starting sign-in on load would send a signed-out
 * visitor to Google's consent screen before she had asked for anything, and the
 * rule — "a visible button starts sign-in; never start sign-in on page load" —
 * is in `.claude/context/security-auth.md`.
 *
 * `callbackURL` is the page she is standing on, so she comes back where she
 * started rather than at the top of the app.
 */
export const signInWithGoogle = async (): Promise<void> => {
  await client.signIn.social({
    provider: "google",
    callbackURL: window.location.href,
  });
};

/** End the session, server-side. The cookie stops working, not just this tab. */
export const signOut = async (): Promise<void> => {
  await client.signOut();
};

/**
 * The current session, as a hook.
 *
 * Wrapped rather than re-exported so the rest of the app depends on this
 * module's shape and not on the library's. It returns only what the UI needs:
 * the e-mail, whether it is still loading, and whether anyone is signed in.
 *
 * Three states, not two, and the third is the one that cost a live mistake.
 * "Nobody is signed in" is a **successful** answer of `null`; "the server could
 * not answer" is an error. Batch 5.3a collapsed them, so a deployment with no
 * auth tables — every `/api/auth/` route answering 500 — showed a working-looking
 * "Sign in with Google" button that did nothing but log a 500 to the console.
 *
 * `isPending` is the other distinction. It is deliberately **not** used to
 * decide whether to draw the control: gating on it leaves the banner with no
 * account control until a round-trip finishes, on every load, for everyone.
 */
export const useSession = (): {
  email: string | null;
  isPending: boolean;
  isSignedIn: boolean;
  isUnavailable: boolean;
} => {
  const { data, isPending, error } = client.useSession();
  const email = data?.user.email ?? null;

  return {
    email,
    isPending,
    isSignedIn: email !== null,
    // The server could not answer at all — not "nobody is signed in", which is
    // a successful `null`. On a deployment whose database has no auth tables
    // yet, every route under `/api/auth/` answers 500, and this is how the app
    // finds that out without a second request of its own.
    isUnavailable: error !== null,
  };
};

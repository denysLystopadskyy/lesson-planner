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
 * `isPending` matters more than it looks. Signed out and "not known yet" look
 * identical if it is ignored, and the header would flicker a "Sign in" button
 * at someone who is already signed in on every page load.
 */
export const useSession = (): {
  email: string | null;
  isPending: boolean;
  isSignedIn: boolean;
} => {
  const { data, isPending } = client.useSession();
  const email = data?.user.email ?? null;

  return { email, isPending, isSignedIn: email !== null };
};

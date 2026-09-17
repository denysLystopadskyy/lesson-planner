import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

/**
 * The browser's half of sign-in.
 *
 * Neon runs the auth server (batch 5.5), so this points at Neon rather than at
 * our own origin. `VITE_NEON_AUTH_URL` is public by nature — the browser has to
 * send the user there — which is why a `VITE_` name is right here and would be
 * wrong for anything else in this project.
 *
 * **The adapter comes from `@neondatabase/auth/react/adapters`, not from
 * `@neondatabase/auth/react`.** The latter is a whole component library —
 * forms, cards, provider icons, a theme — and this app has its own header
 * button and account view. The adapters entry carries the React hooks and no UI
 * at all; it does not reference the UI package once.
 *
 * Nothing secret is here and nothing can be. The client sends the browser to
 * Neon and reads what comes back; the allowlist is enforced server-side by the
 * webhook in `api/[...all].ts`, which is the only place it could be enforced
 * safely.
 */

const baseUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim();

/**
 * Null when there is nowhere to sign in to.
 *
 * Unset in development and in the suite, and on any deployment that has not
 * been given the URL. The app then renders no account control at all rather
 * than a button that cannot work — the rule batch 5.3b added after shipping
 * exactly that button.
 */
const client = baseUrl
  ? createAuthClient(baseUrl, { adapter: BetterAuthReactAdapter() })
  : null;

/**
 * Start Google sign-in.
 *
 * Only ever from a click. Starting sign-in on load would send a signed-out
 * visitor to Google before she had asked for anything; the rule is in
 * `.claude/context/security-auth.md`.
 *
 * `callbackURL` is the page she is standing on, so she comes back where she
 * started rather than at the top of the app.
 */
export const signInWithGoogle = async (): Promise<void> => {
  await client?.signIn.social({
    provider: "google",
    callbackURL: window.location.href,
  });
};

/** End the session. Neon invalidates it, so the token stops working everywhere. */
export const signOut = async (): Promise<void> => {
  await client?.signOut();
};

/**
 * The current session, as a hook.
 *
 * Wrapped rather than re-exported so the rest of the app depends on this
 * module's shape and not on the library's — which matters more now than it did,
 * because the library underneath changed once already.
 *
 * Three states, not two, and the third is the one that cost a live mistake.
 * "Nobody is signed in" is a **successful** answer of `null`; "the server could
 * not answer" is an error. Collapsing them shipped a working-looking sign-in
 * button on a deployment where every auth request failed (batch 5.3b).
 */
export const useSession = (): {
  email: string | null;
  isPending: boolean;
  isSignedIn: boolean;
  isUnavailable: boolean;
} => {
  // Hooks cannot be called conditionally, so the no-client case is handled by
  // the constant below rather than by skipping the call. `client` is fixed at
  // module load, so this branch never changes across renders.
  const session = client?.useSession();

  if (!session) {
    return {
      email: null,
      isPending: false,
      isSignedIn: false,
      isUnavailable: true,
    };
  }

  const email = session.data?.user.email ?? null;

  return {
    email,
    isPending: session.isPending,
    isSignedIn: email !== null,
    isUnavailable: session.error !== null,
  };
};

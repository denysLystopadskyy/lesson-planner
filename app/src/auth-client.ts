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

/**
 * The JWT the documents API checks, or `null` when nobody is signed in.
 *
 * **Read from `getSession()` → `data.session.token`.** The installed
 * `@neondatabase/auth` 0.5.0-beta also has `token()` (Better Auth's JWT
 * plugin, `GET /token`), but its own fetch hook files every URL that contains
 * `/token` under `getSession` and answers from the cached session instead, so
 * `token()` can return a session where a `{token}` was expected. The library's
 * own `getJWTToken` reads `getSession().data.session.token`, and so does this
 * (batch 6.2; recorded on the batch page).
 *
 * The client caches the session until shortly before the JWT expires. A token
 * can still be refused earlier — sign-out elsewhere, a clock out of step — so
 * `fresh` skips the cache with the header the library's own adapters use for
 * that (`X-Force-Fetch`). `withToken` in `documents-api.ts` asks for a fresh
 * token once, after a 401.
 *
 * It throws when the auth server could not answer, and returns `null` only
 * when it answered that nobody is signed in.
 */
export const getAccessToken = async (
  options: { fresh?: boolean } = {},
): Promise<string | null> => {
  if (client === null) return null;
  const result = await client.getSession(
    options.fresh === true
      ? { fetchOptions: { headers: { "X-Force-Fetch": "true" } } }
      : undefined,
  );
  // "Nobody is signed in" is a successful answer of no session. An auth
  // server that could not answer is not that: throwing keeps a network
  // problem from being reported as "sign in again".
  if (result.error !== null && result.error.status !== 401) {
    throw new Error(
      result.error.message ??
        `the auth server answered ${String(result.error.status)}`,
    );
  }
  return result.data?.session.token ?? null;
};

/**
 * End the session. Neon ends it, but a JWT already issued is not revoked: it
 * keeps working until it expires, up to 15 minutes (batch 6.2's finding).
 */
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

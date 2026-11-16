// Test tokens for remote mode (plan batch 6.1, testing.md §2.9).
//
// `scripts/serve.mjs` mounts these routes. **No deployed file imports this
// one**, so it is not a door in production: the Vercel function is
// `api/[...all].ts` alone, and `api/documents.test.ts` proves that
// application answers neither route below. The lesson behind the rule is
// DEF-028's — a test-only path in deployed code is a path anyone can take.
//
// A throwaway Ed25519 key, made when the routes are created and gone when the
// process stops. Its public half is served where the API looks for Neon's
// keys, so the API checks a minted token with exactly the code that checks a
// real one: the same `jose` call, EdDSA only, issuer and audience the origin
// of `NEON_AUTH_BASE_URL`. The Playwright `webServer` points that variable
// here and sets `ALLOWED_EMAILS` to the one test address.
//
// **The mint never pairs with a real database** (batch 6.1 review). With
// `DATABASE_URL` set, the API reads and writes that database — Neon, on a
// machine that has linked it — and a token minted here would be a way to
// write rows there under any `sub`. So the mint answers 403, and the server
// says why when it starts. The suite never sets `DATABASE_URL`: it runs on
// PGlite.

import { generateKeyPairSync, randomUUID } from "node:crypto";

import { Hono } from "hono";
import { SignJWT } from "jose";

const REAL_DATABASE =
  "DATABASE_URL is set, so the API uses a real database. The test-token " +
  "mint is off and answers 403. Unset DATABASE_URL to use PGlite.";

/**
 * The JWKS and mint routes, read against `env` at request time.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Hono}
 */
export const createTestTokenRoutes = (env = process.env) => {
  if (env.DATABASE_URL) console.warn(REAL_DATABASE);

  const key = generateKeyPairSync("ed25519");
  const kid = `local-${randomUUID()}`;
  const jwks = {
    keys: [
      {
        ...key.publicKey.export({ format: "jwk" }),
        kid,
        alg: "EdDSA",
        use: "sig",
      },
    ],
  };

  const routes = new Hono();

  routes.get("/__neon-auth/.well-known/jwks.json", (c) => c.json(jwks));

  // `POST {sub, email}` → `{token}`, valid for 15 minutes like Neon's own. A
  // spec mints through `e2e/ui/support/session-token.ts`, with a unique `sub`
  // per call so parallel workers never share rows.
  routes.post("/__neon-auth/__test/mint", async (c) => {
    if (env.DATABASE_URL) return c.json({ error: REAL_DATABASE }, 403);

    const baseUrl = env.NEON_AUTH_BASE_URL;
    if (!baseUrl) {
      return c.json(
        { error: "NEON_AUTH_BASE_URL is unset, so the API checks no token." },
        500,
      );
    }
    const input = /** @type {unknown} */ (await c.req.json().catch(() => null));
    const { sub, email } =
      typeof input === "object" && input !== null
        ? /** @type {{ sub?: unknown, email?: unknown }} */ (input)
        : {};
    if (typeof sub !== "string" || typeof email !== "string") {
      return c.json({ error: "Send {sub, email}, both strings." }, 400);
    }
    const origin = new URL(baseUrl).origin;
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: "EdDSA", kid })
      .setSubject(sub)
      .setIssuer(origin)
      .setAudience(origin)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key.privateKey);
    return c.json({ token });
  });

  return routes;
};

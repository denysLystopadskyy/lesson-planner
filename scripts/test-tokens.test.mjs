import { createLocalJWKSet, jwtVerify } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestTokenRoutes } from "./test-tokens.mjs";

/**
 * The local server's test-token routes (plan batch 6.1): a throwaway key, its
 * JWKS, and the mint. `scripts/serve.mjs` mounts them; nothing deployed does.
 *
 * The rule under test besides the happy path: **the mint never pairs with a
 * real database.** With `DATABASE_URL` set, the API talks to Neon, and a
 * token minted here would be a way to write rows there under any `sub`. So
 * the mint answers 403 and the server says why when it starts.
 */

const BASE_URL = "http://localhost:4173/__neon-auth";
const ORIGIN = "http://localhost:4173";

/** @param {import("hono").Hono} routes @param {unknown} body */
const mint = (routes, body) =>
  routes.request("/__neon-auth/__test/mint", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the test-token routes — equivalence partitioning", () => {
  it("mints a token that the served key set verifies", async () => {
    const routes = createTestTokenRoutes({ NEON_AUTH_BASE_URL: BASE_URL });

    const jwks = /** @type {import("jose").JSONWebKeySet} */ (
      await (await routes.request("/__neon-auth/.well-known/jwks.json")).json()
    );
    const response = await mint(routes, {
      sub: "e2e-1",
      email: "planner-e2e@example.test",
    });

    expect(response.status).toBe(200);
    const { token } = /** @type {{ token: string }} */ (await response.json());
    const { payload, protectedHeader } = await jwtVerify(
      token,
      createLocalJWKSet(jwks),
      { algorithms: ["EdDSA"], issuer: ORIGIN, audience: ORIGIN },
    );
    expect(protectedHeader.alg).toBe("EdDSA");
    expect(payload).toMatchObject({
      sub: "e2e-1",
      email: "planner-e2e@example.test",
    });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(15 * 60);
  });

  it("refuses to mint, 403, when DATABASE_URL is set, and logs why", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const routes = createTestTokenRoutes({
      NEON_AUTH_BASE_URL: BASE_URL,
      DATABASE_URL: "postgres://someone@db.example.test/neondb",
    });

    const response = await mint(routes, {
      sub: "e2e-1",
      email: "planner-e2e@example.test",
    });

    expect(response.status).toBe(403);
    const answer = /** @type {{ token?: unknown, error?: unknown }} */ (
      await response.json()
    );
    expect(answer.token).toBeUndefined();
    expect(String(answer.error)).toContain("DATABASE_URL");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
  });

  it("refuses to mint, 500, when NEON_AUTH_BASE_URL is unset", async () => {
    const routes = createTestTokenRoutes({});

    expect(
      (await mint(routes, { sub: "s", email: "e@example.test" })).status,
    ).toBe(500);
  });

  it("refuses a request without both sub and email, 400", async () => {
    const routes = createTestTokenRoutes({ NEON_AUTH_BASE_URL: BASE_URL });

    expect((await mint(routes, { sub: "s" })).status).toBe(400);
    expect((await mint(routes, "not an object")).status).toBe(400);
  });
});

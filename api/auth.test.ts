import { createPgliteDb } from "@lesson-planner/db/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  app,
  buildAuth,
  isAllowed,
  isTestMode,
  parseAllowlist,
  resetAuth,
  setDb,
} from "./[...all].ts";

/**
 * Sign-in: the allowlist, the test-only door, and the schema behind them.
 *
 * No test here performs a real Google sign-in. Google allows no wildcard
 * redirect URIs, so the real flow is exercised by a person on production and
 * recorded on the batch page — the rule is in `.claude/context/testing.md`.
 * What is testable here is everything that decides the answer.
 */
describe("sign-in", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setDb(null);
    resetAuth();
  });

  /**
   * ISTQB technique: equivalence partitioning over the kinds of entry a person
   * can type into `ALLOWED_EMAILS`, plus boundary value analysis on the empty
   * and whitespace-only edges of the list and of each entry.
   *
   * This is the whole security boundary, and it is two pure functions, so it is
   * tested directly rather than through a constructed auth instance.
   */
  describe("the allowlist — equivalence partitioning and boundary values", () => {
    it("accepts an address that is listed", () => {
      expect(
        isAllowed("her@example.test", parseAllowlist("her@example.test")),
      ).toBe(true);
    });

    it("accepts a listed address whatever the case", () => {
      const list = parseAllowlist("Her@Example.TEST");

      expect(isAllowed("HER@EXAMPLE.TEST", list)).toBe(true);
      expect(isAllowed("her@example.test", list)).toBe(true);
    });

    it("accepts a listed address with spaces around it on either side", () => {
      const list = parseAllowlist("  her@example.test ,  him@example.test  ");

      expect(isAllowed("  her@example.test  ", list)).toBe(true);
      expect(isAllowed("him@example.test", list)).toBe(true);
    });

    it("refuses an address that is not listed", () => {
      expect(
        isAllowed("stranger@example.test", parseAllowlist("her@example.test")),
      ).toBe(false);
    });

    /**
     * The boundary that matters most. An unset or mistyped variable must lock
     * everyone out — including the owner, who will say so within a minute —
     * rather than admit anyone with a Google account, which nobody would
     * notice.
     */
    it("refuses everyone when the list is empty, unset or only separators", () => {
      for (const raw of [undefined, "", "   ", ",", " , , "]) {
        const list = parseAllowlist(raw);

        expect(list).toEqual([]);
        expect(isAllowed("her@example.test", list)).toBe(false);
      }
    });

    it("refuses an address that is missing altogether", () => {
      const list = parseAllowlist("her@example.test");

      expect(isAllowed(undefined, list)).toBe(false);
      expect(isAllowed(null, list)).toBe(false);
      expect(isAllowed("", list)).toBe(false);
    });

    it("does not treat a listed address as a prefix or a substring", () => {
      const list = parseAllowlist("her@example.test");

      expect(isAllowed("her@example.test.evil.test", list)).toBe(false);
      expect(isAllowed("other-her@example.test", list)).toBe(false);
    });
  });

  /**
   * The test-only door, checked from the outside.
   *
   * `AUTH_TEST_MODE` must be exactly "1". A variable that exists but is empty,
   * or says "false", or says "0", must not open a password door on a
   * deployment — and "truthy" would open it for two of those three.
   */
  describe("the test-only sign-in path is fenced", () => {
    it("is off unless AUTH_TEST_MODE is exactly 1", () => {
      for (const value of ["", "0", "false", "true", "yes", " 1"]) {
        vi.stubEnv("AUTH_TEST_MODE", value);
        expect(isTestMode()).toBe(false);
      }

      vi.stubEnv("AUTH_TEST_MODE", "1");
      expect(isTestMode()).toBe(true);
    });

    it("is off when the variable is absent, which is what a deployment has", () => {
      vi.stubEnv("AUTH_TEST_MODE", undefined);

      expect(isTestMode()).toBe(false);
    });

    /**
     * The guard batch 5.2 asks for by name: the production configuration has no
     * e-mail-and-password provider. Asserted on the built object rather than on
     * the flag, because the flag is what we meant and the object is what runs.
     */
    it("leaves no password provider in the production configuration", async () => {
      const db = await createPgliteDb();

      const production = buildAuth(db, false);
      const test = buildAuth(db, true);

      expect(production.options.emailAndPassword?.enabled ?? false).toBe(false);
      expect(test.options.emailAndPassword?.enabled).toBe(true);
    });
  });

  /**
   * The schema in `db/schema.ts` is Better Auth's, transcribed by hand, so it
   * is verified against the real adapter rather than trusted. A wrong column
   * name fails here instead of failing a sign-in on production.
   */
  describe("the schema the adapter actually queries", () => {
    it("creates and reads back a user through the real adapter", async () => {
      const db = await createPgliteDb();
      const auth = buildAuth(db, true);
      const adapter = await auth.$context.then((context) => context.adapter);

      const created = await adapter.create<{
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>({
        model: "user",
        data: {
          name: "Test Person",
          email: "her@example.test",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(created.email).toBe("her@example.test");
      // The id is the library's to mint, not ours — passing one in is ignored.
      // What matters is that the row went in and comes back by the column the
      // adapter actually looks users up by.
      expect(created.id).toBeTruthy();

      const found = await adapter.findOne<{ id: string; name: string }>({
        model: "user",
        where: [{ field: "email", value: "her@example.test" }],
      });

      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("Test Person");
    });
  });

  describe("the auth routes are mounted and actually work", () => {
    /**
     * **This assertion used to be `expect(status).not.toBe(404)`, and that was
     * too weak to be worth writing.** A 500 satisfies "not 404", and a 500 is
     * exactly what the route returned: `rateLimit.storage: "database"` needs a
     * `rateLimit` table that the schema did not have, so Better Auth refused to
     * start on every request. The test passed, the deployment passed, and every
     * `/api/auth/*` request failed.
     *
     * So it asserts success now, and reads the body. "It responded" is not the
     * same claim as "it worked" — the same lesson the deployment taught in 27.
     */
    it("answers a real auth route with a real body", async () => {
      setDb(await createPgliteDb());

      const response = await app.request("/api/auth/get-session");

      expect(response.status).toBe(200);
      // Signed out, the library reports no session rather than failing.
      expect(await response.json()).toBeNull();
    });

    /**
     * Multi-segment paths matter more than they look. `/api/auth/get-session`
     * is two segments below `/api`, and every Better Auth route is — the Google
     * callback is `/api/auth/callback/google`. Hono routes them here; whether
     * **Vercel** does is a different question that this test cannot answer, and
     * it turned out to be no until `vercel.json` gained a rewrite. See batch
     * 5.2b and lesson 33.
     */
    it("routes a path several segments below /api", async () => {
      setDb(await createPgliteDb());

      expect((await app.request("/api/auth/get-session")).status).toBe(200);
      expect((await app.request("/api/nope")).status).toBe(404);
    });
  });
});

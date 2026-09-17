import { createPgliteDb } from "@lesson-planner/db/testing";
import { describe, expect, it, afterEach, vi } from "vitest";

import { app, authHealth, setDb } from "./[...all].ts";

/**
 * The health route, exercised through the application object itself rather than
 * over a socket. `app.request()` is the same `fetch` the Vercel function and
 * `scripts/serve.mjs` both call, so what passes here is what those serve.
 *
 * The end-to-end counterpart (`e2e/features/api-health.spec.ts`) proves the
 * local server actually mounts this. Neither test replaces the other: this one
 * would pass with the server misconfigured, and that one would pass with the
 * body wrong.
 */
describe("GET /api/health", () => {
  // `vi.stubEnv` rather than assigning `process.env` directly: a test that set
  // a variable and forgot to clear it would make the next one pass for the
  // wrong reason, and the "off a deployment" case below is exactly the one that
  // would go quietly wrong.
  afterEach(() => {
    vi.unstubAllEnvs();
    // The database is module-scope state, so a test that injected one would
    // otherwise decide what the next test sees. Clearing it makes
    // "unconfigured" the default, which is the honest starting point: no
    // connection string, nothing injected.
    setDb(null);
  });

  it("answers 200 with JSON", async () => {
    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("reports the deployment when Vercel names it", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef");
    vi.stubEnv("VERCEL_REGION", "fra1");

    const response = await app.request("/api/health");

    expect(await response.json()).toEqual({
      ok: true,
      commit: "0123456789abcdef",
      region: "fra1",
      db: "unconfigured",
      dbQueryMs: null,
      auth: "unconfigured",
    });
  });

  /**
   * Off a deployment there is no commit and no region. `null` says that; a
   * placeholder string would let "running locally" and "deployed, and the
   * region is wrong" produce the same body — and the region is the one thing
   * batch 4.1 asks this route to prove.
   */
  it("reports null for both off a deployment", async () => {
    const response = await app.request("/api/health");

    expect(await response.json()).toEqual({
      ok: true,
      commit: null,
      region: null,
      db: "unconfigured",
      dbQueryMs: null,
      auth: "unconfigured",
    });
  });

  /**
   * The database half of the route, by equivalence partitioning over the three
   * answers it can give: a database that answers, no database configured, and
   * a database that fails.
   *
   * `unconfigured` is deliberately not an error. It is the true state on a
   * developer's machine with no `.env.local`, in CI, and on a deployment that
   * has not been given a connection string — the same distinction `commit:
   * null` draws between "not deployed" and "deployed and wrong".
   */
  /**
   * Whether sign-in can work here, which is **not** a question about this
   * database any more.
   *
   * It used to check whether the auth tables existed, because this project ran
   * the auth server. Neon runs it now and owns those tables in its own schema,
   * so the honest question became the one this deployment controls: can the
   * allowlist webhook verify that a request came from Neon? Without
   * `NEON_AUTH_BASE_URL` it cannot, and refuses every sign-up.
   *
   * ISTQB technique: equivalence partitioning over the two states a deployment
   * can be in, since there is no longer a third.
   */
  describe("the auth field", () => {
    it("reports unconfigured when there is no Neon Auth URL", () => {
      vi.stubEnv("NEON_AUTH_BASE_URL", "");

      expect(authHealth()).toBe("unconfigured");
    });

    it("reports ready once the URL is set", () => {
      vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/db/auth");

      expect(authHealth()).toBe("ready");
    });

    /**
     * Deliberately independent of the database. A healthy database says nothing
     * about whether anyone can sign in, and the previous version of this route
     * conflated them — reporting `db: "ok"` while every auth request failed.
     */
    it("does not depend on the database being reachable", async () => {
      vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/db/auth");
      setDb(await createPgliteDb());

      expect(authHealth()).toBe("ready");

      setDb(null);
      expect(authHealth()).toBe("ready");
    });
  });

  describe("the database field", () => {
    it("reports ok and a query time when a database answers", async () => {
      setDb(await createPgliteDb());

      const body = (await (await app.request("/api/health")).json()) as {
        db: string;
        dbQueryMs: number;
      };

      expect(body.db).toBe("ok");
      // A number, not a specific one: the duration is real and varies. What
      // matters is that the route measured something rather than reporting a
      // placeholder.
      expect(typeof body.dbQueryMs).toBe("number");
      expect(body.dbQueryMs).toBeGreaterThanOrEqual(0);
    });

    /**
     * A database that refuses is reported, not thrown. A health check that
     * crashes tells a caller less than one that answers "error" — and this
     * route is what a person reads when they are already suspicious.
     */
    it("reports error when the query fails, and still answers 200", async () => {
      setDb({
        execute: () => Promise.reject(new Error("connection refused")),
      });

      const response = await app.request("/api/health");
      const body = (await response.json()) as { db: string; ok: boolean };

      expect(response.status).toBe(200);
      expect(body.db).toBe("error");
    });
  });

  it("does not answer an unknown route", async () => {
    expect((await app.request("/api/nope")).status).toBe(404);
  });
});

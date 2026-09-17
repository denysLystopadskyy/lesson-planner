import { createBarePgliteDb, createPgliteDb } from "@lesson-planner/db/testing";
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
      auth: "no-database",
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
      auth: "no-database",
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
   * Whether sign-in can work here, which is **not** the same question as
   * whether the database answers.
   *
   * This distinction shipped as a live defect. Production reported `db: "ok"`
   * — `SELECT 1` succeeds against an empty database — while every route under
   * `/api/auth/` answered 500 for want of the tables, and the app offered a
   * "Sign in with Google" button on top of it.
   *
   * ISTQB technique: equivalence partitioning over the three states a
   * deployment can be in — no database, a database with no schema, and one
   * ready to sign somebody in.
   */
  describe("the auth field", () => {
    it("reports no-database when nothing is configured", async () => {
      expect(await authHealth()).toBe("no-database");
    });

    it("reports no-schema when the database answers but has no tables", async () => {
      // The exact state production was in: SELECT 1 fine, no `user` table.
      setDb(createBarePgliteDb());

      const body = (await (await app.request("/api/health")).json()) as {
        db: string;
        auth: string;
      };

      expect(body.db).toBe("ok");
      expect(body.auth).toBe("no-schema");
    });

    it("reports ready once the migrations are applied", async () => {
      setDb(await createPgliteDb());

      expect(await authHealth()).toBe("ready");
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

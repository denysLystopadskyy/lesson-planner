import { test, expect } from "../ui/fixtures/test";

/**
 * The API is served from the same origin as the app.
 *
 * `api/health.test.ts` already proves what the route answers. What it cannot
 * prove is that anything is listening: it calls the Hono application object
 * directly, so it would stay green with the server unmounted, the path wrong,
 * or `scripts/serve.mjs` never started. This spec is the other half — it goes
 * over HTTP to the port Playwright started, so a route that exists only in the
 * unit test fails here.
 *
 * Same origin matters and is not incidental. On Vercel the app and the function
 * share one origin, so the browser sends no preflight and the app needs no CORS
 * configuration. Serving both from one process locally means the suite
 * exercises that arrangement rather than a local-only split that would hide a
 * path or CORS mistake until after a deploy.
 *
 * ISTQB technique: equivalence partitioning over the two answers the router can
 * give — a route it knows, and one it does not.
 */
test.describe("The API answers on the app's own origin", () => {
  test("GET /api/health returns 200 and reports itself healthy", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(await response.json()).toMatchObject({ ok: true });
  });

  /**
   * Off a deployment there is no commit and no region, and the route says so
   * with `null` rather than inventing a value. The production counterpart —
   * `region: "fra1"` against the real deployment — is in the batch 4.2 results
   * table, because it needs a Vercel project that no pull request can create.
   */
  test("reports no commit and no region when nothing deployed it", async ({
    request,
  }) => {
    expect(await (await request.get("/api/health")).json()).toEqual({
      ok: true,
      commit: null,
      region: null,
    });
  });

  test("an unknown API route is a 404, not the app's HTML", async ({
    request,
  }) => {
    const response = await request.get("/api/nope");

    expect(response.status()).toBe(404);
  });
});

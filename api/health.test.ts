import { describe, expect, it, afterEach, vi } from "vitest";

import app from "./app.ts";

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
    });
  });

  it("does not answer an unknown route", async () => {
    expect((await app.request("/api/nope")).status).toBe(404);
  });
});

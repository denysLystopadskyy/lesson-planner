import { expect, test } from "../ui/fixtures/test";
import { mintToken } from "../ui/support/session-token";
import { readStorageFixture } from "../ui/support/storage-fixtures";

/**
 * C9. The documents API over HTTP — plan batch 6.1.
 *
 * `api/documents.test.ts` proves what the routes decide, against the
 * application object. What it cannot prove is the wiring: that the local
 * server mounts the routes, that the token the server mints is one the API
 * accepts (the JWKS route, the issuer and the audience all line up), and that
 * the Playwright `webServer` really sets `ALLOWED_EMAILS`. This is that half,
 * the same pairing as `api/health.test.ts` and `api-health.spec.ts`.
 *
 * ISTQB technique: scenario-based testing — the main scenario (mint, save,
 * read back) and two refusals.
 */
test.describe("C9 the documents API over HTTP — scenario-based", () => {
  test("mint → PUT → GET returns the same body", async ({ request }) => {
    const token = await mintToken(request);
    const headers = { authorization: `Bearer ${token}` };
    const groups = readStorageFixture("realistic").groupLessonPlannerData;

    const saved = await request.put("/api/documents/data", {
      headers,
      data: { body: groups, schemaVersion: 1, baseUpdatedAt: null },
    });
    expect(saved.status()).toBe(200);
    const { updatedAt } = (await saved.json()) as { updatedAt: string };

    const read = await request.get("/api/documents", { headers });
    expect(read.status()).toBe(200);
    expect(await read.json()).toEqual({
      documents: {
        data: { body: groups, schemaVersion: 1, updatedAt },
        settings: null,
        template: null,
      },
    });
  });

  test("no token → 401", async ({ request }) => {
    expect((await request.get("/api/documents")).status()).toBe(401);
  });

  test("a valid token for an address not on the allowlist → 403", async ({
    request,
  }) => {
    const token = await mintToken(request, { email: "stranger@example.test" });

    const response = await request.get("/api/documents", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(403);
  });
});

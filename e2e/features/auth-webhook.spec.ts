import { configureTest } from "../ui/fixtures/test";
import { expect } from "@playwright/test";

/**
 * The allowlist webhook, over HTTP.
 *
 * `api/webhook.test.ts` proves what it decides, with a real Ed25519 keypair and
 * every way a signature can be wrong. What that test cannot prove is that
 * anything is listening: it calls the application object directly, so it would
 * stay green with the route unmounted or the path wrong. This is the other
 * half — the same pairing `api/health.test.ts` and `api-health.spec.ts` have.
 *
 * It deliberately does **not** sign anything. Reproducing Neon's signing here
 * would be re-testing the unit test through a longer pipe; what is worth
 * asserting over HTTP is that the endpoint exists and that, unsigned, it
 * refuses.
 */
const webhook = configureTest();

webhook.describe(
  "The allowlist webhook is mounted and refuses strangers",
  () => {
    webhook(
      "An unsigned request is rejected, not accepted",
      async ({ request }) => {
        const response = await request.post("/api/hooks/neon-auth", {
          data: {
            event_type: "user.before_create",
            user: { email: "stranger@example.test" },
          },
        });

        // Two refusals are correct here, and which one depends on the
        // environment: 401 when the signature was checked and failed, 500 when
        // there was no `NEON_AUTH_BASE_URL` to check it against — which is the
        // local server's state, and is itself the fail-closed path. Both are
        // "no", and neither is a 404.
        //
        // Named explicitly rather than asserted as "not 404", because "not 404"
        // is the assertion lesson 33 records: a 500 satisfies it, and so would
        // very nearly anything else.
        expect([401, 500]).toContain(response.status());

        // And whatever it answered, it did not allow the sign-up.
        const body = (await response.json().catch(() => ({}))) as {
          allowed?: boolean;
        };
        expect(body.allowed ?? false).toBe(false);
      },
    );

    webhook("A GET is not a way in", async ({ request }) => {
      const response = await request.get("/api/hooks/neon-auth");

      expect(response.status()).toBe(404);
    });
  },
);

import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

import { E2E_EMAIL } from "./sign-in";

/**
 * A real, signed Neon Auth-shaped token for a spec — plan batch 6.1.
 *
 * `scripts/serve.mjs` makes a throwaway Ed25519 key when it starts, serves its
 * public half at `/__neon-auth/.well-known/jwks.json`, and signs tokens at
 * `POST /__neon-auth/__test/mint`. The API checks them exactly as it checks
 * Neon's own: the same `jose` call, the same issuer and audience rule. Only the
 * key is different.
 *
 * **The mint route exists in the local server only.** That file is never
 * deployed, and `api/documents.test.ts` proves the deployed application has no
 * such route (testing.md §2.9, the dead-test-door lesson of DEF-028).
 *
 * Each call gets a **unique `sub` by default**, so parallel workers never share
 * server rows. Pass a `sub` only when a spec needs two tokens for one user.
 * The default e-mail is the one the Playwright `webServer` puts on the
 * allowlist.
 */
export const mintToken = async (
  request: APIRequestContext,
  options: { sub?: string; email?: string } = {},
): Promise<string> => {
  const response = await request.post("/__neon-auth/__test/mint", {
    data: {
      sub: options.sub ?? `e2e-${randomUUID()}`,
      email: options.email ?? E2E_EMAIL,
    },
  });
  if (!response.ok()) {
    throw new Error(
      `The local server did not mint a token (${String(response.status())}). ` +
        "Is a stale `npm run serve` running? Stop it and run the suite again.",
    );
  }
  const { token } = (await response.json()) as { token: string };
  return token;
};

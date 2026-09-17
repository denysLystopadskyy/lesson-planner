import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  app,
  decideSignUp,
  resetJwksCache,
  verifyNeonWebhook,
} from "./[...all].ts";

/**
 * The allowlist webhook: the gate Neon calls before it creates a user.
 *
 * Neon Auth runs the sign-in server (batch 5.5), so this endpoint is where
 * "only these two people" is decided. It is a security control, and the cases
 * that matter are the ones where it must say **no**.
 *
 * The signing here is written from Neon's documented algorithm rather than
 * imported from the code under test, so a mistake in the implementation does
 * not quietly become a mistake in the fixture as well. The tampering and
 * wrong-key cases exist for the same reason: if signing and verifying shared a
 * bug, a body that changed after signing would still have to fail.
 */

const BASE_URL = "https://auth.example.test/neondb/auth";
const KID = "test-key-1";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID };

/** Neon's signing input, spelled out: `header.base64url(timestamp.base64url(body))`. */
const signRequest = (
  rawBody: string,
  timestamp: string,
  key = privateKey,
): string => {
  const headerB64 = Buffer.from(
    JSON.stringify({ alg: "EdDSA", kid: KID }),
    "utf8",
  ).toString("base64url");
  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signed = Buffer.from(`${timestamp}.${payloadB64}`, "utf8").toString(
    "base64url",
  );
  const signature = sign(null, Buffer.from(`${headerB64}.${signed}`), key);

  return `${headerB64}..${signature.toString("base64url")}`;
};

const headersFor = (rawBody: string, at = Date.now()): Headers => {
  const timestamp = String(at);
  return new Headers({
    "x-neon-signature": signRequest(rawBody, timestamp),
    "x-neon-signature-kid": KID,
    "x-neon-timestamp": timestamp,
    "x-neon-event-id": "e1e1e1e1-2a2a-3b3b-4c4c-5d5d5d5d5d5d",
    "x-neon-event-type": "user.before_create",
  });
};

const bodyFor = (email: string): string =>
  JSON.stringify({
    event_id: "e1e1e1e1-2a2a-3b3b-4c4c-5d5d5d5d5d5d",
    event_type: "user.before_create",
    user: { id: "u1", email, name: "Someone" },
    event_data: { auth_provider: "google" },
  });

describe("the allowlist webhook", () => {
  beforeEach(() => {
    resetJwksCache();
    vi.stubEnv("NEON_AUTH_BASE_URL", BASE_URL);
    vi.stubEnv("ALLOWED_EMAILS", "her@example.test, him@example.test");
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetJwksCache();
  });

  /**
   * ISTQB technique: equivalence partitioning over who is asking, reusing the
   * allowlist functions that batch 5.2a already tested by boundary value
   * analysis. This checks the decision the webhook returns, not the parsing.
   */
  describe("the decision", () => {
    it("allows a listed address", () => {
      expect(decideSignUp("her@example.test")).toEqual({ allowed: true });
    });

    it("refuses anyone else, with a message a person can read", () => {
      const decision = decideSignUp("stranger@example.test");

      expect(decision.allowed).toBe(false);
      expect(decision.error_code).toBe("NOT_ALLOWED");
      expect(decision.error_message).toMatch(/not allowed/i);
    });

    it("refuses a missing address", () => {
      expect(decideSignUp(null).allowed).toBe(false);
      expect(decideSignUp(undefined).allowed).toBe(false);
    });
  });

  /**
   * The signature. Every case here except the first must fail — an endpoint
   * that says yes to an unsigned request is not a gate.
   */
  describe("verifying that Neon sent it", () => {
    it("accepts a request Neon signed", async () => {
      const body = bodyFor("her@example.test");

      await expect(
        verifyNeonWebhook(body, headersFor(body), BASE_URL),
      ).resolves.toBe(true);
    });

    it("refuses a body changed after signing", async () => {
      const body = bodyFor("her@example.test");
      const headers = headersFor(body);

      // The signature is still valid — for different bytes.
      await expect(
        verifyNeonWebhook(bodyFor("stranger@example.test"), headers, BASE_URL),
      ).resolves.toBe(false);
    });

    it("refuses a signature from the wrong key", async () => {
      const body = bodyFor("her@example.test");
      const other = generateKeyPairSync("ed25519").privateKey;
      const timestamp = String(Date.now());
      const headers = new Headers({
        "x-neon-signature": signRequest(body, timestamp, other),
        "x-neon-signature-kid": KID,
        "x-neon-timestamp": timestamp,
      });

      await expect(verifyNeonWebhook(body, headers, BASE_URL)).resolves.toBe(
        false,
      );
    });

    it("refuses a kid that is not in the key set", async () => {
      const body = bodyFor("her@example.test");
      const headers = headersFor(body);
      headers.set("x-neon-signature-kid", "some-other-key");

      await expect(verifyNeonWebhook(body, headers, BASE_URL)).resolves.toBe(
        false,
      );
    });

    /** A valid signature stays valid forever without this. */
    it("refuses a signature older than five minutes", async () => {
      const body = bodyFor("her@example.test");
      const old = Date.now() - 6 * 60 * 1000;

      await expect(
        verifyNeonWebhook(body, headersFor(body, old), BASE_URL),
      ).resolves.toBe(false);
    });

    it("refuses when a required header is missing", async () => {
      const body = bodyFor("her@example.test");

      for (const missing of [
        "x-neon-signature",
        "x-neon-signature-kid",
        "x-neon-timestamp",
      ]) {
        const headers = headersFor(body);
        headers.delete(missing);

        await expect(verifyNeonWebhook(body, headers, BASE_URL)).resolves.toBe(
          false,
        );
      }
    });
  });

  describe("the endpoint", () => {
    const post = (body: string, headers: Headers) =>
      app.request("/api/hooks/neon-auth", { method: "POST", body, headers });

    it("allows a listed address", async () => {
      const body = bodyFor("her@example.test");

      const response = await post(body, headersFor(body));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ allowed: true });
    });

    it("refuses anyone else", async () => {
      const body = bodyFor("stranger@example.test");

      const response = await post(body, headersFor(body));
      const decision = (await response.json()) as { allowed: boolean };

      expect(response.status).toBe(200);
      expect(decision.allowed).toBe(false);
    });

    /**
     * Neon retries with the same `X-Neon-Event-Id`, so the same event must get
     * the same answer. Nothing is remembered to achieve that — the decision is
     * a pure function of the address — and this is the test that says so.
     */
    it("answers a retry of the same event identically", async () => {
      const body = bodyFor("her@example.test");
      const headers = headersFor(body);

      const first = await (await post(body, headers)).json();
      const second = await (await post(body, headers)).json();

      expect(second).toEqual(first);
    });

    it("rejects an unsigned request outright", async () => {
      const body = bodyFor("her@example.test");

      const response = await post(body, new Headers());

      expect(response.status).toBe(401);
    });

    /**
     * Fail closed. If the keys cannot be fetched the signature cannot be
     * checked, and an unverifiable request is not one to say yes to. A 500 is
     * retried by Neon, which is kinder to a real person than an immediate
     * refusal and still ends in one if it never succeeds.
     */
    it("refuses, with a 500, when Neon's keys cannot be reached", async () => {
      vi.stubGlobal("fetch", () => Promise.reject(new Error("network down")));
      const body = bodyFor("her@example.test");

      const response = await post(body, headersFor(body));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ allowed: false });
    });

    it("refuses when no base URL is configured to verify against", async () => {
      vi.stubEnv("NEON_AUTH_BASE_URL", "");
      const body = bodyFor("her@example.test");

      const response = await post(body, headersFor(body));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ allowed: false });
    });

    /** An empty allowlist admits nobody — including through this door. */
    it("refuses everyone when the allowlist is empty", async () => {
      vi.stubEnv("ALLOWED_EMAILS", "");
      const body = bodyFor("her@example.test");

      const decision = (await (await post(body, headersFor(body))).json()) as {
        allowed: boolean;
      };

      expect(decision.allowed).toBe(false);
    });
  });
});

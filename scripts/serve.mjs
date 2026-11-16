// Serves the built app and the API from one origin on port 4173, which is what
// `npm run serve` runs and therefore what Playwright's `webServer` starts.
//
// It replaces `vite preview`. The reason is the API: `vite preview` serves
// static files and nothing else, so an end-to-end spec could never reach
// `/api/health`. Serving both from one process also means the suite exercises
// the same-origin arrangement the deployment has, rather than a local-only
// split that would hide a path or CORS mistake until after a deploy.
//
// The Hono application is imported from `api/[...all].ts` — the same file the
// Vercel function is compiled from, so this server and production cannot drift.
//
// Note what this is *not*: a guarantee that the two run identical code. Vercel
// compiles that file and Node 24 strips its types, and those two disagree about
// relative imports — which is how a working local server once coexisted with a
// production function that could not start. `api/deployed-entry.test.ts` is the
// check that keeps them honest.

import { generateKeyPairSync, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { SignJWT } from "jose";

import { createPgliteDb } from "@lesson-planner/db/testing";

import { app as api, setDb } from "../api/[...all].ts";

const PORT = 4173;
const ROOT = "app/dist";

// A real Postgres, with no account and no secret.
//
// When `DATABASE_URL` is unset — a fresh clone, CI, and any machine that has
// not linked Neon — the API gets PGlite instead: Postgres compiled to
// WebAssembly, in this process, with the project's own migrations applied. So
// `npm run serve` and the whole Playwright suite work with no `.env.local`,
// which is the decision recorded in .claude/context/backend.md.
//
// When `DATABASE_URL` *is* set, nothing is injected and the API opens its own
// pool against that database, exactly as the deployed function does.
//
// This runs before the server listens, so the first request already has a
// database. It is also why a stale server is worse than it looks: one started
// before this file gained the injection serves an API with no database at all,
// and reports `db: "unconfigured"` rather than failing outright.
if (!process.env.DATABASE_URL) {
  setDb(await createPgliteDb());
  console.log(
    "No DATABASE_URL: the API is using an in-process PGlite database.",
  );
}

// The same response headers the deployment sets, read from the same file.
//
// `vercel.json` is the record — the decision that headers are set there is in
// security-auth.md — and Vercel applies it in production. Nothing applies it
// locally, so without this the end-to-end spec that reads these headers could
// only ever be run against a deployment, and a Content-Security-Policy would
// first be tested by the teacher.
//
// Read rather than restated, so the two cannot drift: a header added to
// `vercel.json` appears here on the next start, and one removed disappears.
const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const responseHeaders = (vercelConfig.headers ?? []).flatMap(
  (/** @type {{ headers: { key: string, value: string }[] }} */ entry) =>
    entry.headers,
);

const server = new Hono();

server.use("/*", async (c, next) => {
  await next();
  for (const { key, value } of responseHeaders) c.header(key, value);
});

// Test tokens for remote mode (plan batch 6.1, testing.md §2.9).
//
// **This file is never deployed**, so this is not a door in production: the
// Vercel function is `api/[...all].ts` alone, and `api/documents.test.ts`
// proves that application answers neither route below. The lesson behind the
// rule is DEF-028's — a test-only path in deployed code is a path anyone can
// take.
//
// A throwaway Ed25519 key, made when the process starts and gone when it
// stops. Its public half is served where the API looks for Neon's keys, so
// the API checks a minted token with exactly the code that checks a real one:
// the same `jose` call, EdDSA only, issuer and audience the origin of
// `NEON_AUTH_BASE_URL`. The Playwright `webServer` points that variable here
// and sets `ALLOWED_EMAILS` to the one test address.
const testKey = generateKeyPairSync("ed25519");
const TEST_KID = `local-${randomUUID()}`;
const testJwks = {
  keys: [
    {
      ...testKey.publicKey.export({ format: "jwk" }),
      kid: TEST_KID,
      alg: "EdDSA",
      use: "sig",
    },
  ],
};

server.get("/__neon-auth/.well-known/jwks.json", (c) => c.json(testJwks));

// `POST {sub, email}` → `{token}`, valid for 15 minutes like Neon's own. A
// spec mints through `e2e/ui/support/session-token.ts`, with a unique `sub`
// per call so parallel workers never share rows.
server.post("/__neon-auth/__test/mint", async (c) => {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    return c.json(
      { error: "NEON_AUTH_BASE_URL is unset, so the API checks no token." },
      500,
    );
  }
  const input = /** @type {{ sub?: unknown, email?: unknown }} */ (
    await c.req.json().catch(() => ({}))
  );
  if (typeof input.sub !== "string" || typeof input.email !== "string") {
    return c.json({ error: "Send {sub, email}, both strings." }, 400);
  }
  const origin = new URL(baseUrl).origin;
  const token = await new SignJWT({ email: input.email })
    .setProtectedHeader({ alg: "EdDSA", kid: TEST_KID })
    .setSubject(input.sub)
    .setIssuer(origin)
    .setAudience(origin)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(testKey.privateKey);
  return c.json({ token });
});

// The API first. `api` already carries its own `/api` base path, so mounting it
// at the root keeps one spelling of every route across this file, the Vercel
// entry and the specs.
server.route("/", api);

// Then the build. Anything that is not an API route is a static file.
server.use("/*", serveStatic({ root: ROOT }));

const node = serve({ fetch: server.fetch, port: PORT }, (info) => {
  console.log(`Serving ${ROOT} and /api on http://localhost:${info.port}`);
});

// Refuse a busy port instead of quietly picking another one.
//
// This is the `--strictPort` behaviour `vite preview` gave us, and it matters
// more than it looks. `playwright.config.ts` waits on a TCP listen at 4173, not
// on an HTTP response, and `reuseExistingServer` is on outside CI. A server
// that started somewhere else, or a stale one left listening here, would let
// the whole suite run green against the wrong bytes — the failure CLAUDE.md
// warns about, except silent.
node.on("error", (error) => {
  if (/** @type {NodeJS.ErrnoException} */ (error).code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop whatever is listening there — a ` +
        `preview started by hand serves a stale build — and run this again.`,
    );
    process.exit(1);
  }
  throw error;
});

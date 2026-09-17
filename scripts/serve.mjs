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

import { readFileSync } from "node:fs";

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

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
// The test-only sign-in door, opened here and nowhere else.
//
// Google allows no wildcard redirect URIs, so a preview deployment's changing
// URL can never complete a real Google sign-in and the end-to-end suite cannot
// use one. Instead the suite signs in through Better Auth's
// e-mail-and-password provider, which exists only while this flag is exactly
// "1". Vercel never sets it, and `api/auth.test.ts` asserts that the
// configuration built without it carries no password provider at all.
//
// Set before the API is touched, because the auth instance reads it once when
// it is built. This is also the second reason a stale server is worse than it
// looks: one started before this line existed serves an API with no test door,
// and the sign-in fixture then fails as though the fixture were wrong.
process.env.AUTH_TEST_MODE = "1";

// ...and the one address that door admits.
//
// The allowlist applies to the test path exactly as it applies to Google, which
// was proved the direct way: with ALLOWED_EMAILS unset the sign-up endpoint
// answers 403 `not_allowed`, because an empty list admits nobody. That is the
// designed behaviour and it is why this line exists rather than why it is a
// problem.
//
// Appended rather than assigned, so a developer who exported real addresses to
// try Google sign-in locally keeps them. The address is unmistakably fake and
// `.test` is a reserved TLD that can never resolve, so it cannot collide with
// anyone real. Vercel sets neither this nor AUTH_TEST_MODE.
export const E2E_EMAIL = "planner-e2e@example.test";

process.env.ALLOWED_EMAILS = [process.env.ALLOWED_EMAILS, E2E_EMAIL]
  .filter(Boolean)
  .join(",");

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

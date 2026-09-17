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

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { setDb } from "@lesson-planner/db";
import { createPgliteDb } from "@lesson-planner/db/testing";

import { app as api } from "../api/[...all].ts";

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

const server = new Hono();

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

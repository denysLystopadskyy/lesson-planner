// Serves the built app and the API from one origin on port 4173, which is what
// `npm run serve` runs and therefore what Playwright's `webServer` starts.
//
// It replaces `vite preview`. The reason is the API: `vite preview` serves
// static files and nothing else, so an end-to-end spec could never reach
// `/api/health`. Serving both from one process also means the suite exercises
// the same-origin arrangement the deployment has, rather than a local-only
// split that would hide a path or CORS mistake until after a deploy.
//
// The Hono application is imported from `api/app.ts` — the same object the
// Vercel function exports. Node 24 strips the types at import time, so there is
// no build step between this file and the code that runs in production.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import api from "../api/app.ts";

const PORT = 4173;
const ROOT = "app/dist";

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

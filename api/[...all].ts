import app from "./app.ts";

/**
 * The Vercel entry point. One catch-all file takes every `/api/*` request, so
 * the deployment has one function rather than one per route.
 *
 * `app.fetch` is a `(Request) => Response | Promise<Response>`, which is what
 * Vercel's Node runtime accepts as a default export. That is why this file
 * needs no adapter and no `vercel.json` rewrite — and why the same application
 * object also runs under `scripts/serve.mjs` and would run on Cloudflare
 * Workers.
 *
 * This shape is chosen, not yet proven: it is verified on the first deployment,
 * which needs the Vercel project from plan batch 4.1. If Vercel rejects the
 * catch-all name, the fallback is a `vercel.json` rewrite from `/api/(.*)` to a
 * fixed entry file. See the TBD in .claude/context/backend.md.
 */
export default app.fetch;

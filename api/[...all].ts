import { pingDb } from "@lesson-planner/db";
import { Hono } from "hono";

/**
 * The whole backend, as one Hono application, and the Vercel function that
 * serves it.
 *
 * The application and the entry point are **one file on purpose.** Vercel
 * compiles each file under `api/` on its own — it transpiles rather than
 * bundles, so `api/[...all].ts` becomes `api/[...all].js` — while Node 24 runs
 * the TypeScript directly by stripping types. Those two disagree about how a
 * relative import must be spelled, and no spelling satisfies both:
 *
 * | in the source | Node 24, locally | after Vercel compiles it |
 * | ------------- | ---------------- | ------------------------ |
 * | `./app.ts`    | resolves         | `app.ts` is gone         |
 * | `./app.js`    | no such file     | resolves                 |
 * | `./app`       | no such file     | resolves                 |
 *
 * Shipping `./app.ts` passed every local check and then failed on the first
 * deployment with `ERR_MODULE_NOT_FOUND`. A file with no relative imports
 * cannot have that argument. `api/deployed-entry.test.ts` compiles this file
 * the way Vercel does and loads the result, so the next relative import fails
 * a test rather than a deployment. Lesson 26.
 *
 * Handlers stay on the Web-standard `Request` and `Response`, so the same
 * object runs as a Vercel function, under `scripts/serve.mjs` on Node, and on
 * Cloudflare Workers — the hedge for the hosting risk in deployment.md.
 * Nothing here imports a Vercel helper: `hono/vercel`'s `handle()` is exactly
 * `(req) => app.fetch(req)`, which `app.fetch` already is.
 *
 * Why one application and not one file per route: Vercel's Hobby plan caps a
 * deployment at 12 functions, and one is easy to count. The budget and the
 * reasoning are in .claude/context/backend.md.
 *
 * **A bare specifier is the one import shape allowed here** (plan batch 5.1a).
 * `@lesson-planner/db` is an npm workspace package, so the specifier is
 * identical in the source and in the file Vercel compiles — neither runtime
 * rewrites it, and both resolve it through `node_modules`. That is exactly the
 * property a relative path lacks, and it is what lesson 26 prescribed for
 * `db/` before either existed. `api/deployed-entry.test.ts` compiles this file
 * the way Vercel does and loads the result, so the specifier is proven in both
 * directions rather than assumed.
 */
export const app = new Hono().basePath("/api");

/**
 * The deployment's own identity, never the app's data.
 *
 * Both variables are Vercel *system* variables, which are public by definition —
 * the commit SHA is already visible in the repository and the region is visible
 * in a response header. No secret is read here, and none should be: this route
 * answers before anyone has signed in.
 *
 * `null` rather than a guess when a variable is absent. Locally there is no
 * deployment, so there is no commit and no region, and saying so is more useful
 * than "unknown" — a caller can tell "not deployed" from "deployed and broken".
 */
app.get("/health", async (c) => {
  const db = await pingDb();

  return c.json({
    ok: true,
    commit: process.env["VERCEL_GIT_COMMIT_SHA"] ?? null,
    region: process.env["VERCEL_REGION"] ?? null,
    db: db.status,
    dbQueryMs: db.status === "unconfigured" ? null : db.queryMs,
  });
});

/**
 * The Vercel entry point. One catch-all file takes every `/api/*` request, so
 * the deployment has one function rather than one per route.
 *
 * **Export the application, not `app.fetch`.** Vercel's Web-standard export is
 * an *object carrying a `fetch` method* — its documented example is
 * `export default { fetch(request) { … } }` — and a Hono app is exactly that.
 * A bare function is read as the other supported shape, a Node.js
 * `(request, response)` handler. Exporting `app.fetch` therefore did not fail
 * loudly: Vercel called it with Node's `IncomingMessage` and `ServerResponse`,
 * threw away the `Response` it returned, and waited for a `response.end()` that
 * a Web-standard handler never calls. Every request hung for the full function
 * timeout. `hono/vercel`'s `handle()` has the same bare-function shape and is
 * not the fix either.
 *
 * The catch-all name is **proven**: the first deployment returned a function
 * error for `/api/health` and `/api/nope` alike, and a name Vercel had not
 * accepted would have returned the static site's 404 instead.
 */
export default app;

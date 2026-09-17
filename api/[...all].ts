import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { Pool } from "pg";

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
 * **This file imports published npm packages and nothing else** — not a
 * sibling, and not a workspace package of this repository either.
 *
 * Batch 5.1a tried the workspace package. Lesson 26 had prescribed it, and it
 * worked in every local direction: Node 24 strips types inside `node_modules`,
 * `tsc` leaves a bare specifier untouched, and `deployed-entry.test.ts` passed
 * while failing correctly when the specifier was broken. The deployment still
 * returned 500 on every request:
 *
 *     ERR_MODULE_NOT_FOUND: Cannot find module
 *     '/var/task/node_modules/@lesson-planner/db/index.ts'
 *     imported from /var/task/api/[...all].js
 *
 * Read the path. Vercel traced the package and made the directory, then shipped
 * no `index.ts` into it: it compiles what is under `api/` and treats a
 * workspace package's TypeScript source as nothing it needs to build. So the
 * specifier resolved and the file behind it did not exist. **A bare specifier
 * is necessary but not sufficient — the thing it names has to be something the
 * platform actually ships.** Lesson 31.
 *
 * Hence the database seam below lives in this file. `pg` and `drizzle-orm` are
 * ordinary dependencies in the root `package.json`, so `npm ci` puts real
 * JavaScript in `node_modules` where the function can find it. `db/` still
 * exists for the schema, the migrations and the PGlite helper — all of which
 * run on a laptop, in CI and in the build, and none of which the function
 * loads.
 */
export const app = new Hono().basePath("/api");

/**
 * The database, and how this function gets one.
 *
 * Narrow on purpose. `Db` is the shape both drizzle instances satisfy — the
 * node-postgres one this file builds, and the PGlite one the tests and
 * `scripts/serve.mjs` inject — and the only operation either needs here is
 * running a statement. Batch 5.2 widens it when Better Auth's adapter asks for
 * more.
 *
 * PGlite is never named in this file. It is a devDependency, absent from a
 * deployment, and an ESM import resolves when the module loads rather than when
 * a branch is taken — so naming it on a branch that never runs would still
 * crash the function on import, while passing every local check. Lesson 30.
 */
export type Db = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

let currentDb: Db | null = null;

/**
 * Replace the database this process uses.
 *
 * Called by the tests and by `scripts/serve.mjs`, which pass a PGlite database
 * so that `npm run serve` and the whole Playwright suite need no account and no
 * secret. A deployment never calls it, so `getDb()` builds the real pool.
 */
export const setDb = (db: Db | null): void => {
  currentDb = db;
};

/**
 * The database for this process, created once and reused.
 *
 * One pool at module scope, not one per request: a pool per invocation is how a
 * serverless function exhausts a database's connection limit, and Neon's pooled
 * endpoint expects a long-lived client. `pg` over TCP against the pooled string
 * rather than Neon's HTTP driver — that driver's pool must be opened and closed
 * inside one handler, which does not suit an auth library holding one pool.
 * The reasoning is in .claude/context/backend.md.
 *
 * Throws when there is no connection string and nothing was injected. A clear
 * message at the first query beats a connection error further away from its
 * cause.
 */
export const getDb = (): Db => {
  if (currentDb) return currentDb;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "No database: DATABASE_URL is unset and no database was injected with setDb().",
    );
  }

  currentDb = drizzle(new Pool({ connectionString: url }));
  return currentDb;
};

/** What `GET /api/health` reports about the database. */
export type DbHealth =
  | { status: "ok"; queryMs: number }
  | { status: "error"; queryMs: number }
  | { status: "unconfigured" };

/**
 * Ask the database whether it is answering, and how long it took.
 *
 * `SELECT 1` and nothing else. This route answers before anyone has signed in,
 * so it must never read or write application data.
 *
 * A failure is reported, never thrown: a health check that crashes tells a
 * caller less than one that answers "error". `unconfigured` is a third answer
 * rather than a failure, because "no database is configured here" is the true
 * state on a laptop with no `.env.local`, in CI, and on a deployment that has
 * not been given a connection string — the same distinction `commit: null`
 * draws between "not deployed" and "deployed and wrong".
 */
export const pingDb = async (): Promise<DbHealth> => {
  let db: Db;
  try {
    db = getDb();
  } catch {
    return { status: "unconfigured" };
  }

  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", queryMs: Math.round(performance.now() - started) };
  } catch {
    return {
      status: "error",
      queryMs: Math.round(performance.now() - started),
    };
  }
};

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

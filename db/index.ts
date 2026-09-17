import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * The database seam.
 *
 * Two runtimes have to reach a Postgres database through one interface: the
 * deployed function, which talks to Neon over TCP, and every local run — the
 * unit tests and `scripts/serve.mjs` — which talks to PGlite, Postgres
 * compiled to WebAssembly, with no account and no secret.
 *
 * **PGlite is not imported here, and that is the point.** It is a
 * devDependency, so it does not exist in a deployment's `node_modules`; a
 * module that names it, even on a branch that never runs, is a module the
 * function cannot load. The production path is the only path in this file.
 * The PGlite half lives in `db/testing.ts`, which nothing under `api/`
 * imports — the test helpers and the local server call `setDb()` with it.
 *
 * See `.claude/context/backend.md` for why the driver is `pg` over TCP against
 * Neon's pooled string, and not the Neon HTTP driver: that driver's pool must
 * be opened and closed inside one request handler, which does not suit an auth
 * library holding a single pool.
 */

/**
 * The narrow shape both drizzle instances satisfy.
 *
 * Deliberately not the full `PgDatabase` type. The node-postgres and PGlite
 * drizzle instances are different types, and the only operation this batch
 * needs from either is running a statement. Batch 5.2 widens this when Better
 * Auth's adapter needs a real database object; widening a seam on demand is
 * cheaper than guessing its final shape now.
 */
export type Db = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

let current: Db | null = null;

/**
 * Replace the database this process uses.
 *
 * Called by `db/testing.ts` consumers — Vitest and `scripts/serve.mjs` — before
 * anything queries. A deployment never calls it, so `getDb()` builds the real
 * pool instead.
 */
export const setDb = (db: Db | null): void => {
  current = db;
};

/**
 * The database for this process, created once and reused.
 *
 * One pool at module scope, not one per request: opening a pool per invocation
 * is what makes a serverless function exhaust a database's connection limit,
 * and Neon's pooled endpoint expects a long-lived client.
 *
 * Throws when there is no connection string and nothing was injected, rather
 * than returning a broken object. A caller that reaches this without either
 * has a configuration mistake, and a clear message at the first query beats a
 * connection error later.
 */
export const getDb = (): Db => {
  if (current) return current;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "No database: DATABASE_URL is unset and no database was injected with setDb().",
    );
  }

  current = drizzle(new Pool({ connectionString: url }));
  return current;
};

/** What `GET /api/health` reports about the database. */
export type DbHealth =
  | { status: "ok"; queryMs: number }
  | { status: "error"; queryMs: number }
  | { status: "unconfigured" };

/**
 * Ask the database whether it is answering, and how long it took.
 *
 * `SELECT 1` and nothing else. The health route answers before anyone has
 * signed in, so it must never read or write application data — the rule is on
 * the batch page and in backend.md.
 *
 * A failure is reported, never thrown: the route's job is to say what is wrong,
 * and a health check that crashes tells a caller less than one that answers
 * `"error"`. `unconfigured` is a third answer rather than a failure, because
 * "no database is configured here" is the true state locally and on a
 * deployment that has not been given a connection string yet — the same
 * distinction `commit: null` already draws for a non-deployment.
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

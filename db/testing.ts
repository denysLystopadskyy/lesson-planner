import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

/**
 * A real Postgres for tests and for the local server, with nothing installed.
 *
 * PGlite is Postgres compiled to WebAssembly, running in this process. It is
 * not a mock and not a different database: the same generated SQL applies to it
 * and to Neon, so the migrations under test are the migrations that ship. That
 * is why `npm run serve` and the whole Playwright suite need no account and no
 * secret — the decision is in `.claude/context/backend.md`.
 *
 * **No deployed file may import this one.** `@electric-sql/pglite` is a
 * devDependency and is absent from a deployment, so the Vercel entry keeps its
 * own production-only path and takes an injected database instead (lesson 30).
 * The tests and `scripts/serve.mjs` are the only callers, and neither ships.
 *
 * The return type is left to inference rather than annotated with the entry's
 * `Db`. Importing a type from `api/[...all].ts` would drag the Hono application
 * into every file that wants a test database; structural typing already makes
 * the drizzle instance acceptable wherever `Db` is expected.
 */

/** Where `drizzle-kit generate` writes its SQL, resolved from this file. */
const MIGRATIONS = path.join(import.meta.dirname, "migrations");

/**
 * An in-memory Postgres with every migration applied.
 *
 * Each call gets its own database, so tests cannot leak state into one another
 * through a shared table. `dataDir` is left unset, which keeps it in memory —
 * there is nothing to clean up afterwards and nothing to leave behind on disk.
 */
export const createPgliteDb = async () => {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS });
  // No cast. The PGlite instance satisfies the entry's `Db` structurally,
  // which is the point of keeping that type narrow — ESLint rejected an
  // `as unknown as Db` here as unnecessary, and it was right. If a later batch
  // widens `Db` and a cast becomes necessary, that is the seam reporting that
  // the two drivers have actually diverged.
  return db;
};

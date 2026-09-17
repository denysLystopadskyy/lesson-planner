import { getDb, setDb } from "@lesson-planner/db";
import { createPgliteDb } from "@lesson-planner/db/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

/**
 * The database seam itself, rather than the route that uses it.
 *
 * These tests live under `api/` and not beside `db/` on purpose: `api/` and
 * `app/` are the only two Vitest projects, and a third project for two files
 * would cost more than it explains. `.vercelignore` already keeps every
 * `api/*.test.ts` off the deployment, and `api/one-function.test.ts` fails if
 * that ever stops being true.
 *
 * **What this batch does not test: a migration.** `db/schema.ts` defines no
 * tables — the Better Auth tables are batch 5.2's and the `documents` tables
 * are Phase 6's — so `drizzle-kit generate` produces no SQL files, and
 * asserting that "the migrations apply" would be asserting nothing. What is
 * tested is the mechanism around them: the migrator runs, records its
 * bookkeeping, and two databases do not share state. The first real migration
 * arrives with the auth tables, and the gate moves there with it.
 */
describe("the database seam", () => {
  afterEach(() => {
    setDb(null);
    vi.unstubAllEnvs();
  });

  describe("PGlite, the no-infrastructure database", () => {
    it("runs the migrator and answers a query", async () => {
      const db = await createPgliteDb();

      await expect(db.execute(sql`select 1 as one`)).resolves.toBeDefined();
    });

    /**
     * Drizzle's migrator keeps its own bookkeeping table. Its presence is what
     * proves the migrator actually ran rather than returning early — which is
     * the only thing worth asserting while there are no migrations of our own.
     */
    it("leaves drizzle's migration bookkeeping behind", async () => {
      const db = await createPgliteDb();

      const result = (await db.execute(
        sql`select count(*)::int as n from information_schema.tables
            where table_name = '__drizzle_migrations'`,
      )) as { rows: { n: number }[] };

      expect(result.rows[0]?.n).toBe(1);
    });

    /**
     * Each call gets its own database. Without this, one test's table would be
     * another test's surprise, and the failure would land in whichever test
     * happened to run second.
     */
    it("gives every caller an isolated database", async () => {
      const first = await createPgliteDb();
      const second = await createPgliteDb();

      await first.execute(sql`create table only_in_first (id int)`);

      await expect(
        second.execute(sql`select 1 from only_in_first`),
      ).rejects.toThrow();
    });
  });

  describe("choosing a database", () => {
    it("prefers an injected database over any connection string", async () => {
      vi.stubEnv("DATABASE_URL", "postgres://nobody@nowhere.invalid/none");
      const injected = await createPgliteDb();
      setDb(injected);

      expect(getDb()).toBe(injected);
    });

    /**
     * No connection string and nothing injected is a configuration mistake, and
     * it says so at the first query. The alternative — handing back an object
     * that fails later — turns one clear message into a connection error far
     * from its cause.
     */
    it("refuses clearly when there is no database at all", () => {
      vi.stubEnv("DATABASE_URL", "");

      expect(() => getDb()).toThrow(/DATABASE_URL is unset/);
    });
  });
});

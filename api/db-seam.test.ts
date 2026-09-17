import { createPgliteDb } from "@lesson-planner/db/testing";
import { getDb, setDb } from "./[...all].ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

/**
 * The database seam itself, rather than the route that uses it.
 *
 * The seam lives in `api/[...all].ts` because a workspace package's TypeScript
 * source is not something Vercel ships — see that file, and lesson 31. These
 * tests sit beside it. `.vercelignore` keeps every `api/*.test.ts` off the
 * deployment, and `api/one-function.test.ts` fails if that stops being true.
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

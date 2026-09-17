import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit's configuration: where the schema is, where the SQL migrations
 * go, and which database to talk to.
 *
 * `dialect` is `postgresql` for both targets. Tests run on PGlite, which is
 * Postgres compiled to WebAssembly rather than a different database, so one
 * set of generated SQL applies to Neon and to PGlite alike. That is the whole
 * reason the project can test the real migrations with no infrastructure
 * (`.claude/context/backend.md`).
 *
 * `dbCredentials` reads the **unpooled** connection string. Neon's pooled host
 * runs PgBouncer in transaction mode, which cannot run the statements a
 * migration needs. The pooled string is what the running function uses; the
 * direct one is for migrations and `pg_dump`.
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL_UNPOOLED"] ?? "",
  },
});

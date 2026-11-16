import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * The Drizzle schema: the app's own two tables, from batch 6.1.
 *
 * Neon owns the sign-in tables in its own `neon_auth` schema (batch 5.5), so
 * nothing about users is defined here. `user_id` is the `sub` of the Neon Auth
 * token, stored as text, with no foreign key: the users live in a schema this
 * project does not control.
 *
 * **The deployed entry does not import this file** (lesson 31). It queries
 * with drizzle `sql` templates instead. The PGlite tests apply the migration
 * that `npm run db:generate` makes from this file, so a column the entry reads
 * and this file lacks fails a test rather than a deployment.
 *
 * The shape is fixed in the Phase 6 plan, "Batch 6.1", and recorded in
 * `.claude/context/storage-data-contract.md`.
 */

/**
 * One row per user and key: the current body of `data`, `settings` or
 * `template`. `body` is the same JSON the browser stored under that key.
 * It is nullable because a `template` of `null` means "use the default".
 */
export const documents = pgTable(
  "documents",
  {
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    body: jsonb("body"),
    schemaVersion: integer("schema_version").notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.key] }),
    check(
      "documents_key_check",
      sql`${table.key} in ('data', 'settings', 'template')`,
    ),
  ],
);

/**
 * The previous bodies of each document: a copy of the old row is written here
 * before every overwrite, and the entry keeps the newest 50 per user and key.
 * Restoring from it is a developer runbook (batch 6.5).
 */
export const documentVersions = pgTable(
  "document_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    body: jsonb("body"),
    schemaVersion: integer("schema_version").notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("document_versions_user_key_saved_at_idx").on(
      table.userId,
      table.key,
      table.savedAt.desc(),
    ),
  ],
);

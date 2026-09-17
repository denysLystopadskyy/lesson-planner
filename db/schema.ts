/**
 * The Drizzle schema for the whole project.
 *
 * It is empty on purpose. Plan batch 5.1a builds the plumbing — the driver
 * seam, the migration mechanism and the health query — and deliberately
 * defines no tables, because it owns none of them:
 *
 * - the Better Auth tables (`user`, `session`, `account`, `verification`)
 *   arrive in batch 5.2, generated from the library rather than hand-written;
 * - the `documents` and `document_versions` tables arrive in Phase 6, and
 *   their shape is already decided in
 *   `.claude/context/storage-data-contract.md`.
 *
 * Inventing either one here would be guessing at another batch's decision, and
 * a table nothing reads is a migration that can only ever be wrong.
 *
 * **Migrations are additive only.** Never drop or rename a column that running
 * code still reads. The rule and its reason are in
 * `.claude/context/backend.md`.
 */
export {};

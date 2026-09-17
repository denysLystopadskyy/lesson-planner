/**
 * The Drizzle schema.
 *
 * Empty again, and for a better reason than the first time.
 *
 * Batch 5.2a put Better Auth's four tables here because this project ran the
 * auth server. Neon runs it now (batch 5.5) and owns those tables in its own
 * `neon_auth` schema, so ours were duplicates of something we do not control —
 * and two `user` tables, one real and one dead, is exactly the kind of thing
 * that misleads somebody in six months.
 *
 * **Removing them did not break the additive-only rule.** That rule protects
 * migrations that have been *applied*: never drop a column running code still
 * reads. These were applied to no Neon branch — `information_schema` showed
 * zero tables in `public` throughout — so there was nothing to be additive
 * about. A schema is a description of a database, and it now describes the
 * empty one it actually has.
 *
 * The app's own tables, `documents` and `document_versions`, arrive in Phase 6
 * with their shape already decided in
 * `.claude/context/storage-data-contract.md`.
 */
export {};

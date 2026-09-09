# Batch 6.2 — Documents API

Phase 6 · [Plan home](README.md) · Prev: [6.1](p6-01-schema-version-group-ids.md) · Next: [6.3](p6-03-remote-persistence.md)

## Goal

A signed-in user can read and write their three documents on the server, and
nobody can read anyone else's. Every write keeps the previous version.

Design: [backend.md](../../.claude/context/backend.md),
[storage-data-contract.md](../../.claude/context/storage-data-contract.md).

## Tasks (TDD)

- [ ] Tables (Drizzle schema + migration): `documents` with `user_id`, `key`
      (`data` | `settings` | `template`), `body` (JSONB for the two JSON keys,
      text for the template), `schema_version`, `updated_at`,
      `client_updated_at`; primary key (`user_id`, `key`). `document_versions`:
      append-only copies of every previous body, capped per key (50), pruned on
      write.
- [ ] `GET /api/documents`: the caller's three documents with their
      `updated_at` values, or `null` per missing key.
- [ ] `PUT /api/documents/:key` with a JSON body of three fields: `body`, `schemaVersion` and `baseUpdatedAt`. If the server's `updated_at` is newer than
      `baseUpdatedAt`, answer 409 with the server copy (last-write-wins is the
      client's decision — RP-07 §4). Otherwise write, insert the old body into
      `document_versions`, prune, answer the new `updated_at`.
- [ ] Shape validation on the server through a module shared with the app
      (the guards from [3.1](p3-01-storage-guards.md) and
      [3.2](p3-02-input-import-sanitation.md) move to `shared/`). A body that
      fails validation is a 400, never a write.
- [ ] Authorization: the session comes from Better Auth
      (`auth.api.getSession`); every query carries `WHERE user_id = ?`. No
      admin route, no listing of users.
- [ ] Size limit on the body (64 KB is ten times the data) and a rate limit on
      the route.
- [ ] Unit tests (Vitest + PGlite), techniques named: two users cannot read or
      overwrite each other (RP-09 AC 21); validation rejects each malformed
      shape (decision table); stale `baseUpdatedAt` → 409 with the server copy;
      pruning keeps exactly 50 versions (boundary values 49, 50, 51).

## Acceptance criteria

- Unit tests exit 0.
- On a preview deployment: `GET` without a session → 401; with a session →
  the three documents.
- Function count still 1.
- No app code calls the API yet; the storage-contract specs are untouched.

## Merge order and dependencies

Depends on 6.1. Deployable: yes — the routes exist and nothing calls them.

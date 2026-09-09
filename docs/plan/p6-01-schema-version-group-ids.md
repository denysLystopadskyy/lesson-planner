# Batch 6.1 — Schema version and stable group ids (local first)

Phase 6 · [Plan home](README.md) · Prev: [5.4](p5-04-security-review.md) · Next: [6.2](p6-02-documents-api.md)

## Goal

Every group has a stable id, and the stored data says which version it is.
Everything happens in the browser; no server row is written yet. This is the
prerequisite three research reports flagged and none solved (RP-04 §3, RP-07
§7, RP-08 §43). The design is RP-07 §2; the decisions are in
[storage-data-contract.md](../../.claude/context/storage-data-contract.md).

## Tasks (TDD)

- [ ] A fourth key, `groupLessonPlannerSchemaVersion`: a bare decimal integer
      as a string, not JSON. Absence means version 0 — the data every current
      user has.
- [ ] `m1: v0 → v1` as a pure function in `app/src/migrations.ts`: it adds
      `id` (`crypto.randomUUID()`) to every group and changes nothing else.
      No DOM, no storage, no network — unit-testable.
- [ ] Load path: parse, then migrate in memory. The migrated shape is written
      on the **next user write**, together with a `<key>.pre-v1.<epoch>`
      snapshot of the old value. Nothing is written on mount, so the "no write
      on mount" spec keeps guarding corrupt data.
- [ ] Forward compatibility: a stored version newer than the client puts the
      app in read-only mode with a visible message and writes nothing
      (RP-09 acceptance criterion 23).
- [ ] Two decisions, recorded in storage-data-contract.md: **D8** — keep the
      `dates` denormalisation in v1 (smallest change; the fingerprint parity
      check stays meaningful). **Nullability** — v1 adds `id` only; `currency`
      and `monthlyOverrides` stay optional in storage as today. The e2e
      `test-data.ts` type is aligned to the app's type so there is one
      definition of `Group`.
- [ ] Routes: `#/group/<id>` replaces `#/group/<index>`. Old index links were
      "a guess between sessions"; they now fall through to the main view.
- [ ] Frozen hooks: add the dataset hook `groupId`; retire `groupIndex`. Change
      `testid-contract.spec.ts` and the list in
      [testing.md](../../.claude/context/testing.md) in the same commit.
- [ ] Backup envelope ([3.3](p3-03-json-backup.md)): `schemaVersion` becomes 1;
      importing a v0 file migrates it; importing a newer file is refused with a
      message, not truncated (RP-07 §2 rule 5).
- [ ] Fixtures: `realistic.json` and `empty.json` get v1 copies with the
      version key; `legacy.json` stays v0 and now tests the migration path.
- [ ] Unit tests: `m1` on the legacy fixture (ids present, everything else
      byte-equal); idempotence (running `m1` twice equals once); the
      newer-version refusal.

## Acceptance criteria

- Unit tests for `m1` and the version guard exit 0.
- e2e: the legacy fixture renders; after one edit, storage holds the v1 shape
  and the version key, and a `pre-v1` snapshot exists.
- e2e: a fixture with version `2` renders read-only and storage is byte-equal
  after the session (RP-09 AC 23).
- Golden-shape and routing specs updated and green; the testid-contract spec
  lists `groupId` and not `groupIndex`.
- Export → clear → import round trip green at v1.

## Merge order and dependencies

Depends on 5.4 — not technically, but the review closes before data work
starts. Deployable: yes.

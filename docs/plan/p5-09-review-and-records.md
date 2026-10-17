# Batch 5.9 — The review, and the records catch up with Neon Auth

Phase 5 · [Plan home](README.md) · Prev: [5.4](p5-04-security-review.md) · Next: [5.10](p5-10-dead-test-door.md)

## Goal

Make the records true again after the switch to Neon Auth (batches 5.5–5.8),
and publish the review that found the gaps.

The review is [RP-11](../research/rp11-docs-process-review/rp11-docs-process-review.md),
dated 2026-10-17. It checked the docs, the plan pages and the AI instructions
against the code, at `main` `a003ce0`.

## Test basis

- The code at `a003ce0`: `api/[...all].ts`, `db/schema.ts`, `scripts/serve.mjs`,
  `vercel.json`, `package.json`, `.env.example`.
- The batch pages 5.5 to 5.8 and 5.4, which describe what changed.
- RP-11's [list of stale and false records](../research/rp11-docs-process-review/records.md).

## What changed

- **RP-11 is added**: a hub and four pages — TDD and test style, AI setup,
  records that do not match, language. It is linked from the
  [research index](../research/README.md).
- **CLAUDE.md**: where the app runs, the storage keys, Phase 4 and Phase 5
  status, the API routes, `vercel.json`, the empty schema, the research count
  and the test counts.
- **security-auth.md**: a new first section, "Sign-in as it runs now". Every
  rule about the removed server is kept and marked **Superseded**, with the
  batch that replaced it. The TBD list is corrected.
- **backend.md**: a new first section, "The API as it runs now". The 5.2a and
  5.2b sections are marked superseded; the routes, health states, dependencies
  and variables are corrected.
- **deployment.md**: what `vercel.json` holds.
- **testing.md**: the testid count, the removed `@ported` tags, the PGlite
  sentence, and the stale `signedIn` rule. The full rewrite of this file into a
  test strategy is batch T.1.
- **The plan hub**: the Phase 5 row, two new sections ("What changed on
  2026-09-17" and "… on 2026-10-17"), the missing row 43m (5.5), rows 43q (5.4)
  and 43r (5.9), and notes on rows 46–49.
- **Batch pages**: p5-08's wrong link and its count of specs; the "Next" links
  on p5-04, p5-06 and p5-08; p5-07's wrong statement about `serve.mjs`, struck
  through and corrected in place.
- **`.env.example`**: its header no longer says that no code reads the
  variables.
- **DEF-028** is added to the [DEF registry](def-registry.md), open.

Outside the repository, the project memory on the maintainer's machine is
corrected: the storage-keys line (four, not three) and the Vercel plugin
version.

## How old text was handled

**Superseded text is struck through and kept, not deleted.** The record must
still show what was decided and when. Each struck rule names the batch that
replaced it, and a new first section says what is true now.

## What this batch does not do

- It changes no code. The stale code comments and the dead lines in
  `scripts/serve.mjs` are batch 5.10.
- It does not rewrite testing.md as a test strategy, and it does not rewrite
  older batch pages. That is phase T.
- It does not fix the language problems that RP-11 lists, except in the lines
  it had to change anyway.

## TDD log

**Exception: docs only.** No production code changed, so there is no red
commit.

## Exit criteria

- [ ] `npm run format:check`, `npm run lint`, `npm run check:pii` exit 0.
- [ ] Every relative link and `#anchor` in the changed markdown files resolves
      (checked with a script, not by eye).
- [ ] In CLAUDE.md, `.claude/context/` and the plan hub, every remaining
      `AUTH_TEST_MODE`, `validateUserInfo`, `BETTER_AUTH_SECRET` or
      `no-schema` is in struck-through or "superseded" text, or in the DEF-028
      note.
- [x] CI green (PR #81: the `checks` job and the Vercel preview passed).

## Merge order and dependencies

Depends on [5.4](p5-04-security-review.md), which changed CLAUDE.md and the
hub first. Deployable: yes — documentation only.

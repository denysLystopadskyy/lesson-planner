# Batch 4.2c — One function, not four

Phase 4 · [Plan home](README.md) · Prev: [4.2b](p4-02b-vercel-export-shape.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

The deployment carries the function it is supposed to carry, and nothing else.

## What happened

Batch [4.2](p4-02-api-skeleton-local-server.md) records a function budget of
**1 of 12**. The deployment reported **4**:

| path                       | result | meaning                          |
| -------------------------- | ------ | -------------------------------- |
| `/api/health`              | 200    | the intended function            |
| `/api/health.test`         | 500    | a deployed function              |
| `/api/deployed-entry.test` | 500    | a deployed function              |
| `/api/vitest.config`       | 500    | a deployed function              |
| `/api/nope`                | 404    | what a _non_-function looks like |

`api/` is Vercel's routing table, not a source folder: every `.ts` file in it
becomes a function at its own public path. Co-locating tests beside the code is
this repository's habit everywhere else, and it is exactly wrong here.

Nothing leaked. The three extra functions crashed on import, because `vitest` is
not a production dependency. That is luck rather than design —
`deployed-entry.test.ts` spawns a compiler, and no test file should be one
request away from the internet.

It was found by reading `lambdaRuntimeStats` on the deployment
(`{"nodejs":4}`), not by anything failing. The dashboard had been checked and
the count reported as one.

## Tasks

- [x] `.vercelignore` keeps `api/*.test.ts` and `api/vitest.config.ts` off the
      deployment.
- [x] `api/one-function.test.ts` fails if a file under `api/` is neither the
      entry nor ignored, so the next one has to be classified on purpose. Its
      pattern matcher throws on a pattern shape it does not understand rather
      than treating it as "no match" — a matcher that fails open would report
      success for a file it never examined.
- [x] Record the rule in [backend.md](../../.claude/context/backend.md) and as
      [lesson 28](lessons-learned.md).

## Acceptance criteria

- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and
      `check:pii` clean; `test:unit` **339**, `test:e2e` **183**.
- [x] The guard fails when a test file is not ignored, verified.
- [ ] The deployment reports **1** function, and `/api/health.test` returns 404.
      Checked after merge, from the deployment itself rather than the dashboard.

## Merge order and dependencies

Depends on 4.2b. Deployable: yes — GitHub Pages does not read `api/`, and this
removes routes rather than adding any.

# Batch 4.2b — Export the shape Vercel actually reads

Phase 4 · [Plan home](README.md) · Prev: [4.2a](p4-02a-fix-vercel-entry.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

`GET /api/health` answers on the deployment. For real this time — confirmed by
reading the body, not by reading a status badge.

## What happened

[4.2a](p4-02a-fix-vercel-entry.md) fixed the module that could not load. The
redeploy went green and the function stopped crashing. It started **hanging**:

| request       | result                         |
| ------------- | ------------------------------ |
| `/`           | 200 in 0.4s                    |
| `/api/health` | no response, 60s, curl exit 28 |

The entry said `export default app.fetch`. Vercel supports two export shapes and
tells them apart by what the default export _is_:

- an **object carrying a `fetch` method** — a Web-standard handler;
- a **bare function** — a Node.js `(request, response)` handler.

`app.fetch` is a bare function, so Vercel called it with `IncomingMessage` and
`ServerResponse`, discarded the `Response` Hono returned, and waited for a
`response.end()` that a Web-standard handler never calls. Every request hung
until the function timed out.

A Hono app is already an object with a `fetch` method, which is why Hono's own
documentation says `export default app`. `hono/vercel`'s `handle()` does not
help — it is a bare function too.

**Nothing reported this.** No error, no log line, a green deployment status. It
was found by requesting the route and reading the body. Recorded as
[lesson 27](lessons-learned.md).

## Tasks

- [x] `export default app` in `api/[...all].ts`.
- [x] Assert the **shape** in `api/deployed-entry.test.ts`, not only the
      behaviour. Its first version called `entry.fetch()` directly, which passes
      under both exports — that is why it missed this. It now checks the default
      export is not a function and does carry a `fetch` method.
- [x] Record the rule in [backend.md](../../.claude/context/backend.md),
      including that the wrong shape fails silently.

## Acceptance criteria

- [x] `npm run test:unit` **337** and `npm run test:e2e` **183** green, with
      `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and
      `check:pii` clean.
- [x] The shape assertion fails against `export default app.fetch`, verified.
- [x] `npm run serve` still answers `/api/health` locally — `scripts/serve.mjs`
      imports the named export, so it never depended on the default.
- [ ] `/api/health` returns 200 on production with a JSON body. Filled into
      [4.2's results table](p4-02-api-skeleton-local-server.md) after the deploy,
      by reading the body rather than the deployment status.

## Merge order and dependencies

Depends on 4.2a. Deployable: yes — GitHub Pages does not read `api/`, and the
Vercel function currently times out, so this can only improve it.

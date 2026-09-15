# Batch 4.2 — API skeleton and local server

Phase 4 · [Plan home](README.md) · Prev: [4.1](p4-01-vercel-project-previews.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

One function answers `GET /api/health`, on Vercel and on the developer's
machine, and the test suite runs against the same code. This proves the
backend shape before the teacher moves and before any secret exists.

Decisions: [backend.md](../../.claude/context/backend.md).

## Tasks

- [x] Create `api/` with a Hono app (`api/app.ts`) and one Vercel entry file.
      Shipped `api/[...all].ts` with `export default app.fetch`, and **no**
      `vercel.json` rewrite. Recorded in backend.md as the _chosen_ shape,
      pending the first deploy — which shape Vercel accepts cannot be known
      without a deployment, and the project is still an owner action from 4.1.
- [x] `GET /api/health` returns JSON: `ok: true`, the commit (from
      `VERCEL_GIT_COMMIT_SHA`, a public system variable), the region (from
      `VERCEL_REGION`). No secret is read. Both are `null` off a deployment,
      so "not deployed" and "deployed, wrong region" cannot look alike.
- [x] A Node script (`scripts/serve.mjs`) serves `app/dist` as static files and
      mounts the same Hono app under `/api` on port 4173, through Hono's Node
      adapter. `npm run serve` builds the app and then runs this script instead
      of `vite preview`. Playwright's `webServer` is unchanged. It **exits
      non-zero on a busy port**: `webServer` waits on a TCP listen and
      `reuseExistingServer` is on outside CI, so a server that bound elsewhere
      would let the suite run green against the wrong bytes.
- [x] TypeScript coverage for `api/` and `scripts/`: `api/tsconfig.json`
      (`nodenext`, `checkJs`), and `npm run typecheck:api`. It lives inside
      `api/` because ESLint's `projectService` finds a file's project by walking
      up from the file; at the root, every file in `api/` fails typed linting.
      Covering `scripts/` meant annotating `check-no-personal-data.mjs`, which
      had never been typechecked.
- [x] `ci.yml` gains `typecheck:api`. `typecheck:app` was already there —
      it landed early, with `check:pii`, in PR #52 on 2026-09-12. The stale
      sentence in deployment.md that still claimed otherwise is corrected here.
- [x] `.gitignore` gets `.env` and `.env.*`, with `!.env.example` kept. Added
      `.env.example` with variable **names** only (none needed yet; the file
      documents the rule).
- [x] First runtime dependencies: `hono@4.13.8` and `@hono/node-server@2.1.1`,
      pinned exactly. Checked first: hono needs Node >= 16.9, the adapter needs
      Node >= 20 and peers `hono@^4`. Both clear Node 24 and TypeScript 6.0.3.
      This is the repository's first `dependencies` block.
- [x] A Vitest test for the health route. API tests are collected by
      `api/vitest.config.ts`, named as a project by a root `vitest.config.ts`,
      so `npm run test:unit` stays one command. Recorded in
      [testing.md](../../.claude/context/testing.md).
- [x] An e2e spec: the `request` fixture calls `/api/health` and gets 200 with
      `ok: true`. This proves the local server serves the API.
- [x] **Not on the original list:** `api` added to `SCANNED` in
      `scripts/check-no-personal-data.mjs`. That array is a hardcoded list of
      directories, so a new tree is invisible to `npm run check:pii` until it is
      named — the check would have gone on passing while scanning nothing new.
      Verified by planting an IBAN in `api/` and watching it fail.

## Acceptance criteria

Two of the five need a live Vercel project, which only the owner can create.
They are **moved** to the results table below rather than ticked — the split
CLAUDE.md asks for when a gate outruns its batch, and the shape of
[lesson 8](lessons-learned.md).

Met by this pull request:

- [x] Full suite green locally and in CI with the new `npm run serve`:
      **335 unit tests**, **183 end-to-end in 34 files**, and `format:check`,
      `lint`, `typecheck`, `typecheck:app`, `typecheck:api`, `check:pii` clean.
- [x] `typecheck:app` and `typecheck:api` run in `ci.yml`.
- [x] `.env.example` contains names only; `git ls-files | grep '^\.env'` shows
      only `.env.example`.

Moved to the results table (needs a deployment):

- `GET /api/health` returns 200 on a preview URL and on the production Vercel
  URL, with `region: "fra1"`.
- Vercel reports 1 function for the deployment (cap on Hobby: 12).
- The entry shape in `api/[...all].ts` is the one Vercel actually accepts.

### Results (a follow-up PR fills this in)

| Check                               | Date | Result |
| ----------------------------------- | ---- | ------ |
| `/api/health` 200 on a preview URL  |      |        |
| `/api/health` 200 on production     |      |        |
| `region: "fra1"` in the response    |      |        |
| Function count = 1                  |      |        |
| Catch-all entry accepted as shipped |      |        |

## Merge order and dependencies

Depends on 4.1. Parallel-safe with Phase 3: it touches `api/`, `scripts/`,
the workflows and `package.json`; Phase 3 touches `app/src` and `e2e/`.
Deployable: yes — GitHub Pages ignores `api/`.

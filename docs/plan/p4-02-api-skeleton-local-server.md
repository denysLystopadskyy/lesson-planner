# Batch 4.2 — API skeleton and local server

Phase 4 · [Plan home](README.md) · Prev: [4.1](p4-01-vercel-project-previews.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

One function answers `GET /api/health`, on Vercel and on the developer's
machine, and the test suite runs against the same code. This proves the
backend shape before the teacher moves and before any secret exists.

Decisions: [backend.md](../../.claude/context/backend.md).

## Tasks

- [ ] Create `api/` with a Hono app (`api/app.ts`) and one Vercel entry file.
      If Vercel does not accept a catch-all file name for `/api/*`, add a
      `vercel.json` rewrite from `/api/(.*)` to the entry. Record which shape
      worked in backend.md.
- [ ] `GET /api/health` returns JSON: `ok: true`, the commit (from
      `VERCEL_GIT_COMMIT_SHA`, a public system variable), the region (from
      `VERCEL_REGION`). No secret is read.
- [ ] A Node script (`scripts/serve.mjs`) serves `app/dist` as static files and
      mounts the same Hono app under `/api` on port 4173, through Hono's Node
      adapter. `npm run serve` builds the app and then runs this script instead
      of `vite preview`. Playwright's `webServer` stays as it is.
- [ ] TypeScript coverage for `api/` and `scripts/`: a `tsconfig` for Node ESM
      (`nodenext`), and `npm run typecheck:api`.
- [ ] `ci.yml` gains `typecheck:app` and `typecheck:api`. The first closes a gap:
      today only `deploy.yml` typechecks the app, so a type error in `app/src`
      passes PR checks and fails at deploy time.
- [ ] `.gitignore` gets `.env` and `.env.*`, with `!.env.example` kept. Add
      `.env.example` with variable **names** only (none needed yet; the file
      documents the rule).
- [ ] First runtime dependencies: `hono` and `@hono/node-server`, pinned exactly
      (`.npmrc` has `save-exact`). Check peer ranges against Node 24 and the
      pinned TypeScript first
      ([linting-formatting.md](../../.claude/context/linting-formatting.md)).
- [ ] A Vitest test for the health route. Decide where API unit tests are
      collected (today Vitest collects `app/src/**/*.test.ts` only) and record
      it in [testing.md](../../.claude/context/testing.md).
- [ ] An e2e spec: the `request` fixture calls `/api/health` and gets 200 with
      `ok: true`. This proves the local server serves the API.

## Acceptance criteria

- `GET /api/health` returns 200 on a preview URL and on the production Vercel
  URL, with `region: "fra1"`.
- Full suite green locally and in CI with the new `npm run serve`.
- `typecheck:app` and `typecheck:api` run in `ci.yml`.
- Vercel reports 1 function for the deployment (cap on Hobby: 12).
- `.env.example` contains names only; `git ls-files | grep '^\.env'` shows only
  `.env.example`.

## Merge order and dependencies

Depends on 4.1. Parallel-safe with Phase 3: it touches `api/`, `scripts/`,
the workflows and `package.json`; Phase 3 touches `app/src` and `e2e/`.
Deployable: yes — GitHub Pages ignores `api/`.

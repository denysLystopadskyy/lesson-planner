# Batch 4.2a — The deployed entry could not start

Phase 4 · [Plan home](README.md) · Prev: [4.2](p4-02-api-skeleton-local-server.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

`GET /api/health` answers on the deployment, and a test runs the code the
deployment runs.

## What happened

Batch [4.2](p4-02-api-skeleton-local-server.md) merged green — 335 unit tests,
183 end-to-end, three typechecks, lint, `check:pii`. The first Vercel deployment
returned 500 on every API route:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/api/app.ts'
  imported from /var/task/api/[...all].js
```

`api/[...all].ts` contained `import app from "./app.ts"`. Node 24 strips types,
so that file exists locally. Vercel **compiles** — per file, not bundled — so
`app.ts` becomes `app.js` and the specifier points at nothing. No spelling
satisfies both loaders:

| in the source | Node 24, locally | after Vercel compiles it |
| ------------- | ---------------- | ------------------------ |
| `./app.ts`    | resolves         | `app.ts` is gone         |
| `./app.js`    | no such file     | resolves                 |
| `./app`       | no such file     | resolves                 |

The suite could not see it. `api/health.test.ts` imports the application object;
`e2e/features/api-health.spec.ts` goes through `scripts/serve.mjs`. **Both run
the source. Nothing ran the compiled output**, so the deployed code was the only
code no test executed. Recorded as [lesson 26](lessons-learned.md).

## Tasks

- [x] Merge the application into `api/[...all].ts` and delete `api/app.ts`, so
      the entry has no relative import to get wrong.
- [x] Add `api/deployed-entry.test.ts`: compile the entry the way Vercel does,
      load the emitted JavaScript, call it with a real `Request`, assert 200.
      Checked in both directions — it fails when the import is put back.
- [x] Record the rule in [backend.md](../../.claude/context/backend.md): nothing
      under `api/` imports a sibling by relative path; `db/` and `shared/` get
      bare specifiers in Phases 5 and 6, because a package name resolves the
      same either way.
- [x] Correct backend.md's claim that there is "no build step between the local
      server and the code that runs in production". Vercel compiles; the claim
      was half wrong, and that half is what failed.
- [x] Record the catch-all entry shape as **proven** rather than chosen.

## Acceptance criteria

Met by this pull request:

- [x] `npm run test:unit` **336** and `npm run test:e2e` **183** green, with
      `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and
      `check:pii` clean.
- [x] The new test fails on the old code and passes on the new.
- [x] `npm run serve` still answers `/api/health` locally.

Moved to [4.2's results table](p4-02-api-skeleton-local-server.md) (needs the
redeploy):

- `/api/health` returns 200 on production, and on a preview URL.
- `region` is `"fra1"`.
- The deployment reports 1 function.

## Merge order and dependencies

Depends on 4.2. Deployable: yes — GitHub Pages does not read `api/`, and the
Vercel deployment is already broken, so this can only improve it.

# Batch 5.0 — The Neon project, linked

Phase 5 · [Plan home](README.md) · Prev: [4.3a](p4-03a-moved-banner.md) · Next: [5.1](p5-01-neon-database-plumbing.md)

## Goal

The repository knows which Neon project it belongs to, the maintainer's machine
has the connection strings, and the Neon CLI is set up. No schema, no database
client, no change to the app or the API.

## Why this is its own batch

[5.1](p5-01-neon-database-plumbing.md) is the database plumbing, and it cannot
start: it depends on [4.4](p4-04-retire-github-pages.md), which depends on
[4.3](p4-03-cutover-to-vercel.md), which is waiting on Vercel Support's answer
about the Hobby non-commercial clause. Two of 5.1's six acceptance criteria need
a live production **and** a preview deployment answering `db: "ok"`, so 5.1
cannot pass its own gates yet.

Linking the project is the part of that work which needs none of it. It stores
no data, reads no data, and changes no behaviour. Every gate below is reachable
on a laptop.

This batch is the second recorded exception to the merge order, after rows 42
and 43. See [the hub](README.md).

**This batch does not store anything**, so it does not touch the DPA gate.
The owner still accepts Neon's and Vercel's data processing agreements in 5.1,
before any of the teacher's data reaches a server.

## Tasks

- [x] Install the Neon CLI globally (`neon` 4.21.0) and sign in. Browser OAuth;
      the credential lands in `~/.config/neon/credentials.json`.
- [x] `neon skills -y -a claude-code` — the seven Neon agent skills, into this
      directory. They install under `.claude/skills/`, which `.gitignore`
      already excludes, so they do not travel with the repository. The agent is
      named explicitly rather than letting `-y` install into every agent it
      detects.
- [x] `neon mcp -y --oauth -a claude-code` — the Neon MCP server, at user level
      in `~/.claude.json`. Two deliberate choices. **Global, not project:** a
      root `.mcp.json` would be tracked, and a single-maintainer repository does
      not need to ship an MCP server to anyone who clones it. **`--oauth`:** it
      writes the server URL only and mints no API key, so no long-lived Neon
      credential sits in a config file. The agent asks for sign-in on first use.
- [x] `neon link --project-id square-lab-10400131 --branch production -y --no-env-pull`. Writes `.neon` with the org, project and branch.
      `--no-env-pull` because that flag's default target is `.env`, and the
      secrets inventory names exactly one local file, `.env.local`.
- [x] Rewrite the `.gitignore` line the CLI appends. It adds a bare `.neon`
      after the last block; the rest of the file is commented, and the comment
      is where the reason lives. `skills-lock.json` is added in the same block.
- [x] `neon config init -s none`, then replace the scaffold with
      `defineConfig({})`. The scaffold declares `auth: false` and a branch TTL
      policy; an empty policy leaves every service unmanaged instead, which is
      what this batch wants. Move `@neon/config` and `@neon/env` from
      `dependencies` to `devDependencies` — nothing imports them, and the
      production set stays at `hono` and `@hono/node-server`.
- [x] Add `neon.ts` to the root `tsconfig.json`. Without it the file belongs to
      no TypeScript project and `npm run lint` fails with "was not found by the
      project service", which is the failure `eslint.config.mjs` already records
      for itself and for `scripts/`. Confirmed before fixing, not assumed.
- [x] `neon config plan` before `neon config apply`. Neon's own documents
      disagree about whether an empty policy is inert, so the dry run is the
      only honest way to know. It reported no changes; `neon deploy` then agreed.
- [ ] **Owner, when convenient:** approve the Neon MCP sign-in the first time an
      agent uses it. Nothing in this batch depends on it.

## Acceptance criteria

- [x] `neon config plan` reports no pending drift after `neon deploy`.
- [x] `.neon`, `.env.local` and `skills-lock.json` are all ignored;
      `git status` lists none of them. No `.env` was created.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and
      `check:pii` clean. The PII check read 130 files.
- [x] `npm run test:unit` — 339 passed.
- [x] `npm run test:e2e` — 188 passed **with `.env.local` present**, and 188
      passed with it renamed aside. Both were run, because the populated state
      is the one every later local run happens in, and the empty state is what
      CI and a fresh clone get. `api/one-function.test.ts` still sees exactly
      `["[...all].ts"]`.
- [x] After `npm run build:app`, grepping `app/dist` for `neon.tech`,
      `neon.com`, `-pooler` and `DATABASE_URL` returns nothing.

## Merge order and dependencies

Depends on 4.2 (the `api/` layout) and on the Neon project existing. Does **not**
depend on 4.3, 4.4 or the Support answer, because nothing here is switched on
and nothing is deployed. Deployable: yes — the app and the API are untouched.

Two things this batch deliberately does not decide. The preview-branch question
stays with 5.1, even though the project already carries a `vercel-dev` branch
beside `production`. The migration mechanism stays drizzle-kit in the Vercel
build command, as recorded on 2026-09-09; `neon.ts` describes branch and service
shape, not schema.

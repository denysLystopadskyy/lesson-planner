# Phase 6, server-first: her data moves from localStorage to Neon

## Resume here (state saved 2026-11-16 09:20 UTC)

**Rule (owner, 2026-11-16):** save this state before a usage limit can stop work. The session sees no percentages, only `rate_limit_info.status` (the weekly flag read `allowed_warning` at 09:16). So the orchestrator saves after **every** milestone: merge, child started or blocked, owner decision, Neon or Vercel write. It also saves at every check-in where the flag is not `allowed`. Each save updates this file, copies it to `docs/superpowers/plans/2026-11-15-phase-6-server-first.md` on branch `claude/practical-dijkstra-jq0hmt`, and pushes. The container is deleted after inactivity, so only the pushed copy survives.

**On resume:** read this section, then call `get_session` for each open child, `pull_request_read` for each open PR and `list_triggers`. Then continue from "Next" below.

| Item                    | State                                                                                                                                                                                                                                                                 | Next                                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 0                  | Done. Environment `lesson-planner` = `env_019899jD8Q8mMcETNdbmRqyT`, proven in a fresh container.                                                                                                                                                                     | —                                                                                                                                                                                                                                                                                |
| 6.0                     | **Merged** `2fa6b67` (PR #88).                                                                                                                                                                                                                                        | —                                                                                                                                                                                                                                                                                |
| 6.1 documents API       | Child `session_01SiYygkr8SMLYGAL7nwxwfy` (opus-5-5, high), branch `claude/p6-01-documents-api`. Red `437f268`. **Blocked:** a permission prompt for Prettier on `.claude/context/*.md`. The owner said "I approve it now".                                            | When its PR is open: subscribe, review session (opus-5-5, high), the owner's yes → Neon `prepare_database_migration` on a temporary branch of `production` (`br-polished-term-b1eassui`, project `square-lab-10400131`) → `complete_database_migration` → merge on green.        |
| 6.4 Backup menu         | Child `session_01SiYygonyWT5C3KthXBNRkj` (sonnet-5-5, medium). PR [#89](https://github.com/denysLystopadskyy/lesson-planner/pull/89), subscribed. `checks` is red only on the 7 `visual-layout` pixel snapshots (207 tests pass). The owner said "one-row banner OK". | **The owner** downloads `linux-baselines` from run `43829008272` with `gh run download` on the Mac, in a worktree, looks at the images, commits and pushes. Then: the child records the decision and image list on p6-04 → review session (sonnet-5-5, medium) → merge on green. |
| 6.2, 6.3, 6.5, 6.6, 4.3 | Not started.                                                                                                                                                                                                                                                          | In the merge order below.                                                                                                                                                                                                                                                        |
| Check-ins               | `trig_01CtV8cGoexri7Skm9Hoj3qy` at 10:06 UTC (6.1 + #89).                                                                                                                                                                                                             | Keep one fallback check-in while anything waits.                                                                                                                                                                                                                                 |
| Side task               | `task_a0a89170` (cause of the 10 local e2e anomalies) was suggested to the owner.                                                                                                                                                                                     | —                                                                                                                                                                                                                                                                                |

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, chosen below). Steps use `- [ ]`. Every code task: superpowers:test-driven-development, `Red:` commit then `Green:` commit, SHAs + failure message in the batch page's TDD log (CLAUDE.md; testing.md §1.5).

**Goal:** When the teacher is signed in with Google, Neon Postgres is the only store of her planner. Data found in the browser's localStorage is uploaded once, read back, compared, and only then removed. A CSV download and the JSON backup file are her local copies, both under one **Backup** menu.

**Architecture:** One Hono route set `GET/PUT /api/documents` in `api/[...all].ts`. It checks the Neon Auth JWT (EdDSA, JWKS) and the allowlist on every request, and stores one row per key (`data | settings | template`), keeping the 50 previous bodies. The client gets a remote mode: it loads from the API before the first paint, saves changed documents (debounced, retried, 409 → a dialog), and never writes planner keys to localStorage. Signed out, or a build without `VITE_NEON_AUTH_URL` (GitHub Pages), runs exactly as today.

**Tech stack:** React 19 + Vite 8, Hono 4.13, drizzle-orm 0.45 + `pg`, PGlite 0.5.8 for tests, `@neondatabase/auth` 0.5.0-beta, **new runtime dependency `jose`** (JWT verification), Vitest 5, Playwright 1.63.

**Spec:** the owner's request of 2026-11-15 and their four answers (below); [Neon Auth JWT doc](https://neon.com/docs/auth/guides/plugins/jwt) (token in `getSession().data.session.token`, EdDSA, `iss` = `aud` = origin of the auth URL, 15-minute expiry); the existing Phase 6 pages `docs/plan/p6-0*.md`; RP-07 §3–§6.

## Context

Phase 5 is done: Google sign-in through Neon Auth works on production, the `user.before_create` webhook enforces the allowlist, and `public` holds no tables. Review findings that shape this plan:

1. **The recorded Phase 6 is local-first** ("the local write is the commit; the server is the replica", storage-data-contract.md, state-management.md). The owner now decides the reverse: **Neon is the main storage; localStorage is cleaned after migration.** This is an architectural decision, so batch 6.0 records it in the context files (decision rule).
2. **The teacher still uses GitHub Pages** (4.3 not done). Her data lives in the `github.io` origin, which the Vercel site cannot read.
3. **No API route verifies a user session yet** (5.4 checklist row 13 is deferred to "the first route that reads user data"), and `jose` is only a transitive dependency.
4. **The deployed entry may import published npm packages only** (lessons 26 and 31). So the planned `shared/` validation module cannot be used by the entry; server validation is written inside the entry.
5. **Phase T is an entry criterion for Phase 6**, and T.4–T.10 are not merged. T.10's owner questions 1–5 all concern group ids and a local schema-version key; server-first removes both.
6. Open defects on the touched paths: **DEF-029** (the import promises an undo on an empty planner) and **DEF-030** (`Clear All Data` leaves `.pre-import.*` copies).

**Owner answers (2026-11-15):**

- **One move.** On cutover day she saves a backup on the old site, signs in on the new site, and loads the file straight into her account. The new site also uploads any localStorage data it finds on its own origin.
- **A failed save keeps the edit and retries.** The edit stays in memory, the indicator says so, it retries, and closing the tab warns.
- **Keep both CSV and JSON**, hidden under a **Backup** dropdown.
- **Start after the hourly limits restore** (see Launch).
- **Cloud environment:** create a personal `lesson-planner` environment. **Vercel:** use the Vercel MCP (connected; team access still needs approval). **Google OAuth:** use our own client, not Neon's shared one (Claude in Chrome is not available in a cloud session, so the steps are below). **Merging:** merge automatically when CI passes.
- **Phase 6 goes first;** T.4–T.9 run later in parallel, and T.10 is absorbed into 6.0. **R3, R4, R6 and R8 are high.** **Signed out, with sign-in available and no local data, the app shows only a sign-in screen.** **The documents migration reaches Neon production before 6.1 merges.**

## Environment and services, as checked on 2026-11-15

| Item                                | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Action                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud environment                   | "Default": limited network (package registries only), no setup script. Node 22.23, but the project pins 24.x. `node_modules` is not installed. Chromium is installed.                                                                                                                                                                                                                                                                                                                                                                              | **Step 0:** create the personal environment `lesson-planner` (`create_environment`, `switch_session: network_only`). It allows `lesson-planner-lac.vercel.app` and has a setup script that installs Node 24 and runs `npm ci`. I run the script here first and see it work; you approve the exact hosts and script. |
| Neon MCP                            | Signed in, ADMIN. Project `square-lab-10400131` ("Lesson Planner", aws-eu-central-1, Postgres 18, 6-hour restore window). Branch `production` (`br-polished-term-b1eassui`) is the default. Vercel makes one `preview/<git-branch>` branch from it for each preview.                                                                                                                                                                                                                                                                               | Reads are free; every write needs your yes.                                                                                                                                                                                                                                                                         |
| Neon Auth                           | On `production`. Google uses **shared** credentials. Email and password are off. The `user.before_create` webhook goes to production. The Organization plugin is on (not used). 19 trusted origins, most of them one per deployment.                                                                                                                                                                                                                                                                                                               | Own Google client (below). 6.6 reviews the Organization plugin and replaces the per-deployment origins with one wildcard.                                                                                                                                                                                           |
| Vercel MCP                          | Connected, but team `denys13` (`team_IT8dJuKLlecUKrHC0eu1pvun`) answers 403.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Step 0:** you approve team access through `authorize_team_access` (a single-use link). After that, read the project, env names and deployments.                                                                                                                                                                   |
| Vercel and Neon skills              | Loaded: `neon`, `neon-auth`, `neon-postgres`, `vercel:vercel-functions`, `vercel:env-vars`, `vercel:deployments-cicd`. ISTQB skills: not installed, so testing.md Part 1 is used instead.                                                                                                                                                                                                                                                                                                                                                          | —                                                                                                                                                                                                                                                                                                                   |
| Skill findings that change the plan | (1) A token comes from `authClient.token()` → `data.token`, or `getSession()` → `data.session.token`; check which one the installed `@neondatabase/auth` 0.5.0-beta has. (2) Sign-out does not revoke a JWT that was already issued; it lives up to 15 minutes. (3) On Vercel, attach the `pg` pool with `attachDatabasePool` from `@vercel/functions`, a published package. (4) Test a migration on a branch of production first, over the **direct** connection. (5) A function body is capped at 4.5 MB, so our 256 KB limit is well inside it. | Folded into 6.1 and 6.2.                                                                                                                                                                                                                                                                                            |

## Step 0 progress (2026-11-16)

- **Vercel access: done.** The owner approved team access. Project `lesson-planner` is `prj_a1AOBXV9FIpayrfAhlMzRiCV7825`.
- **Env variable names (read only; values never decrypted):**
  - production: `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, set by the Neon integration;
  - production and preview: `ALLOWED_EMAILS`, `NEON_AUTH_BASE_URL` and `VITE_NEON_AUTH_URL`;
  - preview: `DATABASE_URL` per git branch, set by the integration.
  - Everything 6.1 needs is present. **Finding for 6.6:** Vercel flags `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_AUTH_BASE_URL` as `readable-secret` (type `encrypted`, not `sensitive`). security-auth.md says "created as Sensitive", so the record or the setting is wrong.
- **Setup script, tested here:**
  - Node 24 works without touching the system Node: `npm install --prefix /opt/node24 node-linux-x64@24.22.3`, then link `/root/.local/bin/node`, which comes before `/opt/node22/bin` on PATH. Result: `node -v` → v24.22.3.
  - **`npm ci` fails with npm 10.9.9** (`Cannot read properties of null (reading 'edgesOut')`). CI uses the Playwright image, which ships Node 24 with npm 11. So the script also installs `npm@11` (11.21.2) under `/opt/node24` and links `/root/.local/bin/npm`. Then `npm ci` runs again and must succeed before the environment is proposed.
  - Playwright 1.63 needs its own browser build. If the pre-installed Chromium does not match, the baseline uses `executablePath: '/opt/pw-browsers/chromium'` in a scratchpad config only, never in the repository.
- **Script test passed on 2026-11-16, from a clean state** (`/opt/node24`, `/opt/npm11` and `node_modules` removed first): node v24.22.3, npm 11.21.2, `npm ci` installed 305 packages. Node and npm must live in **two separate prefixes**, because a second `npm install --no-save` into the same prefix removes the first package. npm 11.21 skips esbuild's postinstall (its "install-scripts" approval); `require('esbuild')` still works, and the baseline suite will show whether the build does. The script to propose, unchanged:
  ```bash
  #!/bin/bash
  set -euo pipefail
  # Node 24 and npm 11, as in CI's Playwright image. The system Node 22 stays.
  npm install --prefix /opt/node24 --no-save --no-audit --no-fund node-linux-x64@24.22.3
  npm install --prefix /opt/npm11 --no-save --no-audit --no-fund npm@11.21.2
  mkdir -p /root/.local/bin
  ln -sf /opt/node24/node_modules/node-linux-x64/bin/node /root/.local/bin/node
  ln -sf /opt/npm11/node_modules/npm/bin/npm-cli.js /root/.local/bin/npm
  ln -sf /opt/npm11/node_modules/npm/bin/npx-cli.js /root/.local/bin/npx
  export PATH=/root/.local/bin:$PATH
  if [ -d lesson-planner ]; then (cd lesson-planner && npm ci --no-audit --no-fund); fi
  ```
  The environment proposal: personal, named `lesson-planner`, repository `denyslystopadskyy/lesson-planner`, allowed host `lesson-planner-lac.vercel.app`, package managers and MCP servers on, `switch_session: network_only`.
- **Environment created on 2026-11-16:** `lesson-planner` = `env_019899jD8Q8mMcETNdbmRqyT` (personal; allows `lesson-planner-lac.vercel.app`; the setup script above is saved). This session moved onto its network. The script has not run in a fresh container yet, so the first child session proves it; its first message must report `node -v` and the result of `npm ci`. Child sessions use `environment_id: env_019899jD8Q8mMcETNdbmRqyT`.
- **Production answers (2026-11-16):** `GET /api/health` → `{"ok":true,"commit":"7f3f406…","region":"fra1","db":"ok","auth":"ready"}`. The commit is `main`.
- **Baseline on `main` at `7f3f406` in this container (2026-11-16):** `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api` and `check:pii` → all exit 0. `test:unit` → 454 / 454 pass (15 files). `test:e2e` → 194 pass and **10 fail**. CI is **green on the same commit** (run 181, the same 204 tests), so these 10 are container anomalies, not regressions:
  - `visual-layout.spec.ts` (7 pixel snapshots, about 1% of pixels differ; the baselines are rendered in CI's image);
  - `backup-round-trip.spec.ts:159`, `:185`, `:221` (after export, the import's `setInputFiles` fires no confirm dialog; deterministic with `--workers=1`; `:292` passes).
  - A separate task is suggested to find the cause (`task_a0a89170`). **Rule for children:** locally, these 10 may fail. Any other failure is real. CI is the judge.
- **GitHub push (2026-11-16):** the plan commit `352f561` on `claude/practical-dijkstra-jq0hmt` was refused with 403 ("Claude doesn't have GitHub access … for your organization"). The owner has now installed the Claude GitHub App. Next: retry `git -c push.negotiate=true push -u origin claude/practical-dijkstra-jq0hmt`. If it is still 403, the owner reconnects GitHub at claude.ai and a new session may be needed.
- **Which sessions use the environment:** every child session is created with `environment_id: env_019899jD8Q8mMcETNdbmRqyT`. Sessions the owner starts by hand pick `lesson-planner` from the environment menu; the Default environment stays unchanged.
- **Still to do in Step 0:** push → → commit this plan into the repo (`docs/superpowers/plans/2026-11-15-phase-6-server-first.md`, on `claude/practical-dijkstra-jq0hmt`) → start the 6.0 child session.

## Batch 6.0 progress (2026-11-16)

- Child `session_01SiYygoJVFPwKSvQ5gSMwuU` finished. It opened PR [denysLystopadskyy/lesson-planner#88](https://github.com/denysLystopadskyy/lesson-planner/pull/88): 29 files, 1,185 links, 0 broken. **The setup script is proven in a fresh container:** Node v24.22.3, npm 11.21.2, 305 packages. CI: `checks` ✓, `tdd-evidence` ✓.
- **Owner answers to the child's questions (2026-11-16):**
  1. The Backup menu ships to both builds, Pages included.
  2. **RP-09 AC 23 moves to the server:** the API refuses a `PUT` whose `schemaVersion ≠ 1` (6.1 C5), and the Phase 6 gate lists AC 23 as met by that test. The PR must change its "no longer applies" text before merge.
  3. The `lessons-learned.md` rewrite stays an open T.10 remainder with Phase T.
  - Child questions 4 (DEF-029 and DEF-030 rows have 4 cells for 7 columns, as before) and 5 (R-ratings recorded as likelihood 2–3, impact 3): accepted as written.
- **Done:** the child pushed `c1e344d` (AC 23 moved to the server, Backup-menu decision recorded). CI on `c1e344d`: `checks` ✓, `tdd-evidence` ✓, `mergeable_state: clean`. The review session `session_01SiYygmy5B8RZL1ymtH9GrV` (claude-sonnet-5-5, medium, read only) started at 07:21 UTC. **Next:** read its final message; if it says "No blocking findings.", squash-merge #88, unsubscribe, and start 6.1 and 6.4. If there are blocking findings, send them to the 6.0 child to fix first.
- **Review result (07:24 UTC):** no blocking findings on facts, links or personal data, but two blocking items:
  - **B1:** the repository copy of this plan (`docs/superpowers/plans/…`) has the gate "AC 18, 19 and 21" and lacks the 2026-11-16 answers, while README lists AC 23. Fix: add the 2026-11-16 answers to the plan copy, and AC 23 to its gate.
  - **B2:** `storage-data-contract.md:144-150` still gives `documents(…, client_updated_at)` with only "The shape changed on 2026-11-15". Fix: mark it **Superseded on 2026-11-15**, like the bullets beside it.
  - Optional fixes to include:
    - O3: drop the claim that 6.1 aligns `test-data.ts` (no batch touches it yet);
    - O4: README:90, add "(see 2026-11-15 below)";
    - O5: pt-10:11, say that only the lessons rewrite has not started;
    - O6: p6-00 results, state the link-counting rule.
  - O7 (infrastructure ids in the plan copy): kept. They are not secrets, and the plan needs them for the child sessions.
  - **Next:** `send_message` to the 6.0 child with B1, B2 and O3–O6 → push → CI green → merge without a second review, because the fixes are narrow and the reviewer named them exactly.
- **Earlier step:**
  - `send_message` to the 6.0 child: change the AC 23 wording and the gate on p6-00/p6-01/README, push.
  - `subscribe_pr_activity` #88 → review session (`claude-sonnet-5-5`, medium: facts and links) → merge on green with no open finding.
  - Then start 6.1 and 6.4.

## Batches 6.1 and 6.4 progress (2026-11-16, 08:56 UTC)

- **6.0 merged** as `2fa6b67` (PR #88).
- **6.1** (`session_01SiYygkr8SMLYGAL7nwxwfy`): Red committed as `437f268`. Blocked since 08:11 on a permission prompt (Prettier on `.claude/context/*.md`, a sensitive path). **Owner approves it in that session** (2026-11-16).
- **6.4** (`session_01SiYygonyWT5C3KthXBNRkj`): PR [#89](https://github.com/denysLystopadskyy/lesson-planner/pull/89). Red `e15f049`, Green `9aafd6d`, plus `7ae271a` (page) and `4b82ae6` (geometry check).
  - **Owner (2026-11-16): the one-row banner is OK**, so the changed visual-layout check stays.
  - **Baselines:** run `43829008272` (mode `changed`, on `4b82ae6`) succeeded and uploaded `linux-baselines`. No cloud session can download it: the artifact storage host is blocked, and `gh` is limited to search here. As before (testing.md §2.6 loop), **the owner downloads, looks at and commits them on the Mac, in a worktree** (never in the main checkout):
    ```bash
    cd /Users/denyslystopadskyy/IdeaProjects/lesson-planner
    git fetch origin claude/p6-04-backup-menu
    git worktree add ../lesson-planner-6-4 -b claude/p6-04-backup-menu origin/claude/p6-04-backup-menu
    cd ../lesson-planner-6-4
    gh run download 43829008272 -n linux-baselines -D e2e/features/visual-layout.spec.ts-snapshots/
    git status
    git add e2e/features/visual-layout.spec.ts-snapshots/
    git commit -m "Update the pixel baselines for the Backup menu"
    git push
    ```
    The owner's push starts CI, which compares the committed images again; that is the check.
  - **Next for 6.4:** after the owner's push and green CI → review session (`claude-sonnet-5-5`, medium) → merge.
- **Next for 6.1:** after the owner's approval it continues. When its PR is open → review session (`claude-opus-5-5`, high) → the owner's yes for the Neon migration → merge.

## Google OAuth: our own client (owner steps, before 4.3)

**Status 2026-11-15:** steps 1–6 are done. `get_neon_auth_config` on `production` shows `google` with `type: "standard"` and the owner's own Client ID; the secret is redacted. **Step 7 passed on 2026-11-15:** the owner signed in on production with the new client and came back signed in, so the existing user still matched. **Accepted, known behaviour (owner, 2026-11-15):** Google's consent screen says "Увійдіть у додаток neon.tech" ("Sign in to neon.tech"). The line comes from the redirect host, which Neon owns. Brand verification needs a domain we own, and there is no custom domain. 6.0 records this in security-auth.md. The 4.3 teacher steps, line 2, tell her the Google screen names neon.tech and that this is expected.

Recorded in security-auth.md in 6.0, replacing 5.5's "shared credentials" decision. Never paste the client secret into chat.

1. Open https://console.cloud.google.com and create a project, for example "Lesson Planner".
2. **Google Auth Platform → Branding:** set the app name ("Lesson Planner"), your support e-mail and the developer contact. Under **Authorized domains**, add `vercel.app` if Google accepts it (it may not, because `vercel.app` is a public suffix; then leave it empty).
3. **Audience:** choose **External**. The app asks only for the basic scopes (`openid`, `email`, `profile`), which are non-sensitive. Choose **Publish app → In production**, so the teacher sees no "Testing" warning. If Google asks for verification, check the **Verification Center**. Without brand verification, the consent screen may show the host name instead of the app name, but sign-in still works.
4. **Data access:** keep only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
5. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `https://lesson-planner-lac.vercel.app`
   - **Authorized redirect URIs:** `https://ep-blue-leaf-b1tc3hq3.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth/callback/google`

   Copy the redirect URI from Neon's dialog in step 6 rather than from here, in case it differs.

6. Copy the Client ID and Client secret. In the **Neon Console**, open the project "Lesson Planner", branch **production** → **Settings → Auth → OAuth providers → Google → ⋮ → Configure**, paste both values, and choose **Update**. The "Shared credentials" badge disappears.
7. Tell me "done". I check `get_neon_auth_config` (read only): `type` must no longer be `shared`. Then you sign in on production once and I record the result. Preview branches keep Neon's shared credentials; that is acceptable, because only you use previews.

## Decisions this plan records (batch 6.0, in the context files)

| Decision                                                                                                                                                                                                                                                                                                                                                              | File                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Server-first replaces local-first when signed in. With no auth URL (the GitHub Pages build), the app is unchanged (local mode). With sign-in available and signed out: local data present → local mode, as today, until she signs in and the move runs; no local data → **a sign-in screen only** (owner, 2026-11-15).                                                | storage-data-contract.md, state-management.md |
| Google sign-in uses our own OAuth client on `production`, replacing 5.5's shared credentials. Previews keep the shared ones.                                                                                                                                                                                                                                          | security-auth.md                              |
| Merging: when CI is green I merge the PR myself, through the PR-activity subscription. GitHub auto-merge stays off: `main` has no required checks, so GitHub would merge at once, and CLAUDE.md forbids it.                                                                                                                                                           | deployment.md                                 |
| Old 6.1 is dropped: no group ids, no `groupLessonPlannerSchemaVersion` key, no `groupLessonPlannerSync` key. The version lives on the server row (`schema_version = 1`), and the backup envelope stays at 1. This resolves T.10 questions 1–5 by removing their premise.                                                                                              | storage-data-contract.md                      |
| After a verified upload, the client removes every planner key on its origin: the 3 data keys, `groupLessonPlannerLastBackup`, and every `.pre-import.*`, `.pre-v*.*` and `.corrupt.backup` copy. Keys of other owners (Neon Auth) stay.                                                                                                                               | storage-data-contract.md                      |
| Remote mode loads before the first paint (a gate). This supersedes "hydration is an action, not a gate".                                                                                                                                                                                                                                                              | state-management.md                           |
| The entry verifies the JWT with `jose` (`createRemoteJWKSet`, `algorithms: ['EdDSA']`, issuer and audience = `new URL(NEON_AUTH_BASE_URL).origin`). `user_id` = `sub`. The allowlist is checked on `email` on every request and fails closed.                                                                                                                         | security-auth.md, backend.md                  |
| Validation is written inside the entry; `shared/` is not created (lesson 31). A parity test runs the app's fixtures through both validators.                                                                                                                                                                                                                          | backend.md                                    |
| Body limit is 256 KB. There is no rate limit in code: only allowlisted people get past the first check, and Hobby has no shared state for a counter. 6.6 re-checks this.                                                                                                                                                                                              | security-auth.md                              |
| Conflicts: `PUT` carries `baseUpdatedAt`. A mismatch is a 409 with the server copy; a person chooses, and nothing is merged automatically.                                                                                                                                                                                                                            | storage-data-contract.md                      |
| The old origin (GitHub Pages) keeps its copy as the rollback until 4.4. At the end of the window, 4.4 adds "Remove my data from this old site" to the moved banner.                                                                                                                                                                                                   | deployment.md, p4-04                          |
| Phase T gate: the owner moves Phase 6 ahead of T.4–T.9 (2026-11-15). These stay open and run in parallel. T.10 is absorbed into 6.0.                                                                                                                                                                                                                                  | plan hub                                      |
| Product risks R3, R4, R6 and new **R8** ("moving her data loses or doubles it, or deletes the local copy before the server copy is confirmed") are rated **high** by the owner (likelihood 2 or 3 × impact 3, 2026-11-15): 3-value BVA, all transitions, a fault-seeding table, and a person checks on production.                                                    | testing.md §1.8                               |
| Database migrations: test on a temporary branch of `production` (Neon MCP `prepare_database_migration`), then apply to `production` (`complete_database_migration`) **before** the batch that needs the tables merges. Previews inherit the tables. This resolves backend.md's TBD on preview branches: one branch per preview, made by the integration.              | backend.md, deployment.md                     |
| e2e sessions: `scripts/serve.mjs` (never deployed) makes a throwaway Ed25519 key per process. It serves `/__neon-auth/.well-known/jwks.json` and a local-only `POST /__neon-auth/__test/mint`. The Playwright webServer sets `ALLOWED_EMAILS=planner-e2e@example.test`. Each test mints a token with a **unique `sub`**, so parallel workers never share server rows. | testing.md §2.9                               |

## Global constraints

- Plain B2 English in docs. TypeScript strict, no `any`, `cx()` for classes, kebab-case files.
- `api/[...all].ts` imports only published npm packages. `api/deployed-entry.test.ts` and `api/one-function.test.ts` stay green (one function).
- The 7 frozen testids stay. New testids are added in the same commit as `testid-contract.spec.ts` and testing.md §2.2.
- Button labels the teacher's steps quote stay unchanged: **Save Backup**, **Load Backup**, **Sign in with Google**, **Edit Template**.
- Every batch page starts from `docs/plan/batch-template.md`, with all sections filled.
- Merge only on green CI. Never auto-merge. Run all three typechecks locally. Stop any `npm run serve` before running the suite.
- MCP writes (Neon migrations, Vercel env) need the owner's yes in the chat.
- Remote mode writes **no** planner key to localStorage, ever (an e2e check in 6.2).

## Review focus (failure modes no task names directly; each has its test in the owning task)

1. **The token expires mid-session (15 min).** A 401 on `PUT` → get a fresh token once and retry → then the sign-in prompt. The edit is kept (6.2, `remote-save.spec.ts`).
2. **Two tabs or two devices.** The second save gets a 409 → the dialog names both sides, and nothing is lost silently (6.2).
3. **The tab closes during the debounce or a retry.** The `beforeunload` warning fires (6.2).
4. **The upload stops halfway** (data saved, template failed). The local copy stays. The next sign-in shows the choose dialog, not a silent overwrite (6.3).
5. **The session ends while she is working** (the token expires or she signs out in another tab). The next save gets a 401, and the refresh fails. The edit stays on screen with "Sign in to save". After she signs in again, the save goes through; the app does not drop to the sign-in screen with unsaved edits (6.2/6.3).

---

## Batch 6.0 — Record server-first and rewrite the Phase 6 pages (docs only)

**Files:** the context files above; `docs/plan/README.md` (new section "What changed on 2026-11-15", new merge-order rows, Phase 6 gate); replace `p6-01…p6-05` with new pages `p6-00`…`p6-06` on the template (old pages stay in git history, links updated); `p4-03-cutover-to-vercel.md` (new teacher steps, see 4.3 below); `p4-04-retire-github-pages.md` (old-site cleanup task); `pt-10-…md` (marked "absorbed into 6.0", each finding resolved or moved); `def-registry.md` (DEF-029 and DEF-030 routed to 6.3 for remote mode); testing.md §1.8 (R8) and §2.9 (the e2e session rule); `e2e/features/testid-contract.spec.ts` comment "8" → "7" (T.10 item 9, test code).

- [ ] Write the decisions table into the named files. Mark superseded rules **Superseded on 2026-11-15** and keep them for the history, as the files already do.
- [ ] Each new batch page lists its test conditions (level, type, technique, coverage items) as given below.
- [ ] TDD log: **Exception: docs only.** Run a link check of the whole repository (no broken relative links), then `format:check`.
- [ ] PR → green → merge.

## Batch 6.1 — Documents API

**Files:** Modify `db/schema.ts`, generate `db/migrations/0000_*.sql` (`npm run db:generate`), modify `api/[...all].ts`, `package.json` (+`jose`), `scripts/serve.mjs`, `playwright.config.ts` (webServer env), `.env.example`. Tests: `api/documents.test.ts`, `api/validation-parity.test.ts`, `e2e/features/api-documents.spec.ts`, `e2e/ui/support/session-token.ts`.

**Interfaces (produces):**

- Tables: `documents(user_id text, key text check in ('data','settings','template'), body jsonb null, schema_version int not null, updated_at timestamptz not null, primary key (user_id, key))`. `document_versions(id bigserial pk, user_id, key, body jsonb, schema_version, updated_at, saved_at timestamptz default now())` with an index on `(user_id, key, saved_at desc)`. The entry queries with drizzle `sql` templates only. It does not import the schema, because of lesson 31; the PGlite tests run the real migration, so drift fails a test.
- `GET /api/documents` → `200 {documents: {data|settings|template: {body, schemaVersion, updatedAt} | null}}`.
- `PUT /api/documents/:key` with body `{body, schemaVersion: 1, baseUpdatedAt: string | null}`:
  - success → `200 {updatedAt}`, after copying the old row into `document_versions` and pruning it to 50 (in one transaction);
  - stale or null base while a row exists → `409 {document}`;
  - unknown key, bad shape or `schemaVersion ≠ 1` → `400 {error}`;
  - more than 262 144 bytes → `413`;
  - no or invalid token → `401`; not allowlisted → `403`.
- Exported for tests: `verifyUserToken(token: string, baseUrl: string): Promise<{sub: string; email: string} | null>`, `validateDocument(key: DocumentKey, body: unknown): boolean`, `type DocumentKey = "data" | "settings" | "template"`.
- `scripts/serve.mjs`: throwaway Ed25519 key, JWKS route, `POST /__neon-auth/__test/mint {sub, email}` → `{token}`. `e2e/ui/support/session-token.ts`: `mintToken(request, {sub?, email?}): Promise<string>`, with a unique `sub` per call by default.

**Test conditions:**

| ID  | Condition               | Level                 | Technique                                 | Coverage items                                                                                                                                                                                          |
| --- | ----------------------- | --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Token check             | component integration | decision table                            | valid; expired; wrong `iss`; wrong `aud`; wrong alg; unknown `kid`; bad signature; missing header (8 rules)                                                                                             |
| C2  | Allowlist per request   | component integration | equivalence partitioning                  | listed; listed with other case or spaces; not listed; list empty → 403                                                                                                                                  |
| C3  | Isolation (RP-09 AC 21) | component integration | CRUD                                      | user B cannot read, overwrite or version user A's rows (CRUD matrix cells)                                                                                                                              |
| C4  | Optimistic concurrency  | component integration | state transition                          | no row + null base → 200; row + same base → 200; row + stale base → 409 with copy; row + null base → 409                                                                                                |
| C5  | Validation              | component integration | equivalence partitioning + error guessing | one invalid value per case: non-array data, group with no name, price not a number, date not `YYYY-MM-DD`, settings with no currency, template not a string or null, unknown key, schemaVersion 0 and 2 |
| C6  | Version cap             | component integration | 3-value BVA                               | 49, 50, 51 previous versions → keeps 50                                                                                                                                                                 |
| C7  | Body limit              | component integration | 3-value BVA                               | 262 143, 262 144, 262 145 bytes                                                                                                                                                                         |
| C8  | Validation parity       | component             | checklist                                 | each `e2e/fixtures/storage/*.json` is accepted by both validators; each C5 invalid case is refused by the entry                                                                                         |
| C9  | Over HTTP               | system                | scenario-based                            | mint → PUT → GET returns the same body; no token → 401                                                                                                                                                  |

- [ ] Red: write the tests above, plus a stub entry where the routes answer 501 and `verifyUserToken` throws "not implemented". Run `npm run test:unit -- api/documents.test.ts` → it fails on its assertions. Commit `Red: documents API …`.
- [ ] Green: implement the routes. Generate the migration. Add the dev-server key/JWKS/mint and the `ALLOWED_EMAILS` env. Run `npm run test:unit`, `npm run test:e2e`, and the three typechecks. Commit `Green: …`.
- [ ] Fault seeding (high risk): drop `WHERE user_id = …` from GET; skip the `aud` check; prune to 51. Record which tests fail.
- [ ] Wire the `pg` pool with `attachDatabasePool` from `@vercel/functions`. This is a published package; add it as a runtime dependency, and `deployed-entry.test.ts` must still resolve every import.
- [ ] **Before merge, with the owner's yes in chat (MCP write):** run `prepare_database_migration` with the generated SQL on a temporary branch of `production`, then `describe_table_schema` for both tables. On success, run `complete_database_migration` to apply it to `production`. Record both operation ids. The tables stay empty and unread until 6.2.
- [ ] After merge, on a preview (`web_fetch_vercel_url`): `GET /api/documents` without a token → 401, and `/api/health` → `db: ok`. This is a system integration test, recorded on the page.
- [ ] PR → green → merge.

## Batch 6.2 — Remote mode in the store

**Files:** Create `app/src/documents-api.ts`, `app/src/remote-sync.ts`, `app/src/RemoteGate.tsx`, `app/src/SyncIndicator.tsx` (+ module CSS), `app/src/ConflictDialog.tsx`. Modify `app/src/auth-client.ts`, `app/src/store.ts`, `app/src/StoreProvider.tsx`, `app/src/main.tsx`, `app/src/App.tsx`, `app/src/AccountView.tsx` (text: "Your planner is saved in your account"), `app/src/route.ts` and `app/src/types.ts` (the stale "Phase 4" comments, T.10 item 8). Tests: `app/src/remote-sync.test.ts`, `app/src/store.test.ts`, `app/src/documents-api.test.ts`, `e2e/features/remote-save.spec.ts`, `e2e/features/remote-load.spec.ts`; `e2e/ui/support/sign-in.ts` (`stubSession` returns `session.token` from `mintToken`); `e2e/ui/fixtures/test.ts` (new option `serverState`, seeded through the API).

**Interfaces:**

- `auth-client.ts`: `getAccessToken(): Promise<string | null>` (`client.getSession()` → `data?.session.token ?? null`).
- `documents-api.ts`:
  - `fetchDocuments(token): Promise<ServerDocuments>`;
  - `putDocument(token, key, body, baseUpdatedAt): Promise<{kind: "saved"; updatedAt} | {kind: "conflict"; document: RemoteDocument}>`;
  - other failures throw `ApiError {status: number}`;
  - `type RemoteDocument = {body: unknown; schemaVersion: number; updatedAt: string}`, `type ServerDocuments = Record<DocumentKey, RemoteDocument | null>`.
- `remote-sync.ts` (pure):
  - `documentsOf(state): Record<DocumentKey, unknown>`;
  - `changedKeys(current, lastSaved): DocumentKey[]` (compares serialized strings);
  - `retryDelayMs(attempt: number): number` → 1000, 2000, 5000, 10000, then 30000 for every later attempt;
  - `loadedFromServer(docs: ServerDocuments): LoadedData`.
- `store.ts`: `PlannerState.sync: {status: "off" | "saving" | "saved" | "retrying" | "conflict"; savedAt: string | null; conflict: {key: DocumentKey; document: RemoteDocument} | null}`. New actions: `remote/saving`, `remote/saved {at}`, `remote/failed`, `remote/conflict {key, document}`, `remote/resolved`. `pendingReducer` stays exhaustive.
- `StoreProvider` gets `persistence: {kind: "local"} | {kind: "remote"; getToken: () => Promise<string | null>; initial: ServerDocuments}`:
  - local → today's subscriber, unchanged;
  - remote → no localStorage write. A 1 s debounce PUTs `changedKeys`, retries with `retryDelayMs` and on the `online` event, and adds a `beforeunload` guard while the status is not `saved`/`off` or a debounce is pending;
  - a 401 → one fresh token and one retry, then `retrying` plus the sign-in prompt.
- `RemoteGate`: when signed in, shows "Loading your planner…" until `fetchDocuments` answers, then mounts `StoreProvider` in remote mode. If loading fails, it shows an error with **Try again**. In 6.2 it takes the server data as it is; the local-data decision arrives in 6.3.
- `SyncIndicator` (`#syncIndicator`): "Saving…" / "Saved HH:MM" / "Not saved — retrying" / "Changed on another device". Shown only in remote mode. The "Last backup" indicator is hidden in remote mode.
- `ConflictDialog`: names both sides (counts and time), with **Keep this screen** (PUT with the server's `updatedAt` as base) or **Use the saved version** (`backup/restore` from the server copy).

**Test conditions:**

| ID  | Condition                                            | Level               | Technique                         | Coverage items                                                                                |
| --- | ---------------------------------------------------- | ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| C1  | `retryDelayMs`                                       | component           | 3-value BVA                       | attempts 0, 1, 3, 4, 5, 100                                                                   |
| C2  | `changedKeys`                                        | component           | decision table                    | none, one, all three changed; template null ↔ string                                          |
| C3  | Sync status machine                                  | component (reducer) | state transition, all transitions | off→saving→saved, saving→retrying→saving, saving→conflict→resolved, plus invalid ones ignored |
| C4  | A wiped profile restores by signing in (RP-09 AC 18) | system              | scenario-based                    | server seeded, local empty → groups shown                                                     |
| C5  | Remote mode never writes localStorage                | system              | checklist                         | after an add, an edit, a template save and Clear All → no planner key                         |
| C6  | Offline keeps the edit (AC 19)                       | system              | state transition                  | `setOffline(true)` → "Not saved — retrying", no advance; online → "Saved"                     |
| C7  | Review focus 1–3                                     | system              | error guessing                    | 401 then success; 409 dialog; `beforeunload` dialog fires                                     |
| C8  | Signed out is unchanged                              | system              | regression                        | the full existing suite, signed out                                                           |

- [ ] Red: unit tests + e2e specs, with stubs for the new modules (throwing "not implemented"). Commit `Red: …`. Log the command, e.g. `npm run test:unit -- app/src/remote-sync.test.ts`.
- [ ] Green: implement. Update `sign-in.spec.ts` for the remote empty state (regression). Commit `Green: …`.
- [ ] Record on state-management.md whether trigger 2 fired (needs middleware?); expected answer: no.
- [ ] Fault seeding: indicator advances before the server answers; the debounce never flushes; the 401 retry loops forever.
- [ ] PR → green → merge.

## Batch 6.3 — Move local data into the account, then clean localStorage

**Files:** Create `app/src/migration.ts`, `app/src/MoveDataDialog.tsx`, `app/src/SignInScreen.tsx` (+ CSS module). Modify `app/src/storage.ts` (`clearLocalPlannerData`, `readLocalSnapshot`), `app/src/RemoteGate.tsx`, `app/src/App.tsx` (import, CSV import and Clear All in remote mode). Tests: `app/src/migration.test.ts`, `app/src/storage.test.ts`, `e2e/features/move-local-data.spec.ts`, `e2e/features/remote-import.spec.ts`, `e2e/features/sign-in-screen.spec.ts`.

**The start decision, before anything renders** (`app/src/start-mode.ts`, pure): `startMode({authAvailable, signedIn, isPending, localIsEmpty}): "local" | "sign-in" | "loading" | "remote"`, a decision table.

- No auth URL → local.
- Session still pending → loading.
- Signed in → remote (through `RemoteGate`, which then runs `decideStart`).
- Signed out, local data present → local.
- Signed out, no local data → sign-in.

`SignInScreen` (`data-testid="sign-in-screen"`, a new testid, added to the contract) shows the app name, one line ("Sign in to open your planner") and **Sign in with Google**.

**Regression cost, taken in this batch:** the serve build has an auth URL, so every signed-out spec that starts with an empty planner now meets the sign-in screen.

- The fixture changes: when `signedIn` is true, `plannerState` seeds the **server** (through the minted token), not localStorage.
- Specs that start empty switch to `signedIn: true`.
- Specs about the local contract (`storage-contract`, `storage-guards`, `backup-round-trip`, the CSV specs and `moved-banner`) keep a seeded localStorage, so they still run in local mode.
- The pixel baselines that start empty are re-rendered through `baselines.yml`.
- List each spec that changes on the page (impact analysis).

**Interfaces:**

- `migration.ts`:
  - `type LocalSnapshot = LoadedData & {isEmpty: boolean}`; empty means no groups **and** template null;
  - `decideStart(local: LocalSnapshot, server: ServerDocuments): "use-server" | "upload" | "choose" | "clear-local"`. `clear-local` is for both sides equal by `fingerprintOf`;
  - `uploadAndVerify(local, getToken): Promise<{ok: true} | {ok: false; error: string}>` PUTs all three, GETs them back, and compares `fingerprintOf` (from `backup.ts`) with the local data. It clears nothing.
- `storage.ts`: `clearLocalPlannerData(): WriteResult` removes the keys listed in the decisions table and nothing else. `readLocalSnapshot(): LocalSnapshot`.
- `MoveDataDialog`:
  - **upload**: shows the counts from `countsLine`, with **Move to my account** and **Download a backup first**;
  - **choose**: shows both sides' counts, with **Keep my account's data** / **Replace with this browser's data**, each with a backup link first.
- Remote-mode import: Load Backup and Load CSV confirm "This replaces the planner in your account". Undo keeps the previous state **in memory** for the session, not in localStorage. This fixes DEF-029 in remote mode (undo works on an empty planner) and removes DEF-030's cause there. Local mode is unchanged; the DEF rows say so.

**Test conditions:**

| ID  | Condition                    | Level              | Technique                         | Coverage items                                                                                                    |
| --- | ---------------------------- | ------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| C1  | `decideStart`                | component          | decision table                    | local empty/non-empty × server empty/non-empty × equal/different (5 feasible rules)                               |
| C2  | `clearLocalPlannerData`      | component          | equivalence partitioning          | each planner key class removed; a foreign key kept; prefixed staging keys handled                                 |
| C3  | Upload happy path            | system             | scenario-based                    | dialog → move → server holds the data → localStorage holds no planner key                                         |
| C4  | Clear only after verify (R8) | system + component | error guessing + fault seeding    | PUT fails; GET read-back differs; template PUT fails after data PUT → local untouched, message shown              |
| C5  | Both sides have data         | system             | scenario-based                    | both choices; backup download offered first                                                                       |
| C6  | Import in remote mode        | system             | scenario-based                    | JSON and CSV import go to the server; undo restores, on an empty and a non-empty planner                          |
| C7  | Teacher's cutover path       | system             | scenario-based                    | signed in, empty account, Load Backup file → server holds her counts (the 4.3 steps as a spec)                    |
| C8  | `startMode`                  | component          | decision table                    | the 5 rules above, plus pending with local data                                                                   |
| C9  | Sign-in screen               | system             | state transition, all transitions | signed out + empty → screen; sign in → remote; sign out → screen; signed out + local data → local mode, no screen |

- [ ] Red → Green as above. Fault seeding table: clear before verify; compare only the group count; skip the template in the read-back.
- [ ] DEF-029 and DEF-030 rows: record "fixed in remote mode in 6.3; local mode retires with Pages in 4.4" (confirmation tests lose `test.fixme` where they exist).
- [ ] PR → green → merge.

## Batch 6.4 — The Backup menu

**Files:** Modify `app/src/Toolbar.tsx` (+ CSS module), `e2e/ui/pages/PlannerPage.ts` (its `saveCsv`, `loadCsv`, `saveBackup`, `loadBackup` open the menu first, so specs stay unchanged). Tests: `e2e/features/backup-menu.spec.ts`; `a11y.spec.ts` gains the open menu.

- A disclosure button **Backup ▾** (`#backupMenuBtn`, `aria-expanded`, `aria-controls`). It reveals the four existing buttons with their ids and labels unchanged: Save CSV, Load CSV, Save Backup, Load Backup. Esc and an outside click close it, and focus returns to the button.
- Test conditions: C1 state transition (closed→open→closed by click, Esc, outside, action, all transitions); C2 checklist (keyboard, focus return, axe on the open menu); C3 regression (the CSV and backup specs through the page objects).
- [ ] Red → Green. Re-render pixel baselines with the `baselines.yml` workflow (manual dispatch), then commit them.
- [ ] PR → green → merge.

## Batch 6.5 — Recovery drills and erasure (old 6.4, re-pointed)

- **Delete my account and data** on the account view, behind a confirmation that names what goes. `DELETE /api/documents` removes the documents and versions rows for `sub`; the Neon Auth user is then deleted through the client SDK. Check the `@neondatabase/auth` method in Neon docs first; if none exists, the owner deletes the user with `delete_auth_user` and the page records that.
- Drills on test data, recorded with date and result:
  - A: sign in on a wiped profile;
  - B: JSON import into the account;
  - C1: restore from a `document_versions` row (a developer SQL runbook in backend.md);
  - C2: Neon restore window on a branch;
  - erasure.
- Retention stays `TBD` with its owner (the accountant). Neon's 90-day inactivity question goes to the owner.
- Tests: an erasure route in `api/documents.test.ts` (CRUD delete cells, isolation) and `e2e/features/account-erasure.spec.ts`.

## Batch 6.6 — Data-layer security check and close-out (old 6.5)

- Re-check rows 13–17 and 20–22 of the 5.4 checklist on production:
  - every documents query is scoped by `sub` (read the code, then run the two-user test with two test tokens on a preview);
  - the 256 KB limit is observed;
  - the version cap holds;
  - the no-rate-limit decision is re-read.
- `npm audit`, Dependabot, `@neondatabase/auth` and `jose` at their latest patch.
- No `TBD` without a date and owner; CLAUDE.md description, test counts and phase line; hub gates ticked.

## Batch 4.3 — Cutover (rewritten in 6.0, run after 6.6; owner and teacher)

New teacher steps, still six lines, button names in English:

1. Old site → Backup → **Save Backup**.
2. New site → **Sign in with Google**. Google's screen says "neon.tech"; that is expected.
3. Backup → **Load Backup** → the file.
4. Check the **File** line, then confirm.
5. Check the group count and one lesson count.
6. **Edit Template** → her payment text is there.

The owner sets `MOVED_TO`, a Ukrainian speaker reviews the text, and her first real sign-in is the system integration check (5.4 row 17). The old site stays the rollback until 4.4.

## Merge order

Step 0 → 6.0 → {6.1 (Neon migration on production before merge) ∥ 6.4} → 6.2 → 6.3 → 6.5 → 6.6 (+ owner: own Google client) → **4.3** (teacher) → 4.4 (window end; old-site cleanup button). T.4–T.9 may merge in parallel at any time. Every merge deploys, but the teacher is unaffected until 4.3: the Pages build has no `VITE_NEON_AUTH_URL`, so it stays in local mode.

## Execution and launch

### Sessions, models and effort (owner, 2026-11-15: "split work into subsessions")

**This session is the orchestrator.**

- It does Step 0 and every MCP write (Neon migrations, the cloud environment, Vercel), each with your yes in chat.
- It starts one child session per batch with `create_session`, on the `lesson-planner` environment, and passes the batch page and this plan's section as the prompt.
- It watches each PR, merges on green CI, and starts the next child.

**Child sessions do not do MCP writes and do not merge.** Each one:

- follows superpowers:executing-plans and the TDD skill;
- pushes to its own branch (`outcome_branch`, listed below — your approval of this plan is the permission to push there);
- opens the PR;
- ends its last message with the PR link and the TDD log.

A fresh **review session** checks each code PR before merge, using `code-review` at the level shown.

| Batch                                                                                   | Branch                           | Model                            | Effort | Why this model and effort                                             | Review session                                           |
| --------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------- | ------ | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Step 0 — environment, Vercel access, baseline suite                                     | (none)                           | this session                     | —      | Needs your approvals in this chat                                     | —                                                        |
| 6.0 — record decisions, rewrite Phase 6 pages (docs only)                               | `claude/p6-00-server-first-plan` | `claude-sonnet-5-5`              | medium | Careful B2 writing across many files; no code                         | `claude-sonnet-5-5`, medium: facts and links             |
| 6.1 — documents API (JWT, allowlist, isolation, versions)                               | `claude/p6-01-documents-api`     | `claude-opus-5-5`                | high   | Security code: R6 high, fault seeding                                 | `claude-opus-5-5`, high                                  |
| 6.4 — Backup menu (**parallel with 6.1**: it touches only the toolbar and page objects) | `claude/p6-04-backup-menu`       | `claude-sonnet-5-5`              | medium | Small UI change with an accessibility checklist                       | `claude-sonnet-5-5`, medium                              |
| 6.2 — remote mode in the store                                                          | `claude/p6-02-remote-store`      | `claude-opus-5-5`                | high   | Store state machine, retries and conflicts across interfaces          | `claude-opus-5-5`, high                                  |
| 6.3 — the move, localStorage clean-up, sign-in screen, spec regression                  | `claude/p6-03-move-local-data`   | `claude-opus-5-5`                | xhigh  | R8: the one step that can delete her data, plus the widest regression | `claude-opus-5-5`, xhigh                                 |
| 6.5 — recovery drills, erasure                                                          | `claude/p6-05-recovery-erasure`  | `claude-sonnet-5-5`              | high   | One delete route and runbooks; the drills follow written procedures   | `claude-opus-5-5`, high: erasure must not cross accounts |
| 6.6 — data-layer security check, close-out                                              | `claude/p6-06-security-closeout` | `claude-opus-5-5`                | high   | Reads the live system against the checklist                           | — (it is the review)                                     |
| 4.3 — cutover                                                                           | —                                | this session + you + the teacher | —      | Owner and teacher actions                                             | —                                                        |

**Rules for children.**

- Each child starts from a fresh clone of `main`, after the batch it depends on has merged. 6.4 rebases on `main` if 6.1 merges first.
- A child that is blocked (a failing baseline, an unclear page, a needed MCP write) stops and writes what it needs as its last message. The orchestrator reads it with `list_events` and asks you.
- The orchestrator checks `get_session` for each child: `status_bucket` and `last_served_model`. A model fallback is reported to you, not hidden.

- **Method inside each child:** native (superpowers:executing-plans), because each batch is one tight interface chain. Cross-batch interfaces are fixed in this plan's Interfaces blocks, so a child needs only its own section.
- **Workflow per batch:** the child works on its branch → batch page → Red/Green commits → push → PR into `main` (one batch per PR, with the template's headings). The orchestrator runs `subscribe_pr_activity` → review session → when `checks` and `tdd-evidence` are green and the review has no unresolved finding, **the orchestrator merges (squash)**. This is the owner's "auto merge when CI passed", done without GitHub auto-merge. A red check gets fixed on the branch, never merged → restart the branch from `main` for the next batch.
- **Step 0, before 6.0 (all prompt you):**
  - create the cloud environment;
  - approve Vercel team access;
  - then `npm ci` and the full suite once on `main`, as the baseline. Any failure there is reported before work starts.
- **I stop and ask the owner for:** the Neon migration writes (6.1), any Vercel env change, the Google OAuth steps, and everything in 4.3.
- **Launch:** already scheduled. The one-time message `trig_01A5ocTn94D3VB2pfSVHWiwM` fires into this session at **2026-11-15 22:26 UTC** ("hourly limits restored — start Step 0"). Nothing runs before then. If a usage limit stops work mid-batch, I schedule another resume 60 minutes later from the last pushed commit.

## Verification

- Per batch: `npm run format:check && npm run lint && npm run typecheck && npm run typecheck:app && npm run typecheck:api && npm run check:pii && npm run test:unit && npm run test:e2e`, with every server from `npm run serve` stopped first. Then CI `checks` and `tdd-evidence` green.
- End to end, locally: `npm run serve`, then the `move-local-data`, `remote-save`, `remote-load` and `remote-import` specs green at `--repeat-each=3`.
- On a preview and production (by a person, recorded on the pages):
  - 401 without a token;
  - a real Google sign-in;
  - an edit appears in `documents` (read with the Neon MCP `run_sql`, read-only);
  - a wiped profile restores by signing in;
  - after a move, the DevTools Application tab shows no planner key.
- Phase 6 gate (rewritten in 6.0):
  - RP-09 AC 18, 19 and 21 are green specs;
  - the remote-mode no-localStorage check is green;
  - the drills are recorded;
  - 4.3 is confirmed by the teacher.

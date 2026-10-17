# RP-11 — AI setup

[RP-11 home](rp11-docs-process-review.md) · Prev: [TDD and test style](tdd-verdict.md) · Next: [Records that do not match](records.md)

This page says what a Claude Code session gets when it opens this repository on
the maintainer's Mac, as checked on 2026-10-17. Secret values were not read.
Where a fact is about the maintainer's machine rather than the repository, the
page says so.

## Summary

| Part                       | State on 2026-10-17                                                                                      | Works?                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Vercel MCP server          | Configured at user scope (`https://mcp.vercel.com`), and again by the `vercel` plugin, same name and URL | **Yes**, checked live        |
| Neon MCP server            | Configured at user scope (`https://mcp.neon.tech/mcp`), OAuth only                                       | **No** — not signed in       |
| Plugins                    | All at user scope: `vercel`, `superpowers`, the seven `istqb-*` plugins, and others not about this project | Yes, they load             |
| Project settings           | No `.claude/settings.json` in the repository                                                             | —                            |
| Project skills and agents  | None in the repository                                                                                   | —                            |
| Hooks                      | None from the project; several from user-scope plugins                                                   | Yes, but none is the project's |
| Project instructions       | `CLAUDE.md` only; it links the context files but does not import them                                    | Yes                          |
| Instruction to use ISTQB   | **None.** No tracked file tells a session to load the ISTQB or TDD skills                                | **Gap**                      |
| Memory                     | Eight files for this project, on the maintainer's machine                                                | Yes; two entries were stale  |

## Vercel MCP: works

Checked with two read-only calls on 2026-10-17:

- `list_projects` finds the project `lesson-planner` in team `denys13`.
- `list_deployments` for production shows the newest deployment **READY**, built
  from `main` at `332a541` (batch 5.7). The four deployments before it are
  READY too.

The `vercel` plugin also ships skills (for example `vercel:deployments-cicd`,
`vercel:vercel-functions`) and a SessionStart hook. Its telemetry is on, because
`VERCEL_PLUGIN_TELEMETRY` is not set.

## Neon MCP: configured, not signed in

- The server `Neon` is declared at user scope in `~/.claude.json`, over HTTP, with
  no token in the file. It uses OAuth.
- On 2026-10-17 the session reported it as "requires authentication", and no
  Neon tool loaded.
- **Owner action:** open an interactive `claude` terminal, run `/mcp`, choose
  **Neon** and sign in. This is the open task on
  [p5-00](../../plan/p5-00-neon-project-link.md) line 65.

Two related findings:

- **The Neon agent skills exist only in one worktree** (`lesson-planner-research-cadaa3`,
  seven skills under `.claude/skills/`). That folder is gitignored, as
  [backend.md](../../../.claude/context/backend.md) decided, so a new worktree
  does not get them. Installing them at user scope would give every session the
  same skills.
- **An untracked `.mcp.json` in that worktree** declares a second server named
  `Neon` with a fixed project id. It is not gitignored, so `git add -A` there
  would commit it. It contradicts the "global, not project" decision on
  [p5-00](../../plan/p5-00-neon-project-link.md) lines 41–43, and its name is
  the same as the user-scope server. It was never approved
  (`enabledMcpjsonServers: []`). Deleting it is the owner's decision.

## Plugins and skills

All plugins are enabled at **user scope** in `~/.claude/settings.json`, so they
load in every session on this machine. The ones this project relies on:

| Plugin                    | Skills it gives                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `istqb-foundation`        | `istqb-foundation-level` (CTFL v4.0.1), `istqb-glossary`                                                  |
| `istqb-test-design`       | `istqb-advanced-level-test-analyst` (CTAL-TA v4.0), `istqb-acceptance-testing`                            |
| `istqb-test-automation`   | `istqb-advanced-level-test-automation-engineering`, `istqb-test-automation-strategy`                      |
| `istqb-test-management`   | test management at advanced and expert level                                                             |
| `superpowers`             | `test-driven-development`, `systematic-debugging`, `verification-before-completion` and others          |
| `vercel`                  | Vercel platform skills, its MCP server, hooks                                                            |

**The gap:** nothing in the repository tells a session to use them. CLAUDE.md
says "follow TDD" through testing.md, but does not name the skills. A session
on another machine, or one where the user-scope settings change, gets nothing.
The owner chose on 2026-10-17 to close this in three ways (phase T): a CLAUDE.md
rule and a memory entry, a tracked `.claude/settings.json` that enables the
plugins, and a SessionStart hook that prints the rule.

Note for the tracked settings file: the `istqb-*` plugins come from a private
marketplace named `aqa-instructions`. A tracked file makes that **name** public.
The owner accepted this. Its source URL is not written into the repository.

## Hooks

The repository has no hooks of its own. User-scope plugins add hooks at session
start, for example `superpowers` (it injects its skill guide) and `vercel` (a
skills profile). Other user-scope plugins that are not about this project add
their own; one of them writes a log folder under `.claude/` in the worktree,
which the `.claude/*` rule in `.gitignore` keeps out of git.

## Repository rules about `.claude/`

`.gitignore` lines 22–24 ignore everything under `.claude/` except `context/`.
So a project `settings.json`, `hooks/`, `skills/` or `agents/` cannot be tracked
without a new exception line.

## Memory

The project memory folder on the maintainer's machine holds eight entries. Two
were stale on 2026-10-17, and batch 5.9 corrected them:

- The index line for the app's shape said "three" `localStorage` keys. The entry
  itself says four (three data keys and the last-backup time).
- The Vercel plugin entry said version 0.49.2; version 0.50.0 is installed.

## The parent checkout

A session started in `/Users/denyslystopadskyy/IdeaProjects/lesson-planner`
(the main checkout, not a worktree) gets **no project instructions**. That
checkout is on the old branch `codex/plan-test-state-util-refactor`, which has
no `CLAUDE.md`. CLAUDE.md forbids index-touching git commands there, so this is
reported, not fixed. Start work from a worktree.

## CI and merge protection

- `ci.yml` runs format, lint, three typechecks, `check:pii`, the unit tests and
  the Playwright suite. It says it is advisory.
- `deploy.yml` (GitHub Pages) runs most of the same checks but **not**
  `typecheck:api` and not `check:pii`.
- `main` has **no branch protection**, so nothing blocks a red merge. Batch 5.4
  recorded this as an owner finding.
- Vercel deploys every pull request as a preview and `main` to production,
  whatever GitHub Actions says.

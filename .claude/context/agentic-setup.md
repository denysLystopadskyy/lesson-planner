# Agentic setup — skills, plugins, MCP servers, hooks, memory

Decisions about how an AI coding session (Claude Code) works in this
repository. Referenced from [CLAUDE.md](../../CLAUDE.md). Background: the
[RP-11 AI setup page](../../docs/research/rp11-docs-process-review/ai-setup.md)
(2026-10-17).

## Decided on 2026-10-17 (batch T.1, owner's choices in RP-11)

### What every session must use

- **At the start of any batch, and before you plan, write or review a test,
  load:**
  - `istqb-foundation:istqb-foundation-level` — the test process, test levels,
    test types and the basic test techniques (ISTQB CTFL v4.0.1);
  - `istqb-test-design:istqb-advanced-level-test-analyst` — choosing a technique,
    coverage items, test data and test oracles (ISTQB CTAL-TA v4.0);
  - `istqb-foundation:istqb-glossary` — when you are not sure which term fits.
- **Before you change a file in `app/`, `api/`, `db/`, `scripts/` or `e2e/`,
  load `superpowers:test-driven-development`**, and follow the red commit rule
  in
  [testing.md §1.5](testing.md#15-how-we-develop-tdd-and-bdd).
- **When a test fails for a reason you do not understand, load
  `superpowers:systematic-debugging`** before you change anything.
- **Before you claim a batch is done, load
  `superpowers:verification-before-completion`**, and check every exit
  criterion on the batch page with a command.
- **For a test automation question** (where test code belongs, flaky tests in
  CI), load `istqb-test-automation:istqb-advanced-level-test-automation-engineering`.
- **For Vercel work**, the `vercel` plugin's skills apply (for example
  `vercel:deployments-cicd`, `vercel:vercel-functions`, `vercel:env-vars`).

- **If a skill is not available** (for example on a machine without the
  private marketplace below), tell the owner and follow
  [testing.md](testing.md) Part 1, which holds the same rules.
- **Where `superpowers:test-driven-development` and testing.md §1.5 differ,
  §1.5 decides.** The skill allows an exception only after asking "your human
  partner"; §1.5's named exceptions are the owner's answer, given in advance.

### Three ways the rule reaches a session

The owner chose all three, so that one failing does not lose the rule:

1. **CLAUDE.md** names the skills in "How we test and build". It is the only
   project file every session loads.
2. **A tracked `.claude/settings.json`** enables the plugins for this project,
   and **a SessionStart hook** prints a short reminder at the start of every
   session. Both arrived in batch
   [T.2](../../docs/plan/pt-02-project-settings-hook.md).
3. **Project memory** on the maintainer's machine has an entry with the same
   method, so a session recalls it when the task is about testing.

### Plugins this project relies on

| Plugin                  | Marketplace               | Why                                      |
| ----------------------- | ------------------------- | ---------------------------------------- |
| `istqb-foundation`      | `aqa-instructions`        | ISTQB basics and the glossary            |
| `istqb-test-design`     | `aqa-instructions`        | Test analysis and test design            |
| `istqb-test-automation` | `aqa-instructions`        | Test automation engineering              |
| `istqb-test-management` | `aqa-instructions`        | Test strategy and risk at advanced level |
| `superpowers`           | `claude-plugins-official` | TDD, debugging and verification skills   |
| `vercel`                | `claude-plugins-official` | Vercel skills and the Vercel MCP server  |

- **`aqa-instructions` is a private marketplace.** The tracked settings file
  makes its **name** public; the owner accepted that on 2026-10-17. Its source
  URL is never written into this repository. A machine without access to it gets
  a warning for those plugins and keeps everything else, including CLAUDE.md.

### MCP servers

| Server   | Where it is configured              | Sign-in | State on 2026-10-17            |
| -------- | ----------------------------------- | ------- | ------------------------------ |
| `vercel` | user scope, and the `vercel` plugin | OAuth   | works; read-only calls checked |
| `Neon`   | user scope (`~/.claude.json`)       | OAuth   | configured, **not signed in**  |

- **Both servers stay at user scope, not in a project `.mcp.json`.** That is the
  "global, not project" decision on
  [p5-00](../../docs/plan/p5-00-neon-project-link.md). A project file would put
  a project id into the repository and could clash with the user-scope server
  of the same name.
- **Signing in is the owner's task.** Open an interactive `claude` terminal, run
  `/mcp`, choose the server and sign in. A desktop session cannot start that
  flow.
- **Never print or ask for a token.** Vercel MCP calls that return a secret (for
  example `update_project_protection_bypass`) are not used; the owner does that
  in the dashboard ([security-auth.md](security-auth.md)).
- **Read-only first.** A session reads deployments, logs and project settings
  through MCP freely. Any write (an environment variable, a promotion, a
  rollback, a Neon branch) needs the owner's yes in the chat.

### Neon agent skills

- Neon publishes agent skills (`neondatabase/agent-skills`). Batch 5.0 installed
  them into one worktree's `.claude/skills/`, which `.gitignore` ignores, so a
  new worktree does not have them.
- **Decided: install them at user scope**, so every session on the machine has
  them, rather than tracking them in the repository. Installing downloads code,
  so it is the owner's action. `TBD` — the date it is done.

### Hooks

- **The project's only hook is the SessionStart reminder** (batch T.2). In
  `.claude/settings.json` it runs
  `cat "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.md"`, and nothing else.
  Claude Code adds what it prints to the session's context.
- **The reminder repeats CLAUDE.md rule 1 and points to the full rule.** When
  "How we test and build" changes, change `.claude/hooks/session-start.md` in
  the same pull request.
- **Any new hook is decided here first**, because a tracked hook runs on every
  machine that opens the project.

### Memory

- Project memory lives on the maintainer's machine, outside the repository, and
  reaches every worktree of this project.
- **Memory does not replace a context file.** A decision goes into a context
  file first; memory may point at it.

### What a session must not do

- Run index-touching git commands in the main checkout (CLAUDE.md).
- Start work in the main checkout: it is on an old branch with no CLAUDE.md, so
  a session there gets no project instructions. Start from a worktree.
- Enable GitHub auto-merge, or merge a red pull request.

## TBD

- The date the owner signs in to the Neon MCP server.
- The date the owner installs the Neon agent skills at user scope.

# Batch T.2 — Project settings and the SessionStart hook

Phase T · [Plan home](README.md) · Prev: [T.1](pt-01-test-strategy.md) · Next: [T.3](pt-03-tdd-evidence-check.md)

## Goal

A session that opens this repository gets the ISTQB, superpowers and vercel
plugins enabled by a tracked project setting, and a SessionStart hook puts the
testing rule into its context.

## Test basis

- [agentic-setup.md](../../.claude/context/agentic-setup.md) — the three ways
  the rule reaches a session, and the owner's choice of all three (2026-10-17).
- [RP-11 AI setup](../research/rp11-docs-process-review/ai-setup.md) — no
  tracked file told a session to use the skills.
- The T.1 acceptance test: a fresh agent reached the skills through
  testing.md, because it was given an old copy of CLAUDE.md. A hook does not
  depend on that.

## Product risks

| Risk                                                               | Likelihood | Impact | Risk level | Effect on testing                                         |
| ------------------------------------------------------------------ | ---------- | ------ | ---------- | --------------------------------------------------------- |
| A tracked hook runs something harmful on another machine           | 1          | 3      | 3          | The hook only prints a fixed text file; reviewed below    |
| A malformed `settings.json` silently disables all project settings | 2          | 2      | 4          | Checked with `jq -e`, and by a real session that loads it |
| The private marketplace name in a public repository                | 3          | 1      | 3          | Accepted by the owner; no source URL is written           |

## Entry criteria

- [x] [T.1](pt-01-test-strategy.md) is written (this branch is stacked on it).
- [x] The test basis is written down above.
- [x] Configuration only: the batch can meet its exit criteria with what it
      ships.

## Test conditions

| ID  | Test condition                                               | Test level / type             | Technique                | Coverage items                                             | How                                 |
| --- | ------------------------------------------------------------ | ----------------------------- | ------------------------ | ---------------------------------------------------------- | ----------------------------------- |
| C1  | The hook command prints the reminder and exits 0             | component testing, functional | —                        | 1                                                          | the command run by hand             |
| C2  | `settings.json` is valid and has the hook in the right place | static analysis               | checklist-based testing  | 2 (the hook path, the plugin list)                         | `jq -e` (below)                     |
| C3  | Only the intended files leave `.gitignore`                   | static analysis               | equivalence partitioning | 4 (settings.json, hooks/, settings.local.json, a worktree) | `git check-ignore -v`               |
| C4  | A new session gets the reminder and the CLAUDE.md rule       | acceptance testing            | scenario-based testing   | 3 (hook text, CLAUDE.md section, skill names)              | a new `claude -p` process, no tools |

## What changed

- `.gitignore`: `!.claude/settings.json` and `!.claude/hooks/`.
  `settings.local.json` and the worktrees under `.claude/` stay ignored.
- `.claude/settings.json`: `enabledPlugins` for `istqb-foundation`,
  `istqb-test-design`, `istqb-test-automation` and `istqb-test-management`
  (marketplace `aqa-instructions`), and `superpowers` and `vercel` (marketplace
  `claude-plugins-official`); and one `SessionStart` hook.
- `.claude/hooks/session-start.md`: the reminder text. It repeats CLAUDE.md rule
  1, the fallback, the red commit rule and the template, and says that
  CLAUDE.md is the full rule.
- No `extraKnownMarketplaces` entry: the `aqa-instructions` source is private.
- agentic-setup.md: the hook is described as it now is, with the rule that the
  reminder changes in the same pull request as CLAUDE.md rule 1.

## TDD log

**Exception: configuration only.** The checks are the test conditions above.

## Acceptance criteria

- [x] **Given** a new session in this worktree, **when** it starts, **then** the
      hook's text is in its context, word for word.
- [x] **Given** that session, **when** it is asked which skills to load, **then**
      it names the two ISTQB skills and `superpowers:test-driven-development`,
      with their triggers.

## Exit criteria

- [x] C1: the command printed the reminder, exit 0.
- [x] C2: `jq -e '.hooks.SessionStart[] | .hooks[] | select(.type == "command") | .command'`
      prints the command; `jq -e '.enabledPlugins | length'` prints 6.
- [x] C3: `git check-ignore -v` keeps `settings.local.json` and
      `.claude/worktrees/…` ignored and `settings.json` tracked; `hooks/` is
      not ignored.
- [x] C4: passed (below).
- [x] `format:check`, `lint`, `check:pii` exit 0.
- [ ] CI green.

## Results

**C4, the acceptance test (2026-10-17).** A new Claude Code process was started
in this worktree with `claude -p` and every tool disabled. It was asked to quote
any text this project's SessionStart hook had added. It quoted the reminder
word for word, said that CLAUDE.md has the section "How we test and build", and
named the three skills with their triggers and the fallback. It also listed the
plugins' own SessionStart text (vercel, superpowers) as separate blocks.

It found one difference: the first reminder text left out the "plan, write or
review a test" trigger and the fallback that CLAUDE.md rule 1 has. Both were
added, and the reminder now says that CLAUDE.md is the full rule.

## Merge order and dependencies

Depends on [T.1](pt-01-test-strategy.md). Deployable: yes — nothing in the app
or the API changes.

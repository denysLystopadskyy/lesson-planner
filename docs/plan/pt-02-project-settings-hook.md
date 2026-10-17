# Batch T.2 — Project settings and the SessionStart hook

Phase T · [Plan home](README.md) · Prev: [T.1](pt-01-test-strategy.md) · Next: [T.3](pt-03-tdd-evidence-check.md)

**Planned in batch [T.1](pt-01-test-strategy.md) on 2026-10-17. Not started.**
The batch that runs it completes this page from the
[template](batch-template.md).

## Goal

A session that opens this repository gets the ISTQB, superpowers and vercel plugins enabled by a tracked project setting, and a SessionStart hook prints the testing rule.

## Test basis

- [agentic-setup.md](../../.claude/context/agentic-setup.md) — the three ways the rule reaches a session.
- [RP-11 AI setup](../research/rp11-docs-process-review/ai-setup.md) — no tracked file tells a session to use the skills today.

## Tasks

- [ ] Add `!.claude/settings.json` and `!.claude/hooks/` to `.gitignore`; `settings.local.json` stays ignored.
- [ ] Write `.claude/settings.json` with `enabledPlugins` for the `istqb-*` plugins, `superpowers` and `vercel`, and a `SessionStart` hook that runs `cat "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.md"`. Use the `update-config` skill.
- [ ] Write `.claude/hooks/session-start.md`: about five lines that point to CLAUDE.md "How we test and build".
- [ ] Do not add an `extraKnownMarketplaces` source URL: the `aqa-instructions` source is private.
- [ ] Mark the T.2 `TBD` in agentic-setup.md as done.

## TDD log

**Configuration only.** The check is the acceptance test below, run in a new session.

## Acceptance criteria

- [ ] **Given** a new session in a fresh worktree of this branch, **when** it starts, **then** the hook text appears in its context.
- [ ] **Given** that session and only the prompt "Plan the tests for batch 6.1", **when** it answers, **then** it loads the two ISTQB skills, names test levels, techniques and coverage items, and plans a red commit.

## Exit criteria

- [ ] The exit criteria in [testing.md §1.6](../../.claude/context/testing.md#16-entry-criteria-and-exit-criteria).

## Merge order and dependencies

Depends on T.1. Deployable: yes.

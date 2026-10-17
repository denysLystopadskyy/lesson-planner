# Batch T.5 — Rewrite the Phase 2a pages to the template

Phase T · [Plan home](README.md) · Prev: [T.4](pt-04-rewrite-phase-1.md) · Next: [T.6](pt-06-rewrite-phase-2b.md)

**Planned in batch [T.1](pt-01-test-strategy.md) on 2026-10-17. Not started.**
The batch that runs it completes this page from the
[template](batch-template.md).

## Goal

Every finished Phase 2a batch page follows the [batch template](batch-template.md) and B2 English, with **the same facts** as before.

## Test basis

- The Phase 2a pages: `p2a-01` to `p2a-04` (9 pages).
- The [batch template](batch-template.md), including its rules for rewriting a finished page.
- The [DEF registry](def-registry.md) for "pinned in" and "fixed in".

## Tasks

- [ ] Rewrite each page: move its content into the template's sections, shorten long sentences, remove idioms, and use the ISTQB terms from [testing.md §1.10](../../.claude/context/testing.md#110-house-words-and-istqb-terms).
- [ ] Keep every number, date, SHA, command, file path, DEF id, test count and owner decision.
- [ ] Where the template asks for something the page never recorded (risk level, red commit, coverage items), write **Not recorded**.
- [ ] Add the line "Rewritten to the template on <date>. The facts are unchanged. Original: `<sha>:<path>`." under each title.
- [ ] Keep every heading that another page links to by `#anchor`, or update the link in the same pull request.

## TDD log

**Exception: docs only.**

## Acceptance criteria

- [ ] **Given** each rewritten page, **when** its fact tokens are compared with the old page, **then** none is missing, or each missing one is explained in the pull request.
- [ ] **Given** three pages picked at random, **when** a reviewer reads old and new side by side, **then** the meaning is the same.
- [ ] **Given** every link in the repository, **when** it is resolved, **then** none is broken.

## Exit criteria

- [ ] The exit criteria in [testing.md §1.6](../../.claude/context/testing.md#16-entry-criteria-and-exit-criteria).

## Merge order and dependencies

Depends on T.1. Independent of the other rewrite batches (T.4–T.9), so it can run in parallel; the hub rows were added in T.1. Deployable: yes.

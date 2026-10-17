# Batch T.1 — The test strategy in ISTQB terms

Phase T · [Plan home](README.md) · Prev: [5.10](p5-10-dead-test-door.md) · Next: [T.2](pt-02-project-settings-hook.md)

## Goal

The project has a written test strategy in ISTQB terms, a batch page template
that asks the ISTQB questions, and an always-loaded rule that tells every future
session to use them.

## Test basis

- [RP-11](../research/rp11-docs-process-review/rp11-docs-process-review.md), and
  the owner's choices of 2026-10-17 recorded there.
- The ISTQB CTFL v4.0.1 and CTAL-TA v4.0 syllabi and the ISTQB Glossary 4.8.1,
  through the `istqb-foundation` and `istqb-test-design` skills.
- The old `testing.md` at `main` `b5bbaa3` (after batch 5.9): every rule in it
  must survive.

## Product risks

This batch changes documentation, so the product risks are about the record,
not the app.

| Risk                                                            | Likelihood | Impact | Risk level | Effect on testing                                           |
| --------------------------------------------------------------- | ---------- | ------ | ---------- | ----------------------------------------------------------- |
| A rule from the old testing.md is lost in the rewrite           | 2          | 3      | 6          | A script compares the fact tokens of the old and new file   |
| A file that points to testing.md stops finding its rule         | 2          | 2      | 4          | Every rule stays in testing.md; no rule moves to a new file |
| An ISTQB term is used with a meaning the glossary does not give | 2          | 2      | 4          | Each term was checked against `istqb-glossary`              |

## Entry criteria

- [x] [5.10](p5-10-dead-test-door.md) is merged or stacked below this branch.
- [x] The test basis is written down above.
- [x] Docs only: the batch can pass its exit criteria with what it ships.

## Test conditions

| ID  | Test condition                                                  | Test level / type | Technique               | Coverage items                                  | How                           |
| --- | --------------------------------------------------------------- | ----------------- | ----------------------- | ----------------------------------------------- | ----------------------------- |
| C1  | Every fact in the old testing.md is in the new one              | static testing    | checklist-based testing | 162 fact tokens of the old file                 | `check-facts.mjs` (below)     |
| C2  | Every relative link and `#anchor` in the changed files resolves | static testing    | checklist-based testing | every link in the changed files                 | `check-links.mjs` (below)     |
| C3  | Every ISTQB term is written as the glossary writes it           | review            | checklist-based testing | the terms in testing.md Part 1 and the template | read against `istqb-glossary` |
| C4  | Format and personal-data checks pass                            | static analysis   | —                       | `format:check`, `check:pii`, `lint`             | npm scripts                   |

## What changed

- **`.claude/context/testing.md`** has two parts.
  - **Part 1, the test strategy:** test objectives; test levels and test types;
    a table for choosing a test technique, with coverage items and an example
    file each; TDD with the **red commit rule** and four named exceptions; BDD as
    acceptance criteria; entry and exit criteria; defect management with
    severity and priority; a product risk register; test data, environments and
    oracles; and a table that maps the house words (pin, gate, proof) to ISTQB
    terms.
  - **Part 2, the test automation rules:** every earlier rule, grouped under
    headings and rewritten in B2 English. Rules that no longer apply are in a
    "History" section at the end.
  - **No rule moved to another file.** Over 60 files, workflows and code
    comments point to testing.md, so the plan's idea of a separate
    `test-automation.md` was dropped for this reason.
- **`docs/plan/batch-template.md`**: the template for every new batch page, and
  the rules for rewriting a finished page to it.
- **`.claude/context/agentic-setup.md`**: which skills a session loads, the
  plugins, the MCP servers and who signs in to them, the hook (from T.2), and
  memory.
- **CLAUDE.md**: a new section near the top, "How we test and build", which
  every session loads. It names the skills with a path-based trigger, a
  fallback when a skill is missing, and the rule that testing.md §1.5 decides
  where the TDD skill says "ask your human partner". The file was also
  shortened from 16.1 KB on `main` to 11.5 KB (about 4,000 to about 2,900
  tokens, at four characters a token): the phase status moved to
  the plan hub, and the layout detail to backend.md and testing.md. A script
  checked that every removed fact is still recorded elsewhere.
- **`docs/plan/def-registry.md`**: Severity and Priority columns. Rows written
  before this batch say "not recorded". DEF-027 and DEF-028 are rated by the
  scale in testing.md §1.7.
- **The plan hub**: Phase T, its rows T1–T10, its quality gate, and Phase 6 now
  depends on T.10.
- **Pages T.2 to T.10** are written as plans, so each batch has a scope before
  it starts.
- Outside the repository: a project memory entry for the working method.

## TDD log

**Exception: docs only.** No production code changed.

## Acceptance criteria

- [x] **Given** a new session in a fresh worktree, **when** it is asked only to
      "plan the tests for batch 6.1", **then** it loads the two ISTQB skills
      and plans with test levels, techniques, coverage items and a red commit.
      Result below.
- [x] **Given** a reader with B2 English, **when** they open testing.md, **then**
      Part 1 tells them the test level, test type, technique and exit criteria
      for a batch, in short sentences. Checked by the review below; its long
      sentences were split.
- [ ] **Given** the product risk register, **when** the owner rates likelihood
      and impact, **then** each risk has a risk level that sets the coverage
      strength. _Waiting for the owner; until then every risk is treated as
      medium._

## Exit criteria

- [x] `format:check`, `lint`, `check:pii` exit 0.
- [x] C1: the fact check finds every token of the old testing.md in the new one,
      except one false match ("6 specs" is part of "Phase 6 specs").
- [x] C2: every relative link and anchor in the changed files resolves.
- [ ] CI green.

## Fault seeding

Both checking scripts were tested by putting a defect in on purpose:

| Defect put in on purpose                                    | Result                                    |
| ----------------------------------------------------------- | ----------------------------------------- |
| `FIXED_NOW` and `DEF-017` removed from a copy of testing.md | `check-facts.mjs` reports both as missing |
| A link to a missing file and to a missing anchor            | `check-links.mjs` reports both, exit 1    |

The first run of the fact check found four real losses in the rewrite — the old
macOS-only rule's condition, `ported-*.spec.ts`, `PORTED_STORAGE_PREFIX` and the
2026-09-09 decision date. All four were put back.

The scripts live in the session's scratchpad, not in the repository. Batch T.3
decides whether a fact check belongs in CI.

## Results

### Acceptance test: a fresh session plans batch 6.1

An agent with no context from this session got one prompt: "Plan the tests for
batch 6.1 in this repository." It read `testing.md`, loaded
`istqb-foundation:istqb-foundation-level` and
`istqb-test-design:istqb-advanced-level-test-analyst`, and wrote 18 test
conditions with test level, technique and coverage items (84 in total), a
fault seeding table, Given / When / Then acceptance criteria and a red commit.

- **It reached the skills through testing.md, not CLAUDE.md.** The agent was
  given this session's start-time copy of CLAUDE.md, which did not yet have the
  new section. So the second path (testing.md) was tested and works; the first
  (CLAUDE.md) works once this batch is merged. Batch T.2's hook adds a third.
- **It found a gap in the red commit rule:** for a new module the first failure
  is "Cannot find module". testing.md §1.5 now allows a stub that throws
  `not implemented`.
- **It found nine defects in the Phase 6 test basis**, before any code exists.
  They are listed on the [T.10](pt-10-phase-6-pages-and-lessons.md) page, with
  five questions for the owner.

### Review: the instruction layer

The `claudemd-auditor` agent reviewed CLAUDE.md, testing.md and
agentic-setup.md (36 findings). The ones applied in this batch:

- testing.md contradicted itself on whether a test may assert defective
  behaviour (§1.7 and §2.8). §1.7 now names the component-test case.
- **§1.3 was wrong for CTFL v4.0.1.** The four test types are functional,
  non-functional, black-box and white-box. Change-related testing
  (confirmation and regression) and static testing are now separate
  subsections. Checked against the `istqb-foundation-level` skill.
- The T.2 hook and the T.3 CI check were described as if they existed. They now
  say "from batch T.2 / T.3 (TBD)".
- No precedence between the TDD skill's "ask your human partner" and §1.5's
  named exceptions; no fallback when a skill is missing. Both added.
- Short definitions of 0-switch, decision rule, BVA and defect masking; every
  abbreviation expanded on first use; long rule sentences split into lists.
- Smaller term fixes: a quality gate is a milestone; running the test after the
  fix is confirmation testing; fault seeding is used here in a narrower sense
  than the glossary's; coverage comes from black-box or experience-based
  techniques; real Google sign-in is system integration testing; the second
  block of `api/deployed-entry.test.ts` is static analysis.
- CLAUDE.md: "acceptance gates" became "exit criteria"; the owner and the
  teacher are defined; the safety rules (no tokens, MCP writes need a yes, no
  auto-merge, never merge red) are now in the always-loaded file.

## Merge order and dependencies

Depends on [5.10](p5-10-dead-test-door.md). Phase 6 depends on this phase.
Deployable: yes — documentation only.

# Batch 6.0 — Record server-first and rewrite the Phase 6 pages (docs only)

Phase 6 · [Plan home](README.md) · Prev: [5.10](p5-10-dead-test-door.md) · Next: [6.1](p6-01-documents-api.md) and [6.4](p6-04-backup-menu.md)

## Goal

The context files and the plan pages say what the owner decided on 2026-11-15
and 2026-11-16: her data lives in Neon, not in the browser, once she signs in.
Phase 6 has seven pages on the template, and no page or file still promises the
old local-first design without a "Superseded" mark.

## Test basis

- The approved plan:
  [Phase 6, server-first](../superpowers/plans/2026-11-15-phase-6-server-first.md),
  especially "Decisions this plan records". The owner confirmed every decision
  in chat on 2026-11-15 and 2026-11-16.
- The decision rule in [CLAUDE.md](../../CLAUDE.md): a global or architectural
  decision is recorded in a context file, in the same pull request.
- The review findings of [T.10](pt-10-phase-6-pages-and-lessons.md), which this
  batch absorbs.
- [testing.md Part 1](../../.claude/context/testing.md#part-1--test-strategy)
  and the [template](batch-template.md).
- The ISTQB skills named in CLAUDE.md are **not installed** in the cloud
  environment, and `superpowers:test-driven-development` is not needed for a
  docs-only batch. testing.md Part 1 was followed instead, as CLAUDE.md says.

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                                                                                        |
| ---- | ---------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3   | 2–3        | 3      | 6–9 high   | Recorded as rated high by the owner. This batch changes no code; it sets the coverage the later pages use.                                               |
| R4   | 2–3        | 3      | 6–9 high   | Same.                                                                                                                                                    |
| R6   | 2–3        | 3      | 6–9 high   | Same.                                                                                                                                                    |
| R8   | 2–3        | 3      | 6–9 high   | **New.** Added to testing.md §1.8 here. The owner's rating is the level, not a split of likelihood. Batch [6.3](p6-03-move-local-data.md) tests it most. |

## Entry criteria

- [x] The plan is approved, and the owner confirmed each decision in chat.
- [x] The plan file is on a branch the session can read
      (`claude/practical-dijkstra-jq0hmt`).
- [x] This batch can pass its own exit criteria with only what it ships: it
      changes Markdown and one code comment in a test file.

## Test conditions

Static testing: nothing runs, so there is no test level. The test type is
non-functional (documentation quality) and white-box on the repository's
text. Techniques come from [testing.md §1.3–1.4](../../.claude/context/testing.md#13-test-types-change-related-testing-and-static-testing).

| ID  | Test condition                               | Test level     | Test type                  | Technique | Coverage items                                                                                                                                         | File                                           |
| --- | -------------------------------------------- | -------------- | -------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| C1  | Every decision is recorded where it lives    | static testing | non-functional, review     | checklist | 15 rows of "Decisions this plan records", each found in its named file                                                                                 | `.claude/context/*.md`, [README.md](README.md) |
| C2  | Superseded rules are marked, not deleted     | static testing | non-functional, review     | checklist | each older rule that a decision replaces says **Superseded on 2026-11-15** and keeps its text (storage, state, security, backend, deployment, testing) | `.claude/context/*.md`                         |
| C3  | No broken relative link                      | static testing | non-functional, tool-based | checklist | every relative Markdown link in the repository resolves to a file                                                                                      | whole repository                               |
| C4  | Formatting, lint and personal data           | static testing | non-functional, tool-based | checklist | `format:check`, `lint`, `check:pii` exit 0                                                                                                             | whole repository                               |
| C5  | The T.10 findings are resolved               | static testing | non-functional, review     | checklist | 9 of 9 findings, each resolved on a page or moved with a reason (see [T.10](pt-10-phase-6-pages-and-lessons.md))                                       | [pt-10](pt-10-phase-6-pages-and-lessons.md)    |
| C6  | Each Phase 6 page has every template section | static testing | non-functional, review     | checklist | 7 pages × 13 template sections (91 of 91 present)                                                                                                      | `docs/plan/p6-0*.md`                           |
| C7  | The 4.3 steps match the plan                 | static testing | non-functional, review     | checklist | 6 teacher steps, English and Ukrainian, button names unchanged                                                                                         | [p4-03](p4-03-cutover-to-vercel.md)            |

## Tasks

- [x] Write every row of "Decisions this plan records" into its context file;
      mark replaced rules **Superseded on 2026-11-15** and keep the old text.
- [x] Create the pages `p6-00` to `p6-06` from the template. Delete the old
      `p6-01` to `p6-05`; git history keeps them. Fix every link to them.
- [x] Update the hub: a section "What changed on 2026-11-15", the new
      merge-order rows, the Phase 6 gate and the Phase T override.
- [x] Rewrite the teacher's steps on [4.3](p4-03-cutover-to-vercel.md) and add
      the old-site cleanup task to [4.4](p4-04-retire-github-pages.md).
- [x] Mark [T.10](pt-10-phase-6-pages-and-lessons.md) as absorbed and resolve
      its nine findings.
- [x] Route DEF-029 and DEF-030 to 6.3 in [def-registry.md](def-registry.md).
- [x] Add R8 and the owner's "high" rating to testing.md §1.8, and the e2e
      session rule to §2.9.
- [x] Fix the comment "The 8 frozen" → "The 7 frozen" in
      `e2e/features/testid-contract.spec.ts` (T.10 item 9).
- [x] Copy the plan to `docs/superpowers/plans/2026-11-15-phase-6-server-first.md`
      so `main` holds it for the later batches.
- [x] Check every relative link, then `format:check`, `lint` and `check:pii`.
- [x] Open one pull request into `main`. Do not enable auto-merge.

## TDD log

**Exception: docs only.**

The one code-file change is a comment in `e2e/features/testid-contract.spec.ts`.
It is test code, not production code (T.10 item 9). No file under `app/`,
`api/`, `db/` or `scripts/` changes.

## Acceptance criteria

- [x] **Given** a session that starts batch 6.1, **when** it reads its page,
      **then** the page lists the test conditions, techniques and coverage items
      and the red commit to write first.
- [x] **Given** a rule in a context file that server-first replaces, **when** a
      reader finds it, **then** it says **Superseded on 2026-11-15** and points
      to the rule that replaced it.
- [x] **Given** the hub, **when** a reader looks for the next batch, **then**
      the merge order is Step 0, 6.0, {6.1 and 6.4}, 6.2, 6.3, 6.5, 6.6, 4.3, 4.4.

## Exit criteria

- [x] `format:check`, `lint` and `check:pii` exit 0 locally. CI runs the full
      set; this batch changes no code that the other checks read.
- [x] Coverage: covered coverage items ÷ identified coverage items = 7 / 7
      conditions checked (C1 to C7).
- [x] The TDD log names its exception.
- [x] No new anomaly needs a DEF row. The open questions for the owner are on
      the pull request.
- [x] Counts: `test:unit` and `test:e2e` are not run for a docs batch; the one
      comment change cannot change them.

## Confirmation and regression testing

Impact analysis: the pages link to each other, so a deleted page can break a
link. The link check (C3) covers that. `scripts/check-tdd-evidence.test.mjs`
uses `docs/plan/p6-01.md` as a made-up name in its fixtures; it reads no real
page, so deleting the old p6-01 does not affect it.

No defect is fixed here. DEF-029 and DEF-030 are only routed to 6.3.

## Fault seeding

Not required: this batch has no high-risk test condition that runs code.

## Results

Run on 2026-11-16 in the cloud environment `lesson-planner`
(Node v24.22.3, npm 11.21.2, 305 packages in `node_modules`).

- **Link check:** a script (kept in the session's scratchpad, not in the
  repository) read every `[text](target)` link in the 123 tracked and new
  Markdown files, skipping code fences and inline code. Result: **1 185 relative
  links, 17 of them same-page anchors, 0 broken.** A second pass checked the 52
  links that name a heading in another file: 0 broken.
- `npm run format:check`, `npm run lint` and `npm run check:pii` exit 0
  (`check:pii`: 143 files, no bank or tax identifier shape).
- The e2e and unit suites were not run: no file under `app/`, `api/`, `db/` or
  `scripts/` changed, and the one comment change is in a spec file.

## Merge order and dependencies

Depends on Step 0 (the environment and the baseline suite). Deployable: yes —
the change is Markdown and one comment in a spec, so the live site is
unchanged.

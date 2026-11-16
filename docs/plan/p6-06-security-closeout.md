# Batch 6.6 — Data-layer security check and close-out

Phase 6 · [Plan home](README.md) · Prev: [6.5](p6-05-recovery-erasure.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

**Planned in batch 6.0 on 2026-11-16. Not started.** The session that runs it
fills in the TDD log and the results. This is the old batch 6.5, re-pointed at
server-first.

## Goal

The data layer is checked against the security review checklist on production,
the dependencies are current, and the records have no `TBD` without a date and
an owner. After this batch the teacher can move (batch 4.3).

## Test basis

- The plan section "Batch 6.6" in
  [the Phase 6 plan](../superpowers/plans/2026-11-15-phase-6-server-first.md).
- The checklist of [5.4](p5-04-security-review.md), rows 13 to 17 and 20 to 22.
- [security-auth.md](../../.claude/context/security-auth.md), section "Decided
  on 2026-11-15", including its open findings: the Vercel `readable-secret`
  flags, the Organization plugin, the per-deployment trusted origins, the
  no-rate-limit decision.
- The API from [6.1](p6-01-documents-api.md).

## Product risks

| Risk | Likelihood | Impact | Risk level | Effect on testing                                                                           |
| ---- | ---------- | ------ | ---------- | ------------------------------------------------------------------------------------------- |
| R6   | 2–3        | 3      | 6–9 high   | Read every documents query; run the two-user test on a preview; a person checks production. |
| R5   | TBD        | TBD    | TBD        | The allowlist on every request is re-checked (row 13).                                      |

## Entry criteria

- [ ] Batches 6.1 to 6.5 are merged. This is the last batch before the cutover.
- [ ] The test basis above is written down (it is).
- [ ] This batch can pass its own exit criteria with only what it ships. It
      reads the live system, so it needs production and a preview.

## Test conditions

| ID  | Test condition                        | Test level         | Test type                        | Technique               | Coverage items                                                                 | File                   |
| --- | ------------------------------------- | ------------------ | -------------------------------- | ----------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| C1  | Queries are scoped by `sub`           | static testing     | non-functional, security, review | checklist               | every documents query in `api/[...all].ts` carries `WHERE user_id = …`         | `api/[...all].ts`      |
| C2  | Two users on a preview                | system integration | functional, security             | scenario-based          | two test tokens: B cannot read or change A's rows                              | this page, Results     |
| C3  | Checklist rows 13–17 and 20–22        | system integration | non-functional, security         | checklist               | 8 rows of the 5.4 checklist, each with a result and evidence on production     | this page, Results     |
| C4  | The 256 KB limit holds                | system integration | non-functional, security         | boundary value analysis | a body just over 262 144 bytes → 413 on a preview                              | this page, Results     |
| C5  | The version cap holds                 | system integration | functional                       | boundary value analysis | after 51 saves of one key, 50 previous versions remain                         | this page, Results     |
| C6  | The no-rate-limit decision is re-read | static testing     | non-functional, security, review | checklist               | the reasons in security-auth.md still hold                                     | `security-auth.md`     |
| C7  | Dependencies are current              | static testing     | non-functional, tool-based       | checklist               | `npm audit`; Dependabot; `@neondatabase/auth` and `jose` at their latest patch | `package.json`         |
| C8  | No `TBD` without a date and an owner  | static testing     | non-functional, review           | checklist               | every `TBD` in the context files                                               | `.claude/context/*.md` |

Also decided here: the Vercel `readable-secret` finding (record or setting), the
review of Neon Auth's Organization plugin, and the replacement of the
per-deployment trusted origins with one wildcard.

## Tasks

- [ ] Load the skills named in CLAUDE.md. If the ISTQB skills are not
      installed, say so here and follow testing.md Part 1.
- [ ] Read every documents query; then run the two-user test on a preview with
      two test tokens.
- [ ] Check the 256 KB limit and the version cap on a preview.
- [ ] Re-check rows 13 to 17 and 20 to 22 of the 5.4 checklist on production;
      record each result.
- [ ] Re-read the no-rate-limit decision.
- [ ] Run `npm audit`; check Dependabot; update `@neondatabase/auth` and `jose`
      to their latest patch.
- [ ] Decide the `readable-secret` finding; review the Organization plugin;
      replace the per-deployment origins with one wildcard (owner's yes in chat
      for any Neon or Vercel write).
- [ ] Close-out: no `TBD` without a date and an owner; update the CLAUDE.md
      description, the test counts and the phase line; tick the hub gates.
- [ ] Open the pull request. This batch is the review, so it has no separate
      review session.

## TDD log

This batch reads the live system and changes records. If it changes code, it
follows Red then Green; otherwise it names an exception.

| Step     | Commit | Command | Result                             |
| -------- | ------ | ------- | ---------------------------------- |
| Red      |        |         | _fails with: <one to three lines>_ |
| Green    |        |         | _passes_                           |
| Refactor |        |         | _optional; passes_                 |

## Acceptance criteria

- [ ] **Given** the checklist rows 13 to 17 and 20 to 22, **when** the batch
      closes, **then** each has a dated result and evidence.
- [ ] **Given** two accounts on a preview, **when** one reads or changes the
      other's documents, **then** the API refuses.
- [ ] **Given** the context files, **when** a reader looks for a `TBD`, **then**
      each has a date and an owner.
- [ ] **Given** Phase 6, **when** the gates are read, **then** RP-09 AC 18, 19
      and 21 are green specs, the remote-mode no-localStorage check is green,
      and the drills are recorded.

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: covered coverage items ÷ identified coverage items = _N / N_.
- [ ] The TDD log is complete, or names its exception.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.

## Confirmation and regression testing

Impact analysis: dependency updates can break the build or the entry, so the
whole suite and `api/deployed-entry.test.ts` run again.

## Fault seeding

Not required for the review itself. If this batch changes a documents query,
add a fault seeding table for it.

| Defect put in on purpose | Result |
| ------------------------ | ------ |
|                          |        |

## Results

_Filled in by the session that runs this batch._

## Merge order and dependencies

Depends on [6.5](p6-05-recovery-erasure.md). Closes Phase 6 and unlocks
[4.3](p4-03-cutover-to-vercel.md). Deployable: yes.

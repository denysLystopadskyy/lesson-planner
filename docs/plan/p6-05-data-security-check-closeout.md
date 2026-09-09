# Batch 6.5 — Data-layer security check and close-out

Phase 6 · [Plan home](README.md) · Prev: [6.4](p6-04-recovery-retention-erasure.md)

## Goal

A second, shorter review now that data is stored, and the records brought up
to date.

## Tasks

- [ ] Re-check rows 13–17 and 20–22 of the
      [5.4 checklist](p5-04-security-review.md) against the live system, plus
      three data rows: every documents query is scoped by the session user
      (read the code, run the two-user test on production with two test
      accounts); the body size limit and rate limit are in force (observed);
      `document_versions` holds no data older than its cap.
- [ ] `npm audit`; Dependabot alerts reviewed; `better-auth` at the latest
      patch.
- [ ] Context files: no `TBD` without a date and an owner. `CLAUDE.md`: the
      description, the test counts, the phase status line.
- [ ] Hub gates for Phases 4–6 ticked with dates.

## Acceptance criteria

- Every re-checked row has a result and evidence.
- `grep -rn TBD .claude/context` shows only dated, owned items.
- Full suite exit 0.

## Merge order and dependencies

Depends on 6.4. Last batch of the plan. Deployable: yes.

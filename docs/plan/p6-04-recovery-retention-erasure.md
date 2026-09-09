# Batch 6.4 — Recovery drills, retention and erasure

Phase 6 · [Plan home](README.md) · Prev: [6.3](p6-03-remote-persistence.md) · Next: [6.5](p6-05-data-security-check-closeout.md)

## Goal

Every recovery path is rehearsed and written down before it is needed. She can
delete everything with one action. The open data-protection items have owners
and dates.

Design: RP-07 §6, [security-auth.md](../../.claude/context/security-auth.md),
[backend.md](../../.claude/context/backend.md).

## Tasks

- [ ] Adapt RP-07 §6 and rehearse each procedure with test data:
      **A** — restore on a wiped device by signing in (check the group count,
      one lesson count, one month total; if empty, stop). **B** — restore from
      a JSON file (unchanged from 3.3). **C** — developer restore from
      `document_versions`, and once from Neon's restore window on a branch.
      Results in the table below.
- [ ] "Delete my account and data" on the account view: confirmation naming
      what goes; then the server deletes the documents, the versions and the
      Better Auth user; the client clears the five keys. GDPR erasure in one
      action.
- [ ] Retention: still `TBD` — the period comes from her accountant, never a
      guess, never automated (RP-06 §6, RP-09 D9). Record the owner and the
      question in security-auth.md.
- [ ] Neon's 90-day sentence: **owner asks Neon Support** whether inactive Free
      projects outside Azure are deleted. If yes or unclear: a monthly
      GitHub Actions cron calls `/api/health` (which touches the database).
      Record the decision in backend.md.
- [ ] Confirm the DPA records from 5.1 are complete; add the subprocessor
      lists' review date.

### Drill results

| Procedure                       | Date | Result |
| ------------------------------- | ---- | ------ |
| A — sign in on a wiped profile  |      |        |
| B — import a JSON file          |      |        |
| C1 — restore from a version row |      |        |
| C2 — Neon restore on a branch   |      |        |
| Erasure                         |      |        |

## Acceptance criteria

- Every drill row has a date and a result.
- e2e: erasure removes the server rows (checked through the local API) and the
  five local keys; the app shows the empty state.
- The keep-alive decision and the retention owner are recorded.

## Merge order and dependencies

Depends on 6.3. Deployable: yes.

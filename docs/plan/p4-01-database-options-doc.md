# Batch 4.1 — Database integration: options document (brainstorming)

Phase 4 · [Plan home](README.md) · Prev: [3.7](p3-07-cleanup.md)

## Goal

Produce the options document that lets the owner decide the database step.
**This batch produces a document, not implementation tasks.**

## Tasks

- [ ] Write `docs/plan/phase-4-database-options.md` with:
  - The problem: data lives on one device; the loss already happened once.
  - Option A (research recommendation): Firestore `users/{uid}` on the free
    plan, Warsaw region, Google sign-in via `signInWithPopup`, client-rotated
    snapshots (the free plan has no managed backup), plus the JSON export.
  - Option B: Google Drive app-folder storage (user-owned bytes, weaker
    session model).
  - Option C: stay local-only with the batch-3.3 backup (zero cloud).
  - Security review per option: secret handling (a static site has no
    secrets), security rules, deploy security, GDPR posture (link RP-06).
  - Decision checklist and open questions — first question: which browser,
    device, and OS does the teacher use (this closes a cluster of unknowns).
- [ ] Sources: link the research reports; verify any figure that gets quoted.

## Acceptance criteria

- The document exists at the fixed path with all headings above present.
- It contains no implementation task and no personal data values.
- Prettier check passes.

## Merge order and dependencies

Depends on Phase 3 completion. Leaves GitHub-Pages-only constraint behind —
by decision, after this document is discussed. Nothing in it deploys.

# Batch 5.10 — Remove the dead test door (DEF-028)

Phase 5 · [Plan home](README.md) · Prev: [5.9](p5-09-review-and-records.md) · Next: T.1 — the test strategy

## Goal

Make the code match the record. Batch 5.7's page says it removed the test-only
sign-in lines from `scripts/serve.mjs`. It did not
([DEF-028](def-registry.md), found by
[RP-11](../research/rp11-docs-process-review/records.md#one-false-record--def-028)).
This batch removes them, and corrects three code comments that still describe
the removed server.

## Test basis

- DEF-028 in the [DEF registry](def-registry.md).
- [p5-07](p5-07-neon-auth-client.md), "What was removed".
- [p5-08](p5-08-a-session-for-specs.md): specs hold a session through a stub in
  the browser, so the local server needs no test door.

## What changed

- **`scripts/serve.mjs`**: removed `process.env.AUTH_TEST_MODE = "1"`, the
  `E2E_EMAIL` export and the line that added it to `ALLOWED_EMAILS`, with their
  comments. The block was dead: nothing reads `AUTH_TEST_MODE`, and nothing
  imports `E2E_EMAIL` from this file — the session stub has its own constant in
  `e2e/ui/support/sign-in.ts`. It was also a small widening of the allowlist on
  any machine that set `NEON_AUTH_BASE_URL` locally.
- **`scripts/serve.mjs`**: the comment above the PGlite block was written twice.
  One copy is removed.
- **`api/[...all].ts`**: the webhook's comment said the `validateUserInfo` gate
  was "parked", that `/api/auth/*` was "still routed" to the old handler, and
  that the allowlist was "also enforced per request". The first two stopped
  being true in 5.7. The third is planned for Phase 6 and is not built.
- **`app/src/App.tsx`**: the comment said sign-in is "served by this app's own
  API". Neon serves it; the account control is hidden when the build has no
  `VITE_NEON_AUTH_URL` or the session request fails.

## TDD log

**Exception: dead-code deletion.** The batch removes lines that no code reads
and changes comments. It adds no behaviour, so no test can fail before it and
pass after it. A test that read the source file for a string would be a fake
check, which CLAUDE.md forbids. The evidence is below instead.

## Confirmation testing

DEF-028 was "the record says removed, the code still has it". The check is that
the code no longer has it:

- `grep -rn AUTH_TEST_MODE scripts api app/src db` — no result.
- `grep -rn planner-e2e@example.test scripts api` — no result. The address is
  still in `e2e/ui/support/sign-in.ts` and `e2e/features/sign-in.spec.ts`, where
  the session stub uses it, as intended.

## Regression testing

Impact analysis: the removed lines changed two environment variables of the
local server. The only reader of `ALLOWED_EMAILS` is the allowlist webhook, and
its HTTP spec sends an unsigned request that is refused before the allowlist is
read. So the suites below are the regression scope, and they run in full.

| Check                                                 | Result on 2026-10-17                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `typecheck`, `typecheck:app`, `typecheck:api`, `lint` | pass                                                                        |
| `test:unit`                                           | 374 passed, 14 files                                                        |
| `test:e2e` on this Mac                                | 198 passed, **6 failed** — the macOS pixel baselines; see the anomaly below |
| `test:e2e` in CI (Linux baselines, pinned container)  | see the pull request                                                        |

### Anomaly: the macOS pixel baselines no longer match this Mac

Six specs in `visual-layout.spec.ts` fail on this machine. **The same six fail
on unchanged `main` (`e1afb71`)**, run in a separate worktree, so this batch did
not cause them.

The cause is the environment. In all six images the difference is the
anti-aliasing of the page title at about x 193–195, y 26: the same glyph drawn a
little lighter. The macOS baselines were made on 2026-09-17; the machine now
runs macOS 27.0.1. testing.md already says that a macOS baseline belongs to one
machine and should be regenerated rather than trusted when that changes. CI
compares the Linux baselines in its pinned container, which this does not
affect.

Regenerating the macOS baselines blesses whatever renders now, so a person has
to look at the result first. That is left as a separate task, not done here.

## Exit criteria

- [x] No `AUTH_TEST_MODE` and no e2e allowlist address in `scripts/`, `api/`,
      `app/src/` or `db/`.
- [x] Three typechecks, `lint`, `format:check` pass.
- [x] `test:unit` passes.
- [x] `test:e2e` passes except the six macOS pixel specs, which fail on `main`
      too (recorded above).
- [ ] CI green, with the Linux baselines.
- [x] DEF-028 closed in the [DEF registry](def-registry.md).

## Merge order and dependencies

Depends on [5.9](p5-09-review-and-records.md), which recorded DEF-028.
Deployable: yes — the deployed function changes only in comments, and the local
server loses two lines nothing read.

# Batch 4.3b — The bypass existed only on paper, and the 403 was a different wall

Phase 4 · [Plan home](README.md) · Prev: [4.3a](p4-03a-moved-banner.md) · Next: [4.3](p4-03-cutover-to-vercel.md)

## Goal

Read a deployment without being locked out, and know which wall answered when
one does. The owner asked for Protection Bypass for Automation "to avoid being
locked" by the Vercel site. Two different walls do that, and the secret opens
only one of them.

## Why this is its own batch

It belongs to no batch that exists. Phase 5 closed with
[5.4](p5-04-security-review.md), which recorded "no bypass secret exists,
because no workflow needs one". That was true, and it is also why nothing could
read a preview. Meanwhile deployment.md had said since 2026-09-09 that
"automation uses the documented bypass header", which was never true.

It lands early, like [4.3a](p4-03a-moved-banner.md), because the cutover needs
exactly this kind of check. [4.3](p4-03-cutover-to-vercel.md) asks for the new
URL to be re-checked signed out before the teacher moves, and lesson 29 says a
full suite against production is a spot-check, not a habit.

The number is Phase 4's because the work is hosting work, and Phase 4 is still
open. The row in the [plan hub](README.md) is `43q`, after every other lettered
row, because those rows are listed in the order they merge, not by number.

## The two walls

Measured 2026-10-17:

| What answers                                                   | Where                                                                                  | What gets past it                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| **302 → `vercel.com/sso-api`**, Vercel Authentication          | Previews and deployment URLs. Production (`lesson-planner-lac.vercel.app`) answers 200 | The bypass secret                          |
| **403 "Vercel Security Checkpoint"**, `ANOMALY_SCORE_EXCEEDED` | Any URL, for one IP, after a burst                                                     | Nothing on Hobby. Fewer requests, and time |

The secret cannot open the second wall. Vercel documents the firewall's order as
"bypass, then system mitigations, attack challenge mode, IP blocks, custom
rules", and Deployment Protection comes after all of it. The one exemption
ahead of the mitigation is an IP system-bypass rule, and reading those answered
**402**: "IP Bypass is unavailable for team denys13. Pro and Enterprise plans
include it." Vercel does not say in one sentence that the header cannot pass
the checkpoint. That part is an inference from the documented order.

## What ships

- **`scripts/probe-deployment.mjs`**, run as `npm run probe:deployment -- <url>`.
  Two requests, `/api/health` then `/`, one after the other. For each it prints
  the status, `content-type` and `x-vercel-cache`, and names what answered:
  `sso`, `mitigation`, `wrong-shape`, `pass` or `unexpected`. A `pass` from the
  edge cache carries a warning (lesson 34). The health body's commit is looked
  up in this repository — `= origin/main`, `= HEAD`, ours, or not ours — and
  "not ours" fails the run.
- **The secret is named in security-auth.md before it exists**, as that file
  requires, with its one reader and the two places it must not be. The
  inventory it joins is corrected first, in its own commit: it still listed the
  four Better Auth and Google variables that batch 5.7 removed. backend.md's
  variable list, which `.env.example` names as its record, had the same five
  dead names and is corrected the same way.
- **Four records corrected.** deployment.md: the stale line is struck through,
  and the DDoS paragraph says why the secret is not its remedy. backend.md and
  [5.1](p5-01-neon-database-plumbing.md): the preview health check is now one
  command. testing.md: the secret is still not a GitHub Actions secret. In
  [5.4](p5-04-security-review.md): a dated note that keeps row 5 true, and the
  secret's rotation.

### Choices in the probe that are easy to undo

- **Redirects are not followed.** `fetch` follows a 302 by default. It would
  land on Vercel's login page, and the wall would never be seen. The self-test
  checks the option, and a run against `lesson-planner-denys13.vercel.app`
  proved it live: `302 … → sso`.
- **The secret goes only to this project's preview hosts**: HTTPS, a name that
  starts `lesson-planner-` and ends `-denys13.vercel.app`. deployment.md records
  that `lesson-planner.vercel.app` is somebody else's project, answering the
  same health route. Sending the secret there would put it in that owner's
  logs. The rule stops the accidental case; it cannot stop a host built on
  purpose to look like ours, and the script says so.
- **Only the bypass header**, not `x-vercel-set-bypass-cookie`. A script with
  no cookie store has nowhere to keep the cookie.
- **A self-test on every run**, like `check-no-personal-data.mjs`: eight
  responses and seven hosts, each told apart from the others. Five deliberate
  breaks of a scratch copy were each caught: following redirects, accepting any
  team host, ignoring the cache header, missing the login wall, and passing
  every health body.
- **Never in CI.** It talks to a live system, and its secret is not a GitHub
  Actions secret.

## The owner's step

Only the owner can create the secret, and it should be done in the dashboard.
The Vercel MCP's `update_project_protection_bypass` can create one too, but its
response carries the value, which would put it in a transcript.
security-auth.md forbids a value in a chat.

1. Project → Settings → Deployment Protection → Protection Bypass for
   Automation → **Add Secret**. Let Vercel generate it, with the note "local
   probe only".
2. **Do not designate it** as the `VERCEL_AUTOMATION_BYPASS_SECRET` system
   variable. If the card marks it as designated, switch that off. Vercel
   documents that variable as "available at both build and runtime", and no
   deployment reads it. 5.4's row 5 asks that the secret be stored only where a
   workflow needs it.
3. Add `VERCEL_AUTOMATION_BYPASS_SECRET=<value>` to `.env.local`. The Neon CLI
   rewrites its own lines in that file and keeps every other line.

Claude's own checks need none of this. The Vercel MCP's `web_fetch_vercel_url`
reads a protected preview with the owner's Vercel access, from Vercel's side
rather than from this machine's IP.

## Found, not fixed

- **Batch 5.5 has no row in the [plan hub](README.md)'s merge-order table**,
  although row 43n depends on it. `43m` is the gap. A one-line fix, left for
  whoever owns the table.
- **`.env.example` still opens with "No code reads any of these yet"**, which
  has been false since batch 5.1a.
- **The macOS pixel baselines no longer match this machine.** It now runs macOS
  27.0.1, and the baselines were made on 2026-09-17. Six `visual-layout`
  comparisons fail locally by 1 to 24 pixels, all at the edges of letters —
  font rendering, not layout — and they fail the same way on untouched `main`
  (`a003ce0`). testing.md already says a different Mac should "regenerate
  rather than trust them". That needs `npm run test:update` and a person looking
  at the result, so it is not done here. CI compares the Linux set, in the
  pinned container, and is unaffected.
- **`scripts/serve.mjs` still sets `AUTH_TEST_MODE`**, under comments about
  Better Auth's test-only sign-in door. Batch 5.7 removed that server, and
  nothing reads the variable now.

## Acceptance criteria

Met by this pull request:

- [x] `node scripts/probe-deployment.mjs --self-test` passes, and five
      deliberate breaks of a scratch copy each fail it.
- [x] Against production, with no secret: both requests `pass`, and the commit
      is placed as `origin/main`.
- [x] Against the protected team alias, with no secret: both requests `sso`,
      exit 1. The wall is seen, not followed. The same on this pull request's
      own preview.
- [x] The no-secret path the records describe works. The Vercel MCP's
      `web_fetch_vercel_url` read this pull request's preview (commit
      `6e2d4c7`): 200, `db: "ok"` in 60 ms, `auth: "ready"`. That also met
      [5.1](p5-01-neon-database-plumbing.md)'s preview gate, open since
      2026-09-17.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`
      (which checks the script under `checkJs`) and `check:pii` are clean.
      `test:unit` 374 passed.
- [x] `test:e2e` shows no failure this batch causes: 198 passed, and the 6 that
      fail are the macOS pixel comparisons under "Found, not fixed", which fail
      the same way on untouched `main` on this machine. The diff touches nothing
      under `app/` or `e2e/`, and not `playwright.config.ts`. CI's run, in the
      pinned Linux container, is the gate for this pull request.

Moved to the results table below (the owner, then a follow-up PR):

- The secret exists, and it is not designated as a deployment variable.
- A preview answers `sso` without the secret and `pass` with it.

### Runbook results

| Step                                        | Date | Result |
| ------------------------------------------- | ---- | ------ |
| Secret created, not designated              |      |        |
| A preview probed without the secret → `sso` |      |        |
| The same preview probed with it → `pass`    |      |        |

## Merge order and dependencies

Depends on [5.4](p5-04-security-review.md), whose row 5 and rotation section it
annotates. It touches no app code and no workflow, so the deploy ships the same
app. Deployable: yes.

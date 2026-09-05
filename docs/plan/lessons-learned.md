# Lessons learned — what executing the plan taught us

This page records what went wrong, or turned out to be untrue, while the batches
were being built. It is a narrative record, not a rule book. Decisions belong in
the [context files](../../CLAUDE.md) and defects belong in the
[DEF registry](def-registry.md); where a lesson became one of those, the entry
says so and links to it instead of repeating it.

Every entry names the batch it came from and the evidence behind it. Nothing here
is a guess.

Sources: the amendment sections of
[1.1](p1-01-toolchain-bootstrap.md), [1.2](p1-02-land-test-hooks.md) and
[1.3](p1-03-scaffold-core.md), plus the
[DEF registry](def-registry.md) and the context files those batches changed.

## Promoted to a rule

These stopped being lessons and became rules. The page keeps a one-line summary;
the rule itself lives where the decision rule says it must.

| Lesson                                                                           | Now recorded in                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A batch's own acceptance gates must be reachable with only what that batch ships | [CLAUDE.md](../../CLAUDE.md) → Working rules                         |
| A rule that cannot be honoured gets the record changed, not a fake compliance    | [CLAUDE.md](../../CLAUDE.md) → Working rules                         |
| The prior-art checkout shares this `.git`; copy contents, never touch its index  | [CLAUDE.md](../../CLAUDE.md) → Working rules                         |
| Verify a control is reachable at runtime before writing a test for it            | [testing.md](../../.claude/context/testing.md)                       |
| A guard spec needs a completeness check, not only per-item assertions            | [testing.md](../../.claude/context/testing.md)                       |
| Check the peer ranges of dependencies that later batches will add                | [linting-formatting.md](../../.claude/context/linting-formatting.md) |
| Prove content equality after a formatter runs by formatting both sides           | [linting-formatting.md](../../.claude/context/linting-formatting.md) |

## The lessons

### 1. A value suggested by a ticket is a hypothesis

- **What:** batch [1.1](p1-01-toolchain-bootstrap.md) offered `"bundler"` or
  `"nodenext"` for `moduleResolution`. `"bundler"` cannot work: it is invalid
  with `module: "commonjs"`, and this is Node-hosted test code, not bundler
  input.
- **Why it matters:** the real decision was the **pair** — `module` and
  `moduleResolution` together — not the single field the ticket named. A
  mismatched pair does not compile.
- **Cost:** none. It was caught by running `tsc` against the real scaffold before
  the config was written.

### 2. Check that a batch can pass its own gates

- **What:** batch [1.1](p1-01-toolchain-bootstrap.md) required
  `npm run typecheck` to exit 0, but the tsconfig `include` named only files that
  batch [1.3](p1-03-scaffold-core.md) would ship. With none of them present,
  `tsc` fails with `TS18003 No inputs were found in config file`.
- **Why it matters:** the batch could not meet its own acceptance criterion. No
  amount of care inside the batch would have fixed it; the boundary was wrong.
- **Cost:** one file moved between batches, agreed before work started. Had it
  surfaced later it would have looked like a toolchain fault.
- Now a rule. See the table above.

### 3. "Latest stable" can collide with a batch five steps away

- **What:** npm `latest` for TypeScript is 7.0.2. Installing it makes batch
  [1.6](p1-06-eslint.md) fail to install at all, because
  `typescript-eslint@8.69.0` declares `typescript: ">=4.8.4 <6.1.0"`. Reproduced
  as a hard `ERESOLVE`.
- **Why it matters:** the recorded rule was "raise to the latest stable version".
  Following it literally would have blocked a later batch, and the block would
  have appeared far from its cause.
- **Cost:** none, because the peer range was checked before installing. The pin
  and its expiry condition are recorded in
  [linting-formatting.md](../../.claude/context/linting-formatting.md).

### 4. An accessibility fix silently killed an animation

- **What:** batch [1.2](p1-02-land-test-hooks.md) set `hidden` on closed modals
  so they leave the tab order. `hidden` is set in the same synchronous block that
  toggles the `show` class, so the browser never gets an intermediate style
  recalculation and `transition: opacity 0.2s` never runs.
- **Why it matters:** the CSS is still there and still looks correct. Nothing in
  review would show it. It was found by measuring opacity over time: already `1`
  three milliseconds into an open, already `0` two milliseconds into a close.
- **Cost:** a cosmetic regression shipped, recorded as
  [DEF-016](def-registry.md) rather than fixed in a batch that had to land the
  file unchanged.

### 5. Unreachable code attracts tests

- **What:** twice. Prior-art scenario LP-010 was a `P0` test written against a
  branch of `saveGroup` that no UI path can reach. Then batch
  [1.3](p1-03-scaffold-core.md) found [DEF-017](def-registry.md): the inline
  month price input is rendered into `#monthlySection` by the same handler that
  sets that section to `display: none`. The comment on the line above reads
  "Re-render to show inputs".
- **Why it matters:** both were listed as real, reachable features — LP-010 in a
  coverage document, DEF-017 as a **core** control in RP-01. Reading the source
  supports that reading. Only exercising the app refutes it.
- **Cost:** LP-010 was caught by research before any test was written. DEF-017
  was caught while writing the contract spec, which now asserts the hook as
  attached and hidden.
- Now a rule. See the table above.

### 6. When a rule cannot be honoured, change the record

- **What:** [DEF-016](def-registry.md) was first recorded as pinned by a spec in
  batch 1.3. That cannot be done within this project's own rules: the desired
  behavior is a 200 ms CSS transition, polling opacity mid-transition is flaky by
  construction, and pixel regression is barred until batches
  [2b.6](p2b-06-svg-icons.md) and [2b.8](p2b-08-visual-regression.md).
- **Why it matters:** the honest options were to change the record or to write a
  flaky test that made a column look satisfied. A registry that contains one
  fictional pin cannot be trusted for the other sixteen rows.
- **Cost:** none. The row now carries no spec pin, the same treatment
  [DEF-015](def-registry.md) gets, with the reason written down.
- Now a rule. See the table above.

### 7. A formatter destroys byte-identity as a transfer proof

- **What:** batch [1.3](p1-03-scaffold-core.md) adopted 31 files from the
  prior-art scaffold. Prettier reformatted 37 of the 38 scaffold files, mostly
  quote style, so "identical to the working copy" stopped being checkable by
  `cmp`.
- **Why it matters:** "I copied it unchanged" is exactly the claim a reviewer
  cannot verify by eye across 1,850 lines.
- **Cost:** none. Formatting both sides and running `diff -r` restores a real
  guarantee, and that is what the batch page reports.
- Now a rule. See the table above.

### 8. A batch that deploys cannot fully close at PR time

- **What:** batch [1.2](p1-02-land-test-hooks.md) had an acceptance criterion
  that only holds after the merge, because publishing is branch-based and the
  merge **is** the deploy.
- **Why it matters:** the criterion cannot be ticked in the PR that has to
  satisfy it. Ticking it early is the failure mode; see lesson 9.
- **Cost:** one small follow-up PR recording the live result. Batch
  [2a.4](p2a-04-cutover.md) is the next batch with the same shape, and it is the
  cutover.

### 9. Do not tick an acceptance box before running the check

- **What:** during batch [1.2](p1-02-land-test-hooks.md), acceptance boxes were
  marked done and the checks were run afterwards. Twice.
- **Why it matters:** the checks passed, so the page ended up accurate by luck.
  That is exactly how a batch page comes to assert a green check that never ran.
- **Cost:** none this time. The order is: run, then record.

### 10. Fetch before branching, and put `assert` in edit scripts

- **What:** a branch cut from a stale `origin/main` produced a file whose every
  scripted `.replace()` matched nothing. The script reported success and wrote a
  file with none of the intended edits.
- **Why it matters:** silence was the failure. An unanchored string replacement
  cannot tell "already correct" from "target absent".
- **Cost:** one wasted edit cycle. Adding `assert old in s` turned the next
  mismatch into a loud failure instead of a plausible-looking wrong file.

When a batch teaches something that changes how later batches are run, add an
entry here in the same PR, and promote it to a context file if it is a rule.

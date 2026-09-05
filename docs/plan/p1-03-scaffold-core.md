# Batch 1.3 — Scaffold core: config, fixtures, smoke, testid contract

Phase 1 · [Plan home](README.md) · Prev: [1.2](p1-02-land-test-hooks.md) · Next: [1.4](p1-04-feature-specs-1.md)

## Goal

Commit the support layers, one smoke spec, and the testid-contract spec —
everything green. The Playwright config already landed in batch 1.1.

## Tasks

- [x] ~~Commit `playwright.config.ts`~~ — **moved to batch 1.1.** The tsconfig
      `include` names it, so without it `npm run typecheck` cannot pass in 1.1
      (`TS18003`). It is repo-root toolchain config, not test code. Reason
      recorded in [1.1](p1-01-toolchain-bootstrap.md).
- [x] Commit `e2e/ui/`: fixtures (storage seed and reset), page objects,
      support helpers, and the Screenplay layer (kept — user decision; see
      [testing.md](../../.claude/context/testing.md)). 31 files.
- [x] Write one smoke spec: app loads, empty state text shows, a group can be
      added. Cover the batch-1.2 modal fix: closed modals are not reachable.
- [x] Write the testid-contract spec: it lists the 8 frozen testids and the
      6 dataset hooks and fails if any is missing or renamed.
- [x] Disposition the four working-copy docs. Recorded below.

## What landed

`e2e/ui/` is the working copy's content, unchanged. Prettier reformatted it —
37 of the 38 scaffold files change under Prettier defaults, almost all of it
quote style. That the content is untouched was proved rather than asserted:
formatting both sides and running `diff -r` reports no difference.

Two new specs under `e2e/features/`, which is the `testDir`:

| Spec                      | What it does                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`           | Three state transitions: the planner opens on the empty state, a group can be added, and closed modals stay out of the tab order and the accessibility tree.        |
| `testid-contract.spec.ts` | Five tests enumerating the 8 frozen testids and the 6 dataset hooks, each asserted in the state that renders it, plus a completeness check across all three states. |

The smoke spec asserts modal reachability **through roles**, not through the
`hidden` attribute. `hidden` is the mechanism; what matters to a keyboard or
screen-reader user is that the controls are simply absent. The assertion is that
the only reachable buttons are the five toolbar ones.

## Acceptance criteria

- [x] `npx playwright test` exit 0 — 8 passed. Also 24 passed under
      `--repeat-each=3`, so the suite is stable, not merely green once.
- [x] The contract spec fails if a testid is renamed, verified once by mutation.
      Renaming `group-card-name` to `group-card-title` failed two tests, the
      completeness check reporting
      `frozen hooks missing from the app: group-card-name`. The mutation was
      reverted and `index.html` verified byte-for-byte identical afterwards.
- [x] Each of the four docs has a recorded disposition, below.

## Disposition of the four working-copy docs

| Doc                            | Disposition                      | Reason                                                        |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------- |
| `functionality.md`             | **Adopted** unchanged            | Reviewed against the app; accurate. A short, honest overview. |
| `tech-details.md`              | **Adopted with two corrections** | See below.                                                    |
| `bdd-usage.md`                 | **Deferred to batch 1.5**        | See below.                                                    |
| `qa-coverage-investigation.md` | **Dropped**                      | See below.                                                    |

### `tech-details.md` — adopted, two corrections

Its state model, data model, storage keys and CSV format all check out, and its
Test Hooks section now matches the app.

1. **CSV import behavior was partly false.** It claimed the parser "throws on
   missing columns, malformed CSV, or invalid month values". Empty file, missing
   header and bad month do throw and preserve data, but a stray quote that
   happens to balance is accepted silently and replaces existing data with
   garbage — [RP-01](../research/rp01-app-inventory/rp01-app-inventory.md) D12,
   registry [DEF-006](def-registry.md). The claim is corrected and now points at
   the defect.
2. **The Test Hooks section was false and is now true.** RP-01 records it as
   "not true of the deployed app" because it described the then-uncommitted
   working copy. Batch 1.2 landed those hooks. A note says so, so that a reader
   following RP-01 is not left thinking the section is still wrong.

### `bdd-usage.md` — deferred to batch 1.5

It is Gherkin mirroring the seven feature specs one-to-one, and
[RP-03](../research/rp03-test-architecture/rp03-test-architecture.md) says as
much: it "mostly mirrors the current Playwright suite rather than broadening
behavioral expectations". Those seven specs arrive in batches 1.4 and 1.5.
Adopting the document now would commit a description of tests that do not exist,
which is exactly the kind of untrue statement batch 1.0 exists to prevent. It
costs nothing to wait: the file is uncommitted prior art and is not going
anywhere. Adopt it in 1.5, once the specs it describes are real.

### `qa-coverage-investigation.md` — dropped

Its behavioral claims cannot be trusted and its durable value has already been
taken. RP-01 and RP-03 both independently found scenario **LP-010 false**: no UI
path reaches `saveGroup` while the calendar is open, so a `P0` scenario was
written against unreachable code. Its line references are off by 8–18 lines
throughout, because they resolve against the working copy. Its "22/22 passed"
run describes a file that was never deployed.

Correcting it would mean re-verifying every behavioral claim and rewriting
roughly forty line references, for a document whose good parts RP-03 has already
adopted by name — the low-signal ARIA snapshots, the filename-only CSV export
test, the case for moving CSV parsing to a lower layer, and the list of missing
high-value scenarios. Keeping it would leave a plausible-looking document that
future work would cite and be misled by.

The file was never committed, so dropping it means simply not adopting it. It
stays in the working copy and the decision is reversible.

## Two gaps found while doing this batch

**Clock control is not in the fixtures.** This batch's own task list promised it
and [testing.md](../../.claude/context/testing.md) requires it — the app reads
`new Date()` in many places. The scaffold sets `timezoneId: 'UTC'` and nothing
more; there is no use of the Playwright clock API anywhere in `e2e/ui/`. Both
new specs were written to be date-independent so that neither depends on it, but
the feature specs in 1.4 and 1.5 will need it. Recorded as a TBD in testing.md.

**[DEF-017](def-registry.md), a new defect.** The inline month price input is
rendered into `#monthlySection` by the very handler that sets that section to
`display: none`, so the control is in the DOM but no user can ever see it. The
code comment on that line reads "Re-render to show inputs", so the intent was
clearly the opposite. Confirmed at runtime: in view mode the input is not in the
DOM at all, and in edit mode it is attached but has no client rects. This is the
same class of error as LP-010 — RP-01 lists this control as **core**, and the
coverage document proposed a test for it. Both describe something unreachable.

## Merge order and dependencies

Depends on 1.2. Merges before 1.4. Deployable: yes — no change to `index.html`.

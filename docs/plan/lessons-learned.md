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

### 11. Pinning the browser clock fixes only half of a date problem

- **What:** batch [1.5](p1-05-feature-specs-2.md) needed deterministic dates.
  `page.clock` is the obvious answer and it is not sufficient: the specs choose
  their test months in **Node**, through `faker.date.soon()`, while spec files
  are being collected. No browser API can reach that.
- **Why it matters:** the browser pin alone looks like it works — most specs go
  green — and then one test fails because the app renders a row for the pinned
  month while the spec looks for the host month. That is what happened, and it
  was the only visible symptom of a whole class of drift.
- **Cost:** none, once found. Both clocks are pinned to the same instant, and
  the decision is recorded in
  [testing.md](../../.claude/context/testing.md). Measured: the same faker seed
  yields `2027-02` against one reference date and `2027-04` against another.

### 12. A lint rule that fires 63 times is usually mis-configured, not wrong

- **What:** enabling ESLint in batch [1.6](p1-06-eslint.md) produced 98 findings,
  and 63 of them were one rule: `playwright/no-standalone-expect`. The first
  guess — that the Screenplay layer is structurally incompatible with it — was
  wrong. Every one was in a spec file, because each spec builds its own test
  object with `configureTest(...)` and the plugin recognises test blocks by
  name.
- **Why it matters:** the tempting fix is to switch the rule off for the whole
  directory, which quietly loses a real check — an `expect` at module scope
  never runs. Registering the names in `globalAliases` kept the rule working and
  cut the count to 35.
- **Cost:** a list of test-object names that a new spec must extend. The lint
  fails loudly if it is not, so it cannot rot silently.

### 13. A lint error can be the type system lying, not the code being wrong

- **What:** `no-unnecessary-condition` called `?? "UAH"` dead code in
  `planner-state.ts`. The fallback is correct — the group list can be empty —
  but `groups[0]` was typed as always present, so TypeScript believed the guard
  could never fire.
- **Why it matters:** the obvious fix, deleting the fallback, would have
  introduced a real bug. The right fix was `noUncheckedIndexedAccess`, which
  makes the type match reality; the rule then agreed the guard was needed.
- **Cost:** two other index accesses had to be made honest as well. Recorded in
  [linting-formatting.md](../../.claude/context/linting-formatting.md).

### 14. An intermittent failure is a race until proven otherwise

- **What:** after batch [1.10](p1-10-coverage-overrides-pricing.md)'s specs
  landed, the full suite failed roughly half the time — a different test each
  run, never in isolation, always with a value that was simply absent.
- **Why it matters:** every visible symptom pointed at "slower under load, needs
  a longer timeout". The actual cause was the app pulling focus back to the name
  field 100 ms after the dialog opens, so a fast test typed the price into the
  name box. Raising a timeout would have hidden it and left a real usability
  problem undiscovered.
- **Cost:** none, once found. Instrumenting the assertion to dump the stored
  state on failure named it in a single run. The wait is now on the app's own
  focus signal, not a sleep.
- **How to apply:** when a test fails intermittently, print the state it
  actually saw before touching any timeout. "Received: undefined" is a fact
  about state, not about speed.

### 15. Three registry entries described the wrong symptom

- **What:** DEF-008, DEF-003 and DEF-001 were all written from reading the code,
  and all three turned out to describe something other than what a user sees.
  DEF-008 said Cancel does not revert a price — storage was right and the screen
  was wrong. DEF-001 said the page goes dead — it looks entirely normal and is
  inert. DEF-003 was reached from a missing currency rather than a malformed
  one.
- **Why it matters:** in two of the three, the pin written from the registry
  wording **passed while the defect was present**. A pin that green-lights its
  own defect is worse than no pin, because it converts an open problem into
  apparent coverage.
- **How to apply:** write the pin against what a person would report, not what
  the code suggests, and prove it fails by removing the flag before trusting it.
  When the two disagree, the registry entry is the thing to correct.

### 16. A spec can pass against the wrong app and say nothing

- **What:** batch [2a.3d](p2a-03d-port-template-message-csv.md) pointed the whole
  suite at the React build. Most storage assertions failed loudly, because
  `storedGroups(page)` reads the unprefixed key and the port writes `next:`
  ones. One did not: `calendar-navigation-boundaries` compares against an empty
  object, so reading nothing looked exactly like the expected result.
- **Why it matters:** twenty-nine failures were a to-do list. The thirtieth spec
  was the dangerous one — it reported coverage of an app it never read.
- **Cost:** none this time, because the failures around it forced a review of
  every storage read in the suite.
- **How to apply:** when a suite starts running against a second target, audit
  every direct read of that target's state, not only the ones that fail. The
  rule this became is in
  [testing.md](../../.claude/context/testing.md) — take the prefix from the
  fixture, never from a constant.

### 17. The event a handler is bound to is behaviour, not detail

- **What:** the legacy bulk-price field is bound to `oninput`; the ported
  component used `onBlur`. Both feel identical to a person, who tabs away.
  `locator.fill()` does not blur, so under test the ported feature did nothing
  at all.
- **Why it matters:** the two are indistinguishable by reading the rendered
  page, and only one spec in twenty happened to notice. A port reviewed by
  eye would have shipped it.
- **How to apply:** when porting a handler, port the event it is bound to, and
  treat a changed event as a changed requirement.

### 18. A project-level `grep` cannot be lifted from the command line

- **What:** the ported Playwright project selects tests with `grep: /@ported/`.
  Playwright **ands** that with the CLI's `--grep`, so there is no way to ask
  "run everything against `/next/`" from the command line — which is the first
  thing you want when sizing how much of a port is missing.
- **Why it matters:** without that answer the batch is guesswork. A throwaway
  config that spreads the real one and drops the project's `grep` gives it in
  one run: fifty-one failures before the work, five after, and the five were
  the real findings.
- **How to apply:** survey with a temporary config before porting and again
  after. Delete it before committing — it is a measuring tool, not a fixture.

### 19. A behavioural suite cannot see that an app has no styles

- **What:** four port slices, 172 passing tests across two apps, a frozen testid
  contract and a golden message asserted byte for byte — and the React build had
  no stylesheet at all. Nothing failed, because nothing asked. It surfaced only
  when the cutover was about to be prepared and two screenshots were put side by
  side.
- **Why it matters:** the plan scheduled styles for batch 2b.7, seven batches
  after the cutover, so the gap and the plan agreed with each other. The suite
  agreed too. The app would have gone live looking like raw HTML, and the first
  person to notice would have been the teacher.
- **Cost:** one unplanned batch, [2a.3e](p2a-03e-port-styles.md), which is
  cheaper than the alternative only because it was caught before the cutover and
  not after.
- **And then it happened again, one batch later.** 2a.3e restored the
  stylesheet and left the toolbar on its own row under the title, arguing on its
  own page that the difference was acceptable. The owner looked at the staging
  build and said the layout was broken. A difference you can see is not made
  acceptable by writing it down; that is the author marking their own homework.
  Batch [2a.3f](p2a-03f-layout-fix-visual-checks.md) fixed it and added the
  checks — accessibility snapshots, geometry, screenshots — that would have said
  so without a person looking.
- **How to apply:** before a batch that replaces what a user sees, look at both
  versions with the same data, and assert the layout, not only the behaviour.
  Geometry assertions are the cheap, portable half: same row, right-aligned,
  centred, covered. A test suite is evidence about behaviour and says nothing
  about appearance unless something asks.

### 20. "The PR touches three files" was a guarantee about the wrong thing

- **What:** batch [2a.4](p2a-04-cutover.md) promised a cutover PR containing the
  workflow change, the `index.html` deletion and one `.prettierignore` line, and
  called that short list the rollback guarantee. Deleting `index.html` also
  deletes the app that a whole Playwright project, four specs and two test tags
  were pointed at. The real PR touches thirty files.
- **Why it matters:** the guarantee people actually rely on is "one revert
  restores everything", and that comes from the PR being one squashed commit,
  not from its size. Written as a file count, it would have been met by leaving
  a red suite on `main` — the letter of the rule against its purpose.
- **How to apply:** when a criterion counts something, ask what it is standing
  in for and state that instead. Then check the count is even achievable — this
  one was written before the two-project suite existed.

### 21. A retry turns a failed comparison into a green run

- **What:** `playwright.config.ts` sets `retries: 2` in CI. Playwright's
  `failOnFlakyTests` defaults to **false**, so a test that fails and then passes
  is reported "flaky" and the run still exits 0. For a slow locator that is the
  point of retries. For a screenshot it is laundering: a pixel comparison that
  passes on the second attempt is telling you the two renders differ.
- **Why it matters:** batch [2b.8](p2b-08-visual-regression.md) was about
  turning a skipped check into a real one. Without this setting the check would
  have been real and still unable to fail — the skip would have moved somewhere
  less visible rather than gone.
- **Cost:** none. It was found by an adversarial review of the plan before the
  plan was implemented, not by a screenshot regression reaching `main`.
- **How to apply:** when adding a class of assertion that can be
  environment-sensitive, check what the runner does with a retry before
  trusting the exit code.

### 22. `workflow_dispatch` reads its trigger from the default branch

- **What:** the baseline workflow was to be dispatched against a feature branch,
  run in a container, and hand back the PNGs. `gh workflow run baselines.yml
--ref <branch>` fails with "could not find any workflows named baselines.yml"
  until the file is merged to `main` — GitHub reads the trigger list from the
  default branch, and only then uses the ref's copy of the file.
- **Why it matters:** it forces two pull requests, in one order. The workflow
  and the container have to land first, with the old skip still in place so
  `main` stays green; only then can the branch that removes the skip get its
  baselines. Discovering this while implementing would have meant a red `verify`
  in front of the live site.
- **How to apply:** a self-bootstrapping CI change is two PRs. Say which is
  first and why, on the batch page, before writing either.

### 23. A flat config that spreads a preset and then sets `rules:` discards it

- **What:** `eslint.config.mjs` spreads `...playwright.configs["flat/recommended"]`
  and then writes its own `rules:` key. The second key replaces the first
  wholesale, so **one** playwright rule was active where the preset defines
  thirty-six. Nothing failed; `npx eslint --print-config` said so plainly.
- **Why it matters:** for the whole of Phase 1 and 2 the suite was linted by a
  preset that was not running, and that reads as coverage on the batch pages
  that adopted it.
- **Cost so far:** unknown, and not paid in this batch. Restoring the preset
  (`rules: { ...preset.rules, … }`) reports 39 problems, almost all
  `playwright/no-standalone-expect` firing on the per-spec `configureTest()`
  aliases the rule cannot recognise as test functions. That is a design
  decision about the Screenplay layer, not a lint fix — recorded as a task on
  [3.7](p3-07-cleanup.md).
- **How to apply:** after composing a flat config from presets, print the
  resolved config and count what is actually on. A preset in the file is not a
  preset in effect.

### A field-by-field assertion cannot see a field that should not exist

**Batch [2b.10](p2b-10-state-store.md).**

- **What:** the storage write-back spec has asserted the three keys field by
  field since batch 1.13. It cannot fail on an **extra** field, so the risk the
  store introduced — reducer bookkeeping (`pending`, `loadError`) reaching
  storage if the subscriber ever serialised the state object instead of the
  three slices — was invisible to it. A `toEqual` against the seeded fixture
  plus the one edit made can only pass if nothing else moved.
- **Why it matters:** the same gap made a real behaviour invisible for eight
  batches. The new assertion failed on its first run because saving a group
  overwrites the app-wide default currency with that group's currency
  (DEF-026) — old, faithful-to-legacy behaviour that no existing spec asserted,
  because the fixture the old test used had the same currency everywhere.
- **Cost so far:** none; the assertion was written before the code could ship
  wrong, and the defect it surfaced was registered rather than fixed inside a
  batch that does not own it.
- **How to apply:** when a change adds fields to a state object that is
  adjacent to a serialised one, assert the serialised form whole, against a
  fixture. Choose the fixture so that the values differ from each other —
  a fixture where every field is the same value cannot distinguish the field
  that was written wrongly.

### 24. `"type": "module"` at the root is not a local change

- **What:** batch [4.2](p4-02-api-skeleton-local-server.md) needed Node to stop
  guessing the module type of `api/app.ts`. The obvious fix — `"type": "module"`
  in the root `package.json` — produced **693 type errors in files the batch
  never touched.** The root `tsconfig.json` uses `module: nodenext`, where ESM
  requires explicit file extensions on relative imports, and all 34 end-to-end
  specs import without them.
- **Why it matters:** the failure was nowhere near the change, and the change
  was one line that reads as configuration housekeeping. Reverting it then
  broke the opposite way: without a declared type, TypeScript modelled the
  backend as CommonJS while Node ran it as ESM, so `typecheck:api` rejected
  code that worked. Neither extreme was right.
- **How to apply:** module type is resolved from the **nearest** `package.json`,
  so scope it to the subtree that needs it — `api/package.json` with
  `{ "type": "module" }`. The repository already did this in the other
  direction: `docs/research/tools/package.json` pins `"type": "commonjs"`. Before
  changing anything in the root `package.json` that a resolver reads, run the
  checks for **every** TypeScript project, not just the one being worked on.
- **Cost:** one cycle. Cheap only because `npm run typecheck` was run before the
  commit; the errors were invisible to the batch's own tests, all of which
  stayed green throughout.

### 25. A stacked pull request dies when its base branch is deleted

- **What:** batch 4.2 was opened against batch 4.1's branch, because it depends
  on it. Merging 4.1 with `gh pr merge --squash --delete-branch` — the habit
  every other batch here was merged with — **closed 4.2 automatically**, and
  GitHub then refused both to reopen it and to retarget it: "Cannot change the
  base branch of a closed pull request." The work was intact; the pull request,
  with its description and its review history, was not recoverable.
- **Why it matters:** the plan is a chain of dependent batches, and Phases 5 and
  6 are chains too (5.1 → 5.2 → 5.3 → 5.4). The obvious way to express "4.2
  depends on 4.1" is the thing that loses the pull request.
- **How to apply:** open every batch against `main`, even a dependent one, and
  say in the description what it depends on. If the dependency genuinely cannot
  wait, either merge the parent **without** deleting its branch, or retarget the
  child to `main` _before_ merging the parent — while it is still open.
- **Cost:** one replacement pull request and a rebase. No lost work, because the
  branch and its commit survive the closure.

### 26. Every local test ran the source; production ran the compiler's output

- **What:** batch [4.2](p4-02-api-skeleton-local-server.md) shipped
  `api/[...all].ts` containing `import app from "./app.ts"`. Every check was
  green — 335 unit tests, 183 end-to-end, three typechecks, lint — and the first
  deployment returned 500 on every API route:
  `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/api/app.ts' imported from
/var/task/api/[...all].js`.
- **Why it matters:** Node 24 runs TypeScript by stripping types, so `./app.ts`
  is a real file locally. Vercel **compiles** — per file, not bundled — so
  `app.ts` becomes `app.js` and the specifier points at nothing. The two
  disagree and no spelling satisfies both: `./app.ts` resolves only under type
  stripping, `./app.js` and `./app` only after compilation. The suite could not
  see it, because `api/health.test.ts` imports the application object and the
  end-to-end spec goes through `scripts/serve.mjs` — **both run the source, and
  nothing ran the compiled output.** The Vercel entry file was the one piece of
  code with no coverage, and it was the one that failed.
- **How to apply:** when a runtime compiles code that the tests run directly,
  one test must compile it the same way and execute the result.
  `api/deployed-entry.test.ts` does that, and it was checked in both directions
  — it fails when the import is put back. For the code itself: nothing under
  `api/` imports a sibling by relative path, which is why the application and
  the entry are one file. Give `db/` and `shared/` bare specifiers in Phases 5
  and 6, because a package name resolves the same either way.
- **Cost:** one failed production deployment and one fix batch. It cost nothing
  else only because the site the teacher uses is still GitHub Pages; after the
  batch 4.3 cutover the same mistake is an outage.

### 27. The second deployment failed silently, and silence is worse than a crash

- **What:** with lesson 26's import fixed, the redeploy stopped crashing and
  started **hanging**. `/` answered in 0.4s; `/api/health` returned nothing for
  60 seconds and timed out. The cause: `export default app.fetch`. Vercel's
  Web-standard export is an _object with a `fetch` method_, and a bare function
  is read as a Node.js `(request, response)` handler — so Vercel called it with
  `IncomingMessage` and `ServerResponse`, threw away the `Response` Hono
  returned, and waited for a `response.end()` that a Web-standard handler never
  calls.
- **Why it matters:** lesson 26 produced a stack trace naming the exact file.
  This produced **nothing** — no error, no log line, no failed deployment. The
  status stayed green. A wrong guess about a platform's calling convention does
  not announce itself, and "the deployment succeeded" says nothing about whether
  the function can answer.
- **How to apply:** read the platform's own documented example for the export
  shape, and assert that shape in a test. The first version of
  `api/deployed-entry.test.ts` called `entry.fetch()` directly and passed under
  **both** exports, so it could not see this — behaviour was the wrong thing to
  assert. It now checks that the default export is not a function and does carry
  a `fetch` method, verified against the broken export. More generally: after
  any deployment, request a real route and read the body. A green status is not
  a working function.
- **Cost:** a second failed production deployment, found by curl rather than by
  anything Vercel reported.

### 28. `api/` is a routing table, and test files went to production with it

- **What:** the deployment reported four functions against a recorded budget of
  one. Vercel makes every `.ts` file under `api/` a function at its own public
  path, so `api/health.test.ts`, `api/deployed-entry.test.ts` and
  `api/vitest.config.ts` were all deployed. `/api/health.test` answered — with a
  500, but it answered, and `/api/nope` returns 404, which is how the difference
  was told.
- **Why it matters:** co-locating tests beside the code is this repository's
  habit everywhere else, and it is exactly wrong in `api/`. Nothing leaked, only
  because `vitest` is not a production dependency and the functions crashed on
  import — but `deployed-entry.test.ts` spawns a compiler, and a test file one
  request from the internet is not something to leave to luck.
- **How to apply:** `.vercelignore` keeps everything but the entry off the
  deployment, and `api/one-function.test.ts` fails if a new file under `api/` is
  neither the entry nor ignored, so the next one has to be classified on
  purpose. More generally: when a directory has meaning to a platform, adding a
  file to it is a deployment change, not a source change.
- **Cost:** none realised. Found by reading `lambdaRuntimeStats` on the
  deployment rather than by anything failing — the owner had checked the
  dashboard and reported one function, and the count was four.

### 29. Three runs against production, and none of them measured the app

- **What:** batch 4.1 asks for the full suite against the deployed URL. Three
  attempts, three different wrong answers. The first reported "141 passed, exit
  0" — the exit code was **`tail`'s**, not Playwright's, because the run was
  piped. The second was killed mid-flight when an earlier background job's
  cleanup deleted the config file both were using. The third drowned in "Target
  page, context or browser has been closed" because builds, typechecks and
  formatting were running on the same machine at the same time. Then the edge
  began returning 403 to that IP — Vercel's automatic DDoS mitigation, provoked
  by the runs themselves.
- **Why it matters:** every one of those looked like a result. "141 passed" and
  "84 did not run" are both plausible readings of a suite that had, in fact,
  measured nothing. The 403s looked exactly like a broken deployment, and the
  site was healthy the whole time — proven by fetching the same URL from
  outside the blocked IP.
- **How to apply:** never read `$?` through a pipe — `cmd | tail` reports
  `tail`'s status. Give every concurrent job its own scratch path. Run a browser
  suite with nothing else on the machine. And against a deployment, run it once
  with `--workers=1`; a suite is indistinguishable from an attack at the edge.
- **Cost:** about twenty-five minutes of runs, and a stretch of believing
  production was down when it was not.

### 30. A devDependency named by production code is a module that cannot load

- **What:** batch 5.1a needed one database interface for two runtimes — `pg`
  against Neon on a deployment, PGlite in tests and under `scripts/serve.mjs`.
  The obvious shape is one module that imports both drivers and picks. That
  module cannot run on Vercel: `@electric-sql/pglite` is a devDependency, so it
  is absent from the deployment's `node_modules`, and an ESM import is resolved
  when the module loads, not when the branch is taken. The branch that "never
  runs in production" would have crashed the function on import.
- **Why it matters:** it is invisible to every local check. Locally both
  packages are installed, so the module loads, the tests pass and the typecheck
  is clean. It is the same class of failure as lessons 26 and 27 — the
  deployment's environment differs from the test's in a way no test models —
  and it would have produced the same result: a function that cannot start.
- **How to apply:** the production path must not _name_ a devDependency, even
  on a dead branch. Split the file: `db/index.ts` holds `pg` and an injection
  point, `db/testing.ts` holds PGlite, and only tests and the local server
  import the second. More generally, when one seam spans two environments, put
  the environment-specific halves in separate modules and inject, rather than
  importing both and branching. A dynamic `import()` would also defer the
  resolution, but it leaves the specifier in the file for a bundler or a
  tracer to find, so it is the weaker answer.
- **Cost:** none realised. Caught while designing the seam, because lesson 26
  had already made "what does the deployment actually have?" the first question
  rather than the last.

### 31. The specifier resolved, and the file behind it was never shipped

- **What:** batch 5.1a gave `db/` a bare specifier through an npm workspace
  package, exactly as lesson 26 prescribed, and proved it in every local
  direction: Node 24 strips types inside `node_modules`, `tsc` leaves a bare
  specifier untouched in its output, and `api/deployed-entry.test.ts` compiled
  the entry the way Vercel does, ran it, and failed correctly when the specifier
  was broken. The deployment returned 500 on every request:
  `ERR_MODULE_NOT_FOUND: Cannot find module
'/var/task/node_modules/@lesson-planner/db/index.ts' imported from
/var/task/api/[...all].js`.
- **Why it matters:** read the path in that error. Vercel traced the package and
  **created the directory** — then shipped no `index.ts` into it. It compiles
  what is under `api/` and does not build a workspace package's TypeScript
  source. So the specifier resolved correctly and the file it named did not
  exist. Lesson 26's rule was right and incomplete: a bare specifier is
  **necessary but not sufficient**. The thing it names also has to be something
  the platform actually ships. Every local check was blind to this for one
  reason — on a laptop the `.ts` file is really there, so the compile-and-run
  test passes while modelling the compiler and not the packaging.
- **How to apply:** the deployed entry may import published npm packages and
  nothing else — not a sibling, and not a workspace package of this repository.
  `api/deployed-entry.test.ts` now resolves every import in the entry and fails
  if any lands on a `.ts` file, which is the invariant that is actually
  checkable on a laptop: a specifier resolving to TypeScript works under type
  stripping and cannot work anywhere that ships only what it compiled. It was
  verified in both directions. More generally, when a test reproduces one stage
  of a platform's pipeline, ask which stage it is: reproducing the compiler says
  nothing about what gets uploaded.
- **Cost:** one failed production deployment and one fix batch. It cost nothing
  else because the teacher is still on GitHub Pages — which is precisely why the
  workspace shape was tried now rather than after the 4.3 cutover, where the
  same mistake is an outage. The gamble was taken deliberately and it lost;
  taking it at the cheapest moment is what made that acceptable.

### 32. "Every check has passed" was true, and three of the four were missing

- **What:** a watcher on pull request 66 polled `gh pr checks` and concluded
  "all checks green" while the `checks` job — the one that runs lint, three
  typechecks, the PII scan, 347 unit tests and 189 end-to-end tests — was still
  **pending**. Its condition was "at least one check exists and none is
  pending". After a push, GitHub re-queues the workflow, and for a few seconds
  the only checks registered were Vercel's three, which had already passed. The
  condition was true and meaningless. It was caught because the result was read
  before acting on it, not because anything failed.
- **Why it matters:** this is the third appearance of one shape in this
  repository. Lesson 21: a retry turns a failed comparison into a green run.
  Lesson 29: "141 passed, exit 0" was `tail`'s exit code. Here: a quantifier
  over an empty-ish set. Every one of them **reports success without having
  measured the thing it names**, and every one is invisible unless you ask what
  the check would say if the subject were absent. An automated merge on that
  signal would have merged on Vercel's opinion alone.
- **How to apply:** a readiness condition must name what it requires, not
  quantify over whatever happens to be present. "The job called `checks` exists
  **and** passed" is checkable; "nothing present is pending" is not. The same
  rule the test suite already follows — a guard spec needs a completeness check,
  not only per-item assertions — applies to anything that gates a merge or a
  deploy.
- **Cost:** none. The merge was not made.

### 33. The catch-all was proven, on the only depth anyone had tried

- **What:** `api/[...all].ts` has been the whole backend since batch 4.2, and
  backend.md recorded that the name was "proven, and no `vercel.json` rewrite is
  needed". It was proven against `/api/health` and `/api/nope` — both **one**
  segment below `/api`. Batch 5.2a added Better Auth, whose every route is
  deeper: `/api/auth/get-session`, `/api/auth/callback/google`. Measured on
  production after the merge:

  | Path                    | Result                   | Reached the function? |
  | ----------------------- | ------------------------ | --------------------- |
  | `/api/health`           | 200                      | yes                   |
  | `/api/nope`             | `404 Not Found` — Hono's | yes                   |
  | `/api/auth`             | 500                      | yes                   |
  | `/api/auth/get-session` | `NOT_FOUND` — Vercel's   | **no**                |
  | `/api/a/b/c`            | `NOT_FOUND` — Vercel's   | **no**                |

  The catch-all matched exactly one segment. Sign-in could never have worked.

- **Why it matters:** "proven" was true of every case anyone had run, and the
  cases anyone had run were all one route deep, because for three batches there
  was only one route. The word hid the sample size. **The two 404s look
  identical in a status code and are completely different facts** — Hono's means
  the function answered, Vercel's means it was never called — and only the body
  distinguishes them.
- **How to apply:** when recording that a platform behaviour is proven, record
  _what was tried_. "The catch-all is proven" should have read "the catch-all
  answers one segment below `/api`; deeper paths are untested". The fix is a
  `rewrites` entry in `vercel.json`, and it cannot be verified locally at all —
  `scripts/serve.mjs` does its own routing with Hono, so the local suite is
  green either way. That makes this the fourth member of the family in lessons
  26, 27 and 31: a deployment-only behaviour no local test can see.
- **A second failure rode along, and it is the more embarrassing one.** Batch
  5.2a's own test asserted `expect(status).not.toBe(404)` for an auth route. The
  route was returning **500** — `rateLimit.storage: "database"` needs a
  `rateLimit` table the schema did not define, so Better Auth refused to start
  on every request. A 500 satisfies "not 404". The assertion passed, CI passed,
  and every `/api/auth/*` request failed. A test that asserts what a response
  _is not_ has said almost nothing; assert what it is, and read the body.
- **Cost:** none realised. Both were found by requesting real routes on
  production after the merge and reading the bodies, which is what lesson 27
  says to do and the only reason either was found before sign-in was wired up.

### 34. The headers were missing, and they were not — the edge was serving yesterday

- **What:** batch 5.4a set four response headers in `vercel.json`. Read off
  production about forty seconds after the merge deployed, `/api/health` carried
  all four and **`/` carried only one** — an HSTS with `; preload`, which this
  repository never configured. That looks exactly like "Vercel does not apply
  `headers` to static files", and it would have been written down as such.
  A minute later the same URL carried all four, and the HSTS was ours.
- **Why it matters:** the first response came from the edge cache and belonged to
  the **previous deployment**, which had no header configuration. The stray
  `; preload` was the tell — a value nothing in the repository could have
  produced — and it was nearly read as a Vercel quirk instead of as evidence that
  the response predated the change. Checklist row 18 of batch
  [5.4](p5-04-security-review.md) asks a person to read these headers off the
  live response, and this is the reading that person will get if they check
  immediately after a deploy.
- **How to apply:** when reading anything off a deployment straight after
  shipping it, read `x-vercel-cache` too. `HIT` means the answer may be older
  than the change being verified; `MISS` means it is not. More generally, a
  cache makes "I checked production" ambiguous about _when_ — and a value in the
  response that the repository cannot produce is the cheapest signal that you
  are looking at something else.
- **Cost:** none realised, and about five minutes of believing a header
  configuration was half-ignored.

### 35. Two correct batches, and the seam between them was broken

- **What:** batch 5.4a set `connect-src 'self'` — correct, because auth ran on
  this project's own origin. Batch 5.5 moved auth to Neon, a third-party origin
  — correct, and the reason is on its page. Together they produced an app whose
  Content-Security-Policy blocked every request the auth client makes:
  `Connecting to '…/get-session' violates … "connect-src 'self'". The action has
been blocked.`
- **Why it matters:** neither batch was wrong, and neither batch could have been
  reviewed into catching it — the policy was written before the architecture
  changed, and the architecture changed without anyone re-reading the policy.
  **Nothing else in this app makes a cross-origin request**, so the first thing
  that would have noticed was a person clicking "Sign in" on production.
- **How to apply:** a Content-Security-Policy is a statement about an
  architecture, so it expires when the architecture does. When a batch moves
  _where_ something runs, the policy is part of the blast radius, along with
  anything else that names an origin — `trustedOrigins`, CORS, cookie domains,
  redirect URIs.
  The reason it was caught at all is worth copying: **the suite points the
  client at a real URL and stubs the network beneath it**, so the browser's own
  policy enforcement is in the path. A module-level mock of the auth client
  would have passed happily, because CSP blocks the fetch before it is made.
  Mock as close to the wire as you can stand.
- **Cost:** none realised. Found while wiring the client, one batch before
  anybody could have clicked the button.

When a batch teaches something that changes how later batches are run, add an
entry here in the same PR, and promote it to a context file if it is a rule.

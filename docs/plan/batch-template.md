# Batch page template

Copy this page to start a batch page. Delete the guidance lines in _italics_.
Every section stays, even when its answer is "none" or a named exception, so a
reader can see that the question was asked. The terms are ISTQB terms; their
use in this project is in [testing.md](../../.claude/context/testing.md) Part 1.

**Writing rules (B2 English).** One idea per sentence; most sentences under 25
words. Put the rule or the result first and the reason after it. No idioms or
metaphors. A heading says what the section is about. Use the ISTQB term exactly
as the ISTQB Glossary writes it.

**For a finished batch rewritten to this template:** keep every fact (numbers,
dates, SHAs, commands, file paths, DEF ids, test counts, owner decisions). When
the template asks for something the old page never recorded, write **Not
recorded**. Never invent it. Put this line under the title:
_Rewritten to the template on YYYY-MM-DD. The facts are unchanged. Original:
`<sha>:<path>`._

---

# Batch N.N — <what the batch does, in plain words>

Phase N · [Plan home](README.md) · Prev: _link to N.N_ · Next: _link to N.N_

## Goal

_One or two sentences: what is true after this batch that was not true before._

## Test basis

_What the tests are derived from: a user need, a research report, a defect row,
a decision in a context file, the code that exists. Link each one._

## Product risks

_Which risks from [testing.md §1.8](../../.claude/context/testing.md#18-product-risks)
this batch touches, and any new risk. The risk level sets the coverage strength._

| Risk | Likelihood | Impact | Risk level | Effect on testing |
| ---- | ---------- | ------ | ---------- | ----------------- |
|      |            |        |            |                   |

## Entry criteria

- [ ] _Each batch this depends on is merged (name them)._
- [ ] _The test basis above is written down._
- [ ] _This batch can pass its own exit criteria with only what it ships._

## Test conditions

_One row per thing to test. Write the rows before the tests. Test level: one of
the five in [testing.md §1.2](../../.claude/context/testing.md#12-test-levels).
Test type: functional, non-functional (say which), black-box or white-box.
Confirmation and regression testing go in their own section below. The
coverage items column is what the coverage figure counts._

| ID  | Test condition | Test level | Test type | Technique | Coverage items | File |
| --- | -------------- | ---------- | --------- | --------- | -------------- | ---- |
| C1  |                |            |           |           |                |      |

## Tasks

- [ ] _Small steps, in order. A code task starts with its failing test._

## TDD log

_For code: fill the table. Otherwise name the exception from
[testing.md §1.5](../../.claude/context/testing.md#15-how-we-develop-tdd-and-bdd):
docs only, configuration only, dead-code deletion, or tests for existing
behaviour (with a fault seeding table below)._

| Step     | Commit | Command | Result                             |
| -------- | ------ | ------- | ---------------------------------- |
| Red      |        |         | _fails with: <one to three lines>_ |
| Green    |        |         | _passes_                           |
| Refactor |        |         | _optional; passes_                 |

## Acceptance criteria

_Behaviour a user can observe, as Given / When / Then. No commands and no test
counts here — those are exit criteria._

- [ ] **Given** … **When** … **Then** …

## Exit criteria

- [ ] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii`, `test:unit`, `test:e2e` exit 0 in CI.
- [ ] Coverage: _covered coverage items ÷ identified coverage items_ = _N / N_.
- [ ] The TDD log is complete.
- [ ] Every new anomaly has a DEF row or an explanation on this page.
- [ ] Counts: `test:unit` _N_, `test:e2e` _N_.

## Confirmation and regression testing

_Impact analysis: what else could this change break, and which suites cover it.
If the batch fixes a defect: which test loses `test.fixme` (confirmation
testing)._

## Fault seeding

_Optional; required for high-risk test conditions and for tests written for
existing code. Break the code on purpose and record which tests fail._

| Defect put in on purpose | Result |
| ------------------------ | ------ |
|                          |        |

## Results

_What was observed, with evidence: commands, SHAs, measured values. Anything a
person checked by hand (system integration testing, acceptance testing) goes
here with the date._

## Merge order and dependencies

Depends on _N.N_. Deployable: _yes — why the live site still serves correctly_.

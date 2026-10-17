# RP-11 — Review of the docs, the test process and the AI setup

## Metadata

| Field          | Value                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report id      | RP-11                                                                                                                                                                                                                       |
| Date           | 2026-10-17                                                                                                                                                                                                                  |
| Subject        | Do the docs, the plan pages and the AI instructions match the code? Is development test-first? Do the MCP servers, plugins and skills that a session needs actually work?                                                   |
| Shape          | A small wiki: this hub and four pages. Each page owns its facts.                                                                                                                                                            |
| Read at        | `main` at `a003ce0` (batch 5.4 merged). Line numbers refer to that commit.                                                                                                                                                  |
| Method         | Read-only review. Static reading of every file named, read-only `git` commands, and live read-only calls to the Vercel MCP server. No file was changed while reviewing.                                                      |
| Knowledge base | ISTQB CTFL v4.0.1, CTAL-TA v4.0 and the ISTQB Glossary 4.8.1, through the `istqb-foundation` and `istqb-test-design` skills. Every ISTQB term on these pages is written as the glossary writes it.                         |
| Not verified   | No test suite was run for this review. The Neon MCP server was not called, because it is not signed in (see [the AI setup page](ai-setup.md)). Nothing on these pages is legal advice.                                      |

## Pages

| Page                                    | Question it answers                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [TDD and test style](tdd-verdict.md)    | Is development test-first (TDD)? Are specs written in BDD style? Are ISTQB techniques and terms used?   |
| [AI setup](ai-setup.md)                 | Which MCP servers, plugins, skills, hooks and memory files does a session get, and do they work?        |
| [Records that do not match](records.md) | Which statements in CLAUDE.md, the context files and the plan pages are stale or false?                 |
| [Language](language.md)                 | Which sentences are hard for a reader with B2 English, and how to fix them?                             |

## Summary

1. **TDD is true for defect fixes and not provable for features.** 20 of the 26
   closed defects had a failing test in an earlier batch than the fix. For new
   features, every batch branch holds one commit and is squash-merged, so git
   cannot show which came first. Two pages say the tests came after the code.
   Nothing records or checks the "red" step. Details: [TDD and test style](tdd-verdict.md).
2. **ISTQB is half used.** The tests name their techniques (equivalence
   partitioning, boundary value analysis, decision table testing, state
   transition testing). The process docs never use the words test level, test
   basis, test condition, coverage item, entry criteria, exit criteria,
   confirmation testing or test oracle. There is no current test strategy.
3. **The Vercel MCP server works. The Neon MCP server is configured but not
   signed in.** No file in the repository tells a session to load the ISTQB
   skills or the TDD skill. Details: [AI setup](ai-setup.md).
4. **The records did not keep up with the switch to Neon Auth (batches
   5.5–5.8).** One record is false: batch 5.7 says it removed the test-only
   sign-in code from `scripts/serve.mjs`, and the code is still there. This is
   **DEF-028**. Details: [Records that do not match](records.md).
5. **Some sentences are too hard for B2 readers**: long sentences with nested
   clauses, idioms and metaphors in headings. Details: [Language](language.md).

## What happens next

The owner chose these responses on 2026-10-17:

- Batch [5.9](../../plan/p5-09-review-and-records.md) adds this report and
  corrects the records.
- Batch 5.10 removes the dead test door and closes DEF-028.
- A new phase, **T — Test process (ISTQB)**, writes the test strategy in ISTQB
  terms, adds a batch page template, makes future sessions load the method, adds
  a CI check for TDD evidence, and rewrites every batch page to the template.
  Phase 6 starts after it.

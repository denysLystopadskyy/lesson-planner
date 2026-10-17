# RP-11 — Language

[RP-11 home](rp11-docs-process-review.md) · Prev: [Records that do not match](records.md)

CLAUDE.md asks for "plain English at B2 level. Short sentences. No idioms." The
reader is an engineer whose first language is not English. Most pages follow
the rule. The problems below repeat, and each has a simple fix.

## Patterns that make reading hard

| Pattern                                     | Example (file:line at `a003ce0`)                                                                                         | Fix                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| One sentence of 50 words or more            | CLAUDE.md 126–129: why `api/` is one file, in one sentence with three clauses                                            | Split into two or three sentences. Put the rule first, the reason after |
| One sentence of 60 words                    | testing.md 93–99: why `baselines.yml` does not commit                                                                     | Use a short list: what it does, what it does not do, why                |
| Idiom                                       | CLAUDE.md 162 "a smell test, not a target"; lessons-learned.md 699 "blast radius"; p5-07 52 "sailed past"                | Say it plainly: "a rough check, not a goal"; "how much it affects"     |
| Metaphor used as a technical word           | testing.md 134 and p5-08 77 "load-bearing"; testing.md 222 "vacuous"                                                    | "required"; "the test would pass even if the feature were broken"       |
| Abstract sentence                           | security-auth.md 209–210 "An IP header is worth exactly what the thing that set it is worth"                            | "Trust an IP header only if our own edge sets it"                       |
| Casual phrase                               | p5-07 108–109 "recorded rather than shrugged at"; p5-08 50–51 "a backdoor that ships is a backdoor, however well fenced" | "This is recorded as a cost"; "Any test-only door in deployed code is a risk" |
| Heading that is a metaphor                  | p5-03b "A button that could only fail"; p5-02b "The catch-all matched one segment"                                      | Say what the batch does: "Hide the sign-in button when the server cannot answer" |
| Word with a special ISTQB meaning, misused  | testing.md 67 "Layout is checked at three levels"                                                                        | "three kinds of check" — _test level_ means something else in ISTQB     |

## Rules for new and rewritten pages

These rules go into the batch template in phase T:

1. One idea per sentence. Most sentences under 25 words.
2. Put the rule or the result first, and the reason after it.
3. No idioms or metaphors. If a phrase would not translate word for word, rewrite it.
4. Use the ISTQB term exactly as the ISTQB Glossary writes it, and use it with
   one meaning only. The house words (pin, gate, proof) are mapped to ISTQB
   terms in [TDD and test style](tdd-verdict.md#istqb-techniques-and-terms).
5. A heading says what the section is about, not a story.
6. Use lists and tables for steps, options and comparisons.

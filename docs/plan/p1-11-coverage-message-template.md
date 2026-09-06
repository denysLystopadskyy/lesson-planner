# Batch 1.11 — Coverage: payment message, template, clipboard

Phase 1 · [Plan home](README.md) · Prev: [1.10](p1-10-coverage-overrides-pricing.md) · Next: [1.12](p1-12-coverage-csv.md)

## Goal

Pin the payment message text exactly and cover template editing and clipboard.

## Test design (technique named per group)

- **Equivalence partitioning — template placeholders:** all three used, one
  missing, unknown placeholder left as-is.
- **Golden message test:** for a fixed dataset and clock, the generated
  message equals a stored golden string byte for byte. This is the contract
  the React port must reproduce.
- **Clipboard:** Copy writes the review text; the button feedback shows.
  The false "Copied!" on failure is pinned as DEF-011.
- **Decision table — copy button state:** enabled/disabled by lessons count.

## Tasks

- [x] BDD specs; the clipboard is stubbed rather than driven through the
      permissions API — see the note below.
- [x] Golden files stored under `e2e/fixtures/`; no personal data in goldens —
      a neutral test template, never the shipped default one.

## What landed

| File                             | Technique                                  | Tests         |
| -------------------------------- | ------------------------------------------ | ------------- |
| `payment-message-golden.spec.ts` | Golden contract + equivalence partitioning | 4             |
| `clipboard-copy.spec.ts`         | Decision table                             | 3, one pinned |

The clipboard stub now has three modes — `"off"`, `"working"` and `"failing"`.
The failing mode is what makes DEF-011 testable: it rejects, which is what a
real browser does when the document is not focused or permission is refused.
Driving that through the permissions API instead would mean asking the browser
to deny a permission it grants by default, which is harder to arrange and no
more faithful than a rejecting stub.

## The golden message contains a non-breaking space

The most useful thing this batch found. `Intl.NumberFormat` puts **U+00A0**
between the currency code and the amount, not an ordinary space. The first run
of the golden test failed with:

```
Expected: "UAH 1,000.00"
Received: "UAH 1,000.00"
```

Two strings that are identical on screen and in a diff. The golden fixture now
holds the real byte, and the placeholder tests build their expectations with the
app's own `formatCurrency` rather than a hand-typed string.

This matters beyond the test. The payment message is the one thing in this app
that reaches another person, and a React port that formats currency by hand —
`` `${currency} ${amount}` `` — would produce a message that looks right and is
not the same text. The golden is the guard against exactly that, so it compares
with no trimming and no normalising, trailing newline included.

## Unknown placeholders pass straight through

`{{student}}` is not substituted, and `{{Total}}` does not match `{{total}}`
because the replacement is case-sensitive. Neither is stripped and nothing
warns, so a typo in the template reaches the recipient verbatim. Tested as
current behaviour; whether the app should validate the template is a product
question, and it joins the list from batches
[1.8](p1-08-coverage-groups.md) and [1.10](p1-10-coverage-overrides-pricing.md).

## DEF-011, verified

With the clipboard rejecting, the app still flips the button to "Copied!" and
closes the dialog a second later. Unpinned, the test reports the dialog hidden
when it should have stayed open. The rejection surfaces only as an unhandled
promise rejection in the console — the user is told nothing and believes a
message they never copied is ready to paste.

## Acceptance criteria

- [x] `npx playwright test --repeat-each=3` exit 0; only fixme specs skip.
- [x] Golden fixtures contain no value from the personal-data lines of
      `index.html`. Both fixture files are neutral text, checked by grep.

## Merge order and dependencies

Depends on 1.7. Parallel development, sequential merge. Deployable: yes.

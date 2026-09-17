# Batch 5.4a — The response headers, and a policy somebody actually ran

Phase 5 · [Plan home](README.md) · Prev: [5.3b](p5-03b-hide-unavailable-sign-in.md) · Next: [5.4](p5-04-security-review.md)

## Goal

The two rows of [5.4](p5-04-security-review.md)'s checklist that are code rather
than a person reading a live system: the security headers (row 18) and the
Content-Security-Policy decision (row 19). Plus `npm audit` (row 8).

The other twenty rows need someone looking at consoles and live responses, and
they stay in 5.4.

## The headers

Set in `vercel.json`, which is where security-auth.md says they go:

| Header                      | Value                                   |
| --------------------------- | --------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`   |
| `X-Content-Type-Options`    | `nosniff`                               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`       |
| `Content-Security-Policy`   | `default-src 'self'` and the list below |

**`scripts/serve.mjs` reads the same file and applies the same list.** Not a
copy — it parses `vercel.json`, so a header added there appears locally on the
next start and one removed disappears. Without that, the spec below could only
run against a deployment, and a Content-Security-Policy would have been tested
for the first time by the teacher.

## Row 19: the policy is set, and this is what it took to say so

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self'; form-action 'self'; frame-ancestors 'none';
base-uri 'none'; object-src 'none'
```

RP-10 said a strict policy was "feasible" because Vite emits no inline script.
That was a reading. Two things had to be checked before it could be a decision.

**Does Vite emit an inline script?** No — the built `index.html` carries one
`<script type="module" crossorigin src="/assets/…">` and nothing inline.

**Does React's `style={{ … }}` violate `style-src 'self'`?** `GroupModal` sets
one (`display`, on the date section). The answer is no, and the reason is worth
writing down: CSP blocks the **style attribute**, and React assigns through the
CSSOM. Both were tried. A `setAttribute("style", …)` is blocked and reported;
`element.style.display = …` is not.

### The probe that proved nothing, and how that was caught

The first attempt ran `eval("1+1")` in the browser's devtools context and
concluded the policy was not enforced, because it was not blocked. That was
wrong: a devtools evaluation is not governed by the page's policy. An inline
`<script>` **appended to the page** is, and it was blocked.

The lesson is lesson 32's, one layer down: _what would this check say if the
subject were absent?_ "Nothing was blocked" is the same observation whether the
policy is permissive, absent, or simply not applied to the thing being measured.
So the spec below proves its own collector before it trusts it.

## Tests

`e2e/features/response-headers.spec.ts`, three specs.

Equivalence partitioning over the two things that serve a response — a static
file and the API — because a header on `/` says nothing about `/api/health`, and
row 18 asks about both.

Then a spec that opens every dialog, including the one that sets a style from
JavaScript, and fails on any violation the browser reports. **It then injects an
inline script on purpose and fails if that is _not_ blocked.** Without that
second half the first half passes just as happily against a page with no policy
at all.

## npm audit — row 8

4 moderate, unchanged: `drizzle-kit` → `@esbuild-kit/esm-loader` → `esbuild
<=0.24.2`, GHSA-67mh-4wv8-2f99. Both trees report it, for the reason batch 5.2a
recorded — `better-auth` declares an **optional** peer dependency on
drizzle-kit, so npm walks that edge into the production tree.

Recorded, not fixed, with the evidence from 5.2a: nothing imports it (not
`better-auth/dist`, not the adapter, and loading the entry does not pull it into
`process.moduleLoadList`), the advisory concerns esbuild's development server,
and the only offered fix is thirteen minor versions back.

## Acceptance criteria

- [x] The four headers are on `/` and on `/api/health` locally, asserted.
- [x] The CSP is set, and the app runs under it with no violation.
- [x] The violation collector is proved by a deliberate violation.
- [x] `format:check`, `lint`, `typecheck`, `typecheck:app`, `typecheck:api`,
      `check:pii` clean. `test:unit` 365. `test:e2e` 201, up from 199.
- [x] `npm audit` recorded with a decision.
- [ ] **After the merge:** the same headers read off the live response, by a
      person, and written into 5.4's checklist row 18. This spec proves what the
      repository declares, not what Vercel applies.

## What is left in 5.4

Twenty of the twenty-three rows, and every one of them needs a person: MFA on
four accounts, Sensitive flags, the consent screen, an observed OAuth `state`
and PKCE, cookie flags on a live response, a rate-limit burst, the runtime logs,
and both DPAs.

## Merge order and dependencies

Depends on [5.3a](p5-03a-sign-in-ui.md). Opened against `main` and **not**
stacked on [5.3b](p5-03b-hide-unavailable-sign-in.md), which was in flight at
the same time — the two touch disjoint files, and lesson 25 is why the branch
was rebuilt on `main` rather than left where it started. Deployable: yes.

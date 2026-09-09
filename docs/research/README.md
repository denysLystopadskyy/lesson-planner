# Research programme — React migration, durable storage, functionality audit

Nine reports on the Group Lesson Planner, produced 2026-08-20, and a tenth on 2026-09-09
(RP-10, the service evaluation that shaped plan Phases 4–6).

**Only the Markdown is committed, and it is the source of record.** Each report can also be
built as a standalone offline HTML file and an A4 PDF with page numbers, identical in
content — see "Building the HTML and PDF" below. Those two formats are generated artifacts
and are gitignored, so edit the `.md` and rebuild rather than editing them directly.

## Start here

**[RP-09 — Synthesis and execution roadmap](rp09-roadmap/rp09-roadmap.md)** is the one to
read first. Its section 1 is ten bullets of decisions, section 4 is the immediate-action
block, and section 9 carries 34 ready-to-run implementation prompts in priority order. The
other eight reports are its evidence base.

For the hosting, database and sign-in decision of 2026-09-09, read
**[RP-10 — Service evaluation](rp10-service-evaluation/rp10-service-evaluation.md)** — its
executive summary is the recommended stack, its §4 lists what it changes against RP-04 to
RP-09, and the three pages under it hold the vendor figures with access dates.

## The reports

| # | Report | What it settles | Pages |
|---|---|---|---|
| RP-01 | [Application inventory](rp01-app-inventory/rp01-app-inventory.md) | Feature inventory, data model, storage map, 26 defects, the observable surface usable as test anchors | 30 |
| RP-02 | [React migration strategy](rp02-react-migration/rp02-react-migration.md) | Test-first vs scaffold-first vs a third option, and the phased plan with rollback | 26 |
| RP-03 | [Test architecture](rp03-test-architecture/rp03-test-architecture.md) | Which test layers earn their cost, the locator policy that survives a rewrite, CI design | 38 |
| RP-04 | [Build tooling and deployment](rp04-build-deploy/rp04-build-deploy.md) | Vite and base-path config, Pages publishing, cutover and rollback checklists | 41 |
| RP-05 | [Durable storage](rp05-durable-storage/rp05-durable-storage.md) | Why the data was lost, the candidate comparison, the primary store and its fallback | 32 |
| RP-06 | [Authentication and data protection](rp06-auth-gdpr/rp06-auth-gdpr.md) | Sign-in choice, what protects a public client, data classification, GDPR posture | 34 |
| RP-07 | [Data migration, backup and recovery](rp07-data-migration-recovery/rp07-data-migration-recovery.md) | Schema versioning, one-time import, backup design, restore drill, residual failure modes | 32 |
| RP-08 | [Functionality, UX and accessibility](rp08-ux-a11y-audit/rp08-ux-a11y-audit.md) | Capability coverage, UX and WCAG findings, mobile and scale behaviour, improvement backlog | 28 |
| RP-09 | [Synthesis and roadmap](rp09-roadmap/rp09-roadmap.md) | 20 resolved conflicts, the sequenced roadmap, the consolidated quick-win backlog | 61 |
| RP-10 | [Service evaluation: hosting, database, sign-in](rp10-service-evaluation/rp10-service-evaluation.md) | Vercel vs Netlify, Cloudflare, Render, staying on Pages; Neon vs Supabase, Turso, PlanetScale, plain Postgres, D1, Firestore; Better Auth vs Auth.js, Clerk, Auth0, Supabase Auth, Firebase Auth, Cloudflare Access, Neon Auth; the recommended stack, what changes against RP-04–RP-09, and the plan rework into Phases 4–6 | — (markdown wiki, four pages) |

Totals for RP-01 to RP-09: about 136,000 words, 142 tables, 246 cited sources each with an
access date, and 34 deduplicated implementation prompts. RP-10 adds about 15,000 words
across four pages and 277 cited sources, each with the access date 2026-09-09.

## Conventions used throughout

- Any figure that could not be verified against a primary source is labelled `TBD` with the
  action that would resolve it. Nothing is estimated.
- Findings distinguish **runtime-verified** (observed in a browser), **statically read**, and
  **inference**.
- Code locations are cited as `index.html:LINE`. These resolve against the **deployed and
  committed** file, which is 1,473 lines. A diverged uncommitted copy of 1,491 lines exists
  in the developer's working checkout; line numbers do not match it. Note that the roadmap's
  step R3 lands that diverged copy — the moment it does, every citation in every report
  shifts by up to 18 lines. R3 therefore carries a re-verification task, and RP-09 §9 opens
  with a standing warning to check line numbers before pasting any prompt.
- The accessibility audit was requested against WCAG 2.1 AA. RP-08 reports against 2.1;
  RP-09 retargets the project to **WCAG 2.2 AA** and says so in its section 2. The practical
  difference is target size: 2.2 adds SC 2.5.8 at Level AA (24x24 CSS px), which the app
  passes, while 2.1's only target-size criterion is SC 2.5.5 at Level AAA (44x44), which it
  fails and which is out of scope at AA. Read any target-size verdict with its version.
- The teacher's personal payment identifiers, hardcoded in the app's default template, are
  never reproduced in these reports — only cited by line reference. A verification gate
  enforces this.
- RP-10 is a small wiki — a hub and three pages — and markdown only. The build and verify
  tools below are single-file, so they are not run on it; it follows the same conventions
  (figures quoted as stated, `TBD` where a page was silent, a Sources table per page with
  URL and access date, no personal data) and says so in its metadata. Vendor pricing and
  limits change often: every RP-10 figure is current-as-of 2026-09-09.

## Building the HTML and PDF

Neither format is committed. Build one when you want it:

```bash
cd docs/research/tools
npm ci
node build-report.js ../rp09-roadmap/rp09-roadmap.md
```

That writes the `.html` and `.pdf` next to the `.md`. Rendering uses `marked` for HTML and
`playwright-core` for the PDF, at pinned versions. On a machine with no cached browser, run
`npx playwright-core install chromium` first, or set `PW_EXEC` to any Chromium or Chrome
binary.

## Verifying a report

Build the report first — the gate checks all three formats, so it fails on a fresh clone
where only the Markdown exists.

```bash
./docs/research/tools/verify-report.sh docs/research/rp09-roadmap/rp09-roadmap.md
```

Checks that all three formats exist, that the HTML is fully self-contained, that its
structure matches the Markdown, that every source row carries a bare resolvable URL and an
access date, that each quick-win prompt has all five required parts, and that no personal
data from `index.html` is reproduced. It exits non-zero on failure and prints figures that
need a human check.

Visual PDF inspection — page-number footers, unclipped tables — needs poppler
(`brew install poppler`), then `pdftoppm -png -r 80 -f 1 -l 1 <pdf> <prefix>`.

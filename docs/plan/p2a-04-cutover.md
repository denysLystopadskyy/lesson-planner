# Batch 2a.4 — Cutover

Phase 2a · [Plan home](README.md) · Prev: [2a.3f](p2a-03f-layout-fix-visual-checks.md) · Next: [2b.1](p2b-01-logic-modules-adrs.md)

## Goal

The live URL serves the React build; the legacy file is gone; one revert
restores everything.

The React build had to **look** like the page it replaces first. That took two
unplanned batches: [2a.3e](p2a-03e-port-styles.md) brought the stylesheet across
after screenshots showed the port had none, and
[2a.3f](p2a-03f-layout-fix-visual-checks.md) fixed the header it left broken and
added the checks that can see a layout regression.

## Tasks

- [x] Workflow: build with `--base=/lesson-planner/` and no storage prefix;
      publish the React build at `/`; stop publishing `/next/`.
- [x] Delete the legacy `index.html`.
- [x] Remove the `index.html` entry from `.prettierignore`.
- [x] Retire the two-project suite (see below) — not in the original task list.
- [x] Run the full suite against the production build locally.
- [ ] Run it against the deployed URL after the merge.
- [ ] Verify on the teacher's device: her data is present (same origin, same
      keys; see
      [storage-data-contract.md](../../.claude/context/storage-data-contract.md)).
- [ ] **Check the `paymentTemplate` key exists in her browser before cutover.**
      The legacy app wrote that key only when the template editor was saved, and
      the React app's default is neutral rather than a copy of the legacy one
      (batch [2a.3d](p2a-03d-port-template-message-csv.md), see
      [security-auth.md](../../.claude/context/security-auth.md)). If the key is
      absent, her first payment message after cutover would carry
      `<recipient>` instead of her bank details. The fix is one minute in the
      template editor, done by her, on her device — nothing is copied into this
      repository.

## The three-file estimate was wrong, and the guarantee is not

The plan said the PR would contain the workflow change, the `index.html`
deletion and one `.prettierignore` line, and that this short list _was_ the
rollback guarantee.

Deleting `index.html` also deletes the app that half the suite is pointed at.
`npm run serve` served the repository root; the `legacy` Playwright project
loaded that page; four specs existed only to describe its behaviour; and the
`@ported` / `@portedonly` tags existed only to tell the two projects apart.
Leaving any of that in place ships a red suite on `main`.

So the PR is larger. **The guarantee is untouched**, because it was never a file
count: the batch is one squashed commit, and `git revert` restores the workflow,
the page, the second project and the specs together.

## What retiring the suite meant

| Change                                                                        | Why                                                                                                                                             |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| One Playwright project, `app`, at `localhost:4173`                            | `npm run serve` now builds the app the way the workflow does — base `/`, no prefix — and previews it, so the suite runs the artefact that ships |
| `@ported` and `@portedonly` removed from every title                          | they meant "also run against the React build" and "not against the legacy page". Both are answers to a question that no longer exists           |
| `LEGACY_*` / `PORTED_*` collapsed to `APP_BASE_PATH` and `APP_STORAGE_PREFIX` | one target, one pair of values. The per-project mechanism stays — a second target would need it again                                           |
| `ported-shell.spec.ts` → `storage-contract.spec.ts`                           | it is the storage contract now. The legacy-page file of that name was deleted                                                                   |
| `ported-groups.spec.ts` → `group-regressions.spec.ts`                         | it asserts the three things the legacy page got wrong and this app does not                                                                     |
| Five pinned tests deleted                                                     | their subject was the deleted page — see the registry                                                                                           |
| Visual baselines regenerated                                                  | they are named per project, so `-legacy-` and `-ported-` became `-app-`                                                                         |

## Eight defects closed by deleting a file

DEF-001, DEF-003, DEF-008, DEF-009, DEF-014, DEF-018 and DEF-019 lived only in
`index.html`. None was fixed: the React app never had them, because controlled
inputs, a guarded storage read, React's escaping, a single Escape handler and a
real `<header>` landmark do not fail that way. Where the behaviour is still worth asserting, the pin became
a plain assertion so a regression fails loudly.

DEF-015 — the owner's real IBAN and tax id in the shipped source — is closed in
the **working tree** only. Git history still holds the values, and cleaning it
needs a rewrite and a force push, which is the owner's separate decision. Batch
[3.5](p3-05-pii-template-cleanup.md) is left with the build-time grep gate and
the first-run help text.

## Acceptance criteria

- [x] Full suite exit 0 against the production build with `--repeat-each=3`:
      276 passed, 27 skipped (nine pins).
- [x] `npm run typecheck`, `npm run typecheck:app`, `npm run lint`,
      `npx prettier --check .` all clean.
- [x] The PR is one squashed commit, so rollback is one revert.
- [ ] Full suite exit 0 against the deployed `/`.
- [ ] Her data visible after cutover (manual confirmation recorded here).
- [ ] A payment message generated after cutover carries her real payment block
      (confirmed by her, not reproduced here).

## Merge order and dependencies

Depends on 2a.3f. Blocks all of Phase 2b. Deployable: yes — this batch IS the
cutover; rollback is one revert.

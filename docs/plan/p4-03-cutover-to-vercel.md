# Batch 4.3 — Cutover to the new origin

Phase 4 · [Plan home](README.md) · Prev: [4.2](p4-02-api-skeleton-local-server.md) · Next: [4.4](p4-04-retire-github-pages.md)

## Goal

The teacher opens the new URL and finds all her data. If anything is wrong,
one step goes back.

This is the origin change the storage contract used to forbid. It is allowed
only because the export/import of batch [3.3](p3-03-json-backup.md) exists and
is rehearsed first — the rule is in
[storage-data-contract.md](../../.claude/context/storage-data-contract.md).

## Preconditions

- Phase 3 is done ([3.7](p3-07-cleanup.md) merged): she moves once, to a
  stabilized app.
- [4.2](p4-02-api-skeleton-local-server.md) is merged: the host is proven.
- The Vercel Support answer from [4.1](p4-01-vercel-project-previews.md) is
  recorded, or the owner chose Pro.

## Tasks

- [ ] **Owner decides the custom domain** (recommended — see
      [RP-10 §2](../research/rp10-service-evaluation/rp10-service-evaluation.md)).
      If yes: register it, add it to the Vercel project, confirm HTTPS works,
      all before the teacher migrates. Record in
      [deployment.md](../../.claude/context/deployment.md). The origin she
      migrates to is the one that stays.
- [ ] Rehearse RP-07 §6 Procedure B in an isolated browser profile with test
      data: export on the Pages site, import on the new origin, compare the
      dry-run preview counts on both sides. Record the result. No real data.
- [ ] Add the "moved" banner. A build-time variable `VITE_MOVED_TO` holds the
      new URL. When set, the app shows a banner: "This app has moved to <URL>.
      Export your data here and import it there." with the export button one
      click away. `deploy.yml` sets it for the Pages build; Vercel does not.
      e2e specs for both states; the banner is absent by default.
- [ ] Keep "a red suite cannot publish". **Owner action:** make the CI `checks`
      job a required status check for `main` (Settings → Branches). Alternative
      if the owner prefers: deploy from GitHub Actions with `vercel build` and
      `vercel deploy --prebuilt`, gated on the verify job. Record the choice in
      deployment.md.
- [ ] Write the teacher's steps, in her language, six lines at most: open the
      old site → Export → open the new URL → Import → check the number of
      groups and one lesson count → open the template editor and confirm her
      payment block is there. The maintainer is on a call while she does it.
- [ ] Run the full suite against the new production URL (`PW_BASE_URL`, the
      measuring config). Record.
- [ ] Set the transition window: the date after which
      [4.4](p4-04-retire-github-pages.md) retires Pages. 60–90 days is the
      recommendation. Record in deployment.md.
- [ ] Follow-up PR: the results table below, with dates.

### Runbook results

| Step                             | Date | Result |
| -------------------------------- | ---- | ------ |
| Custom domain decision           |      |        |
| Procedure B rehearsal            |      |        |
| Banner live on Pages             |      |        |
| CI gate choice                   |      |        |
| Teacher migrated; data confirmed |      |        |
| Suite green against production   |      |        |
| Window end date                  |      |        |

## Acceptance criteria

- The teacher confirms, on the new origin: her groups are there, one lesson
  count matches, the template editor shows her payment block.
- Full suite exit 0 against the new production URL, pixel baselines included.
- The Pages site shows the banner and still serves the app with her data
  untouched. That is the rollback: tell her to keep using the old URL.
- deployment.md records the new origin, the date, the window end date, the CI
  gate choice and the custom-domain decision.

## Merge order and dependencies

Depends on 3.7 and 4.2. Deployable: yes — this batch **is** the move. Rollback
is a sentence, not a deploy.

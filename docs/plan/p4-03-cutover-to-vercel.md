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
- [x] Rehearse RP-07 §6 Procedure B in an isolated browser profile with test
      data: export on the Pages site, import on the new origin, compare the
      dry-run preview counts on both sides. Record the result. No real data.
      **Done 2026-10-17, twice — once into a planner holding data and once into
      an empty one, which is her case. Every RP-07 step passed; the second pass
      found DEF-029 and DEF-030. See
      [Procedure B rehearsal](#procedure-b-rehearsal--2026-10-17) below.**
- [x] Add the "moved" banner — done in [4.3a](p4-03a-moved-banner.md), which
      landed early because it is inert. `deploy.yml` passes
      `VITE_MOVED_TO: ${{ vars.MOVED_TO }}`; Vercel never sets it. e2e specs
      cover both states, against two bundles.
      **What is left here is one owner action:** set the repository variable
      `MOVED_TO` to the new origin, at cutover time. Until then the banner is
      absent.
- [ ] Keep "a red suite cannot publish". **Owner action:** make the CI `checks`
      job a required status check for `main` (Settings → Branches). Alternative
      if the owner prefers: deploy from GitHub Actions with `vercel build` and
      `vercel deploy --prebuilt`, gated on the verify job. Record the choice in
      deployment.md.
- [x] Write the teacher's steps, in her language, six lines at most: open the
      old site → Export → open the new URL → Import → check the number of
      groups and one lesson count → open the template editor and confirm her
      payment block is there. The maintainer is on a call while she does it.
      **Drafted 2026-10-17 — see [The teacher's steps](#the-teachers-steps--drafted-2026-10-17)
      below. Still owed before it is sent: a Ukrainian speaker reads it, and
      the owner decides whether her first sign-in happens on the same call.**
- [ ] Run the full suite against the new production URL (`PW_BASE_URL`, the
      measuring config). **Once, with `--workers=1`, and with nothing else
      running on the machine.** 188 tests from one IP provoked Vercel's
      automatic DDoS mitigation on 2026-09-15, after which the edge answered
      403 to that IP while the site stayed healthy for everyone else. A blocked
      run looks like mass failure; check from another network before believing
      it. See [deployment.md](../../.claude/context/deployment.md) and
      [lesson 29](lessons-learned.md). Record.
- [ ] Set the transition window: the date after which
      [4.4](p4-04-retire-github-pages.md) retires Pages. 60–90 days is the
      recommendation. Record in deployment.md.
- [ ] Follow-up PR: the results table below, with dates.

### Runbook results

| Step                             | Date       | Result                                                       |
| -------------------------------- | ---------- | ------------------------------------------------------------ |
| Custom domain decision           |            |                                                              |
| Pricing and fair-use re-check    | 2026-10-17 | No material change since RP-10. Recorded in deployment.md.   |
| Procedure B rehearsal            | 2026-10-17 | Pass, both passes. Found DEF-029 and DEF-030. Details below. |
| Banner live on Pages             |            |                                                              |
| CI gate choice                   |            |                                                              |
| Teacher migrated; data confirmed |            |                                                              |
| Suite green against production   |            |                                                              |
| Window end date                  |            |                                                              |

### Procedure B rehearsal — 2026-10-17

Run in a browser profile isolated from any real browser, with invented data.
Both planners were empty when it started and both were cleared when it
finished, so no real data was touched. The source planner held three groups —
`TEST Alpha`, `TEST Beta`, `TEST Gamma` — twelve lessons in October 2026 and a
template marked as a test.

It ran **twice**, because the two runs are different cases and only the second
is the teacher's:

- **Pass 1, into a planner that already held data.** One placeholder group was
  put on the new origin first, so the preview's two lines would differ and
  could be read against each other.
- **Pass 2, into an empty planner.** This is what she will actually do: her
  first visit to the new origin shows an empty planner. Pass 2 found a defect
  that pass 1 could not — see **DEF-029** below.

**How it was driven.** The app's own buttons were clicked for everything
except three points where a browser dialog or a file picker cannot be
automated: `window.confirm` was replaced with a function that records the
message and answers, the export was captured from `URL.createObjectURL`
instead of being written to disk, and the chosen file was put on
`#backupInput` through a `DataTransfer` rather than through the picker. So the
import path, the preview text and the storage writes are the real ones; the
click from `Load Backup` to the file input, and the native dialogs themselves,
were not exercised. The e2e suite covers those.

| Step (RP-07 §6 Procedure B)                        | Result                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Export on the old origin                           | Pass. 2060 bytes, `counts` `3 / 12 / 12 / 3 / 153`, fingerprint `fnv1a32:a3ba401b`, `source.origin` `https://denyslystopadskyy.github.io`.                                                 |
| 3 — safety copy before importing                   | Pass. `Save Backup` on the new origin wrote a file with `source.origin` `https://lesson-planner-lac.vercel.app`, counts `1 group / 5 dates`, fingerprint `fnv1a32:5df30ea4`.               |
| 4 — `Load Backup` and choose the file              | Pass. The file written on Pages was accepted on Vercel unchanged.                                                                                                                          |
| 5 — read the dialog, both sides                    | Pass. Quoted in full below.                                                                                                                                                                |
| 5 — Cancel changes nothing                         | Pass. After Cancel, `groupLessonPlannerData` was byte-identical to before and the screen still showed the old planner.                                                                     |
| 6 — confirm                                        | Pass.                                                                                                                                                                                      |
| 7 — verify counts, one month's total, the template | Pass. Three groups, twelve lessons; `TEST Alpha` showed "October 2026 (4 lessons), Total: UAH 1,200.00, Per lesson: UAH 300.00"; the template editor held the exported text byte for byte. |
| 8 — go back by loading the safety copy             | Pass, in both passes. Loading the step-3 file returned the planner to exactly what it held before — in pass 2, empty again (`[]`, no template). This is the step RP-07 actually specifies. |
| Undo banner (not in RP-07; the app offers it)      | **Pass 1 only.** It restored the pre-import planner and removed its own `.pre-import.<epoch>` keys. In pass 2 it was never offered — see DEF-029.                                          |

The dry run, read off the live new origin from a file the live old origin
produced:

```text
Replace everything in this planner with the backup file?

Now:  1 group, 5 lessons, no template
File: 3 groups, 12 lessons, a payment template

This replaces all groups, settings and the payment template.
You can undo it straight afterwards.
```

Three things worth carrying into the teacher's steps:

- **The buttons are `Save Backup` and `Load Backup`**, capitalised that way.
  RP-07 §6 writes them in lower case, and the preview's two lines are labelled
  `Now:` and `File:` rather than "replacing 2 groups with 4 groups".
- **The export records the origin it came from and the import ignores it.**
  `parseBackup` checks format, version, shape and fingerprint; `source.origin`
  is provenance, not permission. That is what makes the cutover possible at
  all, and it is now observed rather than assumed.
- **Do not promise her the Undo button.** On her path — an empty planner on the
  new origin — it does not appear, and the confirmation dialog says it will.
  Her way back is the step-3 safety copy, and behind that the old site, which
  still holds her data untouched. Both were tested and both work. See DEF-029.

### DEF-029 and DEF-030, found by pass 2

**DEF-029 — the import dialog promises an undo that is not offered.** Every
import shows "You can undo it straight afterwards." On a planner that already
holds data that is true. On an **empty** planner it is not:
`snapshotBeforeImport` copies only keys whose value is not `null`, so an empty
planner produces no snapshot at all, `hasSnapshot` returns `false`, and
`importBackup` correctly withholds the button — the comment on that line reads
"Offered only when there is something to put back." Observed on production on
2026-10-17: `snapshotKeys: []` and no banner, under a dialog that had just
promised one. No data can be lost this way, because there was none; what is
wrong is the sentence, and the fact that it is wrong in exactly the case the
cutover puts her in.

**DEF-030 — `Clear All Data` leaves the pre-import snapshots behind.** Its
confirmation says "This cannot be undone", and after it ran the three
`.pre-import.<epoch>` keys still held a complete copy of the cleared planner.
`clearStoredData` removes the three live keys only. Same shape as DEF-013,
which was the template key. Observed 2026-10-17 on production.

Neither is fixed here. This batch is the cutover; both are recorded in the
[DEF registry](def-registry.md) with the evidence.

### The teacher's steps — drafted 2026-10-17

Six lines, in Ukrainian, because that is her language. **The app's own buttons
are in English**, so every button name below is quoted exactly as it appears on
her screen and is left untranslated — a translated button name she cannot find
is worse than an English one she can.

Two things in this draft come from the rehearsal rather than from the original
task description:

- **It does not mention the Undo button**, because on her planner — which is
  empty on the new site — it will not appear (DEF-029). Her way back is line 1's
  file, and behind that the old site, which keeps her data untouched for the
  whole transition window.
- **It warns her about the sign-in button**, which exists only on the new site
  and which she does not need. The consent screen behind it says Neon, not her
  planner, so meeting it unprepared would be alarming for no reason.

> 1. Відкрийте старий сайт і натисніть **Save Backup**. Збережеться файл —
>    не видаляйте його.
> 2. Відкрийте новий сайт. Там буде кнопка **Sign in with Google** — вона вам
>    не потрібна, не натискайте її.
> 3. Натисніть **Load Backup** і виберіть файл із кроку 1.
> 4. У вікні буде два рядки: **Now** — що зараз на новому сайті,
>    **File** — що у файлі. У рядку **File** мають бути ваші групи. Якщо щось
>    не так — натисніть **Cancel** і подзвоніть мені. Скасування нічого не
>    змінює.
> 5. Підтвердіть. Перевірте: кількість груп і кількість занять у одній групі,
>    яку ви пам'ятаєте.
> 6. Натисніть **Edit Template** і перевірте, що ваш текст для оплати на місці.
>    Якщо щось не так — нічого не виправляйте, подзвоніть мені. Старий сайт
>    працює далі, і всі ваші дані там на місці.

The same six lines in English, for the record:

> 1. Open the old site and press **Save Backup**. A file is saved — keep it.
> 2. Open the new site. There is a **Sign in with Google** button there — you
>    do not need it, do not press it.
> 3. Press **Load Backup** and choose the file from step 1.
> 4. The window shows two lines: **Now** — what is on the new site now,
>    **File** — what is in the file. The **File** line should show your groups.
>    If something is wrong, press **Cancel** and call me. Cancelling changes
>    nothing.
> 5. Confirm. Check the number of groups, and the lesson count on one group you
>    remember.
> 6. Press **Edit Template** and check your payment text is there. If anything
>    is wrong, do not fix it — call me. The old site keeps working, and all your
>    data is still there.

**Before this is sent to her, two things are owed.** A Ukrainian speaker should
read the wording — it was drafted, not reviewed, and a clumsy sentence in an
instruction read under stress costs more than it does anywhere else. And the
owner decides whether her first real sign-in happens on the same call: it would
close [5.4](p5-04-security-review.md) row 17 and prove her address passes the
allowlist, but it adds a step to the one irreversible thing she does that day.
The draft above assumes **not** — the move stays export and import only.

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
